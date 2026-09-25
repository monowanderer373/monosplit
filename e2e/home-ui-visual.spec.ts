import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const forbidden = [
  'PERSONAL LEDGER',
  'Smart capture',
  'FASTER NEXT TIME',
  'Recent details',
  'Your activity',
  'Tracked receivable',
  'Untracked',
]

async function openCase(page: import('@playwright/test').Page, name: string, width: number, query: string) {
  await page.setViewportSize({ width, height: 844 })
  await page.goto(`/__home-visual?${query}`)
  await expect(page.getByTestId('home-mode-switch')).toBeVisible()
  const body = await page.locator('body').innerText()
  for (const label of forbidden) expect(body).not.toContain(label)
  await page.screenshot({ path: `test-results/home-ui/${name}.png`, fullPage: true })
}

test.beforeAll(async () => {
  await mkdir('test-results/home-ui', { recursive: true })
})

test('renders the real home composition at phone widths', async ({ page }) => {
  await openCase(page, 'daily-two-tiles-390', 390, 'case=both')
  await expect(page.getByTestId('home-mode-switch')).toBeVisible()
  const header = await page.getByTestId('home-header').boundingBox()
  const mode = await page.getByTestId('home-mode-switch').boundingBox()
  expect(header && mode && mode.x > header.x + header.width / 2).toBeTruthy()
  await expect(page.getByText('Direct split with Lan')).toBeVisible()
  const dailyText = await page.locator('body').innerText()
  expect(dailyText).toContain('40.00')
  expect(dailyText).not.toContain('80.00')
  await expect(page.getByText('Hanoi Days · Trip')).toBeVisible()
  await expect(page.getByText('Today', { exact: false })).toBeVisible()
  await expect(page.getByText('Yesterday', { exact: false })).toBeVisible()
  await expect(page.locator('.home-amount.outgoing').first()).toBeVisible()
  await expect(page.locator('.home-amount.incoming').first()).toBeVisible()
  await expect(page.getByText('CIMB').first()).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Daily' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Insights' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Shared' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Me' })).toBeVisible()

  await openCase(page, 'daily-two-tiles-360', 360, 'case=both')
  await openCase(page, 'daily-two-tiles-430', 430, 'case=both')
  await openCase(page, 'daily-one-tile-390', 390, 'case=account-only')
  await openCase(page, 'daily-zero-tiles-390', 390, 'case=none')
  await openCase(page, 'hidden-balance-390', 390, 'case=hidden')
  await expect(page.getByTestId('home-balance-values')).toContainText('••••')
  await page.getByTestId('home-account-selector').click()
  await expect(page.getByTestId('home-account-sheet')).toBeVisible()
  await expect(page.getByTestId('home-manage-accounts')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('MYR · MYR')
  await expect(page.locator('.home-money-line').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/home-ui/account-sheet-390.png', fullPage: true })
  await page.keyboard.press('Escape')
  await openCase(page, 'account-selected-390', 390, 'case=account')
  await expect(page.getByTestId('home-account-selector')).toContainText('CIMB')
  await openCase(page, 'compact-records-390', 390, 'case=compact')
  await expect(page.locator('.home-record.is-compact').first()).toBeVisible()
  await expect(page.locator('.home-record.is-compact .home-record-icon')).toHaveCount(0)
  await expect(page.locator('.home-record.is-compact .home-wallet').first()).toBeVisible()
  await page.goto('/__home-visual?case=both')
  await expect(page.locator('.home-record-icon').first()).toBeVisible()
  await openCase(page, 'travel-active-390', 390, 'case=travel-active')
  const travelMode = await page.getByTestId('home-mode-switch').boundingBox()
  const travelHeader = await page.getByTestId('home-header').boundingBox()
  expect(travelHeader && travelMode && travelMode.x > travelHeader.x + travelHeader.width / 2).toBeTruthy()
  await openCase(page, 'travel-ended-390', 390, 'case=travel-ended')
  await openCase(page, 'travel-empty-390', 390, 'case=travel-empty')
  await openCase(page, 'account-error-390', 390, 'case=error')
  await expect(page.getByRole('alert').getByText('These figures could not be loaded.')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Daily' })).toHaveAttribute('aria-current', 'page')
})
