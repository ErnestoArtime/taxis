# Taxi Commerce Platform

Monorepo base para comercializar una plataforma de taxis customizable por cliente en Cuba.

## Apps

- `apps/customer`: reservas, seguimiento de solicitudes y pagos para clientes.
- `apps/driver`: gestion de disponibilidad, ofertas, viajes y cobros para choferes.
- `apps/admin`: consola operativa para gestores, flotas, reservas, tarifas y auditoria.

## Paquetes

- `packages/domain`: tipos, modelos y reglas comunes del negocio.
- `packages/supabase`: cliente y repositorios preparados para Supabase.
- `packages/ui`: tokens visuales y componentes Ionic compartidos.
- `packages/config`: configuracion por tenant, marca, moneda y feature flags.

## Funcionalidades base

- Marca blanca multi-tenant.
- Tarifas configurables por zona, horario, clase de vehiculo y reglas comerciales.
- Dashboard administrativo y despacho.
- Reservas de cliente con estimado inicial.
- Flujo de chofer con disponibilidad y estados de viaje.
- Realtime y notificaciones preparadas para Supabase.

## Siguiente paso tecnico

Cuando se quiera instalar, usar pnpm y crear las apps Ionic Angular reales dentro de las carpetas ya separadas:

```bash
pnpm install
pnpm start:customer
```

La base SQL vive en `supabase/schema/taxi_platform.sql`. Antes de aplicarla a un proyecto real, convertirla en migracion con Supabase CLI para conservar historial.
