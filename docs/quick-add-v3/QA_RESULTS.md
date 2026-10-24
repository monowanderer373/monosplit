# V3 QA evidence map

Final source0787f93, Quality40104116756 all7SUCCESS. PASS below refers to actual application tests, isolated backend checks and simulated CSS/visual viewports; it does not certify a physical phone. Evidence files ship with the comparison gallery. See Implementation Report for production/device limits.

| Item | Status | Evidence / remaining validation |
|---|---|---|
|A01|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Quick Add Header 只有当前 Ledger，原 `Quick Add` 标题被移除，Back 入口正常。|
|A02|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 393×852 CSS 屏幕展示 4×2 categories，不需要第三排推荐卡片。|
|A03|PASS|Restored-SUGGESTED production-graph browser: visible distinct state, aria-pressed false, Save blocked until manual confirmation; Note remains empty.|
|A04|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Account 最左 / Split 最右 / 中间自由留白，无强制 50/50，长账户名截断但 Split 不丢。|
|A05|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Date 从 Context row 完全移入 Receipt 金额右侧，点击区域 ≥48px。|
|A06|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Receipt 只显示**一个** Amount，只有一个 Note；原顶置 Receipt Preview 重复内容已移除。|
|A07|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Receipt 仍有低调纸感与轻微撕纸，不使用厚卡片阴影与渐变。|
|A08|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Note 默认空，不会自动变成 `Food` / `Coffee` / `Lunch`。|
|A09|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Calculator 5×4 全功能可见，按键建议 ≥48px，Save 右下深蓝、`=` 浅蓝、运算符陶土色。|
|A10|PASS|Eight actual393x852/2x captures, reviewed against all eight approved references; five target viewports and four picker widths.|
|A11|PASS|Supplemental long-account/MYR1258900.50/VND12500000/CNY3450 test: calendar>=48px, no horizontal overflow.|
|A12|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. no gradient，字体/阴影/圆角与全站 Matte Paper tokens 协调，不新增另一个全局主题。|
|B01|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Ledger 与当前页面 Personal/Trip/Group/Friend 上下文同步；切换可用。|
|B02|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Category 选择/更换/More 全量分类功能正常，选中用真实 category ID。|
|B03|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Note 输入只是备忘，不承担必填 Description；编辑历史记录的既有文本无损。|
|B04|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Account 选择保留 Currency、Amount、Category、Note、Date；多币种账户不误扣其他币种。|
|B05|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 日期选择器显示 Today / 非今日状态、后端保存正确真实日期。|
|B06|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. `C` / `⌫` / `%` / `÷` / `×` / `−` / `+` / `.` / `=` 和数字功能与旧版一致；`=` 不保存。|
|B07|PASS|Current full authenticated isolated-backend CI: original canonical save/idempotence/financial assertions retained.|
|B08|PASS|Real disposable-backend long-hold: exactly one expense/one deferred intent, unchanged balance, cleared next draft, release causes no second save; timer units also pass.|
|B09|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. pointercancel、离开按钮、网络慢/请求重试不会重复保存。|
|B10|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 新草稿清空 Amount、Note 和确认 Category；其他保存上下文/账户/币种沿用正确既有需求。|
|B11|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 离开/返回时当天草稿恢复机制正常；出错/Offline 时输入保留。|
|B12|PASS|Restored-SUGGESTED browser fixture rejects Save until USER category; fixture never enters production fallback.|
|C01|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 打开 Payment account 仍列出真实账户及账户类型、币种信息（有权限时实际余额）。|
|C02|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. `Default` 标记仍来自真实默认设置；选择账户不修改默认账户。|
|C03|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 点击某个账户**单次选择即应用并关闭**，没有无谓 `Use Touch n Go` 二次确认。|
|C04|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. `No account` 可选且不会实际扣任何钱包余额。|
|C05|PASS|Retained-actions browser opens original inline Add account form, edits and cancels; amount/note preserved,0writes. Real production account creation NOTRUN.|
|C06|PASS|14 real-shaped account rows scroll, last row selects/closes preserving Note/amount. Physical keyboard remains NOTRUN.|
|C07|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 多币账户、余额不足/负余额/未知本币等原有提醒不被删掉。|
|D01|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Friends/Groups/Trips 仍可选；Friends 搜索、多选都正常。|
|D02|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 3 个参与者 = **You + 2**，不会重新加入一个 You。|
|D03|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Participants 识别沿用原有 Person/Participant/Manual/Linked 语义；旧已关联记录不变。|
|D04|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Continue 只进入原有编辑流程，不直接保存最终交易。|
|D05|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Equally 与旧版本在所有样例金额上**完全相同**（含舍入及余数归属）。|
|D06|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Amounts 可编辑每人份额，超额/不足/校验与旧版相同。|
|D07|PASS|Retained-actions browser edits item name/amount/assignment, adds/removes second item, calculates9.45/9.45/0 and applies draft only; original-engine units retained.|
|D08|PASS|Existing full multiuser CI edits Paid by You; supplemental browser edits10+8.90 contributions and validates draft-only Apply. No wallet model change.|
|D09|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. You pay / To collect、欠款/应收应付和既有抵销计算与旧版一致。|
|D10|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Split `Apply split` 只应用当前 draft；**不创建数据库交易**；真正 Quick Add Save 才写交易。|
|D11|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. Remove split 恢复个人模式，保持旧规则，不删除历史数据。|
|D12|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 在任一 Split tab 切换后，未提交金额或项目不会被 UI 重置（按照真实旧版状态策略）。|
|D13|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 三 Tab 的参与者选中态低调清晰、金额右对齐，姓名过长时截断并可读取全名。|
|D14|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 10+ 联系人、至少 5 位参与、多个 item 时，中间滚动但 Header/Footer 不移。|
|D15|PASS|Long lists/items fixed footer plus420px layout and visual-only keyboard: input/Apply/Remove fully visible and>=48px. Extreme<360px whole-panel scrolling; physical IME NOTRUN.|
|E01|PASS|Five requested CSS viewports and320/360/390/430 compact suite; actual application screenshots, not physical devices.|
|E02|NOT RUN|Physical Android/PWA system font and browser UI zoom unavailable.125/150/200% root-font simulations PASS in original compact suite; not equivalent to OS settings.|
|E03|PASS|Note focus without IME retains keypad; simulated VisualViewport reduction yields calculator, categories stay visible, expansion restores. Native IME NOTRUN.|
|E04|PASS|Long native amounts/date test and separate420px Split Amounts layout/visual-only tests PASS; actual native numeric keyboard NOTRUN.|
|E05|BLOCKED|Application Escape/focus trap/return/scrim tests PASS. Physical Android Back/device accessibility not available; do not certify those.|
|E06|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 无嵌套按钮/输入控件导致的非法 HTML；无 React key 警告。|
|E07|BLOCKED|48px targets/computed multi-select styles, accessible names, keyboard/timer cancellation and selected4.82–10.07 contrast PASS. Full device screen-reader/reduced-motion audit NOTRUN.|
|E08|PASS|Local V3/compact browser journeys, SplitConfiguration.v3/QuickSaveKey and original unit suite; see report. 不新增 Supabase DB schema migration、RLS 政策改动和分账计算业务重构。|
|E09|PASS|704units/103files,lint,tsc/PWA build; exact-source seven-job CI including real disposable databases/history/concurrency.|
|E10|PASS|Five protected business-file hashes unchanged, four pre-change engine goldens preserved; real isolated backend/history/settlement CI PASS. Production financial writes NOTRUN.|

## Eight screenshot states

- F01: PASS — 01_quick_add_suggested.png, actual app393×852 CSS px/2x; approved/implementation pair in gallery/index.html.
- F02: PASS — 02_quick_add_category_confirmed.png, actual app393×852 CSS px/2x; approved/implementation pair in gallery/index.html.
- F03: PASS — 03_quick_add_shared.png, actual app393×852 CSS px/2x; approved/implementation pair in gallery/index.html.
- F04: PASS — 04_account_selector.png, actual app393×852 CSS px/2x; approved/implementation pair in gallery/index.html.
- F05: PASS — 05_split_people_selector.png, actual app393×852 CSS px/2x; approved/implementation pair in gallery/index.html.
- F06: PASS — 06_split_equally.png, actual app393×852 CSS px/2x; approved/implementation pair in gallery/index.html.
- F07: PASS — 07_split_amounts.png, actual app393×852 CSS px/2x; approved/implementation pair in gallery/index.html.
- F08: PASS — 08_split_by_item.png, actual app393×852 CSS px/2x; approved/implementation pair in gallery/index.html.

Production evidence is separate: final exact commit/native READY/public SHA/owned authenticated read-only/PWA results are in delivery-final.json. Test fixtures are local/isolated only, not production fallback. Physical phone remains NOTRUN.
