# Tabby Tally development

- At task start or after interruption, read docs/PROJECT_STATUS.md, docs/WORK_LOG.md, CONTEXT.md and relevant ADRs, then inspect git status/diff and current remote main. Historical release statements are context, not current deployment evidence.
- Preserve user changes; never reset to a historical handover commit or force-push. Use the existing isolated checkout unless the user requests a worktree.
- Keep React/TypeScript/Vite/Supabase/PWA and the lockfile-supported tools. Do not migrate frameworks or redesign themes without current user direction.
- Person is not Participant. Preserve immutable financial principals/history, F=E-T+R, integer same-currency amounts, RLS, expected versions, idempotent request IDs and existing transactional correction/settlement/reversal RPCs. Pending candidates are not confirmed contributions.
- Apply approved module design to real services with scoped CSS; design JSON is never production data/fallback. Preserve existing financial semantics and original editors/navigation.
- Update PROJECT_STATUS/WORK_LOG at major checkpoints with branch/commit, changed files, actual test outcomes, deployment evidence, blockers and next executable step. Distinguish mocks, real isolated backend tests, public production checks and private production/device checks.
- Never print or commit credentials, private financial data or private screenshots. Use secure environment bindings. Database reset is permitted only on a disposable isolated local stack, never linked production.
- Production completion requires actual published-version/live evidence; report unavailable connections accurately. Current user authorization takes precedence over historical runbook approval notes.
