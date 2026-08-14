# Barrio 24 Reports API — staging

Este Worker recibe reportes mínimos de la PWA en un entorno de staging. No existe feed público y la moderación operativa queda desactivada hasta configurar Cloudflare Access; `unverified` significa recibido, no confirmado.

## Incluye

- `GET /api/health`.
- `POST /v1/reports`.
- Validación de esquema y payload máximo de 2 KB.
- Celdas geográficas aproximadas; no acepta coordenadas exactas.
- Inserción idempotente por `event_id`.
- Estado inicial `unverified`, que significa recibido pero no verificado.
- Consulta operativa en `GET /v1/ops/reports`, protegida por JWT de Cloudflare Access y allowlist de operadores.
- Resumen agregado en `GET /v1/ops/summary`, con total, estados y fecha más reciente; no devuelve reportes individuales ni ubicaciones.
- Decisiones en `POST /v1/ops/reports/:event_id/decision`, con acción, estado esperado, motivo obligatorio e idempotencia.
- Auditoría D1 para cada cambio, con retención separada de 180 días.
- Las rutas operativas no tienen CORS; el API público de reportes conserva su CORS restringible mediante `ALLOWED_ORIGIN`.
- Si `ALLOWED_ORIGIN` no está configurado, los navegadores reciben `403` en vez de acceso abierto accidental.
- Migraciones D1 `0001_reports.sql`, `0002_unverified_reports.sql`, `0003_operations_read_idx.sql` y `0004_moderation_audit.sql`.
- Límite inicial configurado de 10 solicitudes por cliente por ventana de 60 segundos mediante Rate Limiting de Cloudflare. Es una protección gruesa y eventualmente consistente, no una cuota estricta ni la única defensa contra abuso.
- Si el binding de Rate Limiting no responde, el API devuelve `503` y el cliente puede conservar el reporte para reintento.
- Eliminación programada de reportes con más de 30 días.

## Aún falta antes de conectar usuarios

- Revisar el contrato con el dueño del producto.
- Crear la aplicación de Cloudflare Access para `/v1/ops/*`, configurar su política de allow y publicar `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` y `ACCESS_OPERATOR_EMAILS` fuera de Git.
- Completar QA remoto de JWT, allowlist, decisiones, idempotencia, concurrencia y auditoría.
- Definir si la persistencia inicial seguirá siendo directa o pasará a Queue.
- Ejecutar pruebas de carga y abuso controlado; el Rate Limiting nativo es una barrera gruesa y no una cuota global estricta.
- Completar QA físico de sincronización en dispositivos; Chromium y la geolocalización manual en Arc Search para iPhone ya fueron validados.
- Conectar usuarios reales solo después de una revisión de seguridad y privacidad.

## Configuración del repositorio

La configuración real de staging se mantiene fuera del repositorio para no publicar identificadores ni credenciales. `wrangler.toml.example` documenta los bindings requeridos; cualquier despliegue debe usar un archivo local autorizado, aplicar las migraciones y confirmar que el origen permitido corresponde al preview activo.

## Consulta operativa de staging

Los endpoints de operaciones no forman parte de la PWA ni del feed público. Se habilitan únicamente cuando el Worker valida un JWT de Cloudflare Access y el correo del JWT está en `ACCESS_OPERATOR_EMAILS`. Si la configuración falta, las rutas responden `404`; si el JWT falta o es inválido, responden `403`.

La aplicación de Access debe cubrir solo `/v1/ops/*`, no todo el Worker: `POST /v1/reports` sigue siendo el endpoint público de staging. El Worker valida además `Cf-Access-Jwt-Assertion` con el dominio de equipo y el AUD de la aplicación.

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

Las acciones disponibles son `verify`, `mark-duplicate`, `resolve` y `expire`. Nunca se deben ejecutar con datos reales hasta completar la revisión de seguridad y el QA remoto.
