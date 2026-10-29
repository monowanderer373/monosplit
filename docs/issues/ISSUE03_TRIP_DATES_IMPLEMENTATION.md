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
- PASS14 browser cases on real React/CSS production graph:320/360/390/430,125/150/200%roottext, short viewport, Chinese long names,44px days, keyboard, visualViewport inset, endpoint/year/leap/same-day/range/postponed, save/cancel/return/reload/role/version/unknown result and two browser timezones. Browser data is isolated synthetic fixtures, not backend verification.
- Native isolated backend and repository-wide CI pending: original five period journeys adapted, sixth real two-user conflict preserves ten financial tables per account after a real original expense, accepted settlement and cash legs.
- Physical Honor, Android system Back/native keyboard, actual browser UI zoom and screen reader NOT RUN. Root-text emulation and Chromium keyboard coverage are not physical-device evidence.
- Local Supabase blocked by previously evidenced Docker vfs storage; not retried. Disposable GitHub Actions runner is the supported backend validation route.
- Production not released for Issue03 yet. No new SQL installation needed.

## Evidence and recovery

Local evidence `/workspace/verification/issue03-trip-dates-2026-10-29`; synthetic screenshots `test-results/trip-dates`. Read PROJECT_STATUS/WORK_LOG/current diff before resuming. Preserve deployed33migration history; do not replay older SQL, reset production or introduce Issue04/05. Exact-source CI, PR/merge, existing Vercel READY/public SHA, normal owned-QA date checks and retained PWA update remain before completion.

## Component comparison

| Component | Approved reference applied | Necessary preservation/adaptation |
|---|---|---|
| Overview heading | Compact name/status; inline calendar/range/arrow; separate currency; no standalone edit/form gap | Existing spending-card map texture, member component and global+ retained; no Issue04 redesign |
| Date editor | Paper page, blue endpoint summaries, single range calendar, hint/postponed option, fixed Save | Native accessible checkbox,44px date targets; narrow/large-text summaries stack |
| Calendar controls | Blue circles and pale continuous range, previous/next and month/year entry | Supports year0001–9999 and actual locales rather than fixed reference month |
| Errors/navigation | Reviewed-date save and cancel/back | Real PostgREST conflict normalization, explicit latest load, ambiguous-save readback, actor/Trip-bound restoration |

Synthetic actual-component screenshots and approved board are in the external delivery gallery. No design-board image is used as production UI or data. Physical-device validation is not implied.

## Initial failures and corrections

First native run rejected390px200%-text endpoint layout and the two-user conflict message. Fixed intrinsic rem-based endpoint columns and date-editor-local extraction of actual PostgREST message objects; no global error behavior or original financial/version assertion was changed. Subsequent exact-source CI is required before release.

## Modified files

- `.github/workflows/quality.yml`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/issues/ISSUE03_TRIP_DATES_IMPLEMENTATION.md`
- `e2e/fixtures/tripDates.ts`
- `e2e/trip-dates-ui.spec.ts`
- `e2e/trip-period.spec.ts`
- `playwright.production-ui.config.ts`
- `src/App.tsx`
- `src/components/AppShell.tsx`
- `src/components/travel/TravelUI.test.tsx`
- `src/components/travel/TripDateEntry.tsx`
- `src/components/travel/TripDetails.tsx`
- `src/components/travel/TripPeriodEditor.test.tsx`
- `src/components/travel/TripPeriodEditor.tsx`
- `src/components/travel/TripRangeCalendar.test.tsx`
- `src/components/travel/TripRangeCalendar.tsx`
- `src/components/travel/trip-dates.css`
- `src/components/travel/trip-period.css`
- `src/hooks/useHomeData.ts`
- `src/hooks/useTripDatesReturn.ts`
- `src/hooks/useTripPeriodEditor.ts`
- `src/lib/i18n.ts`
- `src/lib/tripCalendar.test.ts`
- `src/lib/tripCalendar.ts`
- `src/lib/tripDatesEvents.ts`
- `src/lib/tripDatesNavigation.test.ts`
- `src/lib/tripDatesNavigation.ts`
- `src/lib/tripDatesTranslations.ts`
- `src/pages/PersonalLedgerPage.tsx`
- `src/pages/SharedPage.tsx`
- `src/pages/SpacePage.tsx`
- `src/pages/SpacesPage.tsx`
- `src/pages/TripDatesPage.tsx`
