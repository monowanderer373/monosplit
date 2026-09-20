# Owner-private multi-leg personal account journal

Canonical Expense, payer contributions, expense shares, and Phase 5 settlements remain the **shared** money model (`docs/adr/0006-tabby-tally-relational-canonical-expense.md`, `F = E - T + R`). Personal accounts are a **second**, owner-only **append-only transaction journal with one or more account entries**. Linking a journal row to an expense or settlement **must not** rewrite those shared rows.

This is **not** formal double-entry accounting. Opening, income, and ordinary expense funding may have a single entry. Cross-currency transfers cannot be balanced by summing different currencies. Do not require “balanced legs” as a global invariant.

Person is not an account owner principal. The owner is `participants.kind = 'account'` (`public.participants`), resolved by `public.current_participant_id()`.

## Status

Proposed — 2026-09-21. Do not mark Accepted in this round.

## Account

`account_class`: `asset` | `liability`  
`account_type`: `cash` | `bank` | `ewallet` | `credit_card` | `paylater` | `loan`

Check: `cash|bank|ewallet` ⇒ asset; `credit_card|paylater|loan` ⇒ liability.

Fields: `owner_participant_id` (must reference `participants.kind = 'account'`), `name`, `currency` (`[A-Z]{3}`), `archived_at`, `is_default`, `opening_status` (`unknown` | `posted`), `opening_balance_as_of` (null iff unknown), `version`, timestamps, `client_request_id` (uuid, unique per owner).

**Single opening source:** no `opening_minor` column. Known opening is exactly one `personal_account_transactions.kind = 'opening'` with exactly one entry on that account as of `opening_balance_as_of`. `opening_status` may be cached **only** with a constraint or guarded RPC guaranteeing:

- `unknown` ⇔ zero opening transactions
- `posted` ⇔ exactly one opening transaction

**V1 default payment account (locked):** at most **one** active global default among `cash | bank | ewallet` per owner (`archived_at is null`). Not one default per currency. The first eligible asset becomes that global default. Quick Add always starts with it. Choosing another account for one record does not change the default. If expense currency ≠ default account currency, use actual debit or pending funding. Per-currency defaults are out of V1.

Archive:

- If another eligible asset exists, the user **must** choose a replacement default in the same RPC.
- If none remain, archive is allowed, the owner has no default, and Quick Add must request an account or allow explicitly unlinked/pending. Do not make the last account impossible to archive.

Onboarding: one common account (name, type, currency; opening optional). Unknown ≠ zero.

Two later owner actions:

1. “Balance before bookkeeping” → create/complete the **opening** transaction as of a chosen date.
2. “My real balance today” → `kind = 'reconciliation'` delta versus current book. Never rewrite opening.

### Unknown opening display (locked)

- Never treat unknown as zero.
- The individual account displays **`余额待完善`**.
- It does not trigger negative/insufficient-balance warnings.
- All-accounts currency totals that include any unknown-opening account show only **`已知余额`** (sum of accounts whose opening is posted, plus those accounts’ later entries) and the count of accounts awaiting completion. Do not present that subtotal as a complete total.

## Journal: transactions and entries

`personal_account_transactions`: `id`, `owner_participant_id`, `client_request_id` uuid unique per owner, `kind`, `occurred_on`, `memo`, `posted_at`, `reversed_at` nullable, `reversal_transaction_id` nullable, `expense_id` nullable, `settlement_allocation_id` nullable, `installment_id` nullable, `reverses_transaction_id` nullable, `version`.

There is **no** `status` that drops original entries from the balance sum.

`kind` check: `opening` | `reconciliation` | `income` | `refund` | `expense_funding` | `transfer` | `liability_purchase` | `liability_repayment` | `interest_fee` | `settlement_out` | `settlement_in` | `gift_out` | `gift_in` | `reversal`.

`personal_account_entries`: `transaction_id`, `account_id`, `amount_minor` bigint ≠ 0, `currency` = account currency.

**Sign:** positive `amount_minor` increases that account’s displayed book balance; negative decreases it.

**Effective balance** = sum of **all** journal entries for the account, including original rows and compensating reversals. Do not filter on `reversed_at`.

Home **available** = that sum for non-archived `cash|bank|ewallet`, **per currency**, subject to the unknown-opening aggregate rule above. Liabilities, credit limits, and unpaid future installments are not available money.

### Kind-specific entry invariants (RPC + CHECK/trigger)

| kind | Entries |
|---|---|
| `opening` | Exactly one entry on the target account. |
| `reconciliation` | Exactly one delta entry. |
| `income` | Exactly one **positive** asset entry. |
| `refund` | Exactly one **positive** asset entry. Optional `expense_id`; does not mutate expense totals. |
| `expense_funding` | Exactly one **negative** asset entry. Requires Canonical Expense. Amount is in the **account** currency. |
| `liability_purchase` | Exactly one **positive** liability entry. Optional **additional** negative asset entry only when there was an actual asset payment/down payment. Liability amount is the **actual billed principal in the liability account currency**, which may differ from expense currency. |
| `transfer` same currency | Exactly two **asset** entries; source negative, destination positive, equal absolute amount. |
| `transfer` cross-currency | Exactly two entries; source negative, destination positive; explicit amount in each currency; **do not** require numeric sums across currencies. |
| `liability_repayment` | Asset negative and liability negative; explicit amount in each account’s currency (may be cross-currency). |
| `interest_fee` | Canonical Expense plus its actual funding entry (same rules as `expense_funding` or `liability_purchase` depending on the fee’s funding account). |
| `settlement_out` | Exactly one negative asset entry. Owner is the debtor. No Canonical Expense. |
| `settlement_in` | Exactly one positive asset entry. Owner is the creditor. |
| `gift_out` / `gift_in` | Exactly one asset entry (negative / positive). Extra cash beyond shared `T`. Insights classify as personal gift cash-flow. Never `income` with a negative amount. Never `expense_funding` without an expense. |
| `reversal` | Exact opposite entries copied from **one** original transaction (same accounts, negated `amount_minor`, same currencies). |

## Reversal (locked)

- Original transaction and entries remain immutable and **included** in the journal and in balance aggregation.
- Reversal creates a **new posted** `kind = 'reversal'` transaction with exact opposite entries.
- Original may receive `reversed_at` and `reversal_transaction_id` for UI only.
- At most one row may have `reverses_transaction_id = original.id`.
- Reversal of a reversal is **forbidden**. A further correction is a new compensating journal, not reopening the old row.
- Test: RM100 debit then reversal returns the account to the pre-debit balance **exactly once**.

Historical expenses stay unlinked. Creating a default account must not backfill movements.

## Funding Canonical Expenses

`public.expenses.currency` and `total_minor` stay on the expense. Account entries use the **account** currency. Expense currency **need not** equal account currency.

### `personal_funding_intents`

- `expense_amount_minor` is **server-derived owner payer contribution** for this expense: `payer_contributions.amount_minor` joined through `expense_participations` where `participant_id = owner` and `state = 'accepted'` (personal expenses: the owner is the sole accepted payer, so this equals `expenses.total_minor`). **Never** copy the group total silently.
- V1: **at most one** funding account per owner per expense. Unique active (`pending`|`posted`) intent on `(expense_id, owner_participant_id)`. Split-wallet funding is **not** supported.
- Same-currency: `account_amount_minor` may default to that contribution.
- Cross-currency: owner supplies actual debit in account currency; no guessed rate.
- Unknown actual: save expense + shares; intent `pending`; **no** journal entry. Home 「待处理」 and the account page list it. Completing posts **one** journal (`expense_funding` or `liability_purchase`); does not recreate the expense or change accepted shares.

### Credit card / PayLater / installments vs expense currency

Example: purchase ₫300,000; card currency MYR; actual billed principal RM56.80.

- Canonical Expense remains ₫300,000.
- Card liability increases **RM56.80**.
- Installment schedule is generated from **RM56.80**, not ₫300,000.

If billed liability is unknown at purchase: save expense and sharing; `personal_funding_intents` pending (and plan `pending_principal`); do not guess FX; **do not** generate a final installment schedule until principal is known. Completing the intent posts `liability_purchase` **once** and generates the plan **once** (idempotent).

Repayment may be cross-currency: explicit asset decrease and liability decrease in their own currencies (`liability_repayment`).

## Settlement cash (owner-private)

Do **not** store either party’s `account_id` on `public.settlement_payments`, `public.settlement_allocations`, `public.settlement_payment_requests`, `public.financial_events.safe_diff`, or any row the counterparty can SELECT.

Use `public.personal_settlement_cash_legs` (owner RLS only). `public.respond_to_settlement` may consume authorizations as `security definer` and **must not return** account ids (`jsonb` today returns `allocation_state`, `payment_status`, `payment_version` only — keep it that way).

Preserve `settlement_payments.amount_minor` as **shared `T`**. Actual wallet movement is `personal_settlement_cash_legs.cash_amount_minor`.

- Normal/partial: actual cash = shared `T` (per accepted allocation).
- Carry forward (V1: **Direct, one creditor only**): full actual cash enters shared `T`.
- Gift/waiver (V1: **Direct, one creditor only**): shared `T` capped to debt cleared; actual cash may be larger; extra = actual − `T`; extra does not change `F`.
- Group/Space **multi-creditor overpayment is out of V1** — do not guess extra-cash distribution.

Cash legs post **per accepted `settlement_allocations` row**, not once for the whole payment. Declined allocations post nothing. Partial confirmation must not debit the payer for unaccepted allocations. Unique `(settlement_allocation_id, owner_participant_id, role)`.

## Privacy and audit

RLS: owner participant only on all `personal_*` money tables. Counterparties cannot select another user’s accounts, entries, intents, or cash legs.

Do **not** reuse `public.financial_events` for these rows. That table’s check `num_nonnulls(expense_id, settlement_payment_id, space_id) = 1` and `financial_events_select_visible` (readable by anyone who can read the parent expense/settlement/space) **cannot** satisfy wallet privacy. V1 adds owner-only `public.personal_account_events`.

## What this ADR does not change

`F = E - T + R`, accepted allocations, Phase 5 correction lineage, Manual Participant UUIDs, `public.financial_events` shape.
