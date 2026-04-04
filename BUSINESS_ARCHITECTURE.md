# MonoSplit 业务架构文档

## 项目目标
- 面向旅行场景的移动端优先分账 Web App。
- 优先在周末内交付稳定可用的 MVP。
- 先做本地可用，不依赖后端与登录系统。

## MVP 核心能力
- Group 管理：创建、切换、删除分账组。
- People 管理：添加、删除旅伴。
- Expense 记录：新增、编辑、删除费用。
- Split 计算：equal split 与 itemized split。
- 税费支持：service tax / sales tax / tips。
- 多币种：paid currency 与 repay currency 分离。
- 汇率：自动拉取 + 手动覆盖。
- 结算：谁欠谁、金额汇总、标记已还款。

## 非目标（MVP 不做）
- 登录、好友系统、复杂权限。
- 分享链接与 Notion embed。
- 收据附件与 OCR。
- 支付渠道集成与订阅系统。
- 原生 APK。

## 技术架构
- 前端：React + Vite + TypeScript。
- 状态：Zustand（persist 到 localStorage）。
- 路由：React Router。
- 样式：Tailwind CSS（移动端优先）。
- 数据源：纯前端本地数据。

## 模块边界
- `lib/*`：纯计算逻辑（无 UI 依赖）。
- `store/*`：状态与动作（CRUD、还款标记）。
- `components/*`：页面组件与交互。
- `pages/*`：路由级页面编排。
- `types/*`：统一类型定义。

## 数据流
1. UI 组件触发用户操作。
2. 调用 store action 更新状态。
3. 纯函数模块执行 split/settlement 计算。
4. store 持久化到 localStorage。
5. 页面自动响应并渲染最新结果。
