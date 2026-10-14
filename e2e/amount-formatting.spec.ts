import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { setup } from './fixtures/insightsUi'
import { spendingExpense } from '../src/test/spendingFixtures'

// Intercepted UI checks only; real-backend journeys remain in their existing suites.
const records = [spendingExpense('amount-vnd', 90000, 'personal', { currency: 'VND', description: 'Amount VND' }), spendingExpense('amount-cny', 345005, 'personal', { currency: 'CNY', description: 'Amount CNY' }), spendingExpense('amount-myr', 600000, 'personal', { description: 'Amount MYR' })]
for (const width of [320, 360, 390, 430]) test(`grouped Quick Add and record editing at ${width}px`, async ({ page }) => {
  test.setTimeout(60_000)
  await setup(page, records)
  await mkdir('test-results/amount-formatting', { recursive: true })
  await page.setViewportSize({ width, height: 844 })
  await page.goto('/quick-add')
  const quick = page.getByRole('dialog', { name: 'Quick Add', exact: true })
  await expect(quick).toBeVisible({ timeout: 15_000 })
  await quick.getByLabel('Currency', { exact: true }).selectOption('VND')
  for (const digit of '90000') await quick.getByRole('button', { name: digit, exact: true }).click()
  await expect(quick.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('90,000')
  await expect.poll(() => quick.getByLabel('Currency', { exact: true }).evaluate((el: HTMLSelectElement) => {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')!
    ctx.font = getComputedStyle(el).font
    return ctx.measureText(el.selectedOptions[0].textContent!).width <= el.clientWidth
  })).toBe(true)
  await page.screenshot({ path: `test-results/amount-formatting/quick-90000-${width}.png`, fullPage: true })
  await quick.getByRole('button', { name: '+', exact: true }).click()
  for (const digit of '1000') await quick.getByRole('button', { name: digit, exact: true }).click()
  await expect(quick.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('90,000+1,000')
  await expect(quick.getByText('= 91,000', { exact: true })).toBeVisible()
  await quick.getByRole('button', { name: 'Calculate amount' }).click()
  await expect(quick.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('91,000')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: `test-results/amount-formatting/quick-vnd-${width}.png`, fullPage: true })
  await page.goto('/insights/records?month=2026-10&scope=all')
  const row = page.getByRole('button', { name: 'Edit Amount CNY', exact: true })
  await expect(row).toContainText('3,450.05', { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Edit Amount VND', exact: true })).toContainText('90,000')
  await expect(page.getByRole('button', { name: 'Edit Amount MYR', exact: true })).toContainText('6,000.00')
  await page.screenshot({ path: `test-results/amount-formatting/records-${width}.png`, fullPage: true })
  await row.click()
  const editor = page.getByRole('dialog', { name: 'Edit record', exact: true })
  const amount = editor.getByRole('textbox', { name: 'Total amount', exact: true })
  await expect(amount).toHaveValue('3,450.05')
  await expect(editor.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await amount.fill('6000.10')
  await expect(amount).toHaveValue('6,000.10')
  await amount.evaluate((el: HTMLInputElement) => el.setSelectionRange(1, 1))
  await amount.press('Delete')
  await expect(amount).toHaveValue('600.10')
  await amount.fill('90071992547409.90')
  await expect(amount).toHaveValue('90,071,992,547,409.90')
  await page.screenshot({ path: `test-results/amount-formatting/editor-${width}.png`, fullPage: true })
  await page.keyboard.press('Escape')
  await expect(editor).not.toBeVisible()
  await expect(row).toBeFocused()
  await expect(row).toContainText('3,450.05')
})
