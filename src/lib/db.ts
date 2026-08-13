import type { MedicalCardRecord } from './medical-card'
import type { RapidReport } from './rapid-report'
import Dexie, { type Table } from 'dexie'

export type OutboxStatus = 'pending' | 'simulated'

export interface OutboxEvent {
  id: string
  kind: 'foundation-check'
  payload: {
    note: string
  }
  createdAt: number
  attempts: number
  status: OutboxStatus
}

export interface AppMeta {
  key: string
  value: string
}

class BarrioDatabase extends Dexie {
  outbox!: Table<OutboxEvent, string>
  meta!: Table<AppMeta, string>
  medicalCard!: Table<MedicalCardRecord, string>
  rapidReports!: Table<RapidReport, string>

  constructor() {
    super('barrio24')
    this.version(1).stores({
      outbox: 'id,status,createdAt',
      meta: 'key',
    })
    this.version(2).stores({
      outbox: 'id,status,createdAt',
      meta: 'key',
      medicalCard: 'id,updatedAt',
    })
    this.version(3).stores({
      outbox: 'id,status,createdAt',
      meta: 'key',
      medicalCard: 'id,updatedAt',
      rapidReports: 'id,category,severity,createdAt,status',
    })
  }
}

export const db = new BarrioDatabase()
