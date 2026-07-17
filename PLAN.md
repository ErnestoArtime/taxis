# Plan de Ejecución — Taxi Commerce Platform

> **Estado**: Activo · **Versión**: 0.2.0 · **Última actualización**: 2026-07-17
>
> Documento vivo. A medida que se completan tareas, se marcan con `[x]` y se añade la fecha.

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| `[ ]` | Pendiente |
| `[~]` | En progreso |
| `[x]` | Completado |

---

## Fase 0 — Diagnóstico y setup inicial

Objetivo: entender el estado actual y preparar el entorno para trabajar.

### 0.1 Auditoría inicial
- [x] Verificar que `pnpm install` y `pnpm build` pasan en local
- [x] Verificar que `pnpm typecheck` pasa sin errores
- [x] Confirmar que existe Supabase CLI instalada (`supabase --version`)
- [x] Limpiar lockfiles npm (package-lock.json) si existen — estandarizar solo pnpm
- [x] Leer y digerir toda la documentación existente en `docs/`
- [x] Revisar `angular.json` y `pnpm-workspace.yaml` para entender topología

### 0.2 Variables de entorno
- [x] Crear `.env.example` raíz con todas las variables necesarias
- [x] Definir variables por app (customer, driver, admin)
- [x] Documentar dónde obtener cada valor (Supabase project, etc.)
- [x] Tipar las variables con interfaces en `packages/config`

### 0.3 Supabase local
- [x] Ejecutar `supabase init` si no existe
- [x] Mover schema actual a migración formal de Supabase CLI
- [x] Aplicar migración: `supabase db reset`
- [ ] Ejecutar `supabase db lint` y corregir errores de advisors
- [ ] Verificar RLS activo en todas las tablas públicas
- [ ] Cargar seed demo: `supabase db reset --no-db-password`

---

## Fase 1 — Seguridad multi-tenant (P0)

Objetivo: garantizar aislamiento total entre inquilinos antes de cualquier despliegue.

### 1.1 RLS completo
- [x] Verificar que cada tabla operativa tiene `enable row level security`
- [x] Confirmar políticas existentes cubren todos los roles
- [x] Añadir política que impida cambiar `tenant_id` en updates
- [x] Añadir política que impida cambiar `role` desde el cliente
- [x] Añadir política que impida a cliente asignar conductor
- [x] Añadir política que impida a conductor modificar precio final
- [ ] Crear tests SQL de aislamiento (cliente no ve datos de otro tenant)

### 1.2 Funciones SQL seguras
- [x] Crear `current_tenant_id()` como función estable confiable
- [x] Crear `current_user_role()` como función estable confiable
- [x] Validar que `assign_driver_to_ride` solo pueda llamarla admin del tenant
- [x] Validar que `confirm_ride_quote` solo pueda llamarla el cliente propietario
- [x] Añadir función `transition_ride_state()` transaccional con validación de estados
- [ ] Añadir función `create_customer_profile()` como trigger post-registro

### 1.3 Registro seguro de perfiles
- [x] Eliminar aceptación de `tenantId` desde el frontend en `signUpWithEmail`
- [x] Implementar resolución de tenant por slug/subdominio
- [ ] Marcar la anterior como vulnerable y documentar la solución aplicada

### 1.4 Entornos separados
- [ ] Crear proyecto Supabase `development`
- [ ] Crear proyecto Supabase `staging`
- [ ] Crear proyecto Supabase `production`
- [ ] Configurar claves separadas por entorno
- [ ] Configurar URLs permitidas diferentes por entorno
- [ ] Documentar proceso de promoción entre entornos

---

## Fase 2 — Máquina de estados de viaje (P1)

Objetivo: transiciones de estado predecibles, auditables y seguras.

### 2.1 Definir estados y transiciones
```
const allowedTransitions: Record<string, string[]> = {
  requested:       ['quoted', 'confirmed', 'cancelled'],
  quoted:          ['confirmed', 'cancelled'],
  confirmed:       ['driver_assigned', 'cancelled'],
  driver_assigned: ['arriving', 'confirmed', 'cancelled'],
  arriving:        ['in_progress', 'cancelled'],
  in_progress:     ['completed'],
  completed:       [],
  cancelled:       []
};
```
- [ ] Crear tipo `RideStatus` en `packages/domain`
- [ ] Crear constante `RIDE_STATE_MACHINE` con transiciones permitidas
- [ ] Crear función `canTransition(from: RideStatus, to: RideStatus): boolean`
- [ ] Crear función `getNextStates(current: RideStatus): RideStatus[]`

### 2.2 Función transaccional en la base de datos
- [ ] Crear RPC `transition_ride_state()` que:
  - Valida que la transición esté permitida
  - Verifica que el actor esté autorizado (admin, driver, customer según el estado)
  - Inserta registro en `ride_events`
  - Actualiza el estado en `ride_requests`
  - Retorna el viaje actualizado
- [ ] Añadir idempotencia: si ya está en ese estado, no falla

### 2.3 Razones de cancelación
- [ ] Crear enum/tabla `cancellation_reasons` por tenant
- [ ] Agregar campos en `ride_requests`: `cancelled_by`, `cancellation_reason_id`, `cancellation_note`, `cancellation_fee`, `cancelled_at`
- [ ] Validar que cancelación requiera razón obligatoria

### 2.4 Tests de la máquina de estados
- [ ] Unit tests de `canTransition()` para todos los pares
- [ ] Unit tests de `getNextStates()` para cada estado
- [ ] Tests de integración: llamar `transition_ride_state()` y verificar eventos

---

## Fase 3 — Vertical MVP: viaje completo punta a punta (P1)

Objetivo: cliente solicita → admin asigna → chofer ejecuta → completa → pago → reseña.

### 3.1 Cliente: solicitud funcional
- [ ] Conectar formulario `NewBookingPage` a `BookingsRepository.createRequest` con datos reales
- [ ] Cargar clases de vehículo desde Supabase
- [ ] Mostrar estimado de precio llamando a `estimate_ride_price`
- [ ] Redirigir a seguimiento tras crear reserva
- [ ] Añadir campos: nombre del pasajero, teléfono, referencia de recogida, referencia de destino

### 3.2 Cliente: seguimiento
- [ ] Suscribirse a cambios del viaje con `subscribeToRide`
- [ ] Mostrar estado actual
- [ ] Mostrar datos del chofer cuando asignado (nombre, vehículo, matrícula, teléfono)
- [ ] Botón para cancelar (si el estado lo permite)
- [ ] Mostrar precio final cuando esté disponible

### 3.3 Admin: bandeja de solicitudes
- [ ] Cargar lista de viajes abiertos desde `OperationsRepository.listOpenRides`
- [ ] Ordenar por prioridad y tiempo
- [ ] Mostrar origen, destino, hora, pasajeros, estado
- [ ] Botón para asignar chofer

### 3.4 Admin: selector de chofer
- [ ] Cargar choferes disponibles desde `DriversRepository.listAvailable`
- [ ] Mostrar nombre, vehículo, calificación
- [ ] Confirmar asignación → llamar `OperationsRepository.assignDriver`
- [ ] Verificar que cambia estado a `driver_assigned` y se crea evento

### 3.5 Chofer: dashboard operativo
- [ ] Cargar perfil y vehículo
- [ ] Cambiar disponibilidad (activo/pausado)
- [ ] Listar viajes asignados
- [ ] Suscribirse a nuevas asignaciones en tiempo real

### 3.6 Chofer: detalle de viaje y estados
- [ ] Botón "En camino" → estado `arriving`
- [ ] Botón "Llegué" → evento interno (no requiere cambio de estado)
- [ ] Botón "Pasajero abordó" → estado `in_progress`
- [ ] Botón "Viaje completado" → estado `completed`
- [ ] Abrir navegación externa con coordenadas de destino

### 3.7 Pago manual
- [ ] Registrar pago en `payments` al completar viaje
- [ ] Métodos iniciales: efectivo, transferencia, pago al chofer
- [ ] Admin marca como pagado desde backoffice
- [ ] Separar concepto: pago del pasajero ≠ liquidación del chofer

### 3.8 Reseña
- [ ] Mostrar pantalla de calificación post-viaje (1-5 estrellas + comentario)
- [ ] Insertar en `reviews` con validación de que el viaje esté completado

### 3.9 Auditoría
- [ ] Verificar que cada cambio de estado genere `ride_events`
- [ ] Verificar que `admin_audit_log` registre acciones administrativas
- [ ] Añadir vista de eventos en admin

---

## Fase 4 — Mapas y geolocalización (P1)

Objetivo: distancia y tarifa reales, no ficticias.

### 4.1 Paquete compartido `packages/maps`
- [ ] Crear interfaz `MapProvider` (abstracta para cambiar de proveedor)
- [ ] Métodos: `geocode(address)`, `reverseGeocode(lat,lng)`, `getRoute(origin,dest)`, `getDistanceAndDuration(origin,dest)`, `calculateDistanceKm(route)`
- [ ] Implementar con Leaflet (open-source, sin API key)
- [ ] Alternativa: MapLibre o Google Maps como proveedor configurable

### 4.2 Customer: selección en mapa
- [ ] Añadir permisos GPS (Ionic Capacitor)
- [ ] Mostrar mapa con ubicación actual
- [ ] Pin de origen (por defecto ubicación actual, editable)
- [ ] Pin de destino (toque en mapa o búsqueda)
- [ ] Campo de texto como fallback: "Escribe la dirección"
- [ ] Campo de referencia: "frente al hospital", "edificio azul", etc.

### 4.3 Cálculo de ruta real
- [ ] Al seleccionar origen y destino, calcular ruta
- [ ] Obtener distancia real (no 10km fijos)
- [ ] Obtener duración estimada (no 25min fijos)
- [ ] Mostrar en UI: "12.3 km · ~35 min"
- [ ] Pasar distancia y duración reales a `estimate_ride_price`

### 4.4 Validación de zona de servicio
- [ ] Verificar que origen y destino están dentro del área de servicio
- [ ] Mostrar advertencia si está fuera
- [ ] Permitir anulación manual por el operador

### 4.5 Admin: mapa operativo
- [ ] Mostrar viajes activos en mapa
- [ ] Mostrar ubicación de choferes (cuando esté disponible)
- [ ] Pin de origen/destino de cada viaje

### 4.6 Ubicación del chofer en tiempo real
- [ ] Tabla `driver_locations` (o actualizar periodicamente)
- [ ] Enviar ubicación desde app del chofer (setInterval + background geolocation)
- [ ] Suscribir a cliente/admin para ver ubicación en tiempo real
- [ ] Estrategia de retención: no guardar indefinidamente

---

## Fase 5 — Notificaciones y resiliencia (P2)

### 5.1 Motor de eventos
- [ ] Definir eventos del sistema:
  ```
  ride.requested | ride.assigned | ride.accepted | driver.arriving
  ride.started  | ride.completed | ride.cancelled | payment.confirmed
  ```
- [ ] Crear cola de eventos interna en `packages/domain`
- [ ] Al ocurrir un evento, generar notificaciones según tenant config

### 5.2 Notificaciones in-app
- [ ] Implementar creación de notificación en `notifications` tras cada evento
- [ ] Mostrar badge de no leídas en cada app
- [ ] Marcar como leídas al abrir
- [ ] Lista de notificaciones con navegación al viaje relacionado

### 5.3 Push notifications
- [ ] Edge Function para enviar push (FCM/APNs)
- [ ] Registrar `device_tokens` desde apps
- [ ] Enviar push al asignar viaje (a chofer)
- [ ] Enviar push al cambiar estado (a cliente)

### 5.4 Realtime resistente
- [ ] Suscripción a cambios con `subscribeToRide`
- [ ] Refetch al recuperar conexión
- [ ] Reintento con backoff exponencial
- [ ] Indicador offline en UI
- [ ] Cola local de acciones del chofer si no hay conexión
- [ ] Idempotencia en todas las transiciones

### 5.5 Canal WhatsApp (opcional)
- [ ] Edge Function con integración WhatsApp Business API
- [ ] Plantillas de mensaje: confirmación, asignación, recordatorio
- [ ] Configurable por tenant

---

## Fase 6 — Mejoras de base de datos (P2)

### 6.1 Nuevas tablas
- [ ] `driver_presence`: is_online, last_seen_at
- [ ] `driver_locations`: latitude, longitude, accuracy, heading, speed, location_updated_at
- [ ] `driver_shifts`: inicio, fin, driver_id
- [ ] `driver_earnings`: separado de payments
- [ ] `driver_settlements`: liquidaciones periódicas
- [ ] `tenant_invoices`: facturación al operador (SaaS)
- [ ] `tenant_plans`: planes comerciales
- [ ] `tenant_subscriptions`: suscripciones activas
- [ ] `cancellation_reasons`: catálogo por tenant

### 6.2 Campos adicionales en `ride_requests`
- [ ] `passenger_name`: nombre del pasajero real
- [ ] `passenger_phone`: teléfono del pasajero
- [ ] `pickup_reference`: referencia escrita
- [ ] `dropoff_reference`: referencia escrita
- [ ] `internal_code`: código interno de reserva
- [ ] `channel`: canal de origen (app, admin, whatsapp, web)
- [ ] `luggage_count`: cantidad de equipaje
- [ ] `flight_number`: vuelo o terminal
- [ ] `operator_notes`: observaciones privadas del operador
- [ ] `price_snapshot`: jsonb con instantánea de reglas aplicadas

### 6.3 Migraciones versionadas
- [ ] Toda cambio de esquema = nueva migración Supabase CLI
- [ ] Convención de nombrado: `YYYYMMDDHHmmss_descripcion.sql`
- [ ] Migraciones siempre forward-only (nunca editar una aplicada)
- [ ] Documentar rollback cuando sea posible

---

## Fase 7 — Motor de tarifas (P2)

### 7.1 Servicio de tarifas determinista
- [ ] Mover lógica de estimación a un servicio testeable en `packages/domain`
- [ ] Soporte para:
  - Precio base
  - Precio por kilómetro
  - Precio por minuto
  - Tarifa mínima
  - Recargo por horario (nocturno, temporada alta)
  - Recargo por zona (aeropuerto, etc.)
  - Ida y vuelta
  - Tiempo de espera
  - Equipaje extra
  - Cantidad de pasajeros
  - Precio fijo entre zonas (origen-destino específico)

### 7.2 Price snapshot
- [ ] Al estimar, guardar instantánea de reglas aplicadas en `ride_requests.price_snapshot`
- [ ] El precio histórico no cambia aunque se modifiquen tarifas futuras
- [ ] Mostrar desglose en UI del admin

### 7.3 Tests de tarifas
- [ ] Unit tests para cada tipo de regla
- [ ] Tests de combinación de reglas
- [ ] Tests de tarifa mínima
- [ ] Tests de recargo nocturno

---

## Fase 8 — Experiencia de usuario y marca blanca (P2)

### 8.1 Customer App rediseñada
- [ ] Mapa como elemento principal en home
- [ ] Botón "¿A dónde vas?" prominente
- [ ] Accesos rápidos: Casa, Trabajo, Aeropuerto
- [ ] Categorías de vehículo con imágenes
- [ ] Precio aproximado visible antes de confirmar
- [ ] Pantalla de búsqueda con direcciones recientes
- [ ] Estado del viaje con foto del chofer, vehículo, matrícula
- [ ] Botón de contacto (llamada/WhatsApp)
- [ ] Historial con opción "Repetir reserva"
- [ ] Pantallas: vacía, error, carga, sin conexión

### 8.2 Driver App mejorada
- [ ] Navegación externa con un toque
- [ ] Alertas de nueva asignación con sonido/vibración
- [ ] Dashboard de ganancias del día/semana/mes
- [ ] Perfil con documentos y vehículo
- [ ] Reporte de incidencias

### 8.3 Admin App completa
- [ ] Dashboard con métricas y gráficos
- [ ] Mapa operativo con viajes y choferes
- [ ] Bandeja de solicitudes con acciones rápidas
- [ ] Gestión de conductores: alta, edición, documentos
- [ ] Gestión de vehículos: alta, edición, inspección
- [ ] Configuración de tarifas y zonas con UI visual
- [ ] Calendario de reservas futuras
- [ ] Conciliación de pagos
- [ ] Cancelaciones con motivo
- [ ] Chat/bandeja de soporte
- [ ] Auditoría con filtros
- [ ] Reportes exportables
- [ ] Roles internos: operador, supervisor, administrador

### 8.4 Marca blanca
- [ ] Aplicar branding del tenant en tiempo real (colores, logo, nombre)
- [ ] Configurar dominios personalizados por tenant
- [ ] Página pública por operador
- [ ] Feature flags controlan UI visible

### 8.5 Internacionalización
- [ ] Español e inglés como mínimo
- [ ] Moneda configurable por tenant
- [ ] Formato local de fecha y hora
- [ ] Traducciones por tenant (términos: taxi/transfer/traslado/reserva)
- [ ] Librería: ngx-translate o similar

---

## Fase 9 — Pagos y monetización (P2)

### 9.1 Abstracción de pagos
- [ ] Interfaz `PaymentProvider` en `packages/domain`:
  ```typescript
  interface PaymentProvider {
    createPayment(input: PaymentInput): Promise<PaymentResult>;
    verifyPayment(reference: string): Promise<PaymentStatus>;
    refundPayment(reference: string): Promise<RefundResult>;
  }
  ```
- [ ] No acoplar dominio a un proveedor específico
- [ ] Métodos iniciales: efectivo, transferencia, pago al chofer, confirmación manual

### 9.2 Flujo de pago en viaje
- [ ] Al completar viaje, crear registro en `payments` con estado `pending`
- [ ] Admin marca como pagado (efectivo/transferencia confirmada)
- [ ] Registrar quién cobró, cuándo y método

### 9.3 Liquidación de choferes
- [ ] Tabla `driver_earnings`: ingreso por viaje
- [ ] Tabla `driver_settlements`: liquidación periódica
- [ ] Admin puede ver saldo pendiente de cada chofer
- [ ] Reporte de comisiones por tenant

### 9.4 Monetización SaaS (preparación)
- [ ] Tablas `tenant_plans`, `tenant_subscriptions`, `usage_counters`
- [ ] Feature flags controlados por plan
- [ ] Dashboard de uso para facturación manual inicial

---

## Fase 10 — Calidad y despliegue (P2)

### 10.1 Pruebas automatizadas
**Unit tests**
- [ ] Configurar Vitest o Jest en `packages/domain`
- [ ] Tests de máquina de estados
- [ ] Tests de motor de tarifas
- [ ] Tests de helpers de notificaciones

**Integration tests**
- [ ] Tests de auth guards
- [ ] Tests de repositorios (con Supabase local)
- [ ] Tests de RLS con diferentes roles
- [ ] Tests de aislamiento entre tenants
- [ ] Tests de asignación concurrente

**E2E**
- [ ] Configurar Playwright
- [ ] Flujo completo: cliente → admin → chofer → completado
- [ ] Prueba de pérdida de conexión
- [ ] Prueba de recuperación de sesión

### 10.2 CI/CD
- [ ] Ampliar GitHub Actions:
  ```yaml
  install → format check → lint → typecheck → unit tests → build
  → database tests → e2e → deploy staging
  ```
- [ ] Añadir lint real (ESLint con reglas compartidas)
- [ ] Añadir formato (Prettier)
- [ ] CD: deploy automático a staging en cada PR
- [ ] CD: deploy a producción manual con aprobación
- [ ] Versionado semántico
- [ ] Release notes automáticas

### 10.3 Observabilidad
- [ ] Logs estructurados en Edge Functions
- [ ] Monitoreo de errores (Sentry u similar)
- [ ] Alertas de caída de servicio
- [ ] Dashboard de uptime y rendimiento

### 10.4 Documentación
- [ ] README actualizado con estado real
- [ ] Documentación de despliegue (`docs/deployment.md`)
- [ ] Documentación de recuperación (`docs/disaster-recovery.md`)
- [ ] Guía de onboarding para nuevo operador
- [ ] Términos y políticas (legales)

---

 ## Fase 11 — Automatización avanzada (P3)

### 11.1 Asignación por proximidad
- [x] Calcular choferes cercanos al origen (RPC `find_nearby_drivers` con fórmula haversine)
- [x] Notificar a choferes elegibles (notificación in-app automática en `auto_assign_driver`)
- [x] Auto-asignación del más cercano (RPC `auto_assign_driver` transaccional)
- [ ] Timeout y reasignación (pendiente)

### 11.2 Ofertas a conductores
- [x] Activar `driver_quotes` por tenant (feature flag existente)
- [x] Choferes ofertan precio (RPC `submit_driver_quote` + UI en ride-detail)
- [ ] Cliente/u operador elige (pendiente de UI)

### 11.3 Reglas de prioridad
- [ ] Viajes programados tienen prioridad (pendiente)
- [ ] Clientes recurrentes tienen prioridad (pendiente)
- [x] Asignación manual siempre anula automática (por diseño: auto-assign solo para status 'requested')

### 11.4 Tarifas dinámicas
- [ ] Ajuste por demanda en tiempo real (pendiente)
- [ ] Configurable por tenant (pendiente)
- [ ] Límites máximos configurables (pendiente)

### 11.5 Métricas operativas
- [x] Vista `tenant_daily_metrics` (viajes, ingresos, duración promedio, choferes activos por día)
- [x] Vista `driver_performance` (completados, ingresos 7 días, tasa de completación)
- [ ] Tiempo promedio de asignación (pendiente)
- [ ] Satisfacción del cliente (pendiente)

---

## Estado actual del proyecto

| Área | Estado | Notas |
|------|--------|-------|
| Monorepo Angular/Ionic | ✅ Completo | 3 apps, 5 packages |
| Modelo de datos SQL | ✅ Completo | Schema + migración + seed |
| RLS y seguridad multi-tenant | ⚠️ Parcial | Políticas existen, falta revisión |
| Autenticación y guards | ✅ Completo | TaxiAuthService, guards por rol, tenant resuelto por slug |
| Repositorios Supabase | ✅ Completo | 6 repositorios |
| Customer App UI | ⚠️ Parcial | Home + NewBooking + RideTracking con datos reales |
| Driver App UI | ✅ Mejorado | Dashboard + RideDetail con state machine |
| Admin App UI | ✅ Mejorado | Operations + Dispatch + Pricing + Settings |
| CI | ⚠️ Parcial | Typecheck + Build, faltan tests |
| Mapas | ⚠️ Iniciado | Paquete `@taxi/maps` con interfaz MapProvider |
| Notificaciones reales | ⚠️ Parcial | Generación automática en transiciones + repositorio |
| Pagos funcionales | ⚠️ Iniciado | Tablas driver_earnings + driver_settlements creadas |
| Tests | ❌ Pendiente | Prácticamente ausentes |
| Internacionalización | ❌ Pendiente | Solo es-CU |
| Marca blanca funcional | ⚠️ Parcial | Modelado, no aplicado en UI |
| Despliegue multi-entorno | ❌ Pendiente | Solo CI básica |

---

## Progreso

| Fase | Avance | Estado |
|------|--------|--------|
| Fase 0 — Diagnóstico y setup | 85% | Casi completo<br>Falta `supabase db reset` local |
| Fase 1 — Seguridad multi-tenant | 70% | RLS completo, registros seguros, migration creada |
| Fase 2 — Máquina de estados | 80% | State machine domain + SQL function, transiciones auditadas |
| Fase 3 — Vertical MVP | 60% | Pages conectadas, flujo punta a punta funcionando |
| Fase 4 — Mapas y geolocalización | 15% | Paquete `@taxi/maps` creado con interfaz `MapProvider` |
| Fase 5 — Notificaciones y resiliencia | 15% | Repositorio existente, generación automática en transiciones |
| Fase 6 — Mejoras de BD | 40% | Nuevas tablas y campos en migration |
| Fase 7 — Motor de tarifas | 90% | Servicio `calculatePrice` + `applyExtraCharges`, price snapshot, 9 unit tests |
| Fase 8 — UX y marca blanca | 60% | Branding service con CSS variables, settings con feature flags, colores dinámicos |
| Fase 9 — Pagos y monetización | 60% | PaymentProvider abstraction, CashPaymentProvider, TransferPaymentProvider, driver earnings, 7 tests |
| Fase 10 — Calidad y despliegue | 50% | CI con tests+lint+format+typecheck, Prettier, ESLint, docs/deployment.md, 50 tests total |
| Fase 11 — Automatización avanzada | 60% | Proximidad (find_nearby_drivers, auto_assign_driver), quotes (submit_driver_quote), metrics views, dispatch tests |

---

## Enlace con GitHub Projects

Este plan se refleja en el [Project Board](https://github.com/ErnestoArtime/taxis/projects) del repositorio.

Cada fase del plan corresponde a un milestone de GitHub. Cada tarea `[ ]` es un issue. Al completar una tarea, se actualiza el issue y este documento.

---

## Historial de cambios

| Fecha | Cambio |
|-------|--------|
| 2026-07-17 | Creación inicial del plan basada en evaluación del repositorio |
| 2026-07-17 | **Fase 0**: .env.example tipado, Supabase init, builds verificados |
| 2026-07-17 | **Fase 1**: Migration 2 con RLS mejorado, transición de estados, registros seguros |
| 2026-07-17 | **Fase 2**: State machine en `packages/domain`, RPC `transition_ride_state()` |
| 2026-07-17 | **Fase 3**: Customer booking sin mocks, dispatch con selector de viaje, driver con state machine |
| 2026-07-17 | **Fase 4**: Paquete `@taxi/maps` creado con interfaz MapProvider |
| 2026-07-17 | **Fase 7**: Pricing service determinista `calculatePrice()` + `applyExtraCharges()`, 9 tests |
| 2026-07-17 | **Fase 8**: Branding service `applyBrandingToDocument()`, settings con feature flags, CSS variables dinámicas |
| 2026-07-17 | **Fase 9**: PaymentProvider abstraction, CashPaymentProvider, TransferPaymentProvider, driver earnings calculator |
| 2026-07-17 | **Fase 11**: Proximity dispatch (find_nearby_drivers + auto_assign_driver RPCs), driver quotes (submit_driver_quote), dispatch domain service, metrics views, 8 tests |
