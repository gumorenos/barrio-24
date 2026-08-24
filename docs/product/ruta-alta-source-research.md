# Ruta Alta — investigación de fuentes y candidato de piloto

Actualizado: 2026-08-24, America/Lima.

Estado: **investigación previa a Fase 5; no autoriza publicar rutas ni declarar zonas seguras**.

Este documento adelanta únicamente la puerta de investigación permitida mientras Fase 4 sigue abierta. No contiene rutas generadas por Barrio 24, no sustituye información oficial y no convierte una fuente descargable en una licencia de redistribución.

## Candidato provisional: La Punta / Callao

La Punta queda como candidato de investigación por disponibilidad de información oficial de tsunami y por la existencia de un escenario CENEPRED 2026 para Lima/Callao. La selección es provisional: Fase 5 no se abre hasta resolver procedencia, vigencia, geometrías y derechos de reutilización.

Principios que no se negociarán:

- Barrio 24 no recalcula ni inventa rutas oficiales.
- Acceso público o descarga gratuita no equivalen a permiso de transformación y redistribución offline.
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

## S2 — SIGRID/CENEPRED como catálogo de trazabilidad

SIGRID conserva registros históricos de cartas de inundación y otros documentos de gestión del riesgo. Se usa como fuente de catalogación y contraste, no como licencia automática ni como autoridad suficiente para decidir qué edición debe empaquetarse.

Registro histórico de La Punta verificado durante la investigación:

`https://sigrid4.cenepred.gob.pe/sigridv4/documento/4538`

La coexistencia entre registros históricos y la carta actual servida por DHN refuerza la regla de versionar por bytes y metadatos verificados.

## S3 — PPRRD La Punta 2026–2030, pendiente

El catálogo general de SIGRID permite localizar PPRRD, pero todavía no se verificó una URL individual estable del documento de La Punta 2026–2030. No se crea manifiesto S3 hasta resolver el registro exacto y el documento descargable.

## S4 — CENEPRED, escenario Lima/Callao 2026

Registro de catálogo:

`https://sigrid4.cenepred.gob.pe/sigridv4/documento/19748`

Descarga SHAPE resuelta durante la investigación:

`https://sigrid.cenepred.gob.pe/sigridv3/storage/escenario_sismo/4_shape.zip`

Manifiesto research-only:

`docs/product/ruta-alta-sources/cenepred-lima-callao-2026.source.json`

Hasta inspeccionar el ZIP, el manifiesto conserva deliberadamente:

- `geometry_type=UNKNOWN`;
- `crs_original=UNKNOWN`;
- `content_hash=null`;
- `license_status=unknown`.

Ninguno de esos campos debe completarse por inferencia.

## Determinación provisional de licencia

Resultado actual: **no hay base suficiente para cambiar S1/S4 a `verified-redistributable`**.

Criterio aplicado:

- descarga pública ≠ redistribución offline;
- capacidad de compartir información ≠ autorización de transformar/vectorizar;
- políticas generales de datos abiertos no se heredan automáticamente por cualquier PDF/ZIP alojado por una entidad pública.

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
  --require-packaging --as-of=2026-08-24
```

Código de salida `2` significa: manifiesto estructuralmente válido, pero bloqueado para empaquetado.

### 2. Validar el catálogo completo

```bash
node tools/ruta-alta/source-catalog.mjs \
  docs/product/ruta-alta-source-catalog.json
```

El catálogo verifica rutas normalizadas, IDs y el estado de cada fuente. Hoy el resultado esperado es `packagingEligible=false`.

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

## Puertas de datos antes de abrir Fase 5

- [ ] Resolver términos de transformación y redistribución offline para cada fuente incluida.
- [ ] Descargar y auditar los bytes exactos de las fuentes candidatas.
- [ ] Fijar SHA-256 y `content_file` reproducibles.
- [ ] Resolver `source_published_at`, `source_valid_at` y `review_due_at`.
- [ ] Auditar el ZIP SHAPE 2026: conjuntos, CRS, tipos geométricos, atributos y tamaño.
- [ ] Localizar y verificar el PPRRD vigente de La Punta o retirar S3.
- [ ] Contrastar rutas/refugios con documentación municipal/INDECI vigente.
- [ ] Realizar revisión humana antes de presentar cualquier ruta o refugio como oficial.
- [ ] Cerrar los bloqueadores P0 de Fase 4 antes de implementar mapas/rutas en el producto.

## Decisión vigente

**La Punta continúa únicamente como candidato de investigación. Fase 5 no está abierta para implementación de rutas o mapas públicos.**
