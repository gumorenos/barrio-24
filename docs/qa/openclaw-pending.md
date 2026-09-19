# QA / infraestructura pendiente para OpenClaw

Actualizado: 2026-09-19 America/Lima.

Este archivo es la cola explícita de trabajo que requiere acceso remoto, Cloudflare, dispositivos/entornos no disponibles para ChatGPT o QA operativo. **No ejecutar hasta que el usuario confirme que recuperó acceso a OpenClaw.**

Reglas:

- ChatGPT hace coding y QA local/repo posible.
- OpenClaw hace QA remoto, Cloudflare/D1 y despliegues cuando corresponda.
- No tocar producción ni `main` sin autorización explícita.
- Antes de preparar el próximo prompt operativo, confirmar la plataforma de mensajería vigente; al crear este archivo la última plataforma usada fue Discord.
- No convertir pendientes secundarios en bloqueos de desarrollo si pueden avanzarse de forma segura con fixtures sintéticos.

## P1 — Custom domain de staging

Objetivo deseado: hostname amigable para Pages staging.

Intento previo:

- proyecto Pages: `barrio24-staging`;
- hostname solicitado: `barrio24-staging.todoestaaca.com`;
- resultado: **bloqueado por conflicto existente**;
- el hostname resolvía vía A/AAAA de Cloudflare y respondía `302` hacia `todoestaaca-com.l.ink`, servicio ajeno al proyecto;
- no se modificó DNS;
- URL Pages existente continuó `200`;
- desde el nuevo origin el Worker respondió `403 {"error":"origin_not_allowed"}`;
- Access `/v1/ops/*` permaneció protegido.

Al retomar:

1. Identificar qué recurso/configuración posee `barrio24-staging.todoestaaca.com` y si sigue siendo necesario.
2. No borrar/reemplazar el recurso existente sin autorización.
3. Si se conserva, proponer un hostname libre (por ejemplo `barrio24-qa.todoestaaca.com`) antes de cambiar código.
4. Una vez decidido el hostname definitivo, ChatGPT debe implementar primero el allowlist CORS/CSP versionado y sus tests si hace falta.
5. Solo después OpenClaw configura Custom Domain/DNS/TLS y hace QA del nuevo origin.

## P2 — Evidencia D1 secundaria de F4

F4 ya tiene `P0 CLOSURE: PASS`; esto NO reabre F4.

Pendiente secundario por credenciales Wrangler (`API error 10000/9106`):

- reconfirmar directamente en D1 remoto `last_moderation_event_id`;
- reconfirmar `report_moderation_events`;
- reconfirmar idempotency key persistida.

No crear credenciales nuevas únicamente para cerrar esta evidencia si la política de acceso actual no lo permite. Registrar el resultado cuando exista una sesión/credencial autorizada.

## P3 — F7 / QA físico y operativo acumulado

No ejecutar todavía salvo que el roadmap llegue a F7 o ChatGPT pida una comprobación puntual:

- iPhone físico;
- Android físico;
- modo avión, cierre/reapertura y reconexión;
- persistencia local/IndexedDB y Service Worker bajo condiciones reales;
- accesibilidad con herramientas/navegadores reales;
- observabilidad, cuotas/costos y recuperación;
- piloto controlado.

## P4 — F5 Ruta Alta: trabajo remoto futuro

No hay todavía paquete oficial autorizado para publicar. Mientras `packagingEligible=false`, OpenClaw NO debe descargar/publicar datos como si fueran producto final ni desplegar mapas oficiales.

Cuando ChatGPT lo solicite, podrá ser necesario:

- descargar bytes oficiales candidatos que el entorno de ChatGPT no pueda obtener;
- conservar evidencia de URL final, tamaño, Content-Type y SHA-256;
- ejecutar el inspector ZIP/SHAPE del repo sobre los bytes descargados;
- reportar CRS, conjuntos SHP, tipos y atributos sin reinterpretar su significado;
- hacer QA de un preview con paquetes sintéticos;
- posteriormente desplegar staging solo cuando exista un paquete con procedencia/licencia/revisión aprobadas.

## Estado

Nada de este archivo requiere acción inmediata. Continuar desarrollo local/repo de F5 con datos sintéticos y gates fail-closed hasta recuperar OpenClaw.
