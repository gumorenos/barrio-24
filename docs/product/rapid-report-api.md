# Contrato de staging para Reporte 60 segundos conectado

Este documento describe el contrato mínimo implementado en el Worker de staging. No define todavía un producto público ni un panel de moderación.

## Principios

- El cliente puede estar offline y reenviar el mismo evento varias veces.
- El servidor debe tratar `event_id` como clave de idempotencia por emisor.
- Una respuesta de aceptación no significa que el reporte esté verificado.
- La ubicación recibida ya debe ser una celda aproximada; el API no debe aceptar coordenadas exactas del cliente.
- El contenido público debe ser agregado o redondeado nuevamente según riesgo y densidad.
- Ningún reporte ciudadano debe presentarse como información oficial.
- El Rate Limiting nativo de Cloudflare es una primera barrera de abuso, pero no debe tratarse como una cuota global estricta.
- Los controles locales de exportación y borrado no modifican registros remotos; el servidor conserva su propia política de retención.

## Flujo propuesto

```text
PWA local
  -> POST /v1/reports
  -> validación rápida + límite de abuso
  -> 202 Accepted si el evento es válido
  -> D1 con estado unverified
  -> Queue opcional en una revisión posterior
```

## Payload mínimo propuesto

```json
{
  "event_id": "uuid-generado-en-el-dispositivo",
  "schema_version": 1,
  "category": "blocked-street",
  "severity": "attention",
  "location_cell": "-12.10,-77.03",
  "observed_at": "2026-08-13T00:00:00.000Z"
}
```

El servidor no debe aceptar nombre, teléfono, DNI, texto libre, fotografías ni coordenadas exactas en el primer contrato.

## Respuestas

- `202 Accepted`: evento válido y recibido para procesamiento; no implica verificación.
- `400 Bad Request`: esquema o categoría inválida.
- `409 Conflict`: el mismo `event_id` ya fue procesado; debe ser una respuesta segura para reintentos.
- `429 Too Many Requests`: límite temporal alcanzado; el cliente conserva el evento local.
- `503 Service Unavailable`: almacenamiento o Rate Limiting no disponible; el cliente conserva el evento local para reintento manual.

El cliente impone un timeout nominal de 11,5 segundos por solicitud para mantener margen frente al scheduling del navegador y no superar 12 segundos observados externamente. Ante `429`, `503`, timeout o error de red detiene la ráfaga para no empeorar el abuso o la saturación; el evento que falló y los siguientes permanecen locales para un reintento manual. La respuesta `Retry-After`, cuando existe, se muestra al usuario.

## Consulta operativa de staging

Existe una ruta de lectura interna para inspeccionar el estado de los reportes recibidos sin crear todavía un feed público ni una pantalla de moderación:

```text
GET /v1/ops/reports?status=unverified&limit=50&cursor=...
Authorization: Bearer <REPORTS_OPERATIONS_TOKEN>
```

- El secreto se configura fuera de Git mediante un secreto del Worker. Si no existe, la ruta queda desactivada y responde `404`.
- La ruta no habilita CORS y no se integra en la PWA.
- Devuelve únicamente los campos mínimos ya aceptados por el contrato ciudadano: `event_id`, categoría, gravedad, celda aproximada, fechas y estado.
- `limit` está acotado a 100 y la paginación usa un cursor estable por `received_at` y `event_id`.
- Los errores de autenticación no revelan datos; los fallos de D1 responden `503`.
- No hay mutaciones operativas. Los cambios a `verified`, `duplicate` o `resolved` quedan pendientes de definir con roles, auditoría y autenticación fuerte.

También existe `GET /v1/ops/summary` con el total de reportes, distribución por estado, última recepción y días de retención. Es una respuesta agregada: no incluye eventos ni celdas geográficas.

Las transiciones previstas y los requisitos de auditoría están documentados en [`rapid-report-moderation.md`](./rapid-report-moderation.md), pero todavía no están expuestos como mutaciones del Worker.

## Estado del reporte

Los estados deben mantenerse separados:

1. `local-only`: solo existe en el dispositivo.
2. `pending`: el cliente está intentando enviarlo.
3. `unverified`: guardado por el API, pero no revisado por una fuente autorizada.
4. `duplicate`: agrupado con otro evento, sin borrar el original sin auditoría.
5. `verified`: revisado según un procedimiento documentado.
6. `resolved`: la necesidad fue marcada como atendida por un rol autorizado.
7. `expired`: dejó de ser operativo por retención o antigüedad.

## Revisión pendiente antes de usuarios reales

- Estrategia de identidad del dispositivo y límites por IP, evento y huella no invasiva.
- Protección contra reenvío malicioso de `event_id`.
- Protección adicional contra abuso si el servicio se abre a usuarios reales; el límite nativo puede ser permisivo y variar por ubicación de borde.
- Ventana de deduplicación por categoría, celda y tiempo.
- Retención, borrado y exportación.
- Política de exposición pública para celdas con pocos reportes.
- Turnstile/WAF y comportamiento cuando el proveedor esté saturado.
- Auditoría de moderación sin guardar datos médicos o PII innecesaria.
- Pruebas de carga y de recuperación con colas duplicadas.

El Worker de `api/` y D1 están desplegados en staging. La aplicación solo muestra el botón de sincronización cuando existe `VITE_REPORTS_API_URL`; el envío es manual y no se habilita por defecto. Smoke tests remotos confirmaron el Rate Limiting, el cron de retención, el origen del preview y el contrato de sincronización; todavía falta probar carga/abuso y completar QA físico de sincronización.
