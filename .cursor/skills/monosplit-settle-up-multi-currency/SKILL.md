---
name: monosplit-settle-up-multi-currency
description: Implements and protects MonoSplit settle-up flows when debts exist in multiple currencies. Use when changing settle-up math, repay currency behavior, record-payment logic, contra offsets, or multi-currency repayment UI in MonoSplit.
---
# MonoSplit Settle Up Multi Currency

## Use This Skill When

- The task changes `SettleTab` or `SettlePaySheet`
- The user mentions `settle up`, `record a payment`, `repay currency`, `contra`, or `multiple currencies`
- A repayment flow is incorrectly mixing `JPY`, `MYR`, `USD`, or other debt currencies
- You need to decide which debts can be settled together

## Canonical Rule

Do not combine debts from different original debt currencies into one settlement action.

If a user owes money across multiple currencies:

- do not sum them into one displayed payable amount
- do not mark all currencies as repaid from one button press
- do not let a single settlement action accidentally clear unrelated debt currencies

## Repay Currency vs Debt Currency

Keep these separate:

- `debt currency`: the original currency of the debt item
- `repay currency`: the currency currently selected in the UI for the payment flow

The UI may convert a single debt currency into the selected repay currency for display, but it must not merge different debt currencies into one repayment group.

## Canonical Flow

### 1. Group debt by original currency

Before opening `Record a payment`, determine which debt currencies are present for that debtor.

### 2. If only one currency exists

- open directly
- allow display conversion if user selected a different repay currency

### 3. If multiple debt currencies exist

- require the user to choose or switch to one matching debt currency first
- only open the payment view for that selected debt currency
- show a clear hint that only one currency group is being shown

## Record Payment Rules

When the user records a payment for a selected debt currency:

- only mark direct debts for that selected currency as repaid
- only apply contra logic inside that same debt currency group
- only apply redirect logic against that same debt currency group
- do not call helper actions that blindly mark all debtor splits across all currencies

## Contra Rules

Contra offsets should stay bounded by the active settlement currency.

If the payer owes the debtor back in another currency, that is not part of the current settlement action.

## UI Rules

Recommended behavior:

- show a warning or hint when the debtor has multiple debt currencies
- if current `Repay Currency` does not match any available debt currency for that debtor, block entry and show a message
- once inside, show that the current payment sheet is limited to one currency group

## Files Usually Involved

- `src/components/SettlePaySheet.tsx`
- `src/components/SettleTab.tsx`
- `src/lib/settlement.ts`
- `src/lib/refund.ts`
- `src/lib/currency.ts`
- `src/lib/i18n.ts`
- `src/store/useStore.ts`

## Common Failure Modes

- summing `RM` and `JPY` debts into one large number
- using converted display totals to decide which records to mark repaid
- marking all debtor splits repaid regardless of original currency
- mixing contra offsets from different currencies
- allowing the user to enter a payment sheet even though the selected repay currency does not match the debt group they are trying to settle

## Implementation Checklist

- compute available debt currencies for the selected debtor
- choose an active settlement currency before opening the payment sheet
- filter owned items by active settlement currency
- filter contra items by active settlement currency
- make record-payment writes target only that currency
- update i18n with currency-switch guidance and "selected currency only" messaging
- verify no helper action still clears all debtor splits indiscriminately

## Verification

Check at least these scenarios:

1. Debtor owes only one currency -> payment flow opens normally.
2. Debtor owes multiple currencies -> app does not sum them into one total.
3. Wrong repay currency selected -> app blocks entry and tells user to switch.
4. Correct repay currency selected -> app opens only that currency group.
5. Recording a payment marks only the selected currency's debts repaid.
6. Contra offsets do not cross currencies.
7. Refreshing after settlement preserves the correct unpaid items in the other currencies.
