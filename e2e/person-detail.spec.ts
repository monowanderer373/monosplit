import { expect, test, type Page } from '@playwright/test'
import {
  closeBrowsers,
  copyInviteUrl,
  createConfirmedAccount,
  openAuthenticatedBrowser,
  openPersonDetail,
  personCard,
  signIn,
} from './fixtures/localSupabase'

test('keeps Person Detail money-first and inherits that Person', async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000)
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const [ownerAccount, targetAccount] = await Promise.all([
    createConfirmedAccount('person-detail-owner', 'Detail Owner', runId),
    createConfirmedAccount('person-detail-target', 'Detail Target', runId),
  ])
  const [ownerBrowser, targetBrowser] = await Promise.all([
    openAuthenticatedBrowser(browser, ownerAccount),
    openAuthenticatedBrowser(browser, targetAccount),
  ])

  try {
    const owner = ownerBrowser.page
    const target = targetBrowser.page

    await owner.goto('/friends')
    await expect(owner.getByRole('heading', { name: 'Friends' })).toBeVisible()
    await expect(owner.getByRole('heading', { name: 'Direct splits' })).toHaveCount(0)
    await owner.getByRole('button', { name: 'Quick add expense' }).click()
    await expect(owner.getByRole('dialog', { name: 'Where should this go?' })).toBeVisible()
    await owner.getByRole('dialog', { name: 'Where should this go?' })
      .getByRole('button', { name: 'Close' })
      .click()

    await owner.getByRole('button', { name: 'Copy friend invite' }).click()
    await expect(owner.getByText('Invite copied', { exact: true })).toBeVisible()
    await target.goto(await copyInviteUrl(owner))
    await target.getByRole('button', { name: 'Accept friend invite' }).click()
    await expect(target).toHaveURL(/\/friends$/)

    await owner.reload()
    await owner.getByPlaceholder('Person’s name').fill('Lan cash')
    await owner.getByRole('button', { name: 'Add person' }).click()
    await expect(personCard(owner, 'Lan cash')).toBeVisible()
    await expect(personCard(owner, 'Lan cash').getByRole('button', { name: 'Split' })).toHaveCount(0)

    await openPersonDetail(owner, 'Lan cash')
    const personUrl = owner.url()
    await expect(owner).toHaveURL(/\/person\/[0-9a-f-]+$/i)
    await expect(
      owner.getByRole('navigation', { name: 'Primary navigation' })
        .getByRole('button', { name: 'Friends', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(owner.getByText('Manual', { exact: true }).first()).toBeVisible()
    await expect(owner.getByRole('button', { name: 'Settle Up' })).toBeDisabled()
    await expect(owner.getByText('Available after linking')).toBeVisible()
    await expectSectionOrder(owner, ['person-position', 'person-recent', 'person-manage'])

    await owner.getByRole('button', { name: 'Add Expense', exact: true }).click()
    const inherited = owner.getByRole('dialog', { name: 'Add Expense' })
    await expect(inherited).toBeVisible()
    await expect(
      inherited.getByRole('button', {
        name: 'Current context: Lan cash. Change context',
      }),
    ).toBeVisible()
    await inherited.getByRole('button', { name: 'Close' }).click()

    await owner.getByRole('button', { name: 'Quick add expense' }).click()
    const globalCapture = owner.getByRole('dialog', { name: 'Add Expense' })
    await expect(globalCapture).toBeVisible()
    await expect(owner.getByRole('dialog', { name: 'Where should this go?' })).toHaveCount(0)
    await globalCapture.getByRole('textbox', { name: /^Amount/ }).fill('6.00')
    await globalCapture.getByPlaceholder('What was this for?').fill('Untracked lunch')
    await globalCapture.getByRole('button', { name: 'Save expense' }).click()
    await expect(owner.getByTestId('person-untracked')).toContainText('Untracked lunch')

    await owner.getByRole('button', { name: 'Back to Friends' }).click()
    await expect(owner).toHaveURL(/\/friends$/)
    await openPersonDetail(owner, 'Lan cash')
    await expect(owner).toHaveURL(personUrl)
  } finally {
    await closeBrowsers([ownerBrowser, targetBrowser])
  }
})

test('keeps Group and Trip pages money-first without Close Trip', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount('space-hierarchy', 'Hierarchy Tester', runId)
  await signIn(page, account)

  await page.goto('/spaces')
  await expect(page.getByRole('heading', { name: 'Groups / Trips' })).toBeVisible()
  await page.getByRole('button', { name: 'Quick add expense' }).click()
  await expect(page.getByRole('dialog', { name: 'Where should this go?' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Where should this go?' })
    .getByRole('button', { name: 'Close' })
    .click()

  await page.getByLabel('Name').fill('Penang Trip')
  await page.getByLabel('Type').selectOption('trip')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Penang Trip' })).toBeVisible()
  await expect(page.getByText(/Trip · Owner · Open/)).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Add expense' })).toBeVisible()
  await expect(page.getByText('Close Trip')).toHaveCount(0)
  await expect(page.getByText('Final Statement')).toHaveCount(0)
  await expectSectionOrder(page, [
    'space-position',
    'space-recent',
    'space-balances',
    'space-recap',
    'space-manage',
  ])
  await expect(page.getByTestId('space-recap')).toContainText('Trip spending')
  await expect(page.getByTestId('space-manage')).toContainText('Dates')
  await page.getByRole('button', { name: 'Quick add expense' }).click()
  await expect(page.getByRole('dialog', { name: 'Add Expense' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Where should this go?' })).toHaveCount(0)
  await page.getByRole('dialog', { name: 'Add Expense' }).getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Back to Groups / Trips' }).click()
  await expect(page).toHaveURL(/\/spaces$/)

  await page.getByLabel('Name').fill('House Group')
  await page.getByLabel('Type').selectOption('group')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'House Group' })).toBeVisible()
  await expect(page.getByText(/Group · Owner · Open/)).toBeVisible()
  await expect(page.getByText('Close Trip')).toHaveCount(0)
  await expectSectionOrder(page, [
    'space-position',
    'space-recent',
    'space-balances',
    'space-recap',
    'space-manage',
  ])
  await expect(page.getByTestId('space-recap')).toContainText('Group recap')
})

async function expectSectionOrder(page: Page, testIds: string[]): Promise<void> {
  const boxes = await Promise.all(
    testIds.map(async (testId) => {
      const box = await page.getByTestId(testId).boundingBox()
      if (!box) throw new Error(`Expected ${testId} to be visible.`)
      return { testId, y: box.y }
    }),
  )
  for (let index = 1; index < boxes.length; index += 1) {
    expect(
      boxes[index].y,
      `${boxes[index].testId} should follow ${boxes[index - 1].testId}`,
    ).toBeGreaterThan(boxes[index - 1].y)
  }
}
