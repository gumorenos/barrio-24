import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import {
  assessPackagingMetadataEligibility,
  inspectSourceManifest,
  loadSourceManifest,
  validateSourceManifest,
} from './source-manifest.mjs'

const CONTENT = Buffer.from('official-source-bytes')
const CONTENT_HASH = `sha256:${createHash('sha256').update(CONTENT).digest('hex')}`

function approvedManifest(overrides = {}) {
  return {
    schema_version: 1,
    source_id: 'dhn-la-punta-2024',
    source_authority: 'Dirección de Hidrografía y Navegación',
    source_title: 'Carta de inundación por tsunami - La Punta',
    source_url: 'https://www.dhn.mil.pe/example.pdf',
    content_file: 'artifacts/source.pdf',
    source_published_at: '2024-10-01',
    source_checked_at: '2026-08-24',
    source_valid_at: '2024-10-01',
    review_due_at: '2027-08-24',
    license_status: 'verified-redistributable',
    license_reference: 'https://example.gob.pe/licencia',
    license_scope: ['download', 'transform', 'redistribute-offline'],
    crs_original: 'EPSG:32718',
    geometry_type: 'PDF',
    content_hash: CONTENT_HASH,
    package_version: '2026.08.1',
    review_status: 'approved',
    reviewed_by: 'human-reviewer',
    ...overrides,
  }
}

test('research manifest may keep unresolved fields but remains structurally valid', () => {
  const manifest = approvedManifest({
    content_file: null,
    source_published_at: null,
    source_valid_at: null,
    review_due_at: null,
    license_status: 'unknown',
    license_reference: null,
    license_scope: ['download'],
    crs_original: 'UNKNOWN',
    geometry_type: 'UNKNOWN',
    content_hash: null,
    review_status: 'research',
    reviewed_by: null,
  })
  assert.equal(validateSourceManifest(manifest).valid, true)
  const assessment = assessPackagingMetadataEligibility(manifest, { asOf: '2026-08-24' })
  assert.equal(assessment.eligible, false)
  assert.match(assessment.blockers.join('\n'), /content_file|license_status|geometry_type|review_due_at/)
})

test('approved metadata is packaging-metadata eligible through review_due_at', () => {
  const manifest = approvedManifest()
  assert.deepEqual(validateSourceManifest(manifest), { valid: true, errors: [] })
  assert.equal(assessPackagingMetadataEligibility(manifest, { asOf: '2027-08-24' }).eligible, true)
  const expired = assessPackagingMetadataEligibility(manifest, { asOf: '2027-08-25' })
  assert.equal(expired.eligible, false)
  assert.match(expired.blockers.join('\n'), /source review expired/)
})

test('review_due_at cannot be earlier than source_checked_at', () => {
  const validation = validateSourceManifest(approvedManifest({ review_due_at: '2026-08-23' }))
  assert.equal(validation.valid, false)
  assert.ok(validation.errors.includes('review_due_at cannot be earlier than source_checked_at'))
})

test('manifest rejects unsafe content_file and unknown fields', () => {
  const validation = validateSourceManifest(approvedManifest({ content_file: '../escape.pdf', arbitrary: true }))
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join('\n'), /content_file|unexpected field: arbitrary/)
})

test('inspectSourceManifest verifies actual file bytes before packaging', async () => {
  const manifest = approvedManifest()
  const result = await inspectSourceManifest('/repo/sources/source.json', {
    asOf: '2026-08-24',
    read: async () => JSON.stringify(manifest),
    readBytes: async (filePath) => {
      assert.equal(filePath, '/repo/sources/artifacts/source.pdf')
      return CONTENT
    },
  })
  assert.equal(result.schemaValid, true)
  assert.equal(result.packagingMetadataEligible, true)
  assert.equal(result.packagingEligible, true)
  assert.equal(result.contentHashMatches, true)
})

test('hash mismatch fails closed', async () => {
  const manifest = approvedManifest()
  const result = await inspectSourceManifest('/repo/sources/source.json', {
    asOf: '2026-08-24',
    read: async () => JSON.stringify(manifest),
    readBytes: async () => Buffer.from('different'),
  })
  assert.equal(result.packagingEligible, false)
  assert.match(result.blockers.join('\n'), /content_hash does not match/)
})

test('loadSourceManifest fails closed on malformed JSON', async () => {
  await assert.rejects(loadSourceManifest('manifest.json', { read: async () => '{bad' }), /not valid JSON/)
})
