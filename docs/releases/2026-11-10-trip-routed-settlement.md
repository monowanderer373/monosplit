# Trip multi-recipient routed settlement — implementation and verification

Status: **production verified on 2026-11-11 (Asia/Bangkok)**. Repository
`monowanderer373/monosplit`, PR [60](https://github.com/monowanderer373/monosplit/pull/60)
merged as applicationmain `fa1058889dfe860d1c8bf86ed848b9ee8a844cc8`.
Its full tree equals validated head `960c62546fe9fc55efd254f7826e58d22ec9a0dd`.
Pending batch PR58 is included and automatically marked merged; the published
account/currency fixes remain. A documentation-only completion revision follows.

## Implemented behavior

- Trip → Settle up → More options → Pay final recipients directly opens a
  route-backed full page, with existing Matte Paper, safe areas, native Back,
  focus restoration, 250ms transition/reduced motion and keyboard viewport sizing.
- Avatar/name recipient switches, initial/failing-image fallback, actual cash
  amount/currency/direction as solid arrows; intermediary paths expand on demand.
  Remaining debts and coverage use original MYR/VND amounts. Preview and historical
  as-of balances are explicitly labelled; a reversed diagram says reversed.
- Actual VND cash and MYR transfer are separate tender rows; an untransferred MYR
  amount is never recorded. System/custom rates use the original rational rounding;
  changing rate/input invalidates Review. Native precision mismatches block affected
  rows rather than silently changing original obligations.
- Every draft row must have its author as actual payer or actual recipient. Trip
  ownership does not authorize recording unrelated cash. All actual parties and
  intermediaries explicitly approve. Each actual party chooses their own compatible
  account; an intermediary needs no account and receives no artificial cash entry.
  Explicit account creation retains the proposal and never approves/posts payment.
- All intermediary capacities are reserved across the whole sheet before direct
  debt. Shared upstream and downstream limits identify every affected row.
- Preview is read-only. Submission creates a private pending proposal/receipt with
  no cash, coverage or holds. The last approval locks/recalculates through the
  original financial writer exclusion boundary and posts all real cash, original
  debt coverage and history in one transaction. Any posting exception rolls back
  the final approval and every financial fact.
- Same actor/request replays the original proposal; changed content conflicts.
  Unknown responses retain an exact in-memory frozen attempt and only an opaque
  actor/Trip-scoped UUID in sessionStorage. Reload queries the authoritative receipt;
  explicit retirement fences a delayed original before a new review is permitted.
- Cancel/decline/stale/expiry post no funds. Whole reversal uses original receipts,
  stored native amounts and the frozen rate, with current authority and later
  dependency checks. A pure intermediary cannot reverse other people's cash.
  Existing legacy APIs reject reversal of one routed cash or coverage leg.
- Private account IDs, source expense IDs/revisions and approval internals stay on
  the server. Only involved current Trip members can read/decide a proposal. Private
  tables have RLS and no browser table grants; helper execution is denied.

The original single-currency/direct, batch, Mixed FX, expense editor, expense
history and account APIs remain. The new routed path accepts account-backed current
members and original MYR/VND; manual parties or other currencies continue using the
existing supported settlement flow. No proxy authority or historical repair is invented.

## Code and schema

- UI: `TripRoutedSettlement`, `RoutedSettlementMap`, `RoutedSettlementList`, scoped
  `trip-routed-settlement.css`; integration in `SettlementPanel`/pair route state.
- Services: `routedSettlement.ts`; reference allocation core has contract tests and
  is used by synthetic test fixtures, never as a server authority or production fallback.
- New migration: `202611100001_trip_routed_settlement.sql` (three private audit tables,
  seven private helpers, five authenticated RPCs). Existing journal/settlement facts
  are reused; canonical expenses are not rewritten.
- Forward migration `202611100002_routed_native_balance_projection.sql` projects each
  directional native balance once from frozen original balances minus exact coverage.
  It also keeps invalid shared-cap previews readable. It does not change posting,
  drafts, receipts or historical facts; distributed001 remains byte-identical.
- Previously pending prerequisite migrations: `202611050001` and `202611050002`.
- Complete installer: [trip-routed-production-apply.sql](../runbooks/trip-routed-production-apply.sql),
  **132,260 bytes**, SHA256
  `f38a4629cfb1897ed2e76f65f6ea0da4ba26095ad9917a7f12df37ffc4ec999e`.
  Contains exact canonical batch001+002+routed001+002 payloads and 24 final function
  fingerprints/ACL/RLS guards. Accepts no batch, original001-only, full batch and
  routed001-only upgrade and complete replay. Installs capabilities only; no payment, confirmation,
  reversal, balance edit, expense edit or Reset.
- Installer marker: `TABBY_TRIP_ROUTED_INSTALL_COMPLETE_20261110_V2`.
- Reproducible read-only audit: `scripts/verify-trip-routed-production.py` accepts
  only a disposable loopback DB for local tests or the existing project via the secure
  Management API binding. It reads schema metadata, never customer financial rows.

## Actual verification

- Package README/PRODUCT/INTEGRATION/QA read; `preview/index.html` opened over local
  HTTP; **15/15** supplied Node24 reference tests passed.
- Local official PostgreSQL17 with minimal auth fixtures: all migrations applied;
  original 26 SQL files initially 1,273 assertions passed, with routed assertions
  subsequently expanded from 42 to **67**, all passed. Final67 include dual recipients,
  upstream/downstream shared caps, actual cash, no via cash, Dav-only/Alex-pending,
  MYR/VND mixed and untransferred MYR, precision bounds, transaction failure rollback,
  replay, stale/expiry, cancel/decline, permissions and whole/dependent reversal.
- New separate-session races passed: routed/routed, legacy/routed, batch/routed,
  reverse legacy-first ordering, same-request overlap/content conflict, committed
  recovery and retirement fencing. All eight original concurrency suites also
  passed locally (temporary copies changed only their disposable loopback DSN guard;
  hosted CI runs originals unchanged).
- Strict application-schema lint passed for public/private/tabby_fx. Local default
  lint reports an official http extension `http_headers` vendor warning; that vendor
  function was not changed. Hosted full Supabase lint passed on candidate2ca817a.
- Complete installer replay and read-only audit: **24/24 function bodies and
  24/24 function ACLs match**, all required private table restrictions/financial RLS
  and exact migration versions pass on the isolated database. Hosted historical
  job2ca817a passed no-batch, original001-only and complete repeated upgrade probes.
- Local **49/49** routed + existing single/batch mobile regression passed (90s),
  followed by **12/12** final routed cases (37.6s) adding long names, both currency
  labels and reduced motion. 320/390 portrait, 420px keyboard viewport and 200% root
  type are browser simulations, not physical-device or OS keyboard evidence.
- Full unit suite, lint, explicit TypeScript and production/PWA build were run;
  final updated totals and exact-head eight-job CI are recorded in the completion
  checkpoint below. Native five-user routed SDK/browser journey passed on2ca817a:
  actual -500,000/+400,000/+100,000 VND journals, no intermediary account, outside
  observer denied, all parties consent, whole reversal and unchanged expenses.
- An additional real PostgreSQL boundary probe reproduced duplicate displayed native
  balances when the same sheet both pays and receives through opposite orientations.
  No duplicate money was posted. Red/green assertions now cover one exact remaining
  balance; the forward002 projection also fixes null remaining JSON on invalid
  shared-cap previews. Native browser tests explicitly exercise shared-cap rejection
  before the valid dual-recipient flow. V2 upgrade/replay passes locally.
- Initial hosted failures are retained: typed SQL literal/SET lint and a parser
  typo were corrected, footer overflow fixed; test-only failures were a recovery
  assertion before network arrival and a legacy mutation audit misclassifying the
  new read RPC. Original financial assertions and timeouts remain.

## Production release and environment limits

The user installed final V2. Independent metadata reads verified all41migration
versions,24/24canonical function bodies,24/24function privileges, required
financial RLS and private table restrictions. The SQL connection is still
`supabase_read_only_user`; no schema writer or production financial tests were used.

Both pending batch202611050001+002 and routed202611100001+002 are now installed.
No payment, confirmation, reversal, balance adjustment, expense change or Reset was
executed by the installer or production verification. No further SQL installation
or user approval is needed for this release.

Existing Vercel project `tabby-tally` production deployment
`dpl_DrKBoX4cbFnfY98QKGwfRJVZakWn` is READY at exact applicationmainfa1058889.
[Open application](https://tabby-tally-monowanderer373s-projects.vercel.app/).
Public verification checked the exact served SHA and102precache JS/CSS assets,
all5new RPC bindings, batch Mixed FX, account/currency guidance, fullscreen QuickAdd
and preserved MYR/VND left alignment. Public320/390/430px shell had no horizontal
overflow or runtime errors; the clean public profile remained unauthenticated.

Retained PWA was warmed on actual old478before merge. First normal update cached
and activated new resources but kept the old document until a timeout. The unchanged
normal close/reopen cycle then loaded the exact current entry and5module assets,
all cached and controlled. No static cache was manually deleted. A final
provider/public/PWA check records the documentation-only completion revision in the
delivery manifest; application and migrations are unchanged.

Physical Honor Magic7Pro, OS keyboard/safe areas/font scaling and customer account
settlements were not tested. Isolated authenticated Supabase tests cover financial
behavior; public production verification covers publication and PWA delivery.

## Completion checkpoint

Validated source **9e869f8835803beaa1783bd2fc17d371d43bdb63**:
[Quality42827393350](https://github.com/monowanderer373/monosplit/actions/runs/42827393350),
**all eight jobs succeeded**. A documentation-only completion commit follows;
application, tests, scripts and migrations remain identical to this validated source.

| Check | Actual result |
|---|---|
| Package reference tests |15 passed|
| Unit tests |910 /129 files passed|
| ESLint / TypeScript / production PWA build |Passed|
| Strict full Supabase database lint |Passed|
| Original pgTAP files, fresh hosted database |1298 /26 files passed; routed67 included|
| Original + routed real-session concurrency |All passed; routed/legacy/batch overlap, nonce replay and retirement fence included|
| Historical installer |Fresh, batch001-only, full batch, routed001-only forward upgrade and full replay passed|
| Production-module mobile UI |383 passed,0flaky/skipped/unexpected|
| Full browser suite |550 passed,0flaky/skipped/unexpected|
| Real authenticated Trip multi-user browser |16 passed,0flaky/skipped/unexpected|
| Travel / CollectPay browser |17 /10 passed|
| Focused local mobile |49 old-single/batch/routed passed; final routed12 passed|
| Final metadata audit on isolated database |24/24function bodies and ACLs; exact versions/private grants/RLS passed|

The last local26-file rerun initially found old zero-count assertions counting
committed concurrency-fixture facts. Failures were retained. Replaying the original
bodies with a clean auth/financial fixture baseline inside each test's existing
transaction and rollback passed1298/26, with committed QA user/payment/journal counts
unchanged. The hosted fresh-database run passed original files unchanged. No
financial assertions or timeouts were weakened.

Safe gallery: `/workspace/artifacts/trip-routed-settlement/index.html`;
11original PNGs: four real isolated Supabase/browser captures and seven compiled
application/controlled-interface captures. The intermediary native screenshot uses
the Pixel7 default412x839 viewport; other native captures use390x844. Filename
suffixes are identifiers, not physical device claims. Original CI immediate frames
are retained; a separate two-party approval/reversal layout probe verifies the full
390x844 terminal header/body/footer and zero outer scroll.

**Released** after user installation and independent schema verification. PR60 and
included PR58 are merged. No customer financial tests or production data cleanup
were performed. Delivery `/workspace/artifacts/trip-routed-settlement` contains the
schema, CI, provider/public/PWA proofs and11original mobile screenshots. The latest
served documentation revision is captured in its `verification.json`.
