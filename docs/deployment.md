# Despliegue

## Entornos

| Entorno | Supabase | Apps | Propósito |
|---------|----------|------|-----------|
| `development` | Local (`supabase start`) | `pnpm start:*` | Desarrollo local |
| `staging` | Proyecto Supabase cloud | CI/CD automático | Pruebas de integración |
| `production` | Proyecto Supabase cloud | CI/CD manual | Producción |

## Requisitos

- Node.js 22+
- pnpm 9.15+
- Supabase CLI 2.109+
- Proyecto Supabase cloud (para staging/production)

## Despliegue local

```bash
# 1. Iniciar Supabase local
supabase start

# 2. Aplicar migraciones
supabase db reset

# 3. Iniciar apps
pnpm start:customer   # http://localhost:4200
pnpm start:driver     # http://localhost:4201
pnpm start:admin      # http://localhost:4202
```

## Variables de entorno

Cada app necesita un archivo `.env` basado en `.env.example` con los valores correctos de Supabase.

Variables compartidas:
- `SUPABASE_URL` — URL del proyecto Supabase
- `SUPABASE_ANON_KEY` — Anon key pública
- `TENANT_SLUG` — Slug del tenant por defecto

## CI/CD

El workflow de GitHub Actions ejecuta:
1. Install
2. Format check (Prettier)
3. Lint (ESLint)
4. Typecheck
5. Unit tests
6. Build
7. Deploy to staging (automático en main)
8. Deploy to production (manual, con aprobación)

## Promoción a producción

1. Verificar que staging esté estable
2. Ejecutar migraciones Supabase en producción
3. Hacer deploy manual de apps
4. Verificar smoke tests
5. Monitorear logs

## Estrategia de migraciones

- Toda migración es forward-only (nunca editar una aplicada)
- Convención: `YYYYMMDDHHmmss_descripcion.sql`
- Probar en local y staging antes de producción
- Backup antes de migrar producción
