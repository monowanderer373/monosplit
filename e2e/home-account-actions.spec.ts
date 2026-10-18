import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { setupMulticurrency } from './fixtures/multicurrency'

const out = 'test-results/home-account-actions'
test.beforeAll(async () => { await mkdir(out, { recursive: true }) })
async function home(page: Page, options: { long?: boolean; lang?: string; hidden?: boolean } = {}) {
  const state = await setupMulticurrency(page, options)
  state.snapshot.accounts = state.snapshot.accounts.filter(a => a.currency === 'MYR')
  const name = options.long ? 'Touch n Go travel account with a deliberately long full name' : 'Touch n Go'
  state.snapshot.accounts.find(a => a.id === 'bank')!.name = name
  state.entries.find(a => a.account_id === 'bank')!.amount_minor = -22300
  await page.goto('/')
  await expect(page.getByTestId('home-account-selector')).toBeVisible()
  await page.getByTestId('home-account-selector').click()
  await page.getByTestId('home-account-sheet').getByRole('button', { name: new RegExp(name) }).click()
  await expect(page.getByTestId('home-account-selector')).toContainText(name)
  return state
}

for (const width of [320, 360, 390, 430]) for (const font of [100, 125, 150, 200]) {
  test(`compact Home cards/actions fit ${width}px / ${font}% text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const state = await home(page, { long: font === 200 })
    await page.evaluate(font => document.documentElement.style.fontSize = font + '%', font)
    const card = page.locator('.home-balance-card')
    await expect(card).toContainText('223.00')
    await expect(card.locator('.ttmc-pending-band')).toHaveCount(0)
    await expect(card.locator('.ttmc-more')).toHaveCount(0)
    await expect(card.locator('img[src="/denim-paper/pocket-clear.png"]')).toHaveCount(0)
    await expect(page.getByTestId('home-balance-eye')).toHaveCount(0)
    const cardBox = (await card.boundingBox())!
    if (font === 100) expect(cardBox.height).toBeLessThanOrEqual(140)
    await writeFile(`${out}/geometry-${width}-${font}.json`, JSON.stringify({ width, rootFontPercent: font, card: cardBox }, null, 2))
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1)
    if (width === 390 && font === 100) await page.screenshot({ path: `${out}/after-home.png` })
    await page.getByTestId('home-account-selector').click()
    const sheet = page.getByTestId('home-account-sheet')
    await expect(page.getByTestId('home-account-actions')).toBeVisible()
    await expect(sheet.getByRole('button', { name: /Transfer|Exchange|View account/ })).toHaveCount(3)
    await expect(sheet).toContainText(font === 200 ? 'deliberately long full name' : 'Touch n Go')
    const box = (await sheet.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    expect(await sheet.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await expect(page.getByTestId('home-account-action-view')).toBeVisible()
    await page.screenshot({ path: `${out}/actions-${width}-${font}.png` })
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    expect(state.writes).toHaveLength(0)
  })
}

test('bell retains grouped deduction tasks; picker actions keep the selected account', async ({ page }) => {
  const state = await home(page)
  const bell = page.getByTestId('home-account-notice')
  await expect(bell).toHaveAccessibleName(/2 to do/)
  await bell.click()
  const group = page.locator('[data-notice-id="fundinggroup:bank"]')
  await expect(group).toContainText('2 deductions to verify')
  const panel = page.getByTestId('home-notice-popover')
  const bellBox = (await bell.boundingBox())!
  const panelBox = (await panel.boundingBox())!
  expect(panelBox.x).toBeGreaterThanOrEqual(bellBox.x + bellBox.width - 1)
  await expect(panel.getByRole('heading', { name: 'Notifications' })).toHaveCount(0)
  await group.click()
  await expect(page).toHaveURL(/accounts\/verify\?account=bank/)
  await expect(page.getByRole('heading', { name: 'Verify deductions', exact: true })).toBeVisible()
  await page.goBack()
  const restored = page.getByTestId('home-notice-popover')
  await expect(restored).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(restored).toHaveCount(0)
  await page.getByTestId('home-account-selector').click()
  await expect(page.getByTestId('home-account-actions')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('home-account-selector')).toContainText('Touch n Go')
  expect(state.writes).toHaveLength(0)
})

for (const selected of [true, false]) for (const action of ['Transfer', 'Exchange', 'View account'] as const) {
  test(`picker ${action} preserves ${selected ? 'selected account' : 'all accounts'} route`, async ({ page }) => {
    const state = await home(page)
    await page.getByTestId('home-account-selector').click()
    if (!selected) {
      await page.getByTestId('home-account-sheet').getByRole('button', { name: /^All accounts/ }).click()
      await page.getByTestId('home-account-selector').click()
    }
    const kind = action === 'View account' ? 'view' : action.toLowerCase()
    await page.getByTestId(`home-account-action-${kind}`).click()
    if (action === 'View account') {
      await expect(page).toHaveURL(new RegExp(selected ? '/accounts/bank$' : '/accounts$'))
      await expect(page.getByRole('heading', { name: selected ? 'Touch n Go' : 'Accounts', exact: true })).toBeVisible()
      await expect(page.getByRole('main')).toContainText('2 deductions to verify')
    } else {
      await expect(page).toHaveURL(new RegExp('/accounts/move/' + action.toLowerCase() + '\\?from=' + (selected ? 'bank' : 'all') + '$'))
      await expect(page.getByRole('combobox', { name: 'From', exact: true })).toHaveValue(selected ? 'bank' : '')
    }
    expect(state.writes).toHaveLength(0)
  })
}

test('concealed Chinese Home recovers privacy from the account picker without a mascot', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const state = await home(page, { lang: 'zh', hidden: true, long: true })
  expect(await page.locator('.home-balance-card').ariaSnapshot()).not.toMatch(/223|22,300/)
  await expect(page.getByTestId('home-balance-eye')).toHaveCount(0)
  await page.getByTestId('home-account-selector').click()
  await expect(page.getByTestId('home-account-sheet')).toBeVisible()
  await expect(page.getByTestId('home-privacy-toggle')).toContainText('显示账户余额')
  await expect(page.getByTestId('home-account-actions')).toHaveAccessibleName('更多账户操作')
  await page.screenshot({ path: `${out}/actions-zh-private.png` })
  await page.getByTestId('home-privacy-toggle').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.home-balance-card')).toContainText('223')
  expect(state.writes).toHaveLength(0)
})
