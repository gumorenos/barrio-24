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

La cola sintética de la pantalla inicial sigue siendo deliberadamente una simulación. No debe confundirse con una confirmación de servidor.

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
6. El usuario puede exportar el conjunto local en JSON y borrar reportes individuales o todas las copias locales.

El Worker y D1 de staging ya existen y fueron validados con smoke tests remotos. La aplicación puede activar un envío manual si `VITE_REPORTS_API_URL` está configurada; sin esa variable permanece completamente local. No hay feed público, no se envía información médica ni se acepta texto libre, fotos o coordenadas exactas.

Los reportes nuevos se guardan como `unverified` en el API. La retención inicial es de 30 días y el Worker de staging tiene una tarea diaria de eliminación. Chromium validó la sincronización y el propietario validó manualmente la geolocalización en Arc Search para iPhone; todavía falta completar QA físico de sincronización y pruebas de abuso antes de usuarios reales.

Para probar el envío manual en local, copia `.env.example` a `.env.local`, descomenta `VITE_REPORTS_API_URL` y ejecuta `npm run dev` o `npm run build && npm run preview`. No uses datos reales en staging.

## Revisión antes de commit

```bash
npm run check
git status --short
git diff --stat
```
