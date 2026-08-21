# QA pendiente — Reporte 60 segundos y moderación

Actualizado: 2026-08-20 America/Lima  
Entorno permitido: staging, con datos sintéticos.  
Producción y `main`: no tocar.

## Estado de implementación

La autorización de Cloudflare Access, la allowlist de operadores, las transiciones de moderación y la auditoría D1 están implementadas en la rama `feature/02-rapid-report`. Esta ronda probó el commit `d2fd8431389198dafb232f7e37bbcc251938a346` en staging.

Configuración remota confirmada:

- Aplicación Access existente para `barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/*`.
- Allowlist: `gumorenos@gmail.com`.
- D1 staging: `barrio24-reports-staging`, ID `eca7ac80-6859-40d5-89db-ba1bb6c61173`.
- Worker staging: `barrio24-reports-api-staging`.
- Version ID de la ronda anterior: `7e8f0931-0118-48ca-a703-85919fb09191`.
- `api/migrations/0004_moderation_audit.sql` aplicada.
- `POST /v1/reports` permanece público; `/v1/ops/*` requiere Access.
- `REPORTS_OPERATIONS_TOKEN` no está configurado.

También están implementados:

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

La sesión interactiva autenticada de Access se validó en navegador headless con `gumorenos@gmail.com`. La consola cargó correctamente, pero el QA quedó bloqueado en las mutaciones: los `POST` de decisión originados desde la propia consola responden `403 origin_not_allowed`. No se usó un JWT estático ni se intentó sustituir Access.

## Evidencia QA autenticado — 2026-08-21 America/Lima

- URL: `https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/`.
- HTML `200`; título `Barrio 24 · Operaciones`.
- Resumen inicial: `total: 57`, `by_status: { unverified: 57 }`.
- Lista: 57 reportes sintéticos; únicamente campos operativos esperados.
- Filtros: `unverified` `200`/57; `verified`, `resolved`, `duplicate` y `expired` `200`/0, todos coincidentes con el estado solicitado.
- Historial de `c4d838e3-46b2-482f-b350-e2edb023f628`: `200`, `events: []`.
- Motivo obligatorio: pulsar `Aplicar` sin motivo mostró `Cada decisión necesita un motivo.` y no mutó datos.
- Verify/resolve: `c4d838e3-46b2-482f-b350-e2edb023f628`.
- Mark-duplicate: `4b299044-8e90-4583-9c09-23144e807904`.
- Expire: `184402bd-6038-49c1-a83e-d0f587208eef`.
- Idempotencia y `expected_status` obsoleto: `f1107ad3-bc4a-4597-a4ad-1c04d5ccbde1`.
- `POST /v1/reports` público adicional: `f8579056-bb32-4af9-a7d6-9b31300fd885`, `202`, `unverified`.
- Sin sesión, `/v1/ops/`, `/summary`, `/reports`, `/history` y `/decision` devolvieron `302` hacia Cloudflare Access.
- No se observaron coordenadas exactas ni datos sensibles; solo `location_cell` aproximada de dos decimales.

### Bloqueo histórico de mutaciones

El primer intento de decisión desde la consola respondió `403 {"error":"origin_not_allowed"}`. Por ello no se ejecutaron verify, resolve, mark-duplicate, expire, doble decisión con el mismo `Idempotency-Key`, `expected_status` obsoleto ni acción inválida sobre estado terminal; los cuatro IDs conservaron `unverified` y no se creó auditoría. Corregir/verificar la política de origen y repetir únicamente la matriz de mutaciones, idempotencia, concurrencia y auditoría. No se redeployó ni se tocó configuración remota.

## Evidencia QA posterior al fix — 2026-08-21 America/Lima

- Commit probado: `012f3ff7c69609f2863c5111efa6a6127da1f932` (`Allow same-origin operations requests`).
- `npm ci`: OK; 377 paquetes instalados, 378 auditados, 0 vulnerabilidades.
- `npm run check`: OK; 7 archivos de test, 33 tests, build Vite OK.
- `wrangler deploy --dry-run`: OK; Worker `barrio24-reports-api-staging`, D1 `barrio24-reports-staging`, Rate Limit `10/60s` y `ALLOWED_ORIGIN` de Pages confirmados. Bundle 82.79 KiB / 19.27 KiB gzip.
- `wrangler check startup`: OK; bundle 82.79 KiB / 19.27 KiB gzip; startup activo local 9.1 ms.
- Deploy: únicamente `barrio24-reports-api-staging`; Version ID `946d3cea-9f88-415c-9656-00e0fa5431df`. No migraciones.
- Consola autenticada: HTML `200`, título `Barrio 24 · Operaciones`, resumen antes del último POST `total: 58` con `unverified: 52`, `verified: 2`, `resolved: 1`, `duplicate: 1`, `expired: 2`; el POST público final añadió un `unverified`, total `59`.
- Motivo vacío: UI mostró `Cada decisión necesita un motivo.` y no mutó el reporte.
- Verify vía botón de consola: `c4d838e3-46b2-482f-b350-e2edb023f628`, `unverified → verified`; auditoría `7a12c43e-169c-4d82-8c7a-d13effdc56e1`.
- Resolve: mismo ID, `verified → resolved`; auditoría `abb59d86-b2fe-4329-b2ff-d04fa0b323e4`.
- Mark-duplicate: `4b299044-8e90-4583-9c09-23144e807904`, `unverified → duplicate`; auditoría `42026317-7012-42b3-81a5-d12ab5e342f0`.
- Expire: `184402bd-6038-49c1-a83e-d0f587208eef`, `unverified → expired`; auditoría `21d0afd2-bd4f-4741-9fee-7c4c7d71ba26`.
- Idempotencia: `7852532e-0628-4016-8c1c-305df989c317`; primera decisión `200`, segunda con el mismo key `200`, mismo `audit_id` `c2d93fcd-7e75-4aa2-a867-446725e33a74`, `idempotent: true`; una sola fila de auditoría.
- `expected_status` obsoleto sobre ese mismo ID: `409 status_conflict`, `current_status: verified`, sin cambio.
- Estado terminal: `becfd97d-a1b4-4ea4-afe3-1d9944803d26` expirado; intento `resolve` respondió `409 invalid_transition`; la UI muestra `Sin acciones` para expirados.
- Origen Pages autenticado en `/v1/ops/summary`: `403 {"error":"origin_not_allowed"}`.
- `POST /v1/reports` público desde Pages: `202`, ID `5a485364-8123-49ea-aa5f-57741c8f68ea`, estado `unverified`.
- Campos operativos observados: `event_id`, `schema_version`, `category`, `severity`, `location_cell`, `observed_at`, `received_at`, `status`; sin coordenadas exactas, datos reales ni secretos.
- No se aplicaron migraciones, no se tocó Pages, `main`, producción, D1 ni `REPORTS_OPERATIONS_TOKEN`; Access existente se reutilizó.

## Evidencia de esta ronda — 2026-08-20/21 America/Lima

- `npm ci`: OK; 378 paquetes auditados, 0 vulnerabilidades reportadas.
- `npm run check`: OK; typechecks, build y 33 tests.
- `wrangler deploy --dry-run`: OK; bindings confirmados contra Worker/D1 de staging.
- `wrangler check startup`: OK; bundle 82.38 KiB, 19.19 KiB gzip, 5.4 ms activos en el perfil local.
- Deploy: únicamente `barrio24-reports-api-staging`; Version ID `7e8f0931-0118-48ca-a703-85919fb09191`.
- `GET /api/health`: `200`.
- `GET /v1/ops/summary` y `GET /v1/ops/` sin sesión: `302` hacia Cloudflare Access; no se devolvieron datos operativos.
- `POST /v1/reports` público: reportes sintéticos aceptados con `202` y estado `unverified`. IDs: `f1107ad3-bc4a-4597-a4ad-1c04d5ccbde1`, `184402bd-6038-49c1-a83e-d0f587208eef`, `4b299044-8e90-4583-9c09-23144e807904`, `c4d838e3-46b2-482f-b350-e2edb023f628`.
- Reenvío del primer reporte: `409` con `duplicate: true`.
- Consulta D1 remota de solo lectura: `reports.last_moderation_event_id` y `report_moderation_events` presentes; `rows_written: 0`.
- Las pruebas usaron únicamente `location_cell` aproximada o `null`; no se expusieron coordenadas exactas.
- Limitación de la ronda previa: las mutaciones autenticadas seguían pendientes; la evidencia de esta sesión está en `Evidencia QA autenticado` abajo. El bloqueo actual es `403 origin_not_allowed` en los `POST` de decisión.

## P0 — configuración remota completada

- [x] Crear la aplicación de Cloudflare Access únicamente para `https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/*`.
- [x] Configurar una política `Allow` para el correo del dueño del proyecto; no usar `Everyone`.
- [x] Confirmar que `POST /v1/reports` sigue público en staging y no queda detrás de Access.
- [x] Obtener el `TEAM_DOMAIN` y el `AUDIENCE` de esa aplicación.
- [x] Configurar fuera de Git `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` y `ACCESS_OPERATOR_EMAILS` en el Worker staging.
- [x] No configurar ni generar `REPORTS_OPERATIONS_TOKEN`.
- [x] Aplicar solamente `api/migrations/0004_moderation_audit.sql` en `barrio24-reports-staging`.
- [x] Desplegar el Worker desde el commit de esta rama y guardar el `Version ID`.
- [x] No desplegar producción, no tocar `main` y no usar datos reales.

Si una futura modificación de Access responde `403`/`1010`, detenerse y reportar el permiso faltante; no sustituir Access por un token estático.

## P0 — autenticación y aislamiento

Probar desde una sesión autorizada y con `curl` o un cliente equivalente:

- [ ] Sin configuración de Access: las rutas `/v1/ops/*` responden `404 not_found`.
- [ ] Sin JWT: `403 access_required`.
- [ ] JWT mal firmado, expirado, con issuer incorrecto o audience incorrecta: `403 access_invalid`.
- [ ] JWT válido con correo fuera de la allowlist: `403 access_forbidden`.
- [ ] JWT válido con correo permitido: consulta `200`.
- [x] Verificar que no se envía `Access-Control-Allow-Origin` en respuestas operativas sin sesión.
- [x] Verificar que un `Origin` no permitido no puede leer rutas operativas sin sesión.
- [x] Verificar que `POST /v1/reports` continúa funcionando con el origen exacto de Pages.
- [ ] Verificar que ningún JWT, correo de operador o valor de configuración aparece en logs, respuestas o Git.

## P0 — migración y datos

- [x] Confirmar en D1 staging que existe `reports.last_moderation_event_id`.
- [x] Confirmar que existe `report_moderation_events` y sus índices.
- [x] Insertar únicamente reportes sintéticos.
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
- [x] Duplicar `event_id` conserva el comportamiento `409 duplicate: true`.
- [ ] CORS permite únicamente el preview staging configurado.
- [ ] Rate limiting mantiene `429` y `retry-after`; no tratarlo como cuota estricta sin una prueba separada.
- [ ] Chromium móvil emulado sin overflow, errores de consola ni errores CSP.
- [ ] Prueba manual en iPhone Safari y Arc Search: ubicación aproximada, permiso denegado, sincronización y modo offline.

## P1 — interfaz operativa

Existe una consola same-origin en `GET /v1/ops/`, protegida por Cloudflare Access y no enlazada desde el home. No habilita un feed ciudadano ni cambia la PWA. La consola carga las rutas operativas desde el mismo Worker, por lo que no depende de CORS entre Pages y Worker.

Probar además:

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
