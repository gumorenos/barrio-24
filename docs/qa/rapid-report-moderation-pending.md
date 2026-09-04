# QA — Fase 4 Reporte 60 segundos

Actualizado: 2026-09-04 America/Lima  
Rama de trabajo: `feature/f4-readiness-f5-prep`  
Entorno permitido: **staging y datos sintéticos**.  
Producción y `main`: **NO-GO / no tocar**.

Este documento registra la evidencia y los pendientes operativos de la Fase 4. El roadmap vive en `docs/product/roadmap.md` y el procedimiento de staging en `docs/operations/rapid-report-staging-runbook.md`.

## Candidato validado y desplegado

- SHA exacto: `4a2460b1f2d77b088683eb5eab6db4f372ca2927`.
- Worker staging: `barrio24-reports-api-staging`.
- Version ID anterior: `cf2bab1e-db4f-435f-9c12-eed02682dce3`.
- Version ID desplegado: `a18d49e3-4adb-4bdf-8786-4758b057ea15`.
- Pages no fue redesplegado.
- Producción, `main`, configuración de Access y migraciones no fueron modificados.
- No se creó `REPORTS_OPERATIONS_TOKEN`.

## QA automatizado y staging — PASS

- `npm ci`: PASS, 0 vulnerabilidades.
- `npm run check`: PASS.
- Readiness read-only ligado al SHA: PASS.
- Wrangler deploy dry-run: PASS.
- Wrangler startup check: PASS.
- Namespace real de Rate Limiting verificado: `2026081401`.
- Migraciones D1 `0001`–`0004`: consistentes.
- Schema D1 read-only: PASS.
- Deploy únicamente del Worker staging: PASS.
- Public smoke: PASS.
- Public abuse probe: PASS.
- Evidence summary P0: `COMPLETE`.

## Access, consola y moderación — PASS

Con sesión real de Cloudflare Access:

- consola autenticada y endpoint operativo: `200`;
- Access protege `/v1/ops/*`;
- superficie ops rechaza CORS desde el origen Pages con `403 origin_not_allowed`;
- `verify`: PASS;
- `resolve`: PASS;
- `mark-duplicate`: PASS;
- `expire`: PASS;
- errores `invalid_decision`, `invalid_idempotency_key`, `invalid_transition` y `status_conflict`: PASS;
- replay con la misma `Idempotency-Key`: misma respuesta, sin nueva auditoría;
- reutilizar la misma key en otro reporte: `idempotency_conflict`;
- dos decisiones concurrentes sobre el mismo estado: una transición aplicada y la otra `status_conflict`;
- historial operativo persistido con actor, transición, motivo, timestamps y request ID.

No guardar JWT, cookies ni tokens de Access en Git o evidencia.

## P1 carga — PASS

### Perfil rate-limit

- solicitudes: `15/15` aceptadas;
- p50: `262.71 ms`;
- p95: `553.64 ms`.

### Perfil burst

- solicitudes: `20/20` aceptadas;
- p50: `279.48 ms`;
- p95: `496.54 ms`.

Evidence summary P1: `COMPLETE` para SHA `4a2460b1f2d77b088683eb5eab6db4f372ca2927`.

Decisiones actuales basadas en evidencia:

- Queue: **no por ahora**. La carga probada no justifica introducir una cola antes del piloto.
- Turnstile: **no por ahora**. El comportamiento observado tampoco justifica añadirlo todavía.

Estas decisiones deben reabrirse si cambian el volumen, el patrón de abuso o los requisitos de disponibilidad.

## Evidencia D1 pendiente no bloqueante de comportamiento

Una consulta D1 directa posterior a la moderación falló por credenciales de Wrangler con `API error 10000`.

Por tanto falta reconfirmar mediante consulta D1 directa:

- valor de `reports.last_moderation_event_id` en un reporte sintético moderado;
- fila correspondiente en `report_moderation_events`;
- `idempotency_key` almacenada.

Esto queda como **gap de evidencia directa**, no como fallo funcional observado, porque:

- migrations/schema read-only ya pasaron;
- la moderación remota pasó;
- el historial devolvió la auditoría esperada;
- replay/idempotency conflict pasaron;
- concurrencia produjo una sola transición efectiva.

No crear credenciales nuevas ni relajar permisos solo para cerrar este punto. Reconfirmarlo cuando exista una sesión Wrangler autorizada.

## P0 restantes para cerrar F4

Solo quedan dos bloques P0 de seguridad/operación que todavía requieren evidencia explícita:

### 1. Headers y CSP

- [ ] Revisar headers de seguridad del Pages staging.
- [ ] Revisar headers de la consola Worker.
- [ ] Confirmar CSP efectiva y ausencia de errores CSP relevantes.
- [ ] Confirmar que Access/JWT/configuración sensible no aparece en logs o artefactos.
- [ ] Confirmar minimización de ubicación y ausencia de identificadores personales inesperados.

### 2. Retención y cron

- [ ] Confirmar política de retención: reportes 30 días y auditoría 180 días.
- [ ] Ejecutar el cron con datos exclusivamente sintéticos preparados para expirar.
- [ ] Confirmar borrado selectivo correcto sin afectar filas que aún deban conservarse.
- [ ] Conservar evidencia del resultado sin datos ciudadanos reales.

**F5 no debe abrir implementación/publicación mientras alguno de estos P0 siga pendiente.**

## P1 / hardening que no bloquea el cierre técnico de F4

Estos puntos deben mantenerse para F7/piloto y no deben confundirse con un fallo del staging actual:

- [ ] iPhone: instalación/uso PWA, ubicación permitida/denegada, offline, reconexión y sincronización única.
- [ ] Android: instalación PWA, modo avión, reconexión, cola y sincronización.
- [ ] cerrar/reabrir conserva tarjeta y reportes locales;
- [ ] API caída/timeout no pierde el reporte local;
- [ ] persistencia local y recuperación tras reconexión;
- [ ] accesibilidad básica: contraste, zoom/tamaño de texto, teclado y lector de pantalla;
- [ ] ausencia de overflow y errores de consola relevantes;
- [ ] observabilidad, cuotas y presupuesto antes del piloto.

## Estado de Fase 4

**Funcionalidad conectada de staging: PASS.**  
**P0/P1 automatizado: COMPLETE.**  
**Access/moderación/idempotencia/concurrencia: PASS.**  
**Carga: PASS.**  
**Cierre formal F4: pendiente únicamente de headers/CSP y retención/cron.**  
**Producción: NO-GO.**

## F5 — preparación permitida, implementación aún cerrada

Puede continuar únicamente investigación y tooling que no publique ni integre mapas/rutas.

Sigue pendiente:

- licencia explícita de transformación/redistribución offline;
- bytes oficiales y hash real;
- CRS;
- edición/vigencia;
- revisión humana;
- `packagingEligible=true` antes de empaquetar.

## Evidencia a conservar

- SHA exacto;
- CI / `npm run check`;
- Worker Version ID anterior/nuevo;
- D1 y migraciones;
- readiness/smoke/abuso/carga;
- Access/consola/moderación;
- resultados de idempotencia/concurrencia;
- IDs únicamente sintéticos;
- limitaciones de dispositivos;
- confirmación de que `main`, producción, Pages, datos reales y `REPORTS_OPERATIONS_TOKEN` no fueron tocados.
