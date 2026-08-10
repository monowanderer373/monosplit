# Settlement commands are pure functions, not store actions

`src/lib/settlementCommands.ts` (`recordPayment`, `quickSettle`, `editPayment`) validates a settlement payment intent and returns either the data to persist or a typed error (`SettlementCommandResult`) — it never calls into the Zustand store itself. Callers (`SettlePaySheet.tsx`, `SettleTab.tsx`) own the actual `addSettlementPayment` / `updateSettlementPayment` calls.

We chose this over having the commands call the store directly because the store is the one dependency every call site already has for free, so wrapping it would only shrink three call sites by one line each while making the module untestable without mounting the store and coupling it to Zustand. Keeping it pure means the FX-budget validation and allocation math — previously duplicated three times with subtly different bugs — is now unit-tested in isolation and the store stays the single place that decides how a payment is committed.
