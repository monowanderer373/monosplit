import { expect, test, type Page } from '@playwright/test'
import {
  closeBrowsers,
  copyInviteUrl,
  createConfirmedAccount,
  openAuthenticatedBrowser,
} from './fixtures/localSupabase'

test('links a Person without rewriting old Manual money', async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000)
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const [ownerAccount, targetAccount] = await Promise.all([
    createConfirmedAccount('person-owner', 'Person Owner', runId),
    createConfirmedAccount('person-target', 'Person Target', runId),
  ])
  const [ownerBrowser, targetBrowser] = await Promise.all([
    openAuthenticatedBrowser(browser, ownerAccount),
    openAuthenticatedBrowser(browser, targetAccount),
  ])

  try {
    const owner = ownerBrowser.page
    const target = targetBrowser.page

    await owner.goto('/friends')
    await owner.getByRole('button', { name: 'Copy friend invite' }).click()
    await expect(owner.getByText('Invite copied', { exact: true })).toBeVisible()
    const inviteUrl = await copyInviteUrl(owner)
    await target.goto(inviteUrl)
    await target.getByRole('button', { name: 'Accept friend invite' }).click()
    await expect(target).toHaveURL(/\/friends$/)

    await owner.reload()
    await owner.getByPlaceholder('Person’s name').fill('Target cash')
    await owner.getByRole('button', { name: 'Add person' }).click()
    await owner.getByRole('button', { name: 'Split with Target cash' }).click()
    await saveCapture(owner, 'Manual before link', '8.00')

    await owner
      .getByLabel('Link Target cash to friend')
      .selectOption({ label: 'Person Target' })
    await owner.getByRole('button', { name: 'Request link' }).click()

    await target.reload()
    const linkRequest = target.getByRole('article').filter({
      hasText: 'A friend wants to link an untracked person to your account.',
    })
    await linkRequest.getByRole('button', { name: 'Accept link' }).click()

    await owner.reload()
    await expect(
      owner.getByRole('button', { name: 'Split with Target cash' }),
    ).toHaveCount(0)
    await expect(
      owner.getByRole('article').filter({ hasText: 'Person Target' }),
    ).toHaveCount(1)

    await owner.goto('/')
    await expect(summaryValue(owner, 'Untracked')).toHaveText('RM 4.00')

    await owner.goto('/friends')
    const targetCard = owner.getByRole('article').filter({
      hasText: 'Person Target',
    })
    await targetCard.getByRole('button', { name: 'Split', exact: true }).click()
    await saveCapture(owner, 'Linked after acceptance', '10.00')
    await expect(owner.getByRole('status')).toHaveText(
      'Recorded · waiting for confirmation',
    )

    await target.reload()
    const pending = target.getByRole('article').filter({
      hasText: 'Linked after acceptance',
    })
    await expect(pending.getByText('Your share RM 5.00')).toBeVisible()
  } finally {
    await closeBrowsers([ownerBrowser, targetBrowser])
  }
})

async function saveCapture(
  page: Page,
  description: string,
  amount: string,
): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Add Expense' })
  await dialog.getByRole('textbox', { name: /^Amount/ }).fill(amount)
  await dialog.getByPlaceholder('What was this for?').fill(description)
  await dialog.getByRole('button', { name: 'Save expense' }).click()
  await expect(dialog).toHaveCount(0)
}

function summaryValue(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..').locator('p').nth(1)
}
