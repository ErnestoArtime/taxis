-- =============================================================================
-- Migration: proximity_dispatch_metrics
-- Version: 3
-- Description: Proximity dispatch, driver quotes flow, metrics views
-- =============================================================================

-- ─── Proximity: find nearby active drivers ──────────────────────────────────

create or replace function public.find_nearby_drivers(
  target_tenant_id uuid,
  ref_latitude numeric(10, 7),
  ref_longitude numeric(10, 7),
  radius_km numeric default 10
)
returns table (
  driver_id uuid,
  profile_id uuid,
  display_name text,
  phone text,
  vehicle_plate text,
  vehicle_make text,
  vehicle_model text,
  distance_km numeric,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  heading numeric(5, 2),
  rating numeric(3, 2)
)
language sql
stable
as $$
  select
    d.id as driver_id,
    d.profile_id,
    p.display_name,
    p.phone,
    v.plate as vehicle_plate,
    v.make as vehicle_make,
    v.model as vehicle_model,
    round(
      (6371 * acos(
        cos(radians(ref_latitude)) * cos(radians(dl.latitude)) *
        cos(radians(dl.longitude) - radians(ref_longitude)) +
        sin(radians(ref_latitude)) * sin(radians(dl.latitude))
      ))::numeric, 2
    ) as distance_km,
    dl.latitude,
    dl.longitude,
    dl.heading,
    d.rating
  from public.driver_locations dl
  join public.drivers d on d.id = dl.driver_id
  join public.profiles p on p.id = d.profile_id
  left join public.vehicles v on v.driver_id = d.id and v.status = 'active'
  where d.tenant_id = target_tenant_id
    and d.status = 'active'
    and dl.captured_at > now() - interval '5 minutes'
    and (6371 * acos(
      cos(radians(ref_latitude)) * cos(radians(dl.latitude)) *
      cos(radians(dl.longitude) - radians(ref_longitude)) +
      sin(radians(ref_latitude)) * sin(radians(dl.latitude))
    )) <= radius_km
  order by distance_km;
$$;

grant execute on function public.find_nearby_drivers(uuid, numeric, numeric, numeric)
  to authenticated;

-- ─── Auto-assign: find and assign nearest driver ───────────────────────────

create or replace function public.auto_assign_driver(
  target_ride_request_id uuid,
  actor_profile_id uuid default auth.uid()
)
returns jsonb
language plpgsql
as $$
declare
  current_ride public.ride_requests;
  nearest_driver record;
  assignment_result public.ride_requests;
begin
  -- Lock the ride
  select * into current_ride
  from public.ride_requests
  where id = target_ride_request_id
    and status = 'requested'
  for update;

  if current_ride.id is null then
    return jsonb_build_object('success', false, 'error', 'ride_not_found_or_not_available');
  end if;

  -- Find nearest driver
  select * into nearest_driver
  from public.find_nearby_drivers(
    current_ride.tenant_id,
    current_ride.pickup_lat,
    current_ride.pickup_lng,
    10
  )
  limit 1;

  if nearest_driver.driver_id is null then
    return jsonb_build_object('success', false, 'error', 'no_driver_available');
  end if;

  -- Assign the driver
  update public.ride_requests
  set
    driver_id = nearest_driver.driver_id,
    status = 'driver_assigned',
    updated_at = now()
  where id = target_ride_request_id
  returning * into assignment_result;

  -- Record assignment
  insert into public.ride_assignments (tenant_id, ride_request_id, driver_id, assigned_by, notes)
  values (current_ride.tenant_id, target_ride_request_id, nearest_driver.driver_id, actor_profile_id, 'auto-asignado por proximidad');

  -- Record event
  insert into public.ride_events (tenant_id, ride_request_id, actor_id, event_type, payload)
  values (
    current_ride.tenant_id, target_ride_request_id, actor_profile_id,
    'driver_assigned',
    jsonb_build_object('driver_id', nearest_driver.driver_id, 'method', 'auto', 'distance_km', nearest_driver.distance_km)
  );

  -- Notify driver
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

-- ─── Driver quote submissions ──────────────────────────────────────────────

create or replace function public.submit_driver_quote(
  target_ride_request_id uuid,
  quoted_price numeric(12, 2),
  driver_id uuid default null
)
returns public.ride_quotes
language plpgsql
as $$
declare
  current_ride public.ride_requests;
  driver_record public.drivers;
  new_quote public.ride_quotes;
begin
  -- Resolve driver from auth if not provided
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

  -- Load and validate ride
  select * into current_ride
  from public.ride_requests
  where id = target_ride_request_id
    and tenant_id = driver_record.tenant_id
    and status in ('requested', 'quoted');

  if current_ride.id is null then
    raise exception 'ride_not_available_for_quoting';
  end if;

  -- Insert or update quote
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

  -- Update ride status to quoted if it was requested
  if current_ride.status = 'requested' then
    update public.ride_requests set status = 'quoted' where id = target_ride_request_id;
  end if;

  -- Record event
  insert into public.ride_events (tenant_id, ride_request_id, actor_id, event_type, payload)
  values (
    driver_record.tenant_id, target_ride_request_id, auth.uid(),
    'quote_submitted',
    jsonb_build_object('driver_id', driver_record.id, 'price', quoted_price)
  );

  -- Notify customer
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

-- ─── Operational metrics view ──────────────────────────────────────────────

create or replace view public.tenant_daily_metrics
with (security_invoker = true)
as
select
  r.tenant_id,
  r.created_at::date as date,
  count(*)::integer as total_rides,
  count(*) filter (where r.status = 'completed')::integer as completed_rides,
  count(*) filter (where r.status = 'cancelled')::integer as cancelled_rides,
  coalesce(avg(r.final_price) filter (where r.status = 'completed'), 0)::numeric(12, 2) as avg_fare,
  coalesce(sum(r.final_price) filter (where r.status = 'completed'), 0)::numeric(12, 2) as revenue,
  count(distinct r.driver_id)::integer as active_drivers,
  coalesce(
    avg(
      extract(epoch from (r.updated_at - r.created_at)) / 60
    ) filter (where r.status = 'completed'),
    0
  )::numeric(8, 2) as avg_ride_duration_minutes
from public.ride_requests r
group by r.tenant_id, r.created_at::date;

grant select on public.tenant_daily_metrics to authenticated;

-- ─── Driver performance view ────────────────────────────────────────────────

create or replace view public.driver_performance
with (security_invoker = true)
as
select
  d.id as driver_id,
  d.tenant_id,
  p.display_name,
  d.rating,
  d.completed_rides,
  count(r.id) filter (where r.status = 'completed' and r.updated_at > now() - interval '7 days')::integer as rides_last_7_days,
  coalesce(sum(r.final_price) filter (where r.status = 'completed' and r.updated_at > now() - interval '7 days'), 0)::numeric(12, 2) as revenue_last_7_days,
  round(
    (count(r.id) filter (where r.status = 'completed')::numeric /
      nullif(count(r.id) filter (where r.status in ('completed', 'cancelled', 'driver_assigned')), 0)
    ) * 100, 1
  ) as completion_rate
from public.drivers d
left join public.profiles p on p.id = d.profile_id
left join public.ride_requests r on r.driver_id = d.id
group by d.id, p.display_name;

grant select on public.driver_performance to authenticated;

-- Index for driver_locations time-based queries
create index if not exists driver_locations_captured_at_idx
  on public.driver_locations (captured_at desc);
