import { db, getClientId } from './db'
import type { RapidReport } from './rapid-report'

export const REPORTS_API_URL = (import.meta.env.VITE_REPORTS_API_URL ?? '').trim().replace(/\/+$/, '')

export interface RapidReportSyncSummary {
  attempted: number
  sent: number
  failed: number
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

export async function syncLocalRapidReports(
  apiUrl = REPORTS_API_URL,
  requestFetch: FetchLike = fetch,
): Promise<RapidReportSyncSummary> {
  if (!apiUrl) {
    return { attempted: 0, sent: 0, failed: 0, message: 'La sincronización todavía no está configurada.' }
  }

  const reports = await db.rapidReports
    .where('status')
    .anyOf('local-only', 'pending', 'sync-failed')
    .toArray()
  if (reports.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, message: 'No hay reportes locales pendientes.' }
  }

  const clientId = await getClientId()
  let sent = 0
  let failed = 0

  for (const report of reports) {
    await db.rapidReports.update(report.id, { status: 'pending' })
    try {
      const response = await requestFetch(`${apiUrl}/v1/reports`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-client-id': clientId,
        },
        body: JSON.stringify(payloadFor(report)),
      })

      if (response.status === 202 || response.status === 409) {
        await db.rapidReports.update(report.id, { status: 'unverified' })
        sent += 1
      } else {
        await db.rapidReports.update(report.id, { status: 'sync-failed' })
        failed += 1
      }
    } catch {
      await db.rapidReports.update(report.id, { status: 'sync-failed' })
      failed += 1
    }
  }

  if (failed > 0) {
    return {
      attempted: reports.length,
      sent,
      failed,
      message: `${sent} enviado${sent === 1 ? '' : 's'}; ${failed} quedó${failed === 1 ? '' : 'aron'} guardado${failed === 1 ? '' : 's'} para reintento.`,
    }
  }

  return {
    attempted: reports.length,
    sent,
    failed: 0,
    message: `${sent} reporte${sent === 1 ? '' : 's'} recibido${sent === 1 ? '' : 's'} por el API. Sigue sin estar verificado.`,
  }
}
