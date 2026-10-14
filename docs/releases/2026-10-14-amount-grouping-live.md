# Amount comma grouping — live release, 2026-10-14

## Result and scope
Quick Add now shows `90,000` while entering VND and `3,450.05+1,000` while calculating. Original record editing, paid/share/item drafts, capture review, settlement/CollectPay and account opening inputs use the same comma grouping. Records, original ledger/Home/Travel/financial history amounts, FX summaries and chart labels consistently group integer digits by three. MYR/CNY fractional precision stays two digits; VND stays zero. Currency labels and negative balance signs are preserved.

All changes use the existing React/TypeScript/Vite app and its original integer minor-unit model, parser, calculator, drafts and financial RPCs. Commas exist at the presentation boundary; callbacks receive ungrouped decimal strings. No database migration, new production project, fixture fallback, permission relaxation or history rewrite. The previous large canonical last-cent regression remains covered: `90,071,992,547,409.90` opens without making the original record dirty.

## Changes
- `src/lib/amountDisplay.ts`, `src/components/AmountInput.tsx`: exact string grouping, calculator operand presentation, caret restoration, paste, unfinished decimals, Backspace/Delete and mobile deletion without a hardware keydown. Original input refs, labels and callbacks retained.
- Original UniversalQuickAddSheet, QuickAddSheet, ExpenseCaptureSheet, ExpenseActionSheet, SplitConfiguration, SettlementPanel, CollectPayPage, SmartCapturePage and HomeScreen amount inputs adopt grouping. Split draft conversion preserves exact cents. A small scoped CSS width prevents a cropped currency glyph on narrow Quick Add.
- `money.ts`, `fx.ts`, SpendingCharts: comma groups of three independently of browser number locale, exact BigInt magnitude/fraction, original currency placement and signs.
- Meaningful unit/browser coverage and existing E2E calculator fixture updated. No manifest/lockfile/CI/database/deployment setting changes. Recovery status/log updated.

## Validation
| Check | Current result |
|---|---|
| Full local units | PASS —548 tests/80 files |
| ESLint / TypeScript / production PWA build | PASS; exact source also passes CI app job |
| Final new intercepted browser UI | PASS —4/4, no retries/skips;320/360/390/430CSSpx;16 screenshots |
| PRQuality38536776162 | PASS —all6 jobs SUCCESS on8c60542 |
| Disposable pgTAP / lint / historical upgrade / write exclusion | PASS —742 tests/18 files, existing isolated CI |
| Dedicated CollectPay / Travel+QuickAdd+period | PASS —10 /16 |
| Full browser job | PASS —current terminal SUCCESS; detailed raw artifact retrieval BLOCKED Azure storage6, counts/retries/skips not claimed |
| Native production login/read/edit-draft/calculator | PASS —normal existing controlled QA/no interception, no financial writes,0runtimeerrors |
| Native production geometry | PASS —4CSS widths; original records unchanged after draft dismissal |
| Retained PWA/public private-route/offline shell | PASS —active controller, actual current entry and Records cache;4 widths/offline guards |
| MainQuality38537942859 | AppPASS, other automatic jobs still running when this report was written; exact tree is identical to fully passed PR source |
| Local Supabase | NOT RUN —same Dockervfs capacity limitation; no unchanged pull/reset retry; backend validated in disposable CI |
| Physical phone/OS keyboard/system-font/browser UI zoom | NOT RUN —CSS viewport simulation and synthetic InputEvent are not real-device evidence |

## GitHub and production evidence
- PR: https://github.com/monowanderer373/monosplit/pull/19 —MERGED.
- Source branch: `fix/amount-thousands-separators`; source8c60542fa53c829ce7cb5d5a2a8a1a35736f4879.
- Application main: `aeeb6f1cc6560a43fdb01cb0785ebfdc65c38502`; source/main tree diff empty.
- Existing project `tabby-tally`, existing team `monowanderer373s-projects`.
- Production: https://tabby-tally-monowanderer373s-projects.vercel.app/
- Actual application deployment: `dpl_4hEWMdmnT5kbJ3sH97RNXbY59hyq`, **READY**, immutable URL https://tabby-tally-nok305pou-monowanderer373s-projects.vercel.app/ .
- Public alias actually serves application SHA in `/assets/index-DGkh-6iF.js`; Records `SpendingRecordsPage-3CRQSk4T.js` is precached. Stable material content revisions remain intact.
- A documentation-only checkpoint follows this tested application. It can trigger another existing-project production build; final current metadata/public/PWA read-back is saved separately in `amounts/deployments.json`, `version.json` and `pwa.json`. Do not confuse documentation SHA changes with a new untested application implementation.

## Actual screenshots and operational limits
Gallery: `/workspace/verification/amounts/index.html`. Synthetic API-intercepted application screenshots are separated from actual production controlled-QA screenshots. Production Quick Add cards show three unsaved drafts; Records uses only previously established owned QA facts. No customer data or private auth/checkpoint/browser-profile files belong in the evidence archive.

Native verification confirms original shared own share456,789 vsBill913,578, grouped editor/disabled initialSave and unchanged facts after Escape. No settlement/correction/expense submission was performed in production. All sessions signed out and client auth cleared. No user manual action is required. Monitor the automatic mainCI terminal state without re-running successful checks or changing already deployed migrations.
