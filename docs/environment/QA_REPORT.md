# Codex environment optimization report

2026-10-13 (Asia/Kuala_Lumpur). Adapted all files in TabbyTally_Codex_Autonomous_Setup_v3.zip to actual repository/environment; attachment proposals are not current-state evidence.

## Executive status
- Repo / active branch / latest commit: monowanderer373/monosplit, chore/codex-environment-v3, based on main392a84f52b5e75537dd21b437261e82056786420; final scoped Git commit is the commit containing this report (use git log -1). PR link recorded below after creation.
- Remote Codex Cloud Environment actually updated? **NO for active/published settings; YES for saved draft**, confirmed by exact read-back of both fields. Draft6acd982256a4819296cde723dcf7ce97, requires_publish=true. Supported tool cannot apply/publish it. No claim of fresh-task restoration.
- Frontend development ready? **YES on this instance**, when exporting documented Node PATH and using generated target guard. Fresh-task verification pending publication.
- Backend integration ready? **BLOCKED locally** by unchanged Docker vfs/capacity design and no disposable backend running. Use isolated existing CI.
- Production deployed? **NO** — this setup task does not authorize deployment. Main is unmerged; no deploy commands or production data operations.

## Changes made
- cloud/install.sh: full standalone cloud field text; official Node22.23.3/linux-x64 TLS+SHA256 verification, npm ci cache/no-audit/no-fund, fail-closed config constants, exclusive env creation, ESM external helper metadata, Vite-resolved isolation and Chromium-only wrapper preserving options/server arrays. No Docker startup/reset/deployment. Pinned Node major matches CI22; CI patch floats.
- cloud/START_SKILL.md: full copy-ready startup text, PATH per session, truthful frontend/backend separation, bounded recovery reads, process ownership and publication boundaries.
- cloud/verify-environment.test.mjs: seven meaningful regression checks for target resolution/privileged key/URL credentials and wrapper preservation across Chromium/Firefox, launch options and server arrays. Synthetic temporary fixtures only.
- .agents/skills/tabby-environment-qa/SKILL.md: reusable repository skill; different from cloud Start Skill field. Conventional repository skill path is present; automatic discovery in a future session NOT independently verified.
- AGENTS.md: merged environment/testing/recovery rules without replacing finance/design rules.
- docs/PROJECT_STATUS.md, docs/WORK_LOG.md and this report: checkpoint and current verification evidence.
- Outside checkout, generated/retained: /workspace/.tabby-node, .npm-cache, .supabase-state; /workspace/onboarding/package.json (ESM), validate-local-env.mjs, playwright.config.ts and ignored local logs. Existing .env.local preserved, not committed. Application source, Playwright/Vite base configs, package/lockfile, migrations, Vercel config and CI unchanged.
- Setup text staged in repo **and** saved through supported cloud draft tool. Editing repo alone would not change Cloud settings. Existing network/bindings preserved; no credentials added or rotated.

## Verification
| Check | PASS / FAIL / BLOCKED / NOT RUN | Evidence / command |
|---|---|---|
| Checkout & branch safety | PASS | Initially clean main392a84f; git ls-remote matched; separate setup branch, no reset/force-push/main merge |
| Node / npm / CI parity | PASS | Node22.23.3/npm10.9.9; CI Node22 major; official checksum verified (patch parity not claimed) |
| Bash/Python/JS syntax | PASS | bash -n cloud/install.sh; embedded Python compile(); node --check helper/test |
| Supabase localhost isolation | PASS | Vite loadEnv development/production/test; 7 guard/wrapper regressions, including inherited remote URL/key, mode override, expansion/duplicate and URL credentials |
| Dependencies | PASS | npm ci588 packages, repeat install succeeded; lockfile unchanged; existing deprecation notices, no dependency upgrade |
| Unit tests | PASS | npm test:524 tests/77 files from this task under Node22 |
| Lint | PASS | npm run lint exit0 |
| Build | PASS | npm run build exit0; PWA precache81 entries |
| Frontend HTTP | PASS | Started own Vite server; curl HTML and src/main.tsx succeeded; stopped owned processes |
| Public Playwright | PASS | Actual generated wrapper/mobile-chromium:4/4 passed (21.4s), signed-out/spaces/deep-link/offline PWA; test list71/18 files |
| Docker resource readiness | BLOCKED | vfs;32GB filesystem/30GB available; images221.1MB; no containers/volumes/auth health. Known same-capacity PostgreSQL extraction failure; no unchanged pull attempted |
| Disposable DB lint / pgTAP | BLOCKED | No verified disposable stack; no reset/start/DB commands run. Existing isolated Quality CI is the recommended runner |
| Authenticated Playwright | BLOCKED | Local backend unavailable; no production/shared fixtures used |
| Production deployment | NOT RUN | Out of setup scope, no main merge/deployment |
| Published/new-task restoration | NOT RUN | Supported tool saves draft only; requires user publication then new task |

Initial attempts and recovery: wrapper first loaded as CommonJS and failed on import.meta; corrected external ESM metadata and confirmed list/public run. One reinstall overlapped first tests/build, causing missing-module failures; those results were discarded and full current checks rerun after install. First browser attempt refused an occupied port as intended; owned dev processes stopped before final4/4. CLI default state hit readonly home; documented SUPABASE_HOME succeeded. No unresolved frontend FAIL remains.

Logs on current machine: /workspace/onboarding/setup-v3-{install,repeat-install,unit-final,lint-final,build-final,guard-final,public-final,test-list}.log. Logs are local evidence, not committed artifacts; do not dump arbitrary env/credentials in future runs. Old508/519/previous71/pgTAP evidence is not this task's local success.

## Unresolved blockers
- Backend: unchanged vfs/capacity prevents a safe meaningful retry. Run existing GitHub Actions Quality on a disposable runner or provision suitable storage/layer-sharing driver; verify ownership, localhost auth/database and CLI flags before any local reset. Never substitute production.
- Cloud: review/save both fields in environment settings and **publish**; then start a fresh task and check Node PATH, helper regeneration/isolation and public tests. Current settings values were read and draft write verified, but active publication is NOT verified. No supported auto-publish action exists here.
- Copy-ready fields: cloud/install.sh and cloud/START_SKILL.md. Manual paste is unnecessary if using the already-saved draft; these files also provide fallback/recovery text.
- Current secure metadata shows existing Vercel/Supabase bindings saved; no token values inspected and no management API/native CLI authentication proof claimed by this setup. Future deployment still needs correct target/auth/preview/release checks and separate task scope.

## Security confirmation
- Production database untouched by this task: no reset/migrate/seed/write commands, no production financial data or automated account fixtures used. This is a command-scope assertion, not a forensic audit of external actors.
- No secrets printed or committed: env checks emit generic verdicts; only existing PUBLIC LOCAL demo fixture key is read for verification; env/cache/helper output remains outside tracked changes. Review git staged diff/files before commit. TLS/checksum verification retained; no service-role or token values included.
