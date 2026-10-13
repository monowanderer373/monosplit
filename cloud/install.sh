#!/usr/bin/env bash
# Standalone Codex Cloud frontend installer; no database startup or deployment.
set -euo pipefail
REPO=/workspace/monosplit
ONBOARDING=/workspace/onboarding
NODE_VERSION=22.23.3
NODE_ROOT=/workspace/.tabby-node/node-v${NODE_VERSION}-linux-x64
mkdir -p "$ONBOARDING" /workspace/.tabby-node /workspace/.supabase-state
[[ "$(uname -m)" == x86_64 ]] || { echo 'Unsupported Node architecture; adapt the verified distribution.' >&2; exit 1; }
if [[ ! -x "$NODE_ROOT/bin/node" ]]; then
  archive="node-v${NODE_VERSION}-linux-x64.tar.xz"
  download=$(mktemp -d /workspace/.tabby-node/download.XXXXXX)
  trap 'rm -rf "$download"' EXIT
  curl --fail --silent --show-error --location "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -o "$download/SHASUMS256.txt"
  curl --fail --silent --show-error --location "https://nodejs.org/dist/v${NODE_VERSION}/$archive" -o "$download/$archive"
  (cd "$download"; awk -v name="$archive" '$2 == name {print}' SHASUMS256.txt > expected.sha256; test -s expected.sha256; sha256sum -c expected.sha256)
  tar -xJf "$download/$archive" -C /workspace/.tabby-node
  rm -rf "$download"
  trap - EXIT
fi
export PATH="$NODE_ROOT/bin:$PATH"
[[ "$(node --version)" == "v$NODE_VERSION" ]] || exit 1
cd "$REPO"
printf 'Node %s / npm %s; CI major 22\n' "$(node --version)" "$(npm --version)"
# Only the public demo settings in the existing LOCAL Playwright config may be created.
python3 - <<'PY'
from pathlib import Path
import re
import os
import json
import base64
from urllib.parse import urlsplit

def loopback(value):
    try:
        u = urlsplit(value)
        return u.scheme in ('http', 'https') and u.hostname in ('127.0.0.1', 'localhost', '::1') and not u.username and not u.password
    except ValueError:
        return False

if os.environ.get('VITE_SUPABASE_URL') and not loopback(os.environ['VITE_SUPABASE_URL']):
    raise SystemExit('Unsafe inherited Supabase target; values withheld.')
metadata = Path('/workspace/onboarding/package.json')
if metadata.exists():
    if json.loads(metadata.read_text()).get('type') != 'module':
        raise SystemExit('Existing onboarding package is not ESM; preserve and inspect it.')
else:
    metadata.write_text(json.dumps({'private': True, 'type': 'module'}) + '\n')
p = Path('.env.local')
if not p.exists():
    cfg = Path('playwright.config.ts').read_text()
    def literal(name):
        m = re.search(rf"\bconst\s+{name}\s*=\s*(['\"])(.*?)\1", cfg)
        if not m:
            raise SystemExit('Local Playwright constants changed; inspect before setup.')
        return m.group(2)
    url, key = literal('localSupabaseUrl'), literal('localSupabaseAnonKey')
    try:
        payload = json.loads(base64.urlsafe_b64decode(key.split('.')[1] + '==='))
    except Exception:
        raise SystemExit('Invalid public local fixture key; values withheld.')
    if not loopback(url) or payload.get('role') != 'anon' or payload.get('iss') != 'supabase-demo':
        raise SystemExit('Unsafe local fixture settings; values withheld.')
    # Exclusive create preserves user files even if another process creates one.
    with p.open('x') as f:
        f.write('# Disposable localhost Supabase only.\n'+f'VITE_SUPABASE_URL={url}\nVITE_SUPABASE_ANON_KEY={key}\n')
    p.chmod(0o600)
PY
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
cat > "$ONBOARDING/validate-local-env.mjs" <<'GUARD'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { loadEnv } from '/workspace/monosplit/node_modules/vite/dist/node/index.js'
export function validateLocalEnv(root = '/workspace/monosplit', modes = ['development', 'production', 'test']) {
  const config = readFileSync(`${root}/playwright.config.ts`, 'utf8')
  const literal = name => {
    const match = config.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*(['"])(.*?)\\1`))
    if (!match) throw new Error('Local fixture constants changed; inspect configuration.')
    return match[2]
  }
  const demoKey = literal('localSupabaseAnonKey')
  let payload
  try { payload = JSON.parse(Buffer.from(demoKey.split('.')[1] ?? '', 'base64url').toString()) }
  catch { throw new Error('Invalid public demo fixture key; values withheld.') }
  if (payload.role !== 'anon' || payload.iss !== 'supabase-demo') throw new Error('Expected public disposable demo key.')
  for (const mode of modes) {
    const env = loadEnv(mode, root, 'VITE_')
    let url
    try { url = new URL(env.VITE_SUPABASE_URL) } catch { throw new Error('Missing/invalid local Supabase URL; values withheld.') }
    if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password)
      throw new Error('Remote Supabase target rejected; values withheld.')
    if (env.VITE_SUPABASE_ANON_KEY !== demoKey) throw new Error('Only the repository public local demo key is allowed; values withheld.')
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateLocalEnv()
  console.log('PASS: effective Vite development/production/test targets are local demo only.')
}
GUARD
node "$ONBOARDING/validate-local-env.mjs"
test -x /usr/bin/chromium
cat > "$ONBOARDING/playwright.config.ts" <<'CONFIG'
import base from '/workspace/monosplit/playwright.config'
// @ts-expect-error External generated JS helper intentionally has no declarations.
import { validateLocalEnv } from './validate-local-env.mjs'
validateLocalEnv()
if (!base.webServer) throw new Error('Missing repository webServer; inspect configuration.')
const overrideServer = (server: NonNullable<typeof base.webServer> extends Array<infer T> ? T : Exclude<typeof base.webServer, unknown[] | undefined>) => ({
  ...server, cwd: '/workspace/monosplit', reuseExistingServer: false,
})
const projects = base.projects?.map(project => {
  if ((project.use?.browserName ?? base.use?.browserName ?? 'chromium') !== 'chromium') return project
  return { ...project, use: { ...project.use, launchOptions: {
    ...base.use?.launchOptions, ...project.use?.launchOptions, executablePath: '/usr/bin/chromium',
  } } }
})
export default {
  ...base,
  use: !base.projects?.length && (base.use?.browserName ?? 'chromium') === 'chromium'
    ? { ...base.use, launchOptions: { ...base.use?.launchOptions, executablePath: '/usr/bin/chromium' } }
    : base.use,
  projects,
  webServer: Array.isArray(base.webServer) ? base.webServer.map(overrideServer) : overrideServer(base.webServer),
  testDir: '/workspace/monosplit/e2e', outputDir: '/workspace/monosplit/test-results',
}
CONFIG
printf 'Frontend installed; backend NOT started or verified.\nUse export PATH=%q/bin:"$PATH" in new command sessions.\n' "$NODE_ROOT"
