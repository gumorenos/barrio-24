import assert from 'node:assert/strict'
import test from 'node:test'
import { deflateRawSync } from 'node:zlib'

import {
  ZIP_LIMITS,
  crc32,
  detectEpsgFromPrj,
  detectShapefileFamily,
  inspectZipBuffer,
  validateZipEntryPath,
} from './zip-inspect.mjs'

function makeShpHeader(shapeType = 5) {
  const buffer = Buffer.alloc(100)
  buffer.writeInt32BE(9994, 0)
  buffer.writeInt32BE(50, 24)
  buffer.writeInt32LE(1000, 28)
  buffer.writeInt32LE(shapeType, 32)
  return buffer
}

function makeZip(entries, { archiveComment = '' } = {}) {
  const locals = []
  const centrals = []
  let localOffset = 0

  for (const spec of entries) {
    const nameBytes = Buffer.from(spec.name, 'utf8')
    const data = Buffer.isBuffer(spec.data) ? spec.data : Buffer.from(spec.data ?? '')
    const method = spec.method ?? 0
    const compressed = method === 8 ? deflateRawSync(data) : data
    const flags = (spec.utf8 === false ? 0 : 0x0800) | (spec.encrypted ? 0x0001 : 0)
    const crc = crc32(data)
    const extra = Buffer.alloc(0)
    const isDir = spec.name.endsWith('/')
    const unixMode = spec.unixMode ?? (isDir ? 0o040755 : 0o100644)
    const externalAttributes = (((unixMode << 16) >>> 0) | (isDir ? 0x10 : 0)) >>> 0
    const versionMadeBy = (3 << 8) | 20

    const local = Buffer.alloc(30 + nameBytes.length + extra.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(flags, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc >>> 0, 14)
    local.writeUInt32LE(compressed.length >>> 0, 18)
    local.writeUInt32LE(data.length >>> 0, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(extra.length, 28)
    nameBytes.copy(local, 30)
    locals.push(local, compressed)

    const central = Buffer.alloc(46 + nameBytes.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(versionMadeBy, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(flags, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc >>> 0, 16)
    central.writeUInt32LE(compressed.length >>> 0, 20)
    central.writeUInt32LE(data.length >>> 0, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt32LE(externalAttributes, 38)
    central.writeUInt32LE(localOffset >>> 0, 42)
    nameBytes.copy(central, 46)
    centrals.push(central)

    localOffset += local.length + compressed.length
  }

  const localBytes = Buffer.concat(locals)
  const centralBytes = Buffer.concat(centrals)
  const comment = Buffer.from(archiveComment, 'utf8')
  const eocd = Buffer.alloc(22 + comment.length)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBytes.length >>> 0, 12)
  eocd.writeUInt32LE(localBytes.length >>> 0, 16)
  eocd.writeUInt16LE(comment.length, 20)
  comment.copy(eocd, 22)
  return Buffer.concat([localBytes, centralBytes, eocd])
}

const WGS84_UTM_18S = 'PROJCS["WGS_1984_UTM_Zone_18S",GEOGCS["GCS_WGS_1984"],PROJECTION["Transverse_Mercator"],AUTHORITY["EPSG","32718"]]'

function validShapeZip(overrides = {}) {
  return makeZip([
    { name: 'callao/evacuation.shp', data: makeShpHeader(overrides.shapeType ?? 3) },
    { name: 'callao/evacuation.shx', data: Buffer.from('index') },
    { name: 'callao/evacuation.dbf', data: Buffer.from('dbf') },
    { name: 'callao/evacuation.prj', data: Buffer.from(overrides.prj ?? WGS84_UTM_18S) },
  ])
}

test('validates safe and unsafe ZIP paths', () => {
  assert.deepEqual(validateZipEntryPath('folder/data.shp'), { name: 'folder/data.shp', isDirectory: false })
  assert.throws(() => validateZipEntryPath('../escape.shp'), /unsafe ZIP entry path/)
  assert.throws(() => validateZipEntryPath('/absolute.shp'), /unsafe ZIP entry path/)
  assert.throws(() => validateZipEntryPath('C:/windows.shp'), /unsafe ZIP entry path/)
  assert.throws(() => validateZipEntryPath('folder\\data.shp'), /unsafe ZIP entry path/)
})

test('detects supported shapefile shape families', () => {
  assert.deepEqual(detectShapefileFamily(makeShpHeader(1)), { shapeType: 1, shapeFamily: 'point' })
  assert.deepEqual(detectShapefileFamily(makeShpHeader(3)), { shapeType: 3, shapeFamily: 'polyline' })
  assert.deepEqual(detectShapefileFamily(makeShpHeader(5)), { shapeType: 5, shapeFamily: 'polygon' })
  assert.throws(() => detectShapefileFamily(makeShpHeader(2)), /unsupported SHP shape type/)
})

test('detects EPSG authority and UTM fallback from PRJ', () => {
  assert.equal(detectEpsgFromPrj(WGS84_UTM_18S), 'EPSG:32718')
  assert.equal(detectEpsgFromPrj('PROJCS["WGS 84 / UTM Zone 18S"]'), 'EPSG:32718')
  assert.equal(detectEpsgFromPrj('LOCAL_CS["unknown"]'), null)
})

test('inspects a complete shapefile set without extracting files', () => {
  const result = inspectZipBuffer(validShapeZip())
  assert.equal(result.entry_count, 4)
  assert.equal(result.shapefile_complete, true)
  assert.equal(result.shapefile_sets.length, 1)
  assert.deepEqual(result.shapefile_sets[0].missing_required, [])
  assert.equal(result.shapefile_sets[0].shape_family, 'polyline')
  assert.equal(result.shapefile_sets[0].epsg, 'EPSG:32718')
})

test('marks incomplete shapefile sets as not package-ready', () => {
  const zip = makeZip([
    { name: 'layer.shp', data: makeShpHeader(5) },
    { name: 'layer.dbf', data: 'dbf' },
  ])
  const result = inspectZipBuffer(zip)
  assert.equal(result.shapefile_complete, false)
  assert.deepEqual(result.shapefile_sets[0].missing_required, ['shx', 'prj'])
  assert.equal(result.shapefile_sets[0].shape_family, 'polygon')
})

test('rejects path traversal and case-insensitive duplicate entries', () => {
  assert.throws(() => inspectZipBuffer(makeZip([{ name: '../evil.shp', data: makeShpHeader() }])), /unsafe ZIP entry path/)
  assert.throws(() => inspectZipBuffer(makeZip([
    { name: 'Layer.shp', data: makeShpHeader() },
    { name: 'layer.SHP', data: makeShpHeader() },
  ])), /case-insensitive duplicate ZIP entry/)
})

test('rejects encrypted entries and Unix symlinks', () => {
  assert.throws(() => inspectZipBuffer(makeZip([{ name: 'secret.shp', data: makeShpHeader(), encrypted: true }])), /encrypted ZIP entries/)
  assert.throws(() => inspectZipBuffer(makeZip([{ name: 'link.shp', data: makeShpHeader(), unixMode: 0o120777 }])), /symbolic links are not allowed/)
})

test('rejects unsupported compression and suspicious compression ratios', () => {
  assert.throws(() => inspectZipBuffer(makeZip([{ name: 'layer.shp', data: makeShpHeader(), method: 12 }])), /unsupported ZIP compression method/)
  const bombish = makeZip([{ name: 'zeros.dbf', data: Buffer.alloc(1024 * 1024, 0), method: 8 }])
  assert.throws(() => inspectZipBuffer(bombish, { limits: { ...ZIP_LIMITS, maxCompressionRatio: 5 } }), /compression ratio limit/)
})

test('rejects malformed archive bounds and honors archive comments', () => {
  const valid = makeZip([{ name: 'layer.dbf', data: 'x' }], { archiveComment: 'ok' })
  assert.equal(inspectZipBuffer(valid).entry_count, 1)
  const broken = Buffer.from(valid)
  broken.writeUInt32LE(0xffffffff, broken.length - 6 - 2)
  assert.throws(() => inspectZipBuffer(broken), /ZIP64 archives are not supported|central directory bounds are invalid|EOCD/)
})

test('rejects local/central filename and flag mismatches', () => {
  const filenameMismatch = makeZip([{ name: 'safe.shp', data: makeShpHeader() }])
  Buffer.from('evil.shp').copy(filenameMismatch, 30)
  assert.throws(() => inspectZipBuffer(filenameMismatch), /local\/central filename mismatch/)

  const flagsMismatch = makeZip([{ name: 'safe.shp', data: makeShpHeader() }])
  flagsMismatch.writeUInt16LE(0, 6)
  assert.throws(() => inspectZipBuffer(flagsMismatch), /local\/central flags mismatch/)
})

test('rejects local entry intervals that overlap', () => {
  const zip = makeZip([
    { name: 'one.txt', data: Buffer.from('12345678') },
    { name: 'two.txt', data: Buffer.from('abcdefgh') },
  ])
  const eocd = zip.length - 22
  const centralOffset = zip.readUInt32LE(eocd + 16)
  const firstCentralCompressedSizeOffset = centralOffset + 20
  zip.writeUInt32LE(64, firstCentralCompressedSizeOffset)
  assert.throws(() => inspectZipBuffer(zip), /local entries overlap|overlaps central directory/)
})
