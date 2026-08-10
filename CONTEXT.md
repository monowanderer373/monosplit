# MonoSplit

A mobile-first travel expense splitting app. Groups of people log shared expenses, split them, and settle up debts across possibly different currencies.

## Language

### Settlement

**Settlement Payment**:
A record that a debtor paid money toward what they owe, in a chosen repay currency, split across one or more creditors via its allocations.
_Avoid_: Transaction, repayment record

**Allocation**:
The portion of a Settlement Payment's total amount assigned to one specific creditor, expressed in the debt's own currency (not the repay currency).
_Avoid_: Split, share

**Debt Budget**:
The maximum amount (in the debt's own currency) that a Settlement Payment's allocations may sum to, derived by converting the payment's repay amount through its FX rate. Allocations exceeding the debt budget are over-allocated.
_Avoid_: Cap, limit

**Repay Currency**:
The currency the debtor actually pays in, which may differ from the currency the underlying debt is denominated in. When they differ, a rate converts between them.
_Avoid_: Payment currency

**Quick Settle**:
A one-tap shortcut that records a full-amount Settlement Payment from one debtor to one creditor, with no currency conversion and no allocation editing.
_Avoid_: One-click pay

**Counterparty Balance**:
The net standing between one person and one creditor in a given currency, made of a direct amount (what the person owes the creditor), a reverse amount (what the creditor owes the person, offsettable), and the net amount after offsetting.
_Avoid_: Debt pair, balance row

**Contra** (or **Reverse Amount**):
The portion of a counterparty balance that offsets in the opposite direction — what the creditor already owes the person — netted against the direct amount before a debt is considered outstanding.
_Avoid_: Offset, netting

**Unapplied Amount**:
The portion of a Settlement Payment's allocations that could not be matched to any outstanding debt at the time it's displayed (e.g. because the underlying expense changed after the payment was recorded).
_Avoid_: Excess payment, leftover
