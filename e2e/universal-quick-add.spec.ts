import { expect, test } from '@playwright/test'
import {
  createConfirmedAccount,
  signIn,
} from './fixtures/localSupabase'

test('keeps entry and in-session picker history semantics distinct', async ({
  page,
}, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount(
    'universal-history',
    'History Tester',
    runId,
  )
  await signIn(page, account)

  await page.goto('/spaces')
  await page.getByLabel('Name').fill('History Trip')
  await page.getByLabel('Type').selectOption('trip')
  await page.getByRole('button', { name: 'Create space' }).click()
  await expect(
    page.getByRole('heading', { name: 'History Trip' }),
  ).toBeVisible()
  const spaceUrl = page.url()

  await page.goto('/friends')
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('button', { name: 'Quick add expense' })
    .click()
  const entryPicker = page.getByRole('dialog', {
    name: 'Where should this go?',
  })
  await entryPicker
    .getByRole('button', { name: 'Personal', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Quick tally' }),
  ).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/friends$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto(spaceUrl)
  await page.getByRole('button', { name: '+ Add expense' }).click()
  const capture = page.getByRole('dialog', { name: 'Add Expense' })
  await capture.getByRole('textbox', { name: /^Amount/ }).fill('120')
  await capture.getByPlaceholder('What was this for?').fill('Dinner')
  await capture
    .getByRole('button', {
      name: 'Current context: History Trip. Change context',
    })
    .click()

  await expect(
    page.getByRole('dialog', { name: 'Move this draft?' }),
  ).toBeVisible()
  await page.goBack()
  await expect(capture).toBeVisible()
  await expect(
    capture.getByRole('textbox', { name: /^Amount/ }),
  ).toHaveValue('120')
  await expect(
    capture.getByPlaceholder('What was this for?'),
  ).toHaveValue('Dinner')
  await capture.getByLabel('Split').selectOption('exact')
  await capture.getByLabel('Share for You').fill('120')

  await capture
    .getByRole('button', {
      name: 'Current context: History Trip. Change context',
    })
    .click()
  const switchPicker = page.getByRole('dialog', { name: 'Move this draft?' })
  await switchPicker
    .getByRole('button', { name: 'Personal', exact: true })
    .click()
  await expect(switchPicker.getByText('Shared details will reset')).toBeVisible()
  await switchPicker
    .getByRole('button', { name: 'Switch context' })
    .click()

  const personalCapture = page.getByRole('dialog', { name: 'Quick tally' })
  await expect(personalCapture).toBeVisible()
  await expect(
    personalCapture.getByRole('textbox', { name: /^Amount/ }),
  ).toHaveValue('120')
  await expect(
    personalCapture.getByPlaceholder('What was this for?'),
  ).toHaveValue('Dinner')
  await page.goBack()
  await expect(page).toHaveURL(spaceUrl)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goForward()
  const forwardCapture = page.getByRole('dialog', { name: 'Quick tally' })
  await expect(forwardCapture).toBeVisible()
  await expect(
    forwardCapture.getByRole('button', {
      name: 'Current context: Personal. Change context',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'Current context: History Trip. Change context',
    }),
  ).toHaveCount(0)
})

test('does not expose an unsaved session after the authenticated identity changes', async ({
  page,
}, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const [accountA, accountB] = await Promise.all([
    createConfirmedAccount('identity-a', 'Identity A', runId),
    createConfirmedAccount('identity-b', 'Identity B', runId),
  ])
  await signIn(page, accountA)

  await page.goto('/')
  const navigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  })
  await navigation
    .getByRole('button', { name: 'Quick add expense' })
    .click()
  const captureA = page.getByRole('dialog', { name: 'Quick tally' })
  await captureA.getByRole('textbox', { name: /^Amount/ }).fill('88')
  await captureA.getByPlaceholder('What was this for?').fill('User A secret')

  await page
    .locator('nav button')
    .filter({ hasText: /^Me$/ })
    .evaluate((button: HTMLButtonElement) => button.click())
  await page.getByRole('button', { name: 'Sign out' }).click()
  await signIn(page, accountB)

  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('button', { name: 'Quick add expense' })
    .click()
  const captureB = page.getByRole('dialog', { name: 'Quick tally' })
  await expect(
    captureB.getByRole('textbox', { name: /^Amount/ }),
  ).toHaveValue('')
  await expect(
    captureB.getByPlaceholder('What was this for?'),
  ).toHaveValue('')
  await expect(captureB.getByText('User A secret')).toHaveCount(0)
})

test('preserves only user-selected categories across context changes', async ({
  page,
}, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount(
    'category-provenance',
    'Category Tester',
    runId,
  )
  await signIn(page, account)

  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('button', { name: 'Quick add expense' })
    .click()
  const personalCapture = page.getByRole('dialog', { name: 'Quick tally' })
  const suggestionArea = personalCapture.getByText('Suggestions').locator('..')
  const firstSuggestion = suggestionArea.getByRole('button').first()
  const suggestedDescription = (await firstSuggestion.textContent())?.trim()
  if (!suggestedDescription) throw new Error('Expected a deterministic suggestion')
  await firstSuggestion.click()
  await personalCapture.getByRole('button', { name: 'More details' }).click()
  await expect(
    personalCapture.locator('label', { hasText: /^Category/ }).locator('select'),
  )
    .toHaveValue('Food')
  await personalCapture.getByRole('textbox', { name: /^Amount/ }).fill('1.00')
  await personalCapture.getByRole('button', { name: 'Save expense' }).click()

  await page.goto('/spaces')
  await page.getByLabel('Name').fill('Category Trip')
  await page.getByLabel('Type').selectOption('trip')
  await page.getByRole('button', { name: 'Create space' }).click()
  await expect(
    page.getByRole('heading', { name: 'Category Trip' }),
  ).toBeVisible()

  await page.getByRole('button', { name: '+ Add expense' }).click()
  const suggestedCapture = page.getByRole('dialog', { name: 'Add Expense' })
  await suggestedCapture
    .getByText('Suggestions')
    .locator('..')
    .getByRole('button', { name: suggestedDescription, exact: true })
    .click()
  await suggestedCapture.getByRole('button', { name: 'More details' }).click()
  await expect(
    suggestedCapture.locator('label', { hasText: /^Category/ }).locator('select'),
  )
    .toHaveValue('Food')
  await suggestedCapture
    .getByRole('button', {
      name: 'Current context: Category Trip. Change context',
    })
    .click()
  await page
    .getByRole('dialog', { name: 'Move this draft?' })
    .getByRole('button', { name: 'Personal', exact: true })
    .first()
    .click()
  const resetCapture = page.getByRole('dialog', { name: 'Quick tally' })
  await expect(
    resetCapture.locator('label', { hasText: /^Category/ }).locator('select'),
  )
    .toHaveValue('Other')
  await resetCapture.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: '+ Add expense' }).click()
  const userCapture = page.getByRole('dialog', { name: 'Add Expense' })
  await userCapture.getByRole('button', { name: 'More details' }).click()
  await userCapture
    .locator('label', { hasText: /^Category/ })
    .locator('select')
    .selectOption('Shopping')
  await userCapture
    .getByPlaceholder('What was this for?')
    .fill(suggestedDescription)
  await expect(
    userCapture.locator('label', { hasText: /^Category/ }).locator('select'),
  )
    .toHaveValue('Shopping')
  await userCapture
    .getByRole('button', {
      name: 'Current context: Category Trip. Change context',
    })
    .click()
  await page
    .getByRole('dialog', { name: 'Move this draft?' })
    .getByRole('button', { name: 'Personal', exact: true })
    .first()
    .click()
  const preservedCapture = page.getByRole('dialog', { name: 'Quick tally' })
  await expect(
    preservedCapture.locator('label', { hasText: /^Category/ }).locator('select'),
  )
    .toHaveValue('Shopping')
})
