import { mkdir } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function openCase(page: Page, width: number, scenario = 'both', lang = 'en') {
  await page.setViewportSize({ width, height: 844 })
  await page.goto(`/__home-visual?case=${scenario}&lang=${lang}`)
  await expect(page.getByTestId('home-mode-switch')).toBeVisible()
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function selectedViewIcon(page: Page, icon: 'grid' | 'list') {
  await expect.poll(async () => {
    const thumb = await page.locator('.home-density-thumb').boundingBox()
    const selected = await page.locator(`.home-density-option[data-icon="${icon}"]`).boundingBox()
    return Math.abs((thumb!.x + thumb!.width / 2) - (selected!.x + selected!.width / 2))
  }).toBeLessThan(1)
}

test.beforeAll(async () => { await mkdir('test-results/home-ui', { recursive: true }) })

for (const width of [320, 360, 390, 430]) {
  test(`Denim & Paper home at ${width}px`, async ({ page }) => {
    await openCase(page, width)
    await expect(page.getByRole('heading', { name: 'My day', exact: true })).toBeVisible()
    await expect(page.getByTestId('home-manage')).toHaveCount(0)
    await expect(page.getByTestId('home-unconfirmed-notice')).toBeVisible()
    await noHorizontalOverflow(page)
    const track = await page.locator('.home-density-track').boundingBox()
    expect(track?.width).toBe(48); expect(track?.height).toBe(22)
    const grid = await page.locator('.home-density-option[data-icon="grid"]').boundingBox()
    const list = await page.locator('.home-density-option[data-icon="list"]').boundingBox()
    expect(grid!.x).toBeLessThan(list!.x)
    await selectedViewIcon(page, 'grid')
    const tray = await page.locator('.tt-nav-surface').boundingBox()
    const add = await page.locator('.tt-seal').boundingBox()
    expect(add?.width).toBe(52); expect(add?.height).toBe(52)
    expect(Math.abs((tray!.x + tray!.width / 2) - (add!.x + add!.width / 2))).toBeLessThan(1)
    await page.screenshot({ path: `test-results/home-ui/detailed-${width}.png`, fullPage: true })
    await page.getByRole('switch', { name: 'Record detail' }).click()
    await expect(page.locator('.home-frame')).toHaveAttribute('data-density', 'compact')
    await selectedViewIcon(page, 'list')
    await expect(page.locator('.home-wallet').first()).not.toBeVisible()
    await expect(page.locator('.home-day-total-label').first()).toBeVisible()
    await expect(page.locator('.home-chip').first()).toBeVisible()
    expect(await page.locator('.home-day').first().evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    await noHorizontalOverflow(page)
    await page.screenshot({ path: `test-results/home-ui/compact-${width}.png`, fullPage: true })
    await page.getByTestId('home-account-selector').click()
    const accountMenu = page.getByTestId('home-account-sheet')
    await expect(accountMenu).toBeVisible()
    await expect(accountMenu).toHaveAttribute('aria-modal', 'false')
    await expect(page.getByTestId('home-account-sheet-scrim')).toHaveCount(0)
    await expect.poll(async () => {
      const menu = await accountMenu.boundingBox()
      const trigger = await page.getByTestId('home-account-selector').boundingBox()
      return menu!.y - (trigger!.y + trigger!.height)
    }).toBeGreaterThan(0)
    await noHorizontalOverflow(page)
    await page.screenshot({ path: `test-results/home-ui/account-sheet-${width}.png`, fullPage: true })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('home-account-sheet')).toHaveCount(0)
    await expect(page.getByTestId('home-account-selector')).toBeFocused()
  })
}

test('selects accounts from the paper menu and enters the existing accessible add form', async ({ page }) => {
  await openCase(page, 390)
  await page.getByTestId('home-account-selector').click()
  const sheet = page.getByTestId('home-account-sheet')
  await sheet.getByRole('button', { name: /^CIMB/ }).click()
  await expect(page.getByTestId('home-account-selector')).toContainText('CIMB')
  await expect(page.getByTestId('home-balance-values')).toContainText('1,250.00')
  await page.getByTestId('home-account-selector').click()
  await expect(sheet.getByRole('button', { name: /^CIMB/ })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(sheet.getByRole('button', { name: /^All accounts/ })).toBeFocused()
  await page.keyboard.press('End')
  await expect(sheet.getByRole('button', { name: /^现金/ })).toBeFocused()
  await page.getByTestId('home-add-account').click()
  await expect(page.getByTestId('home-create-account-sheet')).toBeVisible()
  await page.getByLabel('Account name', { exact: true }).fill('New wallet')
  await page.getByTestId('home-create-account').click()
  await expect(page.getByTestId('home-create-account-sheet')).toHaveCount(0)
  await expect(page.getByTestId('home-account-selector')).toBeFocused()
  await page.getByTestId('home-account-selector').click()
  await expect(page.getByRole('button', { name: /^New wallet/ })).toBeVisible()
})

test('keeps the original privacy range and preserves unknown opening balances', async ({ page }) => {
  await openCase(page, 390, 'hidden')
  await expect(page.getByTestId('home-balance-values')).toContainText('••••')
  await expect(page.getByTestId('home-balance-values')).not.toContainText('1,290.00')
  await expect(page.getByTestId('home-receivable')).toContainText('24.00')
  await page.getByTestId('home-account-selector').click()
  // The existing privacy preference only masks the home balance card.
  await expect(page.getByTestId('home-account-sheet')).toContainText('1,250.00')
  await page.keyboard.press('Escape')
  await page.getByTestId('home-balance-eye').click()
  await expect(page.getByTestId('home-balance-values')).toContainText('1,290.00')
})

test('preserves notification content, zero pending and error states', async ({ page }) => {
  await openCase(page, 390, 'zero-pending')
  await expect(page.getByTestId('home-unconfirmed-notice')).toContainText('1 records')
  await page.getByTestId('home-unconfirmed-notice').click()
  await expect(page.getByTestId('home-review-sheet')).toContainText('Pending confirmation')
  await page.keyboard.press('Escape')
  await page.getByTestId('home-account-notice').click()
  await expect(page.getByTestId('home-notice-popover')).toContainText('Account tasks')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('home-account-notice')).toBeFocused()
  await openCase(page, 390, 'none')
  await expect(page.locator('.home-account-notice-dot')).toHaveCount(0)
  await expect(page.getByTestId('home-unconfirmed-notice')).toHaveCount(0)
  await openCase(page, 390, 'error')
  await expect(page.getByTestId('home-balance-values')).toHaveCount(0)
  await expect(page.getByTestId('home-unconfirmed-notice')).toHaveCount(0)
  await expect(page.getByTestId('home-receivable')).not.toContainText('0.00')
})

test('review opens a centered paper dialog and keeps dismissal and focus accessible', async ({ page }) => {
  await openCase(page, 390, 'pending')
  const trigger = page.getByTestId('home-unconfirmed-notice')
  await trigger.click()
  const dialog = page.getByTestId('home-review-sheet')
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(dialog.locator('.home-sheet-handle')).toHaveCount(0)
  await expect(dialog).toContainText('Pending confirmation')
  await expect.poll(async () => {
    const bounds = await dialog.boundingBox()
    return Math.abs(bounds!.y + bounds!.height / 2 - 844 / 2)
  }).toBeLessThan(1)
  await dialog.getByRole('button', { name: 'Close' }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button').last()).toBeFocused()
  await noHorizontalOverflow(page)
  await page.screenshot({ path: 'test-results/home-ui/review-dialog-390.png', fullPage: true })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('long content and enlarged text remain within a 320px viewport', async ({ page }) => {
  await openCase(page, 320, 'long', 'zh')
  // This is deliberately a test-only text enlargement, never production CSS.
  await page.addStyleTag({ content: '.home-title{font-size:30px!important}.home-section-head h2{font-size:22.5px!important}.home-record-title,.home-amount{font-size:17.5px!important}.home-mode button{font-size:16.25px!important}.home-account-button span{font-size:15px!important}' })
  await noHorizontalOverflow(page)
  await page.screenshot({ path: 'test-results/home-ui/long-text-320.png', fullPage: true })
  await page.getByTestId('home-account-selector').click()
  await noHorizontalOverflow(page)
})
