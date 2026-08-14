# Moderación de Reporte 60 segundos

Este documento define la base de moderación para staging y para una futura operación controlada. No existe un feed público. El Worker ya contiene las rutas de decisión, pero permanecen cerradas hasta configurar y validar Cloudflare Access en staging.

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

## Condiciones para habilitar mutaciones

Las rutas internas (`/v1/ops/reports`, `/v1/ops/summary` y `POST /v1/ops/reports/:event_id/decision`) fallan cerradas si falta la configuración de Access. Antes de habilitarlas en staging hay que verificar:

1. La aplicación de Access cubre solo `/v1/ops/*`; el endpoint ciudadano no queda detrás de Access.
2. El Worker valida la firma, issuer, audience y expiración de `Cf-Access-Jwt-Assertion`, además de una allowlist de correos fuera de Git.
3. La migración `0004_moderation_audit.sql` está aplicada únicamente en la D1 de staging.
4. El cambio de estado y la auditoría pasan el QA de concurrencia e idempotencia.
5. La retención de auditoría y la revocación de operadores están documentadas.

No se habilita un borrado administrativo, un feed público ni una vista de ubicación exacta. `REPORTS_OPERATIONS_TOKEN` queda fuera del diseño; la autorización administrativa depende de Cloudflare Access.
