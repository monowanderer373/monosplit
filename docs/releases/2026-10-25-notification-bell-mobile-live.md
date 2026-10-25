# Phone notification bell and tray — 2026-10-25

## Published behavior

The phone panel previously used only the space right of the bell, forcing multi-line titles and metadata into a narrow column. It now opens below the entire Home header, with title/date/mode visible, uses the available frame/visual viewport width up to 360px, and scrolls long lists above the navigation. Scoped portal CSS defines its row/tab layout independently of lazy stylesheet order. Original notification sources, resolver, financial forms, permissions, targets and return/focus behavior remain.

The bell is a transparent 44px touch target with a small plain upper-right unread number: 1–10, then …. Opening a visible successfully loaded tray acknowledges current notification versions across both tabs. The existing identity-scoped device read store is reused; denied storage still clears the current session. Pending task totals and original actions remain, and new versions become unread again. This is device-local acknowledgement, not task completion or cross-device synchronization. Keyboard focus indication and reduced-motion support remain.

## Git and production

- [PR #37](https://github.com/monowanderer373/monosplit/pull/37), tested source ec44e5e30ae670f22fde2d07dcc8905bb88041fb.
- Feature merge main1029da43d4e954f86f0ce0081900988cf0488508, exact complete-tree equality with tested source.
- Existing tabby-tally/monowanderer373s-projects native READY dpl_ChJEKvsndAA2h6CHpZN8MfgTwK2P; exact feature SHA in public index-DnDMc400.js.
- https://tabby-tally-monowanderer373s-projects.vercel.app/
- Final documentation-only commit/deployment metadata and public/cache proof are saved in external delivery-final.json; no duplicate financial tests or migrations are needed for that checkpoint.

## Verification

| Check | Result |
|---|---|
| Unit, lint, TypeScript, PWA build | PASS: 725 units /104 files |
| Final focused local production-graph phone checks | PASS:56 |
| Final exact-head Quality40172680484 | PASS: all seven jobs, zero failure annotations |
| Full authenticated browser | PASS:357 |
| Production UI / Travel / CollectPay | PASS:201 /16 /10 |
| Real disposable database and upgrade | PASS:919 pgTAP/20 files, original concurrency/15native properties/historical upgrade |
| Mobile/text simulation | PASS:320/360/390/430 CSSpx,100/125/150/200% root text, long content and 10/11 badge thresholds |
| Normal owned production login | PASS:8 width/text checks; plain count, view/clear/reload, same pending total, actual Activity target and return |
| Financial integrity during live checks | PASS:10 table hashes unchanged;0financial mutation RPCs/runtime errors |
| PWA | PASS: native registration.update with caches retained; exact current entry/Home/Profile/Records/Accounts/Shared chunks; stable paper assets match source offline; signed-out Records guards at all four widths and offline shell |
| Production financial confirmation | NOT RUN: no financial test writes; original actions tested on disposable backend |
| Physical Honor/native keyboard/browser UI zoom | NOT RUN; root-text and viewport simulations are distinct |

The first local browser iteration was interrupted to correct duplicated frame insets and a fixture's extra negative-account activity. A subsequent broad run had200PASS/1FAIL from sampling a running animation at x15.795 before its final x16. Final checks wait for native animation completion, retain the exact inset assertion and cover vertical motion/header clearance. Final focused and CI runs pass. An initial external live verifier misclassified the original current_participant_id STABLE SELECT as a write; its SQL was checked and the external allowlist corrected, with no application change.

Safe raw actual-component screenshots and sanitized evidence are in /workspace/verification/notification-bell-2026-10-25/delivery. They use synthetic API fixtures; user-supplied private screenshots, production financial rows, credentials and browser state are excluded. Underlying relationalBalance, compileExpense, Person/multicurrency repository, notification repository and NotificationTarget source files are byte-identical to baselinebb720df. No schema/migration/RLS changes.

## Modified files

- src/components/home/AccountNotice.tsx
- src/components/home/AccountNotice.test.tsx
- src/components/home/HomeScreen.tsx
- src/components/home/compact-home.css
- src/hooks/useHomeNotifications.ts
- src/hooks/useHomeNotifications.test.tsx
- src/lib/noticePopoverGeometry.ts
- src/lib/noticePopoverGeometry.test.ts
- src/lib/noticePopoverMotion.ts
- src/lib/notificationTranslations.ts
- src/pages/PersonalLedgerPage.tsx
- e2e/home-notifications.spec.ts
- e2e/home-account-actions.spec.ts
- docs/PROJECT_STATUS.md
- docs/WORK_LOG.md
- docs/releases/2026-10-25-notification-bell-mobile-live.md
