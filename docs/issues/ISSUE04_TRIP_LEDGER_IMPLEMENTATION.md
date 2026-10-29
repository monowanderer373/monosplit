# Issue 04 — Compact Trip ledger

2026-10-29. Implementation in progress on feat/compact-trip-ledger, baseline main ec0c067523df8569dba37656b98175ca067e4f59. Only Issue04; preserve01–03, Group/Direct and mixed /spaces; no05.

## Implemented

- Shared Trip /space/:id now has compact name/status/date/Members header, one directional collect/pay summary per original currency, Expenses/Balances tabs defaulting to Expenses, and the existing global+ as its sole add entry. Travel personal-spending overview remains separate.
- Summary aggregates original deriveRelationalDebtLines results, including cleared-allocation/SharedReset interpretation; never nets collect against pay across counterparties or currencies, never counts pending as accepted. Missing/error data is unavailable, not zero. Explicit amounts and accessible labels respect privacy.
- Expense rows retain total/payers/own share, historical principal names, original editor/read-only policy, outbox recovery and re-tag. First20rows plus Show more; full count/recap/debt inputs remain complete. Per-expense history opens from original sheet.
- One shared guarded settlement read/controller feeds current actions and summary/history. Trip repayment opens original Full/Partial intent and preview; pending review/outgoing cancel remain current. Original accepted-allocation reversal is adjacent to its History record. Group/Direct default expanded/history behavior retained.
- History expense changes/payments/activity and original recap are requested from the menu using same-Trip query views, with current-context global+; only selected expensive content mounts. Activity uses the original authorized query/coalescing with complete paging on request; no capped Trip history masquerades as complete.
- Trip-only memory stores retain payment draft, original retry UUID/date and in-flight lock across tab/views/unmount return; no money facts are written to UI memory or synthesized. Original transactional/versioned/idempotent commands remain authoritative. New account/Trip reads cannot reveal old data; no extra auth privileges or private account write path.
- Trusted same-Trip query-view Back, separate tab scroll/first batch, focus restoration and original Members/date routes preserved. No schema/migration/dependency or financial-engine change.

## Current evidence

Baseline798units/115files PASS37.43s. Current full817units/119files PASS43.19s;19focused model/controller/identity/navigation PASS2.15s. Integrated39actualReact/CSS browsercases PASS1.6min:12ledger+14dates+13Members, including four phone widths,125–200%roottext, shortviewport, Chinese/large multi-currency amounts,27rows/full844recap, pending/accept/reverse shared model, drafts across History/Members/date return, unique contextual+, privacy/readonly/closed and legacy sections. These browser data APIs are synthetic fixtures; not backend/RLS or physical-device evidence.

Lint/TypeScript passed after immutable UI-array boundary and test typing fixes. Fresh production read confirms33exactrepository migrations and original date RPC role/version/ACL; no new SQL needed. Native isolated payment→confirmation→cash→reversal/expense immutability/read-only test passed in intermediate10caseTrip/multiuserCI; final source CI still required. Full exact-source CI and normal existing production verification pending. Local Docker vfs blocker not retried; use disposable GitHub Actions backend. Physical Honor/native OS keyboard/browser UI zoom/screen reader NOT RUN.

## Recovery

Read PROJECT_STATUS/WORK_LOG/current diff and /workspace/verification/issue04-trip-ledger-2026-10-29. Complete final source checks/CI, existing GitHub/Vercel release and authenticated owned-QA read-only/PWA verification under standing authorization. Never reset/reseed production, replay old SQL or use real customer financial QA writes. No Issue05 changes.

Final visual witness: valid explicit grid rows prevent Pay from covering amount; fourwidths×100/125/150/200% assert amount/Pay/help separation and44px target. Current14ledgerUI PASS; Group/Direct and expanded original forms unchanged.
