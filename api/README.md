# Barrio 24 Reports API — draft

Este Worker es un esqueleto de staging. No está conectado a la PWA, no tiene un `wrangler.toml` real y no debe desplegarse hasta completar revisión, pruebas de integración y configuración de D1.

## Incluye

- `GET /api/health`.
- `POST /v1/reports`.
- Validación de esquema y payload máximo de 2 KB.
- Celdas geográficas aproximadas; no acepta coordenadas exactas.
- Inserción idempotente por `event_id`.
- Estado inicial `received`, que no significa `verified`.
- CORS restringible mediante `ALLOWED_ORIGIN`.
- Migración D1 inicial.

## Aún falta antes de staging

- Revisar el contrato con el dueño del producto.
- Añadir límites de frecuencia y protección contra abuso.
- Definir retención, expiración y moderación.
- Decidir si la persistencia inicial será directa o mediante Queue.
- Probar duplicados, payloads inválidos, CORS y recuperación de D1.
- Crear D1 de staging y completar el identificador real.
- Conectar el cliente solo después de probar el API.

## Configuración pendiente

Copiar `wrangler.toml.example` como configuración de staging, reemplazar el origen permitido y el `database_id`, y ejecutar la migración desde un entorno autorizado. No se incluyen credenciales ni identificadores reales en el repositorio.
