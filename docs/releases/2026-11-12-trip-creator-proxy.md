# Trip 创建者代记还款：上线与验证记录

2026-11-12（Asia/Bangkok）：真实生产 schema 已核验，PR61已合并。应用 main `b19a3973bdebcbd293d16e34bb368adb750a76e3` 的完整树与通过全部8项CI的 `9877f96e021ead96aca55e4a76df69fbd062c42c` 相同。现有 Vercel 项目已 READY，公开页面已核验新代记模块；最终文档版本与 PWA 检查会独立跟进。

## 已接入的真实功能

- Trip → Settle up → 帮成员记录还款。真实创建者默认有权限；只有创建者能明确授予、撤销当前成员的权限。普通角色标签不授权。授权变更、移除成员和转让创建者会让原预览失效；Group 不产生代记权限记录。
- 全屏 Matte Paper 页面，真实成员头像/首字母选择、多实际付款人/收款人、MYR/VND、系统/自填汇率、实际时间、现金/转账、备注。收款人头像切换实线钱路，按需展开虚线路由和抵扣后的相关余额。
- 勾选实际发生确认后直接入账，不插入虚假成员批准。原单人、批量、普通路由、混币种仍走原规则。
- 自己的实际现金侧可明确选择本人账户；不会替其他成员选私人账户。相关成员以后关联本人账户只补私人流水，不增加第二笔共享现金。
- 同事务内提交实际现金、原币抵扣、可选本人流水、审计/历史及通知 outbox。统一原金融写入锁、服务端当前权限/成员/原币来源/共享上限/最近预览校验和稳定请求收据。
- 未知结果冻结原请求恢复。登出移除金额草稿，只保留按身份和 Trip 隔离的请求 UUID；重新登录先查结果或明确终止旧请求，不能误发第二笔。
- 每位相关真实账号收到含代记人姓名的应用通知；手动成员不伪造收件人。通知深链接、记录读取及后补账户都重新核验当前身份。普通成员只见自身相关行和自己的账户侧。
- 更正申请仅记录待处理事项；当前创建者/代理可处理。整笔撤销沿原冻结资金/原币及依赖规则恢复；原记录、撤销和替代记录可追溯。已撤销记录不显示过时的“剩余欠款”。

## Migration / 安装

新增 `supabase/migrations/202611110001_trip_creator_proxy.sql`。私有表：policies、grants、reviews、records、receipts、corrections、audit、outbox；公共通知投影表启用 RLS。新增授权/预览/登记/读取/本人账户关联/更正/整笔撤销 RPC，受保护的分钟 worker 和实时通知。普通路由使用同一受保护金额核心，原算法与普通成员批准条件保留。

完整安装器 `docs/runbooks/trip-creator-production-apply.sql` 只安装本次能力，要求既有 routed V2，不执行代记、结算或 Reset。重复安装核验 47 项最终函数正文/执行权限、私有表保护及通知策略；独立只读审计同时验证版本、RLS、worker、实时 publication 和日期 STABLE 属性。旧安装器保持冻结，不能在新 schema 后重跑旧 routed 安装器。

## 已观察的最终验证结果

最终源码 `9877f96e021ead96aca55e4a76df69fbd062c42c`，Quality [43040594310](https://github.com/monowanderer373/monosplit/actions/runs/43040594310) **8/8 SUCCESS**。

| 检查 | 实际结果 |
|---|---|
| ZIP 原始参考工作流/算法 | 33/33 PASS；已打开 preview，属于参考模拟 |
| hosted PostgreSQL pgTAP | 1,377/27 文件 PASS，含 creator79、普通 routed67 |
| 权限/并发 | 原有及新增10个真实会话脚本 PASS，含 proxy/legacy/batch/routed 争用、同请求重试、撤销授权与先提交的旧结算 |
| strict schema lint / 升级 | PASS；完整安装升级及重复执行，47最终函数正文/执行权限、表RLS/通知策略/worker审计 PASS |
| 单元 / ESLint / TypeScript / PWA build | 918单元/130文件、ESLint、TypeScript、PWA build PASS |
| 生产模块图界面回归 | 393 PASS，0unexpected、0flaky、0skipped |
| 完整浏览器回归 | 561 PASS，0unexpected、0flaky、0skipped |
| 专门真实认证浏览器 | 17 PASS，0unexpected、0flaky、0skipped |
| Travel / CollectPay 浏览器 | 17 /10 PASS |
| 新流程本地手机定向 | 10/10 PASS，320/430及短视口、大字号、系统返回、恢复与整笔撤销 |

真实 PostgreSQL 覆盖双收款人、共享原币上限、Alex 未付余额、错误账户拒绝、本人后补关联、MYR/VND原币与实际流水、手动成员不伪造通知、整笔撤销与替代关联、更正申请不改余额、成员移除/重新加入/创建者转让、通知RLS、worker重试去重及末步骤错误整批回滚。

真实认证测试使用 GoTrue/PostgREST、实际 RLS 与账目。创建者从实际页面直接登记，收款人通过实际通知深链接读取自己的行；本人账户关联和更正使用真实认证 API 断言，整笔撤销使用实际页面。4张已下载截图来自 `ed697ee`，其 src 与migration逐文件等于最终候选；最新源码同一流程17/17通过，但该次截图下载受存储端限制，未声称已取得最新源码图片。编译应用+虚构接口截图10张另列，避免混淆后端证明与界面测试。

首次完整本地界面回归391/392，其中旧 History430 从 Members 返回失败；不改断言的定向组9/9随后通过。最终hosted393及完整561均直接通过，0flaky。初期失败保留在工作日志，不能计作最终通过次数。

## 实际变更文件

- 页面/交互：`TripCreatorSettlement.tsx`、`CreatorMemberPicker.tsx`、`CreatorSettlementEntry.tsx`、`trip-creator-settlement.css`；接入既有 `TripLedger.tsx`、`SettlementPanel.tsx` 与 `RoutedSettlementMap.tsx`。
- 服务/通知/恢复：`src/lib/creatorSettlement.ts`、`creatorTexts.ts`、`useCreatorNotices.ts`、`CreatorNoticeTarget.tsx`；扩展现有通知模型、翻译、首页通知、身份清理及 Trip 子页面返回保护。
- 数据库：仅新增 forward `202611110001_trip_creator_proxy.sql`，未修改旧 migration/旧安装器。
- QA/运维：新增 creator SQL、真实并发、native backend、mobile UI 与服务单元测试；完整安装器/验证器/runbook；CI继续全部断言，支持当前runner已安装Chrome并处理已观察的Ubuntu镜像DNS故障。
- 完整41个路径见 [PR61的完整变更](https://github.com/monowanderer373/monosplit/pull/61/files)。

## 失败及修正

首轮 hosted SQL lint 发现日期标准化函数错误声明 IMMUTABLE；已改 STABLE 并保持严格 lint，不跳过警告。首次手机检查发现父页重建历史丢失返回焦点、受影响行顺序不稳定，以及图中普通提案措辞不适用；均已修正并重跑9项通过。

首轮 CI 浏览器在安装系统依赖时因 `azure.archive.ubuntu.com` DNS 故障失败；未到应用测试。随后使用 runner 已安装的受支持 Chrome channel，并保留原 Chromium 安装作为后备及所有断言；最终393/561/17等浏览器检查全部通过。旧失败结果保留，过时运行取消，不计为通过。

## 环境与发布边界

用户已完成本次安装。已使用真实生产 Management API 独立核验：42个migration版本精确相等，47/47函数正文、47/47权限、财务与私有表RLS、通知ACL/策略、STABLE声明、worker与实时publication全部通过。连接仍只读，本轮没有重装SQL，没有生产财务QA写入。

实际生产 Vercel：原项目 tabby-tally，部署 `dpl_9ncEK3yDX2BsBc7TAbrLJdxfRALm`，main源码匹配且READY。公开地址 https://tabby-tally-monowanderer373s-projects.vercel.app/ ，entry `/assets/index-DCfiMz3N.js`；102个precache JS/CSS、新代记RPC/页面及原有结算/QuickSplit/金额左对齐已检查。320/390/430px公开未登录页面无溢出、运行时错误或自动认证。未使用真实客户账号或账目进行生产写测试。

保留旧版297公共PWA已检查：首次更新缓存并激活了新资源，但重新打开的文档仍旧，保留超时结果；第二次原样的正常关闭/重新打开周期通过，当前entry+5个模块资源被控制并缓存、公开离线shell通过。没有删除静态缓存。最终完成文件仅涉及文档，实际最终发布SHA另作独立复核。

无额外 SQL、用户权限批准或配置任务待办。

未测试实体 Honor Magic 7 Pro、OS 软键盘、物理 safe area 或系统字号；所有本地截图为 Chromium 视口模拟，不是生产客户记录。当前独立本地 PostgreSQL 不含完整 GoTrue/PostgREST；真实认证已使用隔离 hosted Supabase，最终源码全套CI已通过。未向生产写任何财务 QA 数据。

安装文件SHA256：`e976e73d30dbf87aa241a84b8852924253e97544ff2b11abef8f0f79a9a063ff`。不可变raw下载已独立读取并与本地字节逐一相等。上述安装已核验、PR已合并、应用生产版本已实际核验；文档完成版本另作最终检查。
