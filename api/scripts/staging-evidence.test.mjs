import assert from 'node:assert/strict'
import test from 'node:test'

import { buildStagingEvidence, parseExecutionEvidenceArgs, writeStagingEvidence } from './staging-evidence.mjs'

const SHA = 'a'.repeat(40)

test('execution evidence args require a full expected SHA only for real execution', () => {
  assert.deepEqual(parseExecutionEvidenceArgs([]), { execute: false, expectedSha: null })
  assert.deepEqual(parseExecutionEvidenceArgs([`--expected-sha=${SHA}`]), { execute: false, expectedSha: SHA })
  assert.deepEqual(parseExecutionEvidenceArgs(['--execute', `--expected-sha=${SHA}`]), { execute: true, expectedSha: SHA })
  assert.throws(() => parseExecutionEvidenceArgs(['--execute']), /requires --expected-sha/)
  assert.throws(() => parseExecutionEvidenceArgs(['--execute', '--expected-sha=abc']), /full lowercase commit SHA/)
})

test('staging evidence binds PASS result to the exact candidate and authorized target', () => {
  const evidence = buildStagingEvidence({ kind: 'public-smoke', candidateSha: SHA, completedAt: '2026-08-24T12:00:00.000Z', result: { checks: 5 } })
  assert.equal(evidence.candidateSha, SHA); assert.equal(evidence.status, 'PASS'); assert.equal(evidence.target.worker, 'barrio24-reports-api-staging'); assert.match(evidence.target.workerUrl, /staging\.gumorenos\.workers\.dev$/)
})

test('staging evidence rejects unsafe kinds and malformed candidates', () => {
  assert.throws(() => buildStagingEvidence({ kind: '../escape', candidateSha: SHA, result: {} }), /invalid evidence kind/)
  assert.throws(() => buildStagingEvidence({ kind: 'public-smoke', candidateSha: 'bad', result: {} }), /candidateSha/)
})

test('writeStagingEvidence uses a private candidate-bound JSON filename', async () => {
  const calls = []; const evidence = buildStagingEvidence({ kind: 'public-smoke', candidateSha: SHA, completedAt: '2026-08-24T12:00:00.000Z', result: { checks: 5 } })
  const outputPath = await writeStagingEvidence(evidence, { makeDirectory: async (...args) => { calls.push(['mkdir', ...args]) }, write: async (...args) => { calls.push(['write', ...args]) } })
  assert.match(outputPath, new RegExp(`^artifacts/staging-readiness/public-smoke-2026-08-24T12-00-00-000Z-${SHA.slice(0, 12)}\\.json$`))
  const writeCall = calls.find(([kind]) => kind === 'write'); assert.equal(writeCall[3].mode, 0o600)
})
