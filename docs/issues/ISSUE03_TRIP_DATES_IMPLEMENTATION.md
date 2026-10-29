# Issue 03 — Trip dates implementation

2026-10-29 Asia/Bangkok. In progress on `feat/trip-dates-page`; baseline latest main `02cac4a6496b1250022d785e135a61aa556b16cd`. Only Issue03; no Issue04/05.

## Requirements and implementation

Complete package README, execution prompt, specification, integration notes, acceptance checklist and decisions read; approved board reviewed and all nine manifest hashes matched. Latest repository/services take precedence over historical package commit.

- Compact Trip overview: name/status, inline clickable calendar/date range, separate currency. Removed standalone Edit trip dates and duplicated inline editor. Trip info points to the same dedicated page. View members see plain dates.
- Lazy `/travel/trip/:tripId/dates`: one continuous calendar, explicit Start/End reselection, same-day ranges, no reversed/half persistence, Dates not decided yet. Local postponed toggles retain selected dates; only explicit Save persists null/null. Original creation fields remain.
- Date-only ISO selection supports year0001–9999, leap/month/year boundaries, arbitrary month/year jump, localized labels and keyboard navigation. Never swaps reversed endpoints or derives persisted days through browser timezone.
- Original `update_space` only: fresh role/version read, original reviewed name/currency/version, no version overwrite. Conflict retains draft/month until explicit latest load. Network/transport unknown outcomes reconcile against authoritative data; no blind replay. Duplicate clicks, stale Trip/identity responses and late navigation fenced.
- Same-Trip trusted return, direct/reload fallback, scroll/focus restoration, native Back and unavailable Shared Trips fallback. Only date route hides global+; other Trip/Members navigation retained. Real reads refresh after successful date metadata changes.
- No schema, RLS, dependency, financial formula, expense/correction/settlement/history/membership change. Dates do not filter historical records or archive/close Trips. Group, personal affiliations and original Trip creation remain intact.

## Current validation

- PASS baseline764units/112files. Current798units/115files, lint and TypeScript.
- PASS12 browser cases on real React/CSS production graph:320/360/390/430,125/150/200%roottext, short viewport, Chinese long names,44px days, keyboard, visualViewport inset, endpoint/year/leap/same-day/range/postponed, save/cancel/return/reload/role/version/unknown result and two browser timezones. Browser data is isolated synthetic fixtures, not backend verification.
- Native isolated backend and repository-wide CI pending: original five period journeys adapted, sixth real two-user conflict preserves ten financial tables per account after a real original expense, accepted settlement and cash legs.
- Physical Honor, Android system Back/native keyboard, actual browser UI zoom and screen reader NOT RUN. Root-text emulation and Chromium keyboard coverage are not physical-device evidence.
- Local Supabase blocked by previously evidenced Docker vfs storage; not retried. Disposable GitHub Actions runner is the supported backend validation route.
- Production not released for Issue03 yet. No new SQL installation needed.

## Evidence and recovery

Local evidence `/workspace/verification/issue03-trip-dates-2026-10-29`; synthetic screenshots `test-results/trip-dates`. Read PROJECT_STATUS/WORK_LOG/current diff before resuming. Preserve deployed33migration history; do not replay older SQL, reset production or introduce Issue04/05. Exact-source CI, PR/merge, existing Vercel READY/public SHA, normal owned-QA date checks and retained PWA update remain before completion.
