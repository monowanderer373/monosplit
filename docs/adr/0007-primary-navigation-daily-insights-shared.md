# Primary navigation: 日常 | 分析 | + | 共享 | 我的

Product IA is Daily, Insights, +, Shared, and Me. Travel is a mode inside Daily, not a fifth destination. This supersedes Personal / Friends / Groups-Trips / Me in `src/components/BottomNavigation.tsx` and `GlobalDestination` in `src/lib/moneyContext.ts`. It does not change Canonical Expense, Person, Space, or Phase 5 authority.

## Status

Proposed — 2026-09-21. Implementation must not start until review accepts this ADR together with `docs/PROTOTYPE_IMPLEMENTATION_PLAN.md` and ADRs 0008–0009. Do not mark Accepted in this round.

## Destinations and routes

| Destination | Label | Primary route | Also highlights Shared |
|---|---|---|---|
| Daily | 日常 | `/` | no |
| Insights | 分析 | `/insights` (new) | no |
| Add | + | existing global action; `/quick-add` deep link | no |
| Shared | 共享 | `/shared` wrapper with tabs; default Friends | `/friends`, `/person/:id`, `/spaces`, `/space/:id` |
| Me | 我的 | `/profile` | no |

Daily contains a **fixed upper-right** switch labeled **`日常 | 旅行`** in both modes. Never label this control `Personal | Travel`. Travel filters owner-visible activity via private affiliations plus Space trips the owner belongs to; it does not create hidden Spaces (ADR 0006).

Shared is one chrome with three tabs: Friends, Groups, Trips. One upper-right action:

- Friends → add friend (`public.create_friend_invite` via `src/pages/FriendsPage.tsx`)
- Groups → create group (`public.create_space` with `type = 'group'`)
- Trips → create trip (`public.create_space` with `type = 'trip'`)

`/friends` and `/spaces` remain valid URLs and must highlight Shared. Do not delete `e2e/navigation.spec.ts`; rewrite assertions to the new labels and keep the 44×44 `+` target.

Compatibility redirects in `src/App.tsx` (`/legacy-spaces`, `/group/:id`, `/invite/:token`, `/embed/:id`) stay data-free.

## Home (Daily) display contract

- Balance card: available **asset** money only (`cash | bank | ewallet`), **per currency**, with All / single-account switch and an eye visibility toggle.
- Unknown opening (ADR 0009): never treated as zero. The account shows **`余额待完善`**. It does not trigger insufficient-balance warnings. An All-accounts currency total that includes any unknown-opening account shows only the computable subtotal labeled **`已知余额`**, plus the count of accounts awaiting completion. That subtotal is not presented as a complete total.
- “本月消费” and “待收回” are **non-clickable** summaries. They must not navigate to Insights or Shared.
- Activity grouping in **both** 日常 and 旅行: Today, Yesterday, then specific dates, with visible vertical gaps.
- Default rows keep category icons. Compact mode (design B) hides icons and reduces secondary metadata.
- Every row: **description is always the top-left text**, for Personal, Direct, and Trip.
- Context is a subtle highlighted pill, not a sentence: examples `个人`, `与 Lan 的直接分账`, `Hanoi Days · Trip`.
- Shared/Direct primary amount = current user’s **payer contribution** (`paidMinor` from `src/lib/ledgerSummary.ts`). Group total belongs in details. User share may be secondary.
- Every actual in/out row shows the owner’s **personal account** under the amount, or an unlinked mark if none.
- Incoming: cyan, leading `+`. Outgoing: red, leading `−`.

Quick Add always starts with the owner’s **single global default** payment account (`cash | bank | ewallet`). Choosing another account for one record does not change the default. If the expense currency differs from that account, use actual-debit or pending-funding (ADR 0009). If the owner has no default, Quick Add must request an account or allow an explicitly unlinked/pending record.

Insights date/currency filters: **top overlay/curtain**. Must not push page content down, must not feel like a new route, must not rely on heavy full-page blur as the only affordance.

## What this ADR does not change

Phase 5 correction, settlement, Undo, Person ≠ Participant, integer minor-unit money, or existing RPC names (`public.create_space`, `public.create_friend_invite`).
