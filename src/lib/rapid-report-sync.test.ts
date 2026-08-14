import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRapidReport, type RapidReport } from './rapid-report'

const testState = vi.hoisted(() => ({
  reports: [] as RapidReport[],
  update: vi.fn(),
}))

vi.mock('./db', () => ({
  db: {
    rapidReports: {
      where: () => ({
        anyOf: () => ({ toArray: async () => testState.reports }),
      }),
      update: testState.update,
    },
  },
  getClientId: async () => '00000000-0000-4000-8000-000000000099',
}))

import { syncLocalRapidReports } from './rapid-report-sync'

function makeReports(): RapidReport[] {
  return [
    createRapidReport(
      { category: 'blocked-street', severity: 'attention' },
      1_754_000_000_000,
      '00000000-0000-4000-8000-000000000001',
    ),
    createRapidReport(
      { category: 'water-shortage', severity: 'observed' },
      1_754_000_000_001,
      '00000000-0000-4000-8000-000000000002',
    ),
  ]
}

describe('Sincronización de reportes', () => {
  beforeEach(() => {
    testState.reports = makeReports()
    testState.update.mockReset()
  })

  it('acepta reportes recibidos y detiene la ráfaga cuando el API limita', async () => {
    let calls = 0
    const requestFetch = vi.fn(async () => {
      calls += 1
      if (calls === 1) return new Response('{}', { status: 202 })
      return new Response('{}', { status: 429, headers: { 'retry-after': '60' } })
    })

    const summary = await syncLocalRapidReports(
      'https://api.example.test',
      requestFetch as unknown as typeof fetch,
    )

    expect(summary).toMatchObject({
      attempted: 2,
      sent: 1,
      failed: 1,
      failure: 'rate-limited',
      retryAfterSeconds: 60,
    })
    expect(summary.message).toContain('limitó temporalmente')
    expect(calls).toBe(2)
    expect(testState.update).toHaveBeenCalledWith(testState.reports[0].id, { status: 'unverified' })
    expect(testState.update).toHaveBeenLastCalledWith(testState.reports[1].id, { status: 'sync-failed' })
  })

  it('marca una caída del servicio sin seguir enviando la ráfaga', async () => {
    const requestFetch = vi.fn(async () => new Response('{}', { status: 503 }))

    const summary = await syncLocalRapidReports(
      'https://api.example.test',
      requestFetch as unknown as typeof fetch,
    )

    expect(summary).toMatchObject({
      attempted: 1,
      sent: 0,
      failed: 1,
      failure: 'service-unavailable',
    })
    expect(summary.message).toContain('no está disponible')
    expect(requestFetch).toHaveBeenCalledTimes(1)
  })

  it('evita que un API que no responde deje la sincronización colgada', async () => {
    const requestFetch = vi.fn(() => new Promise<Response>(() => {}))

    const summary = await syncLocalRapidReports(
      'https://api.example.test',
      requestFetch as unknown as typeof fetch,
      5,
    )

    expect(summary).toMatchObject({
      attempted: 1,
      sent: 0,
      failed: 1,
      failure: 'timeout',
    })
    expect(summary.message).toContain('tardó demasiado')
  })
})
