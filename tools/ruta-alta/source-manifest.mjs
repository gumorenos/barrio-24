import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HTTPS_URL_PATTERN = /^https:\/\/[^\s]+$/
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/
const VERSION_PATTERN = /^[0-9]{4}\.[0-9]{2}(?:\.[0-9]+)?$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ALLOWED_LICENSE_STATUS = new Set(['unknown', 'verified-redistributable', 'restricted'])
const ALLOWED_REVIEW_STATUS = new Set(['research', 'approved', 'blocked'])
const ALLOWED_LICENSE_SCOPE = new Set(['download', 'transform', 'redistribute-offline'])
const ALLOWED_GEOMETRY_TYPES = new Set(['UNKNOWN', 'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'Raster', 'PDF'])

const REQUIRED_KEYS = Object.freeze([
  'schema_version', 'source_id', 'source_authority', 'source_title', 'source_url',
  'content_file', 'source_published_at', 'source_checked_at', 'source_valid_at',
  'review_due_at', 'license_status', 'license_reference', 'license_scope',
  'crs_original', 'geometry_type', 'content_hash', 'package_version',
  'review_status', 'reviewed_by',
])

function isIsoDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeRelativePath(value) {
  if (!isNonEmptyString(value) || path.isAbsolute(value)) return false
  const posix = value.replaceAll('\\', '/')
  const normalized = path.posix.normalize(posix)
  return normalized === posix && normalized !== '..' && !normalized.startsWith('../')
}

function compareDates(a, b) {
  return Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)
}

export function validateSourceManifest(manifest) {
  const errors = []
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['manifest must be an object'] }
  }

  for (const key of REQUIRED_KEYS) if (!(key in manifest)) errors.push(`missing required field: ${key}`)
  for (const key of Object.keys(manifest)) if (!REQUIRED_KEYS.includes(key)) errors.push(`unexpected field: ${key}`)

  if (manifest.schema_version !== 1) errors.push('schema_version must equal 1')
  if (!ID_PATTERN.test(manifest.source_id ?? '')) errors.push('source_id must use lowercase safe identifier characters')
  if (!isNonEmptyString(manifest.source_authority)) errors.push('source_authority is required')
  if (!isNonEmptyString(manifest.source_title)) errors.push('source_title is required')
  if (!HTTPS_URL_PATTERN.test(manifest.source_url ?? '')) errors.push('source_url must be HTTPS')
  if (manifest.content_file !== null && !isSafeRelativePath(manifest.content_file)) errors.push('content_file must be null or a normalized relative path')
  if (manifest.source_published_at !== null && !isIsoDate(manifest.source_published_at)) errors.push('source_published_at must be null or YYYY-MM-DD')
  if (!isIsoDate(manifest.source_checked_at)) errors.push('source_checked_at must be YYYY-MM-DD')
  if (manifest.source_valid_at !== null && !isIsoDate(manifest.source_valid_at)) errors.push('source_valid_at must be null or YYYY-MM-DD')
  if (manifest.review_due_at !== null && !isIsoDate(manifest.review_due_at)) errors.push('review_due_at must be null or YYYY-MM-DD')
  if (!ALLOWED_LICENSE_STATUS.has(manifest.license_status)) errors.push('license_status is invalid')
  if (manifest.license_reference !== null && !isNonEmptyString(manifest.license_reference)) errors.push('license_reference must be null or a non-empty string')
  if (!Array.isArray(manifest.license_scope) || new Set(manifest.license_scope).size !== manifest.license_scope.length || manifest.license_scope.some((scope) => !ALLOWED_LICENSE_SCOPE.has(scope))) {
    errors.push('license_scope must contain unique supported permissions')
  }
  if (!isNonEmptyString(manifest.crs_original)) errors.push('crs_original is required; use UNKNOWN only when explicitly unresolved')
  if (!ALLOWED_GEOMETRY_TYPES.has(manifest.geometry_type)) errors.push('geometry_type is invalid')
  if (manifest.content_hash !== null && !HASH_PATTERN.test(manifest.content_hash)) errors.push('content_hash must be null or sha256:<64 lowercase hex>')
  if (!VERSION_PATTERN.test(manifest.package_version ?? '')) errors.push('package_version must use YYYY.MM or YYYY.MM.N')
  if (!ALLOWED_REVIEW_STATUS.has(manifest.review_status)) errors.push('review_status is invalid')
  if (manifest.reviewed_by !== null && !isNonEmptyString(manifest.reviewed_by)) errors.push('reviewed_by must be null or a non-empty string')

  if (isIsoDate(manifest.source_published_at) && isIsoDate(manifest.source_checked_at) && compareDates(manifest.source_checked_at, manifest.source_published_at) < 0) {
    errors.push('source_checked_at cannot be earlier than source_published_at')
  }
  if (isIsoDate(manifest.review_due_at) && isIsoDate(manifest.source_checked_at) && compareDates(manifest.review_due_at, manifest.source_checked_at) < 0) {
    errors.push('review_due_at cannot be earlier than source_checked_at')
  }

  return { valid: errors.length === 0, errors }
}

export function assessPackagingMetadataEligibility(manifest, { asOf = null } = {}) {
  const validation = validateSourceManifest(manifest)
  const blockers = [...validation.errors]
  if (!validation.valid) return Object.freeze({ eligible: false, blockers })

  if (!isIsoDate(manifest.source_published_at)) blockers.push('source_published_at must be resolved before packaging')
  if (!isIsoDate(manifest.source_valid_at)) blockers.push('source_valid_at must be resolved before packaging')
  if (!isIsoDate(manifest.review_due_at)) blockers.push('review_due_at must be resolved before packaging')
  if (manifest.license_status !== 'verified-redistributable') blockers.push('license_status must be verified-redistributable')
  if (!isNonEmptyString(manifest.license_reference)) blockers.push('license_reference is required for packaging')
  for (const permission of ['transform', 'redistribute-offline']) {
    if (!manifest.license_scope.includes(permission)) blockers.push(`license_scope missing required permission: ${permission}`)
  }
  if (manifest.review_status !== 'approved') blockers.push('review_status must be approved')
  if (!isNonEmptyString(manifest.reviewed_by)) blockers.push('reviewed_by is required for approved packaging')
  if (manifest.crs_original === 'UNKNOWN') blockers.push('crs_original must be resolved before packaging')
  if (manifest.geometry_type === 'UNKNOWN') blockers.push('geometry_type must be resolved before packaging')
  if (!isSafeRelativePath(manifest.content_file)) blockers.push('content_file must be resolved before packaging')
  if (!HASH_PATTERN.test(manifest.content_hash ?? '')) blockers.push('content_hash must be resolved before packaging')

  if (asOf !== null) {
    if (!isIsoDate(asOf)) blockers.push('asOf must be YYYY-MM-DD')
    else if (isIsoDate(manifest.review_due_at) && compareDates(asOf, manifest.review_due_at) > 0) blockers.push(`source review expired after ${manifest.review_due_at}`)
  }

  return Object.freeze({ eligible: blockers.length === 0, blockers })
}

export async function loadSourceManifest(filePath, { read = readFile } = {}) {
  const raw = await read(filePath, 'utf8')
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('source manifest is not valid JSON')
  }
}

export async function inspectSourceManifest(filePath, { asOf = null, read = readFile, readBytes = readFile } = {}) {
  const manifest = await loadSourceManifest(filePath, { read })
  const validation = validateSourceManifest(manifest)
  const metadata = assessPackagingMetadataEligibility(manifest, { asOf })
  const blockers = [...metadata.blockers]
  let actualContentHash = null
  let contentHashMatches = false

  if (validation.valid && isSafeRelativePath(manifest.content_file) && HASH_PATTERN.test(manifest.content_hash ?? '')) {
    const root = path.resolve(path.dirname(filePath))
    const resolved = path.resolve(root, manifest.content_file)
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      blockers.push('content_file resolves outside manifest directory')
    } else {
      try {
        const bytes = await readBytes(resolved)
        actualContentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
        contentHashMatches = actualContentHash === manifest.content_hash
        if (!contentHashMatches) blockers.push('content_hash does not match content_file bytes')
      } catch (error) {
        blockers.push(`content_file could not be read: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  return Object.freeze({
    manifest,
    schemaValid: validation.valid,
    packagingMetadataEligible: metadata.eligible,
    packagingEligible: validation.valid && metadata.eligible && contentHashMatches,
    actualContentHash,
    contentHashMatches,
    errors: validation.errors,
    blockers: [...new Set(blockers)],
  })
}

export async function assessPackagingEligibility(manifest, options = {}) {
  return assessPackagingMetadataEligibility(manifest, options)
}

function parseCli(args) {
  let filePath = null
  let requirePackaging = false
  let asOf = null
  for (const arg of args) {
    if (arg === '--require-packaging') requirePackaging = true
    else if (arg.startsWith('--as-of=')) asOf = arg.slice('--as-of='.length)
    else if (arg.startsWith('-')) throw new Error(`Unknown argument: ${arg}`)
    else if (filePath) throw new Error('only one manifest path may be provided')
    else filePath = arg
  }
  if (!filePath) throw new Error('usage: source-manifest.mjs <manifest.json> [--require-packaging --as-of=YYYY-MM-DD]')
  if (requirePackaging && !asOf) throw new Error('--require-packaging requires --as-of=YYYY-MM-DD')
  return { filePath, requirePackaging, asOf }
}

async function main() {
  const options = parseCli(process.argv.slice(2))
  const result = await inspectSourceManifest(options.filePath, { asOf: options.asOf })
  process.stdout.write(`${JSON.stringify({
    file: options.filePath,
    source_id: result.manifest?.source_id ?? null,
    schemaValid: result.schemaValid,
    packagingMetadataEligible: result.packagingMetadataEligible,
    packagingEligible: result.packagingEligible,
    actualContentHash: result.actualContentHash,
    errors: result.errors,
    blockers: result.blockers,
  }, null, 2)}\n`)
  if (!result.schemaValid) process.exitCode = 1
  else if (options.requirePackaging && !result.packagingEligible) process.exitCode = 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
