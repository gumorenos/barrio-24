export const MODERATION_STATUSES = [
  'unverified',
  'duplicate',
  'verified',
  'resolved',
  'expired',
] as const

export type ModerationStatus = (typeof MODERATION_STATUSES)[number]

export const MODERATION_ACTIONS = [
  'verify',
  'mark-duplicate',
  'resolve',
  'expire',
] as const

export type ModerationAction = (typeof MODERATION_ACTIONS)[number]

const TRANSITIONS: Record<ModerationStatus, Partial<Record<ModerationAction, ModerationStatus>>> = {
  unverified: {
    verify: 'verified',
    'mark-duplicate': 'duplicate',
    expire: 'expired',
  },
  duplicate: {
    expire: 'expired',
  },
  verified: {
    resolve: 'resolved',
    expire: 'expired',
  },
  resolved: {
    expire: 'expired',
  },
  expired: {},
}

export interface ModerationAuditEvent {
  eventId: string
  action: ModerationAction
  fromStatus: ModerationStatus
  toStatus: ModerationStatus
  actorId: string
  reason: string
  occurredAt: string
  requestId: string
}

export function transitionModerationStatus(
  current: ModerationStatus,
  action: ModerationAction,
): ModerationStatus | null {
  return TRANSITIONS[current][action] ?? null
}

export function canTransitionModerationStatus(
  current: ModerationStatus,
  action: ModerationAction,
): boolean {
  return transitionModerationStatus(current, action) !== null
}
