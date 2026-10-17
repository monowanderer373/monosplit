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
  test(`compact Home mascot/actions fit ${width}px / ${font}% text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const state = await home(page, { long: font === 200 })
    await page.evaluate(font => document.documentElement.style.fontSize = font + '%', font)
    const card = page.locator('.home-balance-card'), trigger = page.getByTestId('home-account-actions')
    await expect(card).toContainText('223.00')
    await expect(card.locator('.ttmc-pending-band')).toHaveCount(0)
    await expect(card.locator('.ttmc-more')).toHaveCount(0)
    await expect(card.locator('img[src="/denim-paper/pocket-clear.png"]')).toHaveCount(1)
    const header = (await page.locator('.home-account-header').boundingBox())!
    expect(header.height).toBe(52)
    const selector = (await page.getByTestId('home-account-selector').boundingBox())!
    const target = (await trigger.boundingBox())!
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(selector.x + selector.width).toBeLessThan(target.x)
    const cardBox = (await card.boundingBox())!
    if (font === 100) expect(cardBox.height).toBeLessThanOrEqual(190)
    await writeFile(`${out}/geometry-${width}-${font}.json`, JSON.stringify({ width, rootFontPercent: font, card: cardBox, header, selector, mascot: target }, null, 2))
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1)
    if (width === 390 && font === 100) await page.screenshot({ path: `${out}/after-home.png` })
    await trigger.click()
    const dialog = page.getByTestId('account-actions')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Transfer|Exchange|View account/ })).toHaveCount(3)
    await expect(dialog).toContainText(font === 200 ? 'deliberately long full name' : 'Touch n Go')
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(15)
    expect(box.x + box.width).toBeLessThanOrEqual(width - 15)
    expect(box.y).toBeGreaterThanOrEqual(15)
    expect(box.y + box.height).toBeLessThanOrEqual(829)
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await dialog.getByRole('button', { name: 'View account', exact: true }).scrollIntoViewIfNeeded()
    await expect(dialog.getByRole('button', { name: 'View account', exact: true })).toBeVisible()
    await page.screenshot({ path: `${out}/actions-${width}-${font}.png` })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(state.writes).toHaveLength(0)
  })
}

test('bell retains grouped deduction tasks; mascot press, keyboard, focus trap and scrim do not switch accounts', async ({ page }) => {
  const state = await home(page)
  const bell = page.getByTestId('home-account-notice')
  await expect(bell).toHaveAccessibleName(/2 to do/)
  await bell.click()
  const group = page.locator('[data-notice-id="fundinggroup:bank"]')
  await expect(group).toContainText('2 deductions to verify')
  await group.click()
  await expect(page).toHaveURL(/accounts\/verify\?account=bank/)
  await expect(page.getByRole('heading', { name: 'Verify deductions', exact: true })).toBeVisible()
  await page.goBack()
  // The original notification return intentionally restores its open panel.
  const panel = page.getByTestId('home-notice-popover')
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(panel).toHaveCount(0)
  const trigger = page.getByTestId('home-account-actions')
  await expect(trigger).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const box = (await trigger.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect.poll(() => trigger.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThan(.97)
  await page.screenshot({ path: `${out}/mascot-pressed.png` })
  await page.mouse.up()
  const dialog = page.getByTestId('account-actions')
  await expect(dialog).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true) }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await page.getByTestId('account-actions-scrim').click({ position: { x: 4, y: 4 } })
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.getByTestId('home-account-selector')).toContainText('Touch n Go')
  expect(state.writes).toHaveLength(0)
})

for (const selected of [true, false]) for (const action of ['Transfer', 'Exchange', 'View account']) {
  test(`mascot ${action} preserves ${selected ? 'selected account' : 'all accounts'} route`, async ({ page }) => {
    const state = await home(page)
    if (!selected) {
      await page.getByTestId('home-account-selector').click()
      await page.getByTestId('home-account-sheet').getByRole('button', { name: /^All accounts/ }).click()
    }
    await page.getByTestId('home-account-actions').click()
    await page.getByTestId('account-actions').getByRole('button', { name: action, exact: true }).click()
    if (action === 'View account') {
      await expect(page).toHaveURL(new RegExp(selected ? '/accounts/bank$' : '/accounts$'))
      await expect(page.getByRole('heading', { name: selected ? 'Touch n Go' : 'Accounts', exact: true })).toBeVisible()
      await expect(page.getByRole('main')).toContainText('2 deductions to verify')
    } else {
      await expect(page).toHaveURL(new RegExp('/accounts/move/' + action.toLowerCase() + '\\?from=' + (selected ? 'bank' : 'all') + '$'))
      await expect(page.getByRole('combobox', { name: 'From', exact: true })).toHaveValue(selected ? 'bank' : '')
    }
    await expect(page.getByTestId('account-actions')).toHaveCount(0)
    expect(state.writes).toHaveLength(0)
  })
}

test('concealed Chinese Home retains accessible mascot and reduced-motion paper actions without financial values', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const state = await home(page, { lang: 'zh', hidden: true, long: true })
  expect(await page.locator('.home-balance-card').ariaSnapshot()).not.toMatch(/223|22,300/)
  const trigger = page.getByTestId('home-account-actions')
  await expect(trigger).toHaveAccessibleName('更多账户操作')
  await trigger.focus();await page.keyboard.press('Space')
  const dialog = page.getByTestId('account-actions')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button')).toHaveCount(4)
  expect(await dialog.ariaSnapshot()).not.toMatch(/223|22,300|MYR/)
  expect(await trigger.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s')
  await page.screenshot({ path: `${out}/actions-zh-private.png` })
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(state.writes).toHaveLength(0)
})
