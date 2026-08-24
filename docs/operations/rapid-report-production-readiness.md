# Production readiness — Reporte 60 segundos

Actualizado: 2026-08-24 America/Lima.

## Veredicto actual

**NO-GO para producción.**

Este documento registra evidencia para cerrar la Fase 4. No autoriza cambios en `main`, despliegues de producción, aplicación de migraciones ni uso de datos reales.

Base remota conocida del trabajo: `feature/02-rapid-report` en `012f3ff7c69609f2863c5111efa6a6127da1f932`.

## Qué resuelve el candidato local

El candidato actual añade una ruta reproducible para construir la configuración de staging sin guardar secretos:

- `api/staging-config.env.example` identifica los recursos autorizados de staging;
- `api/scripts/render-staging-wrangler-config.mjs` valida y genera `api/wrangler.toml`;
- `api/wrangler.toml` y `api/staging-config.env` están ignorados por Git;
- el generador falla si cuenta, Worker, D1, origen Pages o cron no coinciden exactamente;
- el namespace de Rate Limiting debe ser una cadena que represente un entero positivo;
- un fallo de validación elimina un `api/wrangler.toml` previo para evitar configuración stale;
- `npm run staging:dry-run` y `npm run staging:startup-check` solicitan Wrangler `4.125.0` de forma explícita;
- las variables/JWT de Cloudflare Access permanecen fuera de Git;
- `REPORTS_OPERATIONS_TOKEN` continúa fuera del diseño;
- `npm run staging:public-smoke` es dry-run por defecto; su ejecución real exige `--execute --expected-sha=<SHA>` y usa solo staging/datos sintéticos.
- `npm run staging:public-abuse -- --execute --expected-sha=<SHA>` verifica de forma fail-closed rechazos de payload y controles de privacidad sin tocar rutas operativas.
- `npm run staging:controlled-load` es dry-run por defecto; sus perfiles ejecutables exigen el SHA candidato, tienen límites duros de 25 solicitudes y concurrencia 4 y generan solo reportes sintéticos sin ubicación.
- `npm run staging:d1-schema-check -- --execute --expected-sha=<SHA>` usa únicamente consultas D1 de lectura, valida el esquema esperado de `0001`–`0004` y falla si la metadata indica escrituras.
- `npm run staging:readiness-readonly -- --execute --expected-sha=<SHA>` exige HEAD exacto, rama `feature/*`/`fix/*` y worktree limpio antes de los checks; limita tiempo/salida por comando, se detiene al primer fallo, redacta formas comunes de tokens y guarda evidencia JSON fuera de Git.
- smoke, abuso, carga y schema remoto guardan evidencia JSON privada ligada al mismo SHA candidato;
- `npm run staging:evidence-summary -- --expected-sha=<SHA>` verifica que las evidencias automatizables requeridas correspondan al mismo candidato; `--level=p1` añade ambos perfiles de carga. El resultado COMPLETE no reemplaza QA interactivo ni autoriza producción.

## Evidencia local del generador

La prueba dedicada debe pasar con:

```bash
npm run test:staging-config
```

Casos cubiertos:

- parser del archivo env;
- aceptación del inventario de staging correcto;
- fallo por variable requerida ausente;
- rechazo de otra cuenta, Worker, D1, Pages o cron;
- rechazo de namespace vacío, cero, negativo, decimal o no numérico;
- render del TOML esperado;
- ausencia de variables Access y de `REPORTS_OPERATIONS_TOKEN` en el TOML generado;
- eliminación de configuración stale cuando la validación falla;
- escritura correcta desde un archivo env válido.

La batería completa del repositorio (`npm ci` + `npm run check`) debe repetirse en un checkout completo antes de considerar publicable un candidato.

## Inventario que debe confirmarse remotamente

| Recurso | Valor esperado |
|---|---|
| Cuenta | `9d3274c57217e9cf44020bec6d754fb7` |
| Worker | `barrio24-reports-api-staging` |
| Worker URL | `https://barrio24-reports-api-staging.gumorenos.workers.dev` |
| Version ID conocido | `946d3cea-9f88-415c-9656-00e0fa5431df` |
| D1 | `barrio24-reports-staging` |
| D1 ID | `eca7ac80-6859-40d5-89db-ba1bb6c61173` |
| Pages origin | `https://feature-02-rapid-report.barrio24-staging.pages.dev` |
| Cron | `0 5 * * *` |
| Access path | `/v1/ops/*` |
| Team domain | `gumorenos.cloudflareaccess.com` |
| Operador permitido | `gumorenos@gmail.com` |

No registrar el JWT, cookies o secretos usados para confirmar Access.

## P0 pendientes para cerrar Fase 4

- [ ] Confirmar `BARRIO24_STAGING_RATE_LIMIT_NAMESPACE_ID` desde el Worker/cuenta existente.
- [ ] Ejecutar `npm ci` en checkout completo.
- [ ] Ejecutar `npm run check` en checkout completo.
- [ ] Ejecutar `npm run staging:config` con el namespace real.
- [ ] Definir el SHA candidato exacto y ejecutar `npm run staging:readiness-readonly -- --execute --expected-sha=<SHA>`; conservar la evidencia JSON y detenerse si HEAD/rama/worktree no coinciden.
- [ ] Confirmar `staging:dry-run` con resultado concluyente.
- [ ] Confirmar `staging:startup-check` con resultado concluyente.
- [ ] Confirmar con `d1 migrations list` que no existan migraciones locales pendientes inesperadas.
- [ ] Confirmar con `staging:d1-schema-check -- --execute --expected-sha=<SHA>` tablas, columnas e índices de `0001`–`0004` sin escrituras y conservar su evidencia JSON.
- [ ] Verificar Access con sesión interactiva autorizada.
- [ ] Confirmar que `/v1/ops/*` está protegido y `POST /v1/reports` no lo está.
- [ ] Ejecutar `npm run staging:public-smoke -- --execute --expected-sha=<SHA>` y conservar la evidencia JSON del evento sintético.
- [ ] Ejecutar `npm run staging:public-abuse -- --execute --expected-sha=<SHA>` y conservar evidencia JSON del rechazo de JSON inválido, coordenadas exactas/campos extra, precisión geográfica excesiva, categoría/fecha inválidas y payload >2 KB.
- [ ] Ejecutar `npm run staging:evidence-summary -- --expected-sha=<SHA>` y exigir `automatedStatus: COMPLETE` para la evidencia automatizable P0.
- [ ] Ejecutar QA remoto de moderación, auditoría, idempotencia y concurrencia con datos sintéticos.
- [ ] Completar revisión P0 de seguridad/privacidad.

## P1 pendientes antes del piloto

- [ ] Ejecutar `npm run staging:controlled-load -- --profile=rate-limit --execute --expected-sha=<SHA>` y guardar conteos, p50/p95, `event_id` sintéticos y evidencia JSON.
- [ ] Ejecutar `npm run staging:controlled-load -- --profile=burst --execute --expected-sha=<SHA>` y guardar conteos, p50/p95, errores inesperados y evidencia JSON.
- [ ] Interpretar la evidencia junto con el carácter eventualmente consistente del Rate Limiting; no exigir una cuota estricta por número de solicitud.
- [ ] Ejecutar `npm run staging:evidence-summary -- --expected-sha=<SHA> --level=p1` y exigir `automatedStatus: COMPLETE` para la evidencia automatizable P1.
- [ ] Decisión documentada sobre Queue y Turnstile basada en resultados.
- [ ] QA físico de sincronización y conectividad intermitente en dispositivos objetivo.
- [ ] Accesibilidad de la consola y del flujo ciudadano en condiciones de estrés.
- [ ] Revisión de observabilidad, cuotas y presupuesto.

## Criterios de parada inmediata

Mantener **NO-GO** y detener cualquier acción si:

- el checkout no corresponde al candidato esperado;
- la configuración apunta a una cuenta, Worker, D1 u origen distintos;
- el namespace no puede verificarse;
- un check real de Wrangler no termina con resultado concluyente;
- las migraciones remotas no coinciden con las esperadas;
- Access protege más superficie que `/v1/ops/*` o deja expuesta esa superficie;
- aparece un secreto, JWT, dato médico o coordenada exacta en Git/logs/respuestas;
- una prueba requiere datos ciudadanos reales;
- se propone `REPORTS_OPERATIONS_TOKEN` como atajo;
- se requiere aplicar migraciones o desplegar para completar una verificación que debía ser de solo lectura;
- se pretende tocar `main` o producción sin autorización explícita.

## Condición para cambiar este veredicto

El veredicto solo puede pasar de NO-GO cuando todos los P0 tengan evidencia reproducible y no queden bloqueadores de seguridad/privacidad. Aun entonces, cerrar Fase 4 **no equivale a autorizar producción**; las puertas posteriores del roadmap siguen vigentes.
