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

  constructor() {
    super('barrio24')
    this.version(1).stores({
      outbox: 'id,status,createdAt',
      meta: 'key',
    })
  }
}

export const db = new BarrioDatabase()

