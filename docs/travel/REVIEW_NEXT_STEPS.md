# Travel 浏览器验收下一步

状态：脚本已编写并通过 TypeScript 检查；尚未运行，无真实截图。

在具备 Docker / Supabase 与 Chromium 的隔离开发机或 GitHub Actions 中：

```sh
npm ci
npx supabase start
npx supabase db reset
npx playwright install --with-deps chromium
npx playwright test e2e/travel.spec.ts --workers=1
npx supabase stop --no-backup
```

`db reset` 仅用于一次性本地测试栈，不可针对生产数据库执行。Playwright 配置已经锁定 `127.0.0.1:54321`，fixture 中的密钥也是本地演示 anon key。

1. 先确认所有真实流程断言通过；失败时修复后重新执行受影响流程。
2. 取 `test-results/travel/` 中真实 PNG 和尺寸 JSON，分别比较无旅程、已选旅程、弹层、详情与零记录状态；不能用 handoff PNG 或组件测试代替实际截图。
3. 人工验收 320/390/430 px、桌面、长文字/金额、200% 文字以及设备安全区。脚本的 CSS 文字放大只是一项压力检查，仍须实际浏览器文字缩放验证。
4. 运行已有 Daily、收付款与权限相关浏览器回归；记录实际执行结果及剩余问题。
5. 更新实施报告并提供截图，保持审阅状态。没有授权合并或部署。

GitHub workflow 的 `travel-browser` 作业已配置截图、尺寸和失败上下文 artifact；尚未有本轮 CI 执行结果。已有通用 browser 作业也会发现 Travel spec，完整回归运行时间可能增加。
