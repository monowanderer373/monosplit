// Run after cloud/install.sh. Test-only synthetic fixtures, never a real DB.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'
import { validateLocalEnv } from '/workspace/onboarding/validate-local-env.mjs'
const config = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8')
const key = config.match(/const localSupabaseAnonKey = '([^']+)'/)[1]
const original = { url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_ANON_KEY }
function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'tabby-env-'))
  delete process.env.VITE_SUPABASE_URL
  delete process.env.VITE_SUPABASE_ANON_KEY
  writeFileSync(join(root, 'playwright.config.ts'), config)
  writeFileSync(join(root, '.env.local'), `VITE_SUPABASE_URL=http://127.0.0.1:54321\nVITE_SUPABASE_ANON_KEY=${key}\n`)
  try { callback(root) } finally {
    rmSync(root, { recursive: true, force: true })
    for (const [name, value] of [['VITE_SUPABASE_URL', original.url], ['VITE_SUPABASE_ANON_KEY', original.key]])
      if (value === undefined) delete process.env[name]; else process.env[name] = value
  }
}
test('accepts canonical local configuration and IPv6 loopback', () => fixture(root => {
  validateLocalEnv(root)
  process.env.VITE_SUPABASE_URL = 'http://[::1]:54321'
  validateLocalEnv(root)
}))
test('rejects inherited remote target without leaking it', () => fixture(root => {
  process.env.VITE_SUPABASE_URL = 'https://private.invalid'
  assert.throws(() => validateLocalEnv(root), e => !e.message.includes('private.invalid') && /rejected/.test(e.message))
}))
test('rejects production-local mode overriding a safe local file', () => fixture(root => {
  writeFileSync(join(root, '.env.production.local'), 'VITE_SUPABASE_URL=https://private.invalid\n')
  assert.throws(() => validateLocalEnv(root))
}))
test('rejects expanded remote URL and duplicate last definition', () => fixture(root => {
  writeFileSync(join(root, '.env.local'), `TARGET=https://private.invalid\nVITE_SUPABASE_URL=http://localhost:54321\nVITE_SUPABASE_URL=\${TARGET}\nVITE_SUPABASE_ANON_KEY=${key}\n`)
  assert.throws(() => validateLocalEnv(root))
}))
test('rejects inherited privileged key even with safe host', () => fixture(root => {
  process.env.VITE_SUPABASE_ANON_KEY = 'sb_secret_test_only'
  assert.throws(() => validateLocalEnv(root))
}))
test('rejects credential-bearing local URL', () => fixture(root => {
  process.env.VITE_SUPABASE_URL = 'http://user:password@localhost:54321'
  assert.throws(() => validateLocalEnv(root))
}))
test('wrapper preserves settings and overrides only Chromium for object/array servers', () => {
  const wrapper = readFileSync('/workspace/onboarding/playwright.config.ts', 'utf8')
  for (const array of [false, true]) {
    const server = { command: 'fixture-only', env: { LOCAL: 'test' }, timeout: 7654, reuseExistingServer: true }
    const base = { use: { trace: 'off', launchOptions: { args: ['--global'], slowMo: 7 } }, retries: 2,
      projects: [ { name: 'chrome', use: { browserName: 'chromium', launchOptions: { args: ['--project'] }, viewport: { width: 320, height: 700 } } },
        { name: 'fox', use: { browserName: 'firefox', launchOptions: { slowMo: 9 } } } ], webServer: array ? [server, server] : server }
    const source = wrapper.replace(/import base from [^\n]+/, `const base = ${JSON.stringify(base)}`)
      .replace(/import \{ validateLocalEnv \} from [^\n]+/, 'const validateLocalEnv = () => {}')
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    const exports = {}
    Function('exports', js)(exports)
    const result = exports.default
    assert.equal(result.retries, 2)
    assert.equal(result.use.trace, 'off')
    assert.equal(result.projects[0].use.launchOptions.executablePath, '/usr/bin/chromium')
    assert.deepEqual(result.projects[0].use.launchOptions.args, ['--project'])
    assert.equal(result.projects[0].use.launchOptions.slowMo, 7)
    assert.deepEqual(result.projects[1], base.projects[1])
    for (const s of array ? result.webServer : [result.webServer]) {
      assert.equal(s.reuseExistingServer, false)
      assert.equal(s.timeout, 7654)
      assert.deepEqual(s.env, server.env)
    }
  }
})
