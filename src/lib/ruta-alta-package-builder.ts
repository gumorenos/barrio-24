import {
  RUTA_ALTA_PACKAGE_SCHEMA_VERSION,
  assertRutaAltaPackage,
  type RutaAltaFeature,
  type RutaAltaPackage,
} from './ruta-alta-package'

export interface RutaAltaPackageBuildInput {
  package_id: string
  area_name: string
  package_version: string
  generated_at: string
  valid_at: string
  review_due_at: string
  reviewed_by: string
  source_manifests: RutaAltaPackage['source_manifests']
  features: RutaAltaFeature[]
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function normalizedInput(input: RutaAltaPackageBuildInput): RutaAltaPackageBuildInput {
  return {
    ...input,
    source_manifests: [...input.source_manifests].sort((a, b) => a.source_id.localeCompare(b.source_id)),
    features: [...input.features].sort((a, b) => a.id.localeCompare(b.id)),
  }
}

export async function buildRutaAltaPackage(input: RutaAltaPackageBuildInput): Promise<RutaAltaPackage> {
  const normalized = normalizedInput(input)
  const unsigned = {
    schema_version: RUTA_ALTA_PACKAGE_SCHEMA_VERSION,
    package_id: normalized.package_id,
    area_name: normalized.area_name.trim(),
    package_version: normalized.package_version.trim(),
    generated_at: normalized.generated_at,
    valid_at: normalized.valid_at,
    review_due_at: normalized.review_due_at,
    review_status: 'approved' as const,
    reviewed_by: normalized.reviewed_by.trim(),
    source_manifests: normalized.source_manifests,
    features: normalized.features,
  }
  const content_hash = await sha256(canonicalize(unsigned))
  const pkg: RutaAltaPackage = { ...unsigned, content_hash }
  return assertRutaAltaPackage(pkg, new Date(normalized.generated_at))
}

export async function verifyRutaAltaPackageIntegrity(pkg: RutaAltaPackage): Promise<boolean> {
  const { content_hash, ...unsigned } = pkg
  return content_hash.toLowerCase() === (await sha256(canonicalize(unsigned))).toLowerCase()
}

export function serializeRutaAltaPackage(pkg: RutaAltaPackage): string {
  return `${canonicalize(pkg)}\n`
}
