---
name: monosplit-context
description: Provides full context for the MonoSplit project — a mobile-first travel expense splitting PWA built with React, Vite, TypeScript, Tailwind CSS, Zustand, Supabase, and deployed on Vercel. Use when working on any MonoSplit feature, bug fix, data model change, UI update, sync logic, i18n, or PWA configuration. Always read this skill at the start of a MonoSplit session.
---

# MonoSplit Project Context

## What It Is

A mobile-first travel expense splitting web app (PWA). No login required — groups are shared via UUID link. Data lives in Supabase (PostgreSQL JSONB) with localStorage as offline cache and real-time sync via Supabase Realtime.

**Live URL**: https://monosplit.vercel.app  
**Repo**: GitHub → monowanderer373/monosplit  
**Deploy**: Vercel (auto-deploy on push to `main`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 8 + TypeScript |
| Styling | Tailwind CSS v4 (utility-first, mobile-first) |
| State | Zustand with `persist` middleware (localStorage) |
| Routing | React Router v7 |
| Backend | Supabase (PostgreSQL JSONB blob per group, Realtime) |
| PWA | `vite-plugin-pwa` + Workbox (`skipWaiting: true`, `clientsClaim: true`) |
| Fonts | Departure Mono (custom), Inter, DM Sans |
| Deploy | Vercel + `.npmrc` with `legacy-peer-deps=true` |

---

## Core Data Model (`src/types/index.ts`)

```
Group
  id: string (UUID v4)
  name, startDate, endDate, defaultPaidCurrency, defaultRepayCurrency
  people: Person[]
  expenses: Expense[]
  comments: GroupComment[]

Person
  id, name, avatarDataUrl, nameColor
  paymentInfo: PaymentInfo
  paymentProofs: PaymentProof[]
  skipRepaidConfirm?: boolean   ← per-person "don't show confirm again"

Expense
  id, category, description
  payerIds: string[]            ← ARRAY (migrated from legacy payerId: string)
  amount, paidCurrency, repayCurrency, paymentMethod
  splitMode: 'equal' | 'itemized'
  itemizedInputMode: 'pretax' | 'total' | null
  serviceTaxPct, salesTaxPct, tipsPct, taxPctTotal
  date, createdAt
  splits: Split[]

Split
  personId, amount, baseAmount, taxAmount
  repayCurrency, convertedAmount
  rate, rateSource, rateDate
  repaid, repaidAt, repaidDate
```

---

## Critical Migration History

### `payerId` → `payerIds` (breaking change, now fixed)

Old data stored `payerId: string`. New code uses `payerIds: string[]`.

Migration runs in **three places** — do not remove any of them:
1. **localStorage hydration** — Zustand `persist.migrate` (version 1→2) in `useStore.ts`
2. **Supabase fetch/realtime** — `migrateGroupData()` called in `upsertGroup` and `replaceGroup`
3. **localStorage save** — `partialize` maps through `migrateExpensePayerIds`

All components use `expense.payerIds ?? []` defensive fallback — never access `.payerIds` without `?? []`.

---

## Key Files

```
src/
  types/index.ts          — all TypeScript interfaces
  store/useStore.ts       — Zustand store, persist (version 2), migrate fn, all actions
  hooks/
    useGroupSync.ts        — Supabase fetch + realtime subscription + debounced upload
    useGroupWorkspace.ts   — deep hook for GroupPage: wraps useAuth+useGroupSync, exposes only decisions (access/sync/identity/invite/diagnostics) + saveExpenseWithRecovery; no raw ownerId/timing leaks out
  lib/
    i18n.ts               — translations (EN/ZH), useT() hook, tCategory()
    currency.ts           — fetchRate() with Frankfurter API fallback
    settlementLedger.ts   — createSettlementSnapshot() calculates who owes whom
    settlementCommands.ts — recordPayment/quickSettle/editPayment (pure, validated settlement commands)
    groupNormalize.ts      — normalizeExpense/normalizeSettlementPayment/normalizeGroup (single source of truth for inbound/outbound data sanitization)
    groupRepository.ts     — GroupRepository interface + Supabase adapter for the `groups` table (fetch/save/subscribe/softDelete/listOwned)
    compileExpense.ts      — compileExpense(form, ctx): validates the ExpenseForm wizard state and assembles the Expense payload; owns FormState, ExpenseForm.tsx imports it
    groupWorkspace.ts      — pure decision logic behind useGroupWorkspace: shouldAutoClaim/shouldRegisterMembership/buildDiagnosticsText/saveExpenseWithRecovery; tested with plain vitest (no DOM)
    export.ts             — exportGroupAsJson/Csv, parseImportedJson
    supabase.ts            — createClient, supabaseEnabled flag
  components/
    BottomTabs.tsx         — mobile nav bar
    ExpenseForm.tsx        — add/edit expense wizard UI (multi-payer, itemized, tax, fetch rate); delegates validation/assembly to lib/compileExpense.ts
    SummaryTab.tsx         — expense + settlement summary with alternating row colors (renders expense rows inline, no separate ExpenseCard component)
    SettleTab.tsx          — outstanding balances + repay-all modal + mark-repaid confirm
    PeopleTab.tsx          — travellers, group settings, theme, language, data
    DashboardTab.tsx       — shared comments + payment info
  pages/
    GroupsPage.tsx         — list groups, create, join by link
    GroupPage.tsx          — single group, tab switching, sync status; delegates auth/sync/role/identity/invite/diagnostics orchestration to hooks/useGroupWorkspace.ts, only owns tab/modal UI state itself
    EmbedPage.tsx          — read-only Notion embed at /embed/:groupId
```

---

## Supabase Setup

- **Table**: `public.groups` — columns: `id uuid`, `data jsonb`, `version int8`, `updated_at timestamptz`
- **RLS**: open read/write for any anon key with correct group ID (link-based auth)
- **Realtime**: enabled on `groups` table
- **Env vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (set in Vercel + local `.env`)
- **Sync strategy**: last-write-wins by `version` counter; 600ms debounce on local changes

---

## Zustand Store Rules

- **Persist version**: currently `2`. When adding new fields that need migration, bump to `3` and add a `migrate` case.
- **`partialize`**: only saves `lang`, `themeId`, `groups` (with sanitization). Do not add raw functions or non-serializable values.
- **`lang`**: `'en' | 'zh'` — persisted, controls i18n globally.
- **`themeId`**: `'solid-vintage'` (default) or `'calling-of-dungeons'`.

---

## i18n Pattern

```typescript
// In components:
const t = useT()
t('some.key')         // reactive to lang changes
tCategory(category)   // translates expense categories

// Outside React (store actions, export):
t('some.key', lang)   // pass lang explicitly
```

All UI strings must have both `en` and `zh` entries in `src/lib/i18n.ts`. Never hardcode English strings in JSX.

---

## PWA Notes

- Icons: `public/favicon.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png`
- App name: **Mono Split** (with space)
- `skipWaiting: true` + `clientsClaim: true` → new deployments take effect immediately without waiting for tab close
- If users see stale UI: DevTools → Application → Service Workers → Unregister, then reload

---

## Themes

| ID | Name | Font |
|---|---|---|
| `solid-vintage` | Solid Vintage | Departure Mono |
| `calling-of-dungeons` | Calling of Dungeons | Inter / DM Sans |

Theme is applied via `data-theme` attribute on `<html>`. CSS variables in `index.css` control all colors.

---

## Common Pitfalls

- **Never** use `expense.payerId` — always `expense.payerIds ?? []`
- **Never** hardcode English strings in JSX — use `t('key')`
- **Never** use native `<input type="checkbox">` — global CSS applies `-webkit-appearance: none` which hides it. Use a custom styled button toggle instead.
- **PowerShell**: use `;` not `&&` to chain commands
- **Vercel env vars**: must be prefixed `VITE_` to be exposed to the frontend
- When bumping Zustand persist version, always add a `migrate` case for the previous version
