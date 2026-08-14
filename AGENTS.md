# Barrio 24 — instrucciones para agentes

## Alcance actual

El proyecto está en la Fase 2 inicial: scaffold de PWA offline-first, Tarjeta Médica Offline local y captura de Reporte 60 segundos. Existe un Worker/D1 de staging y la PWA puede sincronizar manualmente cuando `VITE_REPORTS_API_URL` está configurada. No hay feed público ni moderación operativa; los reportes remotos permanecen `unverified`. Ruta Alta y Barrio 24 siguen fuera del alcance actual.

## Reglas

- Trabajar en ramas `feature/*` o `fix/*`; no modificar `main` directamente.
- Inspeccionar el repositorio y este archivo antes de cambiar código.
- Mantener VS Code, TypeScript estricto y la PWA como centro del producto.
- No introducir credenciales, datos médicos reales, ubicaciones reales ni secretos.
- No desplegar producción ni crear recursos de Cloudflare sin aprobación explícita.
- No añadir una aplicación nativa independiente mientras la PWA sea suficiente.
- Mantener la operación offline como requisito funcional, no como mejora futura.
- Mantener una separación visible entre “guardado local” y “enviado/confirmado por servidor”; no simular confirmaciones remotas.
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
