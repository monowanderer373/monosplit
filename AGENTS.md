# Tabby Tally development

- At task start or after interruption, read docs/PROJECT_STATUS.md, docs/WORK_LOG.md, CONTEXT.md and relevant ADRs, then inspect git status/diff and current remote main. Historical release statements are context, not current deployment evidence.
- Preserve user changes; never reset to a historical handover commit or force-push. Use the existing isolated checkout unless the user requests a worktree.
- Keep React/TypeScript/Vite/Supabase/PWA and the lockfile-supported tools. Do not migrate frameworks or redesign themes without current user direction.
- Person is not Participant. Preserve immutable financial principals/history, F=E-T+R, integer same-currency amounts, RLS, expected versions, idempotent request IDs and existing transactional correction/settlement/reversal RPCs. Pending candidates are not confirmed contributions.
- Apply approved module design to real services with scoped CSS; design JSON is never production data/fallback. Preserve existing financial semantics and original editors/navigation.
- Update PROJECT_STATUS/WORK_LOG at major checkpoints with branch/commit, changed files, actual test outcomes, deployment evidence, blockers and next executable step. Distinguish mocks, real isolated backend tests, public production checks and private production/device checks.
- Never print or commit credentials, private financial data or private screenshots. Use secure environment bindings. Database reset is permitted only on a disposable isolated local stack, never linked production.
- Production completion requires actual published-version/live evidence; report unavailable connections accurately. Current user authorization takes precedence over historical runbook approval notes.

## Environment and QA recovery
- For environment tasks use cloud/install.sh, cloud/START_SKILL.md and .agents/skills/tabby-environment-qa/SKILL.md. Read current Git state and recent checkpoint entries first; avoid rereading the full history for a routine follow-up.
- Export the installer-selected Node path per cloud/START_SKILL.md in each command session; do not assume session PATH/processes survive restoration.
- Before local dev/build/tests run /workspace/onboarding/validate-local-env.mjs. It validates Vite-resolved mode files and inherited variables without revealing values; localhost demo only. Preserve user env files.
- Distinguish frontend/public QA from DB/auth QA using PASS/FAIL/BLOCKED/NOT RUN with current evidence. Do not repeat unchanged Docker vfs/capacity failures or prune user data; use isolated CI when local backend is blocked.
- Setup tasks do not authorize production deployment. Keep setup changes on a branch/PR; merging main can trigger Vercel. Repository tooling/skills do not automatically update cloud settings, and a saved draft is not publication.
