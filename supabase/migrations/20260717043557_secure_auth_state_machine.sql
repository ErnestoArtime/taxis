-- =============================================================================
-- Migration: secure_auth_state_machine
-- Version: 2
-- Description: Secure profile creation, state machine for rides, new fields
-- =============================================================================

-- ─── Helper functions ─────────────────────────────────────────────────────────

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'customer')
$$;

-- ─── Cancellation reasons table ───────────────────────────────────────────────

create table if not exists public.cancellation_reasons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null,
  for_role public.user_role not null default 'customer',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (tenant_id, label)
);

-- ─── New columns on ride_requests ─────────────────────────────────────────────

alter table public.ride_requests
  add column if not exists passenger_name text,
  add column if not exists passenger_phone text,
  add column if not exists pickup_reference text,
  add column if not exists dropoff_reference text,
  add column if not exists internal_code text,
  add column if not exists channel text not null default 'app',
  add column if not exists luggage_count integer default 0,
  add column if not exists flight_number text,
  add column if not exists operator_notes text,
  add column if not exists price_snapshot jsonb default '{}'::jsonb,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_reason_id uuid references public.cancellation_reasons(id) on delete set null,
  add column if not exists cancellation_note text,
  add column if not exists cancellation_fee numeric(12, 2) default 0,
  add column if not exists cancelled_at timestamptz;

-- ─── Driver presence and location tables ──────────────────────────────────────

create table if not exists public.driver_presence (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  is_online boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  accuracy numeric(6, 2),
  heading numeric(5, 2),
  speed numeric(5, 2),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists driver_locations_driver_captured_idx
  on public.driver_locations (driver_id, captured_at desc);

-- ─── Driver earnings and settlements ──────────────────────────────────────────

create table if not exists public.driver_earnings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  ride_request_id uuid not null references public.ride_requests(id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'CUP',
  commission_amount numeric(12, 2) not null default 0,
  net_amount numeric(12, 2) not null check (net_amount >= 0),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.driver_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  gross_amount numeric(12, 2) not null default 0,
  commission_total numeric(12, 2) not null default 0,
  net_amount numeric(12, 2) not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ─── Tenant plans and subscriptions (SaaS preparation) ────────────────────────

create table if not exists public.tenant_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_monthly numeric(12, 2) not null default 0,
  currency text not null default 'CUP',
  max_drivers integer not null default 5,
  max_vehicles integer not null default 5,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.tenant_plans(id) on delete restrict,
  status text not null default 'active',
  current_period_start date not null,
  current_period_end date not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── State machine: transition_ride_state ─────────────────────────────────────

create or replace function public.transition_ride_state(
  target_ride_request_id uuid,
  new_status public.ride_status,
  actor_profile_id uuid default auth.uid(),
  event_payload jsonb default '{}'::jsonb
)
returns public.ride_requests
language plpgsql
as $$
declare
  current_ride public.ride_requests;
  current_actor public.profiles;
  actor_driver_id uuid;
  is_allowed boolean;
begin
  -- Lock and load the ride
  select * into current_ride
  from public.ride_requests
  where id = target_ride_request_id
  for update;

  if current_ride.id is null then
    raise exception 'ride_request_not_found' using detail = 'Ride request not found';
  end if;

  -- Load actor profile
  select * into current_actor
  from public.profiles
  where id = actor_profile_id;

  if current_actor.id is null then
    raise exception 'actor_not_found' using detail = 'Actor profile not found';
  end if;

  -- Load driver record if actor is a driver
  select id into actor_driver_id
  from public.drivers
  where profile_id = actor_profile_id and tenant_id = current_ride.tenant_id;

  -- Validate transition
  is_allowed := false;

  -- Admin can do any valid transition within their tenant
  if public.is_tenant_admin(current_ride.tenant_id) then
    is_allowed := true;
  end if;

  -- Customer transitions
  if current_actor.role = 'customer' and current_ride.customer_id = actor_profile_id then
    if new_status = 'cancelled' and current_ride.status in ('requested', 'quoted', 'confirmed') then
      is_allowed := true;
    end if;
    if new_status = 'confirmed' and current_ride.status in ('requested', 'quoted') then
      is_allowed := true;
    end if;
  end if;

  -- Driver transitions (must be assigned to the ride)
  if actor_driver_id is not null and current_ride.driver_id = actor_driver_id then
    if new_status = 'arriving' and current_ride.status = 'driver_assigned' then
      is_allowed := true;
    end if;
    if new_status = 'in_progress' and current_ride.status = 'arriving' then
      is_allowed := true;
    end if;
    if new_status = 'completed' and current_ride.status = 'in_progress' then
      is_allowed := true;
    end if;
  end if;

  if not is_allowed then
    raise exception 'transition_not_allowed'
      using detail = format('Cannot transition from %s to %s as role %s',
        current_ride.status, new_status, current_actor.role);
  end if;

  -- Idempotency: if already in target state, return successfully
  if current_ride.status = new_status then
    return current_ride;
  end if;

  -- Perform the transition
  update public.ride_requests
  set
    status = new_status,
    final_price = case
      when new_status = 'completed' and current_ride.final_price is null
        then current_ride.estimated_price
      else current_ride.final_price
    end,
    cancelled_by = case when new_status = 'cancelled' then actor_profile_id else cancelled_by end,
    cancelled_at = case when new_status = 'cancelled' then now() else cancelled_at end,
    updated_at = now()
  where id = target_ride_request_id
  returning * into current_ride;

  -- Record event
  insert into public.ride_events (
    tenant_id,
    ride_request_id,
    actor_id,
    event_type,
    payload
  ) values (
    current_ride.tenant_id,
    current_ride.id,
    actor_profile_id,
    new_status,
    event_payload || jsonb_build_object(
      'previous_status', current_ride.status,
      'actor_role', current_actor.role
    )
  );

  -- Create notification for the other party
  if current_actor.role = 'customer' and current_ride.driver_id is not null then
    -- Notify driver
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

  if current_actor.role in ('driver', 'tenant_admin') then
    -- Notify customer
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

  return current_ride;
end;
$$;

grant execute on function public.transition_ride_state(uuid, public.ride_status, uuid, jsonb)
  to authenticated;

-- ─── Improved RLS: prevent tenant_id/role tampering ──────────────────────────

-- Drop the too-permissive profile insert policy
drop policy if exists "customers can create their own profile" on public.profiles;

-- Re-create with enforced role = 'customer'
create policy "customers can create their own profile"
on public.profiles for insert
to authenticated
with check (
  id = auth.uid()
  and role = 'customer'
  and exists (
    select 1 from public.tenants t
    where t.id = profiles.tenant_id and t.is_active = true
  )
);

-- Prevent changing tenant_id or role on profile update
drop policy if exists "users can update their own profile" on public.profiles;

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and tenant_id = (select tenant_id from public.profiles where id = auth.uid())
  and role = (select role from public.profiles where id = auth.uid())
);

-- Prevent price tampering by driver on ride_requests
drop policy if exists "admins and assigned drivers can update ride requests" on public.ride_requests;

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

-- RLS for new tables
alter table public.cancellation_reasons enable row level security;
alter table public.driver_presence enable row level security;
alter table public.driver_locations enable row level security;
alter table public.driver_earnings enable row level security;
alter table public.driver_settlements enable row level security;
alter table public.tenant_plans enable row level security;
alter table public.tenant_subscriptions enable row level security;

-- Policies for new tables
create policy "tenant users can read cancellation reasons"
on public.cancellation_reasons for select
to authenticated
using (tenant_id = public.current_tenant_id() or public.is_tenant_admin(tenant_id));

create policy "admins can manage cancellation reasons"
on public.cancellation_reasons for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "drivers can read their own presence"
on public.driver_presence for select
to authenticated
using (
  driver_id in (select id from public.drivers where profile_id = auth.uid())
  or public.is_tenant_admin(tenant_id)
);

create policy "drivers can upsert their own presence"
on public.driver_presence for insert
to authenticated
with check (
  driver_id in (select id from public.drivers where profile_id = auth.uid())
);

create policy "drivers can update their own presence"
on public.driver_presence for update
to authenticated
using (
  driver_id in (select id from public.drivers where profile_id = auth.uid())
)
with check (
  driver_id in (select id from public.drivers where profile_id = auth.uid())
);

create policy "drivers can insert their own locations"
on public.driver_locations for insert
to authenticated
with check (
  driver_id in (select id from public.drivers where profile_id = auth.uid())
);

create policy "ride participants can read driver locations"
on public.driver_locations for select
to authenticated
using (
  public.is_tenant_admin(tenant_id)
  or driver_id in (select id from public.drivers where profile_id = auth.uid())
  or exists (
    select 1 from public.ride_requests r
    where r.driver_id = driver_locations.driver_id
      and (r.customer_id = auth.uid() or r.driver_id in (select id from public.drivers where profile_id = auth.uid()))
  )
);

create policy "admins can manage driver earnings"
on public.driver_earnings for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "drivers can read their own earnings"
on public.driver_earnings for select
to authenticated
using (
  driver_id in (select id from public.drivers where profile_id = auth.uid())
);

create policy "admins can manage driver settlements"
on public.driver_settlements for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "drivers can read their own settlements"
on public.driver_settlements for select
to authenticated
using (
  driver_id in (select id from public.drivers where profile_id = auth.uid())
);

create policy "public can read active plans"
on public.tenant_plans for select
to anon, authenticated
using (is_active = true);

create policy "admins can manage plans"
on public.tenant_plans for all
to authenticated
using (public.current_user_role() = 'platform_admin')
with check (public.current_user_role() = 'platform_admin');

create policy "admins can read their subscription"
on public.tenant_subscriptions for select
to authenticated
using (tenant_id = public.current_tenant_id() or public.current_user_role() = 'platform_admin');

create policy "platform admins can manage subscriptions"
on public.tenant_subscriptions for all
to authenticated
using (public.current_user_role() = 'platform_admin')
with check (public.current_user_role() = 'platform_admin');

-- Indexes for new tables
create index if not exists cancellation_reasons_tenant_idx on public.cancellation_reasons (tenant_id, sort_order);
create index if not exists driver_presence_tenant_online_idx on public.driver_presence (tenant_id, is_online);
create index if not exists driver_earnings_driver_idx on public.driver_earnings (driver_id, created_at desc);
create index if not exists driver_settlements_driver_idx on public.driver_settlements (driver_id, period_start desc);

-- Grants for new tables
grant usage on schema public to anon, authenticated;
grant select on public.cancellation_reasons to authenticated;
grant insert, update, delete on public.cancellation_reasons to authenticated;
grant select, insert, update on public.driver_presence to authenticated;
grant select, insert on public.driver_locations to authenticated;
grant select on public.driver_earnings to authenticated;
grant select on public.driver_settlements to authenticated;
grant select on public.tenant_plans to anon, authenticated;
grant select on public.tenant_subscriptions to authenticated;
grant insert, update, delete on public.tenant_plans to authenticated;
grant insert, update, delete on public.tenant_subscriptions to authenticated;
