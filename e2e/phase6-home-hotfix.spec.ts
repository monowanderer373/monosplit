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

test('whole-card editor stays usable above navigation at small widths', async ({ page }) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/__home-visual?case=expense-actions')
    const trigger = page.getByRole('button', { name: 'Edit Coffee' })
    await trigger.click({ position: { x: 20, y: 20 } })
    const editor = page.getByRole('dialog', { name: 'Edit record' })
    await expect(editor).toBeVisible()
    await expect(page.getByText(/Could not refresh this expense/)).toBeVisible()
    await expect(editor.getByRole('textbox', { name: 'Total amount' })).toBeVisible()
    await expect(editor.getByRole('textbox', { name: 'Description' })).toBeVisible()
    await expect(editor.getByRole('button', { name: 'Edit details' })).toHaveCount(0)
    await expect(editor.getByRole('button', { name: 'Edit expense' })).toHaveCount(0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    const stacking = await page.evaluate(() => {
      const sheet = document.querySelector('.expense-editor-backdrop')
      const layer = document.querySelector('[data-testid="global-money-action-layer"]')
      return { editorZ: sheet ? Number(getComputedStyle(sheet).zIndex) : 0, addZ: layer ? Number(getComputedStyle(layer).zIndex) : 0 }
    })
    expect(stacking.editorZ).toBeGreaterThan(stacking.addZ)
    const cancel = await editor.getByRole('button', { name: 'Cancel expense' }).boundingBox()
    expect(cancel && cancel.y >= 0 && cancel.y + cancel.height <= 844).toBeTruthy()
    await page.screenshot({ path: `test-results/phase6-hotfix/expense-editor-${width}.png`, fullPage: true })
    await page.getByTestId('expense-editor-scrim').click({ position: { x: 3, y: 3 } })
    await expect(editor).toHaveCount(0)
    await trigger.press('Enter')
    await expect(editor).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(editor).toHaveCount(0)
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
