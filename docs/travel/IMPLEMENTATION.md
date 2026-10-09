# Travel 实现审阅说明

日期：2026-10-09。基线：`2e6ab7f5f64f361a0a52823bdbfd1bf343beae7f`。

本次实现按照提供的 Travel handoff 接入现有应用。未合并、未部署。此审阅包包含变更源码、可重放的完整二进制补丁与本地验证日志；不包含真实浏览器截图。下述浏览器验证尚未执行，不能将本地测试通过视为视觉验收完成。

## 已实现

- Travel 首页：无旅程引导、已选旅程摘要、零记录状态、加载及错误状态；金额来自现有账本模型，按币种分开汇总个人承担金额。
- 旅程选择：锚定纸卡弹层、键盘选择、Escape/外部点击关闭、关闭后恢复焦点；创建及管理入口复用原有页面。
- 旅程详情：真实日期、状态、记录与合法成员信息，复用原有详情/成员/管理入口；只在可写且未归档时显示 Add expense。
- Quick Add：复用现有 composer、写入服务和服务器权限校验；预选当前旅程，并恢复同账户、同旅程、同一天的草稿。
- 状态恢复：旅程选择按账户保存；同旅程返回保留列表密度、已展开日期和滚动位置。切换身份时清除对应旅程选择。
- Travel 样式及素材：使用 handoff 的丹宁、纸张、皮革、图标和插画；移动布局、长文字及金额折行、安全区和实际按钮高度留白均已编写。
- Daily 与已有收付款逻辑继续使用原有组件/服务；没有数据库迁移、生产数据写入或新增汇率换算。

## 数据和权限

Home 模型从原页面提取；`personalSpendingMinor` 仍是个人支出来源。记录、标题与币种随同一个 selected trip 同步切换。请求结果保留账户与请求代次隔离，成员请求还校验 trip key，防止迟到响应显示前一个旅程的数据。加载/读取失败不伪装为零金额或无旅程。

现有个人旅程标签 `affiliation:` 没有共享空间成员或预选写入接口。因此不制造成员信息，也不把该标签冒充可写共享 Trip：详情复用真实个人记录，并提示通过原 Quick Add 保存后在费用详情关联标签。不可访问的详情不回退到其他旅程。

## 接入位置

| 位置 | 作用 |
| --- | --- |
| `src/components/travel/` | Travel 首页、详情、选择器、样式及组件测试 |
| `src/hooks/useHomeModel.ts` | 原首页账本模型提取及 Travel 数据状态 |
| `src/hooks/useTravelMembers.ts` | 有权限成员读取和请求隔离 |
| `src/lib/travelQuickAdd.ts` | 原 Quick Add 旅程预选和草稿恢复 |
| `src/store/useStore.ts` | 按账户保存旅程选择，持久化版本 9 |
| `src/pages/PersonalLedgerPage.tsx` | 原账本页面与详情路线接入 |
| `src/pages/SpacesPage.tsx` / `SpacePage.tsx` | 复用创建、管理、信息和成员页面 |
| `src/components/home/HomeScreen.tsx` | Travel 分支与按 trip 保存列表展开状态 |
| `public/travel/` | 提供的素材；两张 PNG 缩至 UI 约 3 倍尺寸 |
| `e2e/travel.spec.ts` | 待执行的真实本地 Supabase 浏览器验证 |
| `.github/workflows/quality.yml` | 独立 Travel 浏览器作业及证据上传 |

新增路线为 `/travel/trip/:tripId` 和 `/travel/manage`。详情页面隐藏全局导航，保留原 Quick Add host；日期使用现有格式器，详情信息/成员仍使用现有管理页面。没有为缺少后端接口的操作虚构归档或删除功能。

## 已通过的本地检查

| 检查 | 结果 |
| --- | --- |
| `npm test` | 70 个测试文件、453 项测试全部通过 |
| `npm run lint` | 通过 |
| `npm run build` | TypeScript 应用检查及 Vite 构建通过 |
| `npx tsc -p tsconfig.travel-e2e.json` | 浏览器脚本类型检查通过；不代表执行通过 |
| `git diff --check` | 通过 |
| CSS 颜色静态对比度计算 | 保存于 `contrast-check.json`，不替代渲染检查 |

新增测试覆盖个人支出与全额支付的区分、多币种、快速切换、读取失败、成员响应隔离、个人标签、账户选择隔离及迁移、Quick Add 草稿、详情权限、选择器键盘/焦点、导航返回与日期展开恢复。两项旧 Travel 断言按新的入口更新。

## 待验收

当前环境缺少 Sites 要求的 control-browser 能力，因此没有启动临时预览或用其他浏览器绕过该限制。真实截图、DOM 布局测量、与设计板逐状态比较尚未完成。不得声称像素级还原或浏览器验收通过。

已准备的浏览器脚本在一次性本地 Supabase 账户和真实 RPC 上建立 fixtures，覆盖 320/390/430 px、无旅程、零记录、已有旅程、选择器、详情、只读/无权限、长旅程名/金额、200% 文字和桌面。它会将截图及尺寸 JSON 保存到 `test-results/travel/`。这些是待执行步骤，不是已有截图。

后续须运行浏览器作业、处理可能的交互或布局失败，再将真实截图与三张参考板及 handoff 标注逐项比较。特别检查弹层定位、点击区域、200% 文字、底部安全区、长金额、列表密度和返回滚动恢复，并确认 Daily/收付款浏览器回归。当前没有自动部署步骤。

`vercel.json` 为 `feat/travel-denim-paper` 设置 `git.deploymentEnabled: false`，防止审阅分支推送触发 Vercel 自动部署；主分支配置保留。

## 补丁使用

在上述基线的干净工作树执行 `git apply --check travel.patch`，然后 `git apply travel.patch`。审阅包内 `source-files/` 同时提供变更文件原文，`manifest.json` 提供 SHA-256。依赖未变，可使用现有 lockfile 执行 `npm ci`。

此前公开仓库源码上传被自动审批拒绝；用户现已再次明确授权继续上传与验证。本文是本地验证快照，远端提交及 CI 的最新实际状态以 `feat/travel-denim-paper` 审阅分支和 PR 为准。未授权合并或部署。
