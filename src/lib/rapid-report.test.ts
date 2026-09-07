import { describe, expect, it } from 'vitest'
import {
  createRapidReport,
  getApproximateLocationCell,
  getRapidReportStatusLabel,
  isRapidReport,
  serializeRapidReports,
} from './rapid-report'

describe('Reporte 60 segundos local', () => {
  it('redondea la ubicación antes de conservarla', () => {
    expect(getApproximateLocationCell(-12.1024, -77.0349)).toBe('-12.10,-77.03')
    expect(getApproximateLocationCell(-0.004, 0.004)).toBe('0.00,0.00')
  })

  it('crea un reporte sin coordenadas exactas', () => {
    const report = createRapidReport(
      { category: 'blocked-street', severity: 'attention', locationCell: '-12.10,-77.03' },
      1_754_000_000_000,
      '00000000-0000-4000-8000-000000000001',
    )

    expect(report).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      category: 'blocked-street',
      severity: 'attention',
      locationCell: '-12.10,-77.03',
      status: 'local-only',
    })
    expect(isRapidReport(report)).toBe(true)
    expect(report).not.toHaveProperty('latitude')
    expect(report).not.toHaveProperty('longitude')
  })

  it('rechaza una categoría o gravedad que no pertenezca al catálogo', () => {
    expect(() => createRapidReport({ category: 'unknown' as never, severity: 'attention' })).toThrow('categoría')
    expect(() => createRapidReport({ category: 'blocked-street', severity: 'unknown' as never })).toThrow('gravedad')
  })

  it('distingue el estado local del estado remoto no verificado', () => {
    expect(getRapidReportStatusLabel('local-only')).toBe('Solo en este dispositivo')
    expect(getRapidReportStatusLabel('unverified')).toBe('Recibido · no verificado')
  })

  it('exporta solo el contrato local permitido, sin coordenadas exactas', () => {
    const report = createRapidReport(
      { category: 'blocked-street', severity: 'attention', locationCell: '-12.10,-77.03' },
      1_754_000_000_000,
      '00000000-0000-4000-8000-000000000001',
    )

    const exported = serializeRapidReports([report], '2026-08-14T00:00:00.000Z')
    const parsed = JSON.parse(exported) as { reports: Array<Record<string, unknown>> }

    expect(parsed.reports[0]).toMatchObject({
      event_id: report.id,
      location_cell: '-12.10,-77.03',
      status: 'local-only',
    })
    expect(parsed.reports[0]).not.toHaveProperty('latitude')
    expect(parsed.reports[0]).not.toHaveProperty('longitude')
    expect(exported).not.toContain('lat')
  })
})
