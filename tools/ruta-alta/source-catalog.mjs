import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectSourceManifest } from './source-manifest.mjs'

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/
const REQUIRED_KEYS = Object.freeze([
  'schema_version',
  'catalog_id',
  'area_name',
  'country_code',
  'source_manifests',
])

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeRelativePath(value) {
  if (!isNonEmptyString(value) || path.isAbsolute(value)) return false
  const posixValue = value.replaceAll('\\', '/')
  const normalized = path.posix.normalize(posixValue)
  return normalized !== '..' && !normalized.startsWith('../') && normalized === posixValue
}

export function validateSourceCatalog(catalog) {
  const errors = []
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return { valid: false, errors: ['catalog must be an object'] }
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in catalog)) errors.push(`missing required field: ${key}`)
  }
  for (const key of Object.keys(catalog)) {
    if (!REQUIRED_KEYS.includes(key)) errors.push(`unexpected field: ${key}`)
  }

  if (catalog.schema_version !== 1) errors.push('schema_version must equal 1')
  if (!ID_PATTERN.test(catalog.catalog_id ?? '')) errors.push('catalog_id must use lowercase safe identifier characters')
  if (!isNonEmptyString(catalog.area_name)) errors.push('area_name is required')
  if (catalog.country_code !== 'PE') errors.push('country_code must equal PE')

  if (!Array.isArray(catalog.source_manifests) || catalog.source_manifests.length === 0) {
    errors.push('source_manifests must be a non-empty array')
  } else {
    const seen = new Set()
    for (const manifestPath of catalog.source_manifests) {
      if (!isSafeRelativePath(manifestPath)) {
        errors.push(`source manifest path must be normalized and relative: ${String(manifestPath)}`)
        continue
      }
      if (seen.has(manifestPath)) errors.push(`duplicate source manifest path: ${manifestPath}`)
      seen.add(manifestPath)
    }
  }

  return { valid: errors.length === 0, errors }
}

export async function loadSourceCatalog(filePath, { read = readFile } = {}) {
  const raw = await read(filePath, 'utf8')
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('source catalog is not valid JSON')
  }
}

export async function inspectSourceCatalog(filePath, { asOf = null, read = readFile } = {}) {
  const catalog = await loadSourceCatalog(filePath, { read })
  const validation = validateSourceCatalog(catalog)
  if (!validation.valid) {
    return {
      catalog,
      schemaValid: false,
      packagingEligible: false,
      sources: [],
      blockers: [...validation.errors],
    }
  }

  const root = path.resolve(path.dirname(filePath))
  const sources = []
  const blockers = []
  const sourceIds = new Map()

  for (const relativePath of catalog.source_manifests) {
    const resolved = path.resolve(root, relativePath)
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      blockers.push(`resolved source manifest escapes catalog directory: ${relativePath}`)
      continue
    }

    let inspection
    try {
      inspection = await inspectSourceManifest(resolved, { asOf, read })
    } catch (error) {
      blockers.push(`source manifest could not be inspected: ${relativePath}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    const sourceId = inspection.manifest?.source_id ?? null
    const summary = {
      manifest_path: relativePath,
      source_id: sourceId,
      source_url: inspection.manifest?.source_url ?? null,
      schema_valid: inspection.schemaValid,
      packaging_eligible: inspection.packagingEligible,
      blockers: [...inspection.blockers],
    }
    sources.push(summary)

    if (typeof sourceId === 'string') {
      const first = sourceIds.get(sourceId)
      if (first) blockers.push(`duplicate source_id ${sourceId}: ${first} and ${relativePath}`)
      else sourceIds.set(sourceId, relativePath)
    }
    if (!inspection.schemaValid) blockers.push(`source manifest is structurally invalid: ${relativePath}`)
    if (!inspection.packagingEligible) blockers.push(`source is not packaging-eligible: ${relativePath}`)
  }

  return {
    catalog,
    schemaValid: true,
    packagingEligible: sources.length === catalog.source_manifests.length && blockers.length === 0,
    sources,
    blockers,
  }
}

function parseCli(args) {
  let filePath = null
  let requirePackaging = false
  let asOf = null
  for (const arg of args) {
    if (arg === '--require-packaging') requirePackaging = true
    else if (arg.startsWith('--as-of=')) asOf = arg.slice('--as-of='.length)
    else if (arg.startsWith('-')) throw new Error(`Unknown argument: ${arg}`)
    else if (filePath) throw new Error('only one catalog path may be provided')
    else filePath = arg
  }
  if (!filePath) throw new Error('usage: source-catalog.mjs <catalog.json> [--require-packaging --as-of=YYYY-MM-DD]')
  if (requirePackaging && !asOf) throw new Error('--require-packaging requires --as-of to evaluate source freshness deterministically')
  return { filePath, requirePackaging, asOf }
}

async function main() {
  const options = parseCli(process.argv.slice(2))
  const result = await inspectSourceCatalog(options.filePath, { asOf: options.asOf })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.schemaValid) process.exitCode = 1
  else if (options.requirePackaging && !result.packagingEligible) process.exitCode = 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
