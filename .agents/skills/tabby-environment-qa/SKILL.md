---
name: tabby-environment-qa
description: Validate Tabby Tally Codex developer environment, frontend/browser/database test readiness, and recovery evidence without risking production.
---

# Tabby Tally Environment QA

Use this skill when configuring Codex Cloud, diagnosing missing dependencies/browser tools, validating test readiness, or responding to interrupted development sessions.

1. Read repository `AGENTS.md` and inspect Git status/branch/diff before running setup.
2. Determine the current runner, Node version, package manager, CI baseline, Chromium and Playwright projects from actual files; never assume historical report data remains true.
3. Verify `.env.local`/process env target for disposable frontend tests *without exposing raw credential values*. Fail closed if the effective Supabase URL can resolve outside loopback.
4. Execute supported nondestructive checks and report **separately**: npm install, unit test, lint, build, public Playwright E2E, local disposable Supabase, DB lint, pgTAP, authenticated E2E, preview/release checks.
5. For a Docker `vfs` / insufficient disk blocker, do not repeat unchanged PostgreSQL downloads or prune unowned images/volumes; choose CI/disposable runner instead.
6. State `PASS` / `FAIL` / `BLOCKED` / `NOT RUN` with current evidence and a concrete next action. Preserve Git changes and write a concise resumable status when appropriate.

Do not make a production deployment or modify a real database when executing this skill.

Repository adaptation: follow cloud/START_SKILL.md for Node/session PATH and scripts. After cloud/install.sh generates external helpers, run node --test cloud/verify-environment.test.mjs. Use Vite-aware validate-local-env.mjs for development/production/test; do not rely on a regex for the effective environment. Preserve base Playwright privacy/retry/device/server options. Report using docs/environment/QA_REPORT.md. Cloud draft review/publication is separate from editing this repository.
