# Tabby Tally cloud startup and recovery

Use the existing /workspace/monosplit checkout; do not create a worktree unless requested. Inspect git status/diff, active branch and HEAD first. Read AGENTS.md, PROJECT_STATUS and recent WORK_LOG entries; read older handovers/ADRs only as relevant. Preserve user work. Historical tests are not current evidence.

Runtime: export PATH=/workspace/.tabby-node/node-v22.23.3-linux-x64/bin:"$PATH" in every execution session. Node 22 matches CI's major; CI's moving patch can differ. Installer downloads official distribution with TLS and SHA-256 verification. Dependencies/snapshot files may survive; servers and session PATH do not.

If dependencies/generated wrapper are missing, run bash /workspace/monosplit/cloud/install.sh when present. Otherwise use the saved Cloud Install Script; it is NOT assumed to exist at /workspace/onboarding/install.sh. Installation uses npm ci (never rewrites the lockfile), creates .env.local only when absent, and generates /workspace/onboarding/{validate-local-env.mjs,playwright.config.ts}. It never starts Docker or deploys.

Before development, build or disposable browser tests:
cd /workspace/monosplit
export PATH=/workspace/.tabby-node/node-v22.23.3-linux-x64/bin:"$PATH"
export SUPABASE_HOME=/workspace/.supabase-state
node /workspace/onboarding/validate-local-env.mjs
This uses Vite loadEnv for development/production/test, including mode files, expansion and inherited variables. It requires loopback URLs and the public local demo key. Preserve existing files and fix the target without printing values. Do not bypass it to test production.

Frontend startup: npm run dev -- --host 127.0.0.1 --port 5173 --strictPort in a persistent execution session. Verify curl -fsS http://127.0.0.1:5173/ and /src/main.tsx. A frontend response is not backend proof; do not share loopback preview links. Stop only the process this task started. Revalidate target before restarting.

Frontend QA: npm test; npm run lint; npm run build. Use current outputs/counts. Environment regression harness: node --test cloud/verify-environment.test.mjs (requires generated helpers). Check syntax: bash -n cloud/install.sh; compile the embedded Python without executing it.

Browser QA is a separate mode: stop only your dev server first; wrapper owns preview lifecycle and reuseExistingServer=false. It preserves original project/server options, uses /usr/bin/chromium only for Chromium and keeps Firefox/WebKit untouched. List projects with npx playwright test --config=/workspace/onboarding/playwright.config.ts --list. Run public subset:
npx playwright test --config=/workspace/onboarding/playwright.config.ts e2e/app.spec.ts --grep 'signed-out|spaces route|deep link|production PWA' --workers=1
Public checks do not validate authenticated finance. Existing base config hard-pins disposable local Supabase. Failure traces stay off per existing security policy.

Backend preflight: df -h /workspace; docker info --format '{{.Driver}} {{.DockerRootDir}}'; docker system df; check containers/volumes and localhost auth health without showing credentials. Historical vfs/32GB PostgreSQL extraction failure remains a blocker unless storage/driver changes materially. Do not retry unchanged pulls or prune unowned data. Preferred validation: existing isolated GitHub Actions Quality jobs, or a suitable dedicated disposable runner. No production data/credentials are needed.

Only when adequate storage AND a newly created owned disposable localhost stack are verified, consult current CLI flags and run local startup, db lint --local, pgTAP --local and related authenticated E2E. A reset is allowed only on that new verified stack, never shared/linked/production. No database reset/startup is automatic in environment setup.

For setup tasks: do not deploy production, modify production project settings, or merge setup PRs into main without considering auto deployment. Push a scoped feature branch/PR. Feature releases have their own current user scope. Proxy network-secret bindings are not necessarily raw CLI credentials; never print values or request duplicate bindings without actual connection evidence.

Report PASS/FAIL/BLOCKED/NOT RUN separately for syntax, dependencies, unit/lint/build, public browser, Docker, DB and auth. Update docs/PROJECT_STATUS.md and WORK_LOG.md at checkpoints with branch/commit, changed tooling, current evidence/blockers/next step. Use docs/environment/QA_REPORT.md report layout and repository .agents/skills/tabby-environment-qa/SKILL.md when applicable.

Saved cloud draft is not applied/published automatically. Review/save and publish via environment settings, then verify a fresh task. Do not claim new-task restoration until observed.
