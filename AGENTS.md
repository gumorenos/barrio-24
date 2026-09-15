# Barrio 24 — instrucciones para agentes

## Alcance actual

La **Fase 4 — Reporte 60 segundos conectado en staging está formalmente cerrada**. La fase activa es la **Fase 5 — Ruta Alta piloto, preparación de entrada**. La PWA offline-first, Tarjeta Médica Offline local y Reporte 60 segundos conectado permanecen disponibles en staging; producción continúa en NO-GO.

F5 no autoriza todavía a publicar mapas o rutas. Antes de implementar/publicar Ruta Alta debe existir al menos una fuente oficial con bytes verificables, hash, CRS/geometría conocidos, vigencia/edición documentada, licencia o permiso compatible con transformación y redistribución offline, y revisión humana aprobada. No inferir seguridad de una ruta ni licencia a partir de que un documento sea públicamente accesible.

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
