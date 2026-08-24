import { createHash } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadSourceManifest, validateSourceManifest } from './source-manifest.mjs'

export const SOURCE_FETCH_MAX_BYTES = 64 * 1024 * 1024
export const SOURCE_FETCH_TIMEOUT_MS = 30_000
export const SOURCE_FETCH_MAX_REDIRECTS = 3
export const DEFAULT_SOURCE_CACHE_DIR = 'artifacts/ruta-alta-research'

const ALLOWED_SOURCE_HOSTS = new Set([
  'dhn.mil.pe',
  'www.dhn.mil.pe',
  'sigrid.cenepred.gob.pe',
  'sigrid4.cenepred.gob.pe',
])

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value)) return false
  const posix = value.replaceAll('\\', '/')
  const normalized = path.posix.normalize(posix)
  return normalized === posix && normalized !== '..' && !normalized.startsWith('../')
}

export function validateResearchSourceUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('source_url must be a valid URL')
  }
  if (url.protocol !== 'https:') throw new Error('source_url must use HTTPS')
  if (!ALLOWED_SOURCE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`source host is not allowlisted for research fetch: ${url.hostname}`)
  }
  if (url.username || url.password) throw new Error('source_url must not include credentials')
  return url
}

export function createSourceFetchPlan(manifest, { cacheDir = DEFAULT_SOURCE_CACHE_DIR } = {}) {
  const validation = validateSourceManifest(manifest)
  if (!validation.valid) throw new Error(`source manifest is invalid: ${validation.errors.join('; ')}`)
  if (!manifest.license_scope.includes('download')) throw new Error('source manifest does not grant/record download scope')
  const url = validateResearchSourceUrl(manifest.source_url)
  if (!isSafeRelativePath(cacheDir)) throw new Error('cacheDir must be a normalized relative path')

  const artifactDir = path.posix.join(cacheDir, manifest.source_id)
  return Object.freeze({
    sourceId: manifest.source_id,
    sourceUrl: url.href,
    artifactDir,
    bytesFile: path.posix.join(artifactDir, 'source.bin'),
    metadataFile: path.posix.join(artifactDir, 'fetch-metadata.json'),
    maxBytes: SOURCE_FETCH_MAX_BYTES,
    timeoutMs: SOURCE_FETCH_TIMEOUT_MS,
    maxRedirects: SOURCE_FETCH_MAX_REDIRECTS,
  })
}

function expectedFormatFromUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase()
  if (pathname.endsWith('.zip')) return 'zip'
  if (pathname.endsWith('.pdf')) return 'pdf'
  return null
}

export function detectArtifactFormat(bytes) {
  const buffer = Buffer.from(bytes)
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf'
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]) && [0x04, 0x06, 0x08].includes(buffer[3])) return 'zip'
  return 'unknown'
}

function headerNumber(headers, name) {
  const raw = headers?.get?.(name)
  if (raw === null || raw === undefined || raw === '') return null
  if (!/^\d+$/.test(raw)) throw new Error(`${name} response header is invalid`)
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} response header is invalid`)
  return value
}

async function readResponseBody(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) throw new Error(`source exceeds maximum allowed bytes (${maxBytes})`)
    return bytes
  }

  const chunks = []
  let total = 0
  const reader = response.body.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = Buffer.from(value)
      total += chunk.byteLength
      if (total > maxBytes) {
        await reader.cancel('source too large').catch(() => {})
        throw new Error(`source exceeds maximum allowed bytes (${maxBytes})`)
      }
      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock?.()
  }
  return Buffer.concat(chunks, total)
}

export async function fetchResearchSource(sourceUrl, {
  fetchImpl = globalThis.fetch,
  maxBytes = SOURCE_FETCH_MAX_BYTES,
  timeoutMs = SOURCE_FETCH_TIMEOUT_MS,
  maxRedirects = SOURCE_FETCH_MAX_REDIRECTS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is unavailable')
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > SOURCE_FETCH_MAX_BYTES) throw new Error('maxBytes is outside the safe bound')
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > SOURCE_FETCH_TIMEOUT_MS) throw new Error('timeoutMs is outside the safe bound')
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > SOURCE_FETCH_MAX_REDIRECTS) throw new Error('maxRedirects is outside the safe bound')

  let current = validateResearchSourceUrl(sourceUrl)
  let redirects = 0
  while (true) {
    const response = await fetchImpl(current.href, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'user-agent': 'Barrio24-SourceResearch/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (response.status >= 300 && response.status < 400) {
      if (redirects >= maxRedirects) throw new Error('source exceeded maximum redirects')
      const location = response.headers.get('location')
      if (!location) throw new Error('source redirect is missing Location header')
      current = validateResearchSourceUrl(new URL(location, current).href)
      redirects += 1
      continue
    }

    if (!response.ok) throw new Error(`source fetch failed with HTTP ${response.status}`)
    const declaredLength = headerNumber(response.headers, 'content-length')
    if (declaredLength !== null && declaredLength > maxBytes) {
      throw new Error(`source Content-Length exceeds maximum allowed bytes (${maxBytes})`)
    }
    const bytes = await readResponseBody(response, maxBytes)
    const artifactFormat = detectArtifactFormat(bytes)
    const expectedFormat = expectedFormatFromUrl(current.href)
    if (expectedFormat && artifactFormat !== expectedFormat) {
      throw new Error(`source bytes do not match expected ${expectedFormat} format`)
    }
    return Object.freeze({
      bytes,
      finalUrl: current.href,
      redirects,
      sizeBytes: bytes.byteLength,
      sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      artifactFormat,
      contentType: response.headers.get('content-type'),
      contentLengthDeclared: declaredLength,
    })
  }
}

export async function cacheResearchSource(manifestPath, {
  execute = false,
  cacheDir = DEFAULT_SOURCE_CACHE_DIR,
  fetchImpl = globalThis.fetch,
  cwd = process.cwd(),
} = {}) {
  const manifest = await loadSourceManifest(manifestPath)
  const plan = createSourceFetchPlan(manifest, { cacheDir })
  if (!execute) return { mode: 'dry-run', plan }

  const fetched = await fetchResearchSource(plan.sourceUrl, { fetchImpl })
  const root = path.resolve(cwd)
  const artifactDir = path.resolve(root, plan.artifactDir)
  if (artifactDir !== root && !artifactDir.startsWith(`${root}${path.sep}`)) throw new Error('resolved artifact directory escapes cwd')
  await mkdir(artifactDir, { recursive: true, mode: 0o700 })

  const bytesPath = path.join(artifactDir, 'source.bin')
  const metadataPath = path.join(artifactDir, 'fetch-metadata.json')
  const tempBytes = `${bytesPath}.tmp-${process.pid}`
  const tempMetadata = `${metadataPath}.tmp-${process.pid}`
  const metadata = {
    schema_version: 1,
    source_id: plan.sourceId,
    requested_url: plan.sourceUrl,
    final_url: fetched.finalUrl,
    redirects: fetched.redirects,
    size_bytes: fetched.sizeBytes,
    sha256: fetched.sha256,
    artifact_format: fetched.artifactFormat,
    content_type: fetched.contentType,
    content_length_declared: fetched.contentLengthDeclared,
  }

  try {
    await writeFile(tempBytes, fetched.bytes, { mode: 0o600 })
    await writeFile(tempMetadata, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 })
    await rename(tempBytes, bytesPath)
    await rename(tempMetadata, metadataPath)
  } catch (error) {
    await Promise.all([rm(tempBytes, { force: true }), rm(tempMetadata, { force: true })])
    throw error
  }

  return {
    mode: 'execute',
    plan,
    metadata,
    bytesPath,
    metadataPath,
  }
}

function parseCli(args) {
  let manifestPath = null
  let execute = false
  for (const arg of args) {
    if (arg === '--execute') execute = true
    else if (arg.startsWith('-')) throw new Error(`Unknown argument: ${arg}`)
    else if (manifestPath) throw new Error('only one source manifest path may be provided')
    else manifestPath = arg
  }
  if (!manifestPath) throw new Error('usage: source-fetch.mjs <source-manifest.json> [--execute]')
  return { manifestPath, execute }
}

async function main() {
  const options = parseCli(process.argv.slice(2))
  const result = await cacheResearchSource(options.manifestPath, { execute: options.execute })
  process.stdout.write(`${JSON.stringify(result.mode === 'dry-run' ? result : { mode: result.mode, plan: result.plan, metadata: result.metadata }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
