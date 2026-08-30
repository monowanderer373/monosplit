---
name: monosplit-settle-up-multi-currency
description: Marks the removed floating-point MonoSplit settle-up flow obsolete and points settlement work to Tabby Tally relational allocations.
---

# Obsolete: legacy settle-up engine

`SettleTab`, `SettlePaySheet`, `settlementLedger`, `settlementCommands`, refund
helpers, and mutable split repayment flags have been removed.

Current settlement work must:

- use integer minor units
- derive balances from Canonical Expenses and accepted Settlement Allocations
- keep contexts and currencies separate
- use relational settlement repositories and database commands
- preserve recipient confirmation, decline, reversal, contra, and unapplied
  amount semantics from `CONTEXT.md`

Do not recreate floating-point balance math or settlement state inside expense
shares.
