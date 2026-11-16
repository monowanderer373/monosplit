# Trip Settle up Contra 验证报告

验证日期：2026-11-16（Asia/Bangkok）；测试应用代码：`16fcbb7d9d9eba1129fde718838a9319dbb6d2a0`；[PR #63](https://github.com/monowanderer373/monosplit/pull/63)。PR 已合并至 `4dbfea5fc012c2911cd8e9494867a6073bb10ae4`，生产已上线；用户已完成 SQL 安装，无需再运行。

## 实际接入

- Trip 总览、代记付款名单、点名明细、新版 routed/creator 预览共享服务端净额快照、报价和账目版本。快照明确标记 `edgeBasis: net`；已确认抵扣只计算一次，保留成员间独立债务。
- 点击名字展示双向原欠、contra、最终净应付及可展开的原币账单／已抵扣来源，再进入原录款页面；只带入成员与币种，实付金额留空。
- 读取复用原有 native query 的一致性快照，不占记账锁。写入继续使用原有事务锁，重新核对角色、成员、报价、版本和共享上限。
- 经中间人先同时抵两段净欠款，再抵付款人自己的直接欠款。实际现金只记真实付款人和收款人，原有 VND/MYR、账户归属、通知、幂等、更正和整笔撤销保留。
- 保留现有原币结算精度，MYR 估值来自同一份原币与报价；整数原币抵扣必须精确解释还款前后差额。无法表示的分配明确拒绝，不增加容差或抹零。
- 修复共享 core 的 System 汇率检测别名冲突：VND 实付涉及反向 MYR 欠款时，正确保留系统报价。此修复作用于后续预览／入账，不改写已有记录。

主要文件：`TripLedger.tsx`、`SettlementPanel.tsx`、`TripCreatorSettlement.tsx`、`TripRoutedSettlement.tsx`、`CreatorRepaymentForm.tsx`、新增 `TripContraDetail.tsx`、`useTripContra.ts`、`tripContra.ts`，及定向 SQL／并发／手机测试。

## Migration 与安装

新增 `supabase/migrations/202611120001_trip_bilateral_contra.sql`。无新财务表、无历史行重写。旧未标记 draft、冻结计划及原 `routed_edge` 继续兼容。

完整安装文件：[完整安装器存档](../runbooks/trip-contra-production-apply.sql)；仓库路径 `docs/runbooks/trip-contra-production-apply.sql`，136,448 字节，SHA256 `ae9f32512c617ba993ebae8a794f8acd0db0a5765fe77b6fe6bc7ed4d94329ba`。

安装器校验既有 42 版本 creator baseline 及原 native query，安装后核对 43 版本、61 项最终函数／权限与 STABLE 读取约定。用户已报告短入口安装成功；独立匿名探测确认新 RPC 已存在且正确拒绝匿名调用。没有创建登录会话或生产资金写入。管理接口仍返回 401，未冒称另做了生产库 61 项直接审计。

针对首次粘贴被截断的 42601，增加 1,658 字节的短入口：下载固定提交的完整安装器，先校验 HTTP、字节数和 SHA-256，再在同一事务运行全部检查。7 项真实 HTTPS 测试通过：报错复现、HTTP 404、内容不完整、SHA 错误、安装后注入异常回滚、42→43 升级、重复执行。84 张应用表的完整行摘要与数量均保持不变；失败案例也保持函数、权限和 migration 版本不变。

## 已执行验证

发布提交 `d2d5fec` 的 [Quality43799764962](https://github.com/monowanderer373/monosplit/actions/runs/43799764962) 八项全部通过，包含新增短入口回归。应用和 migration 与 `16fcbb7` 完全一致。下表精确数量来自该应用版本的既有完整测试；最新运行的详细日志受 storagehost10 限制，没有把既有数量／重试记录改写为最新运行的首次结果。

| 检查 | 实际结果 |
|---|---|
| 包内 `node --test qa/*.test.mjs` | 42 PASS |
| 仓库单元测试 | 936 / 131 文件 PASS；最终 CI app PASS |
| lint、typecheck、生产 PWA build | PASS |
| PostgreSQL 全量／RLS | 1,430 项 / 28 文件 PASS，含本轮新增 53 项 |
| 定向真实双会话并发 | 6 场景 PASS，另含只读事务读取 |
| CI 原有全部并发脚本与新增 contra 脚本 | database job PASS |
| 安装升级、重复安装、61 函数／权限指纹 | PASS |
| 严格 SQL 检查（含 performance/extra warnings） | 0 问题；CI strict lint PASS |
| 本地编译应用手机回归 | creator/routed/contra 32 PASS；batch 18 PASS；最终截图检查 5 PASS |
| CI production module graph | 403 PASS，0 unexpected/flaky/skipped |
| CI 真实 Supabase 后端手机 E2E | 18 PASS，0 unexpected/flaky/skipped |
| CI Travel | 17 PASS，0 unexpected/flaky/skipped |
| CI Collect/Pay | PASS |
| CI 完整浏览器回归 | 570 直接通过 + 2 重试后通过；0 unexpected/skipped |

[应用代码完整 CI](https://github.com/monowanderer373/monosplit/actions/runs/43339402074) 八项全部 SUCCESS。完整浏览器两项首次 5 秒等待超时：creator 第二笔核对 checkbox、390px History tab；重试后通过。独立真实后端18项与生产模块图403项均无 flaky。保留波动记录，不把它们写成首次全部通过。保留了早期失败及修复过程：函数 volatility 声明、读锁争用、报价单位、System 别名冲突、旧 schema verifier 调用和新只读 RPC 分类。原有财务断言、超时和权限检查未放宽。

本轮定向验收覆盖：Hanoi 合成示例 0.00 / 788.40，三人净额 348.64 / 288.11 / 151.65；双收款人共享上限；只付 David 时另一收款人待付；route 两段加 direct 余款；未付 MYR；原币 full/partial；重复请求及并发；权限及私有账户；stale preview；System／Custom；原子失败回滚；整笔撤销及依赖保护；pending 保留 standing 并单独限制 capacity。

## 手机截图

运行截图交付位置：`/workspace/artifacts/trip-contra`（含 320/390/430px 明细和名单）。本地截图是编译应用实际运行，使用明确的合成 Hanoi 账目，不是生产用户账目。截图的应用代码树在 94d8215 与最终 16fcbb7 相同。

[最新真实后端手机截图 artifact](https://github.com/monowanderer373/monosplit/actions/runs/43799764962/artifacts/14195594939) 已由 CI 生成。本环境日志／artifact 下载受 storagehost10 网络限制；没有把较旧或模拟截图冒充该 artifact。未连接实体 Honor 手机，实体软键盘验收未运行。

## 生产发布与实际限制

[打开已上线 App](https://tabby-tally-monowanderer373s-projects.vercel.app/)。PR #63 已合并；原项目的 GitHub/Vercel Production 部署 `7815233974` 成功，发布代码 `4dbfea5fc012c2911cd8e9494867a6073bb10ae4` 与通过 CI 的提交树一致。

独立核验正式域名的 `index-OkWDo6Qf.js` 包含准确发布 SHA，102 个预缓存 JS/CSS 均可加载；新快照、版本字段、点名明细和既有 creator/routed/batch/Mixed FX/账户/Quick Split/MYR-VND 左对齐均在。320、390、430px 公开页面无横向溢出、运行错误或自动登录。

旧 69cea5c PWA 保留原缓存进行更新。首次正常关闭重开仍加载旧文档而超时；完全相同的第二次流程通过，新入口及 6 个资源均受控制且已缓存，公开离线页面正常。没有清空静态缓存。最终文档提交仅改变发布记录，其线上 SHA、资源和 PWA 会独立复核并记录在交付 JSON。

仍无法读取真实 Hanoi 私人账目或审计旧 System 别名问题影响的历史范围：管理连接返回 401。没有自动更正、清零或重算历史，截图金额仅是隔离回归样本。实体 Honor 手机及 OS 软键盘未测试。已有登录浏览器控制工具未提供，未尝试读取凭证或接管会话。

**功能已上线，无需再执行 SQL 或确认发布。**
