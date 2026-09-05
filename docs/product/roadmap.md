# Roadmap de producto — Barrio 24

Actualizado: 2026-09-05, America/Lima.

Este documento es la **fuente de verdad del roadmap** de Barrio 24. Define visión, límites, módulos, fases, dependencias, puertas de avance y el orden de trabajo. El README puede resumir estas decisiones, pero no debe redefinirlas.

## Estado actual

**Fase activa: Fase 5 — Ruta Alta piloto, preparación de entrada.**

La **Fase 4 — Reporte 60 segundos conectado en staging está formalmente cerrada**. El cierre se basa en evidencia reproducible y QA remoto sobre staging, no implica autorización de producción.

Estado confirmado del producto:

- PWA offline-first operativa.
- Tarjeta Médica Offline implementada localmente.
- Reporte 60 segundos local y conectado en staging.
- Worker y D1 de staging operativos.
- Reportes remotos inicialmente `unverified`.
- Idempotencia, rate limiting y retención implementados.
- Consola operativa de moderación protegida por Cloudflare Access.
- `POST /v1/reports` continúa como superficie pública de staging.
- Readiness, smoke, abuso y evidencia automatizada P0/P1 completados sobre SHA `4a2460b1f2d77b088683eb5eab6db4f372ca2927`.
- Access, moderación, idempotencia, concurrencia e historial remoto validados con datos sintéticos.
- Carga controlada completada; Queue y Turnstile no se justifican por ahora.
- Headers/CSP de Pages y consola ops validados.
- Revisión de secretos en artifacts: PASS.
- Retención 30/180 días cubierta por tests; cron remoto `0 5 * * *` confirmado manualmente en Cloudflare.
- No existe feed público de reportes.
- Producción continúa en **NO-GO**.

El QA físico de iPhone/Android, offline/reconexión, persistencia local, accesibilidad, observabilidad y hardening más amplio permanece para M5/Fase 7 y no reabre F4.

## Visión

Barrio 24 debe ayudar a personas, familias y comunidades a prepararse, conservar información crítica y coordinar una respuesta inicial ante sismos cuando la conectividad sea limitada o intermitente.

El producto debe priorizar utilidad práctica, resiliencia offline, privacidad, claridad del estado de la información y degradación segura. Debe complementar a las autoridades y fuentes oficiales, no competir con ellas ni aparentar autoridad institucional.

## Límites permanentes del producto

1. **No predice terremotos.**
2. **No reemplaza autoridades.**
3. **Offline-first es un requisito.**
4. **La información ciudadana no es información oficial.**
5. **Privacidad por diseño.** Datos médicos permanecen locales por defecto y los reportes no guardan coordenadas exactas.
6. **Mínimo dato necesario.**
7. **Una PWA antes que apps nativas.**
8. **No avanzar por apariencia de completitud.**
9. **Staging no es producción.**

## Módulos M0–M5

### M0 — Plataforma PWA y resiliencia offline

Incluye instalación PWA, Service Worker, IndexedDB, conectividad, outbox/idempotencia, estados de sincronización y base de accesibilidad.

### M1 — Tarjeta Médica Offline

Incluye datos médicos locales, cifrado, PIN, vista de emergencia, exportación/importación e impresión. Los datos médicos no se envían al backend por defecto.

### M2 — Reporte 60 segundos y moderación

Incluye captura rápida, operación offline, ubicación aproximada opcional, API mínima, recepción idempotente, estado `unverified`, retención, controles de abuso, moderación privada y auditoría.

### M3 — Ruta Alta

Incluye paquetes offline de información geográfica, zonas de inundación, rutas/puntos de reunión de fuentes oficiales, procedencia visible, instrucciones textuales y ubicación aproximada del usuario cuando corresponda.

### M4 — Coordinación Barrio 24

Incluye grupos privados, invitación/revocación, check-ins estructurados, necesidades, recursos, tareas y sincronización incremental.

### M5 — Preparación pública, seguridad y operación

Incluye hardening, carga/abuso, privacidad, accesibilidad, observabilidad, recuperación, QA físico y criterios de piloto/producción.

## Fases 0–7

### Fase 0 — Producto, riesgos y diseño

**Estado:** completada.

### Fase 1 — Base PWA offline

**Estado:** completada.

### Fase 2 — Tarjeta Médica Offline

**Estado:** implementada localmente; QA físico final queda para hardening/piloto.

### Fase 3 — Reporte 60 segundos local

**Estado:** completada.

### Fase 4 — Reporte 60 segundos conectado en staging

**Estado:** **completada / cerrada el 5 de septiembre de 2026**.

Evidencia de cierre:

- candidato runtime validado: `4a2460b1f2d77b088683eb5eab6db4f372ca2927`;
- Worker staging `barrio24-reports-api-staging` desplegado y validado;
- Version ID desplegado `a18d49e3-4adb-4bdf-8786-4758b057ea15`;
- D1 migrations/schema `0001`–`0004`: PASS;
- readiness read-only: PASS;
- Wrangler deploy dry-run/startup: PASS;
- public smoke/abuse: PASS;
- Access/consola/moderación: PASS;
- idempotencia/concurrencia/historial: PASS;
- evidence summary P0/P1: `COMPLETE`;
- carga rate-limit: `15/15`, p50 `262.71 ms`, p95 `553.64 ms`;
- carga burst: `20/20`, p50 `279.48 ms`, p95 `496.54 ms`;
- Queue: no por ahora;
- Turnstile: no por ahora;
- headers/CSP Pages: PASS;
- headers ops: PASS;
- secretos en artifacts: PASS;
- retención 30 días reportes / 180 días auditoría: test dedicada PASS;
- cron remoto `0 5 * * *`: confirmado manualmente en Cloudflare.

Gap de evidencia no bloqueante:

- una reconfirmación D1 directa de `last_moderation_event_id`, `report_moderation_events` e `idempotency_key` quedó pendiente por credenciales Wrangler (`API error 10000/9106`). No reabre F4 porque schema, historial, idempotencia y concurrencia ya validaron el comportamiento remoto.

**Cerrar F4 no autoriza producción.**

### Fase 5 — Ruta Alta piloto

**Módulo principal:** M3.

**Estado:** **activa en preparación de entrada; implementación/publicación de mapas aún bloqueada**.

Preparación ya realizada:

- La Punta/Callao como candidato provisional;
- catálogo y manifests de procedencia research-only;
- validación fail-closed de licencia, vigencia, revisión, hash y bytes;
- fetch seguro de fuentes oficiales;
- auditoría local de cache;
- inspector ZIP/SHAPE con defensas contra traversal, symlinks, cifrado y ZIP bombs.

Bloqueo principal actual:

- la licencia de redistribución offline no está verificada, por lo que `packagingEligible` sigue en `false`.

Objetivos de F5:

- escoger zona piloto;
- documentar fuentes oficiales y licencias;
- resolver bytes/hash, CRS, edición y vigencia;
- obtener revisión humana;
- generar paquete offline reproducible;
- integrar mapa y capas;
- añadir instrucciones textuales equivalentes;
- validar tamaño, actualización y recuperación offline.

**Puerta de entrada operativa para empaquetar/publicar una capa:** `packagingEligible=true`, lo que exige licencia de redistribución verificada, permiso de transformación/empaquetado offline, bytes/hash verificados, CRS resuelto, vigencia definida y revisión humana aprobada.

### Fase 6 — Barrio 24

**Estado:** planificada.

Objetivos:

- grupos privados;
- invitación y revocación;
- check-ins estructurados;
- necesidades, recursos y tareas;
- sincronización incremental;
- expiración y límites;
- evaluar Durable Objects solo si la evidencia lo justifica.

### Fase 7 — Hardening y piloto controlado

**Estado:** planificada.

Objetivos:

- QA físico iPhone/Android;
- conectividad intermitente y recuperación;
- persistencia y restauración;
- seguridad/privacidad final;
- accesibilidad;
- observabilidad, cuotas y presupuesto;
- runbooks operativos;
- piloto controlado.

**Puerta de salida F7 / producción:** decisión GO explícita basada en QA, seguridad, privacidad, operación, costos y resultados del piloto.

## Dependencias

| Elemento | Depende de | Motivo |
|---|---|---|
| M0 Plataforma | — | Base común offline |
| M1 Tarjeta Médica | M0 | Persistencia y UX offline |
| M2 Reporte local | M0 | IndexedDB/outbox |
| M2 Reporte conectado | M2 local + Worker/D1 | Sincronización e idempotencia |
| Moderación M2 | Reporte conectado + Access | Solo sobre reportes remotos |
| M3 Ruta Alta | M0 + fuentes GIS validadas | Mapas offline confiables/versionables |
| M4 Barrio 24 | M0 + identidad + sincronización | Aislamiento y conflictos |
| M5 Piloto/producción | módulos incluidos | Hardening del sistema real |

## Reglas de puertas de avance

- Una puerta se considera cerrada solo con evidencia verificable.
- Un resultado parcial no se redondea a PASS.
- Los gaps no bloqueantes deben seguir documentados.
- Producción, `main`, recursos productivos o datos reales requieren autorización explícita.

## Próximo orden de trabajo

1. **Configurar una URL amigable de staging sin alterar producción.** Preferencia: `barrio24-staging.todoestaaca.com` para Pages; mantener el Worker en `workers.dev` por ahora.
2. **Cerrar la puerta de datos de F5.** Resolver licencia de redistribución offline, bytes/hash, CRS, edición/vigencia y revisión humana.
3. **Marcar al menos una fuente como `packagingEligible=true`.**
4. **Implementar Ruta Alta offline.** Paquete reproducible, mapa/capas, instrucciones textuales y procedencia visible.
5. **Abordar F6 Coordinación Barrio 24.**
6. **Consolidar QA físico, accesibilidad, observabilidad y hardening en F7.**
7. **Mantener producción en NO-GO hasta decisión explícita al final de F7.**

## Mantenimiento del roadmap

Actualizar este archivo cuando cambie la fase activa, una dependencia, una puerta de entrada/salida, una decisión de arquitectura relevante o la autorización de piloto/producción.
