# QA pendiente — Reporte 60 segundos y moderación

Actualizado: 2026-08-18 15:45 America/Lima  
Entorno permitido: staging, con datos sintéticos.  
Producción y `main`: no tocar.

## Estado de implementación

La autorización de Cloudflare Access, la allowlist de operadores, las transiciones de moderación y la auditoría D1 están implementadas en la rama `feature/02-rapid-report`. También están implementados:

- `GET /v1/ops/reports` con filtro, límite y cursor.
- `GET /v1/ops/summary`.
- `GET /v1/ops/reports/:event_id/history` para revisar la auditoría.
- `POST /v1/ops/reports/:event_id/decision` con motivo obligatorio, `expected_status`, `Idempotency-Key`, `X-Request-Id` y control de concurrencia.
- Fallo cerrado cuando falta la configuración de Access.
- `REPORTS_OPERATIONS_TOKEN` fuera del diseño.

Validación local actual:

```text
npm run check: OK
Typecheck frontend: OK
Typecheck API: OK
Vitest: 32 tests, 7 archivos: OK
tsc/vite build: OK
git diff --check: OK
```

No se considera validación remota. El Worker staging continúa desplegado con el runtime anterior hasta que OpenClaw haga un deploy explícito.

## Bloqueo conocido

La creación de la aplicación Access se detuvo porque la API de Cloudflare respondió `403`, código `1010`. La lista de aplicaciones sí respondió `200`, pero no había aplicaciones y no se obtuvo `TEAM_DOMAIN` ni `AUDIENCE`.

Para reanudar, la sesión de OpenClaw necesita un token/API autorizado para crear aplicaciones de Access con el permiso de cuenta `Access: Apps and Policies Edit/Write`. El token no debe pegarse en Telegram ni en este repositorio.

## P0 — configuración remota antes de cualquier QA funcional

- [ ] Crear la aplicación de Cloudflare Access únicamente para `https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/*`.
- [ ] Configurar una política `Allow` para el correo del dueño del proyecto; no usar `Everyone`.
- [ ] Confirmar que `POST /v1/reports` sigue público en staging y no queda detrás de Access.
- [ ] Obtener el `TEAM_DOMAIN` y el `AUDIENCE` de esa aplicación.
- [ ] Configurar fuera de Git `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` y `ACCESS_OPERATOR_EMAILS` en el Worker staging.
- [ ] No configurar ni generar `REPORTS_OPERATIONS_TOKEN`.
- [ ] Aplicar solamente `api/migrations/0004_moderation_audit.sql` en `barrio24-reports-staging`.
- [ ] Desplegar el Worker desde el commit de esta rama y guardar el `Version ID`.
- [ ] No desplegar producción, no tocar `main` y no usar datos reales.

Si la API de Cloudflare vuelve a responder `403`/`1010`, detenerse y reportar el permiso faltante; no sustituir Access por un token estático.

## P0 — autenticación y aislamiento

Probar desde una sesión autorizada y con `curl` o un cliente equivalente:

- [ ] Sin configuración de Access: las rutas `/v1/ops/*` responden `404 not_found`.
- [ ] Sin JWT: `403 access_required`.
- [ ] JWT mal firmado, expirado, con issuer incorrecto o audience incorrecta: `403 access_invalid`.
- [ ] JWT válido con correo fuera de la allowlist: `403 access_forbidden`.
- [ ] JWT válido con correo permitido: consulta `200`.
- [ ] Verificar que no se envía `Access-Control-Allow-Origin` en respuestas operativas.
- [ ] Verificar que un `Origin` no permitido no puede leer rutas operativas.
- [ ] Verificar que `POST /v1/reports` continúa funcionando con el origen exacto de Pages.
- [ ] Verificar que ningún JWT, correo de operador o valor de configuración aparece en logs, respuestas o Git.

## P0 — migración y datos

- [ ] Confirmar en D1 staging que existe `reports.last_moderation_event_id`.
- [ ] Confirmar que existe `report_moderation_events` y sus índices.
- [ ] Insertar únicamente reportes sintéticos.
- [ ] Confirmar que la consulta operativa no devuelve texto libre, datos médicos, coordenadas exactas ni campos `lat`, `lng`, `latitude` o `longitude`.
- [ ] Confirmar que `location_cell` solo contiene la celda aproximada de dos decimales.
- [ ] Confirmar que la auditoría conserva actor, transición, motivo, `occurred_at`, `request_id` e idempotency key sin datos ciudadanos adicionales.

## P0 — contrato funcional de moderación

Crear un reporte sintético y comprobar que llega como `unverified`:

- [ ] `GET /v1/ops/reports?status=unverified&limit=1` devuelve el reporte.
- [ ] Paginación por `next_cursor` no repite ni omite el reporte.
- [ ] `GET /v1/ops/summary` devuelve totales y distribución por estado.
- [ ] `GET /v1/ops/reports/:event_id/history` empieza con `events: []`.
- [ ] `verify`: `unverified → verified`.
- [ ] `resolve`: `verified → resolved`.
- [ ] `mark-duplicate`: `unverified → duplicate`.
- [ ] `expire`: permitido desde `unverified`, `duplicate`, `verified` o `resolved`.
- [ ] `expired` es terminal.
- [ ] Transiciones inválidas responden `409 invalid_transition` o `409 status_conflict` según corresponda.
- [ ] Reporte inexistente responde `404 report_not_found`.
- [ ] Motivo vacío, decisión desconocida, estado esperado inválido y campos adicionales responden `400 invalid_decision`.
- [ ] Falta de `Idempotency-Key` UUID responde `400 invalid_idempotency_key`.
- [ ] `X-Request-Id` no UUID responde `400 invalid_request_id`.
- [ ] Cuerpo mayor de 4 KB responde `413 payload_too_large`.

## P0 — idempotencia, concurrencia y auditoría

- [ ] Repetir la misma petición con la misma `Idempotency-Key` devuelve el mismo resultado, mantiene el estado y conserva el `request_id` original.
- [ ] Reutilizar una `Idempotency-Key` para otro `event_id` responde `409 idempotency_conflict`.
- [ ] Repetir la decisión con otro idempotency key y un `expected_status` antiguo responde `409 status_conflict`.
- [ ] Lanzar dos decisiones simultáneas sobre el mismo estado: solo una cambia el reporte y solo una fila de auditoría queda creada.
- [ ] Consultar `history` después de cada decisión y comprobar orden descendente, actor y transición correctos.
- [ ] Simular D1 no disponible: las rutas operativas devuelven `503 storage_unavailable` sin exponer stack traces.
- [ ] Ejecutar el cron con datos sintéticos antiguos: reportes con más de 30 días y auditoría con más de 180 días se eliminan; los recientes se conservan.

## P1 — regresión del flujo ciudadano

- [ ] Preview Pages público continúa cargando con HTTPS y CSP válida.
- [ ] Crear reporte sintético, guardar sin ubicación y sincronizar manualmente.
- [ ] Crear reporte con zona aproximada; verificar que solo se transmite `location_cell`.
- [ ] Reintento cuando el API no responde; el reporte queda local y no se pierde.
- [ ] Duplicar `event_id` conserva el comportamiento `409 duplicate: true`.
- [ ] CORS permite únicamente el preview staging configurado.
- [ ] Rate limiting mantiene `429` y `retry-after`; no tratarlo como cuota estricta sin una prueba separada.
- [ ] Chromium móvil emulado sin overflow, errores de consola ni errores CSP.
- [ ] Prueba manual en iPhone Safari y Arc Search: ubicación aproximada, permiso denegado, sincronización y modo offline.

## P1 — interfaz operativa

No hay una pantalla pública de moderación desplegada. No añadir un enlace de operaciones al home ni habilitar un feed ciudadano. Antes de construir o publicar una interfaz, definir una superficie same-origin o una integración de Access compatible con el navegador; una página Pages haciendo `fetch` cross-origin al Worker sin CORS no es una solución aceptable.

Cuando exista esa superficie autorizada, probar además:

- [ ] La interfaz solo aparece después de autenticación Access.
- [ ] Lista, filtros, resumen e historial no muestran datos sin autorización.
- [ ] Cada mutación exige motivo y genera un idempotency key nuevo.
- [ ] Doble toque/reintento no duplica decisiones.
- [ ] Estados terminales deshabilitan acciones incompatibles.
- [ ] Errores `403`, `404`, `409` y `503` son visibles y no hacen perder el reporte seleccionado.

## Evidencia que debe guardar OpenClaw

- Commit exacto probado y rama.
- Worker Version ID, URL, D1 ID y migración aplicada.
- Nombre/patrón de la aplicación Access, sin imprimir secretos.
- Comandos y resultados de `npm run check`, deploy dry-run y smoke tests.
- IDs de eventos sintéticos usados.
- Resultado de cada bloque P0/P1 y cualquier limitación de dispositivo.
- Confirmación explícita de que `main`, producción, datos reales y `REPORTS_OPERATIONS_TOKEN` no fueron tocados.
