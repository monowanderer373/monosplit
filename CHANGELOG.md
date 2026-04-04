# MonoSplit 最新变更记录

## 2026-04-04

### Added
- 初始化项目文档：`BUSINESS_ARCHITECTURE.md`。
- 初始化变更日志：`CHANGELOG.md`。
- 初始化 `Vite + React + TypeScript` 项目并安装依赖：
  - `react-router-dom`
  - `zustand`
  - `tailwindcss`
  - `@tailwindcss/vite`
- 新增核心类型定义：`src/types/index.ts`。
- 新增纯逻辑模块：
  - `src/lib/id.ts`
  - `src/lib/currency.ts`
  - `src/lib/splitCalc.ts`
  - `src/lib/settlement.ts`
  - `src/lib/format.ts`
- 新增状态层：`src/store/useStore.ts`（含 localStorage 持久化）。
- 新增页面与组件：
  - `src/pages/GroupsPage.tsx`
  - `src/pages/GroupPage.tsx`
  - `src/components/BottomTabs.tsx`
  - `src/components/PeopleTab.tsx`
  - `src/components/ExpenseForm.tsx`
  - `src/components/ExpenseCard.tsx`
  - `src/components/ExpensesTab.tsx`
  - `src/components/SettleTab.tsx`
- 重写 `src/App.tsx` 为路由入口。

### Changed
- 更新 `vite.config.ts`，接入 `@tailwindcss/vite`。
- 更新 `src/index.css`，切换为 Tailwind 风格的基础样式。
- 更新 `package.json` 项目名为 `monosplit`。

### Removed
- 清理 Vite 默认示例文件：
  - `src/App.css`
  - `src/assets/hero.png`
  - `src/assets/react.svg`
  - `src/assets/vite.svg`

### 任务总结
- 已完成 MonoSplit MVP 第一版可运行骨架，覆盖 Group 管理、People 管理、Expense 新增（equal/itemized、税费、双币种、自动/手动汇率）以及 Settlement 汇总与还款标记。
- 旧项目关键算法已解耦迁移到纯函数模块（split 与 settlement），并与 UI 分离，便于后续测试和迭代主题/UI。

## 2026-04-04 (第二轮优化)

### Changed
- 统一主题风格与组件样式基类（`src/index.css`）：
  - 新增 `ms-page` / `ms-card-soft` / `ms-input` / `ms-btn-primary` / `ms-btn-ghost` / `ms-chip` 等通用样式。
  - 页面背景调整为更柔和的 radial gradient，提升移动端视觉层次。
- 页面样式对齐：
  - `src/pages/GroupsPage.tsx`
  - `src/pages/GroupPage.tsx`
  - `src/components/PeopleTab.tsx`
  - `src/components/ExpensesTab.tsx`
  - `src/components/ExpenseCard.tsx`
  - `src/components/BottomTabs.tsx`

### Added
- Expense 录入体验增强（`src/components/ExpenseForm.tsx`）：
  - 增加 `category` 下拉（food/transport/hotel/activity/shopping/other）。
  - 增加快速金额按钮（500/1000/3000/5000）。
  - 增加 split people 的 `Select all` / `Clear` 操作。
  - Itemized 模式新增实时汇总反馈：
    - 已填写人数
    - itemized 总额
    - 与 expense amount 的 Remaining / Exceeds 差额提示
- Settlement 信息层级优化（`src/components/SettleTab.tsx`）：
  - 增加 outstanding 按币种汇总 pill。
  - 增加按人员过滤（debtor/creditor）视图。
  - 每条欠款展示 `expenseCount` 与 `splitCount` 元信息，便于追溯。

### 任务总结
- 第二轮优化聚焦“可读性 + 录入效率 + 结算清晰度”，未引入后端、登录或复杂新能力，保持 MVP 范围稳定。
- 已通过 `npm run build` 与 lints 自检，当前版本可继续进入下一轮 UI 细节优化或真实数据试用反馈。

## 2026-04-04 (Tab 重构 + Dashboard)

### Changed
- 底部导航改为 5 槽位顺序：`Summary` → `Dashboard` → `+`（中间圆形按钮）→ `Settle` → `Profile`。
- `People` tab 更名为 `Profile` 并移动到最右。
- 移除“Expense 文字 tab”，改为底部中间圆形 `+` 按钮打开新增 Expense 面板。
- `GroupPage` 改为以 `Summary` 为默认入口，并支持弹层新增 Expense。

### Added
- 新增 `Summary` tab（`src/components/SummaryTab.tsx`）：
  - 整个 trip 的 Expenses 汇总（按支付币种）
  - Settle up 汇总（按还款币种）
  - 费用列表展示与还款标记入口
- 新增 `Dashboard` tab（`src/components/DashboardTab.tsx`）：
  - 每位成员可维护 QR / Bank / Account / Notes
  - 可上传并展示 payment proof（本地 data URL）
  - 新增 group 共享 comment area（互相可见）
- 新增文件处理工具：`src/lib/file.ts`（文件转 data URL）。

### Changed (Data Model / Store)
- `src/types/index.ts` 扩展：
  - `PaymentInfo`
  - `PaymentProof`
  - `GroupComment`
  - `Person` 增加 payment 信息与 proof 列表
  - `Group` 增加 comments
- `src/store/useStore.ts` 新增 action：
  - `updatePersonPaymentInfo`
  - `addPersonPaymentProof`
  - `removePersonPaymentProof`
  - `addGroupComment`
- 持久化兼容处理补齐旧数据默认值（paymentInfo/proofs/comments）。

### 任务总结
- 本次改动完成你指定的 tab 顺序与交互结构，并把“费用录入入口”改成中间 `+` 按钮。
- 新增的 `Dashboard` 在“无后端、无登录”的 MVP 前提下，先以组内成员维度实现支付信息、证明上传和可见评论区，满足先用起来的需求。

## 2026-04-04 (Group 日期编辑 + 底部字体放大)

### Changed
- `Create travel group` 增加可展开日期选择区（start/end date）：
  - 在创建卡片增加“Set trip start/end date”展开入口。
  - 展开后提供 start / end 两个 `type=date` 选择器（按月历选择）。
- Group 页头按钮 `Rename` 改为 `Edit`，点击后打开编辑面板：
  - 可编辑 Trip 名称。
  - 可编辑 Trip start / end date。
- Trip 日期区间展示在 Group 标题下方，使用较小字号，避免抢占视觉焦点。
- 底部 tab 字体整体放大并居中；中间 `+` 圆形按钮放大并居中显示。

### Changed (Code)
- `src/types/index.ts`：`Group` 新增 `startDate` / `endDate`。
- `src/store/useStore.ts`：
  - `addGroup` 支持创建时传入 `startDate` / `endDate`。
  - 持久化兼容补齐旧数据的日期默认值。
- `src/lib/format.ts`：新增 `formatDateRange()` 用于统一日期区间文案。
- `src/pages/GroupsPage.tsx`：
  - 新增创建时日期展开区与日期输入。
  - Group 卡片显示日期区间摘要。
- `src/pages/GroupPage.tsx`：
  - 头部 `Edit` 按钮打开可编辑名称与日期的面板。
  - 标题下方显示日期区间。
- `src/components/BottomTabs.tsx`：
  - 放大 tab 字体和中间 `+` 按钮尺寸，调整为更居中布局。

### 任务总结
- 本次调整覆盖了你指定的创建/编辑日期流程和底部可读性问题，保持现有功能链路不变。
- 已完成构建与 lints 自检，通过。

## 2026-04-04 (Expense Summary 重构)

### Changed
- `Summary` 页面重构为 `Expense Summary`，采用按日期分组展示（外层日期块 + 内层 expense item 双层折叠）。
- 顶部新增日期筛选展开区（Start/End），筛选区间与 Profile 里的 trip period 联动（同样使用 group start/end 作为可选边界）。
- 顶部右侧新增 Category 筛选，并与 add expense 的 category 数据互通。
- 右侧金额文案改为：
  - `付款金额 + 付款币种 (换算后金额 + 还款币种)`
  - 例如：`¥3,000 JPY (RM75.77 MYR)`。
- Expense 展开后改为：
  - 展示 payer 行
  - 展示 debtors 欠款行（以还款币种显示）
  - 移除 `You base`、输入框与 `Mark repaid` 按钮
  - 在每位 debtor 最右侧显示 `Unpaid`（红）或 `Paid`（绿）状态（根据 split.repaid 实时联动 Settle tab 的操作）。

### Added
- 新增共享分类定义：`src/lib/categories.ts`。
  - Expense categories 更新为：
    - Food
    - Drinks
    - Groceries
    - Transportation
    - Flight
    - Accommodation
    - Shopping
    - Sightseeing
    - Activities
    - Other
  - `All` 仅用于 Expense Summary 筛选，不在 Add Expense 中出现。
- Summary 对缺失汇率的历史数据增加在线补全尝试（按 expense 日期调用免费汇率源）。

### Changed (Code)
- `src/components/SummaryTab.tsx`：重写为日期分组、筛选、折叠、状态展示版本。
- `src/components/ExpenseForm.tsx`：
  - category 改用共享 categories
  - date 输入增加 `min/max`（受 trip period 限制）
  - 默认日期优先取 trip start（并对 end 做边界保护）
- `src/pages/GroupPage.tsx`：适配新版 SummaryTab props。
- `src/types/index.ts`：`Group` 新增 `startDate` / `endDate`。
- `src/store/useStore.ts`：`addGroup` 支持 start/end date；持久化兼容补齐日期字段。
- `src/lib/format.ts`：新增日期区间格式化能力。

### 任务总结
- 这次改动是 Summary 模块级重构，目标是让“按天看账 + 展开看人 + 一眼看支付状态”更接近你截图和业务操作习惯。
- 已通过 `npm run build` 和 lints，自检通过。

## 2026-04-04 (Summary Bugfix: 全量展示 + 日期下拉)

### Changed
- `Expense Summary` 默认展示全部 expense（Category=All + Date=All dates）。
- 每个 expense item 增加显式 `Edit` / `Remove` 操作按钮（不再依赖其他页面才能改）。
- `Select Date Range` 改为与 Category 一样的下拉选择框：
  - `Date: All dates`
  - 若 trip 在 Profile 设有 period，则日期选项按该 period 逐天生成。
  - 选项文案样式：`16th / April / 2026`。
- Summary 的日期筛选由“区间输入”改为“单日下拉筛选”，更贴近截图交互。

### Added
- `ExpenseForm` 支持编辑模式（复用同一表单）：
  - 新增 props：`initialExpense`、`title`、`submitLabel`、`onCancel`
  - Summary 内点击 `Edit` 会弹出编辑面板并保存回原 item。

### Changed (Code)
- `src/components/SummaryTab.tsx`：
  - 接入 `onEditExpense`
  - 新增日期下拉选项生成逻辑（基于 trip period）
  - 新增编辑弹层与删除按钮
- `src/components/ExpenseForm.tsx`：
  - 新增 `expenseToForm` 映射与编辑模式
  - 保持创建与编辑共用同一套 split/currency/category 逻辑
- `src/pages/GroupPage.tsx`：
  - Summary 新增 `onEditExpense` 回调并接入 store 的 `updateExpense`

### 任务总结
- 本次修复重点解决了 Summary 的可维护性问题：用户现在可以在 Summary 直接查看全部、筛选单日、编辑和删除。
- 已完成构建与 lints 自检，通过。

## 2026-04-04 (Summary 专属头部显示)

### Changed
- Group 页头部信息卡（Back/Edit/Trip 名称/日期/人数与expense数）调整为**仅在 Summary Tab 显示**。
- 其他 Tab（Dashboard / Settle / Profile）不再显示该头部卡片。

### Changed (Code)
- `src/pages/GroupPage.tsx`：将头部卡片渲染改为 `activeTab === 'summary'` 条件渲染。

### 任务总结
- 本次改动精确对齐你的要求：顶部信息区只在 Summary 页面出现，不影响其他 tab 的内容结构。
- 已通过构建与 lints 自检。

## 2026-04-04 (Summary 头部 Sticky)

### Changed
- Summary 页头部信息卡增加吸顶效果（sticky），滚动内容时保持可见。

### Changed (Code)
- `src/pages/GroupPage.tsx`：
  - Summary 头部样式增加 `sticky top-2 z-20`。

### 任务总结
- 头部吸顶已生效，仍保持“仅 Summary 显示”的约束，不影响其他 Tab。
- 已通过构建与 lints 自检。

## 2026-04-04 (Dashboard 结构重排)

### Changed
- 删除整个 `Proof of Payment` 模块。
- `Comment Area` 重命名为 `Dashboard` 并移动到最上方。
- Dashboard 评论区改为“大正方形消息面板 + 底部输入条”布局：
  - 上方大面板显示可见评论。
  - 下方输入条左侧改为小方块身份按钮（不再使用顶部 select）。
  - 右侧 `Post` 按钮发消息。
- `Payment Dashboard` 重命名为 `Payment Info`，并移动到 Dashboard 评论区下方。
- `Payment Info` 删除 `Upload QR` 与 `Payment Notes`。
- `Payment Info` 增加 `Save/Edit` 模式：
  - 默认只读不可编辑。
  - 点击 `Edit` 进入编辑。
  - 点击 `Save` 保存并回到只读状态，按钮文本切换为 `Edit`。

### Changed (Code)
- `src/components/DashboardTab.tsx`：重构为新布局与编辑流程。
- `src/pages/GroupPage.tsx`：移除 proof 相关 props 传递与 store 绑定。

### 任务总结
- 本次改动已按你草图和描述完成 Dashboard 信息架构重排，并去除不需要模块。
- 已通过构建与 lints 自检。

## 2026-04-04 (Dashboard 身份按钮长按选择)

### Changed
- Dashboard 输入栏左侧身份小方块改为明确显示“姓名首字母”。
- 增加长按交互：
  - 长按小方块会弹出成员选择面板。
  - 点选成员后切换发言身份。
- 保留短按快捷行为：短按小方块可快速轮换到下一位成员。

### Changed (Code)
- `src/components/DashboardTab.tsx`：
  - 新增长按计时逻辑（pointer events + timer）。
  - 新增成员弹出面板 UI（显示首字母与姓名）。

### 任务总结
- 已完成“首字母显示 + 长按弹出成员选择”的交互升级，并兼顾快速短按切换。
- 已通过构建与 lints 自检。

## 2026-04-04 (Dashboard 长按交互微调)

### Changed
- 身份小方块改为“短按无动作”，仅支持“长按弹出成员选择”。
- 在输入栏下方新增英文提示文案：
  - `Long press avatar to choose member.`

### Changed (Code)
- `src/components/DashboardTab.tsx`：
  - 移除短按轮换逻辑。
  - 保留长按选择逻辑。
  - 新增小字体提示行。

### 任务总结
- 本次交互微调已按要求完成，避免误触切换身份并增强可发现性。
- 已通过构建与 lints 自检。

## 2026-04-04 (Summary Remove 按钮位置调整)

### Changed
- Summary 列表行内移除 `Remove` 按钮，仅保留 `Edit`。
- `Edit Expense` 弹窗右上角将 `Mobile quick mode` 替换为 `Remove Expense` 按钮。
- 删除行为增加确认提示（Warning Notice）：
  - 点击 `Remove Expense` 后弹出确认框（Yes/No）。
  - 仅在确认后执行删除并关闭编辑弹窗。

### Changed (Code)
- `src/components/ExpenseForm.tsx`
  - 新增可选 `onRemove` 回调。
  - 头部右侧根据 `onRemove` 显示 `Remove Expense`（否则显示 `Mobile quick mode`）。
- `src/components/SummaryTab.tsx`
  - 删除行内 `Remove`。
  - 在编辑弹窗传入 `onRemove`，并接入确认逻辑。

### 任务总结
- 本次调整使删除入口集中到编辑场景，减少误删风险并贴合你给的界面位置要求。
- 已通过构建与 lints 自检。

## 2026-04-04 (Add Expense 弹窗顶部清理)

### Changed
- 中间 `+` 打开的 `Add Expense` 弹窗：
  - 移除顶部 `Close` 按钮。
  - 移除顶部 `Mobile quick mode` 标识。
- 在表单底部保留 `Save Expense`，并在右侧增加 `Cancel` 按钮。
- 点击 `Cancel` 直接关闭 Add Expense 弹窗。

### Changed (Code)
- `src/components/ExpenseForm.tsx`
  - 新增 `showModeBadge` 可选参数（默认显示）。
  - Add 模式可关闭顶部 mode badge。
- `src/pages/GroupPage.tsx`
  - 移除 Add 弹窗外层 `Close` 按钮。
  - Add 模式传入 `showModeBadge={false}` 与 `onCancel` 关闭弹窗。

### 任务总结
- 本次改动精确对齐你最新截图要求，Add Expense 顶部更干净，关闭入口统一到底部 Cancel。
- 已通过构建与 lints 自检。

## 2026-04-04 (Settle 双筛选 + Contra 汇总)

### Changed
- Settle 筛选区改为双筛选：
  - 新增 `Debtor` 下拉（欠款人）。
  - 新增 `Payer` 下拉（收款人/垫付人）。
- 移除原先选项中的 `Filter:` 文案，成员选项仅显示姓名。
- 账单列表改为按 `Debtor + Payer` 组合筛选，支持精确查看「某人欠某人」。
- 在账单列表下新增 `Total Summary` 区块，支持：
  - `Overall outstanding`（Debtor -> Payer 方向欠款总额）
  - `Contra`（Payer -> Debtor 反向欠款抵消）
  - `Net after contra`（净额结论）
- `Net after contra` 规则：
  - 净额 > 0：Debtor 仍需支付给 Payer。
  - 净额 < 0：Debtor 无需再付，改为 Payer 还欠 Debtor。
  - 净额 = 0：对冲后已结清。

### Changed (Code)
- `src/components/SettleTab.tsx`
  - `personFilterId` 重构为 `debtorFilterId` + `payerFilterId`。
  - 新增 `summary` 计算逻辑，分别计算 direct/contra/net（按币种）。
  - 新增 `Total Summary` UI 展示与正负场景提示文案。

### 任务总结
- 本次改动实现了你要的「Payer + Debtor 精确筛选」和「总额 + Contra + 净额判断」完整流程，能直接看出某个债务对的真实应付结果。
- 已通过构建与 lints 自检。

## 2026-04-04 (Settle Dashboard 交互增强)

### Changed
- Settle 顶部标题改为 `Outstanding Dashboard`。
- 移除顶部总额金额胶囊（你说的上方显示价格按钮）。
- 筛选器左右位置调整：
  - 左侧为 `Payer`。
  - 右侧为 `Debtor`。
- `Total Summary` 的 `Net after contra` 支持直接触发 `Repay all`：
  - 当净额为负值（按该区块定义，即 Debtor 仍需支付给 Payer）时，显示 `Repay all` 按钮。
  - 点击后弹出确认窗口，展示 pair、amount after contra、repaid date、confirm/cancel。

### Changed (Code)
- `src/components/SettleTab.tsx`
  - 新增 `repayModal` 与 `repaidDate` 状态。
  - 新增 `repayAllLineCount` 计算（统计本次将一次性标记的未还 split 条数）。
  - `Confirm` 时会同时标记两方向同币种记录为已还：
    - `Debtor -> Payer`
    - `Payer -> Debtor`
  - 通过双向标记实现对冲后的“一次性结清”效果，保证这两个人相关匹配费用一并进入已还状态。

### 任务总结
- 本次改动完成了你要的 `Outstanding Dashboard` 视觉与交互升级，并实现 `Repay all` 一次性结清流程（含确认弹窗与日期）。
- 已通过构建与 lints 自检。

## 2026-04-04 (Settle 文案优化)

### Changed
- 优化 `Total Summary` 文案为动态人名句式，减少抽象角色词：
  - `Overall outstanding` 显示为「A owes B before contra」。
  - `Contra` 显示为「B owes A and can be offset」。
  - `Net after contra` 根据结果显示「谁仍需支付谁」或「谁无需支付、反向仍欠谁」。
- 优化 `Repay all` 弹窗文案：
  - 说明文改为明确的 confirmation to pay 语义。
  - 关系行改为 `Debtor pays Payer`。
  - 金额标题改为 `Amount to pay after contra`。

### Changed (Code)
- `src/components/SettleTab.tsx`
  - 新增 `selectedDebtorName` 与 `selectedPayerName` 动态文案变量。
  - 替换 `Total Summary` 与弹窗中的静态说明文本为动态句式。

### 任务总结
- 本次仅优化文案表达，不改动结算与标记已还核心逻辑；当前界面可更直观读出“谁该付给谁”。
- 已通过构建与 lints 自检。

## 2026-04-04 (Summary 新增 Settlement Summary Block)

### Changed
- 在 `Summary` 页面底部新增 `Settlement Summary` 区块，展示与 Settle 相关的费用结算状态。
- 新增双筛选栏：
  - `Payer`（可选成员）
  - `Outstanding Repay`（可选成员）
- 默认（两者均为 `All`）时：
  - 仅展示当前仍未还清的欠款内容与剩余总额。
- 当用户选择任一筛选后：
  - 展示匹配成员的明细（含已还与未还）。
  - 已还条目标记为青色 `Paid`，未还继续显示应还金额。

### Changed (Code)
- `src/components/SummaryTab.tsx`
  - 新增 `settlePayerFilterId` 与 `settleRepayFilterId` 状态。
  - 新增 `settlementRows` 计算逻辑（按费用聚合显示 who owes、总未还额与 paid 状态）。
  - 新增对应 UI：三列结构（Item / Payer / Outstanding Repay）和每行 `Total outstanding` 展示。

### 任务总结
- 本次改动把 Settle 的核心“谁欠谁、还没还多少、是否已还”信息带到 Summary 底部，支持你要的筛选和青色 Paid 状态展示。
- 已通过构建与 lints 自检。

## 2026-04-04 (Summary Settlement Paid 明细优化)

### Changed
- `Settlement Summary` 的 `Who Owes` 现在会继续显示已还款的人，并以青色展示：
  - 格式：`Paid (金额 币种)`，例如 `Paid (RM15 MYR)`。
- `Total Outstanding` 只统计未还金额，不把已还条目算进去。
- 默认 `All / All` 下：
  - 仍只显示“还有未还金额”的费用行。
  - 但在这些费用行里，会同时看到未还与已还（Paid）成员状态。

### Changed (Code)
- `src/components/SummaryTab.tsx`
  - `settlementRows` 逻辑调整为行内保留全部 debtor 状态（含 repaid）。
  - `outstandingTotal` 明确仅按 `!repaid` 计算。
  - `Who Owes` 中 repaid 行改为青色 `Paid (amount)` 文案。

### 任务总结
- 已按你的示例实现：已还用户继续显示在列表里，但总未还金额不会重复计入。
- 已通过构建与 lints 自检。

## 2026-04-04 (Summary 金额展示改短格式)

### Changed
- `Summary` 页面内的金额展示统一改为短格式：
  - 移除金额后缀币种代码（如 `MYR` / `JPY`）。
  - 保留货币符号 + 数字（如 `RM90`、`¥3000`）。
- `Settlement Summary` 的 `Who Owes` 改为你期望的简短形式：
  - 未还：`Soon RM15`
  - 已还：`Stan Paid (RM15)`（青色）
- `Total Outstanding` 继续只统计未还金额，并显示短格式金额。

### Changed (Code)
- `src/components/SummaryTab.tsx`
  - Day 总额、Expense 行金额、展开明细金额、Settlement 区块金额统一去掉币种代码文本。
  - `Paid (金额)` 文案改为不带币种代码。

### 任务总结
- 本次改动仅做展示层精简，不改变任何分账计算与已还状态逻辑；Summary 视觉与阅读效率更贴近你给的目标样式。
- 已通过构建与 lints 自检。

## 2026-04-04 (Summary 头部取消吸顶)

### Changed
- `Summary` 页顶部 title block 取消吸顶（sticky）行为。
- 现在滚动页面时，头部会和内容一起自然滚动，不再固定在顶部。

### Changed (Code)
- `src/pages/GroupPage.tsx`
  - 移除 header 的 `sticky top-2 z-20` 样式类，仅保留普通布局样式。

### 任务总结
- 已恢复为你说的“之前版本”滚动体验：不吸顶、不跟随视口移动。
- 已通过构建与 lints 自检。

## 2026-04-04 (Add Expense 表单精简)

### Changed
- `Add Expense` 的 itemized tax 输入默认值改为空，不再默认显示 `0` / `5` / `8`。
- 移除金额快捷建议按钮（`¥500 / ¥1000 / ¥3000 / ¥5000`）。
- 移除 `Card / Cash` 支付方式选择 UI，仅保留日期输入。

### Changed (Code)
- `src/components/ExpenseForm.tsx`
  - `blankForm` 中 `serviceTaxPct` / `salesTaxPct` / `tipsPct` 默认改为 `''`。
  - `expenseToForm` 的 tax fallback 由固定数字改为空字符串。
  - 删除 `QUICK_AMOUNTS` 常量及对应按钮渲染区块。
  - 删除底部 `paymentMethod` 下拉选择控件。

### 任务总结
- 本次改动按你截图要求简化 Add Expense 录入流程，界面更干净；同时保留原有保存结构兼容，不影响既有数据逻辑。
- 已通过构建与 lints 自检。

## 2026-04-04 (Itemized 保存前 tally 校验)

### Changed
- 在 `Add Expense` 的 `itemized` 模式下新增强校验：
  - 若 `Remaining` / `Exceeds` 不为 0，则点击 `Save Expense` 会被阻止。
  - 同时弹出 warning 窗口，提示还有金额未对齐（not tally）。
- 只有当 itemized 合计与总金额对齐后，才允许保存。

### Changed (Code)
- `src/components/ExpenseForm.tsx`
  - 在 `submit` 中新增 `itemizedSummary.diff` 校验（容差 `0.009`）。
  - 未对齐时使用 `window.alert` 给出明确提示，并设置表单错误文案后中断保存。

### 任务总结
- 已实现你要求的提交门槛：存在 remaining/exceeds 就不能保存，必须先补齐到总额一致。
- 已通过构建与 lints 自检。

## 2026-04-04 (汇率换算金额精度统一为2位)

### Changed
- 汇率换算后的金额（例如 `JPY -> MYR`）统一保留 2 位小数并四舍五入。
- 超过 2 位小数时会自动进位/舍入回 2 位，避免出现过长小数。

### Changed (Code)
- `src/lib/splitCalc.ts`
  - 新增 `round2`。
  - `convertedAmount` 由原先 4 位精度改为 2 位精度（equal + itemized 两条链路）。
- `src/components/SummaryTab.tsx`
  - 对缺失 `convertedAmount` 时的前端兜底换算也统一为 2 位小数，保证显示与存储一致。

### 任务总结
- 现在不管是保存时生成的换算金额，还是页面兜底计算出来的换算金额，都遵循 2 位小数规则，满足你说的 JPY 转 MYR 进位需求。
- 已通过构建与 lints 自检。

## 2026-04-04 (Profile 成员编辑与名字颜色全局显示)

### Changed
- `Profile` -> `Travellers` 支持点击成员进入编辑：
  - 修改成员名字。
  - 从本地图库选择头像（profile picture）。
  - 选择名字颜色（按你给的色板风格提供 palette）。
  - `Save` 保存。
  - 新增 `Remove Member` 按钮。
- `Travellers` 标签上的小 `x` 已移除（不再在 chip 上直接删除）。
- 成员名字颜色应用到主要页面的名字展示位置（Summary/Settle/Dashboard/Expense/Profile）。
- 当成员选择浅色名字时，自动为名字添加深色描边（text outline 阴影）增强可读性，避免白底看不清。

### Changed (Code)
- 新增 `src/lib/personTheme.ts`
  - 提供颜色 palette。
  - 提供名字样式函数（含浅色检测与描边逻辑）。
- `src/types/index.ts`
  - `Person` 新增 `avatarDataUrl`、`nameColor` 字段。
- `src/store/useStore.ts`
  - `addPerson` 默认注入头像/颜色字段。
  - 新增 `updatePersonProfile` action（更新名字/头像/颜色）。
  - 持久化读取时补齐旧数据缺失字段（兼容历史数据）。
- `src/components/PeopleTab.tsx`
  - 新增成员编辑弹窗与头像上传/颜色选择/保存/删除流程。
  - 移除 chip 内删除 `x`。
- `src/pages/GroupPage.tsx`
  - Profile tab 改为调用 `updatePersonProfile`。
- `src/components/ExpenseForm.tsx`、`src/components/SummaryTab.tsx`、`src/components/SettleTab.tsx`、`src/components/DashboardTab.tsx`、`src/components/ExpenseCard.tsx`
  - 接入名字颜色样式显示。
  - Dashboard 成员头像选择区域支持显示上传头像。

### 任务总结
- 已完成你要的 Profile 成员可编辑能力（改名/头像/颜色/删除）与名字颜色跨页面展示。
- 已加入浅色自动描边，保证亮色名字在浅背景依然可读。
- 已通过构建与 lints 自检。

## 2026-04-04 (Edit Member 移除图库上传入口)

### Changed
- `Edit Member` 面板移除 `Choose photo` 功能入口（不再支持本地图库上传）。
- 保留当前头像预览显示（若已有头像则继续显示）。

### Changed (Code)
- `src/components/PeopleTab.tsx`
  - 删除 `fileToDataUrl` 依赖与文件选择 input/button 交互逻辑。

### 任务总结
- 已按你最新要求去掉 `Choose photo`，后续头像会改为你指定的预设头像库选择流程。
- 已通过构建与 lints 自检。

## 2026-04-04 (预设头像库与 Edit Member 选择器)

### Changed
- 新增 20 张简单可爱风格预设头像（5 男 / 5 女 / 3 猫 / 3 狗 / 水豚 / 狐狸 / 兔子 / 小鹿），文件位于 `public/avatars/`。
- `Edit Member` 内增加头像网格：点击即可选用，支持 `Clear avatar` 清除。
- 选中头像以 URL 形式写入 `avatarDataUrl`（如 `/avatars/avatar-male-01.png`），与旧版 base64 图仍可兼容显示。

### Changed (Code)
- 新增 `src/lib/avatars.ts`：`PRESET_AVATARS` 列表。
- `src/components/PeopleTab.tsx`：接入预设头像网格与清除逻辑。

### 任务总结
- 头像生成在 automode 下已成功；资源已复制进项目并完成 UI 接入。
- 单张 PNG 体积仍偏大，若需可后续做压缩或 WebP。
- 已通过构建与 lints 自检。

## 2026-04-04 (Profile ???? fit in)

### Changed
- Profile ????????? fit in?
- ?? chip ???Edit Member ??????????????????????,?????

### Changed (Code)
- src/components/PeopleTab.tsx
  - ????? object-cover ??? object-contain?
  - ?????????????,?????????????????

### ????
- ?????? Profile ??????????,????????????
- ?????? lints ???

## 2026-04-04 (Dashboard ???? fit in)

### Changed
- Dashboard ????????????????????? fit in ???
- ? Profile ???????????,?????

### Changed (Code)
- src/components/DashboardTab.tsx
  - ?????? object-contain?
  - ????????,??????????

### ????
- Dashboard ????????????????,??????
- ?????? lints ???

## 2026-04-04 (Profile ??????????)

### Changed
- Profile ??????????:??????????????????????????
- ?????? contain ??;????? app ??? profile-picture ?????

### Changed (Code)
- src/components/PeopleTab.tsx
  - ?? chip ???Edit Member ??????????????? object-cover object-center?

### ????
- ????????????????????,?????? profile picture ???
- ?????? lints ???

## 2026-04-04 (?????????)

### Changed
- ??????? cover + center ????????? profile-picture ???
- ? Profile ? Dashboard ????????????????,?????????????,???????

### Changed (Code)
- src/components/PeopleTab.tsx
  - ?????????????????? overflow-hidden + scale-125 + object-cover object-center?
- src/components/DashboardTab.tsx
  - ???????????????????????

### ????
- ????????????????????????,??????????????
- ?????? lints ???

## 2026-04-04 (???????????? 1.35x)

### Changed
- Edit Member ????????????????? 1.25x ??? 1.35x?
- ???????????????,?????????????

### Changed (Code)
- src/components/PeopleTab.tsx
  - ???????? scale-125 ?? scale-[1.35]?

### ????
- ?????????????????,??????,???????????
- ?????? lints ???
