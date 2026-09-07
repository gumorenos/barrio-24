import { inflateRawSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const ZIP64_U16 = 0xffff
const ZIP64_U32 = 0xffffffff

export const ZIP_LIMITS = Object.freeze({
  maxEntries: 1000,
  maxArchiveBytes: 64 * 1024 * 1024,
  maxEntryUncompressedBytes: 128 * 1024 * 1024,
  maxTotalUncompressedBytes: 512 * 1024 * 1024,
  maxCompressionRatio: 500,
  maxInspectableEntryBytes: 64 * 1024 * 1024,
})

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function findEocd(buffer) {
  if (buffer.length < 22) throw new Error('ZIP is too small to contain EOCD')
  const min = Math.max(0, buffer.length - 22 - 0xffff)
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset
  }
  throw new Error('ZIP EOCD not found')
}

function decodeFilename(bytes, flags) {
  const utf8 = Boolean(flags & 0x0800)
  if (!utf8 && [...bytes].some((b) => b >= 0x80)) throw new Error('non-ASCII ZIP filename requires UTF-8 flag')
  const name = bytes.toString('utf8')
  if (name.includes('\uFFFD')) throw new Error('ZIP filename is not valid UTF-8')
  return name
}

export function validateZipEntryPath(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 512) throw new Error('ZIP entry name length is invalid')
  if (name.includes('\0') || name.includes('\\')) throw new Error(`unsafe ZIP entry path: ${name}`)
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) throw new Error(`unsafe ZIP entry path: ${name}`)
  const isDirectory = name.endsWith('/')
  const parts = name.split('/')
  if (isDirectory) parts.pop()
  if (parts.length === 0 || parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`unsafe ZIP entry path: ${name}`)
  return { name, isDirectory }
}

function unixFileType(entry) {
  const platform = entry.versionMadeBy >>> 8
  if (platform !== 3) return null
  return (entry.externalAttributes >>> 16) & 0xf000
}

function parseCentralEntries(buffer, eocdOffset, limits) {
  const diskNumber = buffer.readUInt16LE(eocdOffset + 4)
  const centralDisk = buffer.readUInt16LE(eocdOffset + 6)
  const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8)
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
  const centralSize = buffer.readUInt32LE(eocdOffset + 12)
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16)
  const commentLength = buffer.readUInt16LE(eocdOffset + 20)

  if (eocdOffset + 22 + commentLength !== buffer.length) throw new Error('ZIP EOCD/comment length is inconsistent')
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) throw new Error('multi-disk ZIP archives are not supported')
  if (totalEntries === ZIP64_U16 || centralSize === ZIP64_U32 || centralOffset === ZIP64_U32) throw new Error('ZIP64 archives are not supported')
  if (totalEntries > limits.maxEntries) throw new Error(`ZIP has too many entries (${totalEntries})`)
  if (centralOffset + centralSize > eocdOffset) throw new Error('ZIP central directory bounds are invalid')

  const entries = []
  const caseFoldedNames = new Set()
  let offset = centralOffset
  let totalUncompressed = 0
  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw new Error('ZIP central directory entry is invalid')
    const versionMadeBy = buffer.readUInt16LE(offset + 4)
    const flags = buffer.readUInt16LE(offset + 8)
    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const expectedCrc32 = buffer.readUInt32LE(offset + 16)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const filenameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const entryCommentLength = buffer.readUInt16LE(offset + 32)
    const diskStart = buffer.readUInt16LE(offset + 34)
    const externalAttributes = buffer.readUInt32LE(offset + 38)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const end = offset + 46 + filenameLength + extraLength + entryCommentLength
    if (end > buffer.length) throw new Error('ZIP central directory entry exceeds archive bounds')
    if ([compressedSize, uncompressedSize, localHeaderOffset].includes(ZIP64_U32) || diskStart === ZIP64_U16) throw new Error('ZIP64 entry is not supported')
    if (diskStart !== 0) throw new Error('multi-disk ZIP entry is not supported')
    if (flags & 0x0001) throw new Error('encrypted ZIP entries are not supported')
    if (![0, 8].includes(compressionMethod)) throw new Error(`unsupported ZIP compression method: ${compressionMethod}`)

    const filename = decodeFilename(buffer.subarray(offset + 46, offset + 46 + filenameLength), flags)
    const pathInfo = validateZipEntryPath(filename)
    const folded = filename.toLocaleLowerCase('en-US')
    if (caseFoldedNames.has(folded)) throw new Error(`case-insensitive duplicate ZIP entry: ${filename}`)
    caseFoldedNames.add(folded)

    const type = unixFileType({ versionMadeBy, externalAttributes })
    if (type === 0xa000) throw new Error(`symbolic links are not allowed in ZIP: ${filename}`)
    if (!pathInfo.isDirectory && type !== null && ![0x0000, 0x8000].includes(type)) throw new Error(`non-regular ZIP entry is not allowed: ${filename}`)

    if (!pathInfo.isDirectory) {
      if (uncompressedSize > limits.maxEntryUncompressedBytes) throw new Error(`ZIP entry exceeds uncompressed size limit: ${filename}`)
      totalUncompressed += uncompressedSize
      if (totalUncompressed > limits.maxTotalUncompressedBytes) throw new Error('ZIP total uncompressed size exceeds limit')
      if (compressedSize === 0 && uncompressedSize > 0) throw new Error(`ZIP entry has suspicious zero compressed size: ${filename}`)
      if (compressedSize > 0 && uncompressedSize / compressedSize > limits.maxCompressionRatio) throw new Error(`ZIP entry exceeds compression ratio limit: ${filename}`)
    }

    entries.push({
      filename,
      isDirectory: pathInfo.isDirectory,
      versionMadeBy,
      flags,
      compressionMethod,
      crc32: expectedCrc32,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    })
    offset = end
  }
  if (offset !== centralOffset + centralSize) throw new Error('ZIP central directory size does not match entries')
  return entries
}

function inspectLocalEntryBounds(buffer, entry, centralOffset) {
  const offset = entry.localHeaderOffset
  if (offset + 30 > centralOffset || offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== LOCAL_SIGNATURE) {
    throw new Error(`ZIP local header is invalid: ${entry.filename}`)
  }
  const flags = buffer.readUInt16LE(offset + 6)
  const compressionMethod = buffer.readUInt16LE(offset + 8)
  const filenameLength = buffer.readUInt16LE(offset + 26)
  const extraLength = buffer.readUInt16LE(offset + 28)
  const nameStart = offset + 30
  const nameEnd = nameStart + filenameLength
  const dataStart = nameEnd + extraLength
  const dataEnd = dataStart + entry.compressedSize
  if (nameEnd > centralOffset || dataStart > centralOffset || dataEnd > centralOffset) {
    throw new Error(`ZIP local entry overlaps central directory: ${entry.filename}`)
  }
  const localFilename = decodeFilename(buffer.subarray(nameStart, nameEnd), flags)
  if (localFilename !== entry.filename) throw new Error(`ZIP local/central filename mismatch: ${entry.filename}`)
  if (flags !== entry.flags) throw new Error(`ZIP local/central flags mismatch: ${entry.filename}`)
  if (flags & 0x0001) throw new Error(`encrypted ZIP local entry is not supported: ${entry.filename}`)
  if (compressionMethod !== entry.compressionMethod) throw new Error(`ZIP compression method mismatch: ${entry.filename}`)
  return { dataStart, dataEnd }
}

function validateLocalEntryLayout(buffer, entries, centralOffset) {
  const intervals = entries.map((entry) => {
    const bounds = inspectLocalEntryBounds(buffer, entry, centralOffset)
    return { entry, start: entry.localHeaderOffset, end: bounds.dataEnd }
  }).sort((a, b) => a.start - b.start)
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].start < intervals[index - 1].end) {
      throw new Error(`ZIP local entries overlap: ${intervals[index - 1].entry.filename} / ${intervals[index].entry.filename}`)
    }
  }
}

function extractEntryBytes(buffer, entry, limits, centralOffset) {
  if (entry.isDirectory) return Buffer.alloc(0)
  if (entry.uncompressedSize > limits.maxInspectableEntryBytes) throw new Error(`ZIP entry too large for safe inspection: ${entry.filename}`)
  const { dataStart, dataEnd } = inspectLocalEntryBounds(buffer, entry, centralOffset)
  const compressed = buffer.subarray(dataStart, dataEnd)
  let bytes
  if (entry.compressionMethod === 0) bytes = Buffer.from(compressed)
  else bytes = inflateRawSync(compressed, { maxOutputLength: limits.maxInspectableEntryBytes })
  if (bytes.length !== entry.uncompressedSize) throw new Error(`ZIP uncompressed size mismatch: ${entry.filename}`)
  if (crc32(bytes) !== entry.crc32) throw new Error(`ZIP CRC mismatch: ${entry.filename}`)
  return bytes
}

export function detectShapefileFamily(bytes) {
  const buffer = Buffer.from(bytes)
  if (buffer.length < 100) throw new Error('SHP header must contain at least 100 bytes')
  if (buffer.readInt32BE(0) !== 9994) throw new Error('SHP file code is invalid')
  if (buffer.readInt32LE(28) !== 1000) throw new Error('SHP version is invalid')
  const shapeType = buffer.readInt32LE(32)
  const families = new Map([
    [0, 'null'], [1, 'point'], [3, 'polyline'], [5, 'polygon'], [8, 'multipoint'],
    [11, 'point'], [13, 'polyline'], [15, 'polygon'], [18, 'multipoint'],
    [21, 'point'], [23, 'polyline'], [25, 'polygon'], [28, 'multipoint'], [31, 'multipatch'],
  ])
  const family = families.get(shapeType)
  if (!family) throw new Error(`unsupported SHP shape type: ${shapeType}`)
  return { shapeType, shapeFamily: family }
}

export function detectEpsgFromPrj(text) {
  if (typeof text !== 'string') return null
  const authorityMatches = [...text.matchAll(/(?:AUTHORITY\s*\[\s*"EPSG"\s*,\s*"(\d+)"\s*\]|ID\s*\[\s*"EPSG"\s*,\s*(\d+)\s*\])/gi)]
  if (authorityMatches.length) {
    const last = authorityMatches.at(-1)
    const code = Number(last[1] ?? last[2])
    if (Number.isSafeInteger(code) && code > 0) return `EPSG:${code}`
  }
  const utm = /WGS(?:_|\s)*1984|WGS\s*84/i.test(text) && text.match(/UTM(?:_|\s)*Zone(?:_|\s)*(\d{1,2})([NS])/i)
  if (utm) {
    const zone = Number(utm[1])
    if (zone >= 1 && zone <= 60) return `EPSG:${(utm[2].toUpperCase() === 'N' ? 32600 : 32700) + zone}`
  }
  return null
}

function shapefileSetKey(filename) {
  const ext = path.posix.extname(filename).toLowerCase()
  if (!['.shp', '.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx'].includes(ext)) return null
  return filename.slice(0, -ext.length).toLocaleLowerCase('en-US')
}

export function inspectZipBuffer(input, { limits = ZIP_LIMITS } = {}) {
  const buffer = Buffer.from(input)
  if (buffer.length > limits.maxArchiveBytes) throw new Error('ZIP archive exceeds maximum input size')
  const eocd = findEocd(buffer)
  const centralOffset = buffer.readUInt32LE(eocd + 16)
  const entries = parseCentralEntries(buffer, eocd, limits)
  validateLocalEntryLayout(buffer, entries, centralOffset)
  const sets = new Map()

  for (const entry of entries) {
    if (entry.isDirectory) continue
    const key = shapefileSetKey(entry.filename)
    if (!key) continue
    const ext = path.posix.extname(entry.filename).toLowerCase()
    const set = sets.get(key) ?? { base: entry.filename.slice(0, -ext.length), files: {}, missing_required: [], shape_type: null, shape_family: null, epsg: null }
    set.files[ext.slice(1)] = entry.filename
    sets.set(key, set)
  }

  const shapefiles = []
  for (const set of [...sets.values()].sort((a, b) => a.base.localeCompare(b.base))) {
    set.missing_required = ['shp', 'shx', 'dbf', 'prj'].filter((ext) => !set.files[ext])
    if (set.files.shp) {
      const entry = entries.find((item) => item.filename === set.files.shp)
      if (entry && entry.uncompressedSize <= limits.maxInspectableEntryBytes) {
        const shape = detectShapefileFamily(extractEntryBytes(buffer, entry, limits, centralOffset))
        set.shape_type = shape.shapeType
        set.shape_family = shape.shapeFamily
      }
    }
    if (set.files.prj) {
      const entry = entries.find((item) => item.filename === set.files.prj)
      if (entry && entry.uncompressedSize <= 1024 * 1024) {
        const prj = extractEntryBytes(buffer, entry, limits, centralOffset).toString('utf8').replace(/^\uFEFF/, '')
        set.epsg = detectEpsgFromPrj(prj)
      }
    }
    shapefiles.push(set)
  }

  const totalCompressedBytes = entries.filter((e) => !e.isDirectory).reduce((sum, e) => sum + e.compressedSize, 0)
  const totalUncompressedBytes = entries.filter((e) => !e.isDirectory).reduce((sum, e) => sum + e.uncompressedSize, 0)
  return {
    archive_bytes: buffer.length,
    entry_count: entries.length,
    total_compressed_bytes: totalCompressedBytes,
    total_uncompressed_bytes: totalUncompressedBytes,
    entries: entries.map(({ filename, isDirectory, compressionMethod, compressedSize, uncompressedSize }) => ({
      filename,
      directory: isDirectory,
      compression_method: compressionMethod,
      compressed_bytes: compressedSize,
      uncompressed_bytes: uncompressedSize,
    })),
    shapefile_sets: shapefiles,
    shapefile_complete: shapefiles.length > 0 && shapefiles.every((set) => set.missing_required.length === 0 && set.shape_family),
  }
}

function parseCli(args) {
  let filePath = null
  let requireComplete = false
  for (const arg of args) {
    if (arg === '--require-shapefile-complete') requireComplete = true
    else if (arg.startsWith('-')) throw new Error(`Unknown argument: ${arg}`)
    else if (filePath) throw new Error('only one ZIP path may be provided')
    else filePath = arg
  }
  if (!filePath) throw new Error('usage: zip-inspect.mjs <archive.zip> [--require-shapefile-complete]')
  return { filePath, requireComplete }
}

async function main() {
  const options = parseCli(process.argv.slice(2))
  const bytes = await readFile(options.filePath)
  const result = inspectZipBuffer(bytes)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (options.requireComplete && !result.shapefile_complete) process.exitCode = 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
