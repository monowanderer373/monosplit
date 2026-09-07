import { expect, test } from '@playwright/test'
import {
  closeBrowsers,
  copyInviteUrl,
  createConfirmedAccount,
  openAuthenticatedBrowser,
  signIn,
} from './fixtures/localSupabase'

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

test('keeps the global money action above mobile form controls', async ({
  browser,
}, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const [ownerAccount, targetAccount] = await Promise.all([
    createConfirmedAccount('pointer-owner', 'Pointer Owner', runId),
    createConfirmedAccount('pointer-target', 'Pointer Target', runId),
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
    await target.goto(await copyInviteUrl(owner))
    await target.getByRole('button', { name: 'Accept friend invite' }).click()

    await owner.reload()
    await owner.getByPlaceholder('Person’s name').fill('Pointer Manual')
    await owner.getByRole('button', { name: 'Add person' }).click()

    await owner.getByRole('button', { name: 'Split with Pointer Manual' }).click()
    const capture = owner.getByRole('dialog', { name: 'Add Expense' })
    await capture.getByRole('textbox', { name: /^Amount/ }).fill('1.01')
    await capture.getByPlaceholder('What was this for?').fill('Pointer overlap')
    await capture.getByRole('button', { name: 'Save expense' }).click()
    await expect(owner.getByRole('status')).toContainText('Expense recorded')
    await owner.getByRole('status').click()

    const select = owner.getByLabel('Link Pointer Manual to friend')
    await select.selectOption({ label: 'Pointer Target' })
    await expect(select.locator('option:checked')).toHaveText('Pointer Target')

    const add = owner
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('button', { name: 'Quick add expense' })
    await select.scrollIntoViewIfNeeded()
    const [selectBox, addBox] = await Promise.all([
      select.boundingBox(),
      add.boundingBox(),
    ])
    if (!selectBox || !addBox) throw new Error('Expected mobile control bounds.')
    await owner.evaluate(
      ({ selectCenter, addCenter }) =>
        window.scrollBy(0, selectCenter - addCenter),
      {
        selectCenter: selectBox.y + selectBox.height / 2,
        addCenter: addBox.y + addBox.height / 2,
      },
    )

    await add.click()
    const gate = owner.getByRole('dialog', { name: 'Where should this go?' })
    await expect(gate).toBeVisible()
    await expect(
      gate.getByRole('button', { name: 'Pointer Manual', exact: true }),
    ).toHaveCount(1)
    await gate.getByRole('button', { name: 'Close' }).click()

    await expect(select.locator('option:checked')).toHaveText('Pointer Target')
    await owner
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('button', { name: 'Personal', exact: true })
      .click()
    await expect(owner).toHaveURL(/\/$/)
  } finally {
    await closeBrowsers([ownerBrowser, targetBrowser])
  }
})
