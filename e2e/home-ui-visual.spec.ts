import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const css = readFileSync(new URL('../src/components/home/home.css', import.meta.url), 'utf8')

function pageHtml(body: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    body { margin: 0; font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif; }
    ${css}
  </style></head><body><main class="home-shell">${body}</main></body></html>`
}

const header = `
  <div class="home-frame">
    <header class="home-header" data-testid="home-header">
      <div></div>
      <div class="home-mode" data-testid="home-mode-switch">
        <button type="button" aria-pressed="true">日常</button>
        <button type="button">旅行</button>
      </div>
    </header>`

async function shot(page: import('@playwright/test').Page, name: string, width: number, body: string) {
  await page.setViewportSize({ width, height: 844 })
  await page.setContent(pageHtml(body))
  await expect(page.getByTestId('home-mode-switch')).toBeVisible()
  await page.screenshot({ path: `test-results/home-ui/${name}.png`, fullPage: true })
}

test.beforeAll(async () => {
  await mkdir('test-results/home-ui', { recursive: true })
})

test('captures home layouts at phone widths', async ({ page }) => {
  const balance = `
    <section class="home-card">
      <div class="home-card-top">
        <button class="home-account-button" type="button"><span>全部账户</span></button>
        <button class="home-icon-button" type="button" aria-label="隐藏账户余额">眼</button>
      </div>
      <p class="home-balance-figure">RM 1,250.00</p>
      <div class="home-stat-row">
        <div class="home-stat"><p class="home-meta">本月消费</p><p>RM 86.40</p></div>
        <div class="home-stat"><p class="home-meta">待收回</p><p>RM 24.00</p></div>
      </div>
    </section>`
  const twoTiles = `
    <div class="home-tiles" data-layout="both">
      <button class="home-tile home-tile-account" type="button"><span class="home-tile-icon"></span><strong>账户待办</strong><span class="home-badge">2</span></button>
      <button class="home-tile home-tile-shared" type="button"><span class="home-tile-icon"></span><strong>待收待付</strong><span class="home-badge">1</span></button>
    </div>`
  const records = `
    <section class="home-section">
      <div class="home-section-head"><h2>最近记录</h2></div>
      <div class="home-date"><strong>今天 · 9月16日</strong><i></i></div>
      <article class="home-record"><div class="home-record-main">
        <span class="home-record-icon">餐</span>
        <div class="home-record-copy"><p class="home-record-title">河粉</p><span class="home-chip">与 Lan 分账</span></div>
        <div class="home-record-money"><p class="home-amount outgoing">−RM 56.80</p><p class="home-wallet">CIMB</p></div>
      </div></article>
    </section>`

  await shot(page, 'daily-two-tiles-390', 390, `${header}${balance}${twoTiles}${records}</div>`)
  await shot(page, 'daily-two-tiles-360', 360, `${header}${balance}${twoTiles}${records}</div>`)
  await shot(page, 'daily-two-tiles-430', 430, `${header}${balance}${twoTiles}${records}</div>`)
  await shot(page, 'daily-one-tile-390', 390, `${header}${balance}
    <div class="home-tiles" data-layout="account"><button class="home-tile home-tile-account" type="button"><strong>账户待办</strong><span class="home-badge">2</span></button></div>
    ${records}</div>`)
  await shot(page, 'daily-zero-tiles-390', 390, `${header}${balance}${records}</div>`)
  await shot(page, 'hidden-balance-390', 390, `${header}
    <section class="home-card"><div class="home-card-top"><button class="home-account-button" type="button"><span>全部账户</span></button></div>
    <p class="home-balance-figure">••••</p>
    <div class="home-stat-row"><div class="home-stat"><p class="home-meta">本月消费</p><p>RM 86.40</p></div><div class="home-stat"><p class="home-meta">待收回</p><p>RM 24.00</p></div></div>
    </section>${twoTiles}${records}</div>`)
  await shot(page, 'account-sheet-390', 390, `${header}${balance}
    <div class="home-sheet-backdrop"><section class="home-sheet" role="dialog"><header><h2>选择账户</h2></header>
    <button class="home-sheet-option" type="button">全部账户</button>
    <button class="home-sheet-option" type="button"><span>CIMB</span><span class="home-meta">MYR · RM 1,250.00</span></button>
    <button class="home-sheet-option" type="button">管理账户</button></section></div></div>`)
  await shot(page, 'compact-records-390', 390, `${header}${balance}
    <section class="home-section"><div class="home-date"><strong>昨天 · 9月15日</strong><i></i></div>
    <article class="home-record is-compact"><div class="home-record-main">
      <div class="home-record-copy"><p class="home-record-title">咖啡</p><span class="home-chip">直接分账</span></div>
      <div class="home-record-money"><p class="home-amount outgoing">−RM 12.00</p><p class="home-wallet">现金</p></div>
    </div></article></section></div>`)
  await shot(page, 'travel-active-390', 390, `
    <div class="home-frame"><header class="home-header"><div></div><div class="home-mode" data-testid="home-mode-switch"><button type="button">日常</button><button type="button" aria-pressed="true">旅行</button></div></header>
    <section class="home-trip-card"><button class="home-account-button" type="button"><span class="home-trip-name">Hanoi Days</span><span class="home-trip-status">进行中</span></button>
    <p class="home-meta">我的消费</p><p class="home-balance-figure">₫300,000</p><p class="home-note">2026-09-10 – 2026-09-20</p></section>
    <section class="home-section"><h2>旅行记录</h2></section></div>`)
  await shot(page, 'travel-ended-390', 390, `
    <div class="home-frame"><header class="home-header"><div></div><div class="home-mode" data-testid="home-mode-switch"><button type="button">日常</button><button type="button" aria-pressed="true">旅行</button></div></header>
    <section class="home-trip-card"><span class="home-trip-name">Penang</span><span class="home-trip-status">已结束</span></section></div>`)
  await shot(page, 'travel-empty-390', 390, `
    <div class="home-frame"><header class="home-header"><div></div><div class="home-mode" data-testid="home-mode-switch"><button type="button">日常</button><button type="button" aria-pressed="true">旅行</button></div></header>
    <section class="home-trip-card" data-testid="home-trip-empty"><h2>还没有旅程</h2><p class="home-note">创建旅程后，可以在这里查看你的旅行消费。</p><button class="home-text-button" type="button">查看旅程</button></section></div>`)
})
