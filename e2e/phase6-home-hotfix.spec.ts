import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test.beforeAll(async () => {
  await mkdir('test-results/phase6-hotfix', { recursive: true })
})

test('zero-account home offers add account in the selected language', async ({ page }) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/__home-visual?case=empty-accounts')
    await expect(page.getByText('No cash accounts yet')).toBeVisible()
    await expect(page.getByTestId('home-add-first-account')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Manage', exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Daily' })).toBeVisible()
    await expect(page.getByText('管理')).toHaveCount(0)
    await page.screenshot({ path: `test-results/phase6-hotfix/empty-accounts-${width}.png`, fullPage: true })
    await page.getByTestId('home-add-first-account').click()
    await expect(page.getByTestId('home-create-account-sheet')).toBeVisible()
    await page.screenshot({ path: `test-results/phase6-hotfix/create-account-${width}.png`, fullPage: true })
    await page.keyboard.press('Escape')
  }
})

test('expense actions stay wide when an error is visible', async ({ page }) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/__home-visual?case=expense-actions')
    await page.getByRole('button', { name: 'Actions for Coffee' }).click()
    const menu = page.getByTestId('expense-action-menu')
    await expect(menu).toBeVisible()
    await expect(page.getByText('Could not refresh this expense.')).toBeVisible()
    const labels = ['Edit details', 'Edit expense', 'Cancel expense']
    for (const label of labels) {
      const button = menu.getByRole('button', { name: label })
      const box = await button.boundingBox()
      expect(box?.width ?? 0).toBeGreaterThan(160)
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    const stacking = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="expense-action-cancel"]')
      const layer = document.querySelector('[data-testid="global-money-action-layer"]')
      const sheet = button?.closest('.fixed')
      return {
        buttonZ: sheet ? Number(getComputedStyle(sheet).zIndex) : 0,
        addZ: layer ? Number(getComputedStyle(layer).zIndex) : 0,
      }
    })
    expect(stacking.buttonZ).toBeGreaterThan(stacking.addZ)
    const cancel = await menu.getByRole('button', { name: 'Cancel expense' }).boundingBox()
    expect(cancel && cancel.y >= 0 && cancel.y + cancel.height <= 844).toBeTruthy()
    await page.screenshot({ path: `test-results/phase6-hotfix/expense-actions-${width}.png`, fullPage: true })
    await page.keyboard.press('Escape')
  }
})

test('Chinese remains available when that language is selected', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/__home-visual?case=empty-accounts&lang=zh')
  await expect(page.getByText('还没有现金账户')).toBeVisible()
  await expect(page.getByRole('button', { name: '添加账户' })).toBeVisible()
  await expect(page.getByRole('button', { name: '管理', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主要导航' }).getByRole('button', { name: '日常' })).toBeVisible()
  await page.screenshot({ path: 'test-results/phase6-hotfix/empty-accounts-zh-390.png', fullPage: true })
})
