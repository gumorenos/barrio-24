# Barrio 24 Reports API — staging

Este Worker recibe reportes mínimos de la PWA en un entorno de staging. No existe feed público ni moderación operativa todavía; `unverified` significa recibido, no confirmado.

## Incluye

- `GET /api/health`.
- `POST /v1/reports`.
- Validación de esquema y payload máximo de 2 KB.
- Celdas geográficas aproximadas; no acepta coordenadas exactas.
- Inserción idempotente por `event_id`.
- Estado inicial `unverified`, que significa recibido pero no verificado.
- Consulta operativa de solo lectura en `GET /v1/ops/reports`, protegida por un secreto Bearer y desactivada si el secreto no está configurado.
- Resumen agregado en `GET /v1/ops/summary`, con total, estados y fecha más reciente; no devuelve reportes individuales ni ubicaciones.
- Contrato de estados y transiciones futuras documentado en `docs/product/rapid-report-moderation.md`; no hay mutaciones activas.
- La consulta operativa devuelve solo campos del contrato ciudadano, permite filtrar por estado y pagina con cursor; no tiene CORS ni endpoints de mutación.
- CORS restringible mediante `ALLOWED_ORIGIN`.
- Si `ALLOWED_ORIGIN` no está configurado, los navegadores reciben `403` en vez de acceso abierto accidental.
- Migraciones D1 `0001_reports.sql`, `0002_unverified_reports.sql` y `0003_operations_read_idx.sql`.
- Límite inicial configurado de 10 solicitudes por cliente por ventana de 60 segundos mediante Rate Limiting de Cloudflare. Es una protección gruesa y eventualmente consistente, no una cuota estricta ni la única defensa contra abuso.
- Si el binding de Rate Limiting no responde, el API devuelve `503` y el cliente puede conservar el reporte para reintento.
- Eliminación programada de reportes con más de 30 días.

## Aún falta antes de conectar usuarios

- Revisar el contrato con el dueño del producto.
- Definir roles, autenticación fuerte, auditoría y moderación operativa; la consulta actual es deliberadamente solo lectura.
- Definir si la persistencia inicial seguirá siendo directa o pasará a Queue.
- Ejecutar pruebas de carga y abuso controlado; el Rate Limiting nativo es una barrera gruesa y no una cuota global estricta.
- Completar QA físico de sincronización en dispositivos; Chromium y la geolocalización manual en Arc Search para iPhone ya fueron validados.
- Conectar usuarios reales solo después de una revisión de seguridad y privacidad.

## Configuración del repositorio

La configuración real de staging se mantiene fuera del repositorio para no publicar identificadores ni credenciales. `wrangler.toml.example` documenta los bindings requeridos; cualquier despliegue debe usar un archivo local autorizado, aplicar las migraciones y confirmar que el origen permitido corresponde al preview activo.

## Consulta operativa de staging

Los endpoints de operaciones no forman parte de la PWA ni del feed público. Solo se habilitan cuando el Worker tiene el secreto `REPORTS_OPERATIONS_TOKEN` con al menos 32 caracteres; nunca se debe escribir ese valor en Git, en `wrangler.toml` ni en un prompt compartido. Si falta el secreto o es demasiado corto, las rutas responden `404`.

Para configurarlo en el entorno autorizado:

```bash
wrangler secret put REPORTS_OPERATIONS_TOKEN --config /ruta/al/wrangler-staging.toml
```

La consulta usa un Bearer token y devuelve como máximo 100 filas por página:

```bash
curl -H "Authorization: Bearer $REPORTS_OPERATIONS_TOKEN" \
  "https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/reports?status=unverified&limit=50"
```

La respuesta incluye `next_cursor` cuando hay más resultados. El cursor se puede enviar como `cursor` en la siguiente consulta. Por ahora no existen `PATCH`, `POST` ni `DELETE` operativos: cambiar estados sin roles y auditoría sería inseguro.

El resumen agregado se consulta así:

```bash
curl -H "Authorization: Bearer $REPORTS_OPERATIONS_TOKEN" \
  "https://barrio24-reports-api-staging.gumorenos.workers.dev/v1/ops/summary"
```
