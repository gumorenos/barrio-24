# Roadmap de producto — Barrio 24

Actualizado: 2026-09-04, America/Lima.

Este documento es la **fuente de verdad del roadmap** de Barrio 24. Define visión, límites, módulos, fases, dependencias, puertas de avance y el orden de trabajo. El README puede resumir estas decisiones, pero no debe redefinirlas. Los runbooks y documentos de QA pueden detallar una fase concreta sin cambiar su alcance de producto.

## Estado actual

**Fase activa: Fase 4 — Reporte 60 segundos conectado en staging, en cierre.**

Estado confirmado del producto en esta fase:

- PWA offline-first operativa.
- Tarjeta Médica Offline local.
- Reporte 60 segundos con captura offline y sincronización manual.
- Worker y D1 de staging para recepción de reportes.
- Reportes remotos inicialmente `unverified`.
- Idempotencia, rate limiting y retención implementados en staging.
- Consola operativa de moderación en el mismo Worker.
- Cloudflare Access protege únicamente `/v1/ops/*`.
- `POST /v1/reports` continúa como superficie pública de staging.
- Readiness, smoke, abuso y evidencia automatizada P0/P1 completados sobre SHA `4a2460b1f2d77b088683eb5eab6db4f372ca2927`.
- Access, moderación, idempotencia, concurrencia e historial remoto validados con datos sintéticos.
- Carga controlada completada; Queue y Turnstile no se justifican por ahora.
- No existe feed público de reportes.
- Producción no está autorizada.

La Fase 4 está **en cierre**, no cerrada. Los gates funcionales y operativos principales de staging ya pasaron. Para cerrar formalmente F4 solo quedan los P0 de headers/CSP/privacidad operativa y retención/cron. El QA físico, offline/reconexión y accesibilidad se mantienen como hardening para piloto/F7 y no invalidan el staging funcional actual.

## Visión

Barrio 24 debe ayudar a personas, familias y comunidades a prepararse, conservar información crítica y coordinar una respuesta inicial ante sismos cuando la conectividad sea limitada o intermitente.

El producto debe priorizar utilidad práctica, resiliencia offline, privacidad, claridad del estado de la información y degradación segura. Debe complementar a las autoridades y fuentes oficiales, no competir con ellas ni aparentar autoridad institucional.

## Límites permanentes del producto

1. **No predice terremotos.** No genera pronósticos ni alertas sísmicas propias.
2. **No reemplaza autoridades.** IGP, INDECI, municipios, bomberos, Policía y servicios médicos siguen siendo las fuentes o responsables oficiales según corresponda.
3. **Offline-first es un requisito.** Una caída del backend no debe inutilizar funciones locales críticas ya descargadas.
4. **La información ciudadana no es información oficial.** Un reporte recibido permanece claramente diferenciado de uno verificado.
5. **Privacidad por diseño.** Datos médicos se mantienen locales por defecto y los reportes no guardan coordenadas exactas.
6. **Mínimo dato necesario.** No añadir texto libre, imágenes, identificadores personales o telemetría sensible sin una decisión explícita y revisión de riesgo.
7. **Una PWA antes que apps nativas.** No mantener aplicaciones iOS y Android independientes mientras la PWA cubra el caso de uso.
8. **No avanzar por apariencia de completitud.** Una fase se cierra únicamente cuando sus puertas tienen evidencia verificable.
9. **Staging no es producción.** Ningún recurso o validación de staging autoriza por sí mismo exposición pública productiva.

## Módulos M0–M5

Los módulos expresan capacidades de producto. Las fases expresan el orden de entrega. Un módulo puede atravesar más de una fase.

### M0 — Plataforma PWA y resiliencia offline

Responsabilidad:

- instalación PWA;
- Service Worker y caché;
- IndexedDB;
- detección de conectividad;
- outbox e idempotencia del cliente;
- estados claros de sincronización;
- degradación controlada;
- base de accesibilidad y diseño mobile-first.

No incluye por sí mismo datos médicos, reportes ciudadanos, mapas de evacuación ni coordinación de grupos.

### M1 — Tarjeta Médica Offline

Responsabilidad:

- datos médicos de emergencia almacenados localmente;
- cifrado local;
- PIN y vista de emergencia;
- exportación, importación e impresión;
- comunicación explícita de datos autodeclarados/no verificados.

Regla principal: los datos médicos no se envían al backend por defecto.

### M2 — Reporte 60 segundos y moderación

Responsabilidad:

- captura de una observación en menos de un minuto;
- operación offline y sincronización posterior;
- ubicación aproximada opcional, nunca coordenada exacta persistida;
- contrato mínimo de API;
- recepción idempotente y estado `unverified`;
- retención y controles de abuso;
- superficie operativa privada para revisión, decisiones y auditoría.

La consola de moderación pertenece a M2 aunque no forme parte de la PWA ciudadana. Un feed público no es requisito de la fase actual.

### M3 — Ruta Alta

Responsabilidad:

- paquetes offline de información geográfica;
- zonas de inundación, rutas y puntos de reunión de fuentes oficiales;
- fuente, fecha y versión visibles;
- instrucciones textuales además del mapa;
- ubicación aproximada del usuario cuando sea útil y autorizada.

No debe afirmar que una ruta es absolutamente segura ni sustituir instrucciones de autoridades.

### M4 — Coordinación Barrio 24

Responsabilidad:

- grupos privados para familia, edificio, colegio o cuadra;
- invitación y revocación;
- check-ins estructurados;
- necesidades, recursos y tareas;
- sincronización incremental con conectividad intermitente;
- límites de grupo y expiración.

No es una red social ni un chat público.

### M5 — Preparación pública, seguridad y operación

Responsabilidad transversal:

- hardening;
- carga y abuso;
- privacidad y seguridad;
- accesibilidad;
- observabilidad y presupuesto;
- runbooks y recuperación;
- QA físico de dispositivos y conectividad;
- criterios de piloto y producción.

M5 comienza parcialmente durante staging, pero su cierre formal ocurre en la Fase 7.

## Fases 0–7

### Fase 0 — Producto, riesgos y diseño

**Módulos:** preparación de M0–M5.

**Estado:** completada como base de producto; decisiones pueden refinarse sin renumerar fases.

Objetivos:

- definir usuarios y escenarios prioritarios;
- fijar límites del producto;
- definir arquitectura inicial y modelo offline-first;
- establecer lenguaje visual y criterios de accesibilidad;
- identificar fuentes y riesgos de datos;
- definir criterios de éxito y privacidad inicial.

**Puerta de salida F0:** alcance y riesgos documentados; ninguna funcionalidad crítica depende de una capacidad no validada del navegador o de una fuente de datos inexistente.

### Fase 1 — Base PWA offline

**Módulo principal:** M0.

**Estado:** implementada.

Objetivos:

- PWA instalable;
- Service Worker;
- IndexedDB;
- detección de conectividad;
- outbox genérica;
- estado visible offline/sincronización;
- lint, typecheck, tests y build reproducibles.

**Puerta de salida F1:** la aplicación abre, conserva datos y demuestra operación local al cerrar/reabrir y durante pérdida de conectividad.

### Fase 2 — Tarjeta Médica Offline

**Módulo principal:** M1; depende de M0.

**Estado:** implementada localmente.

Objetivos:

- modelo local;
- cifrado Web Crypto;
- PIN;
- vista de emergencia;
- exportación/importación e impresión;
- validación en navegadores objetivo.

**Puerta de salida F2:** los datos médicos permanecen locales por defecto, se recuperan offline, pueden exportarse/borrarse y no aparecen en logs o tráfico de red no autorizado.

### Fase 3 — Reporte 60 segundos local

**Módulo principal:** M2 sobre M0.

**Estado:** implementada.

Objetivos:

- captura estructurada rápida;
- guardado offline;
- estado local explícito;
- ubicación aproximada opcional;
- exportación y borrado local;
- sin texto libre, fotografías ni publicación pública.

**Puerta de salida F3:** un reporte puede crearse y recuperarse sin red; negar geolocalización no bloquea el flujo; ninguna coordenada exacta queda persistida.

### Fase 4 — Reporte 60 segundos conectado en staging

**Módulo principal:** M2; incorpora controles iniciales de M5.

**Estado:** **activa / en cierre**.

Objetivos ya implementados y validados en staging:

- Worker de recepción;
- D1;
- validación del contrato;
- idempotencia;
- rate limiting inicial;
- retención implementada;
- sincronización manual desde la PWA;
- estado remoto `unverified`;
- moderación operativa y auditoría;
- consola operativa same-origin;
- Cloudflare Access sobre `/v1/ops/*`;
- readiness reproducible ligado a SHA;
- smoke y abuso controlado;
- QA remoto de moderación, idempotencia y concurrencia;
- carga P1 y evidencia agregada `COMPLETE`;
- decisión documentada: Queue no por ahora; Turnstile no por ahora.

Tooling de Fase 4 ya persistido en `feature/f4-readiness-f5-prep`:

- generador fail-closed de `api/wrangler.toml` desde variables de staging no secretas;
- validación de cuenta, Worker, D1, Pages, cron y namespace de Rate Limiting;
- Wrangler fijado explícitamente a `4.125.0` en los comandos remotos mediante `npx` (no está instalado ni fijado en `package-lock.json`);
- smoke público, probe de abuso y carga controlada, todos dry-run o fail-closed y restringidos a staging;
- check remoto D1 de solo lectura para el esquema esperado `0001`–`0004`;
- readiness read-only ligado al SHA candidato, rama segura y worktree limpio;
- evidencia privada ligada al SHA y agregador P0/P1.

Pendientes antes de cerrar formalmente F4:

- revisar headers y CSP de Pages staging y consola Worker;
- confirmar ausencia de secretos/JWT/configuración sensible en logs y artefactos;
- ejecutar retención/cron con datos sintéticos preparados para expirar y confirmar borrado selectivo;
- mantener como evidencia secundaria pendiente la reconfirmación D1 directa de `last_moderation_event_id`, `report_moderation_events` e `idempotency_key` cuando haya credenciales Wrangler autorizadas; el comportamiento remoto ya fue validado mediante historial, idempotencia y concurrencia.

QA físico de iPhone/Android, offline/reconexión, persistencia local, accesibilidad y observabilidad se mantienen para hardening/piloto y F7; no son un fallo del staging conectado actual.

**Puerta de salida F4:**

- checks locales del candidato pasan;
- configuración y recursos de staging son reproducibles y apuntan únicamente a staging;
- migraciones remotas están identificadas y consistentes;
- `/v1/ops/*` exige Access y `POST /v1/reports` conserva el comportamiento público esperado de staging;
- consola, decisiones, auditoría, idempotencia y concurrencia tienen QA remoto documentado;
- no se filtran secretos, JWT, datos médicos ni coordenadas exactas;
- existe un resultado documentado de carga/abuso y una decisión explícita sobre Queue/Turnstile;
- no quedan bloqueadores P0 de seguridad/privacidad para continuar el desarrollo;
- ninguna de estas comprobaciones implica autorización de producción.

### Fase 5 — Ruta Alta piloto

**Módulo principal:** M3; depende de M0 y de fuentes GIS confiables.

**Estado:** planificada; investigación/tooling preparatorio iniciado sin abrir la implementación de mapas.

Preparación ya realizada:

- La Punta/Callao como candidato provisional de investigación;
- catálogo y manifiestos de procedencia research-only;
- validación fail-closed de licencia, vigencia, revisión, hash y bytes antes de empaquetar;
- fetch seguro de fuentes oficiales y auditoría local de cache;
- inspector ZIP/SHAPE sin extracción al filesystem, con defensas contra traversal, symlinks, cifrado y ZIP bombs;
- la licencia de redistribución offline sigue sin verificarse, por lo que `packagingEligible` permanece bloqueado.

Objetivos:

- escoger una zona piloto;
- documentar fuentes oficiales y licencias;
- versionar capas y fecha de vigencia;
- generar paquete offline;
- integrar visualización de mapa;
- añadir instrucciones textuales equivalentes;
- validar tamaño, actualización y recuperación offline.

**Puerta de entrada F5:** F4 sin bloqueadores P0 y fuentes del piloto identificadas. Antes de empaquetar una capa, su manifiesto debe ser estructuralmente válido y `packagingEligible=true`: licencia de redistribución verificada, permisos de transformación/empaquetado offline, bytes/hash verificados, CRS resuelto, vigencia definida y revisión humana aprobada. La investigación y tooling de procedencia pueden adelantarse; la implementación/publicación de mapas o rutas no.

**Puerta de salida F5:** paquete offline reproducible, fuentes visibles, comportamiento sin red validado y revisión humana de las rutas/puntos antes del piloto.

### Fase 6 — Barrio 24

**Módulo principal:** M4; depende de M0 y de decisiones de identidad/sincronización.

**Estado:** planificada.

Objetivos:

- grupos privados;
- invitación y revocación;
- check-ins estructurados;
- necesidades, recursos y tareas;
- sincronización incremental;
- expiración y límites;
- evaluar Durable Objects solo si la coordinación activa lo justifica.

**Puerta de entrada F6:** modelo de identidad y privacidad aprobado; sincronización intermitente de fases anteriores suficientemente estable.

**Puerta de salida F6:** aislamiento entre grupos, revocación efectiva, sincronización sin duplicados y recuperación de conflictos probadas con datos sintéticos.

### Fase 7 — Hardening y piloto controlado

**Módulo principal:** M5 sobre todos los módulos incluidos en el piloto.

**Estado:** planificada.

Objetivos:

- pruebas de carga y degradación;
- conectividad intermitente y recuperación;
- restauración de datos;
- auditoría de seguridad;
- revisión de privacidad;
- accesibilidad;
- observabilidad, cuotas y presupuesto;
- runbooks operativos;
- piloto controlado.

**Puerta de salida F7 / producción:** decisión GO explícita basada en QA, seguridad, privacidad, operación, costos y resultados del piloto. No existe aprobación automática por completar código.

## Dependencias

| Elemento | Depende de | Motivo |
|---|---|---|
| M0 Plataforma | — | Base común offline y de instalación |
| M1 Tarjeta Médica | M0 | Persistencia y UX offline |
| M2 Reporte local | M0 | IndexedDB, outbox y conectividad |
| M2 Reporte conectado | M2 local + Worker/D1 | Sincronización e idempotencia |
| Moderación M2 | Reporte conectado + Access | Opera únicamente sobre reportes remotos |
| M3 Ruta Alta | M0 + fuentes GIS validadas | Mapas offline deben ser versionables y confiables |
| M4 Barrio 24 | M0 + identidad + sincronización | Datos privados y conflictos requieren aislamiento |
| M5 Piloto/producción | módulos incluidos | Hardening debe probar el sistema real que se pretende exponer |

Dependencias técnicas como Queue, Durable Objects, Turnstile, KV o R2 no son objetivos por sí mismas. Se incorporan únicamente cuando una necesidad de producto o evidencia operativa las justifica.

## Reglas de puertas de avance

- Una puerta se considera cerrada solo con evidencia: tests, comandos, capturas/QA manual documentado o resultados remotos reproducibles según corresponda.
- “Funciona en mi navegador” no reemplaza pruebas automatizadas o QA de dispositivo cuando estos son parte de la puerta.
- Un resultado parcial no se redondea a PASS.
- Los pendientes deben permanecer documentados hasta cerrarse; no se borran para presentar una fase como terminada.
- Una nueva fase puede investigarse en paralelo cuando no modifica el producto activo, pero no debe ocultar bloqueadores P0 de la fase actual.
- Cambios en producción, `main`, recursos Cloudflare productivos o datos reales requieren autorización explícita independiente de este roadmap.

## Fuera de alcance por ahora

- predicción de terremotos o alertas sísmicas propias;
- integración con SEIDAS como dependencia de fases iniciales;
- chat público o red social;
- diagnóstico médico automático;
- evaluación automática de seguridad estructural;
- fotografías como requisito de Reporte 60 segundos;
- IA para decidir prioridades de rescate;
- publicación de coordenadas exactas de personas;
- tratamiento de un reporte ciudadano como confirmación oficial;
- reemplazo de fuentes o autoridades oficiales;
- aplicaciones iOS y Android independientes mientras la PWA sea suficiente;
- producción antes de superar la Fase 7 y obtener autorización explícita.

## Próximo orden de trabajo

1. **Cerrar los dos P0 restantes de Fase 4.** Verificar headers/CSP/privacidad operativa y ejecutar retención/cron con datos sintéticos.
2. **Reconfirmar D1 directa cuando haya credenciales Wrangler autorizadas.** Validar `last_moderation_event_id`, `report_moderation_events` e `idempotency_key` sin relajar permisos ni crear credenciales ad hoc.
3. **Cerrar formalmente F4 si no aparece un nuevo P0.** Mantener producción en NO-GO.
4. **Continuar la preparación de Fase 5.** Resolver licencia de redistribución offline, obtener/inspeccionar bytes oficiales y completar CRS/hash/vigencia/revisión humana.
5. **Abrir implementación F5 solo después de cumplir su puerta de entrada.** No publicar rutas ni mapas antes de `packagingEligible=true` y revisión humana.
6. **Mantener QA físico, offline/reconexión, accesibilidad y observabilidad para hardening/piloto.** Estos puntos se consolidan en M5/F7.
7. **Abordar Fase 6 y luego Fase 7.** La preparación productiva final y el piloto controlado pertenecen a Fase 7.

## Mantenimiento del roadmap

Actualizar este archivo cuando cambie cualquiera de estos elementos:

- fase activa;
- alcance o responsabilidad de M0–M5;
- dependencia que altere el orden de implementación;
- puerta de entrada o salida;
- decisión de incorporar o descartar una tecnología relevante;
- autorización o restricción de piloto/producción.

Cambios de implementación que no alteran el orden ni las puertas pueden documentarse en el README, ADRs, runbooks o documentos de QA sin reescribir el roadmap.
