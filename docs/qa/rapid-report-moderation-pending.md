# QA pendiente — Fase 4 Reporte 60 segundos

Actualizado: 2026-08-25 America/Lima  
Rama de trabajo: `feature/f4-readiness-f5-prep`  
Entorno permitido para este checklist: **staging y datos sintéticos**.  
Producción y `main`: **NO-GO / no tocar**.

Este es el backlog operativo único de QA pendiente de la Fase 4. El roadmap vive en `docs/product/roadmap.md` y el procedimiento de staging en `docs/operations/rapid-report-staging-runbook.md`.

## Estado implementado

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

Wrangler se fija explícitamente a `4.125.0` en los comandos mediante `npx --package=wrangler@4.125.0`. No está instalado ni fijado en `package-lock.json`; el primer uso de esos comandos necesita acceso al registro npm.

## QA automatizado cerrado

### GitHub Actions — PASS

Run: `32911472728`  
SHA probado: `a2fad8ae61344b9ef500136944eda330c5cf3798`  
Node: `22.23.2`  
Resultado: **SUCCESS**.

El workflow ejecutó sobre un checkout real de la rama:

- `npm ci`: PASS; 378 paquetes instalados, 379 auditados, **0 vulnerabilidades**.
- Typecheck frontend (`tsc -b`): PASS.
- Typecheck API: PASS.
- Vitest: **33/33 PASS** en 7 archivos.
- Tooling F4: **53/53 PASS**.
- Tooling Ruta Alta: **31/31 PASS**.
- Build Vite/PWA: PASS; Service Worker generado.

Total de tests automatizados ejecutados en ese SHA: **117 PASS, 0 FAIL**.

El CI no despliega, no usa secretos de Cloudflare y tiene `contents: read`.

### Correcciones documentales posteriores

- README alineado a Fase 4 y enlazado al roadmap.
- Numeración corregida a Fases 0–7; ya no existe una segunda Fase 6.
- Roadmap actualizado para distinguir F4 implementada vs. puertas todavía abiertas.
- Este archivo consolidado como único backlog de QA pendiente.

Estas correcciones no modifican código frontend/API ni el contrato runtime probado por el CI anterior. Antes de desplegar, de todas formas se vuelve a ejecutar `npm run check` sobre el SHA candidato final.

## P0 — antes de desplegar el candidato de staging

- [ ] Checkout de `feature/f4-readiness-f5-prep` y `git status --short` vacío.
- [ ] Registrar SHA exacto: `CANDIDATE_SHA=$(git rev-parse HEAD)`.
- [ ] `npm ci`.
- [ ] `npm run check` → PASS completo sobre ese SHA.
- [ ] Obtener el **namespace ID real** de `REPORTS_RATE_LIMITER`; no inventarlo ni reutilizar otro namespace sin intención explícita de compartir contadores.
- [ ] Crear localmente `api/staging-config.env` desde `api/staging-config.env.example`.
- [ ] Confirmar que la configuración apunta únicamente a:
  - cuenta `9d3274c57217e9cf44020bec6d754fb7`;
  - Worker `barrio24-reports-api-staging`;
  - D1 `barrio24-reports-staging`;
  - D1 ID `eca7ac80-6859-40d5-89db-ba1bb6c61173`;
  - Pages `https://feature-02-rapid-report.barrio24-staging.pages.dev`;
  - cron `0 5 * * *`.
- [ ] `npm run staging:config`.
- [ ] Ejecutar el gate no mutante:

```bash
npm run staging:readiness-readonly -- --execute --expected-sha="$CANDIDATE_SHA"
```

- [ ] Exigir PASS en Wrangler dry-run/startup, migrations list y schema D1.
- [ ] Verificar evidencia JSON en `artifacts/staging-readiness/` ligada al mismo SHA.

**Parar inmediatamente** ante SHA distinto, rama `main`, worktree sucio, recurso Cloudflare no esperado, secreto impreso, migración inesperada o cualquier solicitud de crear `REPORTS_OPERATIONS_TOKEN`.

## P0 — deploy y smoke de staging

No desplegar Pages para este candidato salvo que cambie código frontend. El origen Pages existente debe mantenerse para no cambiar CORS accidentalmente.

Después de que el gate read-only pase:

- [ ] Desplegar únicamente `barrio24-reports-api-staging`.
- [ ] Registrar nuevo Worker Version ID.
- [ ] `GET /api/health` → `200`.
- [ ] Ejecutar:

```bash
npm run staging:public-smoke -- --execute --expected-sha="$CANDIDATE_SHA"
npm run staging:public-abuse -- --execute --expected-sha="$CANDIDATE_SHA"
```

- [ ] Evento sintético nuevo → `202 unverified`.
- [ ] Mismo `event_id` → `409` y `duplicate: true`.
- [ ] CORS solo permite el origen Pages de staging.
- [ ] Payloads inválidos/precisión excesiva/coordenadas exactas/cuerpo >2 KB se rechazan.
- [ ] Ningún probe inválido crea una fila válida.

## P0 — D1 y migraciones

- [ ] `wrangler d1 migrations list ... --remote` no muestra migraciones esperadas sin aplicar.
- [ ] `npm run staging:d1-schema-check -- --execute --expected-sha="$CANDIDATE_SHA"` → PASS.
- [ ] Existe `reports.last_moderation_event_id`.
- [ ] Existe `report_moderation_events` y sus índices.
- [ ] Auditoría contiene actor, transición, motivo, `occurred_at`, `request_id` e idempotency key sin datos ciudadanos extra.
- [ ] No aparecen datos médicos, texto libre ni `lat`/`lng`/`latitude`/`longitude` en D1, respuestas o logs.

Si aparecen migraciones pendientes, **no aplicar automáticamente**. Revisar primero si pertenecen al candidato y si corresponde aplicarlas únicamente a staging.

## P0 — Access, consola y moderación interactiva

Requiere una sesión real de Cloudflare Access. No guardar JWT ni tokens en Git/evidencia.

- [ ] Access protege únicamente `/v1/ops/*`.
- [ ] `POST /v1/reports` sigue público en staging.
- [ ] Sin sesión válida / usuario fuera de allowlist → denegación.
- [ ] `gumorenos@gmail.com` autorizado → consola `200`.
- [ ] Respuestas operativas no exponen CORS abierto.
- [ ] Origin cross-site no puede usar la superficie operativa.
- [ ] Lista, filtros, resumen e historial respetan el contrato mínimo.
- [ ] `verify`: `unverified → verified`.
- [ ] `resolve`: `verified → resolved`.
- [ ] `mark-duplicate`: `unverified → duplicate`.
- [ ] `expire` solo desde estados permitidos; `expired` terminal.
- [ ] Decisiones inválidas y IDs inválidos → 4xx esperado.
- [ ] Misma `Idempotency-Key` → mismo resultado sin nueva auditoría.
- [ ] Misma key para otro reporte → `409 idempotency_conflict`.
- [ ] Dos decisiones simultáneas sobre el mismo estado → una sola transición/auditoría.
- [ ] D1 no disponible → `503 storage_unavailable` sin stack trace.

## P1 — carga y decisión Queue/Turnstile

Solo staging y datos sintéticos:

```bash
npm run staging:controlled-load -- --profile=rate-limit --execute --expected-sha="$CANDIDATE_SHA"
npm run staging:controlled-load -- --profile=burst --execute --expected-sha="$CANDIDATE_SHA"
npm run staging:evidence-summary -- --expected-sha="$CANDIDATE_SHA" --level=p1
```

- [ ] Guardar distribución HTTP, p50/p95 y conteos `202`/`429`/errores.
- [ ] Tratar el limiter como protección gruesa, no cuota estricta.
- [ ] Documentar decisión persistencia directa vs. Queue.
- [ ] Documentar decisión Turnstile sí/no y evidencia que la justifica.

`COMPLETE` en el agregador no equivale a GO de producción.

## P1 — dispositivos, offline y accesibilidad

- [ ] iPhone Safari/Arc: ubicación permitida/denegada, offline, reconexión y sincronización única.
- [ ] Android Chrome: instalación PWA, modo avión, reconexión, cola y sincronización.
- [ ] Cerrar/reabrir conserva tarjeta y reportes locales.
- [ ] API caída/timeout no pierde el reporte local.
- [ ] Contraste, zoom/tamaño de texto, teclado y lector de pantalla básicos.
- [ ] Sin overflow, errores CSP ni errores de consola relevantes.

## P0 — seguridad y privacidad antes de cerrar F4

- [ ] Revisar headers y CSP de Pages y consola Worker.
- [ ] Confirmar que Access/JWT/configuración no aparecen en logs o artefactos.
- [ ] Retención: reportes 30 días y auditoría 180 días.
- [ ] Ejecutar cron con datos sintéticos y confirmar borrado selectivo.
- [ ] Revisar minimización de ubicación y ausencia de identificadores personales.
- [ ] Cerrar todos los P0 antes de abrir implementación F5.

## F5 — preparación pendiente; no bloquea el deploy F4 de staging

- [ ] Resolver licencia explícita de transformación/redistribución offline de las fuentes elegidas.
- [ ] Descargar/auditar bytes oficiales y registrar hash real.
- [ ] Resolver CRS, edición/vigencia y revisión humana.
- [ ] Mantener `packagingEligible=false` mientras falte cualquiera de esos requisitos.
- [ ] No publicar mapas/rutas como oficiales o seguras antes de superar la puerta F5.

## Evidencia mínima a conservar

- rama y SHA exactos;
- CI / `npm run check`;
- Worker Version ID;
- D1 y estado de migraciones;
- readiness/smoke/abuso/carga;
- IDs únicamente sintéticos;
- Access/consola/moderación;
- limitaciones de dispositivos;
- confirmación de que `main`, producción, datos reales y `REPORTS_OPERATIONS_TOKEN` no fueron tocados.
