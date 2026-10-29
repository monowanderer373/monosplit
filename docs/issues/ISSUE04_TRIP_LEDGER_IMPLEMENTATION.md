# Issue 04：紧凑 Trip 账本 — Implementation Report

2026-10-29。范围仅 Issue 04，衔接并保护 Issue 01–03；没有实施 Issue 05。初始 main：`ec0c067523df8569dba37656b98175ca067e4f59`，初始工作树干净。

## 实际改动

- 在原 `/space/:id` 的 Trip 分支实现紧凑头部、按原币分别展示的应收/应付摘要及「账目 / 结算」标签，普通入口默认账目。有 pending 或欠款也不擅自切换标签。Travel 个人消费概览与 Group / Direct 页面保持原用途。
- 删除 Trip 页内 Add expense，原底部唯一＋绑定当前真实 Trip、角色与 active 状态；创建流程、草稿与原编辑器复用。日期/结算沿用各自原权限，不能用新增费用的状态门禁错误禁掉合法操作。
- 费用行显示原总额、付款人、本人份额（含 0）、历史姓名；原详情/更正/只读行为、outbox 恢复、重试/撤销、SharedRestart/re-tag 保留。默认只渲染前 20 行，查看更多继续读取已获授权的完整结果；总数、摘要与原 recap 不以当前 20 行计算。
- 结算页保留 incoming/outgoing pending、确认/拒绝/取消及原 Full/Partial、金额预览和合法资金来源机制。Pay 点击后才展开原表单。完整付款历史与授权 reversal 进入 History。原 Group/Direct 默认表单与历史没有被全局删除。
- ⋯直接打开按需 History（费用更正/付款/活动）与原 Trip summary；费用详情可定位单条历史。采用同一 Trip 的 query 子视图，避免另造账本路由或第二套统计。
- 两标签保留各自滚动和列表批次；付款草稿、原 request UUID/日期、正在提交锁保留在按身份/Trip 隔离的内存中。History、Members、日期页返回恢复原标签/焦点；旧 section 链接安全映射，错误读取有真实 Retry，不伪装成功 0。
- 仅 Trip 的显示聚合使用原 `deriveRelationalDebtLines`，保持 F=E−T+R、SharedRestart cleared-allocation 解释及币种边界，不把不同人应收/应付相抵。pending 支付和未提交的 `pending:` outbox 投影不成为已确认贡献。汇率不参与本轮结算金额。

## 金融与安全边界

未修改 schema/migration、依赖或 lockfile、RLS、身份模型、分账公式与 transactional/versioned/idempotent RPC。33 个远端 migration 与仓库完全一致；本轮不需 SQL 安装。原 read models、historical names、私密版本可见性、合法账户资金与 immutable history 仍是权威。actor/Trip 的迟到读取不能串数据；重试保留相同请求，不能重复记账。

## 设计与截图对照

已完整阅读 README、全部规范/验收/决策/场景和两张批准图，12 个 manifest 文件/哈希匹配。`comparison.html` 并排呈现批准图与真实 React/CSS 实现，截图仅含隔离合成数据，不含私人生产账目。

- `expenses-320/360/390/430.png`、`balances-320/360/390/430.png`：两主视图。
- `short-large-320/360/390/430.png`：200% 根文字与短视口，正常滚动、不裁剪金额。
- `chinese-long-320-200.png`：中文长名称、大额、多币种。
- 有意保留原底部导航/纸质＋和原 Confirm received 文案，没有用参考图演示导航或整张图片替换 UI。
- 截图复查发现 Pay 会盖住金额，修复为有效 CSS grid 分行；新增四宽度×100/125/150/200% 的按钮/金额/说明区域不相交、44px 目标及390/430底栏净空断言。最终截图已更新。

## 实际测试

| 层次 | 结果与证据 |
|---|---|
| 基线单元 | PASS：798 项 / 115 文件，37.43s |
| 当前完整单元 | PASS：817 项 / 119 文件，43.19s；最终 CI 重新运行应用检查 |
| 新增定向测试 | PASS：19 项 / 4 文件，2.15s；方向/多币种/pending/SharedRestart/reversal/完整统计/权限身份/原 payload 重试与返回来源 |
| TypeScript / ESLint / build | PASS：最终精确源码 CI 全八任务成功（见下方细项） |
| 当前实际 React/CSS Trip UI | PASS：14 项，42.9s；320/360/390/430、125/150/200% 根文字、短屏、长文/大额、隐私、默认标签、27行/full recap、返回、错误重试、关闭状态与原角色门禁 |
| Issue01/03 联动 | PASS：本地39项集成（当时12ledger+14dates+13Members），1.6min；最终 CI 再覆盖完整套件 |
| 完整浏览器 / production graph | PASS：完整浏览器423 passed + 1 flaky（自动重试通过，13.6min）；production graph263 passed（3.8min） |
| 隔离真实后端 | PASS：10项真实Trip/多人流程（2.0min）；新 native 用例使用真实三用户、成员、费用、提案/确认/现金账户记账/reversal，检查原费用历史不变、仅两次合法命令、他人费用只读；无 mock 替代后端 |
| 数据库/历史升级/并发 | PASS：1021项/22 SQL文件、strict lint、并发与历史升级；17Travel（3.0min）、10Collect/Pay（34.0s）；仅 disposable GitHub Actions stack |
| 生产已登录 / 公开页面 / PWA | PASS：真实 production 正常 owner/view QA/no API interception；8组宽度/文字几何、原底部＋/默认本人、History/Summary/Members/日期/旧链接与刷新/返回焦点；0 runtime errors/金融mutation/metadata写入/私人截图。两身份各10张金融表与成员哈希不变；原保留PWA native update/current cache/9个稳定素材源哈希通过。公开Trip/日期路由四宽度8检查和离线外壳PASS，未泄露私有内容。 |
| 本机 Supabase | BLOCKED：已知 Docker vfs 空间限制，未重复失败安装；真实 DB/E2E 转在隔离 Actions runner 执行 |
| Honor 实机 / Android系统返回 / 原生输入法 / 浏览器UI缩放 / 读屏器 | NOT RUN；模拟视口、根字号放大与 Chromium 键盘检查不能代替实机 |

本轮真实失败与修复：初期旧 multiuser helper 在默认账目里寻找结算，改为显式选结算标签；完整回归旧 universal Quick Add 两条用例寻找已删除页内 Add，改为唯一全局＋。原金额、余额、剩余债务、分摊、权限与拒绝断言全部保留。中间47候选通知用例曾一次 flaky 重试，记录保留；最终候选另有一条完整多人流程等待 Shared 的 Alpha person-card 超时后重试通过；相同多人流程在独立 native 任务中10项全部通过。最终并非零重试，未删除或放宽任何金额断言。CSS 重叠实际修复并新增几何证据，未删掉失败断言。

## 发布与线上核验

PR：[44](https://github.com/monowanderer373/monosplit/pull/44)。最终验证源 `add9404b51a6bcb2f20ae4b48e8077f9bec16dd7`；CI [40865069035](https://github.com/monowanderer373/monosplit/actions/runs/40865069035)。精确源码CI全八任务SUCCESS；PR44已合并为main `88f9798981586f4809ddae1cc90942d5f23ad33b`，整个Git tree与已测试源码一致。现有 tabby-tally production原生READY：`dpl_4UuMaT2CdpY5XMj7JzhMkoKvqhx7`；项目/team/main独立核验正确。公开入口 `/assets/index-CqbVL2YM.js` 包含精确main SHA，新的SpacePage JS/CSS和原Dates/Members均已precache。正常已登录只读QA和保留PWA验证通过；最终docs-only checkpoint会再次验证其READY/公开SHA/当前PWA，终态记录在交付包 `delivery-final.json`，不伪造自引用commit。

生产已只在两个已标记且保留的自有 QA 身份、既有空 QA Trip 做只读 UI 核验，前后每身份10张金融表及成员列表不变；没有新建生产账目、付款或 reset。生产空QA Trip不提供真实非零债务写入证明，实际资金变动由隔离真实后端用例验证，不能相互冒充。

## 修改文件

- `.github/workflows/quality.yml`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/issues/ISSUE04_TRIP_LEDGER_IMPLEMENTATION.md`
- `e2e/fixtures/tripLedger.ts`
- `e2e/multiuser.spec.ts`
- `e2e/person-detail.spec.ts`
- `e2e/trip-ledger-backend.spec.ts`
- `e2e/trip-ledger-ui.spec.ts`
- `e2e/universal-quick-add.spec.ts`
- `playwright.production-ui.config.ts`
- `src/components/ActivityFeed.tsx`
- `src/components/AppShell.tsx`
- `src/components/ExpenseActionSheet.tsx`
- `src/components/ExpenseHistoryList.tsx`
- `src/components/SettlementHistoryList.tsx`
- `src/components/SettlementPanel.tsx`
- `src/components/TripSettlementPanel.test.tsx`
- `src/components/travel/TripLedger.tsx`
- `src/components/travel/trip-ledger.css`
- `src/hooks/useSettlementDraft.ts`
- `src/hooks/useSettlements.test.tsx`
- `src/hooks/useSettlements.ts`
- `src/lib/activityRepository.ts`
- `src/lib/i18n.ts`
- `src/lib/tripLedger.test.ts`
- `src/lib/tripLedger.ts`
- `src/lib/tripLedgerNavigation.test.ts`
- `src/lib/tripLedgerNavigation.ts`
- `src/lib/tripLedgerTranslations.ts`
- `src/pages/PersonalLedgerPage.tsx`
- `src/pages/SpacePage.tsx`
- `src/test/tripLedgerFixtures.ts`

Live URL：https://tabby-tally-monowanderer373s-projects.vercel.app/

剩余限制：Honor实机/原生键盘/系统返回/浏览器UI缩放/读屏未测；localDocker仍受vfs限制，已由隔离CI覆盖后端。完整浏览器含一次已通过重试的Shared人员卡片等待，不宣称零flaky。本轮无SQL/人工安装待办，不实施Issue05。

公开验证辅助脚本最初把日期页的 Sign in 断言直接用于账本页而超时；仓库基线账本页原本显示 unavailable。脚本改为核验各路由真实的保护界面，并保留“无私有Trip组件/无横溢”断言后通过；没有因此修改或放宽应用权限。
