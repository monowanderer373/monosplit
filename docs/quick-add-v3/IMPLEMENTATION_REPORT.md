# Quick Add / Payment Account / Split UI/UX V3 — Implementation Report

Checkpoint2026-10-24 Asia/Bangkok. Repo monowanderer373/monosplit; PR32 and PR33 merged; integrated main 8f7b1c99c9479ed03a176aa1dd1b46f27cdb4cd9; starting main dbd3c86fc08a49003324794f42ef27435fa2c318. User's full ZIP received after initial two MDs; all Markdown read (core files verified verbatim within complete handoff), tokens/guidance read and eight individual393x852 reference PNGs viewed. Prototype algorithms not imported.

## Implemented
- Existing UniversalQuickAddSheet: ledger-only visual header (accessible dialog name retained);4x2 category grid, full categories/editor retained; real-history recommendation through existing suggestQuickAddDescriptions with positive score only. Recommendation is visual and cannot silently confirm; selected USER category never overwritten.
- Default shortcuts follow approved seven categories plus full-list entry; user-custom category order retained. Account left/Split right; date moved to one editable Receipt. Note empty until typed and unaffected by category selection/rename; original description persistence fallback/history contract retained, no schema rename.
- Original calculator and currency formatter retained. One Save cell,1000ms hold with progress and discoverable keyboard alternative. Pointer cancel/move-out/blur/disabled-panel cancel timer, hold-release suppresses duplicate short save, latest callback used. Existing submit request/guard remains authoritative. Next manual draft explicitly clears amount/note/confirmed category per V3, original account/date/currency/context and new request authority retained.
- Compact account rows select current draft and close immediately, including genuine No account. No default-setting mutation. Optional actual/multi-source/coverage controls remain in account sheet with validity-gated Done; switching accounts does not invent debits or conversions. Actual available currency codes retained. Existing Add account flow and draft retained.
- QuickPeoplePicker presents existing catalog Friends/Groups/Trips, search/multi-select and fixed Continue. Original configureSplit and financial principals used; self included once. Edit people reloads original authorized catalog even when entered from inline ledger picker.
- SplitConfiguration changes are presentation wrappers: fixed total/tabs, scrollable payer/people/items, fixed original summary/Apply/Remove. Original equal/exact/item algorithms and validators untouched. Amount inputs do not nest inside buttons; By item displays calculated shares while keeping full item controls. V3 keeps the item workspace open after calculation; historical editors explicitly opt out and retain their original expansion/header/flow.
- Scoped qa-v3 CSS extends original capture tokens, removes legacy material pseudo tiles only in this sheet, keeps Paper/Denim/Terracotta. Real production graph screenshots exposed original CSS priority conflict; corrected specific sheet scope. Viewport listener restores calculator after IME viewport expands; physical IME NOTRUN.

## Protected business layers / call graph
GlobalMoneyActionHost -> UniversalQuickAddSheet -> useUniversalQuickAdd update/configureSplit (draft only) -> submit -> usePersonalLedger.saveDraft -> compileLedgerExpense -> original repository/outbox/transactional requests. Split Apply only closes after validation/onUpdate; no financial persistence. Person/Participant, immutable facts, RLS, balance, wallet, FX and settlement unchanged. No migration/dependency/lockfile change.

External protected-domain-baseline.json records unchanged hashes for money.ts,quickCalculator.ts,compileExpense.ts,ledgerRepository.ts,useQuickPayment.ts. SplitConfiguration computation and validation bodies unchanged; only JSX wrappers/labels changed. Four original-engine baseline snapshots:1890MYR->630/630/630;1000MYR->334/333/333;90000VND->30000 each;1MYR->1/0/0, participant order self/a/b. New three-mode tests check exact remainder/invalid amount gate and original item engine output; mode edits/calculation do not call Apply.

## Tests / evidence
Fresh BEFORE baseline: npm test696/101 PASS; npm run lint PASS; npm run build (tsc/PWA) PASS; original production graph quick-add-compact29/29 PASS1.1m. Four real engine goldens captured. Before synthetic screenshots archived externally.
Current local:704 units/103files PASS, ESLint PASS, TypeScript/PWA build PASS. Final source0787f9358853ea4e68b6a7f87d3324aea9f5ae1d Quality40104116756 all7SUCCESS: app, production-ui, full authenticated browser, database (lint/pgTAP/two-session concurrency), historical-database-upgrade, collect-pay-browser and travel-browser. Current runner totals:335 full browser PASS9.6m,182production UI PASS3.1m,CollectPay10PASS28.4s,Travel16PASS2.8m. Normalized annotations are in final-source-ci-notices.json. Previous source6abdbdf also independently passed all7 in40101674677 before PR32 merge.

Final exact-source external production-graph capture16/16PASS35.2s at2x:13V3 cases plus long account/native currency/date,14-account list,restored SUGGESTED draft. Additional retained-actions browser1/1PASS11.2s: Add account open/cancel keeps draft; item add/name/amount/assignment/remove/calculate; edited actual payer contributions; Apply0writes. Creating an account in production was deliberately NOTRUN. Original29compact cases include320/360/390/430 widths,640/740/844 heights,125/150/200% root-font simulations and optional funding validation; these remain in final full CI.

Supplemental Split IME test FAILbefore:420px viewport left only10px scroll body. Fixed actual VisualViewport height/offset, reduced noninteractive short-screen spacing, kept48px input/Apply/Remove. Both layout-resize and visual-only420px regressions PASS; below360px-height whole-panel scrolling keeps actions reachable. Native Android IME is still NOTRUN. Final eight-state inspection also caught legacy50%!important checkbox radius; explicit scoped square radius and shadow reset now have computed-style assertions.
Original tests adjusted for intentional Note label, cleared next category, actual Save-next menu, moved account/date and Edit people. Short screens may scroll per V3; tests retain48px minimum and action reachability. Financial assertions not removed.

Failure history: initial focused4fail/30pass were obsolete Description/date/Use-account/next-category expectations, adapted to V3; full initial2fail/697pass were old inline-picker label/count copy, adapted without loosening draft assertions. New test harness lint globals error corrected with effect publication. First component screenshots showed inherited material CSS overriding new styles; scope corrected and recaptured. Failures are not hidden by historical baseline results.

## Screenshot/behavior differences with approved board
- Screenshot data is synthetic via actual production module graph/local API contract. No customer production financial screenshots/writes. Eight states in test-results/quick-add-v3; archive externally before another run.
- Actual account names, categories, currency precision and ledger labels come from real state. Shared uses the original direct context; header may display friends rather than falsely showing Personal Ledger. No simulated OS status/home bars inserted.
- Existing You pay means actual payer contribution (e.g.RM18.90 when self paid all), while To collect is actual contribution minus share (RM12.60). Preserve those correct results; do not replace You pay with design exampleRM6.30. Amounts requires original exact input/validation; not seeded from demo formula.
- No mature positive-score recommendation -> no suggestion; do not invent AI suggestions or persist time fallback categories. Save&next alternative adds a small accessible options entry instead of another large Save button.

## Release, limits and recovery
PR32 https://github.com/monowanderer373/monosplit/pull/32 merged main65ff31ec6b2d830b32386f7027ad67bb06610428, exact tree equals validated6abdbdf. Follow-up PR33 https://github.com/monowanderer373/monosplit/pull/33 contains keyboard and selector fixes, final source0787f9358853ea4e68b6a7f87d3324aea9f5ae1d. Exact whole-tree equality checked after its merge. Final documentation-only checkpoint follows; exact final main, native Vercel READY/deployment ID, public bundle commit, authenticated read-only QA and retained PWA evidence are recorded outside Git in delivery-final.json to avoid a self-referential deployment commit loop. Never infer production success just from this report.

Physical Honor/Android browser/PWA/native IME/system fonts/browser UI zoom/device screen reader NOTRUN; CSS viewport/root-font/keyboard-height simulations are distinct. Selected muted-text palette pairs4.82–10.07 contrast were checked; this is not a full automated accessibility audit. Native Android Back still requires physical verification. Production QA uses only existing tagged owned QA, no customer screenshots, no API interception or financial mutation; final evidence says exactly what ran. Production financial Save/confirmation/new account creation intentionally NOTRUN; real disposable CI covers financial writes/history. Local Docker known vfs blocker not retried; current backend tests run in isolated GitHub Actions. No SQL installation needed.

Existing actual/deferred/multi-source/coverage controls remain accessible in Payment account with validity-gated Done, even though the simplified visual reference omits them. Account-row selection itself is one tap and closes immediately. Save-next has a small accessible options alternative. Shared ledger title reflects actual friends. You pay preserves actual contribution18.90, To collect12.60, rather than copying the board's own-share6.30. Extreme short/large text scrolls rather than reducing touch targets or hiding amounts/actions. These are intentional compatibility/accessibility differences.

Recovery: read PROJECT_STATUS/WORK_LOG and fresh git status/diff/main/deployment; preserve existing stash/backup. No migration replay or production fixtures. Rollback uses a scoped Git revert, never reset shared main or immutable financial history.

## Actual modified files
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/quick-add-v3/IMPLEMENTATION_REPORT.md`
- `docs/quick-add-v3/QA_RESULTS.md`
- `e2e/fixtures/quickAdd.ts`
- `e2e/inline-quick-add.spec.ts`
- `e2e/multicurrency-backend.spec.ts`
- `e2e/multiuser.spec.ts`
- `e2e/navigation.spec.ts`
- `e2e/person-detail.spec.ts`
- `e2e/person-link.spec.ts`
- `e2e/phase5c.spec.ts`
- `e2e/phase5d.spec.ts`
- `e2e/phase5e.spec.ts`
- `e2e/quick-add-compact.spec.ts`
- `e2e/quick-add-v3.spec.ts`
- `e2e/travel.spec.ts`
- `e2e/universal-quick-add.spec.ts`
- `playwright.production-ui.config.ts`
- `src/components/InlineContextPicker.test.tsx`
- `src/components/QuickPeoplePicker.tsx`
- `src/components/QuickSaveKey.test.tsx`
- `src/components/QuickSaveKey.tsx`
- `src/components/SplitConfiguration.tsx`
- `src/components/SplitConfiguration.v3.test.tsx`
- `src/components/UniversalQuickAddSheet.test.tsx`
- `src/components/UniversalQuickAddSheet.tsx`
- `src/components/home/HomeScreen.test.tsx`
- `src/components/quick-add-v3.css`
- `src/components/quick-add.css`
- `src/hooks/useUniversalQuickAdd.continue.test.tsx`
- `src/hooks/useUniversalQuickAdd.tsx`
