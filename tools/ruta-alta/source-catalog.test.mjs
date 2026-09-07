import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { inspectSourceCatalog, validateSourceCatalog } from './source-catalog.mjs'

function researchManifest(id) {
  return {
    schema_version: 1,
    source_id: id,
    source_authority: 'Official authority',
    source_title: 'Research source',
    source_url: 'https://www.dhn.mil.pe/source.pdf',
    content_file: null,
    source_published_at: null,
    source_checked_at: '2026-08-24',
    source_valid_at: null,
    review_due_at: null,
    license_status: 'unknown',
    license_reference: null,
    license_scope: ['download'],
    crs_original: 'UNKNOWN',
    geometry_type: 'PDF',
    content_hash: null,
    package_version: '2026.08.1',
    review_status: 'research',
    reviewed_by: null,
  }
}

test('validates catalog shape and rejects traversal/duplicates', () => {
  const valid = { schema_version: 1, catalog_id: 'la-punta-research', area_name: 'La Punta', country_code: 'PE', source_manifests: ['sources/a.json'] }
  assert.deepEqual(validateSourceCatalog(valid), { valid: true, errors: [] })
  const invalid = { ...valid, source_manifests: ['../a.json', '../a.json'] }
  const result = validateSourceCatalog(invalid)
  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /normalized and relative|duplicate/)
})

test('research catalog is structurally valid but not packaging eligible', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'b24-catalog-'))
  await mkdir(path.join(root, 'sources'))
  await writeFile(path.join(root, 'sources/a.json'), JSON.stringify(researchManifest('source-a')))
  await writeFile(path.join(root, 'catalog.json'), JSON.stringify({
    schema_version: 1,
    catalog_id: 'la-punta-research',
    area_name: 'La Punta',
    country_code: 'PE',
    source_manifests: ['sources/a.json'],
  }))
  const result = await inspectSourceCatalog(path.join(root, 'catalog.json'), { asOf: '2026-08-24' })
  assert.equal(result.schemaValid, true)
  assert.equal(result.packagingEligible, false)
  assert.equal(result.sources[0].schema_valid, true)
})

test('duplicate source_id across manifests fails closed', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'b24-catalog-'))
  await mkdir(path.join(root, 'sources'))
  await writeFile(path.join(root, 'sources/a.json'), JSON.stringify(researchManifest('same-source')))
  await writeFile(path.join(root, 'sources/b.json'), JSON.stringify(researchManifest('same-source')))
  await writeFile(path.join(root, 'catalog.json'), JSON.stringify({
    schema_version: 1,
    catalog_id: 'la-punta-research',
    area_name: 'La Punta',
    country_code: 'PE',
    source_manifests: ['sources/a.json', 'sources/b.json'],
  }))
  const result = await inspectSourceCatalog(path.join(root, 'catalog.json'))
  assert.equal(result.packagingEligible, false)
  assert.match(result.blockers.join('\n'), /duplicate source_id/)
})
