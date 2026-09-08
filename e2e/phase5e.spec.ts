import { expect, test, type Page } from '@playwright/test'
import {
  acceptSpaceInvite,
  closeBrowsers,
  copyInviteUrl,
  createConfirmedAccount,
  createSpaceInvite,
  openAuthenticatedBrowser,
  openPersonDetail,
  type AuthenticatedBrowser,
  type FixtureAccount,
} from './fixtures/localSupabase'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test.describe('Phase 5E audit and history presentation', () => {
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
      createConfirmedAccount('phase5e-alpha', 'Alpha', runId),
      createConfirmedAccount('phase5e-beta', 'Beta', runId),
      createConfirmedAccount('phase5e-gamma', 'Gamma', runId),
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

  test('presents authoritative chains separately from proposal outcomes', async () => {
    const owner = alphaBrowser.page
    const approver = betaBrowser.page

    await createDirectExpense(owner, 'Beta', 'Audit chain dinner', '100.00')
    await answerOrdinaryDirect(approver, 'Audit chain dinner', 'Accept share')

    await proposeCorrection(owner, 'Audit chain dinner', '80.00')
    const pending = changeCard(owner, 'Audit chain dinner', 'RM 80.00')
    await expect(pending.getByText('Correction proposed', { exact: true })).toBeVisible()
    await expect(pending.getByText('Current balance still uses RM 100.00.')).toBeVisible()
    await expect(owner.getByText('Corrected by Audit chain dinner')).toHaveCount(0)

    await approver.goto('/friends')
    await changeCard(approver, 'Audit chain dinner', 'RM 80.00')
      .getByRole('button', { name: 'Accept correction' })
      .click()

    await owner.goto('/')
    let history = owner.getByTestId('expense-history')
    await expect(history.getByText('Original expense', { exact: true })).toBeVisible()
    await expect(history.getByText('Corrected by Audit chain dinner')).toBeVisible()
    await expect(history.getByText('Current version', { exact: true })).toBeVisible()
    await expect(history.getByText('Correction of Audit chain dinner')).toBeVisible()
    const activity = owner.getByTestId('financial-activity')
    await expect(activity.getByText('Correction approved', { exact: true })).toBeVisible()
    await expect(activity.getByText('Correction approval accepted', { exact: true }))
      .toHaveCount(0)

    await proposeCorrection(owner, 'Audit chain dinner', '70.00')
    await approver.goto('/friends')
    await changeCard(approver, 'Audit chain dinner', 'RM 70.00')
      .getByRole('button', { name: 'Accept correction' })
      .click()

    await owner.goto('/')
    history = owner.getByTestId('expense-history')
    await expect(history.getByText('Original expense', { exact: true })).toHaveCount(1)
    await expect(history.getByText('Corrected expense', { exact: true })).toHaveCount(1)
    await expect(history.getByText('Current version', { exact: true })).toHaveCount(1)
    await expect(history.getByText('Corrected by Audit chain dinner')).toHaveCount(2)
    await expect(history.getByText('This expense was replaced by a corrected version.'))
      .toHaveCount(2)

    await createDirectExpense(owner, 'Beta', 'Declined audit dinner', '60.00')
    await answerOrdinaryDirect(approver, 'Declined audit dinner', 'Accept share')
    await proposeCorrection(owner, 'Declined audit dinner', '50.00')
    await approver.goto('/friends')
    const declined = changeCard(approver, 'Declined audit dinner', 'RM 50.00')
    await declined.getByRole('button', { name: 'Decline correction' }).click()
    await expect(declined.getByText('Correction declined', { exact: true })).toBeVisible()
    await expect(declined.getByText('Original expense remained unchanged.')).toBeVisible()

    await createDirectExpense(owner, 'Beta', 'Withdrawn audit dinner', '40.00')
    await answerOrdinaryDirect(approver, 'Withdrawn audit dinner', 'Accept share')
    await proposeCorrection(owner, 'Withdrawn audit dinner', '30.00')
    const withdrawn = changeCard(owner, 'Withdrawn audit dinner', 'RM 30.00')
    await withdrawn.getByRole('button', { name: 'Withdraw correction' }).click()
    await expect(withdrawn.getByText('Correction withdrawn', { exact: true })).toBeVisible()
    await expect(withdrawn.getByText(
      'Original expense remained unchanged. Create a new request to try again.',
    )).toBeVisible()

    await createDirectExpense(owner, 'Beta', 'Cancellation audit dinner', '20.00')
    await answerOrdinaryDirect(approver, 'Cancellation audit dinner', 'Accept share')
    await owner.goto('/')
    await requestCancellation(owner, 'Cancellation audit dinner')
    const requested = owner.getByRole('article').filter({
      hasText: 'Cancellation audit dinner',
    }).filter({ hasText: 'Cancellation requested' })
    await expect(requested.getByText(
      'This expense remains active until all required participants approve the cancellation.',
    )).toBeVisible()
    await approver.goto('/friends')
    const cancellation = approver.getByRole('article').filter({
      hasText: 'Cancellation audit dinner',
    }).filter({ hasText: 'Financial change request' })
    await expect(cancellation.getByText('Cancellation requested', { exact: true })).toBeVisible()
    await cancellation.getByRole('button', { name: 'Decline cancellation' }).click()
    await expect(cancellation.getByText('Cancellation declined', { exact: true })).toBeVisible()
    await expect(cancellation.getByText('Expense remained active.')).toBeVisible()
  })

  test('keeps settlement facts immutable and derives current credit', async () => {
    const owner = alphaBrowser.page
    const debtor = gammaBrowser.page

    await createDirectExpense(owner, 'Gamma', 'Residual audit dinner', '200.00')
    await answerOrdinaryDirect(debtor, 'Residual audit dinner', 'Accept share')
    await openFriendBalance(debtor, 'Alpha')
    await expectDebt(debtor, 'You owe Alpha', 'RM 100.00')
    await debtor.getByRole('button', { name: 'Full', exact: true }).click()
    await debtor.getByRole('button', { name: 'Propose RM 100.00 paid' }).click()

    await openFriendBalance(owner, 'Gamma')
    const receipt = owner.getByRole('article').filter({
      hasText: 'Gamma says they paid you RM 100.00',
    })
    await receipt.getByRole('button', { name: 'Confirm received' }).click()

    await proposeCorrection(owner, 'Residual audit dinner', '160.00')
    await debtor.goto('/friends')
    await changeCard(debtor, 'Residual audit dinner', 'RM 160.00')
      .getByRole('button', { name: 'Accept correction' })
      .click()

    await openFriendBalance(owner, 'Gamma')
    let settlementHistory = owner.getByTestId('settlement-history')
    await expect(settlementHistory.getByText('Settlement accepted', { exact: true })).toBeVisible()
    await expect(settlementHistory.getByText('RM 100.00', { exact: true })).toBeVisible()
    await expect(settlementHistory.getByText('Currently applied: RM 80.00')).toBeVisible()
    await expect(settlementHistory.getByText('Current credit: RM 20.00')).toBeVisible()
    await expectDebt(owner, 'You owe Gamma', 'RM 20.00')

    await owner.getByRole('button', { name: 'Reverse RM 100.00' }).press('Enter')
    settlementHistory = owner.getByTestId('settlement-history')
    await expect(settlementHistory.getByText('Settlement accepted', { exact: true })).toBeVisible()
    await expect(settlementHistory.getByText('Later reversed', { exact: true })).toBeVisible()
    await expect(settlementHistory.getByText('RM 100.00', { exact: true })).toHaveCount(2)
    await expectDebt(owner, 'Gamma owes You', 'RM 80.00')
  })

  test('shows accepted settlement activity in a Group', async () => {
    const owner = alphaBrowser.page
    const debtor = gammaBrowser.page
    await owner.goto('/spaces')
    await owner.getByLabel('Name').fill('Audit Group')
    await owner.getByLabel('Type').selectOption('group')
    await owner.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(owner.getByRole('heading', { name: 'Audit Group' })).toBeVisible()
    const groupUrl = owner.url()
    const inviteUrl = await createSpaceInvite(owner, 'full_access')
    await acceptSpaceInvite(debtor, inviteUrl)
    await owner.goto(groupUrl)
    await owner.getByRole('button', { name: '+ Add expense' }).press('Enter')
    const dialog = owner.getByRole('dialog', { name: 'Add Expense' })
    await dialog.getByRole('textbox', { name: /^Amount/ }).fill('20.00')
    await dialog.getByPlaceholder('What was this for?').fill('Group audit lunch')
    await dialog.getByRole('button', { name: 'Save expense' }).click()
    await expect(dialog).toHaveCount(0)

    await debtor.goto(groupUrl)
    await expectDebt(debtor, 'You owe Alpha', 'RM 10.00')
    await debtor.getByRole('button', { name: 'Full', exact: true }).click()
    await debtor.getByRole('button', { name: 'Propose RM 10.00 paid' }).click()
    await owner.goto(groupUrl)
    const groupReceipt = owner.getByRole('article').filter({
      hasText: 'Gamma says they paid you RM 10.00',
    })
    await groupReceipt.getByRole('button', { name: 'Confirm received' }).click()
    await expect(owner.getByTestId('space-activity').getByText(
      'Settlement accepted',
      { exact: true },
    )).toBeVisible()
  })
})

async function connectFriends(owner: Page, invitee: Page): Promise<void> {
  await owner.goto('/friends')
  await owner.getByRole('button', { name: 'Copy friend invite' }).click()
  await expect(owner.getByText('Invite copied', { exact: true })).toBeVisible()
  await invitee.goto(await copyInviteUrl(owner))
  await invitee.getByRole('button', { name: 'Accept friend invite' }).click()
  await expect(invitee).toHaveURL(/\/friends$/)
  await owner.reload()
}

async function createDirectExpense(
  owner: Page,
  personName: string,
  description: string,
  amount: string,
): Promise<void> {
  await owner.goto('/friends')
  await openPersonDetail(owner, personName)
  await owner.getByRole('button', { name: 'Add Expense', exact: true }).click()
  const dialog = owner.getByRole('dialog', { name: 'Add Expense' })
  await dialog.getByRole('textbox', { name: /^Amount/ }).fill(amount)
  await dialog.getByPlaceholder('What was this for?').fill(description)
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
  const stale = await staleMessage.waitFor({ state: 'visible', timeout: 1_500 })
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
  await dialog.getByRole('button', { name: 'Propose correction' }).click()
  await expect(dialog).toHaveCount(0)
}

async function requestCancellation(owner: Page, description: string): Promise<void> {
  await owner.getByRole('button', { name: `Actions for ${description}` }).click()
  const dialog = owner.getByRole('dialog', { name: description })
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
  await page.goto('/friends')
  await openPersonDetail(page, friendName)
  await page.getByRole('button', { name: 'Settle Up' }).click()
  await expect(page.getByRole('heading', { name: 'Settle up' })).toBeVisible()
}

async function expectDebt(page: Page, label: string, amount: string): Promise<void> {
  const debt = page.getByRole('article').filter({ hasText: label })
  await expect(debt.getByText(amount, { exact: true })).toBeVisible()
}
