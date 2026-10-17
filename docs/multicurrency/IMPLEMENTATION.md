# MultiCurrency implementation and evidence map

Approved source: `TabbyTally_MultiCurrency_Complete_Handoff_2026-10-16`, Q1–Q12 A. This is an implementation checkpoint, not a release certificate. Current feature branch/draft PR24 is not deployed. See PROJECT_STATUS/WORK_LOG for exact commits and completed runs; historical passes do not certify subsequent changes.

## Source → schema → command → UI

| Concern | Authoritative storage / command | Application integration |
|---|---|---|
| Native balances | Original `personal_accounts` and immutable `personal_account_entries`; explicit `personal_account_currencies` grouping; owner-only `get_personal_multicurrency_accounts` | `multicurrencyRepository`, `personalAccountReadRepository`, `AccountBalance`, existing Home account slots, AccountsPage |
| Observed balance | `personal_account_balance_anchors`, captured entries/versions, explicit coverage; `set_personal_currency_balance` composes original opening/reconciliation | Currency management / centered Set balance; no income or expense replay |
| Unknown actual payment | Original canonical expense and owner-private pending funding, primary parent metadata in `personal_funding_bundles`; `create_expense_with_multicurrency_funding` / `defer_personal_expense_funding` | Original UniversalQuickAddSheet calculator/context/split/save/outbox plus QuickPayment |
| Actual payment | Original accepted owner payer contribution; immutable original journal legs in `personal_funding_bundle_legs`; atomic `confirm_personal_funding_bundle` | FundingSources/FundingBundleForm, original notification resolver and centered review, verification page |
| Transfers / exchange / withdrawal | Original transfer journal; `personal_money_movements`, explicit component coverage, `record_personal_money_movement` | Existing Home ⋯, account actions, movement page and linked history |
| Fees | Original canonical fee expense and actual fee journal when applicable; linked `personal_money_movement_fees`; late `itemise_personal_movement_fee` classifies only | Collapsed fee details, actual native unit, linked canonical history; Home distinguishes late fee from another cash debit |
| Financial authority / retries | Original permissions, owner/RLS, expected account/intent/expense versions, actor/request locks, `personal_money_operations` fingerprints and locked `reconcile_personal_money_operation` recovery | Normal frozen-JWT RPC, useMoneyAction identity leases; no service key or FX actual-payment fallback |
| Reference value | Existing shared persistent FX snapshot API; exact rational MYR display conversion | AccountBalance and existing Insights; no valuation value enters posting payloads |

Two new forward migrations: `20261016130602_multicurrency_accounts_and_funding.sql`, `20261016132156_multicurrency_money_movements.sql`. They are still unreleased; changes must pass actual isolated database/lint/history/concurrency and browser CI. The SQL Editor bundle is generated, complete and version-guarded; editing it or a repository migration does not install production schema. Existing 26 migration bodies and original IDs/default/history are preserved.

## Acceptance coverage

File abbreviations: **DB** = `supabase/tests/multicurrency_accounts_and_funding.sql`; **RACE** = `supabase/tests/multicurrency_concurrency.py`; **U** = `src/lib/multicurrency.test.ts`; **HOOK** = `src/hooks/useMoneyAction.test.tsx`; **UI** = `e2e/multicurrency-ui.spec.ts`; **REAL** = `e2e/multicurrency-backend.spec.ts`; **NOTICE** = `e2e/home-notifications.spec.ts` plus existing notifications-a/row-layout suites. Mocked API tests verify rendered application behavior, not backend authority. REAL uses normal authenticated disposable Supabase commands; auth admin is limited to disposable identities.

The table maps requirements to implementation/tests. It does **not** declare every row passed. Newly added or changed tests require a current completed run; production and physical-device verification remain pending.

| ID | Implementation / verification target |
|---|---|
| C01 | Explicit grouping only; DB original parent/default enumeration, historical upgrade twice; existing account/journal suites |
| C02 | AddCurrency → versioned owner RPC; DB duplicate/native unit and explicit opening checks |
| C03 | QuickPayment selects only an existing same-currency Cash unit; no account creation or FX guess |
| C04 | Visible native suggestion in original calculator; actual bundle; REAL Quick Add journey and DB exact native debit |
| C05 | Deferred plan stores primary parent with NULL actual source/amount; DB zero journal and REAL unknown Wise journey |
| C06 | Foreign actual fields begin blank; UI/NOTICE/REAL; FX helpers never feed funding payload |
| C07 | DB unknown account retains negative native delta without manufacturing absolute balance |
| C08 | DB known zero vs unknown; U valuation preserves numeric zero |
| C09 | U/UI missing FX keeps native balance and partial valuation |
| C10 | U all unknown/missing returns unavailable, never manufactured RM0 |
| C11 | UI stable first three currencies, disclosure/all/fewer, pending band stays outside disclosure |
| C12 | DB atomic original journals/multiple native sources; REAL two-source verification |
| C13 | DB explicit whole-payment coverage without raw mixed-unit sum; U exact native precision |
| C14 | DB duplicate account rows rejected before posting; FundingSources disables duplicate choice |
| C15 | DB invalid second owner/source rolls back entire create/confirm, including first leg |
| C16 | DB Direct bill90/ownpaid60/share45; only accepted authoritative60 eligible, other pending identity unchanged |
| C17 | homeNotifications weighted distinct task count; grouped funding retains independent shared/CollectPay/recurrence reviews |
| C18 | Fresh single group resolves to original exact centered target; NOTICE single-route test |
| C19 | useOpenHomeNotice fresh zero/one; NOTICE stale2→0/1; no false user-confirmed empty state |
| C20 | One primary group per intent, U grouping; multiple posted legs do not generate pending rows |
| C21 | VerificationList uses oldest source-calendar/ID order and waits for receipt and fresh authority before selecting next; NOTICE/REAL clear next actual fields |
| C22 | HOOK frozen original request after lost response/failed refresh and successful self-closing acknowledgement; NOTICE unknown commit/read retry; DB idempotency |
| C23 | Original resolver reads current state; NOTICE handled/withdrawn/no-visibility; real existing notification backend suite |
| C24 | Current account/parent versions and archive guards; U compiled-source archive rejection; DB parent→child archive/stale native source/history preservation |
| C25 | FundingSources clears actual amount/coverage on source switch; movement selectors clear incompatible amounts |
| C26 | DB actual same-parent FX legs, no canonical principal expense; UI exchange payload; REAL native final balances |
| C27 | DB same-unit transfer conservation and rejection of unclassified missing principal |
| C28 | DB/REAL withdrawal uses total source out and actual destination net, principal is transfer |
| C29 | DB/REAL source150incl2 posts150 once and one fee2 canonical expense |
| C30 | DB separate JPY actual fee and independent same-unit fee coverage, no cross-unit subtraction |
| C31 | U movement validation and DB included fee too large rejection; disabled invalid browser submit |
| C32 | DB no invented zero fee; MovementDetails explicitly unitemised; actual amounts never inferred from market rate |
| C33 | DB/REAL later classification only; HomeView unit keeps linked fee without a second cash debit |
| C34 | DB/REAL unknown−20 then explicit observed100 including entry →100 with immutable audit |
| C35 | DB/REAL late16.20 included in observed100 →100 with explicit pinned latest anchor |
| C36 | DB/REAL late16.20 not included →83.80 exactly once |
| C37 | Explicit anchor choice, never date inference; DB unknown-source → new known currency anchor; U rejects superseded anchor |
| C38 | Original transactional correction/version authority retained; full existing shared/change pgTAP/browser regression |
| C39 | Original cancellation/receipt semantics; bundle reversal leaves canonical expense untouched; movement reversal cancels only linked fee through original command |
| C40 | DB owner/other/anon grants and RLS; original complete financial permission suites |
| C41 | HOOK invalidates late identity/target callbacks; original notification preflight/frozen JWT guards; initial source-read action gate/unchanged snapshot stability; NOTICE held read then explicit dismiss prevents late reopening |
| C42 | AccountsPage unknown movement kind unavailable; existing safe typed notification/login destinations; encoded internal parameters |
| C43 | UI movement conceal retains draft, NOTICE financial review gate, ExpenseActionSheet unit excludes DOM/ARIA/input values |
| C44 | Original identity-scoped notification origin; NOTICE Back/Escape/focus; deleted rows safe origin fallback |
| C45 | U accountRecordsFilter preserves archived/deleted/unknown selection, normalizes real child parent; no all-records fallback |
| C46 | Central account reader exposes native IDs to original cash-leg consumers; all original recurring/installment/settlement/refund suites; DB real child refund |
| C47 | UniversalQuickAdd offline unit and original outbox journeys; HOOK same command recovery; opaque receipt metadata, locked absent-request fences after reload, no fake local posted balance |
| C48 | Real production module graph plus harness suites; retained strict 4-column notification widths/64px row/centered dialog geometry |
| C49 | UI native account 320/360/390/430 ×100/125/150/200 root text; NOTICE long labels/keyboard-height/safe-inset simulations. Additional six-case long payment/movement/management form matrix (narrow200% and desktop) passed after the direct-link dialog CSS repair; final complete114production run PASS |
| C50 | DB old default-currency client reads/posts still valid; historical fixture upgrade; actual retained production PWA update PASS on featuremain242d897 |
| C51 | Strict schema-version parser and normal online unavailable save gate; QuickAdd unit; no legacy write fallback |
| C52 | U display-only rational valuation and unchanged original input; UI FX missing/native preservation; normal shared persistent provider snapshot |
| C53 | DB exact request replay/fingerprint conflict; RACE overlapping same-request both sessions →one complete bundle |
| C54 | RACE two request IDs on same current target →one result/one stale rejection; current native versions prevent lost updates |
| C55 | Original allow-negative policy unchanged; DB unknown delta/native balances; ordinary Home negative warning remains; new actual-native funding/movement warnings retain valid allow-negative saves |
| C56 | NOTICE money-in-note conceal, ExpenseActionSheet monetary title/inputs gate, hidden Home descriptions and notification detail free text |

## Visual review and limitations

Two approved boards, 35 individual native scene PNGs, component index and 60 component parts reviewed (including loading/retry/changed/unavailable/login/saving/uncertain/anchor states). Real CSS/SVG/React renders are used, never a flattened screen image. Original Quick Add calculator and Home navigation intentionally remain current application components, as the package requires. Added coverage/whole-payment confirmation controls express real financial authority absent from illustrative values.

Generated screenshots under `test-results/multicurrency` are synthetic intercepted API UI evidence. A fresh production build/test resets that directory; preserve an allowlisted copy with the exact test run before reporting it. Final20-pair design/application gallery is retained at `/workspace/verification/multicurrency/comparison/index.html` with35approved scenes and actual untouched browser screenshots. Seven supplemental component journeys and complete114production graph passed at final source418991c. Normal production financial assertions are separate from these intercepted synthetic UI images. Root font and viewport simulations are not physical Honor, OS keyboard/system font or browser UI zoom evidence.


## Released evidence (2026-10-17 MYT)
PR24/main242d897 is live and normal authenticated QA verified. See [release report](../releases/2026-10-17-multicurrency-live.md). Final PR and feature-main CI each passed all7jobs;637units,862pgTAP/19,265full-browser summary,114production graph,CollectPay10 andTravel16.28migration versions/32new function bodies match production. Case-map rows above name implementation and tests; they do not assert that every case was written into private production accounts. Actual production exercises controlled owned accounts only; shared/correction/reversal/concurrency abuse cases are covered by disposable real-backend suites. Physical-device validation remains NOT RUN.
