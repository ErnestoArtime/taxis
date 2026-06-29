# Funcionalidades de Valor Agregado

## Implementado en esta fase

- Marca blanca por tenant: nombre, slug, colores, logo, soporte y feature flags.
- Tarifas configurables: reglas por zona, clase de vehiculo, distancia, tiempo, minimo y temporada.
- Dashboard administrativo: metricas operativas, viajes pendientes, ingresos y choferes activos.
- Despacho: base para asignar chofer/vehiculo y notificar al chofer.
- Reservas: flujo de cliente con estimado y seguimiento.
- Choferes: disponibilidad, solicitudes cercanas, detalle de viaje y estados operativos.
- Realtime: helpers para suscribirse a cambios de viaje y operaciones del tenant.
- Notificaciones: tablas, repositorio y estados para in-app, push, SMS, WhatsApp o email.

## Pendiente de conectar a datos reales

- Sustituir los datos mock de las paginas por repositorios de `@taxi/supabase`.
- Crear migraciones con Supabase CLI a partir de `supabase/schema/taxi_platform.sql`.
- Configurar Auth y `app_metadata` con `tenant_id` y `role`.
- Agregar Edge Functions para envio real de WhatsApp, push y acciones administrativas sensibles.
- Agregar mapas reales o proveedor local configurable.

## Prioridad recomendada

1. Autenticacion y perfiles por rol.
2. Crear tenant demo con tarifas y clases de vehiculo.
3. Conectar Customer App a reservas y estimados.
4. Conectar Admin App a despacho.
5. Activar realtime y notificaciones.
