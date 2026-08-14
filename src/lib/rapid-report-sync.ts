import { db, getClientId } from './db'
import type { RapidReport } from './rapid-report'

export const REPORTS_API_URL = (import.meta.env.VITE_REPORTS_API_URL ?? '').trim().replace(/\/+$/, '')
export const RAPID_REPORT_REQUEST_TIMEOUT_MS = 12_000

export type RapidReportSyncFailure =
  | 'rate-limited'
  | 'service-unavailable'
  | 'timeout'
  | 'network'
  | 'rejected'
  | null

export interface RapidReportSyncSummary {
  attempted: number
  sent: number
  failed: number
  failure: RapidReportSyncFailure
  retryAfterSeconds: number | null
  message: string
}

type FetchLike = typeof fetch

function payloadFor(report: RapidReport) {
  return {
    event_id: report.id,
    schema_version: report.schemaVersion,
    category: report.category,
    severity: report.severity,
    location_cell: report.locationCell,
    observed_at: new Date(report.createdAt).toISOString(),
  }
}

class RapidReportRequestTimeoutError extends Error {
  constructor() {
    super('rapid_report_request_timeout')
    this.name = 'RapidReportRequestTimeoutError'
  }
}

async function fetchWithTimeout(
  requestFetch: FetchLike,
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(new RapidReportRequestTimeoutError())
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      requestFetch(input, { ...init, signal: controller.signal }),
      timeout,
    ])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

function retryAfterSeconds(response: Response): number | null {
  const value = response.headers?.get('retry-after')
  if (!value) return null
  const seconds = Number.parseInt(value, 10)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

function syncMessage(
  sent: number,
  failed: number,
  failure: RapidReportSyncFailure,
  retryAfter: number | null,
): string {
  const sentText = `${sent} enviado${sent === 1 ? '' : 's'}`
  if (failure === 'rate-limited') {
    const waitText = retryAfter ? ` Espera ${retryAfter} segundos antes de reintentar.` : ' Espera un momento antes de reintentar.'
    return `${sentText}; el servidor limitó temporalmente el envío.${waitText} Los demás siguen guardados en este dispositivo.`
  }
  if (failure === 'service-unavailable') {
    return `${sentText}; el servicio no está disponible ahora. Los demás siguen guardados para reintento.`
  }
  if (failure === 'timeout') {
    return `${sentText}; el envío tardó demasiado. Los demás siguen guardados para reintento.`
  }
  if (failure === 'network') {
    return `${sentText}; no se pudo contactar al API. Los demás siguen guardados para reintento.`
  }
  if (failed > 0) {
    return `${sentText}; ${failed} quedó${failed === 1 ? '' : 'aron'} guardado${failed === 1 ? '' : 's'} para reintento.`
  }
  return `${sent} reporte${sent === 1 ? '' : 's'} recibido${sent === 1 ? '' : 's'} por el API. Sigue sin estar verificado.`
}

export async function syncLocalRapidReports(
  apiUrl = REPORTS_API_URL,
  requestFetch: FetchLike = fetch,
  timeoutMs = RAPID_REPORT_REQUEST_TIMEOUT_MS,
): Promise<RapidReportSyncSummary> {
  if (!apiUrl) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      failure: null,
      retryAfterSeconds: null,
      message: 'La sincronización todavía no está configurada.',
    }
  }

  const reports = await db.rapidReports
    .where('status')
    .anyOf('local-only', 'pending', 'sync-failed')
    .toArray()
  if (reports.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      failure: null,
      retryAfterSeconds: null,
      message: 'No hay reportes locales pendientes.',
    }
  }

  const clientId = await getClientId()
  let attempted = 0
  let sent = 0
  let failed = 0
  let failure: RapidReportSyncFailure = null
  let retryAfter: number | null = null

  for (const report of reports) {
    attempted += 1
    await db.rapidReports.update(report.id, { status: 'pending' })
    try {
      const response = await fetchWithTimeout(requestFetch, `${apiUrl}/v1/reports`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-client-id': clientId,
        },
        body: JSON.stringify(payloadFor(report)),
      }, timeoutMs)

      if (response.status === 202 || response.status === 409) {
        await db.rapidReports.update(report.id, { status: 'unverified' })
        sent += 1
      } else {
        await db.rapidReports.update(report.id, { status: 'sync-failed' })
        failed += 1
        if (response.status === 429) {
          failure = 'rate-limited'
          retryAfter = retryAfterSeconds(response)
          break
        }
        if (response.status >= 500) {
          failure = 'service-unavailable'
          break
        }
      }
    } catch (caught) {
      await db.rapidReports.update(report.id, { status: 'sync-failed' })
      failed += 1
      failure = caught instanceof RapidReportRequestTimeoutError ? 'timeout' : 'network'
      break
    }
  }

  return {
    attempted,
    sent,
    failed,
    failure,
    retryAfterSeconds: retryAfter,
    message: syncMessage(sent, failed, failure, retryAfter),
  }
}
