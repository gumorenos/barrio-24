import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createSourceFetchPlan, detectArtifactFormat, validateResearchSourceUrl } from './source-fetch.mjs'
import { loadSourceManifest, validateSourceManifest } from './source-manifest.mjs'
import { inspectZipBuffer } from './zip-inspect.mjs'

export function validateFetchMetadata(metadata, { manifest, actualBytes }) {
  const errors = []
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return ['fetch metadata must be an object']
  if (metadata.schema_version !== 1) errors.push('fetch metadata schema_version must equal 1')
  if (metadata.source_id !== manifest.source_id) errors.push('fetch metadata source_id does not match manifest')
  if (metadata.requested_url !== manifest.source_url) errors.push('fetch metadata requested_url does not match manifest')
  try {
    validateResearchSourceUrl(metadata.final_url)
  } catch (error) {
    errors.push(`fetch metadata final_url is invalid: ${error instanceof Error ? error.message : String(error)}`)
  }

  const actualHash = `sha256:${createHash('sha256').update(actualBytes).digest('hex')}`
  const actualFormat = detectArtifactFormat(actualBytes)
  if (metadata.sha256 !== actualHash) errors.push('fetch metadata sha256 does not match cached bytes')
  if (metadata.size_bytes !== actualBytes.byteLength) errors.push('fetch metadata size_bytes does not match cached bytes')
  if (metadata.artifact_format !== actualFormat) errors.push('fetch metadata artifact_format does not match cached bytes')
  if (manifest.content_hash !== null && manifest.content_hash !== actualHash) errors.push('manifest content_hash does not match cached bytes')
  return errors
}

function safeResolve(root, relativePath) {
  const resolved = path.resolve(root, relativePath)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`resolved path escapes cwd: ${relativePath}`)
  return resolved
}

export async function auditCachedResearchSource(manifestPath, {
  cwd = process.cwd(),
  cacheDir,
  readText = (filePath) => readFile(filePath, 'utf8'),
  readBytes = readFile,
} = {}) {
  const manifest = await loadSourceManifest(manifestPath, { read: readText })
  const validation = validateSourceManifest(manifest)
  if (!validation.valid) {
    return {
      source_id: manifest?.source_id ?? null,
      integrityValid: false,
      errors: [...validation.errors],
      artifact: null,
      shapefile: null,
    }
  }

  const plan = createSourceFetchPlan(manifest, cacheDir ? { cacheDir } : {})
  const root = path.resolve(cwd)
  const bytesPath = safeResolve(root, plan.bytesFile)
  const metadataPath = safeResolve(root, plan.metadataFile)

  let metadata
  let bytes
  const errors = []
  try {
    metadata = JSON.parse(await readText(metadataPath))
  } catch (error) {
    return {
      source_id: manifest.source_id,
      integrityValid: false,
      errors: [`fetch metadata could not be read: ${error instanceof Error ? error.message : String(error)}`],
      artifact: null,
      shapefile: null,
    }
  }
  try {
    bytes = Buffer.from(await readBytes(bytesPath))
  } catch (error) {
    return {
      source_id: manifest.source_id,
      integrityValid: false,
      errors: [`cached source bytes could not be read: ${error instanceof Error ? error.message : String(error)}`],
      artifact: null,
      shapefile: null,
    }
  }

  errors.push(...validateFetchMetadata(metadata, { manifest, actualBytes: bytes }))
  const actualHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  const actualFormat = detectArtifactFormat(bytes)
  let shapefile = null
  if (errors.length === 0 && actualFormat === 'zip') {
    try {
      shapefile = inspectZipBuffer(bytes)
    } catch (error) {
      errors.push(`ZIP inspection failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    source_id: manifest.source_id,
    integrityValid: errors.length === 0,
    errors,
    artifact: {
      requested_url: manifest.source_url,
      final_url: metadata.final_url ?? null,
      size_bytes: bytes.byteLength,
      sha256: actualHash,
      artifact_format: actualFormat,
      cache_bytes_file: plan.bytesFile,
      cache_metadata_file: plan.metadataFile,
    },
    shapefile,
  }
}

function parseCli(args) {
  let manifestPath = null
  let cacheDir = null
  let requireComplete = false
  for (const arg of args) {
    if (arg === '--require-shapefile-complete') requireComplete = true
    else if (arg.startsWith('--cache-dir=')) cacheDir = arg.slice('--cache-dir='.length)
    else if (arg.startsWith('-')) throw new Error(`Unknown argument: ${arg}`)
    else if (manifestPath) throw new Error('only one source manifest path may be provided')
    else manifestPath = arg
  }
  if (!manifestPath) throw new Error('usage: source-audit.mjs <source-manifest.json> [--cache-dir=path] [--require-shapefile-complete]')
  return { manifestPath, cacheDir, requireComplete }
}

async function main() {
  const options = parseCli(process.argv.slice(2))
  const result = await auditCachedResearchSource(options.manifestPath, { cacheDir: options.cacheDir ?? undefined })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.integrityValid) process.exitCode = 1
  else if (options.requireComplete && (!result.shapefile || !result.shapefile.shapefile_complete)) process.exitCode = 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
