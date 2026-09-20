# Recurring bookkeeping is owner catch-up, not a bank debit

`CONTEXT.md` currently says a Recurring Draft never becomes a Canonical Expense without review. Product V1 also allows `auto_post`: due occurrences are booked when the **owner-authenticated client** calls an idempotent catch-up RPC (app launch / login / resume). This is bookkeeping automation. It is not a real bank debit and never impersonates the user via service-role cron in this phase.

Do not edit `supabase/migrations/202608300004_capture_templates_recurring.sql` or Phase 5 in place. Add forward-migration tables. Keep existing `public.recurring_rules` / `public.recurring_drafts` for capture-template review (`src/lib/captureRepository.ts`, `public.respond_to_recurring_draft`). V1 typed auto-post uses **new** `public.personal_recurring_rules` / `public.personal_recurring_occurrences` because current `default_draft_fields` **forbids amounts** (`public.jsonb_contains_amount_key`).

Installment repayment is **not** a recurring expense rule (plan §4 / ADR 0009). Credit/PayLater/loan schedules live in installment tables.

Existing helper `public.next_recurring_local_date(scheduled_for date, cadence text, anchor_day integer)` already distinguishes weekly (`+ 7 days`) from monthly (clamp `anchor_day` 1–31). New personal rules must **not** reuse one `anchor_day 1–31` field for weekly.

## Status

Proposed — 2026-09-21. Do not mark Accepted in this round.

## Cadence fields (locked)

`cadence` check: `'weekly' | 'monthly'` (same vocabulary as `public.recurring_rules.cadence`).

- Monthly: `anchor_day_of_month integer` 1–31; `anchor_weekday` must be null. Month-end clamp: 31 in a 30-day month → last local date; February likewise. Implementation may call `public.next_recurring_local_date` for monthly.
- Weekly: `anchor_weekday integer` ISO 1–7 (Monday–Sunday); `anchor_day_of_month` must be null. Next due is the next local date matching that weekday on or after `start_on` / after last `scheduled_for`.

Check: exactly one of the two anchors is non-null, matching `cadence`.

Confirmed product examples (rent, phone) are monthly; weekly is still in V1 because capture templates already support `weekly`, but it uses `anchor_weekday`, not `anchor_day`.

## Rule payload (typed, sufficient to post)

Personal V1 rules are `scope = 'personal'` only. Shared Direct/Space recurrence stays on `public.recurring_drafts` + `public.respond_to_recurring_draft`. Auto-post must not skip counterparty `public.respond_to_direct_expense`.

Required fields:

- `title` / `description`, `amount_minor`, `currency` (`char(3)` / `[A-Z]{3}`), `category`
- `funding_account_id` (owner `public.personal_accounts` row; asset or liability)
- `cadence`, matching anchor, `timezone` (validated IANA name), `local_time`, `start_on`, optional `end_on`
- `posting_mode` (`auto_post` | `review`)
- `paused`, `next_due_on`, `version`

## Server-safe compile

Postgres RPCs **cannot** call TypeScript `compileLedgerExpense` (`src/lib/compileExpense.ts`). V1:

1. On rule create/update, the client still runs `compileLedgerExpense` for UX.
2. The RPC stores typed columns (not amount-bearing jsonb).
3. `public.catch_up_personal_recurring` / `public.post_personal_recurring_occurrence` re-validate the same invariants `public.create_expense` uses: positive `total_minor`, single owner participant as payer and 100% share, contribution and share arrays reconcile, currency `[A-Z]{3}`.

Posting calls `public.create_expense` with a **deterministic** `request_id` (UUID) derived from `(rule_id, scheduled_for)` — e.g. UUID v5 in a documented namespace — so retries do not mint a new `client_request_id`. `public.expenses` uniqueness remains `(created_by, client_request_id)`.

## Catch-up time and bounds

`public.catch_up_personal_recurring()` takes **no caller `as_of` in production**. The server derives “today” as `timezone(rule.timezone, now())::date` per rule. An authenticated user cannot pass a future date to post future bills.

If tests need a clock override, use a **separate** test-only function that is not `GRANT`ed to `authenticated` (or only exists in pgTAP).

Bounded catch-up: process at most **24** due occurrences per call across the owner’s rules (stable order: `next_due_on`, `rule_id`). Return `{ processed, failed, remaining }`. The client continues on resume until `remaining = 0`.

## Occurrence identity, snapshots, states

Unique `(rule_id, scheduled_for)` where `scheduled_for` is the **rule calendar date**, not an override date.

States: `pending_review` | `posted` | `skipped` | `failed` | `reversed`.

Override/snapshot columns for “edit one”:

- `effective_amount_minor`, `effective_currency`, `effective_account_id`, `effective_occurred_on`
- Null means “use the current rule”. Overrides must be written **before** post. After post they are snapshots of what was posted; further changes require reverse + new occurrence, not an UPDATE of posted money.

Catch-up for each due `scheduled_for <= server_today`:

- `auto_post` → `public.create_expense` with `occurred_on = coalesce(effective_occurred_on, scheduled_for)` and attempt funding (ADR 0009). Unknown opening or pending FX funding does not block the expense. Negative available funds do not block posting. Status `posted`, or `failed` with sanitized error **code** (no SQLERRM dump).
- `review` → `pending_review`. Confirm uses `public.post_personal_recurring_occurrence`.

## Failed post without orphan expenses

Inner PL/pgSQL block with a **subtransaction**:

```text
BEGIN
  -- create_expense + funding
  occurrence.status := posted
EXCEPTION WHEN OTHERS THEN
  -- maps SQLSTATE/message to a short error_code allowlist
  occurrence.status := failed
  occurrence.error_code := sanitized
  -- do not re-raise; outer function continues
END
```

If `public.create_expense` succeeds and funding fails, the same block **must roll back the expense insert** (the exception aborts the subtransaction) so no orphan expense remains. Retry uses the same derived `request_id`; if an expense already exists from a previous success, treat as posted.

Do not `UPDATE` a posted expense’s `total_minor`.

## Owner operations

Pause/resume; skip one; edit one (overrides before post, or reverse+repost after); edit future (rule `version` bump; already posted rows unchanged); reverse a posted occurrence via `public.cancel_expense` / the appropriate Phase 5 correction RPC plus a compensating personal-account journal (ADR 0009). Unique one active reversal per occurrence.

## What this ADR does not change

Phase 5 Direct/Space confirmation (`public.respond_to_direct_expense`, `public.propose_direct_expense_change`). Manual Participant identity. Bank connectivity. `public.recurring_rules` amount-less jsonb.
