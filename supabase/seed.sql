-- =============================================================================
-- Seed completo para la plataforma de taxis (PR2)
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- TENANT DEMO
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.tenants (id, name, slug, legal_name, support_phone, support_whatsapp, primary_color, accent_color, currency, locale, is_active)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Habana Taxi',
  'habana',
  'Habana Taxi S.A.',
  '+53 5555 5555',
  '+53 5555 5555',
  '#0f766e',
  '#f59e0b',
  'CUP',
  'es-CU',
  true
) ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- FEATURE FLAGS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.tenant_feature_flags (tenant_id, realtime_tracking, driver_quotes, scheduled_bookings, promo_codes, whatsapp_notifications)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true, true, true, false, true)
ON CONFLICT (tenant_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- ZONAS DE SERVICIO
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.service_areas (id, tenant_id, name, city, province, is_active)
VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Habana Centro', 'La Habana', 'La Habana', true),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Aeropuerto Jose Marti', 'La Habana', 'La Habana', true),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Playas del Este', 'La Habana', 'La Habana', true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- CLASES DE VEHICULO
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.vehicle_classes (id, tenant_id, name, description, seats, sort_order, is_active)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Estandar', 'Vehiculo economy', 4, 100, true),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Confort', 'Vehiculo comfort', 4, 200, true),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Van', 'Van familiar', 7, 300, true)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- TARIFAS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.tariff_rules (id, tenant_id, service_area_id, vehicle_class_id, kind, label, amount, currency, priority, is_active)
VALUES
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'base', 'Tarifa base', 600, 'CUP', 10, true),
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'distance', 'Por kilometro', 80, 'CUP', 20, true),
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'minimum', 'Tarifa minima', 500, 'CUP', 100, true),
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'surge', 'Recargo nocturno', 200, 'CUP', 5, true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- MOTIVOS DE CANCELACION
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.cancellation_reasons (id, tenant_id, label, for_role, sort_order)
VALUES
  ('e1eebc99-0001-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cambio de planes', 'customer', 10),
  ('e1eebc99-0002-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Encontre otro transporte', 'customer', 20),
  ('e1eebc99-0003-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Demora en la asignacion', 'customer', 30),
  ('e1eebc99-0004-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Vehiculo en mantenimiento', 'driver', 10),
  ('e1eebc99-0005-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cliente no localizado', 'driver', 20),
  ('e1eebc99-0006-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Duplicado', 'tenant_admin', 10),
  ('e1eebc99-0007-4ef8-bb6d-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Cliente no responde', 'tenant_admin', 20)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- USUARIOS Y PERFILES DEMO
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTA: auth.users debe crearse desde la UI de Supabase o usando signUp().
-- Primero registra los usuarios via la app, luego ejecuta este seed.
--
-- Credenciales sugeridas:
--   admin@habana.com / Admin123!  → tenant_admin
--   chofer@habana.com / Chofer123! → driver
--   cliente@habana.com / Cliente123! → customer
--
-- Despues de registrar los usuarios via signUp(), corre:
--   UPDATE public.profiles SET role = 'tenant_admin' WHERE email = 'admin@habana.com';
--   UPDATE public.profiles SET role = 'driver' WHERE email = 'chofer@habana.com';
-- Los profiles se crean con role='customer' por defecto (register_customer_for_tenant).
-- Para driver/admin, usa los UPDATEs manuales o register_driver_for_tenant.

-- ═══════════════════════════════════════════════════════════════════════════
-- CONDUCTORES Y VEHICULOS DEMO
-- ═══════════════════════════════════════════════════════════════════════════
-- Estos INSERTs deben ejecutarse DESPUES de crear los perfiles.
-- Reemplaza los profile_id con los UUID reales de auth.users.

-- Ejemplo (comentado — reemplazar con IDs reales):
-- INSERT INTO public.drivers (id, tenant_id, profile_id, status, license_number, rating, completed_rides)
-- VALUES
--   ('f1eebc99-0000-0000-0000-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '<uuid-chofer>', 'active', 'L-12345', 4.5, 50),
--   ('f1eebc99-0000-0000-0000-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '<uuid-chofer2>', 'active', 'L-67890', 4.2, 30);
--
-- INSERT INTO public.driver_presence (driver_id, tenant_id, is_online, last_seen_at)
-- VALUES
--   ('f1eebc99-0000-0000-0000-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true, now()),
--   ('f1eebc99-0000-0000-0000-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true, now());
--
-- INSERT INTO public.vehicles (id, tenant_id, driver_id, plate, make, model, color, seats, status)
-- VALUES
--   ('f2eebc99-0000-0000-0000-6bb9bd380001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f1eebc99-0000-0000-0000-6bb9bd380001', 'T-1234', 'Toyota', 'Corolla', 'Blanco', 4, 'active'),
--   ('f2eebc99-0000-0000-0000-6bb9bd380002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f1eebc99-0000-0000-0000-6bb9bd380002', 'T-5678', 'Hyundai', 'Elantra', 'Negro', 4, 'active');

-- ═══════════════════════════════════════════════════════════════════════════
-- VIAJE DE MUESTRA
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejemplo de ride_request de muestra (reemplazar con UUID real de customer):
-- INSERT INTO public.ride_requests (id, tenant_id, customer_id, pickup_address, dropoff_address, pickup_at, passenger_count, status, estimated_price, price_snapshot)
-- VALUES (
--   'f3eebc99-0000-0000-0000-6bb9bd380001',
--   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
--   '<uuid-cliente>',
--   'Calle 23 #456, Vedado, La Habana',
--   'Aeropuerto Jose Marti, La Habana',
--   now() + interval '2 hours',
--   2,
--   'requested',
--   700.00,
--   '{"currency": "CUP", "total": 700, "subtotal": 700}'
-- );

-- ═══════════════════════════════════════════════════════════════════════════
-- TRANSICIONES DE ESTADO (seed fijo, ejecutar siempre)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.ride_state_transitions (from_status, to_status, allowed_roles, require_cancellation_reason, description)
VALUES
  ('requested', 'quoted', '{driver}', false, 'Conductor envia cotizacion'),
  ('requested', 'confirmed', '{customer}', false, 'Cliente reserva directo sin cotizacion'),
  ('requested', 'cancelled', '{customer,tenant_admin,platform_admin}', true, 'Cliente o admin cancela antes de asignar'),
  ('quoted', 'confirmed', '{customer}', false, 'Cliente acepta cotizacion del conductor'),
  ('quoted', 'cancelled', '{customer,tenant_admin,platform_admin}', true, 'Cancelacion despues de cotizar'),
  ('confirmed', 'driver_assigned', '{tenant_admin,platform_admin}', false, 'Admin asigna conductor'),
  ('confirmed', 'cancelled', '{customer,tenant_admin,platform_admin}', true, 'Cancelacion despues de confirmar'),
  ('driver_assigned', 'arriving', '{driver}', false, 'Conductor va a la recogida'),
  ('driver_assigned', 'confirmed', '{tenant_admin,platform_admin}', false, 'Admin desasigna conductor'),
  ('driver_assigned', 'cancelled', '{driver,tenant_admin,platform_admin}', true, 'Conductor o admin cancela'),
  ('arriving', 'in_progress', '{driver}', false, 'Pasajero a bordo'),
  ('arriving', 'cancelled', '{driver,tenant_admin,platform_admin}', true, 'Cancelacion con conductor llegando'),
  ('in_progress', 'completed', '{driver}', false, 'Viaje completado'),
  ('in_progress', 'cancelled', '{tenant_admin,platform_admin}', true, 'Admin cancela viaje en curso')
ON CONFLICT (from_status, to_status) DO NOTHING;
