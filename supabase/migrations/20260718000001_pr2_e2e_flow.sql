-- =============================================================================
-- Migration: PR2 — E2E functional flow
-- Description: Auto-assign trigger, operations summary view, geolocation
--              support for ride creation
-- =============================================================================

-- ─── 1. Auto-assign trigger function ─────────────────────────────────────────
-- When a ride is created with pickup_lat/pickup_lng, try to auto-assign
-- the nearest available driver.

create or replace function public.try_auto_assign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nearest record;
begin
  if new.pickup_lat is not null and new.pickup_lng is not null then
    select * into nearest
    from public.find_nearby_drivers(
      new.tenant_id,
      new.pickup_lat,
      new.pickup_lng,
      10
    )
    where not exists (
      select 1 from public.ride_requests r
      where r.driver_id = find_nearby_drivers.driver_id
        and r.status in ('driver_assigned', 'arriving', 'in_progress')
    )
    limit 1;

    if nearest.driver_id is not null then
      -- Assign the driver
      update public.ride_requests
      set
        driver_id = nearest.driver_id,
        status = 'driver_assigned',
        updated_at = now()
      where id = new.id;

      -- Record assignment
      insert into public.ride_assignments (tenant_id, ride_request_id, driver_id, assigned_by, notes)
      values (new.tenant_id, new.id, nearest.driver_id, new.customer_id, 'auto-asignado por sistema');

      -- Record event
      insert into public.ride_events (tenant_id, ride_request_id, actor_id, event_type, payload)
      values (
        new.tenant_id, new.id, new.customer_id,
        'driver_assigned',
        jsonb_build_object('driver_id', nearest.driver_id, 'method', 'auto_trigger', 'distance_km', nearest.distance_km)
      );

      -- Notify driver
      insert into public.notifications (tenant_id, recipient_id, ride_request_id, channel, status, title, body, data)
      values (
        new.tenant_id, nearest.profile_id, new.id,
        'in_app', 'queued', 'Nuevo viaje asignado',
        format('Recogida: %s', new.pickup_address),
        jsonb_build_object('ride_request_id', new.id, 'event', 'driver_assigned')
      );

      -- Notify customer
      insert into public.notifications (tenant_id, recipient_id, ride_request_id, channel, status, title, body, data)
      values (
        new.tenant_id, new.customer_id, new.id,
        'in_app', 'queued', 'Chofer asignado',
        format('%s va hacia ti (%s km)', nearest.display_name, nearest.distance_km),
        jsonb_build_object('ride_request_id', new.id, 'event', 'driver_assigned')
      );
    end if;
  end if;
  return new;
end;
$$;

-- Apply trigger — fires after INSERT on ride_requests when coordinates present
drop trigger if exists trg_ride_auto_assign on public.ride_requests;
create trigger trg_ride_auto_assign
  after insert on public.ride_requests
  for each row
  when (new.pickup_lat is not null and new.pickup_lng is not null)
  execute function public.try_auto_assign();

-- ─── 2. Fix tenant_operations_summary view ──────────────────────────────────

create or replace view public.tenant_operations_summary
with (security_invoker = true)
as
select
  r.tenant_id,
  count(*) filter (where r.status = 'requested' or r.status = 'quoted')::integer as pending_rides,
  count(*) filter (where r.status in ('driver_assigned', 'arriving', 'in_progress'))::integer as active_rides,
  count(*) filter (where r.status = 'completed' and r.updated_at::date = current_date)::integer as completed_today,
  coalesce(
    (select count(*)::integer from public.driver_presence dp where dp.tenant_id = r.tenant_id and dp.is_online = true),
    0
  ) as available_drivers,
  coalesce(
    sum(r.final_price) filter (where r.status = 'completed' and r.updated_at::date = current_date),
    0
  )::numeric(12, 2) as revenue_today
from public.ride_requests r
group by r.tenant_id;

grant select on public.tenant_operations_summary to authenticated;

-- ─── 3. Add geolocation columns to ride_requests if missing ──────────────────

-- These should already exist from the initial migration, but ensure they do
alter table public.ride_requests
  add column if not exists pickup_lat numeric(10, 7),
  add column if not exists pickup_lng numeric(10, 7),
  add column if not exists dropoff_lat numeric(10, 7),
  add column if not exists dropoff_lng numeric(10, 7);

-- ─── 4. Index for geographic queries ─────────────────────────────────────────

create index if not exists ride_requests_pickup_coords_idx
  on public.ride_requests (tenant_id, pickup_lat, pickup_lng)
  where pickup_lat is not null;

-- ─── 5. Helper: list active drivers for admin dispatch ───────────────────────

create or replace view public.admin_available_drivers
with (security_invoker = true)
as
select
  d.id as driver_id,
  d.tenant_id,
  d.profile_id,
  p.display_name,
  p.phone,
  d.rating,
  d.completed_rides,
  d.license_number,
  coalesce(dp.is_online, false) as is_online,
  v.id as vehicle_id,
  v.plate as vehicle_plate,
  v.make as vehicle_make,
  v.model as vehicle_model,
  v.color as vehicle_color,
  v.seats as vehicle_seats
from public.drivers d
join public.profiles p on p.id = d.profile_id
left join public.driver_presence dp on dp.driver_id = d.id
left join public.vehicles v on v.driver_id = d.id and v.status = 'active'
where d.status = 'active';

grant select on public.admin_available_drivers to authenticated;

-- Grants
grant insert on public.ride_assignments to authenticated;
grant insert on public.ride_events to authenticated;
grant insert on public.notifications to authenticated;
