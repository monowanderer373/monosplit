# Travel 浏览器验证与发布检查

真实浏览器验证已经执行。首次验证发现并修复旅程选择被旧缓存覆盖的问题；Quality #80 六项作业全部通过，真实截图已对照提供的设计板。本文件保留可重放步骤，最终证据与发布记录见 PR #6。

```sh
npm ci
npx supabase start
npx supabase db reset
npx playwright install --with-deps chromium
npx playwright test e2e/travel.spec.ts --workers=1
npx supabase stop --no-backup
```

上述 reset 仅用于一次性本地测试栈。Playwright 与 fixture 锁定 `127.0.0.1:54321`，不得针对生产运行这些 fixture。

脚本检查 320/360/390/430/768 px、1024 桌面，四个批准状态及已有 Trip 零记录，真实创建、切换、分摊金额、详情、成员/信息、Quick Add 旅程预填、返回选择与密度、只读和无权限。另取得中文、长名称/金额和 CSS 200% 文字截图。`test-results/travel/` 包含 PNG 与尺寸 JSON；CI 的 `travel-browser-evidence` artifact 同时保留断言结果和失败上下文。

发布前：最新代码的六项 Quality 作业全部通过，检查最终截图没有溢出或遮挡，将 PR #6 合并 main，等 Vercel Production 成功，再核验正式域名资源与登录入口。用户已授权 live 部署，无需重复要求批准。

系统文字缩放、实体设备安全区以及登录后的生产真实账户只读抽查需对应设备/会话。测试环境真实账户与 RPC 的通过结果不冒充这些人工检查。
