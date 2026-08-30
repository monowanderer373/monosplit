import { expect, test } from '@playwright/test'
import { createConfirmedAccount, signIn } from './fixtures/localSupabase'

test('keeps a signed-out personal ledger private', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Your private ledger starts here.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByText('Guest access is reserved for invited spaces.')).toBeVisible()
})

test('explains secure access on the spaces route', async ({ page }) => {
  await page.goto('/spaces')

  await expect(page.getByRole('heading', { name: 'Sign in or open an invite.' })).toBeVisible()
  await expect(page.getByText('Invited guests can join with a secure invite link.')).toBeVisible()
})

test('renders the quick-add deep link without exposing a ledger while signed out', async ({ page }) => {
  await page.goto('/quick-add?source=pwa-shortcut')

  await expect(page.getByRole('heading', { name: 'Your private ledger starts here.' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('installs the production PWA and restores its private shell offline', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'Your private ledger starts here.' })).toBeVisible()
})

test('keeps an unverified email signup out of the private ledger', async ({ page }) => {
  const email = `shortcut-${Date.now()}@example.test`
  await page.goto('/signup')
  await page.getByLabel('Display name').fill('Shortcut Tester')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('test-password-123')
  await page.getByRole('button', { name: 'Sign Up' }).click()
  await expect(page.getByText('Account created! Check your email to verify before signing in.')).toBeVisible()

  await page.goto('/quick-add?source=pwa-shortcut')
  await expect(page.getByRole('heading', { name: 'Your private ledger starts here.' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('provisions a confirmed account and completes the manifest Quick Add shortcut', async ({ page }, testInfo) => {
  const manifestResponse = await page.request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)
  const manifest = await manifestResponse.json() as {
    shortcuts?: Array<{ name?: string; url?: string }>
  }
  expect(manifest.shortcuts).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: 'Quick tally',
      url: '/quick-add?source=pwa-shortcut',
    }),
  ]))

  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount('shortcut', 'Shortcut Tester', runId)
  await signIn(page, account)

  await page.goto('/quick-add?source=pwa-shortcut')
  const dialog = page.getByRole('dialog', { name: 'Quick tally' })
  await expect(dialog).toBeVisible()
  const quickAddStartedAt = performance.now()
  await dialog.getByLabel('Amount').fill('12.34')
  await dialog.getByRole('button', { name: 'Save expense' }).click()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(/12\.34/).first()).toBeVisible()
  const quickAddDurationMs = Math.round(performance.now() - quickAddStartedAt)
  testInfo.annotations.push({
    type: 'quick-add-duration-ms',
    description: String(quickAddDurationMs),
  })
  await testInfo.attach('quick-add-timing', {
    body: JSON.stringify({ durationMs: quickAddDurationMs }),
    contentType: 'application/json',
  })
  expect(quickAddDurationMs).toBeGreaterThanOrEqual(0)
  expect(quickAddDurationMs).toBeLessThan(60_000)

  await page.goto('/capture')
  await page.getByLabel('Describe the expense').fill('Dinner MYR 8.50 yesterday')
  const parseButton = page.getByRole('button', { name: 'Parse text' })
  await expect(parseButton).toBeEnabled()
  await parseButton.click()
  await page.getByRole('button', { name: 'Continue to final review' }).click()

  const reviewDialog = page.getByRole('dialog', { name: 'Quick tally' })
  await expect(reviewDialog).toBeVisible()
  await expect(reviewDialog.getByLabel('Amount')).toHaveValue('8.50')
})
