# Revision de Estado Actual

Fecha: 2026-06-26

## Estado General

El monorepo esta en buen estado para seguir iterando. Las tres apps compilan, el typecheck pasa y la base Supabase ya tiene migracion, schema y seed inicial.

Apps:

- `apps/customer`: login, home, reserva, seguimiento y rutas protegidas para `customer`.
- `apps/driver`: login, dashboard, detalle de viaje y rutas protegidas para `driver`.
- `apps/admin`: login, operaciones, despacho, tarifas, settings y rutas protegidas para `tenant_admin`/`platform_admin`.

Paquetes:

- `@taxi/domain`: modelos compartidos.
- `@taxi/supabase`: cliente, repositorios y realtime.
- `@taxi/auth`: servicio de auth, guards y configuracion.
- `@taxi/config`: configuracion base.
- `@taxi/ui`: tokens visuales.

## Mejoras Aplicadas en Esta Revision

- `TaxiAuthService` ahora inicializa de forma idempotente con `initPromise`.
- Los guards esperan `ensureInitialized()` antes de decidir acceso.
- `signInWithEmail` carga el perfil antes de devolver exito, evitando redirecciones sin rol.
- `signUpWithEmail` queda limitado a crear perfiles `customer`; choferes y admins deben ser gestionados desde backoffice o proceso seguro.
- Se agrego politica RLS `customers can create their own profile` en schema y migracion.
- Las apps declaran `@taxi/auth` como dependencia workspace.
- Se agregaron scripts raiz:
  - `pnpm build:customer`
  - `pnpm build:driver`
  - `pnpm build:admin`
- Se actualizo el handoff para reflejar migracion, seed, auth y comandos `pnpm`.

## Verificacion Ejecutada

```bash
pnpm install
pnpm build:customer
pnpm build:driver
pnpm build:admin
pnpm -r --if-present typecheck
npm audit --audit-level=high --omit=dev
```

Resultado:

- Builds OK.
- Typecheck OK.
- Auditoria de produccion OK.

## Deudas Detectadas

- Hay `package-lock.json` dentro de apps y en la raiz, aunque el proyecto declara `pnpm`. Recomendacion: decidir un solo gestor y limpiar lockfiles de npm si se confirma `pnpm` como estandar.
- Las pantallas todavia tienen bastante dato mock; los repositorios ya existen, pero falta conectar flujos reales completos.
- El seed crea datos comerciales, pero falta estrategia completa para usuarios Auth demo y `app_metadata`.
- Falta validacion de Supabase local con `supabase start`, migracion aplicada y advisors.
- Falta `.env.example` y estrategia clara de variables por ambiente.
- Aun no hay tests unitarios ni E2E.

## Proximas Mejoras Recomendadas

1. Limpiar estrategia de lockfiles y documentar `pnpm` como unico gestor.
2. Crear `.env.example` y adaptar environments.
3. Levantar Supabase local, aplicar migracion y ajustar seed/Auth demo.
4. Conectar Customer App a `PricingRepository` y `BookingsRepository`.
5. Conectar Admin App a `OperationsRepository`, `DriversRepository` y `PricingRepository`.
6. Agregar Edge Function para creacion segura de choferes/admins con `app_metadata`.
7. Agregar tests de auth guards y repositorios.
