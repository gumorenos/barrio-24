# Barrio 24 — instrucciones para agentes

## Alcance actual

El proyecto está en la **Fase 4 conectada de staging**: PWA offline-first, Tarjeta Médica Offline local, Reporte 60 segundos con captura offline y sincronización manual, Worker/D1 de staging y consola operativa de moderación protegida por Cloudflare Access. Los reportes remotos permanecen `unverified`; no hay feed público y producción no está autorizada. Ruta Alta y Barrio 24 siguen fuera del alcance actual.

El roadmap detallado y sus puertas de avance viven en [`docs/product/roadmap.md`](docs/product/roadmap.md). Es la fuente de verdad para módulos, fases, dependencias, límites y próximo orden de trabajo. Si otro documento contradice su secuencia o sus puertas, actualizar primero la documentación o seguir el roadmap vigente; no avanzar de fase por inferencia.

## Reglas

- Trabajar en ramas `feature/*` o `fix/*`; no modificar `main` directamente.
- Inspeccionar el repositorio, este archivo y `docs/product/roadmap.md` antes de cambiar código.
- Mantener el trabajo dentro de la fase activa y no declarar una puerta superada sin evidencia verificable.
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
