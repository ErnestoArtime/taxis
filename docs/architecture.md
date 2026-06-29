# Arquitectura

## Objetivo

Producto multi-tenant para vender o customizar una plataforma de taxis a diferentes operadores turisticos, agencias, cooperativas o gestores privados.

## Separacion por aplicacion

- Customer app: experiencia publica y autenticada para solicitar taxi, cotizar, reservar, cancelar y calificar.
- Driver app: herramienta operativa para choferes, con disponibilidad, ofertas, viajes asignados y eventos de estado.
- Admin app: backoffice para configurar tenant, conductores, vehiculos, zonas, tarifas, reservas, pagos, soporte y auditoria.

## Separacion compartida

- Dominio sin dependencias de UI para evitar duplicar reglas.
- Cliente Supabase encapsulado para que las apps no conozcan detalles de tablas.
- UI comun basada en Ionic CSS variables y componentes reutilizables.
- Configuracion multi-tenant desacoplada para permitir marcas diferentes.

## Principios

- Cada registro operativo pertenece a un `tenant_id`.
- Las apps moviles solo usan llave publica de Supabase.
- El rol administrativo se resuelve desde `app_metadata`, no desde metadatos editables por usuario.
- Las tablas expuestas tienen `grant` explicito y RLS habilitado.
- El admin debe operar con funciones controladas o backend/edge functions para acciones sensibles.
