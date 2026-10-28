# Issue 01 — dedicated Trip Members

Status: implemented; verification in progress, not published. Baseline main
908d7e8, clean initial worktree. Branch feat/trip-members-page. Package
TabbyTally_Issue01_Members_v1: complete README/specification/handoff/checklist/
decisions read; all eight manifest SHA-256 values checked; design board viewed.

Only Issue01 is implemented. No Issue02friendship or split changes, Issue03date
entry changes, Issue04ledger cleanup or Issue05mixed-list removal. Existing
Group controls/routes, expense author/member maps, financial principals,
integer currency, RLS, correction/settlement procedures and historical facts
remain. No migration or new production dataset is required.

## Implementation

- Lazy /space/:spaceId/members in the existing AppShell. Scoped matte paper
  list, stable Participant IDs, own/Owner/account/manual ordering, explicit
  roles, no emails/wallets/friend placeholders. The existing bottom navigation
  highlights Shared; global + waits for current valid writable Trip authority.
- Original get/listMembers authorization and invite/manual/role/remove services.
  Snapshot uses active membership, validates the current principal and role,
  isolates identity/Trip/request generations and clears failed/lost access.
  Focus/visibility/realtime and same-app changes invalidate the page/preview.
  Participant lookup failures propagate as read errors instead of fake zero.
- Owner invitation is explicit, has original full/view access, truthfully
  reports clipboard failure with a manual-copy field, and never generates a
  token on open/Cancel. After successful clipboard copy the token is not redundantly left in DOM;
  manual-copy UI appears only for actual failure. Role and manual actions keep
  original authorization.
  Remove/Leave has history-preserving confirmation, synchronous duplicate
  dispatch protection, fresh authority checks and authoritative reload.
- Trip overview full card, summary count, menu and ledger header use one route.
  Trip's duplicate management/list/invite UI is removed; Group branch retained.
  Trip legacy section=members replaces to the new route; section=info remains.
- Same-identity/same-Trip source provenance validates history Back. Direct/reload
  visits without provenance seed a same-Trip overview history entry; no arbitrary
  from URL or unconditional navigate(-1). Existing route scroll state restores
  source positions, including section=info without re-scrolling over it.

## Current verification

- Baseline:732unit/105files PASS. Current743unit/108files PASS; original18focused plus the final Back-guard suite PASS.
- Lint and TypeScript/PWA build PASS. Production-graph mobile UI13PASS after final guard/busy refinements; all
  overview entries, manual role restrictions, both invite roles/copy fallback,
  invalid/affiliation/revoked Back, trailing-slash/loading global+ and explicit
  processing state included.
- Browser checks:320/360/390/430,125/150/200%roottext, long names/Trip, Chinese,
  permissions/readonly+/copy fallback/confirmed removal/error and empty states/
  revoked access/legacy and Group fallback/currentTrip+/return scroll. These
  use synthetic intercepted API; they are not real RLS or physical Honor proof.
- Initial failure reproduced a default300px SVG outside Travel's icon namespace
  and a direct-route dialog stacking issue. Fixed with scoped icon/dialog CSS;
  no overflow hiding, font shrinking, forced click or relaxed assertions.
  One remaining test used the wrong old copy label; aligned it to Copy secure
  invite. All original failures are retained in external logs.
- Hosted read-only baseline:32migration versions match repo; four actual member
  function bodies match source. No customer rows read or database writes.
- Actual isolated two-user/invite-without-friendship/permissions/manual/accepted
  expense-and-settlement history/Owner removal/self-leave/preview-count E2E
  added; execution pending disposable CI. Local Docker vfs blocker not retried.
- Physical Android/Honor Back/native keyboard/real browser zoom not run.

## Release checkpoint

PR40draft created; exact latest source must pass isolated CI before merge.
No current feature production deployment or real-user private screenshot is
claimed. Follow the existing authorized GitHub/Vercel project workflow after
current tests pass. Real management writes belong only to isolated backend QA;
no customer bills or membership should be modified for verification.

Evidence/recovery: /workspace/verification/issue01-members-2026-10-28. Read
PROJECT_STATUS/WORK_LOG/current git diff after interruption. Do not reinstall
old SQL, reset production or implement the remaining issues.
