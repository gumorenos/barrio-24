import { describe, expect, it } from 'vitest'
import {
  buildRutaAltaPackage,
  serializeRutaAltaPackage,
  verifyRutaAltaPackageIntegrity,
  type RutaAltaPackageBuildInput,
} from './ruta-alta-package-builder'

const SOURCE_HASH_A = `sha256:${'a'.repeat(64)}`
const SOURCE_HASH_B = `sha256:${'b'.repeat(64)}`

function input(): RutaAltaPackageBuildInput {
  return {
    package_id: 'la-punta-synthetic',
    area_name: 'La Punta, Callao',
    package_version: '2026.09.synthetic.1',
    generated_at: '2026-09-19T18:00:00Z',
    valid_at: '2026-09-19',
    review_due_at: '2026-12-19',
    reviewed_by: 'synthetic-reviewer',
    source_manifests: [
      { source_id: 'source-b', content_hash: SOURCE_HASH_B, license_status: 'verified-redistributable', review_status: 'approved' },
      { source_id: 'source-a', content_hash: SOURCE_HASH_A, license_status: 'verified-redistributable', review_status: 'approved' },
    ],
    features: [
      {
        id: 'route-b',
        kind: 'evacuation-route',
        label: 'Synthetic route B',
        geometry: { type: 'LineString', coordinates: [[-77.16, -12.06], [-77.15, -12.05]] },
        authority_source_id: 'source-b',
      },
      {
        id: 'refuge-a',
        kind: 'vertical-refuge',
        label: 'Synthetic refuge A',
        geometry: { type: 'Point', coordinates: [-77.17, -12.07] },
        authority_source_id: 'source-a',
      },
    ],
  }
}

describe('Ruta Alta deterministic package builder', () => {
  it('builds the same package regardless of input ordering', async () => {
    const first = await buildRutaAltaPackage(input())
    const reversed = input()
    reversed.source_manifests.reverse()
    reversed.features.reverse()
    const second = await buildRutaAltaPackage(reversed)

    expect(second).toEqual(first)
    expect(serializeRutaAltaPackage(second)).toBe(serializeRutaAltaPackage(first))
  })

  it('sorts sources and features before hashing', async () => {
    const pkg = await buildRutaAltaPackage(input())
    expect(pkg.source_manifests.map((source) => source.source_id)).toEqual(['source-a', 'source-b'])
    expect(pkg.features.map((feature) => feature.id)).toEqual(['refuge-a', 'route-b'])
  })

  it('verifies integrity and detects tampering', async () => {
    const pkg = await buildRutaAltaPackage(input())
    expect(await verifyRutaAltaPackageIntegrity(pkg)).toBe(true)

    const tampered = structuredClone(pkg)
    tampered.features[0].label = 'Tampered label'
    expect(await verifyRutaAltaPackageIntegrity(tampered)).toBe(false)
  })

  it('fails closed when the builder receives a non-redistributable source', async () => {
    const candidate = input()
    candidate.source_manifests[0].license_status = 'unknown' as 'verified-redistributable'
    await expect(buildRutaAltaPackage(candidate)).rejects.toThrow(/source is not redistributable/)
  })
})
