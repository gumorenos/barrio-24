# Desarrollo local

## Requisitos

- Node.js 22 o superior.
- npm 11 o superior.
- Navegador moderno con soporte para Service Worker e IndexedDB.

## Comandos

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
npm run typecheck:api
```

`npm run check` ejecuta typecheck del frontend y del Worker, tests y build del frontend.

## Qué demuestra la base de Fase 0

1. La PWA genera manifest y Service Worker.
2. El estado online/offline se refleja en la interfaz.
3. Una operación sintética queda guardada en IndexedDB.
4. La operación permanece después de cerrar y reabrir la aplicación.
5. La cola puede marcarse como procesada localmente mientras no existe backend.

La sincronización actual es deliberadamente una simulación. No debe confundirse con una confirmación de servidor ni usarse con información real.

## Qué demuestra la Fase 1

1. La tarjeta médica puede crearse sin cuenta ni conexión.
2. El contenido se cifra con AES-GCM usando una clave derivada del código mediante PBKDF2.
3. IndexedDB conserva únicamente el sobre cifrado, no el texto médico.
4. La tarjeta se bloquea al cerrar o bloquear la sesión de la aplicación.
5. La vista de emergencia se muestra temporalmente y se cierra después de 60 segundos.
6. Se puede exportar e importar un respaldo cifrado.
7. El usuario puede borrar el respaldo local.

La tarjeta no sincroniza información médica, no reemplaza una evaluación profesional y no debe probarse con datos reales durante el desarrollo automatizado.

## Qué demuestra la Fase 2 inicial

1. Una persona puede elegir una categoría de Reporte 60 segundos sin conexión.
2. Puede registrar una gravedad observada, diferenciada de una clasificación profesional.
3. Puede añadir una zona aproximada de alrededor de 1 km, sin guardar coordenadas exactas.
4. El reporte queda en IndexedDB con estado `local-only`.
5. La interfaz no afirma que el reporte se haya enviado, publicado o verificado.

Esta etapa todavía no contiene un Worker conectado, D1 configurado, Queue, moderación, consulta pública ni sincronización. Existe un esqueleto aislado en `api/` para revisión posterior. La ubicación requiere validación manual en dispositivos reales antes de habilitar cualquier flujo remoto.

## Revisión antes de commit

```bash
npm run check
git status --short
git diff --stat
```
