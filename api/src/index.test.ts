import { describe, expect, it } from 'vitest'
import worker from './index'

const ALLOWED_ORIGIN = 'https://preview.example.test'
const EVENT_ID = '00000000-0000-4000-8000-000000000001'

type StoredReport = {
  event_id: string
  schema_version: number
  category: string
  severity: string
  location_cell: string | null
  observed_at: string
  status: string
  received_at: number
}

class MockD1Statement {
  private values: unknown[] = []

  constructor(
    private readonly database: MockD1Database,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]): MockD1Statement {
    this.values = values
    return this
  }

  async first<T extends Record<string, unknown>>(): Promise<T | null> {
    if (this.query.includes('SELECT event_id, status FROM reports')) {
      const report = this.database.reports.get(String(this.values[0]))
      return report ? { event_id: report.event_id, status: report.status } as unknown as T : null
    }
    return null
  }

  async all<T extends Record<string, unknown>>(): Promise<{ results: T[] }> {
    if (!this.query.includes('SELECT event_id, schema_version, category, severity')) {
      return { results: [] }
    }

    let valueIndex = 0
    const status = this.query.includes('status = ?') ? String(this.values[valueIndex++]) : null
    let cursorReceivedAt: number | null = null
    let cursorEventId: string | null = null
    if (this.query.includes('received_at < ?')) {
      cursorReceivedAt = Number(this.values[valueIndex++])
      valueIndex += 1
      cursorEventId = String(this.values[valueIndex++])
    }
    const limit = Number(this.values[valueIndex])
    const reports = [...this.database.reports.values()]
      .filter((report) => status === null || report.status === status)
      .filter((report) => cursorReceivedAt === null
        || report.received_at < cursorReceivedAt
        || (report.received_at === cursorReceivedAt && report.event_id < cursorEventId!))
      .sort((left, right) => right.received_at - left.received_at || right.event_id.localeCompare(left.event_id))
      .slice(0, limit)
    return { results: reports as unknown as T[] }
  }

  async run(): Promise<{ success: boolean; meta?: { changes?: number } }> {
    if (this.query.includes('INSERT OR IGNORE INTO reports')) {
      const eventId = String(this.values[0])
      if (this.database.reports.has(eventId)) return { success: true, meta: { changes: 0 } }
      this.database.reports.set(eventId, {
        event_id: eventId,
        schema_version: Number(this.values[1]),
        category: String(this.values[2]),
        severity: String(this.values[3]),
        location_cell: this.values[4] as string | null,
        observed_at: String(this.values[5]),
        status: 'unverified',
        received_at: Number(this.values[6]),
      })
      return { success: true, meta: { changes: 1 } }
    }

    if (this.query.includes('DELETE FROM reports')) {
      const cutoff = Number(this.values[0])
      for (const [eventId, report] of this.database.reports) {
        if (report.received_at < cutoff) this.database.reports.delete(eventId)
      }
    }

    return { success: true, meta: { changes: 0 } }
  }
}

class MockD1Database {
  reports = new Map<string, StoredReport>()

  prepare(query: string): MockD1Statement {
    return new MockD1Statement(this, query)
  }
}

function createEnv(rateLimitSuccess = true) {
  return {
    DB: new MockD1Database(),
    ALLOWED_ORIGIN,
    REPORTS_OPERATIONS_TOKEN: undefined as string | undefined,
    REPORTS_RATE_LIMITER: {
      limit: async () => ({ success: rateLimitSuccess }),
    },
  }
}

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Origin', ALLOWED_ORIGIN)
  return new Request(`https://api.example.test${path}`, { ...init, headers })
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    event_id: EVENT_ID,
    schema_version: 1,
    category: 'blocked-street',
    severity: 'attention',
    location_cell: '-12.10,-77.03',
    observed_at: '2026-08-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('Worker de Reporte 60 segundos', () => {
  it('responde health y limita el CORS al origen configurado', async () => {
    const env = createEnv()
    const response = await worker.fetch(request('/api/health'), env)

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
    await expect(response.json()).resolves.toMatchObject({ ok: true })

    const blocked = await worker.fetch(new Request('https://api.example.test/api/health', {
      headers: { Origin: 'https://not-allowed.example.test' },
    }), env)
    expect(blocked.status).toBe(403)

    const unconfigured = await worker.fetch(request('/api/health'), { ...env, ALLOWED_ORIGIN: undefined })
    expect(unconfigured.status).toBe(403)
  })

  it('valida el preflight y acepta un reporte válido como no verificado', async () => {
    const env = createEnv()
    const response = await worker.fetch(request('/v1/reports', { method: 'OPTIONS' }), env)
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
    expect(response.headers.get('access-control-allow-headers')).toContain('x-client-id')

    const created = await worker.fetch(request('/v1/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client-id': EVENT_ID },
      body: JSON.stringify(validPayload()),
    }), env)
    expect(created.status).toBe(202)
    await expect(created.json()).resolves.toMatchObject({
      event_id: EVENT_ID,
      status: 'unverified',
      verified: false,
    })
    expect(env.DB.reports.get(EVENT_ID)?.status).toBe('unverified')
  })

  it('responde 409 de forma idempotente para un event_id repetido', async () => {
    const env = createEnv()
    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload()),
    }

    expect((await worker.fetch(request('/v1/reports', init), env)).status).toBe(202)
    const duplicate = await worker.fetch(request('/v1/reports', init), env)
    expect(duplicate.status).toBe(409)
    await expect(duplicate.json()).resolves.toMatchObject({ duplicate: true, status: 'unverified' })
  })

  it('rechaza JSON, categorías, coordenadas exactas y payloads inválidos', async () => {
    const env = createEnv()
    const jsonError = await worker.fetch(request('/v1/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }), env)
    expect(jsonError.status).toBe(400)

    const invalidCategory = await worker.fetch(request('/v1/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload({ event_id: '00000000-0000-4000-8000-000000000002', category: 'unknown' })),
    }), env)
    expect(invalidCategory.status).toBe(400)

    const exactLocation = await worker.fetch(request('/v1/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload({ event_id: '00000000-0000-4000-8000-000000000003', location_cell: '-12.1024,-77.0349' })),
    }), env)
    expect(exactLocation.status).toBe(400)

    const oversized = await worker.fetch(request('/v1/reports', {
      method: 'POST',
      body: 'x'.repeat(2_049),
    }), env)
    expect(oversized.status).toBe(413)
  })

  it('conserva el reporte cuando el rate limit o el almacenamiento fallan', async () => {
    const limited = await worker.fetch(request('/v1/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload()),
    }), createEnv(false))
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')

    const rateLimitUnavailable = await worker.fetch(request('/v1/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload({ event_id: '00000000-0000-4000-8000-000000000005' })),
    }), {
      ...createEnv(),
      REPORTS_RATE_LIMITER: { limit: async () => { throw new Error('binding unavailable') } },
    })
    expect(rateLimitUnavailable.status).toBe(503)
    await expect(rateLimitUnavailable.json()).resolves.toMatchObject({ error: 'rate_limit_unavailable' })

    const failingEnv = {
      ...createEnv(),
      DB: {
        prepare: () => ({
          bind() { return this },
          async first() { return null },
          async all() { return { results: [] } },
          async run() { return { success: false } },
        }),
      },
    }
    const unavailable = await worker.fetch(request('/v1/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPayload({ event_id: '00000000-0000-4000-8000-000000000004' })),
    }), failingEnv)
    expect(unavailable.status).toBe(503)
  })

  it('ejecuta la limpieza de retención sobre reportes antiguos', async () => {
    const env = createEnv()
    env.DB.reports.set('old', {
      event_id: 'old',
      schema_version: 1,
      category: 'blocked-street',
      severity: 'attention',
      location_cell: null,
      observed_at: '2026-08-14T00:00:00.000Z',
      status: 'unverified',
      received_at: 1,
    })
    env.DB.reports.set('new', {
      event_id: 'new',
      schema_version: 1,
      category: 'blocked-street',
      severity: 'attention',
      location_cell: null,
      observed_at: '2026-08-14T00:00:00.000Z',
      status: 'unverified',
      received_at: Date.now(),
    })

    await worker.scheduled?.({ scheduledTime: Date.now() }, env)

    expect(env.DB.reports.has('old')).toBe(false)
    expect(env.DB.reports.has('new')).toBe(true)
  })

  it('protege la consulta operativa y pagina por cursor sin habilitar CORS', async () => {
    const env = createEnv()
    env.REPORTS_OPERATIONS_TOKEN = 'test-operations-token'
    env.DB.reports.set('first', {
      event_id: '00000000-0000-4000-8000-000000000010',
      schema_version: 1,
      category: 'blocked-street',
      severity: 'attention',
      location_cell: '-12.10,-77.03',
      observed_at: '2026-08-14T00:00:00.000Z',
      status: 'unverified',
      received_at: 300,
    })
    env.DB.reports.set('second', {
      event_id: '00000000-0000-4000-8000-000000000011',
      schema_version: 1,
      category: 'water-shortage',
      severity: 'observed',
      location_cell: null,
      observed_at: '2026-08-14T00:00:01.000Z',
      status: 'verified',
      received_at: 200,
    })
    env.DB.reports.set('third', {
      event_id: '00000000-0000-4000-8000-000000000012',
      schema_version: 1,
      category: 'water-shortage',
      severity: 'observed',
      location_cell: null,
      observed_at: '2026-08-14T00:00:02.000Z',
      status: 'unverified',
      received_at: 100,
    })

    const unauthorized = await worker.fetch(request('/v1/ops/reports?status=unverified'), env)
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.headers.get('access-control-allow-origin')).toBeNull()

    const firstPage = await worker.fetch(request('/v1/ops/reports?status=unverified&limit=1', {
      headers: { Authorization: 'Bearer test-operations-token' },
    }), env)
    expect(firstPage.status).toBe(200)
    const firstBody = await firstPage.json() as {
      reports: Array<Record<string, unknown>>
      next_cursor: string | null
    }
    expect(firstBody.reports).toHaveLength(1)
    expect(firstBody.reports[0]).toMatchObject({
      event_id: '00000000-0000-4000-8000-000000000010',
      status: 'unverified',
    })
    expect(firstBody.next_cursor).toBe('300:00000000-0000-4000-8000-000000000010')

    const secondPage = await worker.fetch(request(`/v1/ops/reports?status=unverified&limit=1&cursor=${firstBody.next_cursor}`, {
      headers: { Authorization: 'Bearer test-operations-token' },
    }), env)
    expect(secondPage.status).toBe(200)
    await expect(secondPage.json()).resolves.toMatchObject({
      reports: [{ event_id: '00000000-0000-4000-8000-000000000012' }],
      next_cursor: null,
    })

    const invalidStatus = await worker.fetch(request('/v1/ops/reports?status=not-a-status', {
      headers: { Authorization: 'Bearer test-operations-token' },
    }), env)
    expect(invalidStatus.status).toBe(400)

    const missingSecret = await worker.fetch(request('/v1/ops/reports'), createEnv())
    expect(missingSecret.status).toBe(404)
  })
})
