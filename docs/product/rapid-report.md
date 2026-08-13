# Reporte 60 segundos

## Propósito

Permitir que una persona registre rápidamente una situación observable después de una emergencia, incluso si no tiene conexión. La primera etapa prioriza la captura clara y la privacidad; no intenta ser todavía una red de alertas ni un canal oficial.

## Alcance local actual

El formulario permite:

- elegir una categoría;
- indicar la gravedad percibida como “situación observada”, “requiere atención” o “riesgo inmediato”;
- añadir voluntariamente una zona aproximada;
- guardar el reporte en IndexedDB;
- consultar los cinco reportes locales más recientes.

No permite todavía:

- texto libre;
- fotografías, audio o video;
- cuentas o perfiles;
- envío a un servidor;
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
- estado `local-only`;
- celda geográfica aproximada opcional.

La celda se calcula redondeando la latitud y longitud a una cuadrícula de aproximadamente 1 km antes de escribir en IndexedDB. Las coordenadas exactas no se almacenan.

## Lenguaje obligatorio

La interfaz debe diferenciar siempre entre:

- **guardado local:** existe en el dispositivo del usuario;
- **enviado:** una futura API recibió el evento;
- **confirmado:** una futura API lo aceptó de forma idempotente;
- **verificado:** un moderador o fuente autorizada revisó el reporte.

La versión local solo puede usar “guardado local”. No se deben usar “alerta enviada”, “reporte recibido”, “zona segura” ni “atención garantizada”.

## Próximo límite técnico

Antes de implementar sincronización se necesita definir y revisar:

1. contrato versionado del API;
2. idempotencia por `event_id`;
3. límites de tamaño y frecuencia;
4. protección contra abuso;
5. retención y eliminación de reportes;
6. redondeo y política de exposición geográfica;
7. cola y comportamiento cuando el backend esté saturado;
8. panel de moderación y estados de verificación.

La conexión a Cloudflare, la creación de recursos y el QA en dispositivos deben ocurrir después de esa revisión.
