import { expect, test } from '@playwright/test'
import { createConfirmedAccount, signIn } from './fixtures/localSupabase'

test('keeps four destinations and a usable global money action at 320px', async ({ page }, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount('navigation', 'Navigation Tester', runId)
  await signIn(page, account)
  await page.setViewportSize({ width: 320, height: 640 })

  await page.goto('/friends')
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Personal', exact: true })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Friends', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(navigation.getByRole('button', { name: 'Groups / Trips', exact: true })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Me', exact: true })).toBeVisible()

  const addButton = navigation.getByRole('button', { name: 'Quick add expense' })
  const box = await addButton.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(44)
  expect(box?.height).toBeGreaterThanOrEqual(44)

  await addButton.click()
  const gate = page.getByRole('dialog', { name: 'Where should this go?' })
  await expect(gate).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Quick tally' })).toHaveCount(0)
  await gate.getByRole('button', { name: 'Personal', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Quick tally' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/friends$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto('/spaces')
  await expect(navigation.getByRole('button', { name: 'Groups / Trips', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.goto('/profile')
  await expect(navigation.getByRole('button', { name: 'Me', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('direct Quick Add Back and Close both land safely on Personal', async ({ page }, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount('deep-link', 'Deep Link Tester', runId)
  await signIn(page, account)

  await page.goto('about:blank')
  await page.goto('/quick-add?source=pwa-shortcut')
  await expect(page.getByRole('dialog', { name: 'Quick tally' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('TABBY TALLY')).toBeVisible()

  await page.goto('about:blank')
  await page.goto('/quick-add?source=pwa-shortcut')
  const dialog = page.getByRole('dialog', { name: 'Quick tally' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('TABBY TALLY')).toBeVisible()
})
