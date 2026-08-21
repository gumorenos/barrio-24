# Barrio 24 Reports API — staging

Este Worker recibe reportes mínimos de la PWA en un entorno de staging. No existe feed público. La moderación operativa de staging está protegida por Cloudflare Access; `unverified` significa recibido, no confirmado.

## Incluye

- `GET /api/health`.
- `POST /v1/reports`.
- Validación de esquema y payload máximo de 2 KB.
- Celdas geográficas aproximadas; no acepta coordenadas exactas.
- Inserción idempotente por `event_id`.
- Estado inicial `unverified`, que significa recibido pero no verificado.
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

- Revisar el contrato con el dueño del producto.
- Staging ya tiene una aplicación de Cloudflare Access para `/v1/ops/*`, con allowlist de `gumorenos@gmail.com`; los valores de Access permanecen fuera de Git.
- Staging ya tiene aplicada la migración `0004_moderation_audit.sql` y desplegado el Worker desde el commit `0f1a4b4cc76ea10eb84676f438dbfbc7eb0b39e3`.
- Completar QA remoto de JWT, allowlist, decisiones, idempotencia, concurrencia y auditoría.
- Definir si la persistencia inicial seguirá siendo directa o pasará a Queue.
- Ejecutar pruebas de carga y abuso controlado; el Rate Limiting nativo es una barrera gruesa y no una cuota global estricta.
- Completar QA físico de sincronización en dispositivos; Chromium y la geolocalización manual en Arc Search para iPhone ya fueron validados.
- Conectar usuarios reales solo después de una revisión de seguridad y privacidad.

## Configuración del repositorio

La configuración real de staging se mantiene fuera del repositorio para no publicar identificadores ni credenciales. `wrangler.toml.example` documenta los bindings requeridos; cualquier despliegue debe usar un archivo local autorizado, aplicar las migraciones y confirmar que el origen permitido corresponde al preview activo.

## Consulta operativa de staging

Los endpoints de operaciones no forman parte de la PWA ni del feed público. Se habilitan únicamente cuando el Worker valida un JWT de Cloudflare Access y el correo del JWT está en `ACCESS_OPERATOR_EMAILS`. Si la configuración falta, las rutas responden `404`; si el JWT falta o es inválido, responden `403`.

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
