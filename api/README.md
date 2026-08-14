# Barrio 24 Reports API — staging

Este Worker recibe reportes mínimos de la PWA en un entorno de staging. No existe feed público ni moderación operativa todavía; `unverified` significa recibido, no confirmado.

## Incluye

- `GET /api/health`.
- `POST /v1/reports`.
- Validación de esquema y payload máximo de 2 KB.
- Celdas geográficas aproximadas; no acepta coordenadas exactas.
- Inserción idempotente por `event_id`.
- Estado inicial `unverified`, que significa recibido pero no verificado.
- CORS restringible mediante `ALLOWED_ORIGIN`.
- Migraciones D1 `0001_reports.sql` y `0002_unverified_reports.sql`.
- Límite inicial configurado de 10 solicitudes por cliente por ventana de 60 segundos mediante Rate Limiting de Cloudflare. Es una protección gruesa y eventualmente consistente, no una cuota estricta ni la única defensa contra abuso.
- Eliminación programada de reportes con más de 30 días.

## Aún falta antes de conectar usuarios

- Revisar el contrato con el dueño del producto.
- Validar Rate Limiting y el cron de retención en el Worker desplegado.
- Definir moderación operativa y eventual feed público.
- Decidir si la persistencia inicial seguirá siendo directa o pasará a Queue.
- Probar la sincronización manual desde la PWA en staging.
- Hacer QA en dispositivos físicos.
- Conectar usuarios reales solo después de una revisión de seguridad y privacidad.

## Configuración pendiente

Copiar `wrangler.toml.example` como configuración de staging, reemplazar el origen permitido, el `database_id` y el namespace de Rate Limiting, y ejecutar las migraciones desde un entorno autorizado. No se incluyen credenciales ni identificadores reales en el repositorio.
