# Runbook de staging — Reporte 60 segundos

Actualizado: 2026-08-20 America/Lima.

Este runbook describe el entorno de staging. No contiene secretos, JWT, audiences ni datos ciudadanos reales.

## Inventario

| Recurso | Valor |
|---|---|
| Rama | `feature/02-rapid-report` |
| Commit desplegado | `0f1a4b4cc76ea10eb84676f438dbfbc7eb0b39e3` |
| Pages | `https://feature-02-rapid-report.barrio24-staging.pages.dev` |
| Worker | `barrio24-reports-api-staging` |
| Worker URL | `https://barrio24-reports-api-staging.gumorenos.workers.dev` |
| Worker Version ID | `fb8de037-70e3-4b20-a2f0-acf46e61ae81` |
| D1 | `barrio24-reports-staging` |
| D1 ID | `eca7ac80-6859-40d5-89db-ba1bb6c61173` |
| Cron | `0 5 * * *` |
| Access path | `/v1/ops/*` |
| Access allowlist | `gumorenos@gmail.com` |
| Migración | `api/migrations/0004_moderation_audit.sql` |

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

Usar `gumorenos@gmail.com` con el método configurado en Access. No pegar tokens estáticos, JWT ni secretos en Telegram, GitHub o el repositorio.

## Procedimiento de despliegue staging

1. Verificar que el commit candidato existe y que el worktree está limpio.
2. Ejecutar `npm ci`, `npm run check`, `wrangler deploy --dry-run` y `wrangler check startup`.
3. Confirmar que la configuración apunta solo al Worker y D1 de staging.
4. Aplicar únicamente migraciones nuevas a `barrio24-reports-staging`, si corresponde.
5. Desplegar únicamente el Worker staging.
6. Guardar el Version ID y actualizar este runbook si cambia el candidato.
7. Ejecutar smoke público y QA autenticado con datos sintéticos.
8. Confirmar que `main`, producción, Pages y `REPORTS_OPERATIONS_TOKEN` no fueron tocados.

Las variables `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` y `ACCESS_OPERATOR_EMAILS` se mantienen fuera de Git. `REPORTS_OPERATIONS_TOKEN` no forma parte del diseño.

## Smoke mínimo

```text
GET /api/health                         -> 200
POST /v1/reports                        -> 202 unverified
GET /v1/ops/                          sin sesión -> redirect/login de Access
GET /v1/ops/                          con sesión -> HTML 200
GET /v1/ops/summary sin sesión         -> redirect/login de Access
GET /v1/ops/summary con sesión         -> 200
GET /v1/ops/reports con sesión         -> 200
```

La batería completa de moderación, idempotencia, concurrencia, retención, abuso y QA físico está en:

```text
docs/qa/rapid-report-moderation-pending.md
```

## Condiciones de parada

Detener el despliegue y reportar si ocurre cualquiera de estas condiciones:

- El commit candidato no existe o el worktree tiene cambios no explicados.
- El deploy apunta a `main`, producción, otra cuenta, otro Worker o D1.
- Access deja de proteger únicamente `/v1/ops/*`.
- `POST /v1/reports` deja de ser público en staging.
- Aparecen coordenadas exactas, datos médicos o texto libre en el payload, D1 o respuestas.
- Se solicita configurar `REPORTS_OPERATIONS_TOKEN`.
- El QA requiere datos reales o una nueva aplicación Access.
