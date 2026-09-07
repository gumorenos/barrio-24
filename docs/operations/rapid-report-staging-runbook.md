# Runbook de staging — Reporte 60 segundos

Actualizado: 2026-08-25 America/Lima.

Este runbook describe el entorno de staging. No contiene secretos, JWT, cookies ni datos ciudadanos reales. El detalle de puertas de Fase 4 y el veredicto vigente están en `docs/operations/rapid-report-production-readiness.md`.

## Inventario conocido

| Recurso | Valor |
|---|---|
| Rama funcional desplegada conocida | `feature/02-rapid-report` |
| Base remota conocida | `012f3ff7c69609f2863c5111efa6a6127da1f932` |
| Rama candidata/readiness | `feature/f4-readiness-f5-prep` |
| Pages | `https://feature-02-rapid-report.barrio24-staging.pages.dev` |
| Worker | `barrio24-reports-api-staging` |
| Worker URL | `https://barrio24-reports-api-staging.gumorenos.workers.dev` |
| Worker Version ID conocido antes del nuevo candidato | `946d3cea-9f88-415c-9656-00e0fa5431df` |
| D1 | `barrio24-reports-staging` |
| D1 ID | `eca7ac80-6859-40d5-89db-ba1bb6c61173` |
| Cron | `0 5 * * *` |
| Access path | `/v1/ops/*` |
| Access allowlist | `gumorenos@gmail.com` |
| Migraciones esperadas | `0001`–`0004` |

La rama candidata no debe describirse como desplegada hasta registrar un nuevo Version ID. Producción permanece fuera de alcance.

## Superficie pública

```text
GET  /api/health
POST /v1/reports
```

`POST /v1/reports` guarda un reporte aceptado como `unverified`; `202` no significa verificado ni atendido.

## Superficie operativa

Estas rutas requieren Cloudflare Access y allowlist:

```text
GET  /v1/ops/
GET  /v1/ops/reports
GET  /v1/ops/summary
GET  /v1/ops/reports/:event_id/history
POST /v1/ops/reports/:event_id/decision
```

Consola:

```text
https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/
```

No guardar JWT, cookies o secretos en GitHub, logs compartidos o documentación.

## 1. Preparar el candidato

```bash
git fetch origin
git checkout feature/f4-readiness-f5-prep
git pull --ff-only
git status --short
export CANDIDATE_SHA="$(git rev-parse HEAD)"
printf 'Candidate: %s\n' "$CANDIDATE_SHA"
```

`git status --short` debe estar vacío.

Instalar y validar:

```bash
npm ci
npm run check
```

## 2. Preparar configuración reproducible

```bash
cp api/staging-config.env.example api/staging-config.env
```

Completar solo valores autorizados de staging. Debe obtenerse el `BARRIO24_STAGING_RATE_LIMIT_NAMESPACE_ID` real; no inventarlo.

Como ayuda para auditar la versión actualmente desplegada puede consultarse:

```bash
npx --yes --package=wrangler@4.125.0 wrangler versions view \
  946d3cea-9f88-415c-9656-00e0fa5431df \
  --name barrio24-reports-api-staging \
  --json
```

Si esa salida no permite confirmar el namespace, recuperarlo de la configuración autorizada que creó el binding. Un `namespace_id` debe ser un entero positivo representado como string y, salvo intención explícita de compartir contadores, único dentro de la cuenta.

Generar:

```bash
npm run staging:config
```

`api/wrangler.toml` y `api/staging-config.env` están ignorados por Git. El generador falla cerrado y elimina un `wrangler.toml` stale si la configuración no es válida.

`ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` y `ACCESS_OPERATOR_EMAILS` permanecen fuera del repositorio. `REPORTS_OPERATIONS_TOKEN` no forma parte del diseño.

## 3. Readiness no mutante

```bash
npm run staging:readiness-readonly -- \
  --execute \
  --expected-sha="$CANDIDATE_SHA"
```

La suite exige SHA, rama `feature/*`/`fix/*`, worktree limpio y ejecuta:

1. `npm run check`.
2. Wrangler deploy dry-run.
3. Wrangler startup check.
4. `wrangler d1 migrations list ... --remote`.
5. Check read-only de tablas, columnas e índices D1 `0001`–`0004`.

No aplica migraciones ni despliega. Evidencia: `artifacts/staging-readiness/`.

Si `migrations list` muestra algo, recordar que Cloudflare lista **migraciones no aplicadas**. No aplicar automáticamente; revisar primero por qué aparece y confirmar que pertenece a este candidato/staging.

## 4. Desplegar lo listo en staging

Este candidato no modifica el runtime frontend. **No redeployar Pages** para este despliegue; conservar el origen Pages existente evita cambiar CORS innecesariamente.

Solo si el readiness anterior termina PASS:

```bash
npx --yes --package=wrangler@4.125.0 wrangler deploy \
  --config api/wrangler.toml
```

`wrangler deploy` crea una nueva versión y la despliega. Registrar de inmediato el nuevo Version ID y asociarlo a `$CANDIDATE_SHA`.

No hay migraciones nuevas en este candidato respecto al esquema esperado `0001`–`0004`. Si, contra lo esperado, aparece una migración no aplicada, detener el deploy y resolverla por separado. Si finalmente corresponde aplicarla a staging, usar el nombre de la base para reducir riesgo de binding equivocado:

```bash
npx --yes --package=wrangler@4.125.0 wrangler d1 migrations apply \
  barrio24-reports-staging \
  --remote \
  --config api/wrangler.toml
```

Ese comando es mutante y requiere una decisión explícita; no forma parte del readiness.

## 5. QA automatizable post-deploy

```bash
npm run staging:public-smoke -- \
  --execute --expected-sha="$CANDIDATE_SHA"

npm run staging:public-abuse -- \
  --execute --expected-sha="$CANDIDATE_SHA"
```

El smoke puede crear como máximo un reporte sintético. El probe de abuso solo usa payloads deliberadamente inválidos.

Luego P1 controlado:

```bash
npm run staging:controlled-load -- \
  --profile=rate-limit --execute --expected-sha="$CANDIDATE_SHA"

npm run staging:controlled-load -- \
  --profile=burst --execute --expected-sha="$CANDIDATE_SHA"

npm run staging:evidence-summary -- \
  --expected-sha="$CANDIDATE_SHA" --level=p1
```

Los perfiles tienen límites duros: máximo 25 solicitudes y concurrencia 4. `COMPLETE` en evidencia automatizada no significa GO para producción.

## 6. QA interactivo

```text
GET /api/health                         -> 200
POST /v1/reports                        -> 202 unverified
GET /v1/ops/ sin sesión                 -> redirect/login de Access
GET /v1/ops/ con sesión                 -> HTML 200
GET /v1/ops/summary con sesión          -> 200
GET /v1/ops/reports con sesión          -> 200
```

Completar moderación, concurrencia, Access, dispositivos, privacidad y seguridad según `docs/qa/rapid-report-moderation-pending.md`.

## Condiciones de parada

Mantener NO-GO si:

- `HEAD` no coincide con el SHA candidato;
- rama `main`, detached o worktree sucio;
- configuración apunta a otra cuenta, Worker, D1, Pages o cron;
- namespace de Rate Limiting no puede verificarse;
- dry-run/startup no concluyen;
- migraciones/esquema no coinciden con `0001`–`0004`;
- Access deja de proteger únicamente `/v1/ops/*`;
- `POST /v1/reports` deja de ser público en staging;
- aparecen coordenadas exactas, datos médicos o texto libre inesperado;
- se solicita `REPORTS_OPERATIONS_TOKEN`;
- se requieren datos reales;
- se pretende tocar `main` o producción sin autorización explícita.
