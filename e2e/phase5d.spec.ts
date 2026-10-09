import { enterQuickAmount } from './fixtures/quickAdd'
import { expect, test } from '@playwright/test'
import {
  closeBrowsers,
  createConfirmedAccount,
  openAuthenticatedBrowser,
  serverExpenseCount,
  signIn,
  type AuthenticatedBrowser,
} from './fixtures/localSupabase'

test('discards a never-dispatched offline create before reconnect', async ({
  browser,
  context,
  page,
}, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount(
    'phase5d-discard',
    'Discard Owner',
    runId,
  )
  const description = `Never synced ${runId}`
  let observer: AuthenticatedBrowser | undefined

  try {
    await signIn(page, account)
    await context.setOffline(true)
    await page.getByRole('button', { name: 'Quick add expense' }).click()
    const capture = page.getByRole('dialog', { name: 'Quick Add' })
    await enterQuickAmount(capture, '12.34')
    await capture.getByRole('textbox', { name: 'Description', exact: true }).fill(description)
    await capture.getByRole('button', { name: 'Food', exact: true }).click()
    await capture.getByRole('button', { name: 'Save and close' }).click()

    const optimistic = page.getByRole('article').filter({ hasText: description })
    await expect(optimistic).toContainText('Pending locally · Not yet synced')
    await optimistic.getByRole('button', { name: 'Undo add' }).click()
    await expect(optimistic).toHaveCount(0)
    await expect(page.getByText('Expense removed before sync.')).toBeVisible()

    await context.setOffline(false)
    await page.reload()
    await expect(page.getByRole('article').filter({ hasText: description })).toHaveCount(0)
    await expect.poll(() => serverExpenseCount(account, description)).toBe(0)

    observer = await openAuthenticatedBrowser(browser, account)
    await observer.page.goto('/')
    await expect(
      observer.page.getByRole('article').filter({ hasText: description }),
    ).toHaveCount(0)
  } finally {
    await closeBrowsers([observer])
  }
})

test('committed create uses server cancellation and owner-local restore', async ({
  page,
}, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount(
    'phase5d-restore',
    'Restore Owner',
    runId,
  )
  const description = `Restore expense ${runId}`
  await signIn(page, account)

  await page.getByRole('button', { name: 'Quick add expense' }).click()
  const capture = page.getByRole('dialog', { name: 'Quick Add' })
  await enterQuickAmount(capture, '23.45')
  await capture.getByRole('textbox', { name: 'Description', exact: true }).fill(description)
  await capture.getByRole('button', { name: 'Food', exact: true }).click()
  await capture.getByRole('button', { name: 'Save and close' }).click()

  const expense = page.getByRole('article').filter({ hasText: description })
  const currentExpenseAction = page.getByRole('button', {
    name: `Edit ${description}`,
  })
  await expect(expense).toBeVisible()
  await expect.poll(() => serverExpenseCount(account, description)).toBe(1)
  await expect(expense.getByRole('button', { name: 'Undo add' })).toHaveCount(0)

  await expense
    .getByRole('button', { name: `Edit ${description}` })
    .press('Enter')
  const actions = page.getByRole('dialog')
  await actions.getByRole('button', { name: 'Cancel expense', exact: true }).click()
  await actions.getByRole('button', { name: 'Confirm cancellation' }).click()

  await expect(currentExpenseAction).toHaveCount(0)
  await expect(page.getByText(`${description} was cancelled locally.`)).toBeVisible()
  await page.getByRole('button', { name: 'Undo cancellation' }).click()

  await expect(currentExpenseAction).toBeVisible()
  await expect.poll(() => serverExpenseCount(account, description)).toBe(1)
})
