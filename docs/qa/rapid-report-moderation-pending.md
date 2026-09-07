# QA — Fase 4 Reporte 60 segundos

Actualizado: 2026-09-05 America/Lima  
Rama: `feature/f4-readiness-f5-prep`  
Entorno validado: **staging y datos sintéticos**.  
Producción y `main`: **NO-GO / no tocar**.

## Estado final

**F4 P0 CLOSURE: PASS**

La Fase 4 queda formalmente cerrada a nivel técnico/operativo de staging. Esto no autoriza producción ni elimina el hardening posterior de F7.

## Candidato runtime validado y desplegado

- SHA runtime: `4a2460b1f2d77b088683eb5eab6db4f372ca2927`.
- Worker: `barrio24-reports-api-staging`.
- Version ID desplegado: `a18d49e3-4adb-4bdf-8786-4758b057ea15`.
- Version ID anterior: `cf2bab1e-db4f-435f-9c12-eed02682dce3`.
- D1: `barrio24-reports-staging`.
- Pages: `https://feature-02-rapid-report.barrio24-staging.pages.dev`.
- Cron remoto confirmado manualmente: `0 5 * * *`.
- Rate Limit namespace: `2026081401`.
- Access: `/v1/ops/*`.

## Evidencia PASS

### Repositorio / tooling

- `npm ci`: PASS, 0 vulnerabilidades.
- `npm run check`: PASS.
- readiness read-only: PASS.
- Wrangler dry-run: PASS.
- Wrangler startup check: PASS.
- worktree QA limpio.

### D1 / migraciones

- migraciones `0001`–`0004`: consistentes;
- schema remoto read-only: PASS;
- tablas/columnas/índices esperados: PASS.

### API pública / abuso

- deploy solo del Worker staging: PASS;
- public smoke: PASS;
- public abuse: PASS;
- P0 evidence summary: `COMPLETE`.

### Access / consola / moderación

- consola autenticada: `200`;
- `verify`: PASS;
- `resolve`: PASS;
- `mark-duplicate`: PASS;
- `expire`: PASS;
- `invalid_decision`: PASS;
- `invalid_idempotency_key`: PASS;
- `invalid_transition`: PASS;
- `status_conflict`: PASS;
- replay idempotente: PASS;
- reutilización de key en otro reporte → `idempotency_conflict`: PASS;
- concurrencia: una transición aplicada y la segunda `status_conflict`;
- historial: actor, transición, motivo, timestamps y request ID presentes;
- CORS ops: origen Pages rechazado con `403 origin_not_allowed`.

### Carga P1

Rate-limit:
- `15/15` aceptadas;
- p50 `262.71 ms`;
- p95 `553.64 ms`.

Burst:
- `20/20` aceptadas;
- p50 `279.48 ms`;
- p95 `496.54 ms`.

P1 evidence summary: `COMPLETE`.

Decisiones:
- Queue: **no por ahora**;
- Turnstile: **no por ahora**.

### Headers / CSP / privacidad

- headers Pages: PASS;
- CSP Pages: PASS;
- headers consola ops: PASS;
- consola sin `Access-Control-Allow-Origin`: PASS;
- revisión de artifacts por JWT/cookies/Bearer/CF_API_TOKEN sin redacción: PASS;
- `unsafe-inline` de la consola queda como hardening F7, no blocker F4.

### Retención / cron

- test dedicada de retención: PASS;
- reportes >30 días se eliminan;
- frontera exacta de 30 días se conserva;
- auditoría >180 días se elimina;
- frontera exacta de 180 días se conserva;
- fallos de limpieza cierran con error;
- cron remoto `0 5 * * *`: confirmado manualmente en Cloudflare.

## Gap de evidencia no bloqueante

Wrangler no pudo repetir una consulta D1 directa posterior a moderación por autenticación (`API error 10000/9106`). Queda pendiente, cuando existan credenciales Wrangler autorizadas, reconfirmar directamente:

- `reports.last_moderation_event_id`;
- fila de `report_moderation_events`;
- `idempotency_key` almacenada.

No reabre F4 porque schema, historial, idempotencia y concurrencia ya validaron el comportamiento remoto.

## Hardening pendiente para F7 / piloto

- QA físico iPhone/Android;
- instalación PWA;
- offline y reconexión;
- persistencia local tras cerrar/reabrir;
- recuperación ante timeout/API caída;
- sincronización única tras reconexión;
- accesibilidad básica;
- observabilidad, cuotas y presupuesto;
- hardening CSP más estricto de consola;
- revisión final de seguridad/privacidad sobre el conjunto del piloto.

## Reglas después del cierre F4

- F5 puede avanzar en preparación e implementación solo cuando su puerta de datos lo permita.
- Producción sigue NO-GO.
- No crear `REPORTS_OPERATIONS_TOKEN`.
- No tocar `main`, producción, datos ciudadanos reales ni migraciones sin autorización explícita.
