import { existsSync, readFileSync } from 'node:fs'

// Playwright can exhaust GitHub's per-step annotation quota before later failures.
// Report only final unexpected error messages, never stdout, trace or auth state.
const path = process.argv[2] ?? 'test-results/browser-results.json'
if (existsSync(path)) {
  const report = JSON.parse(readFileSync(path, 'utf8'))
  if(report.stats){const s=report.stats;console.log(`::notice title=Isolated browser results::expected=${s.expected}; unexpected=${s.unexpected}; flaky=${s.flaky}; skipped=${s.skipped}; durationMs=${Math.round(s.duration)}`)}
  const escape = value => value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
  const redact = value => value
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[a-z][a-z\d+.-]*:\/\/[^\s"<>]+/gi, '[test URL redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[QA email redacted]')
    .replace(/((?:api[_-]?key|password|access[_-]?token|refresh[_-]?token|service[_-]?role(?:[_-]?key)?)\s*["':=]+\s*)[^\s,}\n]+/gi, '$1[redacted]')
  let emitted = 0
  const visit = suite => {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      if (test.status !== 'unexpected' || emitted >= 10) continue
      const last = test.results?.at(-1)
      const errors = last?.errors ?? (last?.error ? [last.error] : [])
      const detail = errors.map(error => error.message ?? error.value ?? 'Unexpected browser result').join('\n')
      const title = redact(`Browser failure: ${spec.file ?? suite.file ?? ''}:${spec.line ?? 0} ${spec.title}`).replaceAll(',', ' ')
      console.log(`::notice title=${escape(title)}::${escape(redact(detail).slice(0, 6000))}`)
      emitted++
    }
    for (const child of suite.suites ?? []) visit(child)
  }
  for (const suite of report.suites ?? []) visit(suite)
}
