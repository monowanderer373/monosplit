# Phase 6 生产发布运行手册

本手册只描述尚未执行的生产发布。操作员必须按门禁顺序执行。缺少书面批准、干跑结果不符、或还原保真度失败时，停止。不要删除或改绑已脱离的 Account Participant。把它记为 `DETACHED_ACCOUNT_PARTICIPANT_WARNING`，它不是迁移阻断项。

机器可读清单：`docs/releases/2026-09-phase6-release-manifest.json`。

本地预检只校验清单、校验和与批准口令。它不会连接生产库，也不会在口令正确时自动执行迁移：

```powershell
powershell -NoProfile -File .\scripts\Test-Phase6ReleasePreflight.ps1 -Action Validate
```

## 发布身份

| 项 | 值 |
| --- | --- |
| 候选 SHA | `fee78a2d468355414826da89c1dc17462402cff5` |
| 源分支 | `release/phase6-final-runbook` |
| 已复核的 `origin/main` | `400b89b902d13f0c92d3b3a6750c4663566c29d4` |
| 生产 Supabase ref | `skiqsxvmxvmxfzhrzcxh` |
| Staging Supabase ref | `czfgglzxiinsyagquhkh` |
| 生产账本，发布前 | 12 条，最新 `202608300012` |
| 生产账本，发布后 | 21 条，最新 `202609240001` |
| Staging 账本 | 21 条，最新 `202609240001` |
| Vercel 项目 | `monowanderer373s-projects/tabby-tally` |
| 生产域名 | `https://tabby-tally-monowanderer373s-projects.vercel.app` |
| 已知生产部署 | GitHub deployment `6188382164`，创建于 `2026-08-31T19:49:12Z`，目标 `https://tabby-tally-2io41nqvp-monowanderer373s-projects.vercel.app`，SHA 与当时的 `origin/main` 相同 |
| Supabase CLI | 固定 `2.117.0` |

Gate 0 必须重新读取最新的 Production deployment。不要把上表里的已知部署当成发布当天的当前别名。

## 工具

- Git
- Node.js 与 npm
- `npx supabase@2.117.0`
- Docker Desktop
- GnuPG
- PowerShell
- 已登录的 Vercel CLI，只用于观察部署和回滚一节里的别名恢复

## 凭据名称

只使用这些名称。不要把值写入手册、清单、日志或截图：

- Supabase CLI 登录令牌：`SUPABASE_ACCESS_TOKEN` 或本机 Supabase CLI 钥匙串
- Windows 凭据管理器：`TabbyTally/ProductionDatabase`
- Windows 凭据管理器：`TabbyTally/BackupArchive`
- Vercel 项目 `monowanderer373s-projects/tabby-tally` 的现有登录
- 构建使用的客户端变量名：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
- 不要设置 `VITE_HOME_VISUAL`

## 脱敏

日志、截图和查询结果只保留计数、版本号、函数签名、授权布尔值和部署 ID。去掉口令、令牌、密钥、UUID、邮箱、姓名、描述、金额和备份文件的本机绝对路径。查询只输出聚合。

## 兼容窗口

九个迁移总体是追加的，但结算 RPC 有一段可见缺口：

1. `202609080001_phase5_financial_trust.sql` 删除两参数 `respond_to_settlement(uuid, text)`。
2. `202609210005_private_settlement_cash.sql` 把三参数函数换成带现金包装的 `jsonb` 返回。
3. `202609240001_legacy_respond_to_settlement_compat.sql` 恢复两参数函数，返回 `text`。

CLI `2.117.0` 的已核对行为：`db push` 逐个文件调用 `legacyApplyMigrations`。每个文件的语句进入一个扩展查询管线，以一次 `Sync` 结束；历史行插入在同一批里。这九个文件没有顶层事务控制语句，也没有 `CREATE INDEX CONCURRENTLY`、`VACUUM`、`ALTER SYSTEM` 或 `CLUSTER`。CLI 不发送显式 `BEGIN`/`COMMIT`。PostgreSQL 在该次 `Sync` 提交这个文件的隐式事务。下一个文件要等上一个文件完成后才开始。

因此这九个迁移不是同一个事务。第一号文件提交后，旧前端调用的两参数 RPC 不存在，直到第九号文件提交。其他会话可以观察到这个缺口。若第九号没有应用到账本，停止前端合并。

发布要求：

- 安静窗口
- 确认没有人正在响应结算
- 只有一名操作员
- 九个迁移一次不中断地执行
- 批次结束后立即核对两个重载
- 第九号未应用则停止
- 两个重载都核对通过之前，不合并 `main`

没有维护模式开关。安静窗口就是写保护。

## 待应用迁移

| 顺序 | 文件 | SHA-256 |
| --- | --- | --- |
| 1 | `202609080001_phase5_financial_trust.sql` | `24f81e41b63c86472b2bea96d4a358b0c8090da7d4f79d6ed0d62c4d7f2ba0b9` |
| 2 | `202609210001_personal_account_journal.sql` | `a30d2fd097bb9e040654bd4d81e6c0e1ac8a56bd3ceac285b3cf35c8653cbf97` |
| 3 | `202609210002_expense_funding.sql` | `770865a4bc5408ed58e0ec3c0c639584bd3bd187c5587291cbe86b8fd8dfd99b` |
| 4 | `202609210003_personal_recurring_auto_post.sql` | `b6922c748ef9220376444da23b2e8a128e6ee882bf0224bc4c01a04f732537a2` |
| 5 | `202609210004_personal_installment_plans.sql` | `440bed68c7fb3a64e2bf5566c93970d9fa7aefbcf1cedf79a1931c061aa2ca7d` |
| 6 | `202609210005_private_settlement_cash.sql` | `a897b976ac1e1a1a158ee81ec037baae08d8d855c822f8b7816ecbb09abfcf32` |
| 7 | `202609210006_space_membership_history.sql` | `e455cbe26e551351ca86ab1f32ad845f5f0fcb94c479d3825489967ff5394ab4` |
| 8 | `202609210007_personal_expense_affiliations.sql` | `74146f66d04e61ff0c2f9d2a8bd18c19452a9d40460f2dece518f5a1b3c7df4d` |
| 9 | `202609240001_legacy_respond_to_settlement_compat.sql` | `28835759bf91f77cfe2fd273f562574d3ab2582e52580557aa46b3af7ecad003` |

## 批准与停止

数据库门禁口令，必须逐字匹配：

`APPROVE PHASE 6 PRODUCTION DATABASE MIGRATION`

前端门禁口令，必须逐字匹配：

`APPROVE PHASE 6 MAIN MERGE AND PRODUCTION FRONTEND DEPLOYMENT`

决策人是发布操作员。恢复负责人只在严重数据完整性失败时另行批准恢复。预检脚本在口令缺失、口令错误、或未显式给出 ref 时以退出码 2 停止。口令正确时它以退出码 3 停止，并且仍然不执行迁移或部署。

立即停止的条件：

- `origin/main` 不是 `400b89b902d13f0c92d3b3a6750c4663566c29d4`
- merge-tree 出现冲突
- 生产账本不是 12 / `202608300012`
- 除脱离账户参与者以外的财务不变量不为 0
- 干跑不是恰好这九个文件、这个顺序
- 校验和与清单不一致
- 还原保真度不是 `RESTORE_FIDELITY_PASS`
- 迁移命令失败
- 最终账本不是 21 / `202609240001`
- 两参数或三参数重载缺失，或返回类型、授权不对
- 旧前端在迁移后的库上不能安全读取
- 生产包里出现 staging ref，或出现 `/__home-visual`

## Gate 0 — 冻结与预检

记录开始时间。工作区跟踪文件必须干净。不要新增迁移。

```powershell
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git status --short
git merge-base --is-ancestor 400b89b902d13f0c92d3b3a6750c4663566c29d4 HEAD
git merge-tree --write-tree origin/main HEAD
powershell -NoProfile -File .\scripts\Test-Phase6ReleasePreflight.ps1 -Action Validate
```

`merge-tree --write-tree` 必须退出码 0。祖先检查必须退出码 0。

在隔离的发布工作树里核对远程账本。日常仓库保持链接 staging，不要在日常仓库里对生产执行 `db push`。

```powershell
git worktree add ..\tabby-tally-phase6-release fee78a2d468355414826da89c1dc17462402cff5
```

随后的 Supabase 命令都在该工作树中执行，并且每次都同时写出 `--linked` 与 `--project-ref`。无目标标志时 CLI 默认走 linked。不要依赖工作区里残留的链接文件。

Staging 必须仍是 21 / `202609240001`，并且两个结算重载都在：两参数返回 `text`，三参数返回 `jsonb`。

生产必须仍是 12 / `202608300012`。把脱离账户参与者计数记为警告。其余不变量必须为 0：孤儿档案、身份关联缺失、费用参与计数、付款合计、份额合计、结算合计、旧邀请令牌暴露。任何账本或这些零计数的变化都停止发布。

本地全量测试必须仍然通过：21 个迁移、pgTAP 658、应用测试 275。

核对 Vercel：Production 部署来自 `main`，Preview 部署来自其他分支。Production 的 `VITE_SUPABASE_URL` 主机必须是生产 ref，Preview 必须是 staging ref。不要把变量值抄进手册。客户端包不得包含 service-role 凭据。`VITE_HOME_VISUAL` 在 Production 构建中不得为 `1`。

## Gate 1 — 新的生产备份

不要复用更早的演练归档。目标 ref 必须是 `skiqsxvmxvmxfzhrzcxh`。

```powershell
powershell -NoProfile -File .\scripts\Backup-Beta.ps1 `
  -Mode PreMigration `
  -Force `
  -ExpectedProjectRef skiqsxvmxvmxfzhrzcxh
```

备份脚本会拒绝与设置不一致的 ref，把归档放在 Git 之外，并在加密后再次解密核对。记录归档文件名、UTC 时间、字节数和 SHA-256。确认明文 `database.dump` 数量回到 0。

然后只把这个新归档还原到未发布端口的一次性本地 Docker 数据库：

```powershell
powershell -NoProfile -File .\scripts\Test-ProductionBackupRestore.ps1 `
  -ArchivePath "<新归档的路径>" `
  -SourceHealthCsv "<只含检查名和计数的源健康 CSV>" `
  -SourceFunctionCsv "<只含签名、返回类型和授权布尔值的源函数 CSV>"
```

必须看到 `RESTORE_FIDELITY_PASS`。源与还原的表计数、Auth 行数、Storage 元数据计数、不变量计数、归档中的迁移账本、`respond_to_settlement` 签名和授权必须一致。`SOURCE_HEALTH_WARNING` 单独记录。若唯一警告是与源相同的脱离账户参与者，继续。若还原保真度失败，或出现新的非零不变量，停止。

这次逻辑备份不包含：Storage 对象字节、Vercel 环境变量、Supabase 项目配置、Auth 提供方设置、重定向允许列表、密钥、外部邮件配置。

删除一次性容器。保留加密归档。不要把路径写入 Git。

## Gate 2 — 生产干跑

在发布工作树中，每次命令前断言 ref。

```powershell
npx --yes supabase@2.117.0 db push --dry-run --linked --project-ref skiqsxvmxvmxfzhrzcxh
```

干跑必须列出恰好九个文件，顺序与上表一致，并且输出 `dryRun: true`。它不得打印 `Applying migration`。把列出的文件校验和与清单比较：

```powershell
Get-FileHash .\supabase\migrations\202609080001_phase5_financial_trust.sql -Algorithm SHA256
```

对其余八个文件重复。任一校验和不一致就停止。

干跑若更少、更多或顺序不同，停止。不要用未展开的环境变量代替 `--project-ref`。记录干跑完成的 UTC 时间，作为迁移前时间戳。

同时用只读查询确认没有意外的远程模式漂移：生产最新迁移仍是 `202608300012`，待应用列表与本地这九个文件一致。确认 Postgres 与 Supabase 服务健康。不要在这一门禁应用迁移。

## Gate 3 — 生产数据库迁移

现在不要执行本节。将来执行前，操作员把数据库口令逐字写入发布记录。

```powershell
powershell -NoProfile -File .\scripts\Test-Phase6ReleasePreflight.ps1 `
  -Action HoldDatabase `
  -ProjectRef skiqsxvmxvmxfzhrzcxh `
  -ApprovalPhrase "APPROVE PHASE 6 PRODUCTION DATABASE MIGRATION"
```

退出码 2 表示拒绝。退出码 3 只表示口令与 ref 被接受，迁移仍未执行。然后由操作员亲自运行：

```powershell
npx --yes supabase@2.117.0 db push --linked --project-ref skiqsxvmxvmxfzhrzcxh --yes
```

记录开始与结束 UTC 时间。保存去掉密钥后的输出。第一次失败就停止，不要重试后半段，不要手工插入 `supabase_migrations.schema_migrations`。

成功后重新加载 PostgREST 模式缓存：

```sql
notify pgrst, 'reload schema';
```

用只读聚合确认账本为 21，最新为 `202609240001`。然后确认下列对象存在，且这些表都启用了 RLS：

- `expenses.corrects_expense_id`
- `direct_expense_change_requests`
- `direct_expense_change_approvals`
- `settlement_allocation_reversals`
- `personal_accounts`
- `personal_account_transactions`
- `personal_account_entries`
- `personal_account_events`
- `personal_funding_intents`
- `personal_recurring_rules`
- `personal_recurring_occurrences`
- `personal_installment_plans`
- `personal_installments`
- `settlement_payment_requests`
- `settlement_attribution_intents`
- `personal_settlement_cash_legs`
- `space_membership_intervals`
- `personal_expense_affiliations`

缺失索引计数必须为 0。至少包括 `expenses_one_authoritative_child_idx`、`personal_accounts_one_active_default_idx`、`personal_funding_intents_one_active_idx`、`space_membership_intervals_one_open_idx`、`personal_expense_affiliations_owner_active_idx`。

`respond_to_settlement` 必须恰好两个重载：

- `(uuid, text)` 返回 `text`
- `(uuid, text, integer)` 返回 `jsonb`

`authenticated` 可以执行受保护 RPC。`anon` 不能执行其中任何一个。`public` 没有额外的执行授权。不要写入持久测试数据。

## Gate 4 — 旧前端兼容

合并 `main` 之前，用当前已部署的旧前端对迁移后的库做只读检查：登录、个人账本、好友与人物、空间与旅行、既有费用、既有结算、Quick Add 能打开、以及 `/legacy-spaces`、`/group/:id`、`/embed/:id` 这些兼容跳转。

结算写入不要在生产留下假记录。使用二者之一：

- 在一个会回滚的数据库事务里调用两参数函数，然后 `ROLLBACK`；或
- 采用已经在 staging 通过的契约，加上生产上的函数签名与授权核对。

必须没有缺列、旧路由缺表、两参数 RPC 无法解析、`PGRST203`，以及新的 PostgREST 4xx/5xx 回归。旧前端不能安全使用时，停止，不合并 `main`。

## Gate 5 — 合并与生产前端

现在不要执行本节。数据库 Gate 3 与旧前端 Gate 4 都通过之后，把前端口令写入发布记录。

```powershell
powershell -NoProfile -File .\scripts\Test-Phase6ReleasePreflight.ps1 `
  -Action HoldFrontend `
  -ProjectRef skiqsxvmxvmxfzhrzcxh `
  -ApprovalPhrase "APPROVE PHASE 6 MAIN MERGE AND PRODUCTION FRONTEND DEPLOYMENT"
```

然后：

```powershell
git fetch origin main
git rev-parse origin/main
git checkout main
git merge --no-ff release/phase6-final-runbook
git push origin main
```

`origin/main` 必须仍是 `400b89b902d13f0c92d3b3a6750c4663566c29d4`，否则停止。不要改写历史。

观察 Vercel 自动创建的 Production 部署。要求 CI 与构建成功。记录部署 ID 和提交 SHA。部署包必须包含生产 ref、不包含 staging ref、不包含 `/__home-visual`。Production 环境变量不得被 Preview 的值替换。

构建失败时，不要手工改生产别名，除非进入下面的前端回滚。

## Gate 6 — 新前端冒烟

使用真实的生产登录会话。只读核对：登录与会话保持、每日首页、余额失败时关闭而不是显示假零、账户选择、隐藏余额、月支出、共享余额、最近记录、详细与紧凑模式、Direct 贡献金额、旅行模式、日期分组、Insights、Shared、好友与人物、空间与旅行、全局 Quick Add 能打开、没有旧首页重复、底部导航存在、没有 staging 夹具数据、页面请求的主机不是 staging ref、没有意外的 PostgREST 错误。

只有操作员明确选择一笔真实交易时才做持久财务写入。不要为测试制造假账。截图前遮住私人交易明细。记录冒烟结论和时间。

## Gate 7 — 二十四小时监测

每个时点只记计数和签名，不记财务正文。时点：部署后立即、+15 分钟、+1 小时、+6 小时、+24 小时。

核对：

- Supabase / PostgREST 4xx 与 5xx
- Auth 失败
- 两个 `respond_to_settlement` 签名仍在
- `create_expense` 与 `create_expense_with_funding` 的失败计数
- 账户读取失败
- affiliation 失败
- Sentry 回归
- Vercel 函数与运行时错误
- 迁移账本仍是 21 / `202609240001`
- 财务不变量计数
- RLS 拒绝异常
- 用户报告

把五个时间写入清单占位符。

## 回滚与前向修复

### 前端失败

恢复上一个 Vercel Production 部署别名，使旧前端重新对外。用兼容 RPC 确认旧前端可用。保留已经追加的数据库迁移。

### 兼容 RPC 失败

不要向下迁移整套 Phase 5/6 表。写一条经过复核的前向修复迁移。旧前端保持为对外版本，直到修复后的两参数函数通过签名、授权和回滚事务冒烟。

### 迁移部分失败

停止前端部署。记录账本里最后一个实际版本。不要手工改账本。评估前向修复。只有数据完整性已经受损，并且恢复负责人明确批准时，才使用新备份做恢复。

### 严重数据完整性失败

在操作上可行的范围内停止写入。保留日志和时间戳。使用 Gate 1 核对过的新备份。写明恢复目标和可接受的数据丢失窗口。需要单独的恢复批准，不能用上面两个发布口令代替。

## 发布记录

| 项 | 记录 |
| --- | --- |
| Gate 0 时间 |  |
| 备份文件名 |  |
| 备份 SHA-256 |  |
| 备份字节数与 UTC 时间 |  |
| 还原保真度 |  |
| 源健康 |  |
| 干跑时间 |  |
| 数据库批准时间与操作员 |  |
| 迁移开始 / 结束 |  |
| 最终账本 |  |
| 旧前端冒烟 |  |
| 前端批准时间与操作员 |  |
| `main` 推送 SHA |  |
| 最终 Vercel 部署 ID |  |
| 新前端冒烟 |  |
| 监测五个时间 |  |
