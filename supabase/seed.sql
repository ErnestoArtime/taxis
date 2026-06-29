-- Seed demo para la plataforma de taxis
-- UUIDs fijos para facilitar pruebas

-- Tenant demo
INSERT INTO public.tenants (id, name, slug, legal_name, support_phone, support_whatsapp, primary_color, accent_color, currency, locale, is_active)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Habana Taxi',
  'habana-taxi',
  'Habana Taxi S.A.',
  '+53 5555 5555',
  '+53 5555 5555',
  '#0f766e',
  '#f59e0b',
  'CUP',
  'es-CU',
  true
) ON CONFLICT (slug) DO NOTHING;

-- Feature flags
INSERT INTO public.tenant_feature_flags (tenant_id, realtime_tracking, driver_quotes, scheduled_bookings, promo_codes, whatsapp_notifications)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  true,
  true,
  true,
  false,
  true
) ON CONFLICT (tenant_id) DO NOTHING;

-- Zonas de servicio
INSERT INTO public.service_areas (id, tenant_id, name, city, province, is_active)
VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Habana Centro', 'La Habana', 'La Habana', true),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Aeropuerto Jose Marti', 'La Habana', 'La Habana', true),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Playas del Este', 'La Habana', 'La Habana', true)
ON CONFLICT DO NOTHING;

-- Clases de vehiculo
INSERT INTO public.vehicle_classes (id, tenant_id, name, description, seats, sort_order, is_active)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Estandar', 'Vehiculo economy', 4, 100, true),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Confort', 'Vehiculo comfort', 4, 200, true),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Van', 'Van familiar', 7, 300, true)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Tarifas base
INSERT INTO public.tariff_rules (id, tenant_id, service_area_id, vehicle_class_id, kind, label, amount, currency, priority, is_active)
VALUES
  -- Base para todas las zonas
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'base', 'Tarifa base', 600, 'CUP', 10, true),
  -- Por kilometro
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'distance', 'Por kilometro', 80, 'CUP', 20, true),
  -- Minimo
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'minimum', 'Tarifa minima', 500, 'CUP', 100, true),
  -- Nocturno (sobre precio)
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'surge', 'Recargo nocturno', 200, 'CUP', 5, true)
ON CONFLICT DO NOTHING;
