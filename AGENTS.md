# Barrio 24 — instrucciones para agentes

## Alcance actual

El proyecto está en la Fase 2 conectada de staging: PWA offline-first, Tarjeta Médica Offline local y captura de Reporte 60 segundos. Existe un Worker/D1 de staging y la PWA puede sincronizar manualmente cuando `VITE_REPORTS_API_URL` está configurada. Los reportes remotos permanecen `unverified`; no hay feed público ni moderación operativa. Ruta Alta y Barrio 24 siguen fuera del alcance actual.

## Reglas

- Trabajar en ramas `feature/*` o `fix/*`; no modificar `main` directamente.
- Inspeccionar el repositorio y este archivo antes de cambiar código.
- Mantener VS Code, TypeScript estricto y la PWA como centro del producto.
- No introducir credenciales, datos médicos reales, ubicaciones reales ni secretos.
- No desplegar producción ni crear recursos de Cloudflare sin aprobación explícita.
- No añadir una aplicación nativa independiente mientras la PWA sea suficiente.
- Mantener la operación offline como requisito funcional, no como mejora futura.
- Mantener una separación visible entre “guardado local” y “enviado/confirmado por servidor”; no simular confirmaciones remotas.
- Mantener exportación y borrado explícitos para los reportes locales; borrar la copia local no implica borrar un registro remoto.
- Evitar dependencias innecesarias y componentes visuales genéricos.
- No guardar coordenadas exactas en los reportes; solo una celda geográfica aproximada cuando el usuario la autorice.
- Ejecutar lint, typecheck, tests y build antes de proponer un commit.
- Revisar `git diff` y `git status` al terminar.

## Flujo recomendado

1. Diagnóstico y plan breve.
2. Implementación acotada a una fase.
3. Tests y smoke checks.
4. Revisión visual y de accesibilidad.
5. Diff final.
6. Commit descriptivo y PR cuando corresponda.
