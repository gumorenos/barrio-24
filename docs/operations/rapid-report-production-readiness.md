# Production readiness — Reporte 60 segundos

Actualizado: 2026-09-05 America/Lima.

## Veredicto actual

**Fase 4 staging: CLOSED / PASS.**  
**Producción: NO-GO.**

Cerrar F4 significa que el módulo conectado de Reporte 60 segundos superó sus gates de staging. No autoriza cambios en `main`, despliegues productivos, aplicación de migraciones ni uso de datos reales. Producción continúa dependiendo de F5, F6, F7 y de una decisión GO explícita.

## Candidato validado

- Rama: `feature/f4-readiness-f5-prep`.
- SHA runtime validado/desplegado: `4a2460b1f2d77b088683eb5eab6db4f372ca2927`.
- Worker: `barrio24-reports-api-staging`.
- Version ID desplegado: `a18d49e3-4adb-4bdf-8786-4758b057ea15`.
- D1: `barrio24-reports-staging`.
- D1 ID: `eca7ac80-6859-40d5-89db-ba1bb6c61173`.
- Pages: `https://feature-02-rapid-report.barrio24-staging.pages.dev`.
- Cron remoto: `0 5 * * *`, confirmado manualmente en Cloudflare.
- Rate Limit namespace: `2026081401`.
- Access path: `/v1/ops/*`.

Pages no fue redesplegado durante el cierre. Producción, `main`, migraciones y configuración de Access no fueron modificados. `REPORTS_OPERATIONS_TOKEN` no existe y no fue creado.

## Evidencia de cierre F4

### Código / tooling

- `npm ci`: PASS, 0 vulnerabilidades.
- `npm run check`: PASS.
- readiness read-only: PASS.
- Wrangler deploy dry-run: PASS.
- Wrangler startup check: PASS.

### D1

- migraciones `0001`–`0004`: consistentes;
- schema remoto read-only: PASS;
- tablas, columnas e índices esperados: PASS.

### Deploy / API pública

- deploy solo del Worker staging: PASS;
- public smoke: PASS;
- public abuse: PASS;
- evidence summary P0: `COMPLETE`.

### Access / moderación / auditoría

- consola autenticada: `200`;
- `verify`, `resolve`, `mark-duplicate`, `expire`: PASS;
- errores 4xx esperados: PASS;
- replay idempotente: PASS;
- `idempotency_conflict`: PASS;
- concurrencia: PASS;
- historial operativo: PASS;
- superficie ops sin CORS desde Pages: PASS.

### Carga P1

Rate-limit: `15/15`, p50 `262.71 ms`, p95 `553.64 ms`.

Burst: `20/20`, p50 `279.48 ms`, p95 `496.54 ms`.

Evidence summary P1: `COMPLETE`.

Decisiones vigentes:
- Queue: no por ahora;
- Turnstile: no por ahora.

### Seguridad / headers / secretos

- headers Pages: PASS;
- CSP Pages: PASS;
- headers ops: PASS;
- sin `Access-Control-Allow-Origin` en consola ops: PASS;
- artifacts sin JWT/cookies/Bearer/CF_API_TOKEN expuestos: PASS;
- `unsafe-inline` de consola queda como hardening de F7.

### Retención / cron

- test dedicada retención reportes 30 días: PASS;
- test dedicada auditoría 180 días: PASS;
- fronteras exactas preservadas: PASS;
- fail-closed de limpieza: PASS;
- cron remoto `0 5 * * *`: confirmado.

## Gap de evidencia no bloqueante

Una consulta D1 directa posterior a moderación no pudo repetirse por autenticación Wrangler (`API error 10000/9106`). Queda pendiente reconfirmar directamente `last_moderation_event_id`, `report_moderation_events` e `idempotency_key` cuando existan credenciales Wrangler autorizadas.

Este gap no reabre F4 porque schema, historial, idempotencia y concurrencia remotos ya validaron el comportamiento esperado.

## Qué sigue

1. F5 Ruta Alta puede avanzar en preparación de entrada.
2. Antes de empaquetar/publicar mapas, al menos una fuente debe cumplir `packagingEligible=true`.
3. Esto exige licencia de redistribución offline verificada, permiso de transformación/empaquetado, bytes/hash, CRS, vigencia y revisión humana.
4. QA físico, accesibilidad, observabilidad y hardening final permanecen para F7/piloto.

## Producción

**NO-GO.**

No existe autorización productiva hasta completar las puertas posteriores del roadmap y recibir una decisión GO explícita.
