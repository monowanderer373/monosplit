# Insights / Spending records — verified rollout checkpoint

Date: 2026-10-13, Asia/Kuala_Lumpur.

## Code and runtime

- PR #10: https://github.com/monowanderer373/monosplit/pull/10 (merged).
- Feature commit: 3ec01082d4b6e923f15f9729f4ffc879ac2f89dc.
- Main merge / application release commit: 3f7618580344fa0acacb0d4f22c97751c1f17db9.
- Existing production alias: https://tabby-tally-monowanderer373s-projects.vercel.app/ . Actual served entry `/assets/index-B28dhv70.js` contains the exact merge SHA; lazy `/assets/SpendingRecordsPage-CcgfKwAE.js` is served. The production service worker precaches Records and Insights icons.
- This is the existing app, not a demo. No migration, dependency upgrade or new finance service was introduced.

## Actual checks

- Local Vitest: 519 tests / 77 files passed. ESLint (no warnings), TypeScript/Vite production/PWA build and diff check passed.
- PR Quality: https://github.com/monowanderer373/monosplit/actions/runs/38288083611 — all six jobs succeeded.
- Main Quality: https://github.com/monowanderer373/monosplit/actions/runs/38289066229 — all six jobs succeeded.
- PR result artifact: 71 full browser outcomes: 70 expected/first-run passes, 1 flaky existing signup/manifest QuickAdd journey passed on retry; zero unexpected failures/skips. The retry was a 5-second `home-header` login readiness assertion, not a new financial assertion failure. All nine new intercepted-API Insights UI checks and the new real-local-Supabase own-share/RLS journey passed first run.
- pgTAP: 16 files / 723 assertions passed. Database lint, historical upgrade and concurrency job succeeded. Dedicated CollectPay: 10 passed; Travel/QuickAdd/Trip period: 16 passed.
- Browser checks exercise 320/360/390/430/1024, year draft/keyboard/escape/focus/outside, all three panels/popovers, complete count and own shares, progressive rows/original editor/back scroll, empty/error/conceal, long values, Chinese and actual 200% text.

## Screenshots and evidence boundaries

Implementation screenshots are rendered app UI with explicitly fictional test-created API responses, not design PNGs/JSON, and never production fallback. Local `test-results/insights-ui/` and the full-browser-results CI artifact contain Categories/Trend/Ranking/Records, popovers, 200%/long text and error/empty/conceal evidence. The new independent backend journey really created Personal/confirmed Direct records on disposable Supabase, reconciled own-share totals and checked a foreign account cannot read a private expense. Do not describe intercepted screenshots as production financial data or standalone RLS proof.

Actual production browser checks used no account credentials and no fabricated app/API responses. Verified signed-out Records access guards at 320/360/390/430, no overflow, updated offline Records shell. An isolated browser initially had a stale cloud-proxy CA; configured the platform's supplied public CA in that test profile, constrained to the production hostname, retaining TLS verification. Old installed PWA first served `index-BBEEDsub.js`; after waiting for new worker activation it served `index-B28dhv70.js`, with Records cached. This upgrade was checked on the same retained browser profile.

## Remaining external connections / unverified scope

- Vercel management API returns missing authentication token. No VERCEL_TOKEN was present. GitHub Vercel status/deployment metadata has not yet reported the merge; last returned production object remains historical 2041f71. Therefore no current Vercel deployment ID / management terminal-state claim is made, despite the verified production runtime containing 3f76185.
- Supabase management token absent: current remote migration history not independently read. Old HANDOFF/CONTEXT undeployed statements are not treated as current. No production DB changes were made.
- Secure requirements VERCEL_TOKEN → api.vercel.com and SUPABASE_ACCESS_TOKEN → api.supabase.com saved in environment settings. Enter values there, not chat. Use `python3 scripts/Verify-InsightsConnections.py` to read deployment metadata and migration history; missing-binding path verified, connected path requires the bindings.
- Local Docker vfs/32 GB image extraction remains unsuitable for local PostgreSQL. Real backend evidence came from CI, not that blocked local stack.
- Private production-account writes and physical phone/OS keyboard/safe-area behavior remain unverified. CI/emulation/public checks do not establish those.

Full live acceptance remains open for the missing deployment-management evidence. Resume from the existing main implementation; do not redo the feature or deploy migrations based on stale history.
