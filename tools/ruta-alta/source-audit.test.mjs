import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { auditCachedResearchSource, validateFetchMetadata } from './source-audit.mjs'
import { crc32 } from './zip-inspect.mjs'

function makeShpHeader(shapeType = 3) {
  const buffer = Buffer.alloc(100)
  buffer.writeInt32BE(9994, 0)
  buffer.writeInt32BE(50, 24)
  buffer.writeInt32LE(1000, 28)
  buffer.writeInt32LE(shapeType, 32)
  return buffer
}

function makeZip(entries) {
  const locals = []
  const centrals = []
  let localOffset = 0
  for (const [name, dataInput] of entries) {
    const data = Buffer.from(dataInput)
    const nameBytes = Buffer.from(name)
    const crc = crc32(data)
    const local = Buffer.alloc(30 + nameBytes.length)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26); nameBytes.copy(local, 30)
    locals.push(local, data)
    const central = Buffer.alloc(46 + nameBytes.length)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE((3 << 8) | 20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE((0o100644 << 16) >>> 0, 38); central.writeUInt32LE(localOffset, 42); nameBytes.copy(central, 46)
    centrals.push(central)
    localOffset += local.length + data.length
  }
  const localBytes = Buffer.concat(locals); const centralBytes = Buffer.concat(centrals); const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBytes.length, 12); eocd.writeUInt32LE(localBytes.length, 16)
  return Buffer.concat([localBytes, centralBytes, eocd])
}

const ZIP = makeZip([
  ['layer.shp', makeShpHeader()], ['layer.shx', Buffer.from('x')], ['layer.dbf', Buffer.from('d')],
  ['layer.prj', Buffer.from('PROJCS["WGS_1984_UTM_Zone_18S",AUTHORITY["EPSG","32718"]]')],
])
const HASH = `sha256:${createHash('sha256').update(ZIP).digest('hex')}`

function manifest() {
  return {
    schema_version: 1, source_id: 'cenepred-source', source_authority: 'CENEPRED', source_title: 'ZIP',
    source_url: 'https://sigrid.cenepred.gob.pe/data.zip', content_file: null, source_published_at: null,
    source_checked_at: '2026-08-24', source_valid_at: null, review_due_at: null, license_status: 'unknown',
    license_reference: null, license_scope: ['download'], crs_original: 'UNKNOWN', geometry_type: 'UNKNOWN',
    content_hash: null, package_version: '2026.08.1', review_status: 'research', reviewed_by: null,
  }
}

function metadata(overrides = {}) {
  return { schema_version: 1, source_id: 'cenepred-source', requested_url: 'https://sigrid.cenepred.gob.pe/data.zip', final_url: 'https://sigrid.cenepred.gob.pe/data.zip', redirects: 0, size_bytes: ZIP.length, sha256: HASH, artifact_format: 'zip', content_type: 'application/zip', content_length_declared: ZIP.length, ...overrides }
}

test('metadata validation binds source id, URL, size, format and hash to bytes', () => {
  assert.deepEqual(validateFetchMetadata(metadata(), { manifest: manifest(), actualBytes: ZIP }), [])
  const errors = validateFetchMetadata(metadata({ sha256: `sha256:${'0'.repeat(64)}` }), { manifest: manifest(), actualBytes: ZIP })
  assert.match(errors.join('\n'), /sha256/)
})

test('audit verifies cached bytes then inspects complete shapefile set', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'b24-audit-'))
  const manifestPath = path.join(root, 'source.json')
  const cache = path.join(root, 'artifacts/ruta-alta-research/cenepred-source')
  await mkdir(cache, { recursive: true })
  await writeFile(manifestPath, JSON.stringify(manifest()))
  await writeFile(path.join(cache, 'source.bin'), ZIP)
  await writeFile(path.join(cache, 'fetch-metadata.json'), JSON.stringify(metadata()))
  const result = await auditCachedResearchSource(manifestPath, { cwd: root })
  assert.equal(result.integrityValid, true)
  assert.equal(result.artifact.sha256, HASH)
  assert.equal(result.shapefile.shapefile_complete, true)
  assert.equal(result.shapefile.shapefile_sets[0].shape_family, 'polyline')
  assert.equal(result.shapefile.shapefile_sets[0].epsg, 'EPSG:32718')
})

test('audit fails closed when cached metadata does not match bytes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'b24-audit-'))
  const manifestPath = path.join(root, 'source.json')
  const cache = path.join(root, 'artifacts/ruta-alta-research/cenepred-source')
  await mkdir(cache, { recursive: true })
  await writeFile(manifestPath, JSON.stringify(manifest()))
  await writeFile(path.join(cache, 'source.bin'), ZIP)
  await writeFile(path.join(cache, 'fetch-metadata.json'), JSON.stringify(metadata({ size_bytes: ZIP.length + 1 })))
  const result = await auditCachedResearchSource(manifestPath, { cwd: root })
  assert.equal(result.integrityValid, false)
  assert.match(result.errors.join('\n'), /size_bytes/)
})

test('audit fails closed when cache files are missing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'b24-audit-'))
  const manifestPath = path.join(root, 'source.json')
  await writeFile(manifestPath, JSON.stringify(manifest()))
  const result = await auditCachedResearchSource(manifestPath, { cwd: root })
  assert.equal(result.integrityValid, false)
  assert.match(result.errors.join('\n'), /metadata could not be read/)
})
