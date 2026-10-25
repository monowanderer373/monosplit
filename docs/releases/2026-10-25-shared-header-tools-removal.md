# Remove Shared header three-dot tools — 2026-10-25 Asia/Bangkok

PR35 merged mainacc7d9fb1dd80d3d60a593a0ad844efdd7350149; validated sourcebb3d71e4d0bef4db7bc2904cc4e54dc65d36c142. Remove Shared's three-dot button, expansion props/state and duplicate inline invite/manual-person panel. Normal Add person/search/tabs/create actions and Person detail menu retained. No financial, identity, schema, RLS, dependency or theme changes.

Local704unit tests/103files, ESLint and TypeScript/PWA build PASS. Actual production-module browser320/360/390/430 PASS4/4 in12.8s: exactly two header actions, removed button/inline panel absent, retained manual/invite dialogs open/close, no overflow. Screenshot shared-390.png uses synthetic local API data; no private production screenshot. Native physical phone NOTRUN.

Exact-source Quality40145437102 all7SUCCESS. Runner notices: {"historical-database-upgrade": [], "app": [], "production-ui": ["184 passed (2.4m)"], "browser": ["337 passed (9.9m)"], "collect-pay-browser": ["10 passed (27.8s)"], "database": [], "travel-browser": ["16 passed (2.8m)"]}. Existing backend setup now uses retained Add person dialogs and waits copy completion; money/immutable-history/identity assertions unchanged. No production test invitation/person/financial creation. Local jsdom cannot execute native showModal, so the unit asserts retained entry/removal and Chromium covers actual dialogs. Initial supplemental browser guessed Add group label; fixed to actual Create group/Create trip without app changes.

Final docs-only commit follows. Exact final main/native existing-project READY/public bundle SHA/normal owned authenticated Shared removal and retained dialog checks/SharedPage PWA cache evidence are in /workspace/verification/shared-remove-tools-2026-10-25/delivery-final.json after verification. No API interception in production QA; immutable financial before/after hashes compared. PWA uses explicit native registration.update() with static caches retained, not a guarantee of immediate automatic update. Physical Honor/native OS behavior unverified. Existing QA has fewer than two authorized contacts, so full production Split/financial mutation tests remain NOTRUN; real disposable CI covers those mechanisms.

Resume using current main/status/diff and latest evidence, preserve existing stash/backup; never replay production fixtures/migrations.

## Changed files
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `e2e/fixtures/quickAdd.ts`
- `e2e/multiuser.spec.ts`
- `e2e/navigation.spec.ts`
- `e2e/person-detail.spec.ts`
- `e2e/person-link.spec.ts`
- `e2e/phase5c.spec.ts`
- `e2e/phase5e.spec.ts`
- `e2e/production-phase3-smoke.spec.ts`
- `src/components/shared/SharedComponents.tsx`
- `src/pages/SharedPage.test.tsx`
- `src/pages/SharedPage.tsx`
