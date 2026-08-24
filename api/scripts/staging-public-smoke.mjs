import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXPECTED_STAGING } from './staging-constants.mjs'
import { buildStagingEvidence, parseExecutionEvidenceArgs, writeStagingEvidence } from './staging-evidence.mjs'

const REPORT_PATH = '/v1/reports'
const HEALTH_PATH = '/api/health'
const FORBIDDEN_ORIGIN = 'https://not-barrio24.example'

function assertExactStagingUrl(baseUrl) { if (baseUrl !== EXPECTED_STAGING.workerUrl) throw new Error('Refusing to run public smoke against a URL other than the authorized staging Worker') }
async function jsonBody(response) { try { return await response.json() } catch { return null } }
async function expectStatus(response, expected, label) { const body = await jsonBody(response); if (response.status !== expected) { const error = body && typeof body === 'object' && 'error' in body ? ` (${body.error})` : ''; throw new Error(`${label}: expected HTTP ${expected}, received ${response.status}${error}`) } return body }

export function createSyntheticReport({ eventId = randomUUID(), observedAt = new Date().toISOString() } = {}) {
  return { event_id: eventId, schema_version: 1, category: 'building-damage', severity: 'observed', location_cell: null, observed_at: observedAt }
}

export async function runPublicStagingSmoke({ fetchImpl = fetch, baseUrl = EXPECTED_STAGING.workerUrl, pagesOrigin = EXPECTED_STAGING.pagesOrigin, clientId = randomUUID(), eventId = randomUUID(), observedAt = new Date().toISOString() } = {}) {
  assertExactStagingUrl(baseUrl)
  if (pagesOrigin !== EXPECTED_STAGING.pagesOrigin) throw new Error('Refusing to run public smoke with a non-staging Pages origin')
  const report = createSyntheticReport({ eventId, observedAt }); const reportBody = JSON.stringify(report); const commonHeaders = { Origin: pagesOrigin, 'Content-Type': 'application/json', 'X-Client-Id': clientId }; const results = []
  const health = await fetchImpl(`${baseUrl}${HEALTH_PATH}`); const healthBody = await expectStatus(health, 200, 'health'); if (!healthBody || healthBody.ok !== true || healthBody.service !== 'barrio24-reports-api') throw new Error('health: unexpected response contract'); results.push({ check: 'health', status: health.status })
  const preflight = await fetchImpl(`${baseUrl}${REPORT_PATH}`, { method: 'OPTIONS', headers: { Origin: pagesOrigin } }); await expectStatus(preflight, 204, 'preflight'); if (preflight.headers.get('access-control-allow-origin') !== pagesOrigin) throw new Error('preflight: staging origin was not echoed in Access-Control-Allow-Origin'); results.push({ check: 'preflight', status: preflight.status })
  const forbidden = await fetchImpl(`${baseUrl}${REPORT_PATH}`, { method: 'POST', headers: { ...commonHeaders, Origin: FORBIDDEN_ORIGIN }, body: reportBody }); const forbiddenBody = await expectStatus(forbidden, 403, 'cross-origin rejection'); if (!forbiddenBody || forbiddenBody.error !== 'origin_not_allowed') throw new Error('cross-origin rejection: unexpected response contract'); if (forbidden.headers.has('access-control-allow-origin')) throw new Error('cross-origin rejection: forbidden origin received an allow-origin header'); results.push({ check: 'cross-origin rejection', status: forbidden.status })
  const created = await fetchImpl(`${baseUrl}${REPORT_PATH}`, { method: 'POST', headers: commonHeaders, body: reportBody }); const createdBody = await expectStatus(created, 202, 'create synthetic report'); if (!createdBody || createdBody.event_id !== eventId || createdBody.status !== 'unverified' || createdBody.verified !== false) throw new Error('create synthetic report: unexpected response contract'); results.push({ check: 'create synthetic report', status: created.status })
  const duplicate = await fetchImpl(`${baseUrl}${REPORT_PATH}`, { method: 'POST', headers: commonHeaders, body: reportBody }); const duplicateBody = await expectStatus(duplicate, 409, 'duplicate report'); if (!duplicateBody || duplicateBody.event_id !== eventId || duplicateBody.duplicate !== true) throw new Error('duplicate report: unexpected response contract'); results.push({ check: 'duplicate report', status: duplicate.status })
  return { eventId, clientId, results }
}

async function main() {
  const execution = parseExecutionEvidenceArgs(process.argv.slice(2))
  if (!execution.execute) { console.log('[staging:public-smoke] DRY RUN: no staging traffic sent'); console.log('[staging:public-smoke] checks=health,preflight,cross-origin-rejection,create,duplicate'); console.log('[staging:public-smoke] successful execution can create at most one synthetic staging row'); console.log('[staging:public-smoke] re-run with --execute --expected-sha=<candidate-sha> after readonly readiness passes'); return }
  const outcome = await runPublicStagingSmoke(); console.log(`[staging:public-smoke] synthetic event ${outcome.eventId}`); for (const result of outcome.results) console.log(`[staging:public-smoke] ${result.check}: HTTP ${result.status}`)
  const evidence = buildStagingEvidence({ kind: 'public-smoke', candidateSha: execution.expectedSha, result: outcome }); const evidencePath = await writeStagingEvidence(evidence); console.log(`[staging:public-smoke] evidence=${evidencePath}`)
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsScript) { try { await main() } catch (error) { console.error(`[staging:public-smoke] ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1 } }
