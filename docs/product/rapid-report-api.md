# Contrato pendiente para Reporte 60 segundos conectado

Este documento no describe una API implementada. Es el límite de diseño que debe revisarse antes de conectar el formulario local a Cloudflare.

## Principios

- El cliente puede estar offline y reenviar el mismo evento varias veces.
- El servidor debe tratar `event_id` como clave de idempotencia por emisor.
- Una respuesta de aceptación no significa que el reporte esté verificado.
- La ubicación recibida ya debe ser una celda aproximada; el API no debe aceptar coordenadas exactas del cliente.
- El contenido público debe ser agregado o redondeado nuevamente según riesgo y densidad.
- Ningún reporte ciudadano debe presentarse como información oficial.

## Flujo propuesto

```text
PWA local
  -> POST /v1/reports
  -> validación rápida + límite de abuso
  -> 202 Accepted si el evento es válido
  -> D1 con estado received/unverified
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
- `503 Service Unavailable`: el cliente conserva el evento local y reintenta con backoff.

## Estado del reporte

Los estados deben mantenerse separados:

1. `local-only`: solo existe en el dispositivo.
2. `received`: el API aceptó el evento.
3. `unverified`: guardado, pero no revisado por una fuente autorizada.
4. `duplicate`: agrupado con otro evento, sin borrar el original sin auditoría.
5. `verified`: revisado según un procedimiento documentado.
6. `resolved`: la necesidad fue marcada como atendida por un rol autorizado.
7. `expired`: dejó de ser operativo por retención o antigüedad.

## Revisión obligatoria antes de implementar

- Estrategia de identidad del dispositivo y límites por IP, evento y huella no invasiva.
- Protección contra reenvío malicioso de `event_id`.
- Ventana de deduplicación por categoría, celda y tiempo.
- Retención, borrado y exportación.
- Política de exposición pública para celdas con pocos reportes.
- Turnstile/WAF y comportamiento cuando el proveedor esté saturado.
- Auditoría de moderación sin guardar datos médicos o PII innecesaria.
- Pruebas de carga y de recuperación con colas duplicadas.

El Worker de `api/` es solo un esqueleto de staging y todavía no está conectado a la aplicación. Hasta completar esa revisión, la aplicación debe conservar el estado `local-only` y no mostrar botones o mensajes que impliquen envío.
