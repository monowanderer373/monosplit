import { expect, test, type Page } from '@playwright/test'
import {
  closeBrowsers,
  copyInviteUrl,
  createConfirmedAccount,
  openAuthenticatedBrowser,
  openPersonDetail,
  type AuthenticatedBrowser,
  type FixtureAccount,
} from './fixtures/localSupabase'

test.describe.configure({ mode: 'serial' })
test.setTimeout(180_000)

test.describe('Phase 5C state-aware expense changes', () => {
  let alpha: FixtureAccount
  let beta: FixtureAccount
  let gamma: FixtureAccount
  let alphaBrowser: AuthenticatedBrowser
  let betaBrowser: AuthenticatedBrowser
  let gammaBrowser: AuthenticatedBrowser

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(180_000)
    const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
    ;[alpha, beta, gamma] = await Promise.all([
      createConfirmedAccount('phase5c-alpha', 'Alpha', runId),
      createConfirmedAccount('phase5c-beta', 'Beta', runId),
      createConfirmedAccount('phase5c-gamma', 'Gamma', runId),
    ])
    ;[alphaBrowser, betaBrowser, gammaBrowser] = await Promise.all([
      openAuthenticatedBrowser(browser, alpha),
      openAuthenticatedBrowser(browser, beta),
      openAuthenticatedBrowser(browser, gamma),
    ])
    await connectFriends(alphaBrowser.page, betaBrowser.page)
    await connectFriends(alphaBrowser.page, gammaBrowser.page)
  })

  test.afterAll(async () => {
    await closeBrowsers([alphaBrowser, betaBrowser, gammaBrowser])
  })

  test('corrects, declines, and cancellation-reverses a settled Direct expense', async () => {
    await createDirectExpense(alphaBrowser.page, 'Beta', 'Correction dinner', '100.00')
    await answerOrdinaryDirect(betaBrowser.page, 'Correction dinner', 'Accept share')

    await proposeCorrection(alphaBrowser.page, 'Correction dinner', '80.00')
    const alphaPending = changeCard(alphaBrowser.page, 'Correction dinner', 'RM 80.00')
    await expect(alphaPending.getByText('Current balance still uses RM 100.00.')).toBeVisible()
    await expect(alphaPending.getByText('0 of 1 approved')).toBeVisible()

    await betaBrowser.page.goto('/friends')
    const betaPending = changeCard(betaBrowser.page, 'Correction dinner', 'RM 80.00')
    await expect(betaPending.getByText('Current expense')).toBeVisible()
    await expect(betaPending.getByText('RM 100.00', { exact: true })).toBeVisible()
    await betaPending.getByRole('button', { name: 'Accept correction' }).click()

    await expect(betaPending.getByText('Current corrected expense · RM 80.00')).toBeVisible()
    await alphaBrowser.page.goto('/')
    await expect(changeCard(alphaBrowser.page, 'Correction dinner', 'RM 80.00')
      .getByText('Original expense · superseded · RM 100.00')).toBeVisible()

    await proposeCorrection(alphaBrowser.page, 'Correction dinner', '70.00')
    await betaBrowser.page.goto('/friends')
    const declined = changeCard(betaBrowser.page, 'Correction dinner', 'RM 70.00')
    await declined.getByRole('button', { name: 'Decline correction' }).click()
    await expect(declined.getByText(
      'Original expense remained unchanged.',
    )).toBeVisible()

    await openFriendBalance(betaBrowser.page, 'Alpha')
    await expectDebt(betaBrowser.page, 'You owe Alpha', 'RM 40.00')
    await betaBrowser.page.getByRole('button', { name: 'Full', exact: true }).click()
    await betaBrowser.page.getByRole('button', { name: 'Propose RM 40.00 paid' }).click()

    await alphaBrowser.page.goto('/friends')
    await openPersonDetail(alphaBrowser.page, 'Beta')
    await alphaBrowser.page.getByRole('button', { name: 'Settle Up' }).click()
    const receipt = alphaBrowser.page.getByRole('article').filter({
      hasText: 'Beta says they paid you RM 40.00',
    })
    await receipt.getByRole('button', { name: 'Confirm received' }).click()
    await expect(alphaBrowser.page.getByText('No confirmed amount is outstanding.')).toBeVisible()

    await alphaBrowser.page.goto('/')
    await requestCancellation(alphaBrowser.page, 'Correction dinner')
    const cancellation = alphaBrowser.page.getByRole('article').filter({
      hasText: 'Cancellation requested',
    })
    await expect(cancellation.getByText(
      'This expense remains active until all required participants approve the cancellation.',
    )).toBeVisible()

    await betaBrowser.page.goto('/friends')
    const betaCancellation = betaBrowser.page.getByRole('article').filter({
      hasText: 'Correction dinner',
    }).filter({ hasText: 'Financial change request' })
    await expect(betaCancellation.getByText('Cancellation requested', { exact: true }))
      .toBeVisible()
    await betaCancellation.getByRole('button', { name: 'Approve cancellation' }).click()
    await expect(betaCancellation.getByText(
      'Cancellation approved — this expense is no longer active.',
    )).toBeVisible()

    await openFriendBalance(betaBrowser.page, 'Alpha')
    await expect(betaBrowser.page.getByText('Alpha owes you RM 40.00')).toBeVisible()
    await openFriendBalance(alphaBrowser.page, 'Beta')
    await expectDebt(alphaBrowser.page, 'You owe Beta', 'RM 40.00')
  })

  test('waits for the final required approval on a multi-account correction', async () => {
    await createDirectExpense(
      alphaBrowser.page,
      'Beta',
      'Multi approval dinner',
      '90.00',
      'Gamma',
    )
    await answerOrdinaryDirect(betaBrowser.page, 'Multi approval dinner', 'Accept share')
    await answerOrdinaryDirect(gammaBrowser.page, 'Multi approval dinner', 'Accept share')

    await proposeCorrection(alphaBrowser.page, 'Multi approval dinner', '60.00')
    await betaBrowser.page.goto('/friends')
    await changeCard(betaBrowser.page, 'Multi approval dinner', 'RM 60.00')
      .getByRole('button', { name: 'Accept correction' })
      .click()

    const ownerPending = changeCard(alphaBrowser.page, 'Multi approval dinner', 'RM 60.00')
    await expect(ownerPending.getByText('1 of 2 approved')).toBeVisible({ timeout: 20_000 })
    await expect(ownerPending.getByText('Current balance still uses RM 90.00.')).toBeVisible()

    await gammaBrowser.page.goto('/friends')
    await changeCard(gammaBrowser.page, 'Multi approval dinner', 'RM 60.00')
      .getByRole('button', { name: 'Accept correction' })
      .click()

    await expect(ownerPending.getByText('Current corrected expense · RM 60.00'))
      .toBeVisible({ timeout: 20_000 })
    await expect(ownerPending.getByText('Original expense · superseded · RM 90.00'))
      .toBeVisible()
  })
})

async function connectFriends(owner: Page, invitee: Page): Promise<void> {
  await owner.goto('/friends')
  await owner.getByRole('button', { name: 'Copy friend invite' }).click()
  await expect(owner.getByText('Invite copied', { exact: true })).toBeVisible()
  const invite = await copyInviteUrl(owner)
  await invitee.goto(invite)
  await invitee.getByRole('button', { name: 'Accept friend invite' }).click()
  await expect(invitee).toHaveURL(/\/friends$/)
  await owner.reload()
}

async function createDirectExpense(
  owner: Page,
  personName: string,
  description: string,
  amount: string,
  extraParticipant?: string,
): Promise<void> {
  await owner.goto('/friends')
  await openPersonDetail(owner, personName)
  await owner.getByRole('button', { name: 'Add Expense', exact: true }).click()
  const dialog = owner.getByRole('dialog', { name: 'Add Expense' })
  await dialog.getByRole('textbox', { name: /^Amount/ }).fill(amount)
  await dialog.getByPlaceholder('What was this for?').fill(description)
  if (extraParticipant) {
    await dialog.getByRole('button', { name: extraParticipant, exact: true }).click()
  }
  await dialog.getByRole('button', { name: 'Save expense' }).click()
  await expect(dialog).toHaveCount(0)
}

async function answerOrdinaryDirect(
  participant: Page,
  description: string,
  action: 'Accept share' | 'Decline',
): Promise<void> {
  await participant.goto('/friends')
  let expense = participant.getByRole('article').filter({ hasText: description })
  await expense.getByRole('button', { name: action, exact: true }).click()
  const staleMessage = participant.getByText(
    'This item changed on another device. Refresh and try again.',
  )
  const stale = await staleMessage
    .waitFor({ state: 'visible', timeout: 1_500 })
    .then(() => true)
    .catch(() => false)
  if (stale) {
    await participant.reload()
    expense = participant.getByRole('article').filter({ hasText: description })
    await expense.getByRole('button', { name: action, exact: true }).click()
  }
  await expect(expense.getByRole('button', { name: action, exact: true })).toHaveCount(0)
}

async function proposeCorrection(
  owner: Page,
  description: string,
  nextAmount: string,
): Promise<void> {
  await owner.goto('/')
  await owner.getByRole('button', { name: `Actions for ${description}` }).click()
  const dialog = owner.getByRole('dialog', { name: description })
  await dialog.getByRole('button', { name: 'Correct expense' }).click()
  await dialog.getByLabel('Total amount').fill(nextAmount)
  await dialog.getByRole('button', { name: 'Review correction' }).click()
  await expect(dialog.getByText(
    'This correction will not affect the balance until everyone required has approved it.',
  )).toBeVisible()
  await dialog.getByRole('button', { name: 'Propose correction' }).click()
  await expect(dialog).toHaveCount(0)
}

async function requestCancellation(owner: Page, description: string): Promise<void> {
  await owner.getByRole('button', { name: `Actions for ${description}` }).click()
  const dialog = owner.getByRole('dialog', { name: description })
  await expect(dialog.getByRole('button', { name: 'Cancel expense' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Request cancellation' }).click()
  await dialog.getByRole('button', { name: 'Send cancellation request' }).click()
  await expect(dialog).toHaveCount(0)
}

function changeCard(page: Page, description: string, proposedAmount: string) {
  return page.getByRole('article')
    .filter({ hasText: 'Financial change request' })
    .filter({ hasText: description })
    .filter({ hasText: proposedAmount })
}

async function openFriendBalance(page: Page, friendName: string): Promise<void> {
  if (!/\/friends/.test(page.url())) await page.goto('/friends')
  await openPersonDetail(page, friendName)
  await page.getByRole('button', { name: 'Settle Up' }).click()
  await expect(page.getByRole('heading', { name: 'Settle up' })).toBeVisible()
}

async function expectDebt(page: Page, label: string, amount: string): Promise<void> {
  const debt = page.getByRole('article').filter({ hasText: label })
  await expect(debt.getByText(amount, { exact: true })).toBeVisible()
}
