# Tabby Tally prototype implementation plan

**Status:** **Accepted for implementation** — 2026-09-21. ADRs 0007–0009 are **Accepted**. Implementation must follow §11 and preserve the locked Phase 5 invariants.

**Authoritative code:** `HEAD dcbdb30055caa673b137a6e0d3d29763314cae5a` on `phase5-financial-trust`. GitHub `main` and Production Vercel are behind this SHA. Remote Supabase does **not** yet have `202609080001_phase5_financial_trust.sql`. Production is not HEAD.

**Phase 5 is frozen.** Do not weaken `supabase/migrations/202609080001_phase5_financial_trust.sql`, `supabase/tests/phase5_financial_trust.sql`, `src/lib/relationalBalance.ts`, `src/lib/compileExpense.ts`, `src/lib/expenseChangeRepository.ts`, or Phase 5 Playwright. New work is **additive** forward migrations. Do not edit old migrations in place.

Related: `HANDOFF.md`, `CONTEXT.md`, `Tabby_Tally_Implementation_Gap_2026-09-17.md`, `docs/adr/0006-tabby-tally-relational-canonical-expense.md`, ADRs 0007–0009.

Identifiers in this plan are audited against `dcbdb30`. Invented names are only **new** objects listed in §10.1.

---

## Repository facts (do not re-invent)

| Concept | Actual name at HEAD |
|---|---|
| Current participant | `public.current_participant_id()` |
| Participant kind for an owner | `public.participants.kind = 'account'` (not `account_backed`) |
| Propose / respond settlement | `public.propose_settlement(...)`, `public.respond_to_settlement(...)` |
| Cancel pending allocation | `public.cancel_pending_settlement_allocation(...)` |
| Reverse accepted allocation | `public.reverse_settlement_allocation(...)` |
| Shared audit | `public.financial_events` with check `num_nonnulls(expense_id, settlement_payment_id, space_id) = 1` |
| Expense read helper | `private.can_read_expense(uuid, uuid)` |
| Settlement read helper | `private.can_read_settlement(uuid, uuid)` |
| Historical accepted Space participant | `private.is_historical_space_expense_participant` (already requires `expense_participations.state = 'accepted'`) |
| Active Space member | `private.is_active_space_member` |
| Create expense | `public.create_expense(request_id uuid, expense_scope text, target_space_id uuid, total_minor bigint, currency_code text, description text, category text, occurred_on date, participant_ids uuid[], contribution_amounts bigint[], share_amounts bigint[])` |
| Direct accept | `public.respond_to_direct_expense` |
| Space financial correction | `public.correct_space_expense` |
| Cancel expense | `public.cancel_expense` |
| Recurring draft accept | `public.respond_to_recurring_draft` |
| Recurring next date | `public.next_recurring_local_date(scheduled_for date, cadence text, anchor_day integer)` |
| Payer / share identity | `payer_contributions` and `expense_shares` PK is `expense_participation_id`; they do **not** store `participant_id` |

There is **no** `private.current_participant_id`, `ledger_events`, `record_ledger_event`, `private.can_access_participant`, `propose_settlement_payment`, or `respond_to_settlement_payment`.

Do **not** reuse `public.financial_events` for wallet/account events: parent-one-of-three plus `financial_events_select_visible` would leak or reject private rows. **Recommended:** new owner-only `public.personal_account_events`. Do not alter `financial_events` in V1.

---

## Locked financial invariants

1. Canonical Expense is the source of truth for consumption and sharing (`public.expenses`, `public.expense_participations`, `public.payer_contributions`, `public.expense_shares`).
2. Participant identity is immutable. Person is not Participant.
3. Accepted allocations (`settlement_allocations.state = 'accepted'`) are immutable. Corrections use `public.reverse_settlement_allocation` / new rows. Never silently rewrite financial history.
4. Shared settlement changes `F` only after `public.respond_to_settlement(..., 'accepted', ...)`.
5. Wallet/account data is private to its owner.
6. Private journal rows must **not** alter Canonical Expense, payer contributions, or shared allocation merely because they are linked.
7. Shared balance remains `F = E - T + R` (`src/lib/relationalBalance.ts`).
8. All money writes: integer minor units, explicit ISO currency, database transactions.
9. Every retryable write: idempotency key + deterministic conflict (`already_exists` / return existing). Existing expenses/settlements use uuid `client_request_id` / `request_id`.

`src/lib/settlementIntent.ts` `resolveSettlementAmount` throws `amount_exceeds_outstanding_balance`. Replace that **client** guard so **carry-forward** can accept shared `T` above then-current debt. **Gift/waiver** still proposes shared `T` equal to debt cleared. This extends propose inputs; it does not weaken accepted-allocation immutability.

Preserve `settlement_payments.amount_minor` as **shared `T`**. Actual bank/wallet movement lives on owner-private cash legs (`actual_cash_minor`).

---

## 1. Account and wallet model

See ADR 0009. Journal name: **owner-private multi-leg account journal**, not double-entry.

### `public.personal_accounts`

Owner `owner_participant_id` → `participants.id` where `kind = 'account'`. Columns: `name`, `account_class` (`asset`\|`liability`), `account_type` (`cash`\|`bank`\|`ewallet`\|`credit_card`\|`paylater`\|`loan`), `currency`, `archived_at`, `is_default`, `opening_status` (`unknown`\|`posted`), `opening_balance_as_of`, `version`, `client_request_id uuid`, timestamps.

Partial unique: **one** `is_default` per owner among active `cash|bank|ewallet` (global, not per currency).

Opening: exactly one `kind = 'opening'` transaction when posted; cached `opening_status` must match (constraint/trigger/RPC).

Onboarding: one account; opening optional; first eligible asset is the global default.

Unknown display: ADR 0009 / ADR 0007 (`余额待完善`, `已知余额`).

Archive: replacement default required if another eligible asset exists; last eligible asset **may** be archived (no default; Quick Add asks or allows unlinked/pending).

### Journal tables

`public.personal_account_transactions` + `public.personal_account_entries`. Kind-specific cardinalities and signs: ADR 0009. **No** global “balanced legs” rule.

**Reversal:** original rows stay in the sum; new opposite `kind = 'reversal'`; `reversed_at` / `reversal_transaction_id` metadata only; one active reversal; reversal-of-reversal forbidden.

Home available = asset `cash|bank|ewallet` sums per currency, with unknown-opening aggregate rules. Never invent movements for historical expenses.

---

## 2. Expense funding and cross-currency

Canonical Expense keeps original currency and `total_minor`. Entries use the account currency.

### `public.personal_funding_intents`

`expense_amount_minor` = **this owner’s payer contribution** (`payer_contributions` ⋈ accepted `expense_participations`). Personal: equals full expense. Shared/multi-payer: **not** the group total.

V1: **one** funding account per owner per expense. Unique active intent `(expense_id, owner_participant_id)`. Split-wallet is out of V1.

Same-currency: amount may default to that contribution. Cross-currency: actual debit required, or `pending` with no journal. Completing posts once; does not recreate the expense or change accepted shares. Home 「待处理」 + account page.

---

## 3. Recurring bookkeeping

ADR 0008. New `public.personal_recurring_rules` / `public.personal_recurring_occurrences`. Do not put amounts into `public.recurring_rules.default_draft_fields`.

V1 auto-post: `expenses.scope = 'personal'` only.

Cadence: `weekly` uses `anchor_weekday` (ISO 1–7); `monthly` uses `anchor_day_of_month` (1–31). Do not share one 1–31 field.

Catch-up: `public.catch_up_personal_recurring()` — **no** authenticated `as_of`. Server date in validated IANA timezone. Max **24** occurrences per call; return `remaining`. Deterministic `public.create_expense` `request_id` from `(rule_id, scheduled_for)`. Failed post: PL/pgSQL subtransaction; sanitized `error_code`; no orphan expense.

Occurrence unique `(rule_id, scheduled_for)`. States + edit-one snapshots: ADR 0008.

No service-role cron.

---

## 4. Installments and liabilities (V1)

Separate from recurring expenses.

`public.personal_installment_plans`: `purchase_expense_id`, `liability_account_id`, `plan_kind` (`next_month` \| `n_installments`), `installment_count` (1 or 3–24), `principal_minor` (**liability currency**), `currency` (= **liability account**, not necessarily expense), `first_due_on`, `status` (`pending_principal` \| `active` \| `paid_off` \| `reversed`), `client_request_id`.

`public.personal_installments`: `sequence`, `due_on`, `principal_minor`, `status` (`scheduled`\|`posted`\|`skipped`\|`failed`\|`reversed`), unique `(plan_id, sequence)`.

Cross-currency example: expense ₫300,000; card MYR RM56.80; liability +RM56.80; schedule from RM56.80.

If billed principal unknown: expense+sharing saved; funding intent pending; plan `pending_principal` **without** installment rows (or rows forbidden until principal known). Completing intent: one `liability_purchase` + generate N rows once (idempotent on plan `client_request_id`). Reverse: compensating journal + cancel/correct expense via Phase 5 if the purchase is reversed; do not generate a second plan.

Repayment: `liability_repayment` with explicit asset and liability amounts (cross-currency allowed). Principal is not a second Canonical Expense. Interest/fees: separate `public.create_expense` + `interest_fee` funding.

Account detail: current debt, next due, plan, repayment history.

---

## 5. Shared settlement, request, partial, overpayment

Preserve `public.propose_settlement`, `public.respond_to_settlement`, `public.cancel_pending_settlement_allocation`, `public.reverse_settlement_allocation`. Forward-migration **replaces** those function signatures with added **optional** arguments; keep names. Do not put account ids on shared rows or in `financial_events.safe_diff`.

Current `public.propose_settlement` args: `request_id uuid`, `settlement_scope text`, `target_space_id uuid`, `currency_code text`, `total_amount_minor bigint`, `payment_date date`, `creditor_ids uuid[]`, `allocation_amounts bigint[]`, `settlement_note text`.

Current `public.respond_to_settlement` args: `target_allocation_id uuid`, `response text`, `expected_payment_version integer`; returns `{ allocation_state, payment_status, payment_version }`.

### Shared `T` vs actual cash

| Field | Location | Meaning |
|---|---|---|
| Shared `T` | existing `settlement_payments.amount_minor` and accepted `settlement_allocations.amount_minor` | Enters `F = E - T + R` |
| Actual cash | `personal_settlement_cash_legs.cash_amount_minor` | Owner wallet movement |

- Normal/partial: actual cash = shared `T` (sum of **accepted** allocations for that owner’s legs).
- **Carry forward:** full actual cash enters shared `T` (including residual). V1: `settlement_scope = 'direct'` and **exactly one** creditor. `src/lib/settlementIntent.ts` must allow amount > outstanding.
- **Gift/waiver:** shared `T` capped to debt at confirm; actual cash may be larger; extra = actual − `T`; extra does **not** change `F`. V1: Direct, one creditor.
- Group/Space multi-creditor **overpayment is forbidden** in V1 (RPC reject). Do not guess extra-cash splits.

Gift extra classification: payer `gift_out`, receiver `gift_in`. Shared portion: `settlement_out` / `settlement_in`. Do not describe gift as negative `income` or as `expense_funding`.

Insights: gift extra is a separate personal gift cash-flow series. Original shared expense and `F` unchanged.

### `public.personal_settlement_cash_legs`

`owner_participant_id`, `settlement_payment_id`, `settlement_allocation_id`, `role` (`payer`\|`receiver`), `account_id` nullable while pending, `cash_amount_minor`, `account_currency`, `status` (`pending`\|`posted`\|`reversed`), `posted_transaction_id`, owner-scoped `client_request_id`. Unique `(settlement_allocation_id, owner_participant_id, role)`.

Only the owner SELECTs their binding. `public.respond_to_settlement` posts **that allocation’s** payer and receiver legs on `'accepted'`; `'declined'` posts none. Partial confirmation must not debit the payer for the full `settlement_payments.amount_minor`.

Contra preview: existing `deriveSignedRelationalPositions`; Direct, same friend, same currency only. Never replace history with only the net.

Selected bills: `public.settlement_attribution_intents` immutable at propose; same counterparty, scope, currency; omit → FIFO `deriveSettlementAttributions`. Stale: client `expected_outstanding_minor`; if live `F` differs → `balance_changed` (extend propose). `public.propose_settlement` today has **no** outstanding snapshot — add optional `expected_outstanding_minor`.

### `public.settlement_payment_requests`

No financial effect. No account columns. States: `open` \| `converted` \| `cancelled` \| `expired`. Creditor reminds; debtor proposes via `public.propose_settlement` and authorizes **their** cash leg; creditor confirms via `public.respond_to_settlement` and authorizes **their** receiving account through a private RPC consumed by respond. Neither party lists the other’s accounts.

---

## 6. Insights (locked)

- Purchase spending when Canonical Expense is created (`occurred_on` in range).
- Credit/PayLater **principal repayment is not spending**.
- Transfers are neither income nor spending.
- Income, refund, settlement cash (`settlement_in`/`settlement_out`), and gift cash (`gift_in`/`gift_out`) are distinct.
- Gross purchase spending; refunds disclosed separately.
- Currencies remain separate; no converted grand total.
- Pending cross-currency funding disclosed as not yet in account balance.

UI: `/insights`; overlay/curtain (ADR 0007).

---

## 7. Navigation and visual acceptance

ADR 0007. Upper-right control: **`日常 | 旅行`**. Playwright must cover all listed visual rules, including non-clickable 本月消费 / 待收回.

---

## 8. Private trip affiliation

`public.personal_expense_affiliations`: owner, `expense_id`, label, `archived_at`. Classify only expenses the owner may read **after** the §9 `can_read_expense` change. Grants no extra access. Archiving does not delete `public.expenses`. Travel mode: affiliations ∪ Space `type = 'trip'` (subject to §9).

---

## 9. Group/Trip member history (confirmed)

Cutoff: `expenses.created_at` / `settlement_payments.created_at`, not `occurred_on`.

### `public.space_membership_intervals`

`id`, `space_id`, `participant_id`, `started_at`, `ended_at` (null if open), no overlapping intervals.

**Backfill (forward migration):** for every existing `public.space_members` row, insert one interval with `started_at = joined_at` and `ended_at = removed_at` (null if active). **Limitation:** earlier join/leave cycles already overwritten by PK `(space_id, participant_id)` **cannot be invented**. Document in release notes.

After migration, `public.create_space`, `public.accept_space_invite`, `public.remove_space_member`, and any rejoin path (accept invite / add member when a removed row exists) **atomically** maintain current `space_members` **and** close/open intervals. Rejoin: close is already done; insert a **new** interval; do not reuse the old `started_at`.

**Read access:** do **not** grant authenticated `SELECT` on the whole intervals table. `private.can_read_expense` / `private.can_read_settlement` (replaced in a **new** migration, `search_path = ''`) consult intervals inside security-definer helpers. Watch RLS recursion: keep helpers `security definer` like today.

Viewer may read a Space expense if:

1. `expenses.created_by = viewer`, or
2. exists `expense_participations` for viewer with **`state = 'accepted'`** (not `pending` / `declined` / `untracked`), or
3. exists interval I with `I.started_at <= expenses.created_at AND (I.ended_at IS NULL OR expenses.created_at < I.ended_at)`.

Do **not** grant visibility from `payer_contributions` / `expense_shares` alone; they have no `participant_id`. Join only through that accepted participation.

Settlements: party on payment (`debtor_participant_id` or allocation `creditor_participant_id`) **or** created during a membership interval (for other Space members). UUID guessing fail-closed.

Replace the current `private.can_read_expense` branch that allows **any** Space member to read **all** Space expenses (`e.scope = 'space' and private.is_active_space_member`). Also stop treating any participation row as sufficient (today’s `exists expense_participations` has **no** state filter).

---

## 10. Schema, RPCs, RLS, tests

### 10.1 New tables (forward migration after Phase 5)

| Table | Purpose |
|---|---|
| `personal_accounts` | Owner instruments |
| `personal_account_transactions` | Journal headers |
| `personal_account_entries` | One or more legs |
| `personal_account_events` | Owner-only audit (not `financial_events`) |
| `personal_funding_intents` | Pending/posted expense funding |
| `personal_recurring_rules` | Typed personal recurrence |
| `personal_recurring_occurrences` | Per due date + overrides |
| `personal_installment_plans` | Liability schedules incl. `pending_principal` |
| `personal_installments` | Due rows |
| `personal_expense_affiliations` | Owner-only trip labels |
| `space_membership_intervals` | Join/leave history; no direct member SELECT |
| `settlement_payment_requests` | Non-financial reminders |
| `settlement_attribution_intents` | Immutable selected-bill metadata |
| `personal_settlement_cash_legs` | Owner-private actual cash vs shared `T` |

Existing tables stay; Phase 5 objects stay.

### 10.2 RPC list (repository-accurate)

**Existing names kept; optional new args via `CREATE OR REPLACE` in a forward migration:**

| Function | Change |
|---|---|
| `public.current_participant_id()` | Unchanged |
| `public.create_expense(...)` | Unchanged signature. Optional funding is a **follow-up** RPC in the same client tx pattern (outbox), or a new `public.create_expense_with_funding` **wrapper** that calls `create_expense` then `link_expense_funding`. Prefer wrapper so Phase 5 tests keep calling `create_expense`. |
| `public.propose_settlement` | Add optional `overpay_disposition text` (`gift`\|`carry`\|null), `expected_outstanding_minor bigint`, attribution arrays. **No account ids.** Reject carry/gift unless Direct and `cardinality(creditor_ids) = 1`. Gift: persist `amount_minor` as shared `T` (capped at confirm). Carry: `total_amount_minor` may exceed current `F`. |
| `public.respond_to_settlement` | Same three required args. Internally post cash legs for **this** allocation using pre-authorized private rows. Return jsonb **must not** include account ids. |
| `public.cancel_pending_settlement_allocation` | Also cancel pending cash legs; no posted journal. |
| `public.reverse_settlement_allocation` | Compensating `reversal` journals for posted cash legs; one reversal per original txn. |
| `public.cancel_expense` / `public.correct_space_expense` / `public.respond_to_direct_expense` | Unchanged authority; funding reversals are separate owner RPCs. |
| `private.can_read_expense` / `private.can_read_settlement` | Replaced in new migration for §9. |
| Space member RPCs (`create_space`, `accept_space_invite`, `remove_space_member`) | Maintain intervals atomically. |

**New authenticated RPCs** (all `security definer`, `search_path = ''`, `actor := public.current_participant_id()`):

- `create_personal_account`, `update_personal_account`, `archive_personal_account`, `set_default_personal_account`
- `complete_account_opening`, `reconcile_account_to_stated_balance`
- `create_income_transaction`, `create_refund_transaction`, `create_transfer_transaction`
- `link_expense_funding`, `complete_pending_funding`
- `reverse_personal_account_transaction`
- `create_personal_recurring_rule`, `update_personal_recurring_rule`, `pause_personal_recurring_rule`
- `catch_up_personal_recurring()` — **no `as_of` parameter**
- `post_personal_recurring_occurrence`, `skip_personal_recurring_occurrence`, `reverse_personal_recurring_occurrence`, `retry_failed_personal_recurring_occurrence`
- `create_installment_plan_for_expense`, `complete_pending_installment_principal`, `post_installment_repayment`, `edit_future_installment`, `reschedule_remaining_installments`, `pay_off_installment_plan`, `reverse_installment`
- `create_settlement_payment_request`, `cancel_settlement_payment_request`
- `authorize_personal_settlement_cash_leg` (owner binds `account_id` + `cash_amount_minor` for one allocation/role; pending until respond)

**Not granted to `authenticated`:** any test clock override for catch-up.

### 10.3 Write-RPC contract (every new/replaced write)

| Slot | Requirement |
|---|---|
| Caller | `public.current_participant_id()` not null; owner `kind = 'account'` where required |
| Authorization | Owner of personal row **or** existing Phase 5 settlement/space rules |
| Inputs | Typed; no locale-inferred currency |
| Server-derived | ids, timestamps, `account_class` from type, copied currencies, contribution copy for funding |
| Preconditions | version, status, currency, Direct/one-creditor for overpay, kind-specific entry invariants |
| Idempotency | uuid `client_request_id` or derived occurrence key; unique index; return existing |
| Transaction | Single function; `FOR UPDATE` on account/rule/payment/allocation/expense |
| Rows written | Journal + events in `personal_account_events` for private money; `financial_events` only for existing shared parents |
| Failure | Exception; no header without required entries; catch-up inner `EXCEPTION` as ADR 0008 |
| Reversal | New journal; originals remain in the sum |
| Return | Never include another party’s `account_id` |

### 10.4 RLS matrix

| Object | SELECT | INSERT/UPDATE | Notes |
|---|---|---|---|
| `personal_accounts` | owner | RPC | |
| `personal_account_transactions` / `_entries` | owner | RPC | |
| `personal_account_events` | owner | RPC | Not visible via Space/expense |
| `personal_funding_intents` | owner | RPC | |
| `personal_recurring_*` | owner | RPC | |
| `personal_installment_*` | owner | RPC | |
| `personal_expense_affiliations` | owner | owner RPC | Must pass new `can_read_expense` |
| `personal_settlement_cash_legs` | owner | RPC | Counterparty cannot SELECT |
| `space_membership_intervals` | **none** to `authenticated` | trigger/RPC | Helpers only |
| `settlement_payment_requests` | from or to participant | RPC | No account columns |
| `settlement_attribution_intents` | same as parent payment via `can_read_settlement` | insert with propose | Immutable |
| `expenses` | §9 | existing RPCs | Fail-closed |
| `settlement_payments` / allocations | updated `can_read_settlement` | existing RPCs | |
| `financial_events` | unchanged parent visibility | RPC | No wallet fields in `safe_diff` |

Policies: `TO authenticated`, `auth.uid() IS NOT NULL`, no `USING (true)`.

### 10.5 Test matrix

**Existing (do not invent a count; do not delete):** `supabase/tests/phase5_financial_trust.sql`, `phase5_financial_workflows.sql`, `tabby_tally_rls.sql`; unit `src/lib/relationalBalance.test.ts`, `settlementIntent.test.ts`; Playwright `e2e/phase5-*.spec.ts`, `e2e/navigation.spec.ts` (rewrite labels).

**Proposed additional:**

| Theme | Assert |
|---|---|
| Integer / currency | Reject mismatch expense vs contribution vs account entry |
| Idempotency | Duplicate and concurrent retry |
| Kind-specific journal | Each kind’s cardinality/sign; reject “balanced legs” across FX |
| Reversal balance | RM100 debit + reversal = original balance **once**; original entries still counted |
| Global default | One default per owner; per-currency second default rejected |
| Archive last / replacement | Replacement required when another asset exists; last archive leaves no default |
| Unknown-balance aggregate | `余额待完善`; All shows `已知余额` + pending count, not a fake complete total |
| Opening complete once | Matches cached `opening_status` |
| Transfer atomicity | Same-currency abs equal; FX two explicit amounts |
| Owner-contribution funding | Shared expense intent amount ≠ group total; one account per owner |
| FX pending then complete | Balance unchanged until complete; complete once |
| Cross-currency card/installment | ₫ expense, MYR liability/schedule; pending principal generates plan once |
| Liability repay | Not a second spend; Insights exclude principal |
| Recurrence | Catch-up; month-end; weekly weekday; pause; skip; **future `as_of` denied** (no param); fail persists `error_code` without orphan expense; reverse; derived request_id retry |
| Installment rounding / early payoff | Last remainder; reverse |
| Settlement T vs cash | Gift extra not in `F`; carry extra in `T`; Direct one-creditor only for overpay |
| Wallet ID non-disclosure | Counterparty SELECT on cash_legs/accounts empty; respond jsonb has no account_id |
| Multi-creditor partial accept | Second allocation pending/declined → payer not debited full payment; unique per allocation |
| Stale snapshot | `expected_outstanding_minor` mismatch |
| Member history | Backfill from `joined_at`/`removed_at`; pending participation denied; accepted old participation visible; removal; rejoin does not unlock gap; unrelated UUID fail-closed |
| Persistence | Reload after funding, catch-up, settlement confirm |

---

## 11. Implementation and deployment sequence

1. Finalize ADRs 0007–0009 and this matrix (this round).
2. After approval: branch from **exact** `dcbdb30055caa673b137a6e0d3d29763314cae5a`.
3. Migrations, RLS, guarded RPCs, pgTAP first. Apply Phase 5 `202609080001_phase5_financial_trust.sql` **before** dependent migrations. Never deploy client before required RPCs.
4. Repositories / derivations / unit tests.
5. Navigation and read-only UI.
6. Account / funding / recurring / installment / settlement UI.
7. Local db, unit, integration, Playwright.
8. Remote backup + migration ledger (non-prod).
9. Isolated Preview ↔ non-production Supabase.
10. Production-like mobile, refresh, concurrency, financial acceptance.
11. **Only after explicit approval:** push/merge and Production.

---

## Requirements → phase traceability

| Locked requirement | Spec | After approval |
|---|---|---|
| Phase 5 / `F=E-T+R` / integer / idempotency | Locked invariants | All; frozen files |
| Real HEAD identifiers | Repository facts | Docs + seq 3 |
| Multi-leg journal + kind invariants | §1, ADR 0009 | Seq 3 |
| Reversal included in balance | §1, ADR 0009 | Seq 3–4 |
| One global default; archive rules | §1, ADR 0007 | Seq 3, 6 |
| Unknown opening display | §1, ADR 0007 | Seq 5–6 |
| Owner-contribution funding; one account/expense | §2 | Seq 3, 6 |
| Cross-currency card/installments | §4 | Seq 3, 6 |
| Recurring cadence, server date, cap, fail persistence | §3, ADR 0008 | Seq 3, 6 |
| Shared T vs actual cash; gift/carry Direct one-creditor | §5 | Seq 3–6 |
| `personal_settlement_cash_legs`; no counterparty account ids | §5 | Seq 3 |
| Multi-creditor partial debit | §5 | Seq 3 |
| Insights classification incl. gift | §6 | Seq 4–5 |
| `日常 \| 旅行` + visual AC | §7, ADR 0007 | Seq 5 |
| Affiliations | §8 | Seq 3, 5 |
| Interval backfill + accepted-only participation | §9 | Seq 3 |
| `personal_account_events` not `financial_events` | Repository facts | Seq 3 |
| Deploy order | §11 | Seq 8–11 |

---

## Open implementation choices

Confirmed product decisions above are closed. Remaining:

### 1. Funding wrapper vs extending `create_expense`

- **A:** New `public.create_expense_with_funding` calling `public.create_expense` then `link_expense_funding` in one function.  
- **B:** Add optional trailing args to `create_expense` (new signature; update every GRANT/test).  
- **Recommendation: A** — keeps Phase 5 `create_expense` tests stable.

### 2. Catch-up batch size

- Locked minimum: bounded, with continuation. **Recommend 24** unless pgTAP shows timeouts; then 12. Not a product question.

### 3. Derived occurrence `request_id`

- **A:** UUID v5 from a documented namespace UUID + `rule_id::text || ':' || scheduled_for`.  
- **B:** Dedicated `occurrence.expense_request_id` stored at occurrence insert.  
- **Recommendation: A plus persist the uuid on the occurrence row** so retries never re-hash incorrectly.

Do not reopen: global vs per-currency default; unknown-balance copy; gift vs carry; Direct-only V1 overpay; interval visibility; journal vs double-entry; `financial_events` reuse.
