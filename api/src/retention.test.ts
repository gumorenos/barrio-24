import { afterEach, describe, expect, it, vi } from 'vitest'

import worker from './index'

const DAY_MS = 24 * 60 * 60 * 1_000
const NOW = Date.parse('2026-09-04T12:00:00.000Z')

type ReportRow = { event_id: string; received_at: number }
type AuditRow = { id: string; occurred_at: number }

class RetentionStatement {
  private values: unknown[] = []

  constructor(
    private readonly database: RetentionDatabase,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]): RetentionStatement {
    this.values = values
    return this
  }

  async first<T extends Record<string, unknown>>(): Promise<T | null> {
    return null
  }

  async all<T extends Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: [] }
  }

  async run(): Promise<{ success: boolean; meta?: { changes?: number } }> {
    if (this.database.failQuery && this.query.includes(this.database.failQuery)) {
      return { success: false, meta: { changes: 0 } }
    }

    const cutoff = Number(this.values[0])
    if (this.query.includes('DELETE FROM reports')) {
      let changes = 0
      this.database.reports = this.database.reports.filter((row) => {
        const remove = row.received_at < cutoff
        if (remove) changes += 1
        return !remove
      })
      return { success: true, meta: { changes } }
    }

    if (this.query.includes('DELETE FROM report_moderation_events')) {
      let changes = 0
      this.database.auditEvents = this.database.auditEvents.filter((row) => {
        const remove = row.occurred_at < cutoff
        if (remove) changes += 1
        return !remove
      })
      return { success: true, meta: { changes } }
    }

    return { success: true, meta: { changes: 0 } }
  }
}

class RetentionDatabase {
  reports: ReportRow[] = []
  auditEvents: AuditRow[] = []
  failQuery: string | null = null

  prepare(query: string): RetentionStatement {
    return new RetentionStatement(this, query)
  }

  async batch(): Promise<Array<{ success: boolean }>> {
    return []
  }
}

function envFor(database: RetentionDatabase) {
  return { DB: database }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('scheduled retention', () => {
  it('borra solo reportes mayores a 30 días y auditoría mayor a 180 días', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const database = new RetentionDatabase()

    database.reports = [
      { event_id: 'report-old', received_at: NOW - 31 * DAY_MS },
      { event_id: 'report-boundary', received_at: NOW - 30 * DAY_MS },
      { event_id: 'report-new', received_at: NOW - 1 * DAY_MS },
    ]
    database.auditEvents = [
      { id: 'audit-old', occurred_at: NOW - 181 * DAY_MS },
      { id: 'audit-boundary', occurred_at: NOW - 180 * DAY_MS },
      { id: 'audit-new', occurred_at: NOW - 1 * DAY_MS },
    ]

    await worker.scheduled?.({ scheduledTime: NOW }, envFor(database))

    expect(database.reports.map(({ event_id }) => event_id)).toEqual([
      'report-boundary',
      'report-new',
    ])
    expect(database.auditEvents.map(({ id }) => id)).toEqual([
      'audit-boundary',
      'audit-new',
    ])
  })

  it('falla cerrado si no puede limpiar reportes', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const database = new RetentionDatabase()
    database.failQuery = 'DELETE FROM reports'

    await expect(worker.scheduled?.({ scheduledTime: NOW }, envFor(database)))
      .rejects.toThrow('retention_cleanup_failed')
  })

  it('falla cerrado si la limpieza de auditoría falla', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const database = new RetentionDatabase()
    database.failQuery = 'DELETE FROM report_moderation_events'

    await expect(worker.scheduled?.({ scheduledTime: NOW }, envFor(database)))
      .rejects.toThrow('audit_retention_cleanup_failed')
  })
})
