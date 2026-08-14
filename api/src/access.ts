import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
} from 'jose'

export interface AccessConfig {
  teamDomain?: string
  audience?: string
  operatorEmails?: string
}

export interface AccessIdentity {
  subject: string
  email: string
}

export type AccessAuthorizationResult =
  | { ok: true; identity: AccessIdentity }
  | { ok: false; reason: 'not-configured' | 'missing-token' | 'invalid-token' | 'not-allowed' }

type AccessJwks = JWTVerifyGetKey

const remoteJwks = new Map<string, AccessJwks>()

function normalizedTeamDomain(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) return null
    return url.origin
  } catch {
    return null
  }
}

function allowedEmails(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
}

function remoteJwksFor(teamDomain: string): AccessJwks {
  const cached = remoteJwks.get(teamDomain)
  if (cached) return cached
  const jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
  remoteJwks.set(teamDomain, jwks)
  return jwks
}

function identityFromPayload(payload: JWTPayload): AccessIdentity | null {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null
  if (typeof payload.email !== 'string' || payload.email.trim().length === 0) return null
  return {
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
  }
}

export async function authorizeAccess(
  request: Request,
  config: AccessConfig,
  jwksOverride?: AccessJwks,
): Promise<AccessAuthorizationResult> {
  const teamDomain = normalizedTeamDomain(config.teamDomain)
  const audience = config.audience?.trim()
  const emails = allowedEmails(config.operatorEmails)
  if (!teamDomain || !audience || emails.size === 0) return { ok: false, reason: 'not-configured' }

  const token = request.headers.get('cf-access-jwt-assertion')
  if (!token) return { ok: false, reason: 'missing-token' }

  try {
    const { payload } = await jwtVerify(token, jwksOverride ?? remoteJwksFor(teamDomain), {
      issuer: teamDomain,
      audience,
      algorithms: ['RS256'],
    })
    const identity = identityFromPayload(payload)
    if (!identity) return { ok: false, reason: 'invalid-token' }
    if (!emails.has(identity.email)) return { ok: false, reason: 'not-allowed' }
    return { ok: true, identity }
  } catch {
    return { ok: false, reason: 'invalid-token' }
  }
}
