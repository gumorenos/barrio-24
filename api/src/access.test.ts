import { beforeAll, describe, expect, it } from 'vitest'
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from 'jose'
import { authorizeAccess } from './access'

const TEAM_DOMAIN = 'https://barrio24.cloudflareaccess.com'
const AUDIENCE = 'barrio24-operations-test'

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey']
let localJwks: ReturnType<typeof createLocalJWKSet>

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256')
  privateKey = keyPair.privateKey
  const publicJwk = await exportJWK(keyPair.publicKey)
  localJwks = createLocalJWKSet({
    keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }],
  })
})

async function token(options: {
  issuer?: string
  audience?: string
  email?: string
  subject?: string
  expiration?: string
} = {}) {
  return new SignJWT({ email: options.email ?? 'Operator@Example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(options.issuer ?? TEAM_DOMAIN)
    .setAudience(options.audience ?? AUDIENCE)
    .setSubject(options.subject ?? 'access-sub')
    .setIssuedAt()
    .setExpirationTime(options.expiration ?? '10m')
    .sign(privateKey)
}

function request(jwt?: string) {
  return new Request('https://api.example.test/v1/ops/summary', jwt
    ? { headers: { 'cf-access-jwt-assertion': jwt } }
    : undefined)
}

const config = {
  teamDomain: TEAM_DOMAIN,
  audience: AUDIENCE,
  operatorEmails: 'operator@example.com, second@example.com',
}

describe('autorización de Cloudflare Access', () => {
  it('falla cerrada cuando falta configuración o el JWT', async () => {
    await expect(authorizeAccess(request(), {})).resolves.toEqual({ ok: false, reason: 'not-configured' })
    await expect(authorizeAccess(request(), config, localJwks)).resolves.toEqual({ ok: false, reason: 'missing-token' })
  })

  it('valida firma, issuer, audience, expiración y allowlist de correo', async () => {
    const jwt = await token()
    await expect(authorizeAccess(request(jwt), config, localJwks)).resolves.toEqual({
      ok: true,
      identity: { subject: 'access-sub', email: 'operator@example.com' },
    })

    const disallowed = await token({ email: 'other@example.com' })
    await expect(authorizeAccess(request(disallowed), config, localJwks)).resolves.toEqual({
      ok: false,
      reason: 'not-allowed',
    })
  })

  it('rechaza issuer, audience o firma incorrectos', async () => {
    const wrongIssuer = await token({ issuer: 'https://other.cloudflareaccess.com' })
    const wrongAudience = await token({ audience: 'other-audience' })
    const expired = await token({ expiration: '0s' })
    await expect(authorizeAccess(request(wrongIssuer), config, localJwks)).resolves.toEqual({ ok: false, reason: 'invalid-token' })
    await expect(authorizeAccess(request(wrongAudience), config, localJwks)).resolves.toEqual({ ok: false, reason: 'invalid-token' })
    await expect(authorizeAccess(request(expired), config, localJwks)).resolves.toEqual({ ok: false, reason: 'invalid-token' })
  })
})
