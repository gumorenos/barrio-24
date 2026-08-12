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
```

`npm run check` ejecuta typecheck, tests y build.

## Qué demuestra la Fase 0

1. La PWA genera manifest y Service Worker.
2. El estado online/offline se refleja en la interfaz.
3. Una operación sintética queda guardada en IndexedDB.
4. La operación permanece después de cerrar y reabrir la aplicación.
5. La cola puede marcarse como procesada localmente mientras no existe backend.

La sincronización actual es deliberadamente una simulación. No debe confundirse con una confirmación de servidor ni usarse con información real.

## Revisión antes de commit

```bash
npm run check
git status --short
git diff --stat
```

