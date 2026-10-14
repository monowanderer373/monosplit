# Home notifications — production release, 2026-10-14

## Outcome and root cause

Home's Account tasks popup previously rendered plain text rows with no click handler, entity destination or route consumer. Pending private funding intents lost their expense/account context and produced identical “Finish an account debit” labels. The existing completion RPC had no frontend consumer. These are saved expenses whose private account debit is still pending, not evidence of failed canonical expense submission.

“Touch n Go is short” was independently derived from a negative nonarchived asset balance with a posted opening balance. It was not linked to a particular blocked debit; existing account rules allow negative assets. Two new owned QA principals reproduced the old three-label structure in actual production: distinct funding intents, zero row buttons, click with unchanged URL/no target, zero runtime errors. Original customer records/UUIDs were not inspected.

The new Matte Paper popup separates To do and Activity, with actionable full rows, record/account/date/reference context, keyboard controls and anchored collision-aware positioning. Unread metadata and pending task count are independent. Every action resolves typed IDs against current normal-RLS data; viewing never performs a financial action. Completed/changed/unavailable/login/retry states do not reuse stale controls.

Full source→target→lifecycle table, source locations and recovery contracts: [HOME_NOTIFICATION_ACTIONS.md](../notifications/HOME_NOTIFICATION_ACTIONS.md).

## Implementation

- Typed derivation/resolver in `homeNotifications.ts`; owner-private snapshot repository, current-identity RPC dispatch and live hook. No title/name/index lookup. All ongoing tasks/info retained; only closed history capped. Actual update times order Activity; relevant expense dates remain calendar dates.
- Exact funding/account/recurring/installment/Direct-review/change/local-outbox targets. Funding completion calls original transactional `complete_pending_funding`, with exact accepted contribution, explicit actual foreign debit and original request-ID guards. No reference-rate substitution.
- Existing Direct review card extracted/reused; original change card, record editor, complete correction parser and outbox reconciliation reused. Full A→B→C graph is parsed before selecting the target chain. Account records link exists only when original active-asset filter supports it. Scheduled/archived objects explain current state.
- Settlement/request actions select, scroll, focus and outline the exact existing Collect/Pay article. Original cash-leg/settlement services remain. Read metadata updates without repeated focus/scroll. Generic route restoration cannot override this exact target.
- Safe internal login/profile-upgrade intent; stale responses, unmounted preflights and changed identities cannot start old writes. Uncertain submission preserves draft/opaque request metadata and checks authority before retry. Closing consumes visible intent, restores focus after route/dialog cleanup, and never completes a task.
- Existing English/Chinese i18n and amount conceal throughout visible values, accessibility, tooltips and inputs. Frontend read metadata is device-local; financial task completion is server-authoritative.

No migration, dependency/lockfile, financial engine, immutable principal/history, RLS, currency precision or production-project changes. Workflow change only retains notification screenshots. Fresh baseline source/remote migration histories both had 26 entries; no SQL action was required.

## Validation

| Check | Status | Current evidence |
| --- | --- | --- |
| Final-source CI | PASS | Quality [38589726055](https://github.com/monowanderer373/monosplit/actions/runs/38589726055), exact `9bc1fb9d3c4a141d191a891a6da55077c6322328`, all six jobs SUCCESS |
| Unit/lint/typecheck/build | PASS | 580 tests/87 files in final CI; production PWA build, ESLint and TypeScript successful |
| Isolated database | PASS | 742 pgTAP/18 files, DB lint, historical upgrade and two-session write exclusion in disposable CI; never production reset |
| Existing product browser checks | PASS | Collect/Pay 10 and Travel/QuickAdd/Trip-period 16; full browser job SUCCESS, including notification backend test file in normal suite |
| Final local notification static build | PASS | 22/22, 1.5 minutes, no retries/skips; exact final source. Relevant complete-history/target/history unit subset 19 PASS |
| Earlier broader local regression | PASS | 34/34 application browser cases on a69; final change only complete-chain selection, separately rechecked above |
| Production/offline PWA local | PASS | Final source 1/1, 6.2 seconds |
| Actual normal production QA | PASS | Four stages below, no API interception or customer account access, zero runtime errors |
| Retained production PWA/private guards | PASS | Activated worker, current entry/Records cached, five cached material SHA-256 hashes equal source; four public widths and offline Records shell |
| Local Supabase | BLOCKED | Unchanged Docker vfs/capacity limitation. No blind pull/start/reset/prune. Real backend verification supplied by disposable CI |
| Physical phone/OS keyboard/fonts/browser-UI zoom | NOT RUN | No Honor/device claim; simulated CSS widths/root-font/touch/viewport-height/safe-inset only |

The final 16 geometry combinations use 320/360/390/430 CSS px and 100/125/150/200% root font. All have no horizontal page overflow, row targets at least 44px with no nested controls, and internal list scrolling. Long labels, many notifications, Chinese 200%, empty/error/current-state boundaries, keyboard/Escape/outside/focus, privacy and original record editing are covered by application tests.

Recorded failures were investigated: an actual route/focus race, active-info history truncation, stale rescheduled/archived actions, stale financial preflight dispatch and partial revision history were corrected with regressions. One development-server rerun had 19 PASS/3 five-second Home-loading timeouts; existing static-production configuration then passed all 22 without changing assertions or timeouts. Final combined GitHub log ambiguously duplicates the Collect/Pay ten-case output under browser; no detailed full-browser case/retry/skip distribution is claimed from that output.

## Authenticated production evidence

Normal browser sign-in plus normal user JWT/RLS/RPC, owned controlled QA only, no response interception:

1. Signed-out internal funding target survives normal login and opens the exact train record. Two distinct pending tasks show actual names and separate refs. Actual client offline mode retains the task with Retry and offers no stale debit controls. Conceal hides amounts and inputs. Same-currency MYR1.25 and foreign VND90,000 with explicitly supplied actual MYR12.34 complete through UI; each double click sends one completion RPC, one private journal exists per intent, and both canonical originals remain unchanged. Activity updates, focus returns, reload does not reopen a consumed target.
2. Exact negative Touch n Go account opens with current balance. A normal owner RPC adds MYR25 only to this controlled fixture wallet, making it positive MYR12.50; fresh target shows current Account details and warning disappears. This fixture operation does not claim a newly developed income UI.
3. A real Direct pending share opens the original review card. Navigation writes nothing; explicit Accept share invokes one original response RPC and removes the task by current authority.
4. A real incoming settlement opens the focused original Collect/Pay article. Navigation writes nothing; explicit receiving-account selection and Confirm received produces accepted allocation/confirmed payment and exactly one posted MYR1.50 cash leg per party. Home pending count and Activity update.
5. A real open payment request opens the exact payable article. Navigation creates zero financial writes, conceal hides its values, and the controlled request intentionally remains open. Signing in as the other owned principal cannot read the owner's private funding intent or see its private name/action.

Controlled immutable QA facts remain for audit; they are not deleted/reseeded. Browser authentication/storage/cookies are cleared and normal QA sessions logged out. Static PWA cache is preserved for update proof. Authentication administration was restricted to creating/resetting the explicitly tagged owned QA users; all financial operations used normal user sessions, never service-role ledger writes.

## Git and existing production

- PR [#21](https://github.com/monowanderer373/monosplit/pull/21) MERGED; branch `feat/home-notification-actions`.
- Validated source `9bc1fb9d3c4a141d191a891a6da55077c6322328`; merged application main `256516798470d4a48da7c8ba9c462a04b5c1be75`. Exact source/main tree comparison empty.
- Existing team/project: `monowanderer373s-projects` / `tabby-tally`. Deployment `dpl_7HncvCp7QQRgF7DovbvfEoySJnFn` READY; actual public entry `index-DfpHTyVJ.js` contains that full main SHA, Records `SpendingRecordsPage-BWscH8ho.js` precached.
- Live: https://tabby-tally-monowanderer373s-projects.vercel.app/
- Main Quality [38591123534](https://github.com/monowanderer373/monosplit/actions/runs/38591123534) was running at this documentation checkpoint; validated PR source/main are identical. Read terminal status rather than assuming this run passed.
- A following documentation-only checkpoint may change build commit/asset names. It must receive its own READY/public-SHA/current-PWA read-back before final delivery; actual authenticated financial behavior above was validated on the identical application source at `2565167`.

## Screenshots and delivery

Gallery: `/workspace/verification/notifications/comparison/index.html`. Evidence archive is allowlisted from controlled before/after PNGs, intercepted-app implementation PNGs/geometry, public operational JSON and this report/source map. Labels distinguish synthetic UI fixtures from actual authenticated production; no screenshot is a physical-device claim.

Private principal/request checkpoints, auth logs, credentials, profiles, invitation tokens and signed artifact URLs are excluded. There is no production blocker for this feature at the authenticated verification checkpoint. Remaining limits are local Docker and untested physical devices/OS interaction; device-local read metadata is an explicit scope choice.
