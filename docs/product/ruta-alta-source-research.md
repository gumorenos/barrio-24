# Ruta Alta — investigación de fuentes y candidato de piloto

Actualizado: 2026-09-19, America/Lima.

Estado: **Fase 5 activa en preparación de entrada; no autoriza publicar rutas ni declarar zonas seguras**.

Este documento registra la investigación de procedencia para Ruta Alta. No contiene rutas generadas por Barrio 24, no sustituye información oficial y no convierte una fuente descargable en una licencia de redistribución.

## Candidato provisional: La Punta / Callao

La Punta continúa como candidato por disponibilidad de información oficial de tsunami, un PPRRD municipal vigente 2026–2030 y un escenario CENEPRED 2026 para Lima/Callao. La selección sigue condicionada a procedencia, vigencia, geometrías y derechos de reutilización.

Principios que no se negociarán:

- Barrio 24 no recalcula ni inventa rutas oficiales.
- Acceso público o descarga gratuita no equivalen por sí solos a permiso de transformación y redistribución offline.
- Una versión no se deduce del nombre físico de un archivo.
- Las fuentes research-only pueden documentarse con campos aún no resueltos, pero jamás empaquetarse.
- Los bytes usados para un paquete futuro deben quedar ligados a SHA-256, revisión humana y fecha de próxima revisión.

## S1 — DHN/CNAT, Carta de Inundación La Punta

Entidad: Marina de Guerra del Perú — Dirección de Hidrografía y Navegación — Centro Nacional de Alerta de Tsunamis.

Documento candidato:

`https://www.dhn.mil.pe/files/cnat/pdf/cartas-inundacion/La_Punta_2014.pdf`

El nombre de archivo conserva `2014`, pero la carta servida por DHN declara levantamiento de octubre de 2024 y `Año: 2024`. Por tanto la edición no debe inferirse del nombre del archivo. Antes de usarla en un paquete se exige descargar los bytes, fijar hash, confirmar metadatos y resolver autorización de transformación/redistribución.

La carta incluye en su leyenda zonas inundables, rutas de evacuación, zonas de refugio y otros elementos de apoyo. La determinación de rutas/refugios corresponde a las autoridades competentes; Barrio 24 no debe sustituir esa decisión.

Manifiesto research-only:

`docs/product/ruta-alta-sources/dhn-la-punta-current.source.json`

Bloqueadores actuales:

- `license_status=unknown`;
- sin `content_file` ni `content_hash` fijados;
- sin fecha de publicación/validez y `review_due_at` resueltas;
- sin revisión humana aprobada para empaquetado.

## S2 — SIGRID/CENEPRED como catálogo y fuente geoespacial

SIGRID conserva registros históricos de cartas de inundación y otros documentos de gestión del riesgo. Se usa como fuente de catalogación y contraste y ofrece extracción/descarga de información geoespacial, pero no se interpreta esa capacidad técnica como licencia automática de redistribución.

Registro histórico de La Punta verificado durante la investigación:

`https://sigrid4.cenepred.gob.pe/sigridv4/documento/4538`

La coexistencia entre registros históricos y la carta actual servida por DHN refuerza la regla de versionar por bytes y metadatos verificados.

Evidencia oficial adicional revisada el 2026-09-19:

- SIGRID se describe como plataforma de libre acceso para consultar, compartir, analizar y monitorear información de riesgo.
- El manual oficial documenta una función de extracción que permite descargar información geoespacial en File Geodatabase y Shapefile/ZIP.
- La propia biblioteca de SIGRID pide respetar derechos y dar crédito a los autores intelectuales de información propia o de instituciones socias.
- La página de normalización muestra copyright de CENEPRED con la fórmula “Todos los derechos reservados”.

Conclusión: existe evidencia fuerte de acceso, consulta, análisis y descarga, pero no una autorización específica suficientemente clara para que Barrio 24 transforme y redistribuya offline los datasets seleccionados. El gate de licencia permanece cerrado.

## S3 — PPRRD La Punta 2026–2030

Fuente primaria localizada y verificada el 2026-09-19:

`https://www.gob.pe/institucion/munilapunta/normas-legales/8260750`

La Resolución de Alcaldía N.° 057-2026-MDLP/AL, publicada el 11 de junio de 2026, aprueba el **Plan de Prevención y Reducción del Riesgo de Desastres ante el peligro de sismo seguido de tsunami 2026–2030** de la Municipalidad Distrital de La Punta y publica el plan como anexo descargable.

SIGRID también cataloga el PPRRD vigente para el distrito La Punta.

Manifiesto research-only:

`docs/product/ruta-alta-sources/mdlp-pprrd-la-punta-2026-2030.source.json`

El PPRRD resuelve el bloqueo anterior de localizar el instrumento municipal vigente, pero no resuelve por sí mismo derechos de transformación/redistribución de la cartografía incorporada o citada. Deben verificarse además los autores/fuentes de cada mapa relevante dentro del plan.

## S4 — CENEPRED, escenario Lima/Callao 2026

Registro de catálogo:

`https://sigrid4.cenepred.gob.pe/sigridv4/documento/19748`

Descarga SHAPE resuelta durante la investigación:

`https://sigrid.cenepred.gob.pe/sigridv3/storage/escenario_sismo/4_shape.zip`

Manifiesto research-only:

`docs/product/ruta-alta-sources/cenepred-lima-callao-2026.source.json`

Hasta inspeccionar los bytes exactos del ZIP, el manifiesto conserva deliberadamente:

- `geometry_type=UNKNOWN`;
- `crs_original=UNKNOWN`;
- `content_hash=null`;
- `license_status=unknown`.

Ninguno de esos campos debe completarse por inferencia.

## Marco peruano de datos abiertos revisado

El Decreto Supremo N.° 016-2017-PCM aprobó la Estrategia Nacional de Datos Abiertos Gubernamentales y el Modelo de Datos Abiertos Gubernamentales del Perú. El modelo define los datos abiertos como accesibles/utilizables, en formatos abiertos y bajo licencia abierta, y promueve su reutilización.

Ese marco es relevante, pero Barrio 24 no asumirá que todo archivo alojado por una entidad pública queda automáticamente cubierto por una licencia abierta. Para cambiar un manifiesto a `verified-redistributable` se necesita una referencia que vincule de forma suficiente la fuente/dataset concreto con términos que permitan la transformación y redistribución offline pretendidas.

## Determinación provisional de licencia

Resultado actual: **no hay base suficiente para cambiar S1/S3/S4 a `verified-redistributable`**.

Criterio aplicado:

- descarga pública ≠ redistribución offline;
- capacidad de compartir/analizar información ≠ autorización inequívoca para transformar y volver a empaquetar;
- políticas generales de datos abiertos no se heredan automáticamente por cualquier PDF/ZIP alojado por una entidad pública;
- cuando una fuente agrega información de instituciones socias, debe respetarse también la atribución/titularidad de la capa concreta.

Hasta encontrar términos específicos o autorización institucional suficiente, los manifiestos siguen fail-closed.

## Tooling de investigación disponible

### 1. Validar un manifiesto

```bash
node tools/ruta-alta/source-manifest.mjs \
  docs/product/ruta-alta-sources/dhn-la-punta-current.source.json
```

Para exigir elegibilidad de empaquetado se debe fijar una fecha determinística:

```bash
node tools/ruta-alta/source-manifest.mjs \
  docs/product/ruta-alta-sources/dhn-la-punta-current.source.json \
  --require-packaging --as-of=2026-09-19
```

Código de salida `2` significa: manifiesto estructuralmente válido, pero bloqueado para empaquetado.

### 2. Validar el catálogo completo

```bash
node tools/ruta-alta/source-catalog.mjs \
  docs/product/ruta-alta-source-catalog.json
```

El catálogo verifica rutas normalizadas, IDs y el estado de cada fuente. Mientras no exista una licencia suficiente y bytes revisados, el resultado esperado es `packagingEligible=false`.

### 3. Preparar una descarga de investigación

Dry-run por defecto:

```bash
node tools/ruta-alta/source-fetch.mjs \
  docs/product/ruta-alta-sources/cenepred-lima-callao-2026.source.json
```

La descarga real requiere `--execute`. El fetch:

- acepta solo HTTPS;
- limita hosts a entidades oficiales allowlisted;
- limita tamaño a 64 MB;
- limita redirects y tiempo;
- verifica magic bytes para PDF/ZIP;
- guarda bytes y metadata bajo `artifacts/ruta-alta-research/`, ignorado por Git;
- no modifica automáticamente el manifiesto ni aprueba licencias.

### 4. Inspeccionar un ZIP SHAPE sin extraerlo

```bash
node tools/ruta-alta/zip-inspect.mjs path/to/source.zip
```

Para exigir un conjunto shapefile completo:

```bash
node tools/ruta-alta/zip-inspect.mjs path/to/source.zip \
  --require-shapefile-complete
```

El inspector valida, entre otros:

- límites de tamaño/ratio y número de entradas;
- traversal y rutas absolutas;
- duplicados case-insensitive;
- cifrado y symlinks;
- coherencia entre headers central/local y ausencia de solapamientos;
- archivos `.shp/.shx/.dbf/.prj`;
- tipo SHP declarado;
- EPSG detectable desde PRJ cuando exista.

No extrae el ZIP al filesystem.

## Puertas de datos antes de empaquetar/publicar Ruta Alta

- [ ] Resolver términos de transformación y redistribución offline para cada fuente incluida.
- [ ] Descargar y auditar los bytes exactos de las fuentes candidatas.
- [ ] Fijar SHA-256 y `content_file` reproducibles.
- [ ] Resolver `source_published_at`, `source_valid_at` y `review_due_at` donde falten.
- [ ] Auditar el ZIP SHAPE 2026: conjuntos, CRS, tipos geométricos, atributos y tamaño.
- [x] Localizar y verificar el PPRRD vigente de La Punta 2026–2030.
- [ ] Contrastar rutas/refugios con el PPRRD municipal vigente y documentación oficial aplicable.
- [ ] Realizar revisión humana antes de presentar cualquier ruta o refugio como oficial.

## Decisión vigente

**La Punta continúa como candidato de Fase 5. La investigación y tooling pueden avanzar, pero el empaquetado/publicación de mapas y rutas permanece bloqueado hasta que al menos una fuente cumpla `packagingEligible=true`.**
