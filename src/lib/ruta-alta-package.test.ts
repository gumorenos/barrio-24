import { describe, expect, it } from 'vitest'
import { assertRutaAltaPackage, validateRutaAltaPackage } from './ruta-alta-package'

const HASH = `sha256:${'a'.repeat(64)}`

function validPackage() {
  return {
    schema_version: 1,
    package_id: 'la-punta-pilot',
    area_name: 'La Punta, Callao',
    package_version: '2026.09.1',
    generated_at: '2026-09-19T17:00:00Z',
    valid_at: '2026-09-19',
    review_due_at: '2026-12-19',
    content_hash: HASH,
    review_status: 'approved',
    reviewed_by: 'human-reviewer',
    source_manifests: [{
      source_id: 'synthetic-authority-fixture',
      content_hash: HASH,
      license_status: 'verified-redistributable',
      review_status: 'approved',
    }],
    features: [{
      id: 'synthetic-route-1',
      kind: 'evacuation-route',
      label: 'Synthetic test route',
      geometry: { type: 'LineString', coordinates: [[-77.17, -12.07], [-77.16, -12.06]] },
      authority_source_id: 'synthetic-authority-fixture',
    }],
  }
}

describe('Ruta Alta package gate', () => {
  it('accepts a reviewed, redistributable, current package', () => {
    const result = validateRutaAltaPackage(validPackage(), new Date('2026-09-20T00:00:00Z'))
    expect(result).toEqual({ ok: true, errors: [] })
  })

  it('fails closed when a source license is unknown', () => {
    const pkg = validPackage()
    pkg.source_manifests[0].license_status = 'unknown' as 'verified-redistributable'
    const result = validateRutaAltaPackage(pkg, new Date('2026-09-20T00:00:00Z'))
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('source is not redistributable: synthetic-authority-fixture')
  })

  it('rejects expired human review', () => {
    const pkg = validPackage()
    pkg.review_due_at = '2026-09-18'
    const result = validateRutaAltaPackage(pkg, new Date('2026-09-20T00:00:00Z'))
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('package review is expired')
  })

  it('rejects features that cannot be traced to a source', () => {
    const pkg = validPackage()
    pkg.features[0].authority_source_id = 'missing-source'
    const result = validateRutaAltaPackage(pkg, new Date('2026-09-20T00:00:00Z'))
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('feature references unknown source: synthetic-route-1')
  })

  it('rejects malformed coordinates', () => {
    const pkg = validPackage()
    pkg.features[0].geometry.coordinates = [[-777, -12.07], [-77.16, -12.06]]
    expect(validateRutaAltaPackage(pkg, new Date('2026-09-20T00:00:00Z')).ok).toBe(false)
  })

  it('throws before unsafe data can enter the product', () => {
    const pkg = validPackage()
    pkg.review_status = 'research' as 'approved'
    expect(() => assertRutaAltaPackage(pkg, new Date('2026-09-20T00:00:00Z'))).toThrow(/package review_status must be approved/)
  })
})
