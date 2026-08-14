# Moderación de Reporte 60 segundos

Este documento define la base de moderación para staging y para una futura operación controlada. Todavía no existe un endpoint que cambie estados ni un feed público.

## Estados y transiciones

Los reportes llegan como `unverified`: fueron recibidos por el API, pero ninguna fuente autorizada los ha revisado.

```text
unverified --verify----------> verified --resolve--> resolved
     |                            |                    |
     +--mark-duplicate--> duplicate                 expire
     |                            |                    |
     +----------expire------------+--------------------+
                                  v
                               expired
```

Reglas:

- `unverified` puede pasar a `verified`, `duplicate` o `expired`.
- `verified` puede pasar a `resolved` o `expired`.
- `duplicate` y `resolved` solo pueden pasar a `expired`.
- `expired` es terminal.
- No se permiten retrocesos ni cambios ambiguos sin una decisión explícita del dueño del producto y un mecanismo de corrección auditado.

La limpieza automática por retención puede llevar cualquier reporte antiguo a eliminación; `expired` describe el estado operativo antes de esa eliminación y no garantiza conservación indefinida.

## Auditoría mínima

Cada cambio futuro debe registrar, como mínimo:

- `event_id` del reporte;
- acción y estado anterior/nuevo;
- identificador del operador o servicio autorizado;
- motivo obligatorio y breve;
- fecha/hora UTC;
- `request_id` para correlacionar logs;
- resultado de la operación.

La auditoría no debe copiar texto libre ciudadano, datos médicos, coordenadas exactas ni credenciales. El `event_id` y la celda aproximada solo deben exponerse a operadores autorizados.

## Bloqueos antes de implementar mutaciones

La consulta interna actual (`/v1/ops/reports` y `/v1/ops/summary`) es solo lectura y queda desactivada si falta `REPORTS_OPERATIONS_TOKEN`. Antes de añadir `PATCH` o acciones equivalentes todavía hay que decidir:

1. quiénes pueden verificar y resolver;
2. si se usará Cloudflare Access, identidad externa u otro proveedor;
3. cómo se rotan credenciales y se revocan operadores;
4. dónde se almacena la auditoría y cuánto tiempo;
5. cómo se resuelven dos decisiones concurrentes sobre el mismo reporte;
6. qué vista agregada puede hacerse pública y con qué umbral de densidad.

Hasta cerrar esas decisiones, cualquier ruta de mutación sería una superficie administrativa prematura.
