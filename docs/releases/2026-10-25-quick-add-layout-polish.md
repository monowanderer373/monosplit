# Quick Add screenshot refinements — 2026-10-25 Asia/Bangkok

User screenshot/list supersedes the older V3 layout. PR34 merged asd5c1381888bc585a846f3e7c02a6c7852f8bd48f; validated source2c5a648e897c288b807cd8733a6aa77c32b3c5eb. Final documentation-only commit follows. Existing production exact SHA/deployment/native READY/QA/PWA proof lives in /workspace/verification/quick-add-polish-2026-10-25/delivery-final.json; report alone is not proof of publication.

## Changes
- Eleven original shortcuts plus All categories, three rows. Preserve custom category order and current category. Spare height goes to category area; Receipt directly above calculator, Save bottom10px or safe-area. Short screens/large text may scroll to preserve48px targets.
- Account name/icon stays left, plain Split right (Split · N when applied). Remove ACCOUNT/SPLIT captions, personal icon/text and both local chevrons. No interaction defaults/financial context reset; Split remains draft only.
- Remove visible Hold guidance and three-dot options row. Keep original1000ms hold-to-next and request guard. Keyboard Shift+Enter gives same next action; hidden accessible help remains.
- Invalid Save displays paper nonmodal1800ms toast, gentle entrance/fade or reduced-motion equivalent; pointer outside dismisses without consuming the action, navigation or draft loss. Repeated notices restart timer/animation; cleanup removes listeners/timers. Actual backend save failures retain existing recoverable errors/draft.

## Verification
- Local704Vitest/103files, ESLint PASS; tsc/production PWA build PASS in exact-source CI and browser builds.
-42existing compact/V3 cases PASS1.5m, covering320/360/390/430 widths, short heights,125/150/200% root-font simulation, funding validation, Split input/Apply/Remove at420px (layout and visual-only viewport).
- Final exact-source V3 browser15/15PASS34.2s, including the dedicated arithmetic/200%/expanded ledger regression. New transient/geometry test PASS13.2s;2x capture PASS13.1s: twelve slots, no removed controls/icon/chevrons, auto dismissal<=2.5s check (configured1800ms), outside dismissal, unchanged draft/zero writes, Receipt/keypad gap<=14px and bottom<=14px at393x852.
- Quality40127633901 all7SUCCESS: app,production-ui,full authenticated browser,disposable database/pgTAP/concurrency,historical upgrade,CollectPay,Travel. Current runner totals: {"browser": ["337 passed (9.7m)"], "app": [], "historical-database-upgrade": [], "travel-browser": ["16 passed (2.4m)"], "production-ui": ["184 passed (3.2m)"], "database": [], "collect-pay-browser": ["10 passed (41.1s)"]}. These are source results; final docs-only application/tests tree equality is separately checked.
- No changes to src/lib,src/hooks,Supabase schema/RLS/RPC,dependencies/lockfile. Financial/identity/history/payments unchanged; current backend CI retains actual financial assertions, including hold-release exactly once and actual/deferred native funding.
- Before final source, run40126658290 exposed arithmetic/expanded-picker/200% text clipping Save by1px (Travel12pass/4fail). Reproduced locally with bottom845; scroll-margin12px fixes bottom834 without weakening assertion, dedicated test added.
- Initial unit expected old Shared label; strict label expectation adapted. Visual review caught inherited account centering and scoped selector fixed. No test timeout relaxed.

## Evidence and limits
Actual app synthetic-contract screenshots: capture.png / polished-capture-393-852.png and toast.png in the external evidence directory. Production QA uses existing tagged owned user only, no financial writes/private screenshots/API interception. Exact live results and any limitations are in delivery-final.json and live-readonly.json. Physical Honor/native Android IME/system fonts/browser UI zoom/device screen-reader NOTRUN; CSS/root-font simulations are not physical device certification. Existing QA has fewer than two authorized contacts, so full production Split journey remains unverified; real isolated authenticated regression passed. Native PWA registration.update() is explicit, with static cache retained; do not claim immediate automatic updates.

## Changed files
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `e2e/inline-quick-add.spec.ts`
- `e2e/multicurrency-backend.spec.ts`
- `e2e/navigation.spec.ts`
- `e2e/quick-add-v3.spec.ts`
- `e2e/travel.spec.ts`
- `e2e/universal-quick-add.spec.ts`
- `src/components/InlineContextPicker.test.tsx`
- `src/components/QuickSaveKey.test.tsx`
- `src/components/QuickSaveKey.tsx`
- `src/components/UniversalQuickAddSheet.test.tsx`
- `src/components/UniversalQuickAddSheet.tsx`
- `src/components/quick-add-v3.css`
