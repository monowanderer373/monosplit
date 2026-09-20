# Tabby Tally — 本地交接

导出时点：2026-09-17  
不包含上线操作。本文件只描述当时从本机核对到的状态。

## 当前 Git

- 当前 branch：`phase5-financial-trust`（不跟踪 remote）
- HEAD：`dcbdb30055caa673b137a6e0d3d29763314cae5a`
- 提交说明：`feat: complete Phase 5 financial trust system`（2026-09-09 01:57:25 +0800）
- `git status`：干净工作区（无未提交改动）
- 未提交 / 未追踪的**项目源码文件**：无  
  本机另有 gitignored 文件，**不要**放进交接包：`.env.local`、`.env.production-smoke.local`、`.vercel/`、`dist/`、`node_modules/`、`backups/` 等

本地相对 `origin/main`（`400b89b`）多出 7 个 commit，尚未 push：

1. `f14fd9a` feat: complete UX architecture phases 1-3
2. `09e3797` fix: dedupe context picker and protect global add
3. `53da466` fix: isolate global money action layer
4. `ca379f3` test: stabilize phase 3 production smoke overlap
5. `374091e` test: finalize phase 3 production acceptance
6. `c2b0ab8` feat: add money-first person group and trip details（也是本地 `main`）
7. `dcbdb30` feat: complete Phase 5 financial trust system（HEAD）

## 启动 / 测试

需要 Node.js + npm。仓库未声明 `engines` 版本。完整财务/E2E 需要本机 Docker 与 `npx supabase start`。

```text
copy .env.local.example .env.local
# 填入本机或项目的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

npm install
npx supabase start          # 本地数据库（可选但 E2E / pgTAP 需要）
npm run dev                 # Vite 开发服务器

npm test                    # Vitest
npm run lint
npm run build
npx supabase test db
npx supabase db lint --local --fail-on warning
npm run test:e2e:phase5     # Playwright，mobile-chromium，workers=1
```

不要对共享环境执行 `supabase db push` / `db reset --linked`，除非另有明确上线任务。

## 项目结构

```text
src/                 React 19 + Vite 前端（pages / components / hooks / lib / store）
e2e/                 Playwright
supabase/migrations  PostgreSQL 迁移（共 13 个）
supabase/tests       pgTAP
scripts/             备份、并发 harness、beta 运维脚本
docs/                ADR、beta runbook
CONTEXT.md           领域语言 + Phase 5 锁定原则
```

关键 Phase 5 客户端调用：

- `src/lib/expenseChangeRepository.ts` → `propose_direct_expense_change` / `respond_to_direct_expense_change` / `cancel_direct_expense_change` / `correct_space_expense`
- `src/lib/ledgerRepository.ts` → `cancel_expense` / `restore_owner_local_expense` / `respond_to_direct_expense` / `replace_expense_financials`
- `src/lib/settlementRepository.ts` → `propose_settlement` / `respond_to_settlement` / `cancel_pending_settlement_allocation` / `reverse_settlement_allocation`

## 已完成（本地开发）

- Phase 1 — Navigation Foundation
- Phase 2 — Universal Quick Add + Context Picker
- Phase 2.1 — Category provenance
- Phase 3 — Person Identity / Manual → Linked
- Phase 4 — Person / Group / Trip money-first hierarchy
- Phase 5 — Financial Trust（本地验证已关闭）

下一阶段规划是 Phase 6 Personal Home + UI Redesign；Phase 6 **不得**改写 Phase 5 财务后端。

Phase 5 本地验证基线（记录于 `CONTEXT.md`，本次交接未重跑）：233 unit / 279 pgTAP / 17 concurrency / 23 Playwright。

## 未部署的 migration

`supabase/migrations/202609080001_phase5_financial_trust.sql`

2026-09-17 只读 `npx supabase migration list`：该文件 **local 有、remote 空**。其余 12 个 `20260830*` migration 本地与 remote 均已存在。

**未执行**任何远程 migration apply。首次部署到共享环境后，该文件即成为不可改写的 migration history；之后只能 forward migration。

上线顺序见 `docs/PRODUCTION_HARDENING_RUNBOOK.md` 第 7 节。财务 canary：Expense RM100 → 已接受 settlement RM100 → 权威更正 RM80 → 当前应为反向 RM20 信用。

## GitHub / Vercel（已知）

GitHub：`https://github.com/monowanderer373/monosplit`  
2026-09-17 `gh` 核对：`origin/main` = `400b89b`（`feat: harden production observability and recovery`）。没有 `phase5-financial-trust` remote branch。上述 7 个 commit **未在 GitHub**。

Vercel 项目：`monowanderer373s-projects/tabby-tally`  
2026-09-17 CLI 核对：最新 Production Ready 部署创建于 2026-09-08 00:00 +0800（`tabby-tally-c9lbpno9c-…`），alias `https://tabby-tally-monowanderer373s-projects.vercel.app`。  
Vercel inspect JSON **未返回 git SHA**。时间上接近本地 `53da466`（2026-09-08 00:00:15 +0800），但 **部署对应的确切 commit 待核实**。  
可以确定：HEAD `dcbdb30`（Phase 5）以及 Phase 4 `c2b0ab8` **不是**该次 inspect 能证明已上 live 的版本。

## 运行前提

- `.env.local` 使用 `.env.local.example` 的占位符自行填写；交接 ZIP **不含**真实 `.env`
- 浏览器客户端只用 anon key；service role 不得进入前端
- Playwright 本地套件绑定 `http://127.0.0.1:54321` 与公开的 **Supabase local demo anon JWT**（见 `playwright.config.ts`），不是生产密钥
- 本机 `tmp-*.json` 含个人/账本样例数据，已从 ZIP 排除

## 待核实

- Vercel production 部署的精确 git commit / 是否由 GitHub 自动发布
- 生产自定义域名（若有）是否指向上述 alias
- 远程 Supabase 是否已 refresh PostgREST schema cache / Realtime publication（Phase 5 尚未 apply，通常不适用）
- 生产 backup / PITR 当前仪表板状态（runbook 旧记录，未在本次重查）
- 交接接收方本机的 Node / Docker / Supabase CLI 版本是否与导出环境一致
