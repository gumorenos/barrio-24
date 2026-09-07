import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSourceFetchPlan,
  detectArtifactFormat,
  fetchResearchSource,
  validateResearchSourceUrl,
} from './source-fetch.mjs'

function manifest(overrides = {}) {
  return {
    schema_version: 1,
    source_id: 'cenepred-source',
    source_authority: 'CENEPRED',
    source_title: 'Official ZIP',
    source_url: 'https://sigrid.cenepred.gob.pe/data.zip',
    content_file: null,
    source_published_at: null,
    source_checked_at: '2026-08-24',
    source_valid_at: null,
    review_due_at: null,
    license_status: 'unknown',
    license_reference: null,
    license_scope: ['download'],
    crs_original: 'UNKNOWN',
    geometry_type: 'UNKNOWN',
    content_hash: null,
    package_version: '2026.08.1',
    review_status: 'research',
    reviewed_by: null,
    ...overrides,
  }
}

function response(status, bytes, headers = {}) {
  return new Response(bytes, { status, headers })
}

test('only allowlisted HTTPS official hosts are accepted', () => {
  assert.equal(validateResearchSourceUrl('https://www.dhn.mil.pe/file.pdf').hostname, 'www.dhn.mil.pe')
  assert.throws(() => validateResearchSourceUrl('http://www.dhn.mil.pe/file.pdf'), /HTTPS/)
  assert.throws(() => validateResearchSourceUrl('https://example.com/file.pdf'), /not allowlisted/)
})

test('fetch plan is deterministic and dry-run safe', () => {
  const plan = createSourceFetchPlan(manifest())
  assert.equal(plan.sourceId, 'cenepred-source')
  assert.equal(plan.bytesFile, 'artifacts/ruta-alta-research/cenepred-source/source.bin')
  assert.equal(plan.maxRedirects, 3)
})

test('artifact magic bytes distinguish PDF, ZIP and unknown', () => {
  assert.equal(detectArtifactFormat(Buffer.from('%PDF-1.7')), 'pdf')
  assert.equal(detectArtifactFormat(Buffer.from([0x50, 0x4b, 0x03, 0x04])), 'zip')
  assert.equal(detectArtifactFormat(Buffer.from('<html>')), 'unknown')
})

test('fetch rejects a 200 HTML body behind a .zip URL', async () => {
  await assert.rejects(fetchResearchSource('https://sigrid.cenepred.gob.pe/data.zip', {
    fetchImpl: async () => response(200, '<html>login</html>', { 'content-type': 'text/html' }),
  }), /do not match expected zip/)
})

test('redirects remain inside allowlisted official hosts', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    if (calls === 1) return response(302, '', { location: 'https://example.com/evil.zip' })
    return response(200, Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  }
  await assert.rejects(fetchResearchSource('https://sigrid.cenepred.gob.pe/data.zip', { fetchImpl }), /not allowlisted/)
})

test('content-length over the hard cap fails before reading the body', async () => {
  await assert.rejects(fetchResearchSource('https://sigrid.cenepred.gob.pe/data.zip', {
    fetchImpl: async () => response(200, Buffer.from([0x50, 0x4b, 0x05, 0x06]), { 'content-length': String(65 * 1024 * 1024) }),
  }), /Content-Length exceeds/)
})
