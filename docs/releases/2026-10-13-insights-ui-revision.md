# Insights / Records revision — production verification

2026-10-13, Asia/Kuala_Lumpur. User explicitly authorized existing production release. Full pasted request/spec/CSS and four design boards reviewed; newest visuals applied without financial model/RLS/RPC/schema changes.

## Git and deployment
- PR15 https://github.com/monowanderer373/monosplit/pull/15 MERGED.
- Implementation d8e17a1cd06ec7097d7e6263633cf71786973ac7; test-only correction2bda9d28a6b0673c6f58c7d70fe4ced38747e5ff.
- Application release/main merge9b2eb2f56dbe6d8cb0f327798bb77f4a3e343bf2; later docs-only checkpoints may follow (read git HEAD).
- Existing Vercel project tabby-tally/prj_hoshkzURGyUGqAVq3Yl45HB5jyj4, team monowanderer373s-projects/team_zgmzKfdeAS7b70OXAolco0Cj; Git link monowanderer373/monosplit and Vite verified through scoped API.
- Application deployment dpl_9qtfWrKfKYNNw28kqXWeTV3LLJvM: production READY, exact9b2eb2f/main. Alias https://tabby-tally-monowanderer373s-projects.vercel.app/ . Immutable deployment URL https://tabby-tally-9isly20z5-monowanderer373s-projects.vercel.app/ .
- Actual alias entry/assets/index-Don0a5kX.js contains exact release SHA, Records/assets/SpendingRecordsPage-D6waQ98v.js served/pre-cached and original package materials present. This is the existing app, not a demo/preview.

## Actual tests
- Local524 Vitest/77 files, ESLint, TypeScript/Vite/PWA build and diff check PASS.
-37 intercepted-API browser tests PASS (including24 viewport/font combinations, original9 UI journeys and new year/state/touch flows). Final state-only markup refinement separately retested1/1; final24-combination geometry run24/24. No counts inflated by adding reruns.
-125/150/200% are HTML ROOT FONT changes, not claims of browser/OS zoom equivalence. Viewports320/360/390/430/480/768 plus1024; English/Chinese/long labels, huge JPY values, true shared own-share/Bill difference, all states/privacy/return/loaded-list, draft years/12-year paging/Escape/focus and short400px touch viewport/internal scroll. Current actual geometry JSON reports innerWidth/visualViewport/DPR/rootFont/button/text rectangles/overflow.
- PR corrected run https://github.com/monowanderer373/monosplit/actions/runs/38345796393 and main run https://github.com/monowanderer373/monosplit/actions/runs/38346660475: all SIX jobs SUCCESS (GitHub API states inspected);524 unit,723 pgTAP/16 files, DB lint/concurrency/historical upgrade, CollectPay10 and Travel/QuickAdd/period16. Real local-Supabase journey includes revised picker/Shared scope, own-share/Bill/currency/foreign private RLS and original editor.
- First PR run38344975379 failed because new global Shared test locator also matched the real themed navbar; scoped it to Scope dialog. Existing5s authenticated header readiness retried successfully; bounded15s readiness assertion preserves actual UI/data checks. Corrected run all six jobs passed. No failing suite ignored or assertions removed.
- Full browser artifact download remains network-policy blocked at productionresultssa11.blob.core.windows.net; combined downloaded success log duplicated another job's output, so full-browser per-case/skipped/retry statistics are NOT asserted. Browser JOB success is current verified evidence; local37/matrix24 and backend723 counts were actually observed.

## Actual authenticated production QA
No route interception, fake auth token, design JSON or synthetic API response used. Two independently controlled QA principals were created and confirmed for verification; only their own data was used. Financial writes used ordinary authenticated callers and EXISTING create_expense/respond_to_direct_expense transactional/versioned RPCs with UUID request IDs; admin key stayed server-side in memory for QA auth provisioning. Canonical test facts are deliberately preserved, never deleted/reset/fake-Undone. Original private customer data/accounts were not used.

Observed real data: Personal12.00 MYR/1 record; confirmed Direct Bill72.00 MYR, owner share36.00/1 record; All48.00/2 records. After friend-link/acceptance, counterpart's ordinary RLS read of owner's personal expense returned[]. Actual UI signed in normally and read production expenses (six recorded successful HTTP200 responses). All/Personal/Shared, month→year→month, November real empty→This month restore, sole actual MYR, Summary→Records→back Trend, visible/accessibility amount conceal (including Bill) passed; runtime page errors0. Credentials were sent through stdin/memory only, not argv/commits/screenshots. Browser local/session storage and cookies cleared; QA sessions signed out. Private QA principal recovery file is ignored/outside repo and excluded from artifacts; no new financial records created on retries.

Native production metrics: innerWidth/visualViewport320,360,390,430; DPR1/root16px; Month widths184/224/254/294, Currency96, Scope288/328/358/398; buttons48 high, no text/page overflow. All are simulated headless Chromium, NOT physical Honor.

Same retained installed PWA upgraded to release entry, worker activated/controller present, Records cached. After signout, actual production private-route guards/no overflow at four narrow widths and offline updated Records shell PASS. TLS verification enabled throughout: only platform public CA in own isolated Chromium profile, DNS-constrained to existing alias/Supabase project, shared home/system trust stores untouched.

## Visual comparison / intentional differences
Component mapping F/Y/S/T/C/R: docs/insights/REVISION_2026-10-13.md. Ignored /workspace/verification/revision-gallery/index.html compares FOUR boards, actual before/after SAME101 MYR/4-record UI fixture, states and zoom images; production controlled48 MYR evidence is separately labeled. No board image is runtime UI/fallback. Original four SVG bytes copied unchanged.

Daily Trend/category Ranking/renderer/colors/edit path retained; no fake period chip or actionless list chevron. At extreme font/label widths controls/year toolbar/tab rail reflow and picker scrolls internally instead of clipping or shrinking. Native aria-pressed buttons express selection without invalid aria-selected on button role. Native SVG layers do not reproduce enlarged photographic material closeups; no claim of pixel-perfect illustration equivalence.

## Scope limits / recovery
- Honor hardware, physical OS keyboard/system font behavior and physical safe-area/PWA install behavior NOT RUN. Emulation/root-font scaling do not establish those.
- Production test used controlled QA data; no claim about all private user accounts, devices or unrelated financial write scenarios. Actual customer financial data was not touched.
- Remote Supabase24 migration versions exactly match current source24; no migrations/schema/policies changed/applied by this task. Historical Phase5 undeployed reports are stale context.
- Local Docker vfs/capacity remains unsuitable, not retried; real DB verification came from isolated CI.
- Account-wide Vercel team listing403 was a scoped-token limitation, not missing project access; helper now uses supported project endpoint. No generic authorization/secret request remains.
- Setup PR14 remains OPEN/unmerged and separate. Resume current main/status/log; never restart completed UI or reset history. Final docs-only checkpoint/latest management/public proof may supersede this application's build metadata; application code remains identical.
