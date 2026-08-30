# Tabby Tally private beta gate

## Goal

Validate that 8–15 invited testers can record private and shared expenses,
confirm direct splits, and settle a trip without a privacy or money mismatch.

## Test Setup

- Use at least one iPhone Safari and one Android Chrome device.
- Include two permanent accounts and one anonymous invited guest.
- Install the PWA and test the **Quick tally** app shortcut.
- Run one device offline, add an expense, reconnect, and verify exactly one row.
- Record the app version, tester identities, currencies, and space ID for every
  mismatch report. Do not copy access tokens or invite tokens into feedback.

## Core Tasks

1. Sign in and save an amount-only personal expense in under five seconds.
2. Create a Trip space and invite:
   - one `full_access` account
   - one `view` account
   - one anonymous guest
3. Add an equal shared expense whose minor-unit remainder is visible.
4. Add an exact shared expense with multiple payers.
5. Verify `view` cannot write and `full_access` can only void their own expense.
6. Create a secure friend invite and accept it from the second account.
7. Record a Direct Split, then verify it stays pending until that friend accepts.
8. Add a manual untracked person and verify their share explains the advance but
   never appears as an account balance.
9. Propose a partial same-currency settlement. Verify no balance changes until
   the recipient confirms it.
10. Reverse the recipient's confirmed allocation and verify the debt returns
    with an activity event.
11. Remove a space member. Verify they lose current space browsing but retain
    only their own relevant financial history.

## Feedback Questions

1. What were you trying to do when you felt confused?
2. Did **paid**, **your spending**, **tracked**, **pending**, and **untracked**
   mean what you expected?
3. Could you tell which Direct Split still needed confirmation?
4. Did the Group/Trip balance match a hand calculation for every currency?
5. Was it clear that a proposed settlement had not changed the balance yet?
6. Did any role expose a button or record it should not have exposed?
7. Did offline sync ever duplicate, lose, or falsely mark an expense as saved?
8. What made the app feel unfinished or untrustworthy?

## Success Criteria

- Unit tests, lint, production build, production dependency audit, migration
  reset/lint, RLS tests, and critical browser tests pass in CI.
- Personal, Direct, and Space records never cross an unauthorized identity.
- Every payer contribution and expense share reconciles exactly in integer minor
  units; currencies are never combined.
- Duplicate request IDs create one expense, one settlement, and one audit event.
- A familiar tester records an amount-only expense in under five seconds.
- Two accounts independently calculate the same post-confirmation balance.
- No unexplained mismatch, duplicate, permission bypass, or silent data loss
  remains open.

## Stop-ship conditions

- Guessed IDs expose another user's personal or unrelated Direct record.
- Anonymous, `view`, removed, or non-member users can mutate a space.
- Pending Direct shares or pending settlement proposals affect balances.
- Offline retry creates duplicates or an optimistic row is presented as server
  confirmed after rejection.
- A migration cannot be reapplied to a clean local Supabase stack.
