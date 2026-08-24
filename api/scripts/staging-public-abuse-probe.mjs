import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXPECTED_STAGING } from './staging-constants.mjs'
import { buildStagingEvidence, parseExecutionEvidenceArgs, writeStagingEvidence } from './staging-evidence.mjs'

const REPORT_PATH = '/v1/reports'

function assertExactStagingUrl(baseUrl) {
  if (baseUrl !== EXPECTED_STAGING.workerUrl) throw new Error('Refusing to run abuse probe against a URL other than the authorized staging Worker')
}
function assertExactStagingOrigin(origin) {
  if (origin !== EXPECTED_STAGING.pagesOrigin) throw new Error('Refusing to run abuse probe with a non-staging Pages origin')
}
function baseReport(overrides = {}) {
  return { event_id: randomUUID(), schema_version: 1, category: 'building-damage', severity: 'observed', location_cell: null, observed_at: new Date().toISOString(), ...overrides }
}

export function buildPublicAbuseCases({ idFactory = randomUUID, observedAt = new Date().toISOString() } = {}) {
  const report = (overrides = {}) => ({ ...baseReport({ event_id: idFactory(), observed_at: observedAt }), ...overrides })
  return [
    { name: 'invalid-json', body: '{"event_id":', expectedStatus: 400, expectedError: 'invalid_json' },
    { name: 'exact-coordinate-fields-rejected', body: JSON.stringify(report({ latitude: -12.0464, longitude: -77.0428 })), expectedStatus: 400, expectedError: 'invalid_report' },
    { name: 'over-precise-location-cell-rejected', body: JSON.stringify(report({ location_cell: '-12.046,-77.043' })), expectedStatus: 400, expectedError: 'invalid_report' },
    { name: 'unknown-category-rejected', body: JSON.stringify(report({ category: 'free-text-emergency' })), expectedStatus: 400, expectedError: 'invalid_report' },
    { name: 'invalid-observed-at-rejected', body: JSON.stringify(report({ observed_at: 'not-a-date' })), expectedStatus: 400, expectedError: 'invalid_report' },
    { name: 'oversized-payload-rejected', body: JSON.stringify({ padding: 'x'.repeat(2_100) }), expectedStatus: 413, expectedError: 'payload_too_large' },
  ]
}

async function parseJson(response) { try { return await response.json() } catch { return null } }

export async function runPublicAbuseProbe({ fetchImpl = fetch, baseUrl = EXPECTED_STAGING.workerUrl, pagesOrigin = EXPECTED_STAGING.pagesOrigin, cases = buildPublicAbuseCases(), clientIdFactory = randomUUID } = {}) {
  assertExactStagingUrl(baseUrl); assertExactStagingOrigin(pagesOrigin); const results = []
  for (const testCase of cases) {
    const clientId = clientIdFactory()
    const response = await fetchImpl(`${baseUrl}${REPORT_PATH}`, { method: 'POST', headers: { Origin: pagesOrigin, 'Content-Type': 'application/json', 'X-Client-Id': clientId }, body: testCase.body })
    const body = await parseJson(response)
    if (response.status !== testCase.expectedStatus) { const receivedError = body && typeof body === 'object' && 'error' in body ? ` (${body.error})` : ''; throw new Error(`${testCase.name}: expected HTTP ${testCase.expectedStatus}, received ${response.status}${receivedError}`) }
    if (!body || body.error !== testCase.expectedError) throw new Error(`${testCase.name}: expected error ${testCase.expectedError}`)
    if (response.headers.get('access-control-allow-origin') !== pagesOrigin) throw new Error(`${testCase.name}: staging origin missing from Access-Control-Allow-Origin`)
    if (response.status >= 200 && response.status < 300) throw new Error(`${testCase.name}: invalid request was unexpectedly accepted`)
    results.push({ check: testCase.name, status: response.status, error: body.error })
  }
  return { results }
}

async function main() {
  const execution = parseExecutionEvidenceArgs(process.argv.slice(2))
  if (!execution.execute) { console.log('[staging:public-abuse] DRY RUN: no staging traffic sent'); console.log('[staging:public-abuse] all cases are invalid payloads expected to return 4xx'); console.log('[staging:public-abuse] re-run with --execute --expected-sha=<candidate-sha> after readonly readiness passes'); return }
  const outcome = await runPublicAbuseProbe(); for (const result of outcome.results) console.log(`[staging:public-abuse] ${result.check}: HTTP ${result.status} ${result.error}`); console.log('[staging:public-abuse] all invalid payloads were rejected; no accepted report response observed')
  const evidence = buildStagingEvidence({ kind: 'public-abuse', candidateSha: execution.expectedSha, result: outcome }); const evidencePath = await writeStagingEvidence(evidence); console.log(`[staging:public-abuse] evidence=${evidencePath}`)
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsScript) { try { await main() } catch (error) { console.error(`[staging:public-abuse] ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1 } }
