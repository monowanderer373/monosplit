# Travel 实现与验证

2026-10-09。依据用户上传的 `TabbyTally_Travel_Complete_Handoff(1).zip` 中全部规格、素材及两张已确认设计板，实现现有 Tabby Tally 的 Travel。用户已授权完成开发、合并并部署正式站点。

## 实现范围

| ZIP 要求 | 实现 |
| --- | --- |
| 无 Trip 首页 | 创建卡、地图与 pocket 插画、纸卡引导；加载和失败不伪装为空 |
| 有 Trip 首页 | 真实日期、状态、My spending、原有记录及 Overall / Compact |
| 标签下 dropdown | 局部锚定纸卡，无全页遮罩；真实列表、创建、管理、键盘和焦点恢复 |
| 独立 Trip 详情 | 真实记录、个人支出、日期、合法成员及计数；信息、成员和管理复用现有完整页面 |
| Add expense | 原 Quick Add 预选当前 Trip，恢复该身份、该旅程的有效草稿；原写入服务校验权限 |
| 状态恢复 | 按账户保存选择；返回恢复 Trip、密度、已展开日期和路由滚动位置 |
| 财务与权限 | 使用原 `personalSpendingMinor`，多币种分开；遵循隐藏金额、只读和归档规则 |
| 视觉与适配 | 作用域内纸纹、丹宁、牛皮、折角、路线、插画、图标和 tokens；320 至桌面，内容上限 480px |
| 原功能回归 | Daily、Collect/Pay、身份、结算、账户、通知及 Quick Add 继续使用原逻辑 |

修复了浏览器验证发现的选择丢失：从创建页返回时，已缓存的旧 Trip 列表不能覆盖新选择；等待刷新完成后才校验选择，并持久化首次自动选择。供应素材的透明边距通过 CSS 装饰容器适配，保证地图和 mascot 的可见大小；引导图标置中，放大文字时页头可换行。

## 数据与接口

| 位置 | 作用 |
| --- | --- |
| `src/components/travel/` | 首页、详情、选择器、样式与组件测试 |
| `src/hooks/useHomeModel.ts` | 提取原首页账本模型，按真实个人份额汇总 Travel |
| `src/hooks/useTravelMembers.ts` | 原 `spaceRepository.listMembers`，按身份和 Trip 隔离迟到响应 |
| `src/lib/travelQuickAdd.ts` | 原 composer 的旅程预选与草稿恢复 |
| `src/store/useStore.ts` | 按身份保存选择、持久化迁移版本 9 |
| `src/pages/PersonalLedgerPage.tsx` | 首页及 `/travel/trip/:tripId` 接入 |
| `src/pages/SpacesPage.tsx` / `SpacePage.tsx` | `/travel/manage`、原创建/信息/成员/管理流程 |
| `src/components/home/HomeScreen.tsx` | Travel 分支、原记录组件与按 Trip 保存展开状态 |
| `public/travel/` | ZIP 提供的素材；PNG 按 UI 所需分辨率缩小 |
| `e2e/travel.spec.ts` | 一次性本地 Supabase 的真实账户、RPC、权限与截图验证 |

金额、记录、币种和标题由同一选择产生；请求隔离身份与代次，失败不显示假零。不可访问的 deep link 不回退显示另一个 Trip 的名称或记录。详情隐藏全局导航，底部 Add expense 的实测高度用于留白。

没有新 schema、RPC、迁移或金融计算模型。原个人旅行标签 `affiliation:` 没有共享成员和 Trip 写入接口，因此展示真实个人标签记录并解释现有 Quick Add 后关联标签流程，不伪造共享成员或可写 Trip。

## 验证证据

[Quality #80](https://github.com/monowanderer373/monosplit/actions/runs/37976366299) 六项作业已全部通过：应用测试/lint/build、安全审计、数据库测试、历史升级、全量浏览器、收付款专项及 Travel 专项。应用 70 个测试文件、453 项测试通过。Travel 专项最初 4 项覆盖 320/390/430 和真实只读/无权限；真实 PNG 和尺寸 JSON 已取得并与设计板比较。

本次进一步扩充脚本到 320/360/390/430/768、1024 桌面及中文首页/dropdown/详情，补充 Overall 与 Compact 详情截图。最终提交必须通过对应最新 Quality 作业再合并。最新证据在 [PR #6](https://github.com/monowanderer373/monosplit/pull/6) 的检查链接及 `travel-browser-evidence` artifact；检查名称与 artifact 内文件以实际运行结果为准。

截图路径：`test-results/travel/01-no-trip-{width}.png`、`02-has-trip-{width}.png`、`03-dropdown-{width}.png`、`04-trip-details-{width}.png`、`05-trip-zero-records-{width}.png`，另有长名称/金额、200% 文字、桌面、中文、只读、无权限和 Compact 详情，附尺寸 JSON。截图禁用动画，避免捕捉淡入中间帧。

CSS 颜色静态对比度结果保存在 `contrast-check.json`。真实数据金额、日期和人数会与设计示例不同；44px 触控区域使部分卡片高度自然增长。Chromium 的 CSS 200% 文字压力检查和截图不能代替实体 iOS/Android 的系统文字缩放及安全区验收，未声称逐像素一致。

## 发布

生产域名：`https://tabby-tally-monowanderer373s-projects.vercel.app`。合并 `main` 后由既有 Vercel 项目自动部署；以 GitHub 的成功 deployment/status 与正式域名返回的构建资源确认上线。Travel 无需生产数据库变更，不在生产创建测试账目。

`vercel.json` 仅禁止审阅分支 `feat/travel-denim-paper` 的自动预览；主分支生产部署保留。最终部署 SHA、状态和线上核验记录见 PR #6 的发布记录。
