# Handoff de Implementacion

## Contexto

Este repo contiene un monorepo Ionic Angular para una plataforma comercializable de taxis con tres apps:

- `apps/customer`: clientes que reservan taxis.
- `apps/driver`: choferes que reciben, cotizan y ejecutan servicios.
- `apps/admin`: administracion, despacho, marca blanca y tarifas.

La base esta pensada para Supabase, multi-tenant y marca blanca. El objetivo es vender/customizar el producto para diferentes gestores, agencias o negocios de transporte.

## Estado Actual

### Infraestructura creada

- Monorepo con `pnpm-workspace.yaml`, `angular.json`, `ionic.config.json` y `tsconfig.base.json`.
- Tres apps Ionic Angular standalone.
- Paquetes compartidos:
  - `packages/domain`: modelos de negocio.
  - `packages/supabase`: cliente, repositorios y realtime.
  - `packages/auth`: auth compartida, guards por rol y carga de perfil.
  - `packages/ui`: tokens visuales.
  - `packages/config`: configuracion por entorno y branding.
- SQL base en `supabase/schema/taxi_platform.sql`.
- Migracion inicial en `supabase/migrations/20250101000000_initial_taxi_platform.sql`.
- Seed demo inicial en `supabase/seed.sql`.
- Documentacion funcional en `docs/`.

### Funcionalidades ya modeladas

- Tenants y marca blanca.
- Feature flags por tenant.
- Perfiles por rol.
- Choferes y vehiculos.
- Zonas de servicio.
- Clases de vehiculo.
- Reglas de tarifa.
- Reservas.
- Cotizaciones.
- Asignaciones.
- Eventos de viaje.
- Pagos.
- Reviews.
- Notificaciones.
- Device tokens.
- Auditoria administrativa.
- Vistas:
  - `tenant_public_config`
  - `tenant_operations_summary`
- RPC:
  - `estimate_ride_price`
  - `assign_driver_to_ride`
  - `confirm_ride_quote`

### UI creada

- Cliente:
  - Home con rutas populares.
  - Nueva reserva con estimado visual.
  - Seguimiento de viaje.
- Chofer:
  - Dashboard con disponibilidad.
  - Solicitudes cercanas.
  - Detalle de viaje y estados.
- Admin:
  - Dashboard operativo.
  - Despacho.
  - Tarifas.
  - Configuracion de marca y feature flags.

### Verificacion actual

Estos comandos compilaron correctamente:

```bash
pnpm build:customer
pnpm build:driver
pnpm build:admin
```

Tambien se ejecuto:

```bash
npm audit --audit-level=high --omit=dev
```

Resultado: 0 vulnerabilidades de produccion.

## Como Continuar

### Regla general

No conectar pantallas directamente a tablas desde componentes. Usar o extender los repositorios en `packages/supabase/src/lib/repositories`.

Los componentes deben quedar ligeros:

- Estado de UI.
- Llamada a servicio/repositorio.
- Validacion visual.
- Navegacion.

La logica de negocio debe ir en:

- `packages/domain` si es regla pura.
- `packages/supabase` si es acceso a datos.
- Edge Functions si requiere privilegios sensibles.

## Backlog Priorizado

### 1. Supabase CLI y migraciones

Objetivo: convertir `supabase/schema/taxi_platform.sql` en migracion formal.

Pasos:

1. Instalar/configurar Supabase CLI si no existe.
2. Ejecutar:

```bash
supabase init
supabase migration new initial_taxi_platform
```

3. Copiar el contenido de `supabase/schema/taxi_platform.sql` dentro de la migracion creada.
4. Levantar Supabase local si aplica:

```bash
supabase start
```

5. Aplicar migracion.
6. Correr advisors.
7. Corregir errores de SQL, RLS o grants.

Criterio de aceptacion:

- La migracion aplica limpia.
- Las tablas, vistas y funciones existen.
- RLS esta activo en tablas publicas.
- No hay errores criticos de advisors.

### 2. Seed demo

Objetivo: crear datos iniciales para probar las apps.

Datos minimos:

- Tenant `habana-taxi`.
- Feature flags activos.
- Zonas: Habana, Aeropuerto, Playas del Este.
- Clases de vehiculo: Estandar, Confort, Van.
- Tarifas:
  - Base.
  - Por kilometro.
  - Minimo.
  - Nocturno o temporada alta.
- Usuarios demo:
  - Cliente.
  - Chofer.
  - Admin tenant.
- Perfil de chofer.
- Vehiculo asignado.

Recomendacion:

- Crear `supabase/seed.sql`.
- Usar UUIDs fijos para facilitar pruebas.

Criterio de aceptacion:

- Una reserva demo puede crearse y verse desde admin.
- Un chofer demo puede recibir asignacion.

### 3. Auth y roles

Objetivo: tener login real por rol.

Punto importante:

- No usar `user_metadata` para autorizacion.
- Usar `app_metadata` con:

```json
{
  "tenant_id": "...",
  "role": "customer"
}
```

Roles:

- `customer`
- `driver`
- `tenant_admin`
- `platform_admin`

Pasos:

1. Crear servicio de auth compartido.
2. Agregar guards por rol.
3. Agregar rutas login en las tres apps.
4. Resolver tenant por `tenantSlug`.
5. Cargar perfil despues del login.

Criterio de aceptacion:

- Cliente no entra a admin.
- Chofer no entra a admin.
- Admin solo ve su tenant salvo `platform_admin`.

### 4. Customer App conectada a Supabase

Objetivo: crear reserva real y estimar precio.

Archivos relevantes:

- `apps/customer/src/app/features/booking/new-booking.page.ts`
- `packages/supabase/src/lib/repositories/bookings.repository.ts`
- `packages/supabase/src/lib/repositories/pricing.repository.ts`

Pasos:

1. Reemplazar datos mock por formulario reactivo.
2. Cargar zonas y clases de vehiculo.
3. Llamar `PricingRepository.estimate`.
4. Crear reserva con `BookingsRepository.createRequest`.
5. Redirigir a `/rides/:id`.
6. Suscribirse a realtime con `subscribeToRide`.

Criterio de aceptacion:

- Cliente crea reserva.
- Se guarda en `ride_requests`.
- Admin la ve en operaciones.
- Cliente ve cambios de estado en seguimiento.

### 5. Admin App conectada a Supabase

Objetivo: operar reservas reales.

Archivos relevantes:

- `apps/admin/src/app/features/operations/operations.page.ts`
- `apps/admin/src/app/features/dispatch/dispatch.page.ts`
- `apps/admin/src/app/features/pricing/pricing.page.ts`
- `apps/admin/src/app/features/settings/settings.page.ts`
- `packages/supabase/src/lib/repositories/operations.repository.ts`
- `packages/supabase/src/lib/repositories/pricing.repository.ts`
- `packages/supabase/src/lib/repositories/tenants.repository.ts`

Pasos:

1. Cargar `tenant_operations_summary`.
2. Listar reservas abiertas.
3. Listar choferes disponibles.
4. Asignar chofer con `assignDriver`.
5. Gestionar reglas de tarifa.
6. Editar branding del tenant.

Criterio de aceptacion:

- Admin ve metricas reales.
- Admin asigna chofer.
- La reserva cambia a `driver_assigned`.
- Se crea evento en `ride_events`.

### 6. Driver App conectada a Supabase

Objetivo: chofer operativo.

Archivos relevantes:

- `apps/driver/src/app/features/dashboard/dashboard.page.ts`
- `apps/driver/src/app/features/rides/ride-detail.page.ts`
- `packages/supabase/src/lib/repositories/drivers.repository.ts`

Pasos:

1. Cargar perfil de chofer.
2. Cambiar disponibilidad con `setAvailability`.
3. Listar viajes asignados.
4. Actualizar estados del viaje.
5. Enviar cotizacion si el tenant tiene `driver_quotes`.

Criterio de aceptacion:

- Chofer cambia a activo/pausado.
- Chofer ve viajes asignados.
- Chofer actualiza estado y el cliente/admin lo ven en realtime.

### 7. Notificaciones

Objetivo: dejar funcionando notificaciones internas y preparar canales externos.

Archivos relevantes:

- `packages/supabase/src/lib/repositories/notifications.repository.ts`
- `supabase/schema/taxi_platform.sql`

Pasos:

1. Crear notificacion al asignar chofer.
2. Mostrar notificaciones no leidas en cada app.
3. Marcar como leidas.
4. Crear Edge Function para WhatsApp/SMS/push.

Criterio de aceptacion:

- Al asignar un viaje, el chofer recibe notificacion.
- Al cambiar estado, el cliente recibe notificacion.

### 8. Mapas y ubicacion

Objetivo: seguimiento y despacho visual.

Opciones:

- Proveedor externo configurable.
- Mapa simple inicial con coordenadas guardadas.
- Fallback manual para Cuba si no hay geocoding confiable.

Pasos:

1. Guardar ubicacion del chofer.
2. Agregar tabla `driver_locations` si hace falta.
3. Realtime para ubicacion.
4. UI de mapa en cliente/admin.

Criterio de aceptacion:

- Cliente ve ultima ubicacion del chofer.
- Admin ve choferes disponibles por zona.

### 9. Pagos y comisiones

Objetivo: monetizacion.

Pasos:

1. Definir metodos: efectivo, transferencia, pasarela.
2. Agregar tabla de comisiones si hace falta.
3. Registrar pago pendiente/pagado.
4. Reporte por tenant, chofer y periodo.

Criterio de aceptacion:

- Cada viaje completado tiene pago asociado.
- Admin ve ingresos y comisiones.

### 10. Calidad y despliegue

Objetivo: producto mantenible.

Tareas:

- Tests unitarios de repositorios.
- Tests E2E basicos por app.
- `.env.example`.
- CI/CD.
- Ambientes `dev`, `staging`, `prod`.
- Documentacion de despliegue.
- Monitoreo/logs.

## Notas de Seguridad

- Nunca exponer `service_role` en apps Ionic.
- No usar `user_metadata` para permisos.
- Las acciones administrativas sensibles deben ir por RPC segura o Edge Function.
- Las vistas deben usar `security_invoker = true`.
- Las tablas publicas deben tener RLS.
- Revisar grants cuando se agreguen nuevas tablas.

## Convenciones Recomendadas

### Nombres

- Tablas SQL en plural y snake_case.
- Campos tenant siempre como `tenant_id`.
- Campos de usuario como `profile_id`, `customer_id`, `actor_id`.
- Estados como enum cuando afecten flujos principales.

### Angular/Ionic

- Componentes standalone.
- Rutas lazy con `loadComponent`.
- UI con componentes Ionic.
- Formularios reactivos para pantallas reales.
- No poner logica de Supabase directamente en templates.

### Supabase

- Repositorios por area funcional.
- RPC para operaciones con multiples escrituras.
- Edge Functions para integraciones externas.
- Realtime encapsulado en helpers.

## Comandos Utiles

```bash
pnpm install
pnpm build:customer
pnpm build:driver
pnpm build:admin
npm audit --audit-level=high --omit=dev
```

## Archivos Clave

- `supabase/schema/taxi_platform.sql`
- `packages/domain/src/public-api.ts`
- `packages/supabase/src/public-api.ts`
- `packages/auth/src/public-api.ts`
- `apps/customer/src/app/app.routes.ts`
- `apps/driver/src/app/app.routes.ts`
- `apps/admin/src/app/app.routes.ts`
- `docs/value-added-roadmap.md`

## Proxima Tarea Recomendada

Implementar Supabase local + migracion + seed demo. Sin eso, las apps ya compilan pero siguen usando datos mock en UI.
