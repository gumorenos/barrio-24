# Production readiness — Reporte 60 segundos

Actualizado: 2026-09-04 America/Lima.

## Veredicto actual

**NO-GO para producción.**

El staging de Fase 4 ya superó sus gates funcionales, automatizados y operativos principales, pero este documento no autoriza cambios en `main`, despliegues productivos, aplicación de migraciones ni uso de datos reales. Producción sigue dependiendo de las fases posteriores del roadmap y de una decisión GO explícita.

## Candidato validado

- Rama: `feature/f4-readiness-f5-prep`.
- SHA validado y desplegado: `4a2460b1f2d77b088683eb5eab6db4f372ca2927`.
- Worker: `barrio24-reports-api-staging`.
- Version ID anterior: `cf2bab1e-db4f-435f-9c12-eed02682dce3`.
- Version ID desplegado: `a18d49e3-4adb-4bdf-8786-4758b057ea15`.
- D1: `barrio24-reports-staging`.
- D1 ID: `eca7ac80-6859-40d5-89db-ba1bb6c61173`.
- Pages origin: `https://feature-02-rapid-report.barrio24-staging.pages.dev`.
- Cron configurado: `0 5 * * *`.
- Rate Limit namespace verificado: `2026081401`.
- Access: `/v1/ops/*`.

Pages no fue redesplegado. Producción, `main`, migraciones y configuración de Access no fueron modificados. `REPORTS_OPERATIONS_TOKEN` no existe en el diseño y no fue creado.

## Evidencia cerrada — PASS

### Repositorio y tooling

- `npm ci`: PASS, 0 vulnerabilidades.
- `npm run check`: PASS.
- Wrangler fijado a `4.125.0` en comandos remotos mediante `npx`.
- Generación fail-closed de `api/wrangler.toml` desde configuración staging no secreta.
- Readiness read-only ligado al SHA: PASS.
- Wrangler deploy dry-run: PASS.
- Wrangler startup check: PASS.

### D1 y migraciones

- Migraciones `0001`–`0004`: consistentes.
- Schema remoto read-only: PASS.
- Tablas, columnas e índices esperados: PASS.

Una consulta D1 directa posterior a las pruebas de moderación falló por credenciales de Wrangler con `API error 10000`. Queda pendiente reconfirmar directamente `last_moderation_event_id`, la fila de `report_moderation_events` y la `idempotency_key` almacenada. Se considera un gap de evidencia directa y no un fallo funcional, porque el esquema, historial, idempotencia y concurrencia remotos ya pasaron.

### Deploy y superficie pública

- Deploy únicamente del Worker staging: PASS.
- Public smoke: PASS.
- Public abuse: PASS.
- Evidence summary P0: `COMPLETE`.
- CORS público conserva el origen Pages esperado.
- Superficie operativa rechaza el origen Pages con `403 origin_not_allowed`.

### Access y moderación

Con sesión real de Cloudflare Access:

- consola autenticada: `200`;
- `verify`: PASS;
- `resolve`: PASS;
- `mark-duplicate`: PASS;
- `expire`: PASS;
- `invalid_decision`: PASS;
- `invalid_idempotency_key`: PASS;
- `invalid_transition`: PASS;
- `status_conflict`: PASS;
- replay idempotente: PASS;
- reutilización de key en otro reporte → `idempotency_conflict`: PASS;
- concurrencia: una transición aplicada y la segunda rechazada con `status_conflict`;
- historial: actor, transición, motivo, timestamps y request ID presentes.

### Carga P1

Perfil rate-limit:

- `15/15` aceptadas;
- p50 `262.71 ms`;
- p95 `553.64 ms`.

Perfil burst:

- `20/20` aceptadas;
- p50 `279.48 ms`;
- p95 `496.54 ms`.

Evidence summary P1: `COMPLETE` para el SHA validado.

Decisiones actuales:

- Queue: **no por ahora**.
- Turnstile: **no por ahora**.

No existe evidencia de carga que justifique introducir esas dependencias antes del piloto. Revaluar si cambian volumen, abuso o disponibilidad requerida.

## P0 restantes para cerrar formalmente Fase 4

### Headers, CSP y privacidad operativa

- [ ] Revisar headers de seguridad de Pages staging.
- [ ] Revisar headers de la consola Worker.
- [ ] Confirmar CSP efectiva y ausencia de errores CSP relevantes.
- [ ] Confirmar que Access/JWT/configuración sensible no aparece en logs o artefactos.
- [ ] Confirmar minimización de ubicación y ausencia de identificadores personales inesperados.

### Retención y cron

- [ ] Confirmar retención efectiva: reportes 30 días y auditoría 180 días.
- [ ] Ejecutar cron con datos únicamente sintéticos preparados para expirar.
- [ ] Confirmar borrado selectivo esperado y preservación de filas aún vigentes.
- [ ] Conservar evidencia sin datos ciudadanos reales.

Mientras estos puntos sigan pendientes, Fase 4 continúa en estado de cierre y la implementación/publicación de Fase 5 permanece cerrada.

## P1 / hardening pendiente para piloto

Estos puntos no invalidan el staging funcional actual, pero deben cerrarse antes del piloto/producción según el roadmap:

- QA físico iPhone y Android;
- instalación PWA;
- offline, reconexión y sincronización única;
- persistencia local tras cerrar/reabrir;
- recuperación ante timeout/API caída;
- accesibilidad básica;
- observabilidad, cuotas y presupuesto;
- revisión de seguridad/privacidad más amplia sobre el conjunto final del piloto.

## Criterios de parada inmediata

Mantener **NO-GO** y detener cualquier acción si:

- el checkout no corresponde al candidato esperado;
- la configuración apunta a cuenta, Worker, D1 u origen distintos;
- aparecen migraciones remotas inesperadas;
- Access protege más superficie que `/v1/ops/*` o deja expuesta esa superficie;
- aparece un secreto, JWT, dato médico o coordenada exacta en Git/logs/respuestas;
- una prueba requiere datos ciudadanos reales;
- se propone `REPORTS_OPERATIONS_TOKEN` como atajo;
- se pretende tocar `main` o producción sin autorización explícita.

## Condición para cerrar Fase 4

F4 puede cerrarse cuando los dos bloques P0 restantes —headers/CSP/privacidad operativa y retención/cron— tengan evidencia satisfactoria y no aparezca un nuevo bloqueador P0.

Cerrar F4 **no equivale a autorizar producción**. Producción sigue siendo NO-GO hasta completar las puertas posteriores y recibir autorización explícita.
