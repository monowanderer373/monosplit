import { openPendingDirectReview, expectRecordedManualShare, enterQuickAmount, openFriendInvite, openManualPerson, openCreateSpace, openQuickSplit } from './fixtures/quickAdd'
import { expect, test, type Page } from '@playwright/test'
import {
  acceptSpaceInvite,
  closeBrowsers,
  copyInviteUrl,
  createConfirmedAccount,
  serverExpenseCount,
  createSpaceInvite,
  openTripMemberManager,
  returnFromTripMemberManager,
  expectTripMemberRole,
  setTripMemberRole,
  removeTripMember,
  MOBILE_CONTEXT_OPTIONS,
  openAuthenticatedBrowser,
  openPersonDetail,
  waitForSpaceRole,
  type AuthenticatedBrowser,
  type FixtureAccount,
} from './fixtures/localSupabase'

test.describe.configure({ mode: 'serial' })
test.setTimeout(180_000)

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
    await openCreateSpace(owner)
    await owner.getByLabel('Name').fill('Sabah E2E Trip')
    await owner.getByLabel('Type').selectOption('trip')
  await owner.getByRole('checkbox', { name: 'Dates not decided yet', exact: true }).check()
    await owner.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(owner.getByRole('heading', { name: 'Sabah E2E Trip' })).toBeVisible()
    spaceUrl = owner.url()
    const ownerNavigation = owner.getByRole('navigation', { name: 'Primary navigation' })
    await expect(ownerNavigation.getByRole('button', { name: 'Shared' })).toHaveAttribute('aria-current', 'page')
    await expect(owner.getByText('Close Trip')).toHaveCount(0)
    await expect(owner.getByText('Final Statement')).toHaveCount(0)
    await expect(owner.getByRole('tab',{name:'Expenses',exact:true})).toHaveAttribute('aria-selected','true')
    await expect(owner.getByTestId('space-position')).toBeVisible()
    await expect(owner.getByTestId('space-recent')).toBeVisible()
    await expect(owner.getByTestId('space-recap')).toHaveCount(0)
    await expect(owner.getByTestId('space-balances')).toBeHidden()
    await owner.getByRole('button', { name: 'Quick add expense' }).click()
    const inheritedCapture = owner.getByRole('dialog', { name: 'Quick Add' })
    await expect(inheritedCapture).toBeVisible()
    await inheritedCapture.getByRole('button', { name: 'Close Quick Add' }).click()

    const fullAccessInvite = await createSpaceInvite(owner, 'full_access')
    await acceptSpaceInvite(betaBrowser.page, fullAccessInvite)
    await expect(betaBrowser.page.getByRole('button',{name:'Quick add expense',exact:true})).toBeEnabled()
    await expect(betaBrowser.page.getByRole('button', { name: '+ Add expense' })).toHaveCount(0)
    await expect(betaBrowser.page.getByRole('button', { name: 'Copy secure invite' })).toHaveCount(0)

    const viewInvite = await createSpaceInvite(owner, 'view')
    await acceptSpaceInvite(viewerBrowser.page, viewInvite)
    await expect(viewerBrowser.page.getByRole('button',{name:'Quick add expense',exact:true})).toBeDisabled()
    await expect(viewerBrowser.page.getByRole('button', { name: '+ Add expense' })).toHaveCount(0)
    await expect(viewerBrowser.page.getByPlaceholder('Add someone without an account')).toHaveCount(0)
    await expect(viewerBrowser.page.getByRole('button',{name:'Quick add expense',exact:true})).toBeDisabled()

    const guestInvite = await createSpaceInvite(owner, 'view')
    const guestContext = await browser.newContext(MOBILE_CONTEXT_OPTIONS)
    const guestPage = await guestContext.newPage()
    guestBrowser = { context: guestContext, page: guestPage }
    await guestPage.goto(guestInvite)
    await guestPage.getByRole('button', { name: 'Continue as guest' }).click()
    await expect(guestPage).toHaveURL(/\/space\/[0-9a-f-]+$/)
    await expect(guestPage.getByRole('button',{name:'Quick add expense',exact:true})).toBeDisabled()
    await expect(guestPage.getByRole('button', { name: '+ Add expense' })).toHaveCount(0)

    await owner.getByRole('button', { name: 'Refresh' }).first().click()
    await expect(owner.getByText('4 members')).toBeVisible()
    const memberOrigin=await openTripMemberManager(owner)
    await expectTripMemberRole(owner,'Beta','full_access')
    await expectTripMemberRole(owner,'Viewer','view')
    await returnFromTripMemberManager(owner,memberOrigin)
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
    await expect(betaOwn.getByRole('button', { name: 'Edit Exact ferry' })).toBeVisible()
    await expect(alphaExpense.getByRole('button', { name: 'Edit Remainder dinner' })).toHaveCount(0)

    await expectDebt(owner, 'Beta owes You', 'RM 2.50')
    await expectDebt(betaBrowser.page, 'You owe Alpha', 'RM 2.50')
    await expectDebt(viewerBrowser.page, 'You owe Alpha', 'RM 4.50')
    await expectDebt(guestBrowser!.page, 'You owe Alpha', 'RM 3.84')

    await removeTripMember(owner,'Viewer')
    await expect(owner.getByText('3 members')).toBeVisible()
    await viewerBrowser.page.reload()
    await expect(viewerBrowser.page.getByRole('heading', { name: 'This group or trip is unavailable.' })).toBeVisible()

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
    await openFriendInvite(owner)
    const friendInvite = await copyInviteUrl(owner)

    await friend.goto(friendInvite)
    await friend.getByRole('button', { name: 'Accept friend invite' }).click()
    await expect(friend).toHaveURL(/\/friends$/)
    await expect(friend.getByText('Alpha')).toBeVisible()

    await owner.reload()
    const betaCard = owner.getByRole('article').filter({ hasText: 'Beta' })
    await expect(betaCard.getByRole('button', { name: 'Split', exact: true })).toHaveCount(0)
    await expect(betaCard.getByRole('button', { name: 'Balance' })).toHaveCount(0)
    await openPersonDetail(owner, 'Beta')
    await owner.getByRole('button', { name: 'Add Expense', exact: true }).click()
    await saveCapture(owner, 'Direct lunch', '9.99')
    await expect(owner.getByRole('status')).toHaveText('Recorded · waiting for confirmation')

    let pending=await openPendingDirectReview(friend,'Direct lunch')
    await expect(pending.locator('.notification-a-highlight dd')).toHaveText('RM 4.99')
    await friend.goto('/friends');await openPersonDetail(friend, 'Alpha')
    await friend.getByRole('button', { name: 'Settle Up' }).click()
    await expect(friend.getByText('No confirmed amount is outstanding.')).toBeVisible()
    await friend.getByRole('button', { name: 'Back to Friends' }).click()
    await expect(friend).toHaveURL(/\/friends$/)
    pending=await openPendingDirectReview(friend,'Direct lunch')
    await pending.getByRole('button', { name: 'Accept share' }).click()
    await expect(friend.getByTestId('notification-target')).toContainText('already been handled')
    await openFriendBalance(friend, 'Alpha')
    await expectDebt(friend, 'You owe Alpha', 'RM 4.99')

    await owner.goto('/friends')
    await openManualPerson(owner)
    await owner.getByRole('textbox', { name: 'Name', exact: true }).fill('Cash Guest')
    await owner.getByRole('dialog', { name: 'Record someone manually', exact: true }).getByRole('button', { name: 'Add person', exact: true }).click()
    await openPersonDetail(owner, 'Cash Guest')
    await expect(owner.getByRole('button', { name: 'Settle Up' })).toBeDisabled()
    await owner.getByRole('button', { name: 'Add Expense', exact: true }).click()
    await saveCapture(owner, 'Cash taxi', '8.00')

    await expectRecordedManualShare(owner, 'Cash taxi', 'Cash Guest', '4.00')
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
    await expect(debtor.getByLabel('Payment amount for Alpha')).toHaveCount(0)
    await expect(debtor.getByRole('button', { name: 'Propose paid' })).toBeDisabled()
    await debtor.getByRole('button', { name: 'Partial', exact: true }).click()
    await debtor.getByLabel('Payment amount for Alpha').fill('2.00')
    await debtor.getByRole('button', { name: 'Propose RM 2.00 paid' }).click()
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
    const quickAdd = owner.getByRole('dialog', { name: 'Quick Add' })
    await expect(quickAdd).toBeVisible()
    await alphaBrowser.context.setOffline(true)
    await enterQuickAmount(quickAdd, '7.77')
    await quickAdd.getByRole('textbox', { name: 'Note', exact: true }).fill('Offline once')
    await quickAdd.getByRole('button', { name: 'Food', exact: true }).click()
    await quickAdd.getByRole('button', { name: 'Save and close' }).click()
    await expect(owner.getByRole('status')).toHaveText('Saved on this device · pending sync')
    const offlineExpense = owner.getByRole('article').filter({ hasText: 'Offline once' })
    await expect(
      offlineExpense.getByText('Pending locally · Not yet synced', { exact: true }),
    ).toBeVisible()

    await alphaBrowser.context.setOffline(false)
    await expect(
      offlineExpense.getByText('Pending locally · Not yet synced', { exact: true }),
    ).toHaveCount(0)
    await owner.reload()
    await expect(owner.getByRole('article').filter({ hasText: 'Offline once' })).toHaveCount(1)

    await member.goto(spaceUrl)
    await member.getByRole('button', { name: 'Quick add expense',exact:true }).click()
    const staleDialog = member.getByRole('dialog', { name: 'Quick Add' })
    await enterQuickAmount(staleDialog, '3.33')
    await staleDialog.getByRole('textbox', { name: 'Note', exact: true }).fill('Rejected stale role')

    await owner.goto(spaceUrl)
    await setTripMemberRole(owner,'Beta','view')
    const spaceId = new URL(spaceUrl).pathname.split('/').at(-1)
    if (!spaceId) throw new Error('Could not resolve the local Space id.')
    await waitForSpaceRole(beta, spaceId, 'view')

    await staleDialog.getByRole('button', { name: 'Food', exact: true }).click()
    await staleDialog.getByRole('button', { name: 'Save and close' }).click()
    // Revalidation now rejects a known downgrade before enqueue; retain every draft value.
    await expect(staleDialog.getByRole('alert')).toBeVisible()
    await expect(staleDialog.getByRole('textbox',{name:'Amount',exact:true})).toHaveValue('3.33')
    await expect(staleDialog.getByRole('textbox',{name:'Note',exact:true})).toHaveValue('Rejected stale role')
    expect(await serverExpenseCount(beta,'Rejected stale role')).toBe(0)

    // Also retain the original server/outbox witness: downgrade after the fresh read,
    // while the real mutation request is in flight, without stubbing its response.
    await setTripMemberRole(owner,'Beta','full_access')
    await waitForSpaceRole(beta,spaceId,'full_access')
    let mutationArrived!:()=>void,releaseMutation!:()=>void
    const arrived=new Promise<void>(resolve=>{mutationArrived=resolve})
    const release=new Promise<void>(resolve=>{releaseMutation=resolve})
    const mutationPattern='**/rest/v1/rpc/create_expense*'
    await member.route(mutationPattern,async route=>{mutationArrived();await release;await route.continue()})
    try{
      await staleDialog.getByRole('button',{name:'Save and close'}).click()
      await arrived
      await setTripMemberRole(owner,'Beta','view')
      await waitForSpaceRole(beta,spaceId,'view')
      releaseMutation()
      const rejected = member.getByRole('article').filter({ hasText: 'Rejected stale role' })
      await expect(rejected.getByText('Needs attention')).toBeVisible()
      await expect(rejected.getByRole('button', { name: 'Retry' })).toBeVisible()
      expect(await serverExpenseCount(beta,'Rejected stale role')).toBe(0)
    }finally{releaseMutation();await member.unroute(mutationPattern)}
  })

    await test.step('observe an authorized expense through Realtime in another context', async () => {
    const owner = alphaBrowser.page
    const observer = betaBrowser.page
    await owner.goto(spaceUrl)
    await observer.goto(spaceUrl)
    await expect(observer.getByRole('button',{name:'Quick add expense',exact:true})).toBeDisabled()
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
  await page.getByRole('button', { name: 'Quick add expense',exact:true }).click()
  const dialog = page.getByRole('dialog', { name: 'Quick Add' })
  await enterQuickAmount(dialog, input.amount)
  await dialog.getByRole('textbox', { name: 'Note', exact: true }).fill(input.description)

  {
    const split = await openQuickSplit(dialog, page)
    // These financial regression witnesses intentionally consume as all members; new Trip defaults are self-only.
    const selectAll=split.getByRole('button',{name:'Select all',exact:true})
    await selectAll.click()
    if(input.description==='Remainder dinner')await expect(split.getByRole('checkbox').and(split.locator(':checked'))).toHaveCount(4)
    if(input.description==='Remainder dinner')await expect(split.locator('.qa-split-person').filter({has:page.getByRole('checkbox',{name:'You',exact:true})})).toContainText('RM 2.51')
    if (input.exactShares) {
      await split.getByRole('button', { name: 'Amounts', exact: true }).click()
      for (const [name, amount] of Object.entries(input.exactShares)) {
        const input = name === 'You'
          ? split.locator('.qa-split-person').filter({ has: page.getByRole('checkbox', { name: 'You', exact: true }) }).getByRole('textbox')
          : split.getByRole('textbox', { name: `Share for ${name}`, exact: true })
        await input.fill(amount)
      }
    }
    if (input.payers) {
      await split.getByRole('button', { name: /^Paid by You/ }).click()
      for (const [name, amount] of Object.entries(input.payers)) {
        const input = name === 'You'
          ? split.locator('.qa-stack label').filter({ hasText: /^You$/ }).getByRole('textbox')
          : split.getByRole('textbox', { name: `Paid by ${name}`, exact: true })
        await input.fill(amount)
      }
    }
    await split.getByRole('button', { name: 'Apply split', exact: true }).click()
    await expect(split).toHaveCount(0)
  }

  await dialog.getByRole('button', { name: 'Food', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save and close' }).click()
  await expect(dialog).toHaveCount(0)
  if(await page.getByTestId('trip-ledger').count())await page.getByRole('tab',{name:'Expenses',exact:true}).click()
  await expect(page.getByText(input.description)).toBeVisible()
}

async function saveCapture(page: Page, description: string, amount: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Quick Add' })
  await enterQuickAmount(dialog, amount)
  await dialog.getByRole('textbox', { name: 'Note', exact: true }).fill(description)
  await dialog.getByRole('button', { name: 'Food', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save and close' }).click()
  await expect(dialog).toHaveCount(0)
}

async function expectShare(page: Page, description: string, amount: string): Promise<void> {
  if(await page.getByTestId('trip-ledger').count())await page.getByRole('tab',{name:'Expenses',exact:true}).click()
  const expense = page.getByRole('article').filter({ hasText: description })
  await expect(expense).toContainText(`Your share ${amount}`)
}

async function expectDebt(page: Page, label: string, amount: string): Promise<void> {
  if(await page.getByTestId('trip-ledger').count())await page.getByRole('tab',{name:'Balances',exact:true}).click()
  const debt = page.getByRole('article').filter({ hasText: label })
  await expect(debt.getByText(amount, { exact: true })).toBeVisible()
}

async function openFriendBalance(page: Page, friendName: string): Promise<void> {
  if (!/\/friends/.test(page.url())) await page.goto('/friends')
  await openPersonDetail(page, friendName)
  await page.getByRole('button', { name: 'Settle Up' }).click()
  await expect(page.getByRole('heading', { name: 'Settle up' })).toBeVisible()
}
