# Trip multi-recipient routed settlement — implementation and verification

Status: candidate, not deployed. Repository `monowanderer373/monosplit`, branch
`feat/trip-routed-settlement`, draft PR [60](https://github.com/monowanderer373/monosplit/pull/60).
Based on remote main `478a47deffb131e5f37dcd6768bb9a5da2176fad` and integrates
pending batch PR58 without removing the published account/currency fixes.

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
- Previously pending prerequisite migrations: `202611050001` and `202611050002`.
- Complete installer: [trip-routed-production-apply.sql](../runbooks/trip-routed-production-apply.sql),
  **129,240 bytes**, SHA256
  `d315c23905ca543fd995fd4fedf66b552fee0fb644348ec8fe49bd973fad21fd`.
  Contains exact canonical batch001+002+routed payloads and 24 final function
  fingerprints/ACL/RLS guards. Accepts no batch, original001-only, full batch and
  already-routed replay. Installs capabilities only; no payment, confirmation,
  reversal, balance edit, expense edit or Reset.
- Installer marker: `TABBY_TRIP_ROUTED_INSTALL_COMPLETE_20261110`.
- Reproducible read-only audit: `scripts/verify-trip-routed-production.py` accepts
  only a disposable loopback DB for local tests or the existing project via the secure
  Management API binding. It reads schema metadata, never customer financial rows.

## Actual verification

- Package README/PRODUCT/INTEGRATION/QA read; `preview/index.html` opened over local
  HTTP; **15/15** supplied Node24 reference tests passed.
- Local official PostgreSQL17 with minimal auth fixtures: all migrations applied;
  original 26 SQL files initially 1,273 assertions passed, with routed assertions
  subsequently expanded from 42 to **64**, all passed. Final64 include dual recipients,
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
- Initial hosted failures are retained: typed SQL literal/SET lint and a parser
  typo were corrected, footer overflow fixed; test-only failures were a recovery
  assertion before network arrival and a legacy mutation audit misclassifying the
  new read RPC. Original financial assertions and timeouts remain.

## Deployment and environment limits

Independent production metadata read: `supabase_read_only_user`, transaction
read-only on, public CREATE false. Batch and routed migrations are absent; original
four FX wrapper bodies remain their pre-batch versions. The candidate 24-body audit
therefore correctly blocks release; it does not indicate a fault in the installed
old financial schema. No production financial QA writes were performed.

After final CI, an operator must run the complete installer in the existing
[SQL Editor](https://supabase.com/dashboard/project/skiqsxvmxvmxfzhrzcxh/sql/new).
The next executable step is an independent 24-body/version/ACL/RLS verification,
then merge and existing Vercel production publication under the user's standing
release authorization. Do not deploy the UI before that schema verification.

Physical Honor Magic7 Pro, OS keyboard/safe areas/font scaling, and customer account
settlements have not been tested. Local PostgreSQL is real but its minimal auth
fixtures are not GoTrue/PostgREST; the hosted native-browser suite supplies that layer.

## Completion checkpoint

Final exact-source CI and the safe screenshot gallery are being collected. This
candidate report must not be used as evidence of a production deployment.
