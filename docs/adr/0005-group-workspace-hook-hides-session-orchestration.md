# `useGroupWorkspace` hides `GroupPage`'s auth/sync/role orchestration behind a decision-only interface

`GroupPage.tsx` mixed tab/modal UI state with a large tangle of session orchestration: calling `useAuth`/`useGroupSync` directly, auto-claiming unclaimed groups, auto-registering a `user_groups` membership row, computing five different `can*` permission booleans from `role`, building a debug-diagnostics string field-by-field, and a bespoke "save expense, and if it fails because of a missing membership row, backfill the row and retry" recovery flow inlined into `ExpenseSheet`'s `onSave`. None of this was independently testable — it was all effect timing and derived state living inside one component.

## Decision

`src/hooks/useGroupWorkspace.ts` is the sole caller of `useAuth`/`useGroupSync`/the raw `user_groups` read for a group route. It returns a **nested, decision-only** interface grouped by domain:

```ts
{
  group, authUser, authLoading,
  access: { role, canEditTrip, canInvite, canManageTravellers, canEditExpenseData, canUseSettle, hasAccess, membershipByUserId, updateMembershipRole },
  sync: { status, lastError, ownerId },
  identity: { linkedPerson, availableIdentityPeople, claim, createNew },
  invite: { copyShareLink, busyRole, linkCopied },
  diagnostics: { text, show, copy, copied, repair, canRepair, repairing, notice },
  saveExpenseWithRecovery(nextGroup),
}
```

`GroupPage.tsx` no longer knows *how* a role was derived, *when* auto-claim or auto-registration ran, or that a diagnostics panel's visible fields and its copy-to-clipboard text used to be built from two separate code paths. It only reads settled results (`access.role`, `diagnostics.show`, …) and calls actions (`identity.claim(id)`, `saveExpenseWithRecovery(group)`).

## Testing strategy: extract pure decision logic, don't unit-test the hook

Per the grilling decision, the hook body itself (`useEffect`, `useState`, calls into `useAuth`/`useGroupSync`) is **not** unit-tested — doing so would require React Testing Library + jsdom, which this repo doesn't otherwise use. Instead, every piece of logic that has a *decision* shape (as opposed to *plumbing* shape) was extracted into `src/lib/groupWorkspace.ts` as plain functions and tested with ordinary Vitest:

- `shouldAutoClaim(...)` — the boolean condition that used to be four sequential `if (...) return` guards inside the auto-claim `useEffect`.
- `shouldRegisterMembership(...)` — same shape, for the auto-register-membership `useEffect`.
- `buildDiagnosticsText(t, input)` — the field-by-field diagnostics string, now the single source of truth for both the visible debug panel and the clipboard copy (previously two separate, slightly different implementations — see Consequences).
- `saveExpenseWithRecovery(deps, input)` — the retry control flow (save → on failure, backfill membership → retry), with `save`/`registerMembership` injected as dependencies so the retry branching can be tested without Supabase or the store.

`useGroupWorkspace.ts` itself only wires these pure functions to the actual `useEffect`/`useState`/`useAuth`/`useGroupSync` calls; it contains no decision logic of its own to test.

## Interface hides raw `ownerId` behind `diagnostics.canRepair`

The "show repair-access button" condition (`authUser && ownerId !== authUser.id`) used the *raw* `ownerId` from `useGroupSync` (which can be transiently `null` before the group's own `ownerId` field is known), while the visible/copyable diagnostics text always displayed the *fallback* `ownerId ?? group.ownerId`. Exposing a single `sync.ownerId` field would have forced a choice between these two, changing one behavior. Instead the repair-button decision is computed once, inside the hook, as `diagnostics.canRepair: boolean` — `GroupPage.tsx` never sees the raw vs. fallback distinction at all.

## `saveExpenseWithRecovery` is exposed as one action, not as save + a retry knob

The membership-backfill-and-retry recovery flow only ever runs from one call site (`ExpenseSheet`'s `onSave`) and was already tangled with `authUser?.id`/`ownerId` comparisons in `GroupPage.tsx`. Rather than exposing `saveGroupNow` and letting the page re-implement the retry, the hook exposes the whole recovery flow as `saveExpenseWithRecovery(nextGroup): Promise<{ ok, error }>` — the page only sees the outcome.

## Consequences

- `GroupPage.tsx` shrank from owning ~15 pieces of derived/effectful state to owning only tab/modal UI state (`activeTab`, `expenseComposerOpen`, `settlePayOpen`, `groupEditOpen`, edit-form fields) plus store action wiring.
- The visible diagnostics panel and the copy-to-clipboard text used to be two independently-maintained implementations that had already drifted in formatting (bold `<p>` labels vs. plain lines). They are now one implementation (`buildDiagnosticsText`); the panel renders that same string with `whitespace-pre-line` instead of one `<p>` per field. This is a minor visual simplification (loses per-field bold labels) traded for eliminating a duplication bug class — acceptable for a developer-facing debug panel.
- `useGroupWorkspace` has exactly one call site (`GroupPage.tsx`), so it doesn't gain leverage from reuse across call sites. Its value is locality (auth+sync+role+identity+invite+diagnostics decisions live in one findable module instead of scattered through a 590-line component) and testability (`groupWorkspace.test.ts` covers the four decision functions above without any DOM or Supabase setup), not reuse.
- `groupWorkspace.test.ts` covers: `shouldAutoClaim`/`shouldRegisterMembership` for every guard branch, `buildDiagnosticsText` for the "none" fallback and linked-person formatting, and `saveExpenseWithRecovery` for the happy path, the recovery-then-succeed path, and the recovery-then-still-fails path.
