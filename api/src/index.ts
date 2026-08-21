import { authorizeAccess, type AccessIdentity } from './access'
import {
  isModerationAction,
  isModerationStatus,
  transitionModerationStatus,
  type ModerationAction,
  type ModerationStatus,
} from './moderation'

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
const MAX_MODERATION_BODY_BYTES = 4_096
const MAX_MODERATION_REASON_LENGTH = 500
const RETENTION_DAYS = 30
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1_000
const AUDIT_RETENTION_DAYS = 180
const AUDIT_RETENTION_MS = AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1_000

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T extends Record<string, unknown>>(): Promise<T | null>
  all<T extends Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<Array<{ success: boolean; meta?: { changes?: number } }>>
}

interface RateLimit {
  limit(input: { key: string }): Promise<{ success: boolean }>
}

interface Env {
  DB: D1Database
  ALLOWED_ORIGIN?: string
  REPORTS_RATE_LIMITER?: RateLimit
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUDIENCE?: string
  ACCESS_OPERATOR_EMAILS?: string
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
  last_moderation_event_id?: string | null
}

interface StoredModerationEvent extends Record<string, unknown> {
  id: string
  event_id: string
  action: ModerationAction
  from_status: ModerationStatus
  to_status: ModerationStatus
  request_id: string
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

const OPERATIONS_CONSOLE_HTML = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Barrio 24 · Operaciones</title>
  <style>
    :root { color-scheme: light; font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#102a43; background:#f4f7fa; }
    body { margin:0; }
    main { max-width:1180px; margin:0 auto; padding:24px 16px 48px; }
    header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:20px; }
    h1 { margin:0 0 6px; font-size:clamp(24px,4vw,36px); }
    p { margin:0; color:#52606d; }
    button, select, input { font:inherit; }
    button { border:0; border-radius:8px; background:#167d9a; color:white; cursor:pointer; padding:10px 14px; font-weight:700; }
    button:disabled { cursor:wait; opacity:.6; }
    .panel { background:white; border:1px solid #d9e2ec; border-radius:12px; padding:16px; margin-bottom:16px; box-shadow:0 2px 8px #102a430d; }
    .summary { display:flex; flex-wrap:wrap; gap:10px; }
    .metric { background:#f4f7fa; border-radius:8px; padding:10px 12px; min-width:120px; }
    .metric strong { display:block; font-size:22px; color:#102a43; }
    .metric span { color:#52606d; font-size:13px; }
    .filters { display:flex; flex-wrap:wrap; gap:10px; align-items:end; }
    label { display:grid; gap:5px; color:#52606d; font-size:13px; font-weight:700; }
    select, input { border:1px solid #bcccdc; border-radius:7px; padding:9px 10px; color:#102a43; background:white; }
    .table-wrap { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; min-width:900px; }
    th, td { border-bottom:1px solid #e4e7eb; text-align:left; padding:11px 8px; vertical-align:top; }
    th { color:#52606d; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
    td { font-size:14px; }
    code { font-size:12px; word-break:break-all; }
    .controls { display:grid; gap:7px; min-width:220px; }
    .controls-row { display:flex; gap:6px; }
    .controls-row select { min-width:130px; }
    .message { min-height:22px; color:#52606d; margin-bottom:10px; }
    .error { color:#b42318; }
    .status { font-weight:700; }
    .status-unverified { color:#9c6500; }
    .status-verified { color:#167d9a; }
    .status-resolved { color:#147d64; }
    .status-duplicate, .status-expired { color:#7b8794; }
    @media (max-width:600px) { header { display:block; } header button { margin-top:12px; } main { padding-top:16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Barrio 24 · Operaciones</h1>
        <p>Staging · reportes sintéticos · acceso restringido</p>
      </div>
      <button id="refresh" type="button">Actualizar</button>
    </header>
    <section class="panel" aria-labelledby="summary-title">
      <h2 id="summary-title">Resumen</h2>
      <div id="summary" class="summary"></div>
    </section>
    <section class="panel" aria-labelledby="reports-title">
      <form id="filters" class="filters">
        <label>Estado
          <select id="status">
            <option value="">Todos</option>
            <option value="unverified">No verificados</option>
            <option value="verified">Verificados</option>
            <option value="resolved">Resueltos</option>
            <option value="duplicate">Duplicados</option>
            <option value="expired">Expirados</option>
          </select>
        </label>
        <button type="submit">Filtrar</button>
      </form>
      <p id="message" class="message" role="status"></p>
      <h2 id="reports-title">Reportes</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Evento</th><th>Categoría</th><th>Gravedad</th><th>Zona</th><th>Recibido</th><th>Estado</th><th>Decisión</th></tr></thead>
          <tbody id="reports"></tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    const statusLabels = { unverified:'No verificado', verified:'Verificado', resolved:'Resuelto', duplicate:'Duplicado', expired:'Expirado', received:'Recibido' };
    const actionLabels = { verify:'Verificar', resolve:'Resolver', 'mark-duplicate':'Marcar duplicado', expire:'Expirar' };
    const transitions = {
      unverified: ['verify','mark-duplicate','expire'],
      verified: ['resolve','expire'],
      duplicate: ['expire'],
      resolved: ['expire'],
      expired: []
    };
    const message = document.querySelector('#message');
    const summary = document.querySelector('#summary');
    const reports = document.querySelector('#reports');
    const status = document.querySelector('#status');

    async function api(path, init) {
      const response = await fetch(path, Object.assign({ credentials:'same-origin' }, init || {}));
      const body = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(body.error || ('HTTP ' + response.status));
      return body;
    }

    function setMessage(value, isError) {
      message.textContent = value || '';
      message.className = isError ? 'message error' : 'message';
    }

    function addMetric(label, value) {
      const item = document.createElement('div');
      item.className = 'metric';
      const strong = document.createElement('strong');
      strong.textContent = String(value);
      const span = document.createElement('span');
      span.textContent = label;
      item.append(strong, span);
      summary.append(item);
    }

    function renderSummary(value) {
      summary.replaceChildren();
      addMetric('Total', value.total);
      Object.entries(value.by_status || {}).forEach(function (entry) {
        addMetric(statusLabels[entry[0]] || entry[0], entry[1]);
      });
    }

    function makeCell(value) {
      const cell = document.createElement('td');
      cell.textContent = value == null ? '—' : String(value);
      return cell;
    }

    function renderReports(items) {
      reports.replaceChildren();
      if (!items.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.textContent = 'No hay reportes para este filtro.';
        row.append(cell);
        reports.append(row);
        return;
      }
      items.forEach(function (report) {
        const row = document.createElement('tr');
        const eventCell = document.createElement('td');
        const eventCode = document.createElement('code');
        eventCode.textContent = report.event_id;
        eventCell.append(eventCode);
        row.append(eventCell);
        row.append(makeCell(report.category));
        row.append(makeCell(report.severity));
        row.append(makeCell(report.location_cell));
        row.append(makeCell(new Date(report.received_at).toLocaleString()));
        const state = makeCell(statusLabels[report.status] || report.status);
        state.className = 'status status-' + report.status;
        row.append(state);

        const actionCell = document.createElement('td');
        const actions = transitions[report.status] || [];
        if (actions.length) {
          const controls = document.createElement('div');
          controls.className = 'controls';
          const controlsRow = document.createElement('div');
          controlsRow.className = 'controls-row';
          const select = document.createElement('select');
          actions.forEach(function (action) {
            const option = document.createElement('option');
            option.value = action;
            option.textContent = actionLabels[action];
            select.append(option);
          });
          const reason = document.createElement('input');
          reason.type = 'text';
          reason.maxLength = 500;
          reason.placeholder = 'Motivo obligatorio';
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Aplicar';
          button.addEventListener('click', function () {
            void decide(report, select.value, reason.value, button);
          });
          controlsRow.append(select, button);
          controls.append(controlsRow, reason);
          actionCell.append(controls);
        } else {
          actionCell.textContent = 'Sin acciones';
        }
        row.append(actionCell);
        reports.append(row);
      });
    }

    async function decide(report, action, reason, button) {
      if (!reason.trim()) {
        setMessage('Cada decisión necesita un motivo.', true);
        return;
      }
      button.disabled = true;
      try {
        await api('/v1/ops/reports/' + encodeURIComponent(report.event_id) + '/decision', {
          method:'POST',
          headers: {
            'content-type':'application/json',
            'idempotency-key':crypto.randomUUID(),
            'x-request-id':crypto.randomUUID()
          },
          body:JSON.stringify({ action:action, expected_status:report.status, reason:reason.trim() })
        });
        setMessage('Decisión aplicada.');
        await load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo aplicar la decisión.', true);
        button.disabled = false;
      }
    }

    async function load() {
      setMessage('Cargando…');
      try {
        const query = status.value ? '?status=' + encodeURIComponent(status.value) + '&limit=100' : '?limit=100';
        const result = await Promise.all([api('/v1/ops/summary'), api('/v1/ops/reports' + query)]);
        renderSummary(result[0]);
        renderReports(result[1].reports || []);
        setMessage('Actualizado.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo cargar operaciones.', true);
      }
    }

    document.querySelector('#refresh').addEventListener('click', function () { void load(); });
    document.querySelector('#filters').addEventListener('submit', function (event) {
      event.preventDefault();
      void load();
    });
    void load();
  </script>
</body>
</html>`;

async function serveOperationsConsole(request: Request, env: Env): Promise<Response> {
  const operator = await authorizeOperations(request, env)
  if (operator instanceof Response) return operator

  return new Response(OPERATIONS_CONSOLE_HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      'permissions-policy': 'geolocation=()',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    },
  })
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

function isAllowedOperationsOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin')
  return !origin || origin === new URL(request.url).origin
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

function accessFailureResponse(reason: Exclude<Awaited<ReturnType<typeof authorizeAccess>>, { ok: true }>['reason']): Response {
  if (reason === 'not-configured') return operationsJson({ error: 'not_found' }, 404)
  if (reason === 'missing-token') return operationsJson({ error: 'access_required' }, 403)
  if (reason === 'not-allowed') return operationsJson({ error: 'access_forbidden' }, 403)
  return operationsJson({ error: 'access_invalid' }, 403)
}

async function authorizeOperations(request: Request, env: Env): Promise<AccessIdentity | Response> {
  const result = await authorizeAccess(request, {
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    audience: env.ACCESS_AUDIENCE,
    operatorEmails: env.ACCESS_OPERATOR_EMAILS,
  })
  return result.ok ? result.identity : accessFailureResponse(result.reason)
}

async function listOperationalReports(request: Request, env: Env): Promise<Response> {
  const operator = await authorizeOperations(request, env)
  if (operator instanceof Response) return operator

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
  const operator = await authorizeOperations(request, env)
  if (operator instanceof Response) return operator

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

async function getModerationHistory(request: Request, env: Env, eventId: string): Promise<Response> {
  const operator = await authorizeOperations(request, env)
  if (operator instanceof Response) return operator

  try {
    const result = await env.DB.prepare(
      `SELECT id, event_id, action, from_status, to_status, actor_id, reason, occurred_at, request_id
       FROM report_moderation_events
       WHERE event_id = ?
       ORDER BY occurred_at DESC, id DESC
       LIMIT 100`,
    ).bind(eventId).all<Record<string, unknown>>()

    return operationsJson({
      event_id: eventId,
      events: result.results.map((row) => ({
        id: row.id,
        event_id: row.event_id,
        action: row.action,
        from_status: row.from_status,
        to_status: row.to_status,
        actor_id: row.actor_id,
        reason: row.reason,
        occurred_at: row.occurred_at,
        request_id: row.request_id,
      })),
    })
  } catch {
    return operationsJson({ error: 'storage_unavailable' }, 503, { 'retry-after': '60' })
  }
}

interface ModerationDecisionInput {
  action: ModerationAction
  expected_status: ModerationStatus
  reason: string
}

function parseModerationDecision(value: unknown): ModerationDecisionInput | null {
  if (!isObject(value)) return null
  const allowedKeys = new Set(['action', 'expected_status', 'reason'])
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null
  if (!isModerationAction(value.action) || !isModerationStatus(value.expected_status)) return null
  if (typeof value.reason !== 'string') return null
  const reason = value.reason.trim()
  if (reason.length === 0 || reason.length > MAX_MODERATION_REASON_LENGTH) return null
  return {
    action: value.action,
    expected_status: value.expected_status,
    reason,
  }
}

function parseUuidHeader(request: Request, name: string, required: boolean): string | null | undefined {
  const value = request.headers.get(name)?.trim()
  if (!value) return required ? undefined : null
  return UUID_PATTERN.test(value) ? value : undefined
}

function moderationEventIdFromPath(url: URL): string | null {
  const match = /^\/v1\/ops\/reports\/([^/]+)\/decision$/.exec(url.pathname)
  if (!match) return null
  try {
    const eventId = decodeURIComponent(match[1])
    return UUID_PATTERN.test(eventId) ? eventId : null
  } catch {
    return null
  }
}

function moderationHistoryEventIdFromPath(url: URL): string | null {
  const match = /^\/v1\/ops\/reports\/([^/]+)\/history$/.exec(url.pathname)
  if (!match) return null
  try {
    const eventId = decodeURIComponent(match[1])
    return UUID_PATTERN.test(eventId) ? eventId : null
  } catch {
    return null
  }
}

async function applyModerationDecision(
  request: Request,
  env: Env,
  eventId: string,
  identity: AccessIdentity,
): Promise<Response> {
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > MAX_MODERATION_BODY_BYTES) {
    return operationsJson({ error: 'payload_too_large' }, 413)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return operationsJson({ error: 'invalid_json' }, 400)
  }

  const decision = parseModerationDecision(parsed)
  if (!decision) return operationsJson({ error: 'invalid_decision' }, 400)

  const idempotencyKey = parseUuidHeader(request, 'Idempotency-Key', true)
  if (!idempotencyKey) return operationsJson({ error: 'invalid_idempotency_key' }, 400)
  const requestId = parseUuidHeader(request, 'X-Request-Id', false)
  if (requestId === undefined) return operationsJson({ error: 'invalid_request_id' }, 400)
  const resolvedRequestId = requestId ?? crypto.randomUUID()

  try {
    const previous = await env.DB.prepare(
      `SELECT id, event_id, action, from_status, to_status, request_id
       FROM report_moderation_events
       WHERE idempotency_key = ?`,
    ).bind(idempotencyKey).first<StoredModerationEvent>()
    if (previous) {
      if (previous.event_id !== eventId) return operationsJson({ error: 'idempotency_conflict' }, 409)
      return operationsJson({
        event_id: previous.event_id,
        action: previous.action,
        from_status: previous.from_status,
        status: previous.to_status,
        audit_id: previous.id,
        request_id: previous.request_id,
        idempotent: true,
      })
    }

    const report = await env.DB.prepare(
      'SELECT event_id, status, last_moderation_event_id FROM reports WHERE event_id = ?',
    ).bind(eventId).first<StoredReport>()
    if (!report) return operationsJson({ error: 'report_not_found' }, 404)
    if (!isModerationStatus(report.status)) return operationsJson({ error: 'invalid_stored_status' }, 409)
    if (report.status !== decision.expected_status) {
      return operationsJson({ error: 'status_conflict', current_status: report.status }, 409)
    }

    const nextStatus = transitionModerationStatus(report.status, decision.action)
    if (!nextStatus) return operationsJson({ error: 'invalid_transition' }, 409)

    const auditId = crypto.randomUUID()
    const occurredAt = Date.now()
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE reports
         SET status = ?, last_moderation_event_id = ?
         WHERE event_id = ? AND status = ?`,
      ).bind(nextStatus, auditId, eventId, report.status),
      env.DB.prepare(
        `INSERT INTO report_moderation_events
          (id, event_id, action, from_status, to_status, actor_id, reason, occurred_at, request_id, idempotency_key)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM reports
           WHERE event_id = ? AND status = ? AND last_moderation_event_id = ?
         )`,
      ).bind(
        auditId,
        eventId,
        decision.action,
        report.status,
        nextStatus,
        identity.subject,
        decision.reason,
        occurredAt,
        resolvedRequestId,
        idempotencyKey,
        eventId,
        nextStatus,
        auditId,
      ),
    ])

    if ((results[0]?.meta?.changes ?? 0) !== 1) {
      const current = await env.DB.prepare(
        'SELECT status FROM reports WHERE event_id = ?',
      ).bind(eventId).first<StoredReport>()
      return operationsJson({ error: 'status_conflict', current_status: current?.status ?? null }, 409)
    }
    if ((results[1]?.meta?.changes ?? 0) !== 1) {
      return operationsJson({ error: 'storage_unavailable' }, 503, { 'retry-after': '60' })
    }

    return operationsJson({
      event_id: eventId,
      action: decision.action,
      from_status: report.status,
      status: nextStatus,
      audit_id: auditId,
      request_id: resolvedRequestId,
      idempotent: false,
    })
  } catch {
    return operationsJson({ error: 'storage_unavailable' }, 503, { 'retry-after': '60' })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const isOperationsRequest = url.pathname === '/v1/ops/' || url.pathname.startsWith('/v1/ops/')
    const originAllowed = isOperationsRequest
      ? isAllowedOperationsOrigin(request)
      : isAllowedOrigin(request, env)
    if (!originAllowed) return json(request, env, { error: 'origin_not_allowed' }, 403)

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

    if (request.method === 'GET' && url.pathname === '/v1/ops/') {
      return serveOperationsConsole(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/v1/ops/summary') {
      return getOperationalSummary(request, env)
    }

    const historyEventId = moderationHistoryEventIdFromPath(url)
    if (request.method === 'GET' && historyEventId) {
      return getModerationHistory(request, env, historyEventId)
    }

    const moderationEventId = moderationEventIdFromPath(url)
    if (request.method === 'POST' && moderationEventId) {
      const operator = await authorizeOperations(request, env)
      if (operator instanceof Response) return operator
      return applyModerationDecision(request, env, moderationEventId, operator)
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

    const auditCutoff = Date.now() - AUDIT_RETENTION_MS
    const auditResult = await env.DB.prepare(
      'DELETE FROM report_moderation_events WHERE occurred_at < ?',
    ).bind(auditCutoff).run()
    if (!auditResult.success) throw new Error('audit_retention_cleanup_failed')
  },
}
