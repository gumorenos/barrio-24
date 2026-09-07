import { describe, expect, it } from 'vitest'
import {
  canTransitionModerationStatus,
  transitionModerationStatus,
} from './moderation'

describe('Contrato de moderación', () => {
  it('permite las transiciones operativas previstas', () => {
    expect(transitionModerationStatus('unverified', 'verify')).toBe('verified')
    expect(transitionModerationStatus('unverified', 'mark-duplicate')).toBe('duplicate')
    expect(transitionModerationStatus('verified', 'resolve')).toBe('resolved')
    expect(transitionModerationStatus('unverified', 'expire')).toBe('expired')
    expect(transitionModerationStatus('resolved', 'expire')).toBe('expired')
  })

  it('rechaza cambios ambiguos o retrocesos de estado', () => {
    expect(canTransitionModerationStatus('duplicate', 'verify')).toBe(false)
    expect(canTransitionModerationStatus('verified', 'mark-duplicate')).toBe(false)
    expect(canTransitionModerationStatus('resolved', 'verify')).toBe(false)
    expect(transitionModerationStatus('expired', 'resolve')).toBeNull()
  })
})
