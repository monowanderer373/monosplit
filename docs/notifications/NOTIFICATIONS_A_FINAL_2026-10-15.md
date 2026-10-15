# Notifications A FINAL — implementation map

Approved source: `TabbyTally_Notifications_A_FINAL_2026-10-15.zip`. Existing React/TypeScript/Vite app, normal Supabase identity/RLS, canonical financial history and RPCs are retained. No migrations or dependencies changed.

| Source | Actual destination | Existing authoritative action/result |
| --- | --- | --- |
| A1/A2 owner pending funding | centered NotificationFundingForm via typed funding intent | fresh contribution/account/version preflight → complete_pending_funding; confirmed private debit only |
| A3 recurring occurrence | centered NotificationOccurrenceForm; L2 exact rule + occurrence | occurrence-only versioned override if needed, fresh recheck, original post/retry; foreign posting may still need actual funding |
| A4 installment | centered NotificationOccurrenceForm; L3 exact plan + installment/upcoming | original versioned edit preserves due date/principal; post/retry only current eligible occurrence; rescheduled old retry removed |
| A5 own pending Direct participation | exact /notifications/expense/:id page | original DirectExpenseReviewCard and respond_to_direct_expense expected version |
| A6/A7 accessible change request | exact /notifications/change/:id page | original change card/parser/approval RPC; original remains active until required approvals; own approval can remain pending |
| A8 incoming allocation | original CollectPay exact payment article, focused/outlined | original receiver cash authorization and versioned settlement response; Confirm only after money arrives; Decline retained |
| A9 open payable request | original CollectPay exact request and request-scoped form | original preview/proposal/cash service; navigation performs zero financial writes; recipient confirmation remains pending |
| A10 owner outbox command | centered original PendingExpenseRecoveryActions | original request/fingerprint reconciliation before retry; uncertain history cannot be undone |
| A11 negative asset | exact account page with normal-RLS entries | informational balance, not blocked debit; supported active asset record filter only |
| L1 | exact expense/funding details | original editor/history, actual permissions; no duplicated expense |
| S1–S7 | current resolver completion/change/unavailable/retry/loading/login/no-account | failures never imply completion; valid internal login intent; Accounts recovery returns to original target |

Rows show actual record title + short action and date/account in one wrapping flow. No visible reference, technical ID, extra row CTA or financial values in accessible labels. Simple tasks use existing accessible dialog primitives with center positioning/visual viewport sizing, Escape/focus trap/scroll lock; complex tasks use pages. Existing home/Insights/Paper Receipt/QuickAdd/Trip themes and ordinary CollectPay consumers remain unchanged.

Funding defaults use `expense_amount_minor` (accepted payer contribution), never whole bill/own share. Unknown and foreign actual debits start empty. Currency changes clear foreign drafts. Volatile bounded drafts contain manual input only, never read metadata. Amounts remain concealed in DOM/ARIA/inputs/live regions until explicit reveal.

Readonly source refresh and write leases have separate generations: realtime revalidation cannot invalidate the operation's own occurrence edit, while target/identity/unmount still invalidate every continuation before normal SDK dispatch. Account/version/currency/amount are rechecked before posting. Metadata edit uncertainty stops; it never guesses payment success. Pending payer cash recovery resumes an existing allocation, never creates a duplicate proposal. Idempotent attempt IDs are reused only for matching payloads.

Origin storage is identity-scoped, typed and one-shot (tab, list/page scroll, row focus only). Returning restores current source; absent rows fall back to tab/bell. Account management preserves the originating typed task. Archived account record links cannot silently fall back to all accounts.

Verification evidence and release state are in PROJECT_STATUS, WORK_LOG and the dated release report. Mocked application screenshots/reference tests, isolated real backend tests, normal controlled production QA, root-font/viewport simulations and physical-device checks are reported separately.
