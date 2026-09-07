import type { OutboxEvent, OutboxStatus } from './db'

export function createFoundationEvent(now = Date.now()): OutboxEvent {
  return {
    id: crypto.randomUUID(),
    kind: 'foundation-check',
    payload: { note: 'Operación sintética de la Fase 0' },
    createdAt: now,
    attempts: 0,
    status: 'pending',
  }
}

export function statusLabel(status: OutboxStatus): string {
  return status === 'pending' ? 'Pendiente' : 'Simulada localmente'
}

export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}
