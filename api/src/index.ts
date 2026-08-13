const REPORT_CATEGORIES = new Set([
  'injured-person',
  'trapped-person',
  'building-damage',
  'fire-or-leak',
  'blocked-street',
  'water-shortage',
  'power-outage',
  'shelter-needed',
  'food-or-medicine',
])

const REPORT_SEVERITIES = new Set(['observed', 'attention', 'immediate-risk'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LOCATION_CELL_PATTERN = /^(-?\d{1,3}\.\d{2}),(-?\d{1,3}\.\d{2})$/
const MAX_BODY_BYTES = 2_048

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T extends Record<string, unknown>>(): Promise<T | null>
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface Env {
  DB: D1Database
  ALLOWED_ORIGIN?: string
}

interface ReportPayload {
  event_id: string
  schema_version: 1
  category: string
  severity: string
  location_cell: string | null
  observed_at: string
}

interface StoredReport extends Record<string, unknown> {
  event_id: string
  status: string
}

function headersFor(request: Request, env: Env): Headers {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  const origin = request.headers.get('Origin')
  if (origin && env.ALLOWED_ORIGIN === origin) {
    headers.set('access-control-allow-origin', origin)
    headers.set('vary', 'Origin')
  }
  return headers
}

function json(request: Request, env: Env, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: headersFor(request, env) })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseLocationCell(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return undefined
  const match = LOCATION_CELL_PATTERN.exec(value)
  if (!match) return undefined
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return undefined
  return value
}

function parseReportPayload(value: unknown): ReportPayload | null {
  if (!isObject(value)) return null
  const allowedKeys = new Set(['event_id', 'schema_version', 'category', 'severity', 'location_cell', 'observed_at'])
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null
  if (typeof value.event_id !== 'string' || !UUID_PATTERN.test(value.event_id)) return null
  if (value.schema_version !== 1) return null
  if (typeof value.category !== 'string' || !REPORT_CATEGORIES.has(value.category)) return null
  if (typeof value.severity !== 'string' || !REPORT_SEVERITIES.has(value.severity)) return null
  const locationCell = parseLocationCell(value.location_cell)
  if (locationCell === undefined) return null
  if (typeof value.observed_at !== 'string' || !Number.isFinite(Date.parse(value.observed_at))) return null

  return {
    event_id: value.event_id,
    schema_version: 1,
    category: value.category,
    severity: value.severity,
    location_cell: locationCell,
    observed_at: new Date(value.observed_at).toISOString(),
  }
}

function isAllowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin')
  return !origin || !env.ALLOWED_ORIGIN || origin === env.ALLOWED_ORIGIN
}

async function createReport(request: Request, env: Env): Promise<Response> {
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return json(request, env, { error: 'payload_too_large' }, 413)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return json(request, env, { error: 'invalid_json' }, 400)
  }

  const payload = parseReportPayload(parsed)
  if (!payload) return json(request, env, { error: 'invalid_report' }, 400)

  try {
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO reports
        (event_id, schema_version, category, severity, location_cell, observed_at, received_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'received')`,
    ).bind(
      payload.event_id,
      payload.schema_version,
      payload.category,
      payload.severity,
      payload.location_cell,
      payload.observed_at,
      Date.now(),
    ).run()

    if (!result.success) return json(request, env, { error: 'storage_unavailable' }, 503)
    if ((result.meta?.changes ?? 0) === 0) {
      const existing = await env.DB.prepare(
        'SELECT event_id, status FROM reports WHERE event_id = ?',
      ).bind(payload.event_id).first<StoredReport>()
      return json(request, env, {
        event_id: payload.event_id,
        status: existing?.status ?? 'received',
        duplicate: true,
      }, 409)
    }

    return json(request, env, {
      event_id: payload.event_id,
      status: 'received',
      verified: false,
    }, 202)
  } catch {
    return json(request, env, { error: 'storage_unavailable' }, 503)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isAllowedOrigin(request, env)) return json(request, env, { error: 'origin_not_allowed' }, 403)

    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      const response = new Response(null, { status: 204, headers: headersFor(request, env) })
      response.headers.set('access-control-allow-methods', 'POST, GET, OPTIONS')
      response.headers.set('access-control-allow-headers', 'content-type')
      response.headers.set('access-control-max-age', '600')
      return response
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json(request, env, { ok: true, service: 'barrio24-reports-api', version: 1 })
    }

    if (request.method === 'POST' && url.pathname === '/v1/reports') {
      return createReport(request, env)
    }

    return json(request, env, { error: 'not_found' }, 404)
  },
}
