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
- Si `ALLOWED_ORIGIN` no está configurado, los navegadores reciben `403` en vez de acceso abierto accidental.
- Migraciones D1 `0001_reports.sql` y `0002_unverified_reports.sql`.
- Límite inicial configurado de 10 solicitudes por cliente por ventana de 60 segundos mediante Rate Limiting de Cloudflare. Es una protección gruesa y eventualmente consistente, no una cuota estricta ni la única defensa contra abuso.
- Si el binding de Rate Limiting no responde, el API devuelve `503` y el cliente puede conservar el reporte para reintento.
- Eliminación programada de reportes con más de 30 días.

## Aún falta antes de conectar usuarios

- Revisar el contrato con el dueño del producto.
- Definir moderación operativa y eventual feed público.
- Decidir si la persistencia inicial seguirá siendo directa o pasará a Queue.
- Ejecutar pruebas de carga y abuso controlado; el Rate Limiting nativo es una barrera gruesa y no una cuota global estricta.
- Completar QA físico de sincronización en dispositivos; Chromium y la geolocalización manual en Arc Search para iPhone ya fueron validados.
- Conectar usuarios reales solo después de una revisión de seguridad y privacidad.

## Configuración del repositorio

La configuración real de staging se mantiene fuera del repositorio para no publicar identificadores ni credenciales. `wrangler.toml.example` documenta los bindings requeridos; cualquier despliegue debe usar un archivo local autorizado, aplicar las migraciones y confirmar que el origen permitido corresponde al preview activo.
