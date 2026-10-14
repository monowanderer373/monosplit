# Home notification actions

## Diagnosis and evidence

Before this change, `HomeScreen` rendered Account tasks as plain `li`/`p` text. No row button, entity navigation, or route consumer existed. `loadPersonalAccountHome` reduced funding intents to pending IDs, and `accountAttentionSources` produced generic `funding:<id>` labels. The existing `complete_pending_funding` transactional RPC had no UI consumer. A saved canonical expense and its unposted private debit are distinct facts: this notification did not prove that the original expense submission failed.

The two identical labels can refer to different pending funding intents. The database enforces one active intent per expense/owner; the new client also deduplicates by typed object and newest numeric version. A screenshot cannot reveal the original user's UUIDs. Only newly created, owned QA principals were examined for the production reproduction: two distinct expenses plus a negative wallet reproduced all three original labels and a click with no effect.

The negative-wallet reminder is computed from a nonarchived asset account with a posted opening balance and negative entry sum. It does not identify a blocked debit; existing journal rules permit a negative asset balance. It belongs in Activity and opens the exact account.

## Source → action → lifecycle

| Type | Actual source | Exact destination | Authoritative transition |
| --- | --- | --- | --- |
| Funding | Owner-private `personal_funding_intents`, canonical expense and accessible account | Selected intent; choose missing account or supply actual foreign debit | Existing `complete_pending_funding`; posted result moves to Activity; cancelled/changed facts offer no old debit |
| Negative account | Existing private account opening/entry sum | Exact account balance; filtered records only where existing active-asset filter supports it | Verified nonnegative balance removes warning; archived account explains change without a misleading records link |
| Recurring payment | Existing occurrences and accessible rule | Exact occurrence, rule/reason/account and existing post/retry | Fresh occurrence version/status; no new scheduling or financial engine |
| Installment | Existing occurrence and plan | Exact repayment, principal/currency/account/reason | Pending-principal funding is one task; rescheduled occurrence shows actual new date and no old retry |
| Shared review | Existing Direct expense/own pending participation | Existing extracted Direct review card | Original versioned `respond_to_direct_expense`; no financial write on navigation |
| Shared change | Existing Direct correction/cancellation request | Existing change-request card | Existing transactional acceptance/rejection and authoritative history |
| Settlement | Accessible payment/allocation | Existing Collect/Pay exact article, focused and outlined | Original cash-leg/settlement service; current status removes stale confirmation |
| Payment request | Accessible request | Existing Collect/Pay exact payable request | Navigation never proposes or accepts payment; current open/withdrawn/expired state wins |
| Local failed/sync task | Original owner-bound outbox command | Existing recovery actions and original command | Original request ID/reconciliation; server-confirmed submission offers no resubmit or fake Undo |

## Authority and recovery contracts

- Stable references are typed IDs, never titles, row indexes or account names. Short visible references only help distinguish rows. Unknown kinds and external redirects are rejected.
- `homeNotifications.ts` derives source/scope/intent/version and ready/completed/changed/unavailable/login/retry results. `notificationRepository.ts` uses normal RLS reads. Query failure preserves tasks and offers Retry; it is never inferred to mean completed or inaccessible.
- Current identity, request generation and target epochs gate reads and actions. Financial dispatch rechecks the actual SDK identity after preflight, freezes that normal JWT for the dispatch, and calls the original RPC. A stale continuation cannot start a write after closing or switching identities.
- The frontend preserves uncertain drafts and opaque request fingerprints/UUIDs, then checks current authority before retrying. No monetary payload is persisted in notification read metadata. Normal database idempotency remains the final authority.
- Full accessible correction graphs and requests go to the existing history parser; optional target-chain filtering happens after parsing. A→B→C remains complete when opening any generation. Unrelated history is not displayed; invariant failures retain the existing unavailable presentation.
- Ongoing tasks and ongoing account information are never dropped by the 50-item closed-history cap. Activity sorts by actual update time; relevant expense calendar dates retain their meaning.
- Unread is separate, versioned, bounded per-auth local metadata. Opening/closing the popup never completes a task. Read status is device-local; financial completion is server-authoritative. Focus/visibility/online/periodic and realtime invalidations re-read authority.
- Safe internal URL intents survive login/profile upgrade. Closing consumes the visible intent; it does not reopen on subsequent rendering. Back restores Home context and bell focus after the actual route/dialog cleanup.

## UI and accessibility

Existing Matte Paper styling, anchored bell popup, To do/Activity tabs, full-row semantic buttons, arrows and distinct task count/unread marker. Record/account/date/reference text identifies the actual object. Popup placement measures viewport collisions, safe bottom space and resizing. Rows have at least 44 CSS px touch targets. Keyboard tab navigation, Escape, outside click, internal scroll and focus return are exercised. Amount conceal covers visible values, accessible text, tooltips and monetary inputs; explicit reveal precedes financial review.

No notification table, schema, replacement project, dependency, financial model, principal UUID, RLS relaxation or new ledger service is introduced. Future source types must supply real references and authority checks; unsupported business actions are not invented.

## Validation boundaries

Local intercepted browser fixtures validate actual app components, width/root-font geometry and error/race scenarios. Disposable CI validates real isolated PostgreSQL/RLS/RPC behavior, including exact foreign private debit and another-device completion. Controlled normal production QA, publication identity and PWA proofs are recorded separately in the release report. Viewport/root-font/touch/keyboard-height/safe-inset simulations are not physical Honor, OS keyboard, OS font or browser-UI zoom certification. Local Docker vfs capacity remains a development-environment limitation; do not blindly restart it or reset a shared database.
