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
const RETENTION_DAYS = 30
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1_000

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T extends Record<string, unknown>>(): Promise<T | null>
  all<T extends Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface RateLimit {
  limit(input: { key: string }): Promise<{ success: boolean }>
}

interface Env {
  DB: D1Database
  ALLOWED_ORIGIN?: string
  REPORTS_RATE_LIMITER?: RateLimit
  REPORTS_OPERATIONS_TOKEN?: string
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

interface OperationalReport extends Record<string, unknown> {
  event_id: string
  schema_version: number
  category: string
  severity: string
  location_cell: string | null
  observed_at: string
  received_at: number
  status: string
}

const OPERATIONAL_STATUSES = new Set([
  'received',
  'unverified',
  'duplicate',
  'verified',
  'resolved',
  'expired',
])
const DEFAULT_OPERATIONAL_LIMIT = 50
const MAX_OPERATIONAL_LIMIT = 100
const MIN_OPERATIONS_TOKEN_LENGTH = 32
const OPERATIONAL_CURSOR_PATTERN = /^(\d+):([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

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

function json(request: Request, env: Env, data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = headersFor(request, env)
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value))
  }
  return new Response(JSON.stringify(data), { status, headers })
}

function operationsJson(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value))
  }
  return new Response(JSON.stringify(data), { status, headers })
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
  return !origin || Boolean(env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN)
}

function rateLimitKey(request: Request): string {
  const clientId = request.headers.get('X-Client-Id')?.trim()
  if (clientId && UUID_PATTERN.test(clientId)) return `client:${clientId}`
  return `ip:${request.headers.get('CF-Connecting-IP') ?? 'anonymous'}`
}

async function checkRateLimit(request: Request, env: Env): Promise<{ limited: boolean; unavailable: boolean }> {
  if (!env.REPORTS_RATE_LIMITER) return { limited: false, unavailable: false }
  try {
    const result = await env.REPORTS_RATE_LIMITER.limit({ key: rateLimitKey(request) })
    return { limited: !result.success, unavailable: false }
  } catch {
    return { limited: false, unavailable: true }
  }
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
       VALUES (?, ?, ?, ?, ?, ?, ?, 'unverified')`,
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
        status: existing?.status ?? 'unverified',
        duplicate: true,
      }, 409)
    }

    return json(request, env, {
      event_id: payload.event_id,
      status: 'unverified',
      verified: false,
    }, 202)
  } catch {
    return json(request, env, { error: 'storage_unavailable' }, 503)
  }
}

function parseOperationalLimit(value: string | null): number | null {
  if (value === null) return DEFAULT_OPERATIONAL_LIMIT
  if (!/^\d+$/.test(value)) return null
  const limit = Number(value)
  return Number.isSafeInteger(limit) && limit > 0 && limit <= MAX_OPERATIONAL_LIMIT ? limit : null
}

function parseOperationalCursor(value: string | null): { receivedAt: number; eventId: string } | null | undefined {
  if (value === null) return null
  const match = OPERATIONAL_CURSOR_PATTERN.exec(value)
  if (!match) return undefined
  const receivedAt = Number(match[1])
  if (!Number.isSafeInteger(receivedAt)) return undefined
  return { receivedAt, eventId: match[2] }
}

function operationalReportFromRow(row: OperationalReport): OperationalReport {
  return {
    event_id: row.event_id,
    schema_version: row.schema_version,
    category: row.category,
    severity: row.severity,
    location_cell: row.location_cell ?? null,
    observed_at: row.observed_at,
    received_at: row.received_at,
    status: row.status,
  }
}

function operationalCursorFor(report: OperationalReport): string {
  return `${report.received_at}:${report.event_id}`
}

function operationsToken(env: Env): string | null {
  const configuredToken = env.REPORTS_OPERATIONS_TOKEN?.trim()
  return configuredToken && configuredToken.length >= MIN_OPERATIONS_TOKEN_LENGTH ? configuredToken : null
}

function authorizeOperations(request: Request, env: Env): Response | null {
  const configuredToken = operationsToken(env)
  if (!configuredToken) return operationsJson({ error: 'not_found' }, 404)

  const authorization = request.headers.get('Authorization') ?? ''
  if (authorization !== `Bearer ${configuredToken}`) {
    return operationsJson({ error: 'unauthorized' }, 401, { 'www-authenticate': 'Bearer' })
  }
  return null
}

async function listOperationalReports(request: Request, env: Env): Promise<Response> {
  const authorizationError = authorizeOperations(request, env)
  if (authorizationError) return authorizationError

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  if (status !== null && !OPERATIONAL_STATUSES.has(status)) {
    return operationsJson({ error: 'invalid_status' }, 400)
  }

  const limit = parseOperationalLimit(url.searchParams.get('limit'))
  if (limit === null) return operationsJson({ error: 'invalid_limit' }, 400)

  const cursor = parseOperationalCursor(url.searchParams.get('cursor'))
  if (cursor === undefined) return operationsJson({ error: 'invalid_cursor' }, 400)

  const conditions: string[] = []
  const values: unknown[] = []
  if (status) {
    conditions.push('status = ?')
    values.push(status)
  }
  if (cursor) {
    conditions.push('(received_at < ? OR (received_at = ? AND event_id < ?))')
    values.push(cursor.receivedAt, cursor.receivedAt, cursor.eventId)
  }

  const query = `SELECT event_id, schema_version, category, severity, location_cell,
      observed_at, received_at, status
    FROM reports
    ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY received_at DESC, event_id DESC
    LIMIT ?`

  try {
    const result = await env.DB.prepare(query).bind(...values, limit + 1).all<OperationalReport>()
    const reports = result.results.map(operationalReportFromRow)
    const hasMore = reports.length > limit
    if (hasMore) reports.pop()

    return operationsJson({
      reports,
      next_cursor: hasMore && reports.length > 0 ? operationalCursorFor(reports[reports.length - 1]) : null,
    })
  } catch {
    return operationsJson({ error: 'storage_unavailable' }, 503, { 'retry-after': '60' })
  }
}

interface OperationalStatusSummary extends Record<string, unknown> {
  status: string
  count: number
  latest_received_at: number | null
}

async function getOperationalSummary(request: Request, env: Env): Promise<Response> {
  const authorizationError = authorizeOperations(request, env)
  if (authorizationError) return authorizationError

  try {
    const result = await env.DB.prepare(
      `SELECT status, COUNT(*) AS count, MAX(received_at) AS latest_received_at
       FROM reports
       GROUP BY status`,
    ).all<OperationalStatusSummary>()
    const byStatus: Record<string, number> = {}
    let total = 0
    let latestReceivedAt: number | null = null
    for (const row of result.results) {
      const count = Number(row.count)
      if (!Number.isSafeInteger(count) || count < 0) continue
      byStatus[row.status] = count
      total += count
      const latest = row.latest_received_at === null ? null : Number(row.latest_received_at)
      if (latest !== null && Number.isSafeInteger(latest) && (latestReceivedAt === null || latest > latestReceivedAt)) {
        latestReceivedAt = latest
      }
    }

    return operationsJson({
      total,
      by_status: byStatus,
      latest_received_at: latestReceivedAt,
      retention_days: RETENTION_DAYS,
    })
  } catch {
    return operationsJson({ error: 'storage_unavailable' }, 503, { 'retry-after': '60' })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isAllowedOrigin(request, env)) return json(request, env, { error: 'origin_not_allowed' }, 403)

    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      const response = new Response(null, { status: 204, headers: headersFor(request, env) })
      response.headers.set('access-control-allow-methods', 'POST, GET, OPTIONS')
      response.headers.set('access-control-allow-headers', 'content-type, x-client-id')
      response.headers.set('access-control-max-age', '600')
      return response
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json(request, env, { ok: true, service: 'barrio24-reports-api', version: 1 })
    }

    if (request.method === 'GET' && url.pathname === '/v1/ops/reports') {
      return listOperationalReports(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/v1/ops/summary') {
      return getOperationalSummary(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/v1/reports') {
      const rateLimit = await checkRateLimit(request, env)
      if (rateLimit.unavailable) {
        return json(request, env, { error: 'rate_limit_unavailable' }, 503, { 'retry-after': '60' })
      }
      if (rateLimit.limited) {
        return json(request, env, { error: 'rate_limited' }, 429, { 'retry-after': '60' })
      }
      return createReport(request, env)
    }

    return json(request, env, { error: 'not_found' }, 404)
  },

  async scheduled(_controller: { scheduledTime: number }, env: Env): Promise<void> {
    const cutoff = Date.now() - RETENTION_MS
    const result = await env.DB.prepare(
      'DELETE FROM reports WHERE received_at < ?',
    ).bind(cutoff).run()
    if (!result.success) throw new Error('retention_cleanup_failed')
  },
}
