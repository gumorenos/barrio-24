# Reporte 60 segundos

## Propósito

Permitir que una persona registre rápidamente una situación observable después de una emergencia, incluso si no tiene conexión. La primera etapa prioriza la captura clara y la privacidad; no intenta ser todavía una red de alertas ni un canal oficial.

## Alcance actual

El formulario permite:

- elegir una categoría;
- indicar la gravedad percibida como “situación observada”, “requiere atención” o “riesgo inmediato”;
- añadir voluntariamente una zona aproximada;
- guardar el reporte en IndexedDB;
- consultar los cinco reportes locales más recientes.
- sincronizar manualmente los reportes guardados cuando se configure un API de staging;
- exportar los reportes locales como JSON;
- borrar un reporte o todas las copias locales.

No permite todavía:

- texto libre;
- fotografías, audio o video;
- cuentas o perfiles;
- publicación para otros usuarios;
- validación por autoridades o moderadores;
- afirmaciones sobre seguridad de una calle, edificio o persona.

## Datos almacenados

Cada registro contiene únicamente:

- identificador aleatorio del dispositivo;
- versión del esquema;
- categoría;
- gravedad observada;
- fecha de creación;
- estado local (`local-only`, `pending` o `sync-failed`) o remoto `unverified`;
- celda geográfica aproximada opcional.

La celda se calcula redondeando la latitud y longitud a una cuadrícula de aproximadamente 1 km antes de escribir en IndexedDB. Las coordenadas exactas no se almacenan.

La exportación contiene únicamente el contrato local permitido: identificador del evento, categoría, gravedad, fecha, estado y celda aproximada. Borrar una copia local no elimina un evento que ya se haya sincronizado al staging; ese registro sigue la política remota de retención.

## Lenguaje obligatorio

La interfaz debe diferenciar siempre entre:

- **guardado local:** existe en el dispositivo del usuario;
- **enviado:** una futura API recibió el evento;
- **confirmado:** una futura API lo aceptó de forma idempotente;
- **verificado:** un moderador o fuente autorizada revisó el reporte.

La versión local solo puede usar “guardado local”. La versión de staging puede indicar que el API recibió el evento, pero debe aclarar que sigue `unverified`. No se deben usar “alerta enviada”, “zona segura” ni “atención garantizada”.

## Límites actuales y siguientes decisiones

Antes de conectar usuarios reales se necesita definir y revisar:

1. contrato versionado del API;
2. idempotencia por `event_id`;
3. límites de tamaño y frecuencia;
4. protección contra abuso;
5. retención y eliminación de reportes;
6. redondeo y política de exposición geográfica;
7. cola y comportamiento cuando el backend esté saturado;
8. panel de moderación y estados de verificación.

Cloudflare y D1 ya tienen un entorno de staging aislado. El contrato, la idempotencia, los límites básicos, la retención y la sincronización en Chromium están validados; la geolocalización también fue validada manualmente en Arc Search para iPhone. Falta completar QA físico de sincronización, pruebas de abuso, revisión de seguridad/privacidad y definir moderación/consulta pública antes de cualquier uso real.
