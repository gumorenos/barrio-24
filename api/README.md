# Barrio 24 Reports API — staging

Este Worker recibe reportes mínimos de la PWA en un entorno de staging. No existe feed público. La moderación operativa de staging está protegida por Cloudflare Access; `unverified` significa recibido, no confirmado.

## Incluye

- `GET /api/health`.
- `POST /v1/reports`.
- Validación de esquema y payload máximo de 2 KB.
- Celdas geográficas aproximadas; no acepta coordenadas exactas.
- Inserción idempotente por `event_id`.
- Estado inicial `unverified`, que significa recibido pero no verificado.
- Consola same-origin en `GET /v1/ops/`, protegida por Cloudflare Access y no enlazada desde la PWA.
- Consulta operativa en `GET /v1/ops/reports`, protegida por JWT de Cloudflare Access y allowlist de operadores.
- Resumen agregado en `GET /v1/ops/summary`, con total, estados y fecha más reciente; no devuelve reportes individuales ni ubicaciones.
- Historial de auditoría en `GET /v1/ops/reports/:event_id/history`, limitado a operadores autorizados y a 100 eventos recientes.
- Decisiones en `POST /v1/ops/reports/:event_id/decision`, con acción, estado esperado, motivo obligatorio e idempotencia.
- Auditoría D1 para cada cambio, con retención separada de 180 días.
- Las rutas operativas no tienen CORS; el API público de reportes conserva su CORS restringible mediante `ALLOWED_ORIGIN`.
- Si `ALLOWED_ORIGIN` no está configurado, los navegadores reciben `403` en vez de acceso abierto accidental.
- Migraciones D1 `0001_reports.sql`, `0002_unverified_reports.sql`, `0003_operations_read_idx.sql` y `0004_moderation_audit.sql`.
- Límite inicial configurado de 10 solicitudes por cliente por ventana de 60 segundos mediante Rate Limiting de Cloudflare. Es una protección gruesa y eventualmente consistente, no una cuota estricta ni la única defensa contra abuso.
- Si el binding de Rate Limiting no responde, el API devuelve `503` y el cliente puede conservar el reporte para reintento.
- Eliminación programada de reportes con más de 30 días.

## Estado de staging y pendientes antes de conectar usuarios

- Staging tiene una aplicación de Cloudflare Access únicamente para `/v1/ops/*`, con allowlist de `gumorenos@gmail.com`; los valores de Access permanecen fuera de Git.
- La migración `0004_moderation_audit.sql` se conoce aplicada en el entorno remoto, pero el candidato actual debe volver a verificar formalmente migraciones y esquema antes de cerrar Fase 4.
- Completar QA remoto de JWT, allowlist, decisiones, idempotencia, concurrencia y auditoría.
- Ejecutar pruebas reproducibles de carga y abuso; decidir Queue/Turnstile por evidencia, no por arquitectura anticipada.
- Completar QA físico de sincronización en dispositivos objetivo.
- Conectar usuarios reales solo después de una revisión de seguridad y privacidad y de superar las puertas del roadmap.

## Configuración reproducible de staging

`api/wrangler.toml` ya no debe prepararse manualmente. Está ignorado por Git y se genera a partir de un inventario de staging explícito y validado.

1. Copiar `api/staging-config.env.example` a `api/staging-config.env`.
2. Obtener del Worker/cuenta existente el `BARRIO24_STAGING_RATE_LIMIT_NAMESPACE_ID` real. No inventarlo ni reutilizar el de otro Worker.
3. Ejecutar:

```bash
npm run staging:config
```

El generador falla si cuenta, Worker, D1, origen Pages o cron no coinciden exactamente con el entorno autorizado de staging. También elimina un `api/wrangler.toml` anterior si la validación falla, evitando usar una configuración stale.

Las variables `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` y `ACCESS_OPERATOR_EMAILS` continúan configuradas fuera de Git en el Worker. `REPORTS_OPERATIONS_TOKEN` no forma parte del diseño y no debe crearse.

`api/wrangler.toml.example` es solo una referencia de forma; el archivo que se usa para checks debe ser el generado.

## Checks de staging

Los comandos siguientes son fail-closed y no autorizan producción:

```bash
npm run test:staging-tools
npm run staging:dry-run
npm run staging:startup-check
```

La suite read-only encadena identificación exacta del commit/rama/worktree, checks del repo, Wrangler, migraciones y esquema D1 sin aplicar migraciones ni desplegar:

```bash
npm run staging:readiness-readonly -- --execute --expected-sha=<SHA-CANDIDATO>
```

El schema check remoto utiliza solo `SELECT`/`PRAGMA` y exige que Wrangler reporte cero escrituras:

```bash
npm run staging:d1-schema-check -- --execute --expected-sha=<SHA-CANDIDATO>
```

Los probes que generan tráfico son dry-run por defecto y requieren explícitamente `--execute --expected-sha=<SHA-CANDIDATO>`:

```bash
npm run staging:public-smoke -- --execute --expected-sha=<SHA-CANDIDATO>
npm run staging:public-abuse -- --execute --expected-sha=<SHA-CANDIDATO>
npm run staging:controlled-load -- --profile=rate-limit --execute --expected-sha=<SHA-CANDIDATO>
npm run staging:controlled-load -- --profile=burst --execute --expected-sha=<SHA-CANDIDATO>
```

La evidencia queda bajo `artifacts/staging-readiness/`, ignorado por Git. La completitud automatizada para un único SHA se comprueba con:

```bash
npm run staging:evidence-summary -- --expected-sha=<SHA-CANDIDATO>
npm run staging:evidence-summary -- --expected-sha=<SHA-CANDIDATO> --level=p1
```

`COMPLETE` significa únicamente que están presentes las evidencias automatizadas requeridas. No sustituye QA interactivo de Access/moderación, revisión de seguridad/privacidad ni autorización de producción.

El detalle de puertas y condiciones de parada está en `docs/operations/rapid-report-production-readiness.md`.

## Consulta operativa de staging

Los endpoints de operaciones no forman parte de la PWA ni del feed público. Se habilitan únicamente cuando el Worker valida un JWT de Cloudflare Access y el correo del JWT está en `ACCESS_OPERATOR_EMAILS`. Si la configuración falta, las rutas responden `404`; si el JWT falta o es inválido, responden `403`.

`GET /v1/ops/` sirve una consola HTML same-origin para operadores. La consola carga el resumen y los reportes desde el mismo Worker, permite filtrar por estado y presenta únicamente las decisiones ya autorizadas por el contrato. No se enlaza desde el home ni convierte los reportes en un feed público.

La aplicación de Access cubre solo `/v1/ops/*`, no todo el Worker: `POST /v1/reports` sigue siendo el endpoint público de staging. El Worker valida además `Cf-Access-Jwt-Assertion` con el dominio de equipo y el AUD de la aplicación.

```bash
# Valores fuera de Git, en la configuración autorizada del Worker:
ACCESS_TEAM_DOMAIN=https://tu-equipo.cloudflareaccess.com
ACCESS_AUDIENCE=audience-tag-de-la-aplicacion
ACCESS_OPERATOR_EMAILS=tu-correo@example.com
```

La consulta debe ejecutarse desde una sesión o canal autorizado por Cloudflare Access y devuelve como máximo 100 filas por página. No se usa un Bearer token estático ni se guarda un JWT en el repositorio:

```bash
curl "https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/reports?status=unverified&limit=50"
```

La sesión autenticada por Access debe acompañar la consulta. La respuesta incluye `next_cursor` cuando hay más resultados. El cursor se puede enviar como `cursor` en la siguiente consulta.

El historial de un reporte se consulta con:

```bash
curl "https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/reports/EVENT-ID/history"
```

Incluye únicamente cambios de moderación auditados: actor, transición, motivo, fecha y los identificadores de correlación. No incluye texto del ciudadano, datos médicos ni coordenadas exactas.

El resumen agregado se consulta así:

```bash
curl "https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/summary"
```

Para decidir un reporte:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: UUID-V4-UNICO" \
  "https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/reports/EVENT-ID/decision" \
  --data '{"action":"verify","expected_status":"unverified","reason":"Confirmado mediante revisión operativa"}'
```

Las acciones disponibles son `verify`, `mark-duplicate`, `resolve` y `expire`. Solo deben ejecutarse con datos sintéticos hasta completar la revisión de seguridad, las pruebas de abuso y el piloto controlado.
