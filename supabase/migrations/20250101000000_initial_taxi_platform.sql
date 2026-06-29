create extension if not exists pgcrypto;

create type public.user_role as enum ('customer', 'driver', 'tenant_admin', 'platform_admin');
create type public.driver_status as enum ('pending', 'active', 'paused', 'blocked');
create type public.vehicle_status as enum ('active', 'maintenance', 'inactive');
create type public.ride_status as enum (
  'requested',
  'quoted',
  'confirmed',
  'driver_assigned',
  'arriving',
  'in_progress',
  'completed',
  'cancelled'
);
create type public.payment_status as enum ('pending', 'authorized', 'paid', 'failed', 'refunded');
create type public.tariff_rule_kind as enum ('base', 'distance', 'time', 'zone', 'surge', 'minimum');
create type public.notification_channel as enum ('in_app', 'push', 'sms', 'whatsapp', 'email');
create type public.notification_status as enum ('queued', 'sent', 'read', 'failed');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  legal_name text,
  logo_url text,
  support_phone text,
  support_whatsapp text,
  primary_color text not null default '#0f766e',
  accent_color text not null default '#f59e0b',
  currency text not null default 'CUP',
  locale text not null default 'es-CU',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  role public.user_role not null,
  display_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status public.driver_status not null default 'pending',
  license_number text,
  rating numeric(3, 2) not null default 0,
  completed_rides integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_id)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  driver_id uuid references public.drivers(id) on delete set null,
  plate text not null,
  make text,
  model text,
  color text,
  seats integer not null default 4 check (seats > 0),
  status public.vehicle_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, plate)
);

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  city text,
  province text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tenant_feature_flags (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  realtime_tracking boolean not null default true,
  driver_quotes boolean not null default true,
  scheduled_bookings boolean not null default true,
  promo_codes boolean not null default false,
  whatsapp_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.vehicle_classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  seats integer not null default 4 check (seats > 0),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.tariff_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_area_id uuid references public.service_areas(id) on delete cascade,
  vehicle_class_id uuid references public.vehicle_classes(id) on delete cascade,
  kind public.tariff_rule_kind not null,
  label text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'CUP',
  priority integer not null default 100,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  driver_id uuid references public.drivers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  service_area_id uuid references public.service_areas(id) on delete set null,
  vehicle_class_id uuid references public.vehicle_classes(id) on delete set null,
  pickup_address text not null,
  dropoff_address text,
  pickup_lat numeric(10, 7),
  pickup_lng numeric(10, 7),
  dropoff_lat numeric(10, 7),
  dropoff_lng numeric(10, 7),
  pickup_at timestamptz not null,
  passenger_count integer not null default 1 check (passenger_count > 0),
  estimated_distance_km numeric(8, 2),
  estimated_duration_minutes integer,
  notes text,
  status public.ride_status not null default 'requested',
  estimated_price numeric(12, 2),
  final_price numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ride_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.ride_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  price numeric(12, 2) not null check (price >= 0),
  currency text not null default 'CUP',
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (ride_request_id, driver_id)
);

create table public.ride_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  ride_request_id uuid not null references public.ride_requests(id) on delete restrict,
  status public.payment_status not null default 'pending',
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'CUP',
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  driver_id uuid references public.drivers(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (ride_request_id, reviewer_id)
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null,
  token text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (profile_id, token)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  ride_request_id uuid references public.ride_requests(id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  status public.notification_status not null default 'queued',
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create view public.tenant_public_config
with (security_invoker = true)
as
select
  t.id as tenant_id,
  t.name,
  t.slug,
  t.logo_url,
  t.primary_color,
  t.accent_color,
  t.currency,
  t.locale,
  t.support_phone,
  t.support_whatsapp,
  t.is_active,
  coalesce(to_jsonb(f) - 'tenant_id' - 'updated_at', '{}'::jsonb) as feature_flags
from public.tenants t
left join public.tenant_feature_flags f on f.tenant_id = t.id;

create view public.tenant_operations_summary
with (security_invoker = true)
as
select
  t.id as tenant_id,
  count(r.id) filter (where r.status in ('requested', 'quoted', 'confirmed'))::integer as pending_rides,
  count(r.id) filter (where r.status in ('driver_assigned', 'arriving', 'in_progress'))::integer as active_rides,
  count(r.id) filter (where r.status = 'completed' and r.updated_at::date = current_date)::integer as completed_today,
  count(distinct d.id) filter (where d.status = 'active')::integer as available_drivers,
  coalesce(sum(r.final_price) filter (where r.status = 'completed' and r.updated_at::date = current_date), 0)::numeric(12, 2) as revenue_today
from public.tenants t
left join public.ride_requests r on r.tenant_id = t.id
left join public.drivers d on d.tenant_id = t.id
group by t.id;

create index profiles_tenant_role_idx on public.profiles (tenant_id, role);
create index drivers_tenant_status_idx on public.drivers (tenant_id, status);
create index vehicles_tenant_driver_idx on public.vehicles (tenant_id, driver_id);
create index vehicle_classes_tenant_active_idx on public.vehicle_classes (tenant_id, is_active, sort_order);
create index tariff_rules_tenant_active_idx on public.tariff_rules (tenant_id, is_active, priority);
create index ride_requests_tenant_status_pickup_idx on public.ride_requests (tenant_id, status, pickup_at);
create index ride_requests_customer_idx on public.ride_requests (customer_id, created_at desc);
create index ride_requests_driver_idx on public.ride_requests (driver_id, pickup_at desc);
create index ride_assignments_ride_idx on public.ride_assignments (ride_request_id, created_at desc);
create index ride_events_ride_idx on public.ride_events (ride_request_id, created_at desc);
create index notifications_recipient_status_idx on public.notifications (recipient_id, status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger drivers_set_updated_at
before update on public.drivers
for each row execute function public.set_updated_at();

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

create trigger ride_requests_set_updated_at
before update on public.ride_requests
for each row execute function public.set_updated_at();

create trigger tenant_feature_flags_set_updated_at
before update on public.tenant_feature_flags
for each row execute function public.set_updated_at();

create trigger vehicle_classes_set_updated_at
before update on public.vehicle_classes
for each row execute function public.set_updated_at();

create trigger tariff_rules_set_updated_at
before update on public.tariff_rules
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'customer')
$$;

create or replace function public.jwt_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

create or replace function public.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select public.jwt_role() in ('tenant_admin', 'platform_admin')
    and (public.jwt_role() = 'platform_admin' or public.jwt_tenant_id() = target_tenant_id)
$$;

create or replace function public.estimate_ride_price(
  target_tenant_id uuid,
  target_service_area_id uuid,
  target_vehicle_class_id uuid,
  distance_km numeric,
  duration_minutes integer,
  pickup_at timestamptz
)
returns jsonb
language sql
stable
as $$
  with applicable as (
    select *
    from public.tariff_rules tr
    where tr.tenant_id = target_tenant_id
      and tr.is_active = true
      and (tr.service_area_id is null or tr.service_area_id = target_service_area_id)
      and (tr.vehicle_class_id is null or tr.vehicle_class_id = target_vehicle_class_id)
      and (tr.starts_at is null or tr.starts_at <= pickup_at)
      and (tr.ends_at is null or tr.ends_at >= pickup_at)
  ),
  calculated as (
    select
      label,
      kind,
      currency,
      case
        when kind = 'distance' then amount * greatest(distance_km, 0)
        when kind = 'time' then amount * greatest(duration_minutes, 0)
        else amount
      end as line_amount
    from applicable
    where kind <> 'minimum'
  ),
  totals as (
    select
      coalesce(max(currency), (select currency from public.tenants where id = target_tenant_id), 'CUP') as currency,
      coalesce(sum(line_amount), 0) as subtotal,
      coalesce((select max(amount) from applicable where kind = 'minimum'), 0) as minimum_amount
    from calculated
  )
  select jsonb_build_object(
    'currency', currency,
    'subtotal', greatest(subtotal, minimum_amount),
    'minimumApplied', minimum_amount > subtotal,
    'breakdown', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'amount', line_amount)) from calculated), '[]'::jsonb)
  )
  from totals
$$;

create or replace function public.assign_driver_to_ride(
  target_tenant_id uuid,
  target_ride_request_id uuid,
  target_driver_id uuid,
  target_vehicle_id uuid,
  actor_profile_id uuid
)
returns public.ride_requests
language plpgsql
as $$
declare
  updated_ride public.ride_requests;
begin
  if not public.is_tenant_admin(target_tenant_id) then
    raise exception 'not allowed';
  end if;

  update public.ride_requests
  set
    driver_id = target_driver_id,
    vehicle_id = target_vehicle_id,
    status = 'driver_assigned'
  where id = target_ride_request_id
    and tenant_id = target_tenant_id
  returning * into updated_ride;

  if updated_ride.id is null then
    raise exception 'ride request not found';
  end if;

  insert into public.ride_assignments (
    tenant_id,
    ride_request_id,
    driver_id,
    vehicle_id,
    assigned_by
  ) values (
    target_tenant_id,
    target_ride_request_id,
    target_driver_id,
    target_vehicle_id,
    actor_profile_id
  );

  insert into public.ride_events (
    tenant_id,
    ride_request_id,
    actor_id,
    event_type,
    payload
  ) values (
    target_tenant_id,
    target_ride_request_id,
    actor_profile_id,
    'driver_assigned',
    jsonb_build_object('driver_id', target_driver_id, 'vehicle_id', target_vehicle_id)
  );

  return updated_ride;
end;
$$;

create or replace function public.confirm_ride_quote(target_quote_id uuid)
returns public.ride_requests
language plpgsql
as $$
declare
  selected_quote public.ride_quotes;
  updated_ride public.ride_requests;
begin
  select * into selected_quote
  from public.ride_quotes
  where id = target_quote_id;

  if selected_quote.id is null then
    raise exception 'quote not found';
  end if;

  update public.ride_requests
  set
    driver_id = selected_quote.driver_id,
    status = 'confirmed',
    final_price = selected_quote.price
  where id = selected_quote.ride_request_id
    and customer_id = auth.uid()
  returning * into updated_ride;

  if updated_ride.id is null then
    raise exception 'ride request not found';
  end if;

  update public.ride_quotes
  set accepted_at = now()
  where id = target_quote_id;

  return updated_ride;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.tenants to anon, authenticated;
grant insert, update, delete on public.tenants to authenticated;
grant select on public.tenant_public_config to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.service_areas to anon, authenticated;
grant insert, update, delete on public.service_areas to authenticated;
grant select, insert, update, delete on public.drivers, public.vehicles to authenticated;
grant select, insert, update, delete on public.tenant_feature_flags, public.vehicle_classes, public.tariff_rules to authenticated;
grant select on public.vehicle_classes, public.tariff_rules to anon;
grant select, insert, update, delete on public.ride_requests, public.ride_quotes, public.ride_assignments, public.ride_events, public.payments, public.reviews to authenticated;
grant select on public.tenant_operations_summary to authenticated;
grant select, insert, update, delete on public.device_tokens, public.notifications to authenticated;
grant select, insert on public.admin_audit_log to authenticated;
grant all privileges on all tables in schema public to service_role;
grant execute on function public.estimate_ride_price(uuid, uuid, uuid, numeric, integer, timestamptz) to anon, authenticated;
grant execute on function public.assign_driver_to_ride(uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.confirm_ride_quote(uuid) to authenticated;
grant usage on type public.user_role, public.driver_status, public.vehicle_status, public.ride_status, public.payment_status, public.tariff_rule_kind, public.notification_channel, public.notification_status to anon, authenticated, service_role;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.service_areas enable row level security;
alter table public.tenant_feature_flags enable row level security;
alter table public.vehicle_classes enable row level security;
alter table public.tariff_rules enable row level security;
alter table public.ride_requests enable row level security;
alter table public.ride_quotes enable row level security;
alter table public.ride_assignments enable row level security;
alter table public.ride_events enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.device_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "public can read active tenants"
on public.tenants for select
to anon, authenticated
using (is_active = true);

create policy "platform admins can manage tenants"
on public.tenants for all
to authenticated
using (public.jwt_role() = 'platform_admin')
with check (public.jwt_role() = 'platform_admin');

create policy "users can read their own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_tenant_admin(tenant_id));

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

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

create policy "admins can manage profiles in tenant"
on public.profiles for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "authenticated can read active service areas"
on public.service_areas for select
to anon, authenticated
using (is_active = true);

create policy "admins can manage service areas"
on public.service_areas for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "public can read vehicle classes"
on public.vehicle_classes for select
to anon, authenticated
using (is_active = true);

create policy "admins can manage vehicle classes"
on public.vehicle_classes for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "public can read active tariff rules"
on public.tariff_rules for select
to anon, authenticated
using (is_active = true);

create policy "admins can manage tariff rules"
on public.tariff_rules for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "admins can manage feature flags"
on public.tenant_feature_flags for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "public can read feature flags"
on public.tenant_feature_flags for select
to anon, authenticated
using (
  exists (
    select 1 from public.tenants t
    where t.id = tenant_feature_flags.tenant_id and t.is_active = true
  )
);

create policy "drivers can read their driver record"
on public.drivers for select
to authenticated
using (profile_id = auth.uid() or public.is_tenant_admin(tenant_id));

create policy "admins can manage drivers"
on public.drivers for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "tenant users can read vehicles"
on public.vehicles for select
to authenticated
using (tenant_id = public.jwt_tenant_id() or public.is_tenant_admin(tenant_id));

create policy "admins can manage vehicles"
on public.vehicles for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "customers can create ride requests"
on public.ride_requests for insert
to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.tenant_id = ride_requests.tenant_id
      and p.role = 'customer'
  )
);

create policy "ride participants can read ride requests"
on public.ride_requests for select
to authenticated
using (
  customer_id = auth.uid()
  or public.is_tenant_admin(tenant_id)
  or exists (
    select 1 from public.drivers d
    where d.id = ride_requests.driver_id and d.profile_id = auth.uid()
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
  or exists (
    select 1 from public.drivers d
    where d.id = ride_requests.driver_id and d.profile_id = auth.uid()
  )
);

create policy "customers can confirm their ride requests"
on public.ride_requests for update
to authenticated
using (customer_id = auth.uid() and status in ('requested', 'quoted'))
with check (customer_id = auth.uid() and status in ('confirmed', 'cancelled'));

create policy "drivers can create quotes"
on public.ride_quotes for insert
to authenticated
with check (
  exists (
    select 1 from public.drivers d
    where d.id = ride_quotes.driver_id
      and d.profile_id = auth.uid()
      and d.tenant_id = ride_quotes.tenant_id
      and d.status = 'active'
  )
  and exists (
    select 1 from public.ride_requests r
    where r.id = ride_quotes.ride_request_id
      and r.tenant_id = ride_quotes.tenant_id
  )
);

create policy "ride participants can read quotes"
on public.ride_quotes for select
to authenticated
using (
  public.is_tenant_admin(tenant_id)
  or exists (
    select 1 from public.ride_requests r
    where r.id = ride_quotes.ride_request_id
      and r.customer_id = auth.uid()
  )
  or exists (
    select 1 from public.drivers d
    where d.id = ride_quotes.driver_id and d.profile_id = auth.uid()
  )
);

create policy "customers can accept quotes for their rides"
on public.ride_quotes for update
to authenticated
using (
  exists (
    select 1 from public.ride_requests r
    where r.id = ride_quotes.ride_request_id
      and r.customer_id = auth.uid()
      and r.status in ('requested', 'quoted')
  )
)
with check (
  exists (
    select 1 from public.ride_requests r
    where r.id = ride_quotes.ride_request_id
      and r.customer_id = auth.uid()
  )
);

create policy "admins and assigned drivers can read assignments"
on public.ride_assignments for select
to authenticated
using (
  public.is_tenant_admin(tenant_id)
  or exists (
    select 1 from public.drivers d
    where d.id = ride_assignments.driver_id and d.profile_id = auth.uid()
  )
);

create policy "admins can manage assignments"
on public.ride_assignments for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "ride participants can read events"
on public.ride_events for select
to authenticated
using (
  public.is_tenant_admin(tenant_id)
  or exists (
    select 1 from public.ride_requests r
    where r.id = ride_events.ride_request_id
      and (
        r.customer_id = auth.uid()
        or exists (
          select 1 from public.drivers d
          where d.id = r.driver_id and d.profile_id = auth.uid()
        )
      )
  )
);

create policy "ride participants can create events"
on public.ride_events for insert
to authenticated
with check (
  public.is_tenant_admin(tenant_id)
  or (
    actor_id = auth.uid()
    and exists (
      select 1 from public.ride_requests r
      where r.id = ride_events.ride_request_id
        and r.tenant_id = ride_events.tenant_id
        and (
          r.customer_id = auth.uid()
          or exists (
            select 1 from public.drivers d
            where d.id = r.driver_id and d.profile_id = auth.uid()
          )
        )
    )
  )
);

create policy "ride participants can read payments"
on public.payments for select
to authenticated
using (
  public.is_tenant_admin(tenant_id)
  or exists (
    select 1 from public.ride_requests r
    where r.id = payments.ride_request_id and r.customer_id = auth.uid()
  )
);

create policy "admins can manage payments"
on public.payments for all
to authenticated
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "customers can create reviews"
on public.reviews for insert
to authenticated
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1 from public.ride_requests r
    where r.id = reviews.ride_request_id
      and r.tenant_id = reviews.tenant_id
      and r.customer_id = auth.uid()
      and r.status = 'completed'
  )
);

create policy "tenant users can read reviews"
on public.reviews for select
to authenticated
using (tenant_id = public.jwt_tenant_id() or public.is_tenant_admin(tenant_id));

create policy "users can manage their device tokens"
on public.device_tokens for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "users can read their notifications"
on public.notifications for select
to authenticated
using (recipient_id = auth.uid() or public.is_tenant_admin(tenant_id));

create policy "users can mark their notifications read"
on public.notifications for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy "admins can create notifications"
on public.notifications for insert
to authenticated
with check (public.is_tenant_admin(tenant_id));

create policy "admins can write audit log"
on public.admin_audit_log for insert
to authenticated
with check (public.is_tenant_admin(tenant_id));

create policy "admins can read audit log"
on public.admin_audit_log for select
to authenticated
using (public.is_tenant_admin(tenant_id));
