# Notifications A FINAL — production release, 2026-10-15

Notifications A is implemented in the existing Tabby Tally application and verified on production with normal owned QA accounts. No customer ledger was used. No database migration, dependency, financial model or RLS change was required.

## Git and deployment evidence

- PR [22](https://github.com/monowanderer373/monosplit/pull/22), MERGED.
- Validated feature: `7d9569fd30c73280cbecc5190bf521c1de3a5827`, branch `feat/notifications-a-final`.
- Application main: `5e3db1e47062801de22b5e8538267083c9c095cb`; feature/main exact tree diff empty.
- Existing project/team: `tabby-tally` / `monowanderer373s-projects`.
- Application deployment READY: `dpl_5DwYrQngjosAT5fUXZAWfzo5FdRS`.
- Production: https://tabby-tally-monowanderer373s-projects.vercel.app/ . Actual public `index-DwPSCMw2.js` contains the complete application main SHA; Records `SpendingRecordsPage-2OFrsBjP.js` is precached.
- Exact PR Quality [38725132210](https://github.com/monowanderer373/monosplit/actions/runs/38725132210) and main Quality [38726439510](https://github.com/monowanderer373/monosplit/actions/runs/38726439510): all six jobs SUCCESS.

A documentation-only checkpoint follows these application checks. It does not change runtime/test/database files. Final current deployment/SHA/PWA and a readonly normal-login smoke are read back separately in the delivered `final-release-evidence.json`; this avoids recursive documentation-only releases.

## Implemented behavior

[Source → exact destination → original action map](../notifications/NOTIFICATIONS_A_FINAL_2026-10-15.md).

- Compact notification rows show actual record title + short action and same-flow date/account/context. No visible reference, UUID or redundant row CTA. Long text grows naturally.
- A1/A2/A3/A4/A10 use centered accessible dialogs without a bottom-sheet handle or nested account sheet. A5/A6/A7/A11 open exact object pages; A8/A9 reuse, focus and outline the original Collect/Pay entity.
- Funding uses authoritative accepted payer contribution, never bill total or consumption share. Unknown/foreign actual amounts start empty. Account currency changes clear/revalidate inputs; uncertain manual drafts and matching idempotent attempts are retained.
- A3/A4 retain original versioned occurrence-only edits, original date/principal/nullable overrides, fresh version/account checks and original post/retry. Old rescheduled retry is removed; fresh due-version review is explicit. Posting reasons use localized original normalized error enums.
- Original Direct review and full change history graph remain. Own approval can await others. Decline preserves the original active record; cancellation is conditional on all required approvals.
- Receipt confirmation requires real arrival and the original receiving account/cash service; original Decline is retained. Payment request navigation never transfers money. Request forms use the exact request amount. Missing payer cash authorization resumes the existing payment/allocation instead of proposing another payment.
- Outbox reconciles the original request before retry, retains uncertain outcomes and never offers false Undo of committed history.
- Exact account page loads normal-RLS entries. Negative balances are informational, not blocked debits. Only supported active-asset filters link to records. Extreme amount/text combinations stack entries instead of squeezing descriptions to zero width.
- Current S1–S7 authority, identity/target continuation guards, normal SDK JWT, permissions, versions and idempotency are preserved. Read refresh cannot invalidate its own versioned edit/post sequence. Navigation/reconciliation are distinct from financial completion.
- Per-identity one-shot origin restores tab/list/page scroll/focus; Accounts recovery returns to its typed task. Conceal covers DOM/ARIA/inputs/live regions; notification details require explicit reveal before mounting the original editor/history.

Home/Insights/Paper Receipt/QuickAdd/Trip/ordinary CollectPay remain on their existing architecture and theme. Actual fonts/icons and necessary account/approval/receipt information are retained; card height can differ from illustrative art. Reference amounts/dates/bank branding never become production fallback. The reference Not received wording is intentionally the supported original Decline action.

## Current tests

| Check | Result | Evidence |
| --- | --- | --- |
| Unit tests | PASS |604 tests/91 files on current source locally and exact CI |
| ESLint, TypeScript, production PWA build | PASS |current relevant checks and exact CI app job |
| Isolated database | PASS |742 pgTAP/18 files, lint, concurrency and historical upgrade; existing disposable CI |
| Full application browser | PASS |exact PR and main job terminal SUCCESS; includes real isolated backend notification journeys |
| Collect/Pay regression | PASS |10 cases, final exact CI |
| Travel/QuickAdd/Trip period | PASS |16 cases, final exact CI |
| Actual application UI matrix | PASS |76-case local run, zero retries/skips;21 task/details/state surfaces,16 list and24 task width/root-font combinations, desktop, typed same-name navigation/focus, outbox response-lost reconciliation |
| Final scoped regressions | PASS |posting reason2/2, details conceal/editor1/1, account layout + strengthened large-value2/2, stable final capture1/1 |
| Local production-build offline PWA | PASS |1/1 |
| Package reference/asset checks | PASS supplemental |57 reference checks;92 PNG and106 SVG validation; not application/backend evidence |
| Local Supabase | BLOCKED |known Docker vfs capacity; no blind retry, pull, prune or shared reset; real backend checks ran in disposable CI |
| Physical Honor/OS keyboard/system fonts/browser UI zoom | NOT RUN |CSS viewport/root-font/touch/keyboard-height/safe-inset simulations are explicitly separate |

Widths320/360/390/430 plus desktop and125/150/200% root text were exercised with long names, maximum safe amounts, privacy, empty/loading/error/login states, inline account choices, modal/page presentation and return behavior. Stronger screenshot review caught and fixed unreadable account-entry width even though page overflow was absent; the regression failed before the fix and passed after it. Exact CI full-browser artifact retrieval returned Forbidden, so detailed per-case retry/skip statistics were not independently downloaded; no zero-retry claim is made for that CI job.

## Normal authenticated production verification

Six stages PASS, no API response interception, controlled QA only, zero browser runtime errors:

1. **Funding/private account:** exact login intent restored; real client offline retained task/Retry; same-currency MYR1.25 and original VND90,000 with explicit actual MYR12.34 each produced one private journal despite double click. Canonical expense amount/currency/version/status stayed unchanged. Conceal and explicit details/editor reveal passed. Normal controlled wallet income resolved negative to positive12.50 and removed the warning.
2. **Shared review:** exact full page, original explicit response once, authoritative accepted participation and removal of pending task.
3. **Incoming receipt:** original exact Collect/Pay article focused, explicit receiving account/arrival confirmation; allocation accepted and payment confirmed; one150-minor posted cash leg for each actor.
4. **Payment request/privacy:** exact request focused; navigation produced zero financial writes and request intentionally remains open. Conceal passed; another identity could not view the private funding target or its cached title.
5. **Correction:** exact full page showed actual bill3.00→4.00 and own share1.50→2.00 with original-active condition; original versioned Decline once; request declined, canonical original unchanged, notification origin restored.
6. **Cancellation:** exact full page showed conditional removal; original Decline once; request declined, canonical original unchanged, origin restored.

Before release, normal read-only production QA additionally verified the actual account-entry relation, non-owner RLS denial and recurring/installment source column contracts. Live automated harnesses were adjusted to close the correctly restored notification popup before operating underlying Home controls and to compare absolute URLs. Interrupted runs resumed existing request checkpoints; completed financial operations were not reseeded or replayed.

Production recurring/installment payment writes and an actual production outbox response-loss event were not manufactured for this release. Their application/source contracts and original backend actions are covered in isolated tests; they are not claimed as production or physical-device exercises.

## Retained PWA and evidence

The retained old-profile worker automatically uses the new application entry, caches the new Records chunk and has all five stable paper/denim/icon material SHA256 hashes equal to source. No static cache clearing or TLS bypass. Public private-route guards passed at320/360/390/430 and the updated Records shell restored offline. QA sessions/auth state were cleared afterward.

Comparison gallery: `/workspace/verification/notifications-a/comparison/index.html`, six approved/native-vs-actual comparison PNGs,63 native parts, responsive application screenshots and separately labeled normal production QA screenshots. Delivery allowlists images, HTML and aggregate evidence/report files; excludes credentials, private principal/request checkpoints, auth logs, browser profile, invite tokens and signed artifact URLs.

No outstanding feature platform blocker or user action. Device/production branch coverage limits above remain explicit.
