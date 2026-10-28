# Issue 01 — dedicated Trip Members

Status: implemented, published and verified on 2026-10-28 (Asia/Bangkok).
PR40 merged main6696d6b28ba4b776f567f42cca43d3d393a6d47c; entire tree equals
validated source6ac0a1d. Baseline main908d7e8, initially clean. Package README,
all specifications/checklists/decisions and design board read; all eight manifest
SHA-256 values verified.
Only Issue01 is implemented. No Issue02friendship or split changes, Issue03date
entry changes, Issue04ledger cleanup or Issue05mixed-list removal. Existing
Group controls/routes, expense author/member maps, financial principals,
integer currency, RLS, correction/settlement procedures and historical facts
remain. No migration or new production dataset is required.

## Implementation

- Lazy /space/:spaceId/members in the existing AppShell. Scoped matte paper
  list, stable Participant IDs, own/Owner/account/manual ordering, explicit
  roles, no emails/wallets/friend placeholders. The existing bottom navigation
  highlights Shared; global + waits for current valid writable Trip authority.
- Original get/listMembers authorization and invite/manual/role/remove services.
  Snapshot uses active membership, validates the current principal and role,
  isolates identity/Trip/request generations and clears failed/lost access.
  Focus/visibility/realtime and same-app changes invalidate the page/preview.
  Participant lookup failures propagate as read errors instead of fake zero.
- Owner invitation is explicit, has original full/view access, truthfully
  reports clipboard failure with a manual-copy field, and never generates a
  token on open/Cancel. After successful clipboard copy the token is not redundantly left in DOM;
  manual-copy UI appears only for actual failure. Role and manual actions keep
  original authorization.
  Remove/Leave has history-preserving confirmation, synchronous duplicate
  dispatch protection, fresh authority checks and authoritative reload.
- Trip overview full card, summary count, menu and ledger header use one route.
  Trip's duplicate management/list/invite UI is removed; Group branch retained.
  Trip legacy section=members replaces to the new route; section=info remains.
- Same-identity/same-Trip source provenance validates history Back. Direct/reload
  visits without provenance seed a same-Trip overview history entry; no arbitrary
  from URL or unconditional navigate(-1). Existing route scroll state restores
  source positions, including section=info without re-scrolling over it.

## Verification results

| Check | Current result |
|---|---|
| npm test | PASS:743 tests/108 files (baseline732/105) |
| npm run lint | PASS |
| npm run build (TypeScript/Vite/PWA) | PASS |
| Focused actual-React synthetic UI | PASS:13 cases, no RLS claim |
| Exact-source Quality40673167461 | SUCCESS:all seven jobs |
| Complete authenticated browser | PASS:384 |
| Production-module UI | PASS:226 |
| SQL/strict lint/concurrency | PASS:974 assertions/21 files and native concurrency |
| Historical database upgrades | PASS |
| CollectPay browser | PASS:10 |
| Travel browser | SUCCESS:15 passed +1 flaky; first768px Travel-button click timed out, retry passed |
| Hosted schema/source baseline | PASS:32 migrations/four original membership RPC bodies match |
| Local Supabase | BLOCKED:known Docker vfs capacity limit; not retried |
| Physical Honor/native Android Back/OS keyboard/browser UI zoom/screenreader | NOT RUN |

CI: https://github.com/monowanderer373/monosplit/actions/runs/40673167461
The new isolated real-backend case creates two ordinary accounts without a friend
relationship, joins via view invite, checks backend denial, changes role through
real UI, adds manual members and preserves duplicate names. It records an expense
and an accepted native settlement through original two-party cash authorization,
then removes/leaves through the original services. Nine financial/history tables
and the immutable participant survive unchanged; counts and revoked UI revalidate.
Existing multiuser helpers now use the migrated controls; all original debt,
version, settlement and RLS assertions remain.

Thirteen focused UI cases use actual React/CSS with synthetic API interception:
320/360/390/430,125/150/200%root text,long names/Trip,Chinese,44px targets,
menu Escape/focus restoration,invite roles/clipboard failure,manual restrictions,
loading/error/empty/revoked states,all overview/ledger entries,legacy and Group
fallback,source scroll/deep-link/reload/Back and current-Trip global + including
trailing slash while authority loads. They are not native-device or RLS proof.
Initial browser failures exposed an unconstrained300px SVG outside Travel's CSS
namespace and direct-route dialog stacking; both were corrected with scoped CSS,
without clipping, shrinking, forced clicks or relaxed assertions. Earlier native
fixture contract failures and current retry are recorded in WORK_LOG.

## Production verification

PR: https://github.com/monowanderer373/monosplit/pull/40 (MERGED).
Application commit:6696d6b28ba4b776f567f42cca43d3d393a6d47c on main.
Existing team/project:monowanderer373s-projects/tabby-tally.
Native deployment:dpl_HFhVuB2DaU9RUtvzyrxudqUyvvs2,READY.
Deployment URL:https://tabby-tally-cf7v04cnm-monowanderer373s-projects.vercel.app/
Canonical live:https://tabby-tally-monowanderer373s-projects.vercel.app/
Public entry:index-C5SK4NXI.js contains exact main SHA; Members JS/CSS are in
precache. No migration, new project, schema installation or customer-account
operation is required.

Normal tagged-owned QA accounts with real production Auth/API (no interception):
owner/viewer roster and roles/order,owner controls/viewer restrictions,current
Trip+/return,identity-switch isolation,eight320/360/390/430 ×100/200%roottext
cases and Invite/Remove/Leave review+Cancel PASS. Only an empty owned QA Trip and
its view invitation membership were created/reconciled; retained private metadata
prevents duplicate setup after interruption. No customer membership, financial
write, production Reset or private screenshot. Ten financial-table hashes per
QA account are unchanged; no UI mutation RPC/runtime error.

Retained PWA updated through native registration with caches preserved. Current
entry and Members JS/CSS/Home/Records/Accounts/Shared/Profile cached;worker active.
Five paper-material hashes and four offline Home/QuickAdd assets equal source.
Four-width signed-out Members guard and offline shell PASS. These checks do not
claim physical-phone/system-font/OS-IME/browser-UI-zoom validation.

Safe synthetic application captures plus approved reference: external
/workspace/verification/issue01-members-2026-10-28/delivery/index.html.
This final documentation-only checkpoint follows the verified application release.
Its final native READY/publicSHA/current-PWA proof is recorded externally in
/workspace/verification/issue01-members-2026-10-28/delivery-final.json; do not
recursively edit this report to include its own commit. No remaining manual step.
Issue02–05 remain unimplemented.

## Modified files

- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/issues/ISSUE01_MEMBERS_IMPLEMENTATION.md`
- `e2e/fixtures/localSupabase.ts`
- `e2e/multiuser.spec.ts`
- `e2e/travel.spec.ts`
- `e2e/trip-members-backend.spec.ts`
- `e2e/trip-members-ui.spec.ts`
- `playwright.production-ui.config.ts`
- `src/App.tsx`
- `src/components/AppShell.tsx`
- `src/components/travel/TripDetails.tsx`
- `src/components/travel/travel-integration.css`
- `src/components/travel/trip-members.css`
- `src/hooks/useTravelMembers.test.tsx`
- `src/hooks/useTravelMembers.ts`
- `src/hooks/useTripMembership.test.tsx`
- `src/hooks/useTripMembership.ts`
- `src/lib/moneyContext.test.ts`
- `src/lib/moneyContext.ts`
- `src/lib/spaceRepository.ts`
- `src/lib/travelTranslations.ts`
- `src/lib/tripMembers.test.ts`
- `src/lib/tripMembers.ts`
- `src/lib/tripMembersNavigation.test.ts`
- `src/lib/tripMembersNavigation.ts`
- `src/pages/PersonalLedgerPage.tsx`
- `src/pages/SpaceMembersPage.tsx`
- `src/pages/SpacePage.tsx`
