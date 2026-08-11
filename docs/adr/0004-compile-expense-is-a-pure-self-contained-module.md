# `compileExpense` is a pure, self-contained module — not a thin wrapper over pre-computed state

`ExpenseForm.tsx`'s `submit()` mixed four different jobs in one ~195-line function: validating the wizard form, deciding which `splitCalc.ts` function to call based on `splitMode`/`expenseType`, assembling the final `Expense` payload, and driving component side effects (`setError`, `window.alert`, clearing the draft). The validation itself depended on two values (`itemizedSummary`, `receiptSummary`) that were `useMemo`s living in the component, computed from the same raw `form` state.

## Decision

`src/lib/compileExpense.ts` owns the whole "form → `Expense`" pipeline as one pure function:

```ts
compileExpense(form: FormState, ctx: { group, rateInfo, initialExpense? }): CompileExpenseResult
```

It is **self-contained**: `computeItemizedSummary` and `computeReceiptSummary` (the two "does this tally with the total" calculations) live in this module and are called both by `compileExpense` internally for validation, and by `ExpenseForm.tsx`'s own `useMemo`s for live-typing feedback and the receipt-auto-amount effect. There is exactly one implementation of "what does this itemized/receipt input add up to" — the component and the validator can no longer drift apart.

`FormState` (the wizard's draft shape) is now defined here, not in `ExpenseForm.tsx`. The component imports it. This flips the dependency direction to match `settlementCommands.ts`: business logic owns its input/output types, the UI component consumes them — not the other way around.

## Error shape: typed `errorKey` + raw numeric payload, not ready-to-display strings

Failures are a discriminated union tagged by `errorKey` (`'no_travellers' | 'missing_description' | ... | 'itemized_mismatch' | 'percentage_mismatch' | ...`). The two error kinds whose message needs an interpolated number carry that number on the result (`{ errorKey: 'itemized_mismatch', diff }`, `{ errorKey: 'percentage_mismatch', totalPct }`) instead of a pre-formatted string. `ExpenseForm.tsx` owns turning an `errorKey` into a localized, interpolated message via `t()` — `compileExpense` has no knowledge of `i18n` or display formatting. This mirrors the `settlementCommands.ts` error-code pattern from ADR 0001.

## Preserved exactly: the `window.alert` for itemized mismatch, and two now-i18n'd hardcoded strings

The itemized-mismatch path is the only validation failure that pops a `window.alert` in addition to the inline error — that asymmetry was kept as-is; `compileExpense` only reports `errorKey: 'itemized_mismatch'`, and `ExpenseForm.tsx` still calls `window.alert` when it sees that key, unchanged from before.

Two error strings (`"Percentages must add up to 100%..."`, `"Enter at least one share to split."`) were hardcoded English with no `t()` call, unlike every other validation error in this form. Since every `errorKey` now needs a caller-side message, these two got real i18n keys (`error.percentageMismatch`, `error.sharesAllZero`) as a natural byproduct — the English text is unchanged, Chinese is now available where it wasn't before.

## Known pre-existing dead branch, kept as-is

`shares_all_zero` is unreachable through the public validation path: `getActiveSplitPersonIds` already filters `splitPersonIds` down to people with a positive share value for `splitMode: 'shares'`, so "all shares are zero" always means `activeSplitPersonIds` is empty first, which trips the earlier `missing_split` guard before the shares-specific check ever runs. This dead branch existed in the original `submit()` too; it was ported unchanged rather than removed, since removing it is an unrelated behavior change outside this refactor's scope. Documented here so it isn't mistaken for new dead code introduced by this extraction.

## Consequences

- `ExpenseForm.tsx`'s `submit()` shrank from ~195 lines of validation/dispatch/assembly to a single `compileExpense` call plus an `errorKey → t()` mapping.
- The component's `itemizedSummary`/`totalTaxPct`/`effectiveRate` local `useMemo`s were removed entirely — they existed only to feed the old inline validation and had no other reader (confirmed via search; `receiptSummary` was the only one with a genuine second consumer, the receipt-auto-amount `useEffect`, and it was kept, now backed by `computeReceiptSummary`).
- `compileExpense.test.ts` covers the happy path per expense type, every `errorKey` branch (including documenting the dead `shares_all_zero` branch's real trigger path), the refund override, repaid-state carry-over on edit, and manual-rate conversion — all without touching React or the DOM.
