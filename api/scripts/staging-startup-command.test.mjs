import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PACKAGE_JSON = path.resolve(SCRIPT_DIR, '..', '..', 'package.json')

test('staging startup check passes the Worker entrypoint explicitly', async () => {
  const pkg = JSON.parse(await readFile(PACKAGE_JSON, 'utf8'))
  const command = pkg.scripts?.['staging:startup-check']

  assert.equal(typeof command, 'string')
  assert.match(command, /wrangler@4\.125\.0/)
  assert.match(command, /wrangler check startup api\/src\/index\.ts/)
  assert.match(command, /--config api\/wrangler\.toml/)
  assert.doesNotMatch(command, /wrangler check startup\s+--config/)
})
