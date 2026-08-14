# Barrio 24

Plataforma pública y gratuita para preparación, coordinación comunitaria y respuesta inicial ante sismos en Perú.

> Estado: Fase 2 conectada en staging — 14 de agosto de 2026

La base ya contiene el scaffold inicial de la PWA: Service Worker, manifest instalable, IndexedDB, outbox local sintética, indicador de conectividad y una primera dirección visual propia. La Fase 1 añade una Tarjeta Médica Offline funcional y la Fase 2 añade captura y sincronización manual de Reporte 60 segundos contra staging. Los reportes pueden exportarse o borrarse localmente, pero no hay feed público ni moderación operativa.

Barrio 24 no pretende predecir terremotos ni reemplazar al IGP, INDECI, los municipios, los bomberos, la Policía, los servicios médicos o los sistemas oficiales de alerta. Su objetivo es resolver problemas prácticos de las familias y comunidades antes, durante y después de un sismo, especialmente cuando la conectividad es limitada y los canales habituales están saturados.

## Decisión de producto

Barrio 24 será inicialmente una **PWA (Progressive Web App) offline-first**:

- Se utilizará desde cualquier navegador moderno.
- Podrá instalarse en Android desde el navegador.
- Podrá añadirse a la pantalla de inicio en iPhone/iPad.
- Mantendrá una sola base de código para navegador, Android e iOS.
- No se crearán tres aplicaciones independientes en la primera etapa.
- Una aplicación nativa para las tiendas de Google y Apple podrá añadirse después mediante Capacitor si se necesitan capacidades que una PWA no ofrece suficientemente bien.

La aplicación debe ser útil incluso si el backend no responde. La tarjeta médica, las instrucciones y los mapas previamente descargados deben funcionar localmente. Las operaciones que requieran servidor se guardarán en una cola local y se enviarán cuando vuelva la conectividad.

## Módulos aprobados

### 1. Tarjeta Médica Offline

Tarjeta personal de emergencia que funciona sin conexión.

Primera versión:

- Nombre o alias.
- Alergias.
- Medicamentos y dosis.
- Condiciones médicas relevantes.
- Necesidades de accesibilidad.
- Tipo de sangre autodeclarado, claramente marcado como no verificado.
- Contactos de emergencia.
- Vista de emergencia de alto contraste.
- PIN local.
- Impresión y exportación cifrada.
- QR: fuera de la primera implementación; se evaluará después de validar el flujo de vista de emergencia.

Principio de privacidad: los datos médicos no se envían al servidor por defecto. Se guardan cifrados en el dispositivo. La tarjeta no reemplaza una evaluación médica ni una historia clínica.

### 2. Reporte 60 segundos

Formulario ultrarrápido para comunicar una situación observable.

Categorías iniciales:

- Persona herida.
- Persona atrapada.
- Edificio dañado.
- Incendio o fuga.
- Calle bloqueada.
- Falta de agua.
- Corte eléctrico.
- Necesidad de refugio.
- Necesidad de alimentos o medicinas.

El reporte debe poder crearse en menos de un minuto y quedar guardado si el dispositivo está offline. La implementación permite elegir categoría, nivel de gravedad observado y una zona aproximada opcional. Por defecto cada reporte permanece en IndexedDB; con una URL de staging configurada puede enviarse manualmente y queda marcado como `unverified`, nunca como información oficial.

Los reportes públicos tendrán ubicación aproximada, fecha, estado y nivel de verificación. No se expondrán coordenadas exactas de personas ni se presentarán observaciones ciudadanas como información oficial.

### 3. Ruta Alta

Mapas y rutas de evacuación descargables para zonas expuestas a tsunami.

Primera versión:

- Piloto en una zona costera concreta.
- Zonas de inundación publicadas por fuentes oficiales.
- Rutas y puntos de reunión oficiales.
- Mapas utilizables sin conexión.
- Fecha, fuente y versión visibles.
- Instrucciones en texto además del mapa.
- Ubicación aproximada del usuario.

La primera versión no afirmará que una ruta es absolutamente segura. Mostrará la fuente y recordará seguir las instrucciones de las autoridades.

### 4. Barrio 24

Coordinación de grupos familiares, edificios, colegios o cuadras.

Primera versión:

- Crear un grupo privado.
- Invitar mediante enlace o QR.
- Check-in: “Estoy bien”, “Necesito ayuda”, “Estoy herido”, “Estoy incomunicado”.
- Estado de cada miembro y hora de última actualización.
- Registro de necesidades.
- Registro de recursos disponibles.
- Tareas y responsables.
- Última sincronización visible.
- Funcionamiento con conectividad intermitente.

No será inicialmente una red social ni un chat público. El objetivo es coordinar estados y necesidades con la menor cantidad posible de ruido.

## Priorización

Las estimaciones combinan dificultad de implementación, dependencia de datos externos, beneficio y tiempo de desarrollo con Codex/Claude Code más validación humana.

| Orden | Entregable | Dificultad | Tiempo humano estimado | Beneficio | Dependencias |
|---:|---|---:|---:|---|---|
| 0 | Base PWA offline | Media | 3–5 días | Habilita todos los módulos | Ninguna |
| 1 | Tarjeta Médica Offline | Baja-media | 4–7 días | Alto beneficio individual | Base offline |
| 2 | Reporte 60 segundos | Media | 7–12 días | Muy alto beneficio colectivo | API y moderación |
| 3 | Ruta Alta, piloto | Media-alta | 10–20 días | Muy alto en zonas costeras | Datos GIS validados |
| 4 | Barrio 24 | Alta | 15–25 días | Muy alto, con mayor complejidad | Identidad de grupo y sincronización |
| 5 | Hardening público | Alta | 5–10 días | Reduce riesgo operativo | Módulos iniciales |

Los tiempos no son promesas de calendario. Incluyen desarrollo asistido por agentes, pruebas, revisión y correcciones, pero no incluyen la obtención de convenios, validación municipal o revisión legal especializada.

## Arquitectura propuesta

```text
Usuarios
   |
   v
Cloudflare Pages ------------------> Assets estáticos y PWA
   |
   +--> Service Worker + IndexedDB -> Operación offline y outbox local
   |
   +--> Cloudflare Worker ----------> API ligera y validación
              |
              +--> D1 --------------> Datos estructurados y auditoría
              +--> KV --------------> Snapshots y configuración de lectura
              +--> R2 --------------> Mapas, paquetes GIS y documentos
              +--> Queues ----------> Procesamiento asíncrono y reintentos
              +--> Durable Objects -> Grupos Barrio 24 en una fase posterior
```

### Frontend

- React.
- Vite.
- TypeScript en modo estricto.
- Tailwind CSS, usado con un sistema visual propio.
- React Router o routing equivalente sencillo.
- Dexie para IndexedDB.
- `vite-plugin-pwa`/Workbox para Service Worker.
- MapLibre GL para mapas.
- PMTiles y GeoJSON comprimido para paquetes offline.
- Zod para validar datos en cliente y servidor.

### Backend

- Cloudflare Worker independiente para el API.
- Hono para routing y middleware.
- D1 para datos relacionales pequeños y consultables.
- KV únicamente para lecturas de alta frecuencia y baja necesidad de consistencia inmediata.
- R2 para paquetes geográficos, documentos y objetos grandes.
- Queues para reportes y tareas que no deben bloquear la respuesta del usuario.
- Durable Objects únicamente cuando se implemente la coordinación en tiempo real de Barrio 24.
- Turnstile y WAF para reducir spam y automatización abusiva.

### Repositorio sugerido

```text
barrio-24/
├── apps/
│   ├── web/                 # PWA en Cloudflare Pages
│   └── api/                 # Worker/Hono
├── packages/
│   ├── domain/              # Tipos, reglas y esquemas compartidos
│   ├── offline/             # IndexedDB, outbox y sincronización
│   ├── crypto/              # Cifrado local de tarjeta médica
│   └── geo/                 # Capas, versiones y utilidades GIS
├── workers/
│   ├── queue-consumer/      # Procesamiento asíncrono
│   └── durable-objects/     # Fase posterior
├── data/
│   └── gis/                 # Solo fuentes públicas/versionadas
├── migrations/
├── tests/
│   ├── e2e/
│   ├── load/
│   └── offline/
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── privacy/
│   └── operations/
├── wrangler.jsonc
├── package.json
└── README.md
```

La estructura es una propuesta inicial. Antes del scaffold se confirmará si conviene mantener un monorepo completo o empezar con una aplicación única y separar paquetes solo cuando exista una necesidad real.

## Diseño: evitar “AI slop”

El producto debe parecer una herramienta pública confiable, no una plantilla genérica generada por IA.

Principios visuales:

- Mobile-first y una acción primaria clara por pantalla.
- Tipografía legible, con jerarquía fuerte y lenguaje directo.
- Alto contraste y objetivos táctiles grandes.
- Paleta sobria, con colores de estado reservados para significados reales.
- Sin gradientes decorativos, glassmorphism ni fondos “futuristas”.
- Sin exceso de tarjetas redondeadas ni dashboard con widgets innecesarios.
- Sin textos genéricos de marketing.
- Sin iconos ambiguos: cada icono debe acompañar a una etiqueta.
- Estados de sincronización visibles: offline, pendiente, enviado, confirmado o desactualizado.
- Diferenciación visual entre información oficial, reporte ciudadano y contenido no verificado.
- Diseño accesible para personas con baja visión, discapacidad motora o estrés durante una emergencia.

Antes de construir pantallas se elaborará un pequeño sistema visual documentado en `docs/product/design-system.md`, con tipografía, espaciado, color, estados, botones, formularios, mapas y mensajes de error.

## Funcionamiento offline

La aplicación no debe asumir que “hay internet porque se pudo abrir una vez”.

### Datos locales

- Tarjeta médica cifrada.
- Configuración del usuario.
- Grupos y estados recientes autorizados por el usuario.
- Reportes pendientes de sincronización.
- Paquetes de mapas descargados.
- Instrucciones de emergencia.

### Outbox

Cada operación que no pudo enviarse se guarda con:

- `event_id` generado en el dispositivo.
- Tipo de operación.
- Payload mínimo.
- Fecha de creación.
- Número de intentos.
- Último error.
- Estado: pendiente, enviada, confirmada o fallida.

El servidor debe aceptar reintentos sin duplicar operaciones. La aplicación no dependerá exclusivamente de Background Sync, porque su ejecución es controlada por el navegador y el sistema operativo. También intentará sincronizar al abrirse, al detectar conectividad y mediante una acción manual.

### Reporte 60 segundos local

La captura local actual:

- no exige cuenta ni conexión;
- no permite texto libre, fotografías ni publicación pública;
- guarda categoría, gravedad observada, fecha y estado local;
- puede guardar una celda geográfica aproximada de alrededor de 1 km, si el usuario autoriza ubicación;
- nunca guarda la coordenada exacta;
- permite exportar reportes locales en JSON y borrar sus copias del dispositivo;
- no debe presentarse como reporte recibido, verificado o enviado a una autoridad.

El contrato mínimo, la idempotencia, el límite inicial y la retención de staging ya están implementados. Chromium validó el flujo remoto y la geolocalización fue validada manualmente en Arc Search para iPhone. Antes de usuarios reales faltan moderación, pruebas de carga/abuso, QA físico de sincronización y una revisión de seguridad/privacidad.

## Escalabilidad y modo de emergencia

El tráfico se separará en tres clases:

1. **Lectura pública:** assets de Pages, mapas en R2 y snapshots cacheables.
2. **Escritura:** payloads pequeños, validación rápida, respuesta `202 Accepted` y Queue.
3. **Datos privados:** acceso solo al grupo o dispositivo autorizado.

Reglas de operación:

- La página principal no consulta D1 en cada visita.
- Assets con hash y caché largo.
- Respuestas públicas con ETag y compresión.
- Payload máximo y validación estricta.
- Idempotencia para toda escritura.
- Índices para todas las consultas frecuentes.
- Sin fotografías en la primera versión de Reporte 60 segundos.
- Sin procesamiento pesado dentro de la solicitud del usuario.
- Retención automática de reportes antiguos.
- Alertas de cuota y presupuesto.
- Pruebas de carga antes de publicar.

### Degradación controlada

Cuando exista saturación, el producto debe degradarse en este orden:

1. Aplicación completa.
2. Aplicación con datos recientes cacheados y operaciones offline.
3. Solo tarjeta médica, instrucciones y mapas descargados.
4. Página estática de emergencia.
5. Sincronización posterior de la outbox.

Un usuario que instaló la PWA no debe quedar sin Tarjeta Médica o Ruta Alta porque un endpoint de reportes esté saturado.

## Datos y privacidad

La información de salud se tratará como dato sensible. La primera versión seguirá privacidad desde el diseño:

- No pedir cuenta para Tarjeta Médica Offline.
- No enviar información médica al servidor por defecto.
- No almacenar DNI salvo que una futura decisión lo justifique.
- No colocar datos sensibles en URLs, logs, analítica ni mensajes de error.
- Minimizar ubicación y redondearla en los reportes públicos.
- Explicar qué se guarda localmente y qué se envía.
- Permitir exportar y borrar datos locales.
- Definir retención y eliminación de reportes.
- Publicar política de privacidad y términos antes del lanzamiento público.
- Revisar el tratamiento de datos con asesoría especializada antes de ampliar el alcance.

## Despliegue

Sí, habrá que desplegar en algún momento, pero no al inicio como un servicio público completo.

### Ambientes

| Ambiente | Propósito | Exposición |
|---|---|---|
| Local | Desarrollo con datos sintéticos | Solo equipo local |
| Preview | Revisión de cada rama/PR | URL temporal |
| Staging | Pruebas de integración y carga controlada | Protegido |
| Producción | Uso público | Dominio definitivo |

### Secuencia recomendada

1. Desarrollar localmente sin datos reales.
2. Crear un preview de Pages para revisar la PWA.
3. Crear Worker y D1 de staging.
4. Probar modo avión, red intermitente y restauración de conexión.
5. Ejecutar pruebas de carga y abuso.
6. Publicar un piloto limitado.
7. Observar métricas y errores.
8. Publicar producción con dominio propio.

Cloudflare Pages es apropiado para el frontend estático. El API debe estar desacoplado en un Worker para controlar límites, colas, almacenamiento y escalamiento. Durante el desarrollo el nivel gratuito puede ser suficiente; antes de difundir el enlace masivamente se debe presupuestar Workers Paid, configurar alertas y establecer límites de gasto. El servicio debe ser gratuito para usuarios, pero su operación no necesariamente será gratuita para el mantenedor.

## Android, iOS y navegador

La respuesta corta es: **sí, los tres, pero inicialmente como una sola PWA**.

| Plataforma | Primera etapa | Experiencia |
|---|---|---|
| Navegador de escritorio | Sí | URL normal, responsive |
| Navegador móvil Android | Sí | Navegador o instalación PWA |
| Android instalado | Sí | Icono, pantalla independiente y datos offline |
| Navegador móvil iOS | Sí | Safari u otro navegador compatible |
| iPhone/iPad instalado | Sí, con limitaciones | “Añadir a pantalla de inicio” |
| Google Play / App Store | No inicialmente | Posible envoltura Capacitor posterior |

Una PWA no es idéntica a una aplicación nativa. En iOS existen restricciones sobre ciertas tareas en segundo plano, notificaciones, Bluetooth y almacenamiento. Por eso la primera versión no debe depender de esas capacidades.

Se evaluará Capacitor después del piloto si se necesita:

- Publicar en Google Play o App Store.
- Notificaciones push más confiables.
- Integración Bluetooth/Wi-Fi Direct.
- Mejor control del almacenamiento.
- Acceso a capacidades específicas del sistema.

No se desarrollarán dos aplicaciones móviles separadas mientras la PWA pueda resolver el caso de uso.

## Plan de desarrollo

### Fase 0 — Producto, riesgos y diseño

**Duración:** 1–2 días.

- Confirmar nombre y alcance.
- Definir usuarios y escenarios.
- Crear mapa de navegación.
- Crear sistema visual.
- Definir fuentes de datos para Ruta Alta.
- Definir política de privacidad inicial.
- Crear criterios de éxito.

### Fase 1 — Base PWA offline

**Duración:** 3–5 días.

- Scaffold del monorepo o aplicación inicial.
- PWA instalable.
- Service Worker.
- IndexedDB.
- Detección de conectividad.
- Outbox genérica.
- Pantalla de estado offline/sincronización.
- CI, lint, typecheck, tests y preview.

### Fase 2 — Tarjeta Médica Offline

**Duración:** 4–7 días.

- Modelo de datos local.
- Cifrado Web Crypto.
- PIN.
- Vista de emergencia.
- Impresión.
- Exportación cifrada.
- Importación de respaldos cifrados.
- Pruebas en Android, iOS y escritorio.

### Fase 3 — Reporte 60 segundos local

**Duración:** 1–3 días para el núcleo local; el backend requiere una etapa separada.

- Formulario de categorías.
- Ubicación aproximada opcional.
- Guardado offline.
- Estado explícito `local-only`.
- Sin texto libre, fotografías ni publicación en esta etapa.

### Fase 4 — Reporte 60 segundos conectado

- Diseñar y revisar el contrato del API.
- API Worker/Hono.
- D1.
- Queue.
- Idempotencia.
- Rate limiting.
- Turnstile adaptativo.
- Moderación básica.
- Vista pública agregada.

### Fase 5 — Ruta Alta piloto

**Duración:** 10–20 días.

- Conseguir y documentar fuentes.
- Preparar capas GIS.
- Validar rutas y puntos.
- Crear paquete offline.
- Integrar MapLibre.
- Mostrar versión y fuente.
- Probar rutas físicamente si es posible.

### Fase 6 — Barrio 24

**Duración:** 15–25 días.

- Grupos privados.
- Invitación QR/enlace.
- Check-in.
- Necesidades y recursos.
- Tareas.
- Sincronización incremental.
- Límites de tamaño por grupo.
- Durable Objects para coordinación activa.
- Revocación y expiración de grupos.

### Fase 6 — Hardening y piloto

**Duración:** 5–10 días.

- Prueba de carga.
- Prueba con conectividad intermitente.
- Prueba de restauración de datos.
- Auditoría de seguridad.
- Revisión de privacidad.
- Accesibilidad.
- Observabilidad.
- Runbook de emergencia.
- Piloto con un edificio, colegio o comunidad.

## Flujo de trabajo con Codex y Claude Code

- Claude Code: planificación, arquitectura, scaffold, módulos grandes, refactors y documentación.
- Codex: tests, validaciones, correcciones focalizadas, revisión cruzada, pruebas de carga y hardening.
- Ramas por fase: `feature/00-foundation`, `feature/01-medical-card`, etc.
- Plan antes de escribir código.
- Commits pequeños y descriptivos.
- Datos sintéticos durante desarrollo.
- No publicar, desplegar ni cambiar producción sin revisión manual.
- Cada módulo debe incluir tests unitarios, e2e y un escenario offline.

## Pruebas mínimas antes de un piloto

- Abrir la PWA con red.
- Instalarla en Android.
- Añadirla a pantalla de inicio en iOS.
- Activar modo avión.
- Crear y mostrar una tarjeta médica.
- Crear un reporte sin conexión.
- Cerrar y reabrir el navegador.
- Recuperar conexión y verificar sincronización única.
- Simular respuestas duplicadas.
- Simular API caída.
- Cargar miles de lecturas públicas.
- Enviar spam controlado.
- Verificar que no aparezcan datos médicos en logs.
- Probar contraste, teclado, tamaño de texto y lectores de pantalla.

## Métricas de éxito

No se medirá solo el número de visitas.

- Tiempo para crear una Tarjeta Médica Offline.
- Porcentaje de usuarios que puede abrirla en modo avión.
- Tiempo para crear un Reporte 60 segundos.
- Porcentaje de reportes sincronizados sin duplicarse.
- Tiempo para que un grupo conozca el estado de sus miembros.
- Porcentaje de mapas descargados antes de una emergencia.
- Tasa de errores por cada mil operaciones.
- Tiempo de recuperación después de una caída del API.

## No entra todavía

- Predicción de terremotos.
- Integración con SEIDAS.
- Chat público.
- Red social.
- Diagnóstico médico automático.
- Evaluación automática de seguridad estructural.
- Fotografías como requisito del reporte.
- IA para decidir prioridades de rescate.
- Sustitución de fuentes o autoridades oficiales.

SEIDAS podrá evaluarse en el futuro mediante una integración oficial y documentada, pero ninguna fase inicial depende de él.

## Estado de esta rama

Esta rama deja implementados el núcleo local de Reporte 60 segundos, el primer flujo de sincronización manual contra staging y controles de exportación/borrado local. El siguiente paso requiere pruebas de carga/abuso, QA físico de sincronización y definición de moderación antes de cualquier uso real. La Fase 0 dejó estos hitos verificables:

1. se instala como PWA;
2. muestra claramente si está offline;
3. guarda datos localmente;
4. conserva esos datos al cerrar y reabrir;
5. tiene una cola de sincronización demostrable con datos sintéticos.
