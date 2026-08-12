# Barrio 24 — instrucciones para agentes

## Alcance actual

El proyecto está en la Fase 0: scaffold de PWA offline-first. No implementar todavía los módulos de Tarjeta Médica, Reporte 60 segundos, Ruta Alta o Barrio 24 salvo que se solicite expresamente.

## Reglas

- Trabajar en ramas `feature/*` o `fix/*`; no modificar `main` directamente.
- Inspeccionar el repositorio y este archivo antes de cambiar código.
- Mantener VS Code, TypeScript estricto y la PWA como centro del producto.
- No introducir credenciales, datos médicos reales, ubicaciones reales ni secretos.
- No desplegar producción ni crear recursos de Cloudflare sin aprobación explícita.
- No añadir una aplicación nativa independiente mientras la PWA sea suficiente.
- Mantener la operación offline como requisito funcional, no como mejora futura.
- Evitar dependencias innecesarias y componentes visuales genéricos.
- Ejecutar lint, typecheck, tests y build antes de proponer un commit.
- Revisar `git diff` y `git status` al terminar.

## Flujo recomendado

1. Diagnóstico y plan breve.
2. Implementación acotada a una fase.
3. Tests y smoke checks.
4. Revisión visual y de accesibilidad.
5. Diff final.
6. Commit descriptivo y PR cuando corresponda.

