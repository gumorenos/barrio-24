import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { EXPECTED_STAGING } from './staging-constants.mjs'

export const EXECUTE_FLAG = '--execute'
export const EXPECTED_SHA_PREFIX = '--expected-sha='
export const DEFAULT_EVIDENCE_DIR = 'artifacts/staging-readiness'
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/
const KIND_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/

export function parseExecutionEvidenceArgs(args) {
  const execute = args.includes(EXECUTE_FLAG)
  const rawExpectedSha = args.find((arg) => arg.startsWith(EXPECTED_SHA_PREFIX))?.slice(EXPECTED_SHA_PREFIX.length) ?? null
  if (rawExpectedSha && !GIT_SHA_PATTERN.test(rawExpectedSha)) throw new Error(`${EXPECTED_SHA_PREFIX}<40-hex> must contain a full lowercase commit SHA`)
  if (execute && !rawExpectedSha) throw new Error(`${EXECUTE_FLAG} requires ${EXPECTED_SHA_PREFIX}<40-hex> so remote evidence is bound to the intended candidate`)
  return Object.freeze({ execute, expectedSha: rawExpectedSha })
}

export function buildStagingEvidence({ kind, candidateSha, result, completedAt = new Date().toISOString() }) {
  if (!KIND_PATTERN.test(kind)) throw new Error(`invalid evidence kind: ${kind}`)
  if (!GIT_SHA_PATTERN.test(candidateSha)) throw new Error('candidateSha must be a full lowercase commit SHA')
  return Object.freeze({
    kind,
    candidateSha,
    completedAt,
    target: Object.freeze({ worker: EXPECTED_STAGING.workerName, workerUrl: EXPECTED_STAGING.workerUrl, d1: EXPECTED_STAGING.d1DatabaseName, pagesOrigin: EXPECTED_STAGING.pagesOrigin }),
    status: 'PASS',
    result,
  })
}

export async function writeStagingEvidence(evidence, { directory = DEFAULT_EVIDENCE_DIR, write = writeFile, makeDirectory = mkdir } = {}) {
  if (!evidence || evidence.status !== 'PASS') throw new Error('only explicit PASS evidence can be persisted by this helper')
  await makeDirectory(directory, { recursive: true })
  const stamp = evidence.completedAt.replace(/[:.]/g, '-')
  const outputPath = path.join(directory, `${evidence.kind}-${stamp}-${evidence.candidateSha.slice(0, 12)}.json`)
  await write(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return outputPath
}
