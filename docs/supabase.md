# Supabase

## Estado

Esta base deja SQL preparado, pero no aplica cambios a una base real todavia.

## Nota importante de 2026

Supabase cambio los defaults de exposicion de tablas nuevas: no se debe depender de privilegios implicitos para Data API. Por eso el SQL incluye `grant` explicitos y `enable row level security`.

## Aplicacion futura

Cuando se instale Supabase CLI:

```bash
supabase init
supabase migration new initial_taxi_platform
```

Luego mover el contenido de `supabase/schema/taxi_platform.sql` a la migracion creada por la CLI y revisar con advisors antes de subirlo.

## Seguridad

- No usar `user_metadata` para permisos.
- Mantener `service_role` solo en backend seguro.
- Usar RLS por tenant en todas las tablas publicas.
- Para acciones administrativas sensibles, preferir RPC/Edge Functions revisadas.
