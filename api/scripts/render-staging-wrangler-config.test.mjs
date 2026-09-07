import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { EXPECTED_STAGING, generateStagingConfig, parseEnvFile, renderWranglerToml, validateStagingEnvironment } from './render-staging-wrangler-config.mjs'

function validEnvironment(overrides = {}) {
  return {
    BARRIO24_STAGING_ACCOUNT_ID: EXPECTED_STAGING.accountId,
    BARRIO24_STAGING_WORKER_NAME: EXPECTED_STAGING.workerName,
    BARRIO24_STAGING_D1_DATABASE_NAME: EXPECTED_STAGING.d1DatabaseName,
    BARRIO24_STAGING_D1_DATABASE_ID: EXPECTED_STAGING.d1DatabaseId,
    BARRIO24_STAGING_PAGES_ORIGIN: EXPECTED_STAGING.pagesOrigin,
    BARRIO24_STAGING_CRON: EXPECTED_STAGING.cron,
    BARRIO24_STAGING_RATE_LIMIT_NAMESPACE_ID: '1001',
    ...overrides,
  }
}

test('parseEnvFile supports comments, export and quoted cron values', () => {
  assert.deepEqual(parseEnvFile(`# comment\nexport A=value\nB="0 5 * * *"\nC='literal value'\n`), { A: 'value', B: '0 5 * * *', C: 'literal value' })
})
test('validation accepts only the authorized staging resource set', () => {
  const config = validateStagingEnvironment(validEnvironment()); assert.equal(config.workerName, 'barrio24-reports-api-staging'); assert.equal(config.rateLimitNamespaceId, '1001')
})
test('validation fails when a required value is missing', () => assert.throws(() => validateStagingEnvironment(validEnvironment({ BARRIO24_STAGING_D1_DATABASE_ID: '' })), /Missing required staging variable/))
test('validation rejects resources outside the authorized staging set', () => {
  const cases = [['BARRIO24_STAGING_ACCOUNT_ID','00000000000000000000000000000000'],['BARRIO24_STAGING_WORKER_NAME','barrio24-reports-api-production'],['BARRIO24_STAGING_D1_DATABASE_NAME','barrio24-reports-production'],['BARRIO24_STAGING_D1_DATABASE_ID','00000000-0000-4000-8000-000000000000'],['BARRIO24_STAGING_PAGES_ORIGIN','https://barrio24.example.com'],['BARRIO24_STAGING_CRON','*/5 * * * *']]
  for (const [key,value] of cases) assert.throws(() => validateStagingEnvironment(validEnvironment({ [key]: value })), /authorized staging value/)
})
test('validation requires a positive integer rate-limit namespace id', () => {
  for (const invalid of ['', '0', '-1', 'abc', '10.5', '001']) assert.throws(() => validateStagingEnvironment(validEnvironment({ BARRIO24_STAGING_RATE_LIMIT_NAMESPACE_ID: invalid })), invalid === '' ? /Missing required staging variable/ : /positive integer string/)
})
test('rendered TOML contains only the expected staging bindings', () => {
  const toml = renderWranglerToml(validateStagingEnvironment(validEnvironment())); assert.match(toml,/name = "barrio24-reports-api-staging"/); assert.match(toml,/account_id = "9d3274c57217e9cf44020bec6d754fb7"/); assert.match(toml,/database_name = "barrio24-reports-staging"/); assert.match(toml,/namespace_id = "1001"/); assert.match(toml,/ALLOWED_ORIGIN = "https:\/\/feature-02-rapid-report\.barrio24-staging\.pages\.dev"/); assert.doesNotMatch(toml,/ACCESS_AUDIENCE|ACCESS_OPERATOR_EMAILS|REPORTS_OPERATIONS_TOKEN/)
})
test('generateStagingConfig removes stale output when validation fails', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'barrio24-staging-config-')); t.after(() => rm(dir,{recursive:true,force:true})); const envPath=path.join(dir,'staging.env'); const outputPath=path.join(dir,'wrangler.toml'); await writeFile(envPath,'BARRIO24_STAGING_ACCOUNT_ID=wrong\n'); await writeFile(outputPath,'stale production-looking config'); await assert.rejects(generateStagingConfig({envPath,outputPath,processValues:{}}),/Missing required staging variable/); await assert.rejects(readFile(outputPath,'utf8'),{code:'ENOENT'})
})
test('generateStagingConfig renders a file from a valid env file', async (t) => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'barrio24-staging-config-')); t.after(() => rm(dir,{recursive:true,force:true})); const envPath=path.join(dir,'staging.env'); const outputPath=path.join(dir,'wrangler.toml'); const env=validEnvironment({BARRIO24_STAGING_RATE_LIMIT_NAMESPACE_ID:'4242'}); await writeFile(envPath,Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n')); await generateStagingConfig({envPath,outputPath,processValues:{}}); const generated=await readFile(outputPath,'utf8'); assert.match(generated,/namespace_id = "4242"/); assert.match(generated,/crons = \["0 5 \* \* \*"\]/)
})
