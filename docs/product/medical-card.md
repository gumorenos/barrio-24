# Tarjeta Médica Offline

## Alcance de la primera implementación

La tarjeta es un módulo local de Barrio 24 para guardar una cantidad pequeña de información que podría ser útil durante una emergencia, cuando no exista conexión o la persona no pueda explicar su situación.

La primera implementación incluye:

- nombre o alias;
- año de nacimiento, sin guardar la fecha completa;
- tipo de sangre autodeclarado;
- alergias;
- medicamentos y dosis;
- condiciones médicas relevantes;
- necesidades de accesibilidad;
- un contacto de emergencia;
- indicaciones críticas;
- código de acceso local;
- vista de emergencia con cierre automático a los 60 segundos;
- exportación e importación de un respaldo cifrado;
- borrado explícito del respaldo local.

No incluye cuenta, servidor, analítica, sincronización, DNI, dirección, historia clínica, fotografías ni QR.

## Modelo de privacidad

El contenido de la tarjeta no se envía a Barrio 24. Se cifra antes de guardarse en IndexedDB:

1. Se genera un salt aleatorio de 16 bytes.
2. El código de acceso se transforma en una clave mediante PBKDF2-SHA-256 con 150 000 iteraciones.
3. La información se cifra con AES-GCM de 256 bits y un IV nuevo de 12 bytes.
4. IndexedDB conserva el salt, el IV, el texto cifrado y la fecha de actualización.
5. El código no se guarda.

Mientras la tarjeta está desbloqueada, sus datos existen temporalmente en la memoria de la aplicación para poder mostrarlos y editarlos. Al bloquearla o cerrar la aplicación, la interfaz limpia esa sesión. Esto no protege contra un dispositivo comprometido, extensiones maliciosas, malware, copias de seguridad del sistema operativo o una persona que ya tenga acceso al dispositivo desbloqueado.

## Respaldo

La exportación produce `barrio24-tarjeta-cifrada.json`. El archivo no contiene la información médica en texto legible, pero debe tratarse como sensible porque cualquiera que obtenga el archivo podría intentar atacarlo fuera de la aplicación. El código de acceso sigue siendo necesario para importarlo y abrirlo.

Perder el código implica perder el acceso al contenido. No existe recuperación remota y Barrio 24 no puede restablecerlo.

## Vista de emergencia

La vista está pensada para que el titular pueda mostrar la información a una persona que lo ayude. Tiene alto contraste, indica que los datos son declarados por el titular y se cierra automáticamente después de 60 segundos.

El tipo de sangre siempre se marca como “autodeclarado; confirmar antes de usar”. La tarjeta no autoriza tratamientos ni reemplaza una evaluación médica.

## Criterios de aceptación

- Crear una tarjeta con el dispositivo en modo avión.
- Cerrar y volver a abrir la PWA.
- Confirmar que el contenido continúa bloqueado.
- Abrirla con el código correcto y rechazar un código incorrecto.
- Editar y guardar sin crear texto médico en logs, URLs o solicitudes de red.
- Mostrar la vista de emergencia y comprobar el cierre automático.
- Exportar, borrar, importar y volver a abrir el respaldo.
- Aumentar el tamaño de texto y navegar los formularios con teclado.

## Fuera de alcance

No se debe añadir sincronización, QR, lectura automática de documentos, recomendaciones médicas ni integración con servicios de salud sin una decisión de producto independiente, revisión de seguridad y revisión legal especializada.
