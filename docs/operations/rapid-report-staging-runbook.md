# Runbook de staging — Reporte 60 segundos

Actualizado: 2026-08-24 America/Lima.

Este runbook describe el entorno de staging. No contiene secretos, JWT, cookies ni datos ciudadanos reales. El detalle de puertas de Fase 4 y el veredicto vigente están en `docs/operations/rapid-report-production-readiness.md`.

## Inventario conocido

| Recurso | Valor |
|---|---|
| Rama funcional desplegada conocida | `feature/02-rapid-report` |
| Base remota conocida | `012f3ff7c69609f2863c5111efa6a6127da1f932` |
| Rama de preparación/readiness | `feature/f4-readiness-f5-prep` |
| Pages | `https://feature-02-rapid-report.barrio24-staging.pages.dev` |
| Worker | `barrio24-reports-api-staging` |
| Worker URL | `https://barrio24-reports-api-staging.gumorenos.workers.dev` |
| Worker Version ID conocido | `946d3cea-9f88-415c-9656-00e0fa5431df` |
| D1 | `barrio24-reports-staging` |
| D1 ID | `eca7ac80-6859-40d5-89db-ba1bb6c61173` |
| Cron | `0 5 * * *` |
| Access path | `/v1/ops/*` |
| Access allowlist | `gumorenos@gmail.com` |
| Migraciones esperadas | `0001`–`0004` |

La rama de readiness no debe describirse como desplegada hasta que exista evidencia de un despliegue autorizado. Producción permanece fuera de alcance.

## Superficie pública

Estas rutas no requieren Cloudflare Access:

```text
GET  /api/health
POST /v1/reports
```

`POST /v1/reports` solo acepta el payload mínimo documentado en `api/README.md`. El reporte se guarda como `unverified`; `202` no significa verificado ni atendido.

## Superficie operativa

Estas rutas requieren una sesión interactiva válida de Cloudflare Access y la allowlist del operador:

```text
GET  /v1/ops/
GET  /v1/ops/reports
GET  /v1/ops/summary
GET  /v1/ops/reports/:event_id/history
POST /v1/ops/reports/:event_id/decision
```

Para iniciar sesión, abrir en un navegador:

```text
https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/
```

Usar únicamente la identidad autorizada por Access. No pegar JWT, cookies o secretos en GitHub, logs compartidos o documentación.

## Preparar la configuración reproducible

1. Crear `api/staging-config.env` desde `api/staging-config.env.example`.
2. Confirmar el `BARRIO24_STAGING_RATE_LIMIT_NAMESPACE_ID` real del Worker/cuenta existentes; no inventarlo.
3. Ejecutar:

```bash
npm run staging:config
```

`api/wrangler.toml` está ignorado por Git y solo debe usarse si el generador termina correctamente. Un fallo elimina una configuración previa para evitar usar valores stale.

`ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` y `ACCESS_OPERATOR_EMAILS` permanecen fuera del repositorio. `REPORTS_OPERATIONS_TOKEN` no forma parte del diseño.

## Readiness antes de cualquier despliegue

Sobre un checkout limpio del SHA candidato, en una rama `feature/*` o `fix/*`:

```bash
npm ci
npm run staging:readiness-readonly -- --execute --expected-sha=<SHA-CANDIDATO>
```

La suite se detiene al primer fallo y ejecuta únicamente validaciones no mutantes:

1. SHA exacto de `HEAD`.
2. Rama segura y nombrada.
3. Worktree limpio.
4. `npm run check`.
5. Wrangler deploy **dry-run**.
6. Wrangler startup check.
7. `wrangler d1 migrations list ... --remote`.
8. Comprobación read-only de tablas, columnas e índices D1 de `0001`–`0004`.

No aplica migraciones y no ejecuta un deploy real. La evidencia JSON se guarda en `artifacts/staging-readiness/`, fuera de Git.

## QA público automatizable

Después de que readiness read-only pase para el mismo SHA:

```bash
npm run staging:public-smoke -- --execute --expected-sha=<SHA-CANDIDATO>
npm run staging:public-abuse -- --execute --expected-sha=<SHA-CANDIDATO>
```

El smoke puede crear como máximo un reporte sintético y valida health, CORS, recepción `202 unverified` e idempotencia básica. El probe de abuso envía únicamente payloads deliberadamente inválidos y exige su rechazo.

La evidencia P0 automatizable se resume con:

```bash
npm run staging:evidence-summary -- --expected-sha=<SHA-CANDIDATO>
```

`automatedStatus: COMPLETE` no sustituye Access interactivo, moderación/concurrencia, seguridad o privacidad.

## Carga controlada P1

Solo después de P0 automatizable y usando datos sintéticos:

```bash
npm run staging:controlled-load -- --profile=rate-limit --execute --expected-sha=<SHA-CANDIDATO>
npm run staging:controlled-load -- --profile=burst --execute --expected-sha=<SHA-CANDIDATO>
npm run staging:evidence-summary -- --expected-sha=<SHA-CANDIDATO> --level=p1
```

Los perfiles tienen límites duros (máximo 25 solicitudes y concurrencia 4). No convertirlos en herramientas de carga abierta ni interpretar el Rate Limiting eventualmente consistente como una cuota exacta.

## QA interactivo mínimo

```text
GET /api/health                         -> 200
POST /v1/reports                        -> 202 unverified
GET /v1/ops/ sin sesión                 -> redirect/login de Access
GET /v1/ops/ con sesión                 -> HTML 200
GET /v1/ops/summary sin sesión          -> redirect/login de Access
GET /v1/ops/summary con sesión          -> 200
GET /v1/ops/reports con sesión          -> 200
```

La batería completa de moderación, idempotencia, concurrencia, retención, abuso y QA físico está en `docs/qa/rapid-report-moderation-pending.md`.

## Despliegue staging

Un deploy real no forma parte del readiness automático. Solo ejecutar si existe autorización explícita para desplegar el candidato:

1. Confirmar evidencia P0 del SHA exacto.
2. Confirmar que no hay migraciones nuevas que requieran una decisión separada.
3. Confirmar que la configuración apunta exclusivamente a la cuenta/Worker/D1 de staging.
4. Desplegar únicamente el Worker de staging.
5. Registrar Version ID y SHA realmente desplegados.
6. Ejecutar smoke público y QA Access con datos sintéticos.
7. Confirmar que `main`, producción, Pages productivo y `REPORTS_OPERATIONS_TOKEN` no fueron tocados.

Aplicar migraciones requiere una decisión explícita independiente; nunca hacerlo como efecto lateral de un check.

## Condiciones de parada

Detenerse y mantener NO-GO si ocurre cualquiera de estas condiciones:

- `HEAD` no coincide con el SHA candidato.
- La rama es `main`, está detached o el worktree está sucio.
- La configuración apunta a otra cuenta, Worker, D1, origen Pages o cron.
- El namespace de Rate Limiting no puede verificarse.
- Wrangler dry-run/startup no termina de forma concluyente.
- Migraciones o esquema D1 no coinciden con `0001`–`0004`.
- Access deja de proteger únicamente `/v1/ops/*`.
- `POST /v1/reports` deja de ser público en staging.
- Aparecen coordenadas exactas, datos médicos o texto libre inesperado en payloads, D1 o respuestas.
- Se solicita configurar `REPORTS_OPERATIONS_TOKEN`.
- El QA requiere datos reales.
- Una validación de solo lectura exige aplicar migraciones o desplegar.
- Se pretende tocar `main` o producción sin autorización explícita.
