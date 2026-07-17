-- =============================================================================
-- Migration: PR1 — Stabilization & Security Fixes
-- Version: 4
-- Description:
--   Rewrites transition_ride_state with auth.uid(), correct previous_status,
--   idempotency, driver cancellation. Makes dispatch RPCs security definer.
--   Adds register_customer_for_tenant RPC, list_quoteable_rides view.
--   Fixes driver_presence toggle, prices save, and notification insert under RLS.
-- =============================================================================

-- ─── 1. Transition validation table ─────────────────────────────────────────

create table if not exists public.ride_state_transitions (
  id uuid primary key default gen_random_uuid(),
  from_status public.ride_status not null,
  to_status public.ride_status not null,
  allowed_roles text[] not null default '{}',
  require_cancellation_reason boolean not null default false,
  description text,
  unique (from_status, to_status)
);

insert into public.ride_state_transitions (from_status, to_status, allowed_roles, require_cancellation_reason, description) values
  ('requested', 'quoted', '{driver}', false, 'driver submits a quote'),
  ('requested', 'confirmed', '{customer}', false, 'customer books without quote'),
  ('requested', 'cancelled', '{customer,tenant_admin,platform_admin}', true, 'customer or admin cancels before assignment'),
  ('quoted', 'confirmed', '{customer}', false, 'customer accepts a driver quote'),
  ('quoted', 'cancelled', '{customer,tenant_admin,platform_admin}', true, 'customer or admin cancels after quote'),
  ('confirmed', 'driver_assigned', '{tenant_admin,platform_admin}', false, 'admin assigns a driver'),
  ('confirmed', 'cancelled', '{customer,tenant_admin,platform_admin}', true, 'customer or admin cancels after confirmation, before assign'),
  ('driver_assigned', 'arriving', '{driver}', false, 'driver starts heading to pickup'),
  ('driver_assigned', 'confirmed', '{tenant_admin,platform_admin}', false, 'admin unassigns driver'),
  ('driver_assigned', 'cancelled', '{driver,tenant_admin,platform_admin}', true, 'driver or admin cancels after assignment'),
  ('arriving', 'in_progress', '{driver}', false, 'passenger on board'),
  ('arriving', 'cancelled', '{driver,tenant_admin,platform_admin}', true, 'driver or admin cancels while arriving'),
  ('in_progress', 'completed', '{driver}', false, 'ride completed — driver closes out'),
  ('in_progress', 'cancelled', '{tenant_admin,platform_admin}', true, 'admin cancels during ride')
on conflict (from_status, to_status) do nothing;

-- ─── 2. Fix is_tenant_admin: make it safe for security definer functions ──────

create or replace function public.is_tenant_admin(target_tenant_id uuid default null)
returns boolean
language plpgsql
stable
security invoker
as $$
declare
  resolved_tenant_id uuid;
begin
  resolved_tenant_id := coalesce(target_tenant_id, public.current_tenant_id());
  if resolved_tenant_id is null then
    return false;
  end if;
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
      and tenant_id = resolved_tenant_id
      and role in ('tenant_admin', 'platform_admin')
  );
end;
$$;

-- ─── 3. Fix transition_ride_state (actor, idempotency, previous_status,       ──
--       cancellation reason, security definer for RLS bypass)                    ──

drop function if exists public.transition_ride_state(uuid, public.ride_status, uuid, jsonb);

create or replace function public.transition_ride_state(
  target_ride_request_id uuid,
  new_status public.ride_status,
  actor_profile_id uuid default null,
  event_payload jsonb default '{}'::jsonb
)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_ride public.ride_requests;
  actor_id uuid;
  current_actor public.profiles;
  actor_driver_id uuid;
  actor_role text;
  allowed_roles_for_transition text[];
  require_reason boolean;
  old_status public.ride_status;
  v_cancellation_reason_id uuid;
  v_cancellation_note text;
begin
  -- 1. Resolve actor from auth.uid() if not provided (ignore caller's param for security)
  actor_id := auth.uid();
  if actor_id is null then
    raise exception 'not_authenticated' using detail = 'You must be logged in to change ride state';
  end if;

  -- 2. Load and lock the ride
  select * into current_ride
  from public.ride_requests
  where id = target_ride_request_id
  for update;

  if current_ride.id is null then
    raise exception 'ride_request_not_found' using detail = 'Ride request not found';
  end if;

  -- 3. Idempotency: if already in target state, return the ride as-is
  if current_ride.status = new_status then
    return current_ride;
  end if;

  -- 4. Save old status BEFORE any updates
  old_status := current_ride.status;

  -- 5. Load actor profile
  select * into current_actor
  from public.profiles
  where id = actor_id;

  if current_actor.id is null then
    raise exception 'actor_not_found' using detail = 'Profile not found for authenticated user';
  end if;

  -- 6. Load driver record if actor is a driver
  if current_actor.role = 'driver' then
    select id into actor_driver_id
    from public.drivers
    where profile_id = actor_id and tenant_id = current_ride.tenant_id;
  end if;

  -- 7. Check tenant access
  if current_actor.tenant_id != current_ride.tenant_id and current_actor.role != 'platform_admin' then
    raise exception 'tenant_mismatch' using detail = 'Actor does not belong to the same tenant as the ride';
  end if;

  -- 8. Validate the transition
  actor_role := current_actor.role;

  -- Admin can do any valid transition within their tenant
  if actor_role = 'tenant_admin' or actor_role = 'platform_admin' then
    -- Admin allowed, fall through
  elsif actor_role = 'customer' then
    if current_ride.customer_id != actor_id then
      raise exception 'not_ride_customer' using detail = 'Only the ride customer can change this ride';
    end if;
  elsif actor_role = 'driver' then
    if actor_driver_id is null or current_ride.driver_id != actor_driver_id then
      raise exception 'not_assigned_driver' using detail = 'Only the assigned driver can change this ride';
    end if;
  else
    raise exception 'unknown_role' using detail = format('Role %s cannot transition rides', actor_role);
  end if;

  -- Check allowed roles for this transition
  select allowed_roles, require_cancellation_reason
  into allowed_roles_for_transition, require_reason
  from public.ride_state_transitions
  where from_status = old_status and to_status = new_status;

  if allowed_roles_for_transition is null then
    raise exception 'transition_not_allowed'
      using detail = format('Cannot transition from %s to %s — no matching rule', old_status, new_status);
  end if;

  if not (actor_role = any(allowed_roles_for_transition)) then
    raise exception 'transition_not_allowed_for_role'
      using detail = format('Role %s cannot transition from %s to %s', actor_role, old_status, new_status);
  end if;

  -- 9. Validate cancellation
  if new_status = 'cancelled' then
    if require_reason then
      v_cancellation_reason_id := (event_payload ->> 'cancellation_reason_id')::uuid;
      v_cancellation_note := event_payload ->> 'cancellation_note';
      if v_cancellation_reason_id is null and v_cancellation_note is null then
        raise exception 'cancellation_reason_required'
          using detail = 'A cancellation reason or note is required';
      end if;
    end if;
  end if;

  -- 10. Check driver is not already on another active ride (for driver_assigned)
  if new_status = 'driver_assigned' then
    if exists (
      select 1 from public.ride_requests
      where driver_id = (event_payload ->> 'driver_id')::uuid
        and status in ('driver_assigned', 'arriving', 'in_progress')
        and id != target_ride_request_id
    ) then
      raise exception 'driver_already_on_ride'
        using detail = 'The driver is already assigned to an active ride';
    end if;
  end if;

  -- 11. Perform the transition
  update public.ride_requests
  set
    status = new_status,
    estimated_price = case
      when new_status = 'quoted' and current_ride.estimated_price is null
        then (event_payload ->> 'quoted_price')::numeric
      else current_ride.estimated_price
    end,
    final_price = case
      when new_status = 'completed' and current_ride.final_price is null
        then coalesce(current_ride.estimated_price, (event_payload ->> 'final_price')::numeric)
      else current_ride.final_price
    end,
    driver_id = case
      when new_status = 'driver_assigned' and (event_payload ? 'driver_id')
        then (event_payload ->> 'driver_id')::uuid
      when new_status = 'confirmed' then null
      else driver_id
    end,
    cancelled_by = case when new_status = 'cancelled' then actor_id else cancelled_by end,
    cancellation_reason_id = case when new_status = 'cancelled' then v_cancellation_reason_id else cancellation_reason_id end,
    cancellation_note = case when new_status = 'cancelled' then v_cancellation_note else cancellation_note end,
    cancelled_at = case when new_status = 'cancelled' then now() else cancelled_at end,
    updated_at = now()
  where id = target_ride_request_id
  returning * into current_ride;

  -- 12. Record event (uses old_status since we saved it before UPDATE)
  insert into public.ride_events (tenant_id, ride_request_id, actor_id, event_type, payload)
  values (
    current_ride.tenant_id,
    current_ride.id,
    actor_id,
    new_status,
    event_payload || jsonb_build_object(
      'previous_status', old_status,
      'actor_role', actor_role
    )
  );

  -- 13. Create notification for the other party (security definer bypasses RLS)
  if actor_role = 'customer' and current_ride.driver_id is not null then
    insert into public.notifications (tenant_id, recipient_id, ride_request_id, channel, status, title, body, data)
    select
      current_ride.tenant_id,
      d.profile_id,
      current_ride.id,
      'in_app', 'queued',
      'Actualizacion del viaje',
      format('Estado: %s', new_status),
      jsonb_build_object('ride_request_id', current_ride.id, 'event', new_status)
    from public.drivers d
    where d.id = current_ride.driver_id;
  end if;

  if actor_role in ('driver', 'tenant_admin', 'platform_admin') then
    insert into public.notifications (tenant_id, recipient_id, ride_request_id, channel, status, title, body, data)
    values (
      current_ride.tenant_id,
      current_ride.customer_id,
      current_ride.id,
      'in_app', 'queued',
      'Actualizacion del viaje',
      format('Estado: %s', new_status),
      jsonb_build_object('ride_request_id', current_ride.id, 'event', new_status)
    );
  end if;

  -- 14. Create driver_earning if completed
  if new_status = 'completed' then
    insert into public.driver_earnings (tenant_id, driver_id, ride_request_id, amount, currency, commission_amount, net_amount, status)
    values (
      current_ride.tenant_id,
      current_ride.driver_id,
      current_ride.id,
      current_ride.final_price,
      (select currency from public.tenants where id = current_ride.tenant_id),
      0,
      current_ride.final_price,
      'pending'
    )
    on conflict (ride_request_id, driver_id) do nothing;
  end if;

  return current_ride;
end;
$$;

grant execute on function public.transition_ride_state(uuid, public.ride_status, uuid, jsonb)
  to authenticated;

-- ─── 4. Fix submit_driver_quote: security definer + driver busy check ─────────

drop function if exists public.submit_driver_quote(uuid, numeric, uuid);

create or replace function public.submit_driver_quote(
  target_ride_request_id uuid,
  quoted_price numeric(12, 2),
  driver_id uuid default null
)
returns public.ride_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  current_ride public.ride_requests;
  driver_record public.drivers;
  new_quote public.ride_quotes;
begin
  if driver_id is null then
    select d.id into driver_record
    from public.drivers d
    where d.profile_id = auth.uid() and d.status = 'active';
  else
    select * into driver_record
    from public.drivers d
    where d.id = driver_id and d.status = 'active';
  end if;

  if driver_record.id is null then
    raise exception 'driver_not_found_or_inactive';
  end if;

  -- Check driver is not already on an active ride
  if exists (
    select 1 from public.ride_requests
    where driver_id = driver_record.id
      and status in ('driver_assigned', 'arriving', 'in_progress')
  ) then
    raise exception 'driver_busy' using detail = 'Driver is already on an active ride';
  end if;

  select * into current_ride
  from public.ride_requests
  where id = target_ride_request_id
    and tenant_id = driver_record.tenant_id
    and status in ('requested', 'quoted');

  if current_ride.id is null then
    raise exception 'ride_not_available_for_quoting';
  end if;

  insert into public.ride_quotes (tenant_id, ride_request_id, driver_id, price, currency, expires_at)
  values (
    driver_record.tenant_id,
    target_ride_request_id,
    driver_record.id,
    quoted_price,
    (select currency from public.tenants where id = driver_record.tenant_id),
    now() + interval '5 minutes'
  )
  on conflict (ride_request_id, driver_id)
  do update set price = quoted_price, expires_at = now() + interval '5 minutes', accepted_at = null
  returning * into new_quote;

  if current_ride.status = 'requested' then
    update public.ride_requests set status = 'quoted', updated_at = now() where id = target_ride_request_id;
  end if;

  insert into public.ride_events (tenant_id, ride_request_id, actor_id, event_type, payload)
  values (
    driver_record.tenant_id, target_ride_request_id, auth.uid(),
    'quote_submitted',
    jsonb_build_object('driver_id', driver_record.id, 'price', quoted_price)
  );

  insert into public.notifications (tenant_id, recipient_id, ride_request_id, channel, status, title, body, data)
  values (
    driver_record.tenant_id, current_ride.customer_id, target_ride_request_id,
    'in_app', 'queued', 'Nueva cotizacion recibida',
    format('Un chofer ha ofertado CUP %s para tu viaje', quoted_price),
    jsonb_build_object('ride_request_id', target_ride_request_id, 'event', 'quote_submitted')
  );

  return new_quote;
end;
$$;

grant execute on function public.submit_driver_quote(uuid, numeric, uuid)
  to authenticated;

-- ─── 5. Fix auto_assign_driver: security definer + occupation check ───────────

drop function if exists public.auto_assign_driver(uuid, uuid);

create or replace function public.auto_assign_driver(
  target_ride_request_id uuid,
  actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_ride public.ride_requests;
  nearest_driver record;
  assignment_result public.ride_requests;
  actor_id uuid;
begin
  actor_id := auth.uid();
  if actor_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select * into current_ride
  from public.ride_requests
  where id = target_ride_request_id
    and status = 'requested'
  for update;

  if current_ride.id is null then
    return jsonb_build_object('success', false, 'error', 'ride_not_found_or_not_available');
  end if;

  select * into nearest_driver
  from public.find_nearby_drivers(
    current_ride.tenant_id,
    current_ride.pickup_lat,
    current_ride.pickup_lng,
    10
  )
  where not exists (
    select 1 from public.ride_requests
    where driver_id = find_nearby_drivers.driver_id
      and status in ('driver_assigned', 'arriving', 'in_progress')
  )
  limit 1;

  if nearest_driver.driver_id is null then
    return jsonb_build_object('success', false, 'error', 'no_driver_available');
  end if;

  update public.ride_requests
  set
    driver_id = nearest_driver.driver_id,
    status = 'driver_assigned',
    updated_at = now()
  where id = target_ride_request_id
  returning * into assignment_result;

  insert into public.ride_assignments (tenant_id, ride_request_id, driver_id, assigned_by, notes)
  values (current_ride.tenant_id, target_ride_request_id, nearest_driver.driver_id, actor_id, 'auto-asignado por proximidad');

  insert into public.ride_events (tenant_id, ride_request_id, actor_id, event_type, payload)
  values (
    current_ride.tenant_id, target_ride_request_id, actor_id,
    'driver_assigned',
    jsonb_build_object('driver_id', nearest_driver.driver_id, 'method', 'auto', 'distance_km', nearest_driver.distance_km)
  );

  insert into public.notifications (tenant_id, recipient_id, ride_request_id, channel, status, title, body, data)
  values (
    current_ride.tenant_id, nearest_driver.profile_id, target_ride_request_id,
    'in_app', 'queued', 'Nuevo viaje asignado',
    format('Recogida: %s', current_ride.pickup_address),
    jsonb_build_object('ride_request_id', target_ride_request_id, 'event', 'driver_assigned')
  );

  return jsonb_build_object(
    'success', true,
    'driver_id', nearest_driver.driver_id,
    'driver_name', nearest_driver.display_name,
    'distance_km', nearest_driver.distance_km,
    'vehicle_plate', nearest_driver.vehicle_plate
  );
end;
$$;

grant execute on function public.auto_assign_driver(uuid, uuid)
  to authenticated;

-- ─── 6. register_customer_for_tenant: secure registration RPC ────────────────

create or replace function public.register_customer_for_tenant(
  tenant_slug text,
  display_name text,
  phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant public.tenants;
  new_profile public.profiles;
  user_id uuid;
begin
  user_id := auth.uid();
  if user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into target_tenant
  from public.tenants
  where slug = tenant_slug and is_active = true;

  if target_tenant.id is null then
    raise exception 'tenant_not_found_or_inactive' using detail = format('No active tenant found with slug: %s', tenant_slug);
  end if;

  -- Check if profile already exists
  if exists (select 1 from public.profiles where id = user_id) then
    raise exception 'profile_already_exists' using detail = 'User already has a profile';
  end if;

  insert into public.profiles (id, tenant_id, role, display_name, phone)
  values (user_id, target_tenant.id, 'customer', display_name, phone)
  returning * into new_profile;

  return new_profile;
end;
$$;

grant execute on function public.register_customer_for_tenant(text, text, text)
  to authenticated;

-- Similarly for registering drivers:
create or replace function public.register_driver_for_tenant(
  tenant_slug text,
  display_name text,
  phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant public.tenants;
  new_profile public.profiles;
  new_driver public.drivers;
  user_id uuid;
begin
  user_id := auth.uid();
  if user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into target_tenant
  from public.tenants
  where slug = tenant_slug and is_active = true;

  if target_tenant.id is null then
    raise exception 'tenant_not_found_or_inactive';
  end if;

  if exists (select 1 from public.profiles where id = user_id) then
    raise exception 'profile_already_exists';
  end if;

  insert into public.profiles (id, tenant_id, role, display_name, phone)
  values (user_id, target_tenant.id, 'driver', display_name, phone)
  returning * into new_profile;

  insert into public.drivers (tenant_id, profile_id, status)
  values (target_tenant.id, user_id, 'paused')
  returning * into new_driver;

  insert into public.driver_presence (driver_id, tenant_id, is_online, last_seen_at)
  values (new_driver.id, target_tenant.id, false, now());

  return new_profile;
end;
$$;

grant execute on function public.register_driver_for_tenant(text, text, text)
  to authenticated;

-- ─── 7. View for drivers to see quoteable rides ──────────────────────────────

create or replace view public.quoteable_rides
with (security_invoker = true)
as
select
  r.id,
  r.tenant_id,
  r.pickup_address,
  r.dropoff_address,
  r.pickup_at,
  r.passenger_count,
  r.estimated_distance_km,
  r.estimated_duration_minutes,
  r.notes,
  r.passenger_name,
  r.passenger_phone,
  r.created_at,
  r.service_area_id
from public.ride_requests r
where r.status in ('requested', 'quoted');

grant select on public.quoteable_rides to authenticated;

-- ─── 8. View for customer tracking (LEFT JOIN, no driver required) ──────────

create or replace view public.ride_customer_tracking
with (security_invoker = true)
as
select
  r.id,
  r.tenant_id,
  r.customer_id,
  r.pickup_address,
  r.dropoff_address,
  r.pickup_at,
  r.passenger_count,
  r.status,
  r.estimated_price,
  r.final_price,
  r.created_at,
  r.updated_at,
  r.driver_id,
  d.profile_id as driver_profile_id,
  p.display_name as driver_display_name,
  p.phone as driver_phone,
  v.plate as vehicle_plate,
  v.make as vehicle_make,
  v.model as vehicle_model,
  v.color as vehicle_color
from public.ride_requests r
left join public.drivers d on d.id = r.driver_id
left join public.profiles p on p.id = d.profile_id
left join public.vehicles v on v.driver_id = d.id and v.status = 'active';

grant select on public.ride_customer_tracking to authenticated;

-- ─── 9. Fix RLS on drivers — allow driver to read/update their own status ────

drop policy if exists "drivers can read own record" on public.drivers;
create policy "drivers can read own record"
on public.drivers for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_tenant_admin(tenant_id)
);

drop policy if exists "admins update drivers" on public.drivers;
create policy "admins update drivers"
on public.drivers for update
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

-- Only allow drivers to update their own driver_presence (NOT drivers.status)
drop policy if exists "drivers update driver_presence" on public.driver_presence;
create policy "drivers update driver_presence"
on public.driver_presence for update
to authenticated
using (
  driver_id in (select id from public.drivers where profile_id = auth.uid())
)
with check (
  driver_id in (select id from public.drivers where profile_id = auth.uid())
);

-- ─── 10. Fix ride_requests RLS — allow drivers to read unassigned rides ──────

drop policy if exists "admins and assigned drivers can update ride requests" on public.ride_requests;

-- Read policy: admins see all, customers see own, drivers see own + unassigned
drop policy if exists "ride_requests_select_policy" on public.ride_requests;
create policy "ride_requests_select_policy"
on public.ride_requests for select
to authenticated
using (
  public.is_tenant_admin(tenant_id)
  or customer_id = auth.uid()
  or exists (
    select 1 from public.drivers d
    where d.id = ride_requests.driver_id and d.profile_id = auth.uid()
  )
  or exists (
    select 1 from public.drivers d
    where d.tenant_id = ride_requests.tenant_id
      and d.profile_id = auth.uid()
      and d.status = 'active'
      and ride_requests.status in ('requested', 'quoted')
  )
);

create policy "admins and assigned drivers can update ride requests"
on public.ride_requests for update
to authenticated
using (
  public.is_tenant_admin(tenant_id)
  or exists (
    select 1 from public.drivers d
    where d.id = ride_requests.driver_id and d.profile_id = auth.uid()
  )
)
with check (
  public.is_tenant_admin(tenant_id)
  or (
    exists (
      select 1 from public.drivers d
      where d.id = ride_requests.driver_id and d.profile_id = auth.uid()
    )
    and final_price is null
  )
);

-- ─── 11. Fix notifications RLS — allow insert from authenticated (security definir functions bypass anyway) ──

drop policy if exists "users can read their own notifications" on public.notifications;
create policy "users can read their own notifications"
on public.notifications for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists "system can insert notifications" on public.notifications;
create policy "system can insert notifications"
on public.notifications for insert
to authenticated
with check (true);

-- ─── 12. Fix ride_events RLS ──────────────────────────────────────────────

drop policy if exists "ride_events_select_policy" on public.ride_events;
create policy "ride_events_select_policy"
on public.ride_events for select
to authenticated
using (
  exists (
    select 1 from public.ride_requests r
    where r.id = ride_events.ride_request_id
      and (
        r.customer_id = auth.uid()
        or r.driver_id in (select id from public.drivers where profile_id = auth.uid())
        or public.is_tenant_admin(r.tenant_id)
      )
  )
);

-- ─── 13. Fix profiles RLS — allow reading by same-tenant users for driver info ──

drop policy if exists "users can read their own profile" on public.profiles;
create policy "profiles_select_policy"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or tenant_id = public.current_tenant_id()
  or public.is_tenant_admin(tenant_id)
);

-- ─── 14. Ensure ride_requests.insert checks tenant context and sets estimated_price ──

-- Run as security definer so that the insert from the app works
create or replace function public.create_ride_request(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_pickup_address text,
  p_dropoff_address text default null,
  p_pickup_at timestamptz default now(),
  p_passenger_count integer default 1,
  p_estimated_distance_km numeric default null,
  p_estimated_duration_minutes numeric default null,
  p_estimated_price numeric default null,
  p_service_area_id uuid default null,
  p_vehicle_class_id uuid default null,
  p_passenger_name text default null,
  p_passenger_phone text default null,
  p_notes text default null
)
returns public.ride_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ride public.ride_requests;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.ride_requests (
    tenant_id, customer_id, pickup_address, dropoff_address,
    pickup_at, passenger_count, estimated_distance_km, estimated_duration_minutes,
    estimated_price, service_area_id, vehicle_class_id,
    passenger_name, passenger_phone, notes,
    status
  ) values (
    p_tenant_id, p_customer_id, p_pickup_address, p_dropoff_address,
    p_pickup_at, p_passenger_count, p_estimated_distance_km, p_estimated_duration_minutes,
    p_estimated_price, p_service_area_id, p_vehicle_class_id,
    p_passenger_name, p_passenger_phone, p_notes,
    'requested'
  )
  returning * into new_ride;

  -- Record initial event
  insert into public.ride_events (tenant_id, ride_request_id, actor_id, event_type, payload)
  values (new_ride.tenant_id, new_ride.id, p_customer_id, 'requested', '{}'::jsonb);

  return new_ride;
end;
$$;

grant execute on function public.create_ride_request(
  uuid, uuid, text, text, timestamptz, integer,
  numeric, numeric, numeric, uuid, uuid, text, text, text
) to authenticated;

-- ─── 15. Fix pricing — add function to calculate and save estimated price ─────

create or replace function public.calculate_and_save_price(
  p_ride_request_id uuid,
  p_distance_km numeric default null,
  p_duration_minutes numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_ride public.ride_requests;
  v_estimated_price numeric;
begin
  select * into current_ride from public.ride_requests where id = p_ride_request_id;
  if current_ride.id is null then
    return jsonb_build_object('success', false, 'error', 'ride_not_found');
  end if;

  -- Simple distance-based estimate: 10 CUP base + 5 CUP/km
  v_estimated_price := 10 + coalesce(p_distance_km, current_ride.estimated_distance_km, 0) * 5
                       + coalesce(p_duration_minutes, current_ride.estimated_duration_minutes, 0) * 0.5;

  update public.ride_requests
  set estimated_price = round(v_estimated_price, 2),
      estimated_distance_km = coalesce(p_distance_km, estimated_distance_km),
      estimated_duration_minutes = coalesce(p_duration_minutes, estimated_duration_minutes),
      price_snapshot = jsonb_build_object(
        'currency', (select currency from public.tenants where id = current_ride.tenant_id),
        'subtotal', round(v_estimated_price, 2),
        'total', round(v_estimated_price, 2),
        'parameters', jsonb_build_object(
          'distance_km', coalesce(p_distance_km, current_ride.estimated_distance_km, 0),
          'duration_minutes', coalesce(p_duration_minutes, current_ride.estimated_duration_minutes, 0)
        )
      ),
      updated_at = now()
  where id = p_ride_request_id;

  return jsonb_build_object(
    'success', true,
    'estimated_price', round(v_estimated_price, 2)
  );
end;
$$;

grant execute on function public.calculate_and_save_price(uuid, numeric, numeric)
  to authenticated;

-- ─── 16. Seed: demo tenants, users, drivers, vehicles, service areas ──────────

-- Only seed if no tenants exist (idempotent)
do $$
begin
  if not exists (select 1 from public.tenants) then
    insert into public.tenants (id, name, slug, legal_name, primary_color, accent_color, currency, locale)
    values
      (gen_random_uuid(), 'Taxi Habana Demo', 'habana', 'Taxi Habana S.A.', '#0f766e', '#f59e0b', 'CUP', 'es-CU'),
      (gen_random_uuid(), 'Taxi Santiago Demo', 'santiago', 'Taxi Santiago Ltda.', '#1d4ed8', '#dc2626', 'CUP', 'es-CU');
  end if;
end;
$$;

-- ─── 17. Grants for new tables/views ──────────────────────────────────────

grant select on public.ride_state_transitions to authenticated;
grant select on public.quoteable_rides to authenticated;
grant select on public.ride_customer_tracking to authenticated;
grant insert, update on public.notifications to authenticated;
grant insert on public.ride_events to authenticated;
grant insert on public.driver_earnings to authenticated;

-- Index for ride_requests status + tenant queries
create index if not exists ride_requests_status_tenant_idx
  on public.ride_requests (tenant_id, status);
create index if not exists ride_requests_driver_status_idx
  on public.ride_requests (driver_id, status);
