# Issue 05 — Shared navigation implementation

Started 2026-10-29; checkpoint 2026-10-30 Asia/Bangkok. Branch feat/shared-navigation, baseline cleanmain fa88036. Only05; protect published01–04 and all original financial/identity/permission rules.

## Implemented

Shared Friends/Groups/Trips is the sole management chrome. Old mixedlist renderer removed after extracting its actual create_space form; no Space/membership/history/affiliation deletion. Travel keeps its original lightweight selection and personal-tag eligibility. Manage opens Shared Trips with validated Travel return; explicit Travel create opens the same typed form, returns Travel/newselection on confirmed success and preserves oldselection on Cancel. Shared create opens the new typed ledger; original name/currency/date/undecided rules retained. Shared generic bottom+ never silently selects a Trip; concrete Trip global+ and original authority remain.

Legacy /spaces and /travel/manage replace directly to canonical Shared; only actual old create/controlledreturn semantics preserved, unknown/type/ID/token parameters dropped. /legacy-spaces and /invite remain data-free canonical redirects; legacygroup goesGroups without guessing its ID; /embed safeHome unchanged. Real space-invite flow, password/guest/role commands remain original. Anonymous exit/lostaccess uses safeHome instead of a permanent-only Shared deadend. /friends keeps its existing URL/behavior.

One bounded actor/target/path/history-index navigation provenance service complements the existing Members/Dates/History helpers, preserving validated parent state during reconstruction. Source-specific Shared query/tab/filter/currency/review/scroll/focus, Travel selection/mode/density/scroll, and existing ledger drafts/batches/tabs stay separate. Back uses real-1 only for the proved predecessor; otherwise validatedreplace or authorizedtype fallback. DirectMembers/Dates still use sameTripoverview; directledger uses actualtype Sharedlist; directhistory usesledger. Storage corruption/blockedstorage, crossactor/Trip, malformed/external/self paths and repeated reload safely fall back. Restoration waits for actual data/layout; search does not take keyboard focus before a returning row is ready.

create_space has no request UUID: synchronous busy/pending-remount guard, current-session/actor/unmount fence and baseline/new-owned-Space response reconciliation avoid blind retry. Unconfirmed results block resubmission and direct the user to check the refreshed list. Late known completion refreshes metadata for the current owner without navigating a departed screen. No new database, RLS, financial engine, dependency or migration. Shared refresh now depends on stableledger.refresh; original whole-object dependency could restart reads indefinitely. Typedlist/switcher text now actually scales in rem; Friends/theme kept.

## Current verification (not a production completion claim)

Baseline817/119 PASS45.57s; current833/121 PASS84.52s under concurrentbrowserload; lint/TypeScript/productionPWAbuild PASS. Integrated63actualReact/CSS phonecases PASS2.1min (13navigation+14dates+13Members+14ledger+9split); latest16navigationcases PASS1.6min after cold-lazy/overlay/trigger-focus safeguards. Fourwidths320/360/390/430,125/150/200%roottext with actual28px text assertion, shortscreen, longChinese, menu/keyboard/Back/Forward, searchscrollfocus, create/cancel/unknown, generic+context, twoTrip andblockedstorage/reload covered using synthetic API fixtures. Approved/actual screenshots will be delivered separately; not production private or physical Honor captures.

Fresh hosted33migrations match; original date RPC body/version/ACL unchanged; noSQLneeded. ExistingVercelproject/team/main and GitHub push permission independently verified. Native isolated create/invite/login/guest/role/revoke/leave/10financialcounts test added to focused CI, notyetexecuted. Full exact-source CI/release/normalownedreadonly/PWA pending. LocalDocker BLOCKED byknownvfs limit, not retried; use disposableActions backend. PhysicalHonor/AndroidsystemBack/nativekeyboard/browserUIzoom/screenreader NOTRUN.

## Recovery

Read PROJECT_STATUS/WORK_LOG/currentdiff and /workspace/verification/issue05-shared-navigation-2026-10-29. Finish exactsource all8CI, existingPR/production and actualversion/normalownedreadonly/PWA verification. Never replay old SQL/Reset/productionfinancialfixtures. Report actual current outcomes, not historical success.

## Changed files

- `.github/workflows/quality.yml`
- `CONTEXT.md`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/adr/0007-primary-navigation-daily-insights-shared.md`
- `docs/issues/ISSUE05_SHARED_NAVIGATION_IMPLEMENTATION.md`
- `e2e/app.spec.ts`
- `e2e/fixtures/quickAdd.ts`
- `e2e/multiuser.spec.ts`
- `e2e/navigation.spec.ts`
- `e2e/person-detail.spec.ts`
- `e2e/phase5e.spec.ts`
- `e2e/production-phase3-smoke.spec.ts`
- `e2e/shared-navigation-backend.spec.ts`
- `e2e/shared-navigation-ui.spec.ts`
- `e2e/travel.spec.ts`
- `e2e/trip-period.spec.ts`
- `e2e/universal-quick-add.spec.ts`
- `playwright.production-ui.config.ts`
- `src/App.tsx`
- `src/components/shared/SharedComponents.tsx`
- `src/components/shared/SpaceCreateForm.test.tsx`
- `src/components/shared/SpaceCreateForm.tsx`
- `src/components/shared/shared-a.css`
- `src/components/travel/TravelUI.tsx`
- `src/components/travel/TripDetails.tsx`
- `src/components/travel/TripLedger.tsx`
- `src/components/travel/travel-components.css`
- `src/hooks/useHomeData.ts`
- `src/hooks/useSpaceSourceReturn.ts`
- `src/lib/i18n.ts`
- `src/lib/navigationStorage.ts`
- `src/lib/sharedAOrigin.test.ts`
- `src/lib/sharedAOrigin.ts`
- `src/lib/spaceNavigation.test.ts`
- `src/lib/spaceNavigation.ts`
- `src/lib/tripDatesNavigation.ts`
- `src/lib/tripLedgerNavigation.ts`
- `src/lib/tripMembersNavigation.ts`
- `src/pages/LegacySpacesRedirect.tsx`
- `src/pages/PersonalLedgerPage.tsx`
- `src/pages/SharedPage.tsx`
- `src/pages/SpaceInvitePage.tsx`
- `src/pages/SpaceMembersPage.tsx`
- `src/pages/SpacePage.tsx`
- `src/pages/SpacesPage.tsx`
- `src/pages/TripDatesPage.tsx`

First candidate59f1269 CI failed and was not released: source-parent preparation interfered with original QuickAdd overlay history and retained detail effects during navigation. Forward fix skips overlays, binds current browser/detail path and target, preserves actual inline/menu trigger focus, and adds held-module/QuickAdd-history browser witnesses. New native helper used an invalid id projection for composite-key financial tables; it now compares complete authorized rows with safe diagnostics. Original money/permission/version/assertions remain; no schema workaround. Final exact-source CI is required.
