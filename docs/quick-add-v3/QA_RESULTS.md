# V3 QA evidence map

Current local checkpoint. PASS requires code inspection plus named local tests; BLOCKED is not complete. Final CI/device evidence must update this map.

| Item | Status | Evidence / remaining validation |
|---|---|---|
|A01|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Quick Add Header 只有当前 Ledger，原 `Quick Add` 标题被移除，Back 入口正常。|
|A02|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 393×852 CSS 屏幕展示 4×2 categories，不需要第三排推荐卡片。|
|A03|BLOCKED|Await exact-source CI/additional live or physical-device validation. Category 推荐态和确认态视觉不同；推荐绝不自动选中。|
|A04|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Account 最左 / Split 最右 / 中间自由留白，无强制 50/50，长账户名截断但 Split 不丢。|
|A05|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Date 从 Context row 完全移入 Receipt 金额右侧，点击区域 ≥48px。|
|A06|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Receipt 只显示**一个** Amount，只有一个 Note；原顶置 Receipt Preview 重复内容已移除。|
|A07|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Receipt 仍有低调纸感与轻微撕纸，不使用厚卡片阴影与渐变。|
|A08|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Note 默认空，不会自动变成 `Food` / `Coffee` / `Lunch`。|
|A09|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Calculator 5×4 全功能可见，按键建议 ≥48px，Save 右下深蓝、`=` 浅蓝、运算符陶土色。|
|A10|BLOCKED|Await exact-source CI/additional live or physical-device validation. 8 个视觉参考状态都有真实开发版截图；在 360×800、393×852、412×915 实测无横向溢出。|
|A11|BLOCKED|Await exact-source CI/additional live or physical-device validation. 金额 1,258,900.50 / ₫12,500,000 等大值时 Date 可见，不被覆盖。|
|A12|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. no gradient，字体/阴影/圆角与全站 Matte Paper tokens 协调，不新增另一个全局主题。|
|B01|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Ledger 与当前页面 Personal/Trip/Group/Friend 上下文同步；切换可用。|
|B02|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Category 选择/更换/More 全量分类功能正常，选中用真实 category ID。|
|B03|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Note 输入只是备忘，不承担必填 Description；编辑历史记录的既有文本无损。|
|B04|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Account 选择保留 Currency、Amount、Category、Note、Date；多币种账户不误扣其他币种。|
|B05|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 日期选择器显示 Today / 非今日状态、后端保存正确真实日期。|
|B06|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. `C` / `⌫` / `%` / `÷` / `×` / `−` / `+` / `.` / `=` 和数字功能与旧版一致；`=` 不保存。|
|B07|BLOCKED|Await exact-source CI/additional live or physical-device validation. Quick Add 点击 Save 只创建 1 笔符合现有逻辑的交易。|
|B08|BLOCKED|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 长按约 1s Save & Next 只创建 1 笔；松开不触发第二次 Save。|
|B09|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. pointercancel、离开按钮、网络慢/请求重试不会重复保存。|
|B10|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 新草稿清空 Amount、Note 和确认 Category；其他保存上下文/账户/币种沿用正确既有需求。|
|B11|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 离开/返回时当天草稿恢复机制正常；出错/Offline 时输入保留。|
|B12|BLOCKED|Await exact-source CI/additional live or physical-device validation. 分类只有 Suggested 未确认时保存被正常拦截或明确提示。|
|C01|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 打开 Payment account 仍列出真实账户及账户类型、币种信息（有权限时实际余额）。|
|C02|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. `Default` 标记仍来自真实默认设置；选择账户不修改默认账户。|
|C03|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 点击某个账户**单次选择即应用并关闭**，没有无谓 `Use Touch n Go` 二次确认。|
|C04|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. `No account` 可选且不会实际扣任何钱包余额。|
|C05|BLOCKED|Await exact-source CI/additional live or physical-device validation. `Add account` 导航到旧流程并可返回，Quick Add draft 保留。|
|C06|BLOCKED|Await exact-source CI/additional live or physical-device validation. 账户列表多于 10 项内部可滚动，关闭/遮罩/Back 正常，弹窗不被系统键盘遮挡。|
|C07|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 多币账户、余额不足/负余额/未知本币等原有提醒不被删掉。|
|D01|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Friends/Groups/Trips 仍可选；Friends 搜索、多选都正常。|
|D02|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 3 个参与者 = **You + 2**，不会重新加入一个 You。|
|D03|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Participants 识别沿用原有 Person/Participant/Manual/Linked 语义；旧已关联记录不变。|
|D04|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Continue 只进入原有编辑流程，不直接保存最终交易。|
|D05|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Equally 与旧版本在所有样例金额上**完全相同**（含舍入及余数归属）。|
|D06|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Amounts 可编辑每人份额，超额/不足/校验与旧版相同。|
|D07|BLOCKED|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. By item 新增/删除/编辑项目、项目归属、Calculate shares 结果与旧版完全相同。|
|D08|BLOCKED|Await exact-source CI/additional live or physical-device validation. Paid by You / 账户切换仍有效；不要误改实际付款人或钱包。|
|D09|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. You pay / To collect、欠款/应收应付和既有抵销计算与旧版一致。|
|D10|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Split `Apply split` 只应用当前 draft；**不创建数据库交易**；真正 Quick Add Save 才写交易。|
|D11|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Remove split 恢复个人模式，保持旧规则，不删除历史数据。|
|D12|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 在任一 Split tab 切换后，未提交金额或项目不会被 UI 重置（按照真实旧版状态策略）。|
|D13|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 三 Tab 的参与者选中态低调清晰、金额右对齐，姓名过长时截断并可读取全名。|
|D14|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 10+ 联系人、至少 5 位参与、多个 item 时，中间滚动但 Header/Footer 不移。|
|D15|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. `Apply split` 不被底部系统手势区、文字键盘或长名单遮挡。|
|E01|BLOCKED|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 360×800、390×844、393×852、412×915、393×700 截图与触控检查通过。|
|E02|BLOCKED|Await exact-source CI/additional live or physical-device validation. 系统 125%、150% 字体/Android 浏览器或 PWA 下布局可操作。|
|E03|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Note 系统键盘出现时不新开 Focus Mode，上方 Categories 不主动隐藏，Note 可见，Calculator 让位。|
|E04|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 金额输入法、日期浮层、Amounts 金额输入栏可滚入可见区。|
|E05|BLOCKED|Await exact-source CI/additional live or physical-device validation. 模态具备 aria label / focus trap / focus return / Esc、Android Back、遮罩关闭策略。|
|E06|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 无嵌套按钮/输入控件导致的非法 HTML；无 React key 警告。|
|E07|BLOCKED|Await exact-source CI/additional live or physical-device validation. reduced motion、颜色对比、键盘导航、屏幕阅读器文本、≥48px 交互目标。|
|E08|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 不新增 Supabase DB schema migration、RLS 政策改动和分账计算业务重构。|
|E09|BLOCKED|Await exact-source CI/additional live or physical-device validation. lint、typecheck、unit、existing integration、E2E 尽可能运行且结果明确。|
|E10|BLOCKED|Await exact-source CI/additional live or physical-device validation. 新旧数据对照（同条件/同金额）显示应收应付、余额、结算相同。|
