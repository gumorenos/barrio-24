# QA pendiente — Fase 4 Reporte 60 segundos

Actualizado: 2026-08-25 America/Lima  
Rama de trabajo: `feature/f4-readiness-f5-prep`  
Entorno permitido para este checklist: **staging y datos sintéticos**.  
Producción y `main`: **NO-GO / no tocar**.

Este es el único backlog operativo de QA pendiente de la Fase 4. El detalle de producto y las puertas de avance viven en `docs/product/roadmap.md`; el procedimiento de staging vive en `docs/operations/rapid-report-staging-runbook.md`.

## Estado actual

Implementado y persistido en la rama:

- PWA offline-first, Tarjeta Médica Offline y Reporte 60 segundos local.
- Worker/D1 de staging con recepción `unverified`, idempotencia, rate limiting y retención.
- Moderación y auditoría D1.
- Consola same-origin en `/v1/ops/` protegida por Cloudflare Access.
- Generador fail-closed de `api/wrangler.toml` desde variables no secretas.
- Smoke público, probe de abuso y carga controlada restringidos al staging conocido.
- Check D1 remoto de solo lectura para tablas/columnas/índices `0001`–`0004`.
- Readiness read-only ligado a SHA candidato, rama segura y worktree limpio.
- Evidencia privada ligada al SHA y agregador P0/P1.
- Tooling preparatorio de Ruta Alta; no abre Fase 5 ni autoriza mapas/rutas.

Wrangler se fija explícitamente a `4.125.0` en los comandos mediante `npx --package=wrangler@4.125.0`. **No está instalado ni fijado en `package-lock.json`**; el primer uso de esos comandos necesita acceso al registro npm.

## QA ejecutado por ChatGPT el 25-08-2026

### PASS

- `node --test api/scripts/*.test.mjs`: **53/53 PASS**.
- Cobertura de tooling F4 incluida en esos tests:
  - configuración Wrangler y fail-closed;
  - target staging y namespace de Rate Limiting;
  - smoke público;
  - abuso público;
  - carga acotada;
  - schema D1 read-only;
  - evidencia y agregación P0/P1;
  - SHA/rama/worktree del readiness;
  - timeout y límite de salida de subprocess.
- `node --check` sobre los scripts de Ruta Alta disponibles en el workspace (`source-catalog.mjs`, `source-fetch.mjs`, `zip-inspect.mjs`): PASS.
- README corregido a Fase 4 y fases 0–7 sin numeración duplicada.
- Roadmap actualizado para reflejar que la reproducibilidad F4 ya está implementada y que F5 sigue solo en preparación/investigación.

### No ejecutado en este entorno

No se presentan como PASS:

- `npm ci` sobre un checkout completo de la rama;
- `npm run check` completo (frontend/API/Vitest/build + tooling);
- suite completa `test:product-tools` de Ruta Alta;
- Wrangler `deploy --dry-run` / `check startup`;
- consultas D1 remotas;
- smoke/abuso/carga contra el Worker real;
- Access interactivo y consola operativa;
- QA en iPhone/Android físico.

Motivo: el entorno de ChatGPT de esta ejecución no tiene DNS/salida directa a GitHub/npm/Cloudflare ni un checkout completo con dependencias. Estos puntos deben ejecutarse desde un terminal autenticado con acceso a staging.

## P0 — antes de desplegar el candidato de staging

- [ ] Hacer checkout de `feature/f4-readiness-f5-prep` y confirmar `git status --short` vacío.
- [ ] Registrar el SHA exacto: `CANDIDATE_SHA=$(git rev-parse HEAD)`.
- [ ] Ejecutar `npm ci`.
- [ ] Ejecutar `npm run check` y exigir PASS completo.
- [ ] Obtener el **namespace ID real** del binding `REPORTS_RATE_LIMITER`; no inventarlo ni reutilizar otro namespace.
- [ ] Crear localmente `api/staging-config.env` a partir de `api/staging-config.env.example` con los valores autorizados de staging.
- [ ] Ejecutar `npm run staging:config` y revisar que `api/wrangler.toml` apunte solo a:
  - cuenta `9d3274c57217e9cf44020bec6d754fb7`;
  - Worker `barrio24-reports-api-staging`;
  - D1 `barrio24-reports-staging`;
  - D1 ID `eca7ac80-6859-40d5-89db-ba1bb6c61173`;
  - Pages `https://feature-02-rapid-report.barrio24-staging.pages.dev`;
  - cron `0 5 * * *`.
- [ ] Ejecutar la suite read-only:

```bash
npm run staging:readiness-readonly -- --execute --expected-sha="$CANDIDATE_SHA"
```

- [ ] Exigir PASS en `npm run check`, Wrangler dry-run/startup, migrations list y schema D1.
- [ ] Confirmar que la evidencia JSON quedó en `artifacts/staging-readiness/` y corresponde al mismo SHA.

**Condición de parada:** cualquier SHA distinto, rama `main`, worktree sucio, recurso Cloudflare no esperado, secreto impreso, migración inesperada o necesidad de crear `REPORTS_OPERATIONS_TOKEN`.

## P0 — después del deploy de staging

### Superficie pública

- [ ] `GET /api/health` → `200`.
- [ ] Ejecutar smoke con datos sintéticos:

```bash
npm run staging:public-smoke -- --execute --expected-sha="$CANDIDATE_SHA"
```

- [ ] Confirmar `POST /v1/reports` → `202 unverified` para un evento nuevo.
- [ ] Repetir el mismo `event_id` → `409` con `duplicate: true`.
- [ ] Confirmar CORS únicamente para el origen Pages de staging.

### Abuso/privacidad

- [ ] Ejecutar:

```bash
npm run staging:public-abuse -- --execute --expected-sha="$CANDIDATE_SHA"
```

- [ ] Rechazar JSON inválido, campos extra de coordenadas exactas, precisión excesiva de ubicación, categoría/fecha inválidas y payload >2 KB.
- [ ] Verificar que ninguno de esos probes crea un reporte válido.
- [ ] Confirmar ausencia de datos médicos, texto libre, `lat`, `lng`, `latitude` o `longitude` en D1/respuestas/logs.

### D1 y migraciones

- [ ] Confirmar que `wrangler d1 migrations list ... --remote` no muestra migraciones esperadas sin aplicar.
- [ ] `npm run staging:d1-schema-check -- --execute --expected-sha="$CANDIDATE_SHA"` → PASS.
- [ ] Confirmar `reports.last_moderation_event_id`.
- [ ] Confirmar `report_moderation_events` y sus índices.
- [ ] Confirmar auditoría con actor, transición, motivo, `occurred_at`, `request_id` e idempotency key, sin datos ciudadanos extra.

## P0 — Access, consola y moderación interactiva

Requiere una sesión real de Cloudflare Access; no guardar JWT ni tokens en Git/evidencia.

- [ ] Access protege **solo** `/v1/ops/*`.
- [ ] Sin sesión válida → login/denegación; con usuario fuera de allowlist → denegación.
- [ ] `gumorenos@gmail.com` autorizado → consola `200`.
- [ ] Respuestas operativas no incluyen CORS abierto.
- [ ] Origin cross-site no puede usar la consola/API operativa.
- [ ] Lista/filtros/resumen/historial no exponen datos fuera del contrato.
- [ ] `verify`: `unverified → verified`.
- [ ] `resolve`: `verified → resolved`.
- [ ] `mark-duplicate`: `unverified → duplicate`.
- [ ] `expire` solo desde estados permitidos; `expired` terminal.
- [ ] Decisión inválida / motivo vacío / IDs inválidos → 4xx esperado.
- [ ] Misma `Idempotency-Key` → mismo resultado sin nueva auditoría.
- [ ] Misma key para otro reporte → `409 idempotency_conflict`.
- [ ] Dos decisiones simultáneas sobre el mismo estado: solo una transición y una auditoría.
- [ ] D1 no disponible → `503 storage_unavailable` sin stack trace.

## P1 — carga y decisión Queue/Turnstile

Ejecutar solo contra staging y con datos sintéticos.

```bash
npm run staging:controlled-load -- --profile=rate-limit --execute --expected-sha="$CANDIDATE_SHA"
npm run staging:controlled-load -- --profile=burst --execute --expected-sha="$CANDIDATE_SHA"
```

- [ ] Guardar distribución HTTP, p50/p95 y cantidad `202`/`429`/errores.
- [ ] Confirmar que el limiter se comporta como protección gruesa; no asumir cuota estricta.
- [ ] Documentar decisión: persistencia directa vs Queue.
- [ ] Documentar decisión: Turnstile sí/no y criterio que la justifica.
- [ ] Ejecutar `npm run staging:evidence-summary -- --expected-sha="$CANDIDATE_SHA" --level=p1` y revisar completitud automatizada.

`COMPLETE` en el agregador **no significa GO de producción**.

## P1 — dispositivos, offline y accesibilidad

- [ ] iPhone Safari/Arc: permiso de ubicación permitido/denegado, captura, offline, reconexión y sincronización única.
- [ ] Android Chrome: instalación PWA, modo avión, reconexión, cola y sincronización.
- [ ] Cerrar/reabrir navegador conserva tarjeta y reportes locales.
- [ ] API caída/timeout no pierde el reporte local.
- [ ] Contraste, zoom/tamaño de texto, teclado y lector de pantalla básicos.
- [ ] Confirmar ausencia de overflow/errores CSP/consola en móvil.

## P0 — revisión de seguridad y privacidad antes de cerrar F4

- [ ] Revisar headers y CSP de Pages y consola Worker.
- [ ] Revisar que Access/JWT/configuración no queden en logs o artefactos.
- [ ] Revisar retención: reportes 30 días, auditoría 180 días.
- [ ] Ejecutar cron con datos sintéticos y confirmar borrado selectivo.
- [ ] Revisar minimización de ubicación y ausencia de identificadores personales.
- [ ] Registrar bloqueadores y resolver todos los P0 antes de abrir implementación F5.

## F5 — QA/preparación pendiente, no bloquea el deploy de F4 staging

- [ ] Resolver licencia explícita de transformación/redistribución offline de las fuentes seleccionadas.
- [ ] Descargar y auditar bytes oficiales; registrar hash real.
- [ ] Resolver CRS, edición/vigencia y revisión humana.
- [ ] Mantener `packagingEligible=false` mientras falte cualquiera de esos campos.
- [ ] No publicar mapas ni rutas como oficiales/seguras antes de superar la puerta de entrada F5.

## Evidencia mínima a conservar

Para cada ejecución remota registrar sin secretos:

- rama y SHA exactos;
- `npm run check`;
- nombre/Version ID del Worker desplegado;
- D1 y migraciones;
- resultados readiness/smoke/abuso/carga;
- IDs exclusivamente sintéticos;
- resultado de Access/console/moderación;
- limitaciones de dispositivos;
- confirmación explícita de que `main`, producción, datos reales y `REPORTS_OPERATIONS_TOKEN` no fueron tocados.
