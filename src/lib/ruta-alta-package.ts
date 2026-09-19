export const RUTA_ALTA_PACKAGE_SCHEMA_VERSION = 1 as const

export type RutaAltaGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: Array<[number, number]> }
  | { type: 'Polygon'; coordinates: Array<Array<[number, number]>> }

export interface RutaAltaFeature {
  id: string
  kind: 'evacuation-route' | 'vertical-refuge' | 'safe-zone' | 'hazard-zone'
  label: string
  geometry: RutaAltaGeometry
  authority_source_id: string
}

export interface RutaAltaPackage {
  schema_version: typeof RUTA_ALTA_PACKAGE_SCHEMA_VERSION
  package_id: string
  area_name: string
  package_version: string
  generated_at: string
  valid_at: string
  review_due_at: string
  content_hash: string
  review_status: 'approved'
  reviewed_by: string
  source_manifests: Array<{
    source_id: string
    content_hash: string
    license_status: 'verified-redistributable'
    review_status: 'approved'
  }>
  features: RutaAltaFeature[]
}

export interface RutaAltaValidationResult {
  ok: boolean
  errors: string[]
}

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/i
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function validInstant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function validPosition(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2) return false
  const [longitude, latitude] = value
  return typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    && typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
}

function validGeometry(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const geometry = value as { type?: unknown; coordinates?: unknown }
  if (geometry.type === 'Point') return validPosition(geometry.coordinates)
  if (geometry.type === 'LineString') return Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2 && geometry.coordinates.every(validPosition)
  if (geometry.type === 'Polygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return false
    return geometry.coordinates.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.every(validPosition))
  }
  return false
}

export function validateRutaAltaPackage(value: unknown, asOf = new Date()): RutaAltaValidationResult {
  const errors: string[] = []
  if (!value || typeof value !== 'object') return { ok: false, errors: ['package must be an object'] }
  const pkg = value as Partial<RutaAltaPackage>

  if (pkg.schema_version !== RUTA_ALTA_PACKAGE_SCHEMA_VERSION) errors.push('unsupported schema_version')
  if (typeof pkg.package_id !== 'string' || !ID_PATTERN.test(pkg.package_id)) errors.push('invalid package_id')
  if (typeof pkg.area_name !== 'string' || !pkg.area_name.trim()) errors.push('area_name is required')
  if (typeof pkg.package_version !== 'string' || !pkg.package_version.trim()) errors.push('package_version is required')
  if (!validInstant(pkg.generated_at)) errors.push('generated_at must be an ISO timestamp')
  if (!validDate(pkg.valid_at)) errors.push('valid_at must be YYYY-MM-DD')
  if (!validDate(pkg.review_due_at)) errors.push('review_due_at must be YYYY-MM-DD')
  if (typeof pkg.content_hash !== 'string' || !SHA256_PATTERN.test(pkg.content_hash)) errors.push('content_hash must be sha256:<64 hex>')
  if (pkg.review_status !== 'approved') errors.push('package review_status must be approved')
  if (typeof pkg.reviewed_by !== 'string' || !pkg.reviewed_by.trim()) errors.push('reviewed_by is required')

  if (validDate(pkg.review_due_at)) {
    const endOfReviewDay = Date.parse(`${pkg.review_due_at}T23:59:59.999Z`)
    if (asOf.getTime() > endOfReviewDay) errors.push('package review is expired')
  }

  if (!Array.isArray(pkg.source_manifests) || pkg.source_manifests.length === 0) {
    errors.push('at least one source_manifest is required')
  } else {
    const sourceIds = new Set<string>()
    for (const source of pkg.source_manifests) {
      if (!source || typeof source !== 'object') { errors.push('invalid source_manifest'); continue }
      if (typeof source.source_id !== 'string' || !ID_PATTERN.test(source.source_id)) errors.push('invalid source_id')
      else if (sourceIds.has(source.source_id)) errors.push(`duplicate source_id: ${source.source_id}`)
      else sourceIds.add(source.source_id)
      if (typeof source.content_hash !== 'string' || !SHA256_PATTERN.test(source.content_hash)) errors.push(`invalid source content_hash: ${String(source.source_id ?? '')}`)
      if (source.license_status !== 'verified-redistributable') errors.push(`source is not redistributable: ${String(source.source_id ?? '')}`)
      if (source.review_status !== 'approved') errors.push(`source is not approved: ${String(source.source_id ?? '')}`)
    }
  }

  const allowedKinds = new Set(['evacuation-route', 'vertical-refuge', 'safe-zone', 'hazard-zone'])
  const sourceIds = new Set(Array.isArray(pkg.source_manifests) ? pkg.source_manifests.map((source) => source?.source_id).filter((id): id is string => typeof id === 'string') : [])
  if (!Array.isArray(pkg.features) || pkg.features.length === 0) errors.push('at least one feature is required')
  else {
    const featureIds = new Set<string>()
    for (const feature of pkg.features) {
      if (!feature || typeof feature !== 'object') { errors.push('invalid feature'); continue }
      if (typeof feature.id !== 'string' || !ID_PATTERN.test(feature.id)) errors.push('invalid feature id')
      else if (featureIds.has(feature.id)) errors.push(`duplicate feature id: ${feature.id}`)
      else featureIds.add(feature.id)
      if (!allowedKinds.has(feature.kind)) errors.push(`invalid feature kind: ${String(feature.kind)}`)
      if (typeof feature.label !== 'string' || !feature.label.trim()) errors.push(`feature label is required: ${String(feature.id ?? '')}`)
      if (!validGeometry(feature.geometry)) errors.push(`invalid feature geometry: ${String(feature.id ?? '')}`)
      if (typeof feature.authority_source_id !== 'string' || !sourceIds.has(feature.authority_source_id)) errors.push(`feature references unknown source: ${String(feature.id ?? '')}`)
    }
  }

  return { ok: errors.length === 0, errors }
}

export function assertRutaAltaPackage(value: unknown, asOf = new Date()): RutaAltaPackage {
  const result = validateRutaAltaPackage(value, asOf)
  if (!result.ok) throw new Error(`Ruta Alta package rejected: ${result.errors.join('; ')}`)
  return value as RutaAltaPackage
}
