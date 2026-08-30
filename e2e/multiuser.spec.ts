import { expect, test, type Page } from '@playwright/test'
import {
  acceptSpaceInvite,
  closeBrowsers,
  copyInviteUrl,
  createConfirmedAccount,
  createSpaceInvite,
  MOBILE_CONTEXT_OPTIONS,
  openAuthenticatedBrowser,
  waitForSpaceRole,
  type AuthenticatedBrowser,
  type FixtureAccount,
} from './fixtures/localSupabase'

test.describe.configure({ mode: 'serial' })
test.setTimeout(90_000)

test.describe('local relational multi-user journey', () => {
  let alpha: FixtureAccount
  let beta: FixtureAccount
  let viewer: FixtureAccount
  let alphaBrowser: AuthenticatedBrowser
  let betaBrowser: AuthenticatedBrowser
  let viewerBrowser: AuthenticatedBrowser
  let guestBrowser: AuthenticatedBrowser | undefined
  let spaceUrl = ''

  const browsers = () => [alphaBrowser, betaBrowser, viewerBrowser, guestBrowser]

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
    ;[alpha, beta, viewer] = await Promise.all([
      createConfirmedAccount('alpha', 'Alpha', runId),
      createConfirmedAccount('beta', 'Beta', runId),
      createConfirmedAccount('viewer', 'Viewer', runId),
    ])
    ;[alphaBrowser, betaBrowser, viewerBrowser] = await Promise.all([
      openAuthenticatedBrowser(browser, alpha),
      openAuthenticatedBrowser(browser, beta),
      openAuthenticatedBrowser(browser, viewer),
    ])
  })

  test.afterAll(async () => {
    await closeBrowsers(browsers())
  })

  test('runs one stateful relational multi-user journey', async ({ browser }) => {
    await test.step('create a Trip and enforce full, view, and guest access', async () => {
    const owner = alphaBrowser.page
    await owner.goto('/spaces')
    await owner.getByLabel('Name').fill('Sabah E2E Trip')
    await owner.getByLabel('Type').selectOption('trip')
    await owner.getByRole('button', { name: 'Create space' }).click()
    await expect(owner.getByRole('heading', { name: 'Sabah E2E Trip' })).toBeVisible()
    spaceUrl = owner.url()

    const fullAccessInvite = await createSpaceInvite(owner, 'full_access')
    await acceptSpaceInvite(betaBrowser.page, fullAccessInvite)
    await expect(betaBrowser.page.getByText('Trip · Full access')).toBeVisible()
    await expect(betaBrowser.page.getByRole('button', { name: '+ Add expense' })).toBeVisible()
    await expect(betaBrowser.page.getByRole('button', { name: 'Copy secure invite' })).toHaveCount(0)

    const viewInvite = await createSpaceInvite(owner, 'view')
    await acceptSpaceInvite(viewerBrowser.page, viewInvite)
    await expect(viewerBrowser.page.getByText('Trip · View only')).toBeVisible()
    await expect(viewerBrowser.page.getByRole('button', { name: '+ Add expense' })).toHaveCount(0)
    await expect(viewerBrowser.page.getByPlaceholder('Add someone without an account')).toHaveCount(0)

    const guestInvite = await createSpaceInvite(owner, 'view')
    const guestContext = await browser.newContext(MOBILE_CONTEXT_OPTIONS)
    const guestPage = await guestContext.newPage()
    guestBrowser = { context: guestContext, page: guestPage }
    await guestPage.goto(guestInvite)
    await guestPage.getByRole('button', { name: 'Continue as guest' }).click()
    await expect(guestPage).toHaveURL(/\/space\/[0-9a-f-]+$/)
    await expect(guestPage.getByText('Trip · View only')).toBeVisible()
    await expect(guestPage.getByRole('button', { name: '+ Add expense' })).toHaveCount(0)

    await owner.getByRole('button', { name: 'Refresh' }).first().click()
    await expect(owner.getByText('4 members')).toBeVisible()
    await expect(owner.getByLabel('Access for Beta')).toHaveValue('full_access')
    await expect(owner.getByLabel('Access for Viewer')).toHaveValue('view')
  })

    await test.step('reconcile remainder and multi-payer expenses across independent ledgers', async () => {
    const owner = alphaBrowser.page
    await addExpense(owner, {
      description: 'Remainder dinner',
      amount: '10.01',
    })

    await refreshSpace(betaBrowser.page)
    await refreshSpace(viewerBrowser.page)
    await refreshSpace(guestBrowser!.page)
    await expectShare(owner, 'Remainder dinner', 'RM 2.51')
    await expectShare(betaBrowser.page, 'Remainder dinner', 'RM 2.50')
    await expectShare(viewerBrowser.page, 'Remainder dinner', 'RM 2.50')
    await expectShare(guestBrowser!.page, 'Remainder dinner', 'RM 2.50')

    await addExpense(betaBrowser.page, {
      description: 'Exact ferry',
      amount: '12.34',
      exactShares: {
        You: '5.00',
        Alpha: '4.00',
        Viewer: '2.00',
        Guest: '1.34',
      },
      payers: {
        You: '5.00',
        Alpha: '7.34',
      },
    })

    await refreshSpace(owner)
    await refreshSpace(viewerBrowser.page)
    await refreshSpace(guestBrowser!.page)
    await expectShare(owner, 'Exact ferry', 'RM 4.00')
    await expectShare(betaBrowser.page, 'Exact ferry', 'RM 5.00')
    await expectShare(viewerBrowser.page, 'Exact ferry', 'RM 2.00')
    await expectShare(guestBrowser!.page, 'Exact ferry', 'RM 1.34')

    const betaOwn = betaBrowser.page.getByRole('article').filter({ hasText: 'Exact ferry' })
    const alphaExpense = betaBrowser.page.getByRole('article').filter({ hasText: 'Remainder dinner' })
    await expect(betaOwn.getByRole('button', { name: 'Void' })).toBeVisible()
    await expect(alphaExpense.getByRole('button', { name: 'Void' })).toHaveCount(0)

    await expectDebt(owner, 'Beta owes You', 'RM 2.50')
    await expectDebt(betaBrowser.page, 'You owe Alpha', 'RM 2.50')
    await expectDebt(viewerBrowser.page, 'You owe Alpha', 'RM 4.50')
    await expectDebt(guestBrowser!.page, 'You owe Alpha', 'RM 3.84')

    await owner.getByRole('button', { name: 'Remove Viewer' }).click()
    await expect(owner.getByText('3 members')).toBeVisible()
    await viewerBrowser.page.reload()
    await expect(viewerBrowser.page.getByRole('heading', { name: 'This space is unavailable.' })).toBeVisible()

    await viewerBrowser.page.goto('/')
    await expect(viewerBrowser.page.getByText('Remainder dinner')).toBeVisible()
    await expect(viewerBrowser.page.getByText('Exact ferry')).toBeVisible()

    await owner.goto(spaceUrl)
    await addExpense(owner, {
      description: 'After removal',
      amount: '3.00',
    })
    await viewerBrowser.page.goto('/')
    await viewerBrowser.page.reload()
    await expect(viewerBrowser.page.getByText('After removal')).toHaveCount(0)
  })

    await test.step('keep direct shares pending and manual shares out of account balances', async () => {
    const owner = alphaBrowser.page
    const friend = betaBrowser.page
    await owner.goto('/friends')
    await owner.getByRole('button', { name: 'Copy friend invite' }).click()
    await expect(owner.getByText('Invite copied', { exact: true })).toBeVisible()
    const friendInvite = await copyInviteUrl(owner)

    await friend.goto(friendInvite)
    await friend.getByRole('button', { name: 'Accept friend invite' }).click()
    await expect(friend).toHaveURL(/\/friends$/)
    await expect(friend.getByText('Alpha')).toBeVisible()

    await owner.reload()
    const betaCard = owner.getByRole('article').filter({ hasText: 'Beta' })
    await betaCard.getByRole('button', { name: 'Split', exact: true }).click()
    await saveCapture(owner, 'Direct lunch', '9.99')

    await friend.reload()
    const pending = friend.getByRole('article').filter({ hasText: 'Direct lunch' })
    await expect(pending.getByText('Your share RM 4.99')).toBeVisible()
    await openFriendBalance(friend, 'Alpha')
    await expect(friend.getByText('No confirmed amount is outstanding.')).toBeVisible()
    await pending.getByRole('button', { name: 'Accept share' }).click()
    await expectDebt(friend, 'You owe Alpha', 'RM 4.99')

    await owner.reload()
    await owner.getByPlaceholder('Person’s name').fill('Cash Guest')
    await owner.getByRole('button', { name: 'Add person' }).click()
    await owner.getByRole('button', { name: 'Split with Cash Guest' }).click()
    await saveCapture(owner, 'Cash taxi', '8.00')

    await owner.goto('/')
    await expect(summaryValue(owner, 'Untracked')).toHaveText('RM 4.00')
    await owner.goto('/friends')
    await openFriendBalance(owner, 'Beta')
    await expectDebt(owner, 'Beta owes You', 'RM 4.99')
    await expect(owner.getByText('RM 8.99')).toHaveCount(0)
  })

    await test.step('confirm and reverse a partial settlement with an audit event', async () => {
    const debtor = betaBrowser.page
    const recipient = alphaBrowser.page

    await debtor.goto('/friends')
    await openFriendBalance(debtor, 'Alpha')
    await expectDebt(debtor, 'You owe Alpha', 'RM 4.99')
    await debtor.getByPlaceholder('Full amount').fill('2.00')
    await debtor.getByRole('button', { name: 'Propose paid' }).click()
    await expectDebt(debtor, 'You owe Alpha', 'RM 4.99')

    await recipient.goto('/friends')
    await openFriendBalance(recipient, 'Beta')
    const confirmation = recipient.getByRole('article').filter({ hasText: 'Beta says they paid you RM 2.00' })
    await expect(confirmation).toBeVisible()
    await confirmation.getByRole('button', { name: 'Confirm received' }).click()
    await expectDebt(recipient, 'Beta owes You', 'RM 2.99')
    await expectDebt(debtor, 'You owe Alpha', 'RM 2.99')

    await recipient.getByRole('button', { name: 'Reverse RM 2.00' }).click()
    await expectDebt(recipient, 'Beta owes You', 'RM 4.99')
    await expect(recipient.getByText('Settlement reversed')).toBeVisible()
  })

    await test.step('reconnect Quick Add once and reject a stale role command', async () => {
    const owner = alphaBrowser.page
    const member = betaBrowser.page

    await owner.goto('/quick-add?source=pwa-shortcut')
    const quickAdd = owner.getByRole('dialog', { name: 'Quick tally' })
    await expect(quickAdd).toBeVisible()
    await alphaBrowser.context.setOffline(true)
    await quickAdd.getByRole('textbox', { name: /^Amount/ }).fill('7.77')
    await quickAdd.getByPlaceholder('What was this for?').fill('Offline once')
    await quickAdd.getByRole('button', { name: 'Save expense' }).click()
    await expect(owner.getByText('Pending sync')).toBeVisible()

    await alphaBrowser.context.setOffline(false)
    await expect(owner.getByText('Pending sync')).toHaveCount(0)
    await owner.reload()
    await expect(owner.getByRole('article').filter({ hasText: 'Offline once' })).toHaveCount(1)

    await member.goto(spaceUrl)
    await member.getByRole('button', { name: '+ Add expense' }).click()
    const staleDialog = member.getByRole('dialog', { name: 'Add Expense' })
    await staleDialog.getByRole('textbox', { name: /^Amount/ }).fill('3.33')
    await staleDialog.getByPlaceholder('What was this for?').fill('Rejected stale role')

    await owner.goto(spaceUrl)
    await owner.getByLabel('Access for Beta').selectOption('view')
    await expect(owner.getByLabel('Access for Beta')).toHaveValue('view')
    const spaceId = new URL(spaceUrl).pathname.split('/').at(-1)
    if (!spaceId) throw new Error('Could not resolve the local Space id.')
    await waitForSpaceRole(beta, spaceId, 'view')

    await staleDialog.getByRole('button', { name: 'Save expense' }).click()
    const rejected = member.getByRole('article').filter({ hasText: 'Rejected stale role' })
    await expect(rejected.getByText('Needs attention')).toBeVisible()
    await expect(rejected.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

    await test.step('observe an authorized expense through Realtime in another context', async () => {
    const owner = alphaBrowser.page
    const observer = betaBrowser.page
    await owner.goto(spaceUrl)
    await observer.goto(spaceUrl)
    await expect(observer.getByText('Trip · View only')).toBeVisible()
    await expect(observer.getByText('Realtime coffee')).toHaveCount(0)

    await addExpense(owner, {
      description: 'Realtime coffee',
      amount: '6.66',
    })

    await expect(observer.getByText('Realtime coffee')).toBeVisible({ timeout: 20_000 })
    await expectShare(observer, 'Realtime coffee', 'RM 2.22')
    })
  })
})

async function refreshSpace(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Refresh' }).first().click()
}

async function addExpense(
  page: Page,
  input: {
    description: string
    amount: string
    exactShares?: Record<string, string>
    payers?: Record<string, string>
  },
): Promise<void> {
  await page.getByRole('button', { name: '+ Add expense' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Expense' })
  await dialog.getByRole('textbox', { name: /^Amount/ }).fill(input.amount)
  await dialog.getByPlaceholder('What was this for?').fill(input.description)

  if (input.exactShares) {
    await dialog.getByLabel('Split').selectOption('exact')
    for (const [name, amount] of Object.entries(input.exactShares)) {
      await dialog.getByLabel(`Share for ${name}`).fill(amount)
    }
  }

  if (input.payers) {
    await dialog.getByRole('button', { name: 'Multiple payers' }).click()
    for (const [name, amount] of Object.entries(input.payers)) {
      await dialog.getByLabel(`Paid by ${name}`).fill(amount)
    }
  }

  await dialog.getByRole('button', { name: 'Save expense' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(input.description)).toBeVisible()
}

async function saveCapture(page: Page, description: string, amount: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Add Expense' })
  await dialog.getByRole('textbox', { name: /^Amount/ }).fill(amount)
  await dialog.getByPlaceholder('What was this for?').fill(description)
  await dialog.getByRole('button', { name: 'Save expense' }).click()
  await expect(dialog).toHaveCount(0)
}

async function expectShare(page: Page, description: string, amount: string): Promise<void> {
  const expense = page.getByRole('article').filter({ hasText: description })
  await expect(expense.getByText(`Your share ${amount}`)).toBeVisible()
}

async function expectDebt(page: Page, label: string, amount: string): Promise<void> {
  const debt = page.getByRole('article').filter({ hasText: label })
  await expect(debt.getByText(amount, { exact: true })).toBeVisible()
}

async function openFriendBalance(page: Page, friendName: string): Promise<void> {
  const card = page.getByRole('article').filter({ hasText: friendName })
  await card.getByRole('button', { name: 'Balance' }).click()
  await expect(page.getByRole('heading', { name: 'Settle up' })).toBeVisible()
}

function summaryValue(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..').locator('p').nth(1)
}
