import { describe, expect, it } from 'vitest'
import { createFoundationEvent, formatTimestamp, statusLabel } from './outbox'

describe('outbox de la Fase 0', () => {
  it('crea una operación pendiente con identificador único', () => {
    const event = createFoundationEvent(1_754_000_000_000)

    expect(event.id).toEqual(expect.any(String))
    expect(event.status).toBe('pending')
    expect(event.attempts).toBe(0)
    expect(event.payload.note).toContain('Fase 0')
  })

  it('expone etiquetas claras para el estado de sincronización', () => {
    expect(statusLabel('pending')).toBe('Pendiente')
    expect(statusLabel('simulated')).toBe('Simulada localmente')
  })

  it('formatea una fecha para la interfaz en español', () => {
    expect(formatTimestamp(Date.UTC(2026, 7, 12, 15, 30))).toContain('12/8/2026')
  })
})

