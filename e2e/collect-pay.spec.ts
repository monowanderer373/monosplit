import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'
import { closeBrowsers, createConfirmedAccount, openAuthenticatedBrowser, type FixtureAccount } from './fixtures/localSupabase'

// These fixtures use real existing RPCs on the disposable local stack only.
const url = 'http://127.0.0.1:54321'
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function session(account: FixtureAccount) {
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password })
  if (error) throw new Error('local_fixture_signin_failed')
  return client
}
async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}
async function shot(page: Page, name: string) {
  await mkdir('test-results/collect-pay', { recursive: true })
  await page.screenshot({ path: `test-results/collect-pay/${name}.png`, fullPage: true })
}
async function amount(page: Page, expected: string) { await expect(page.locator('.cp-summary .cp-total')).toContainText(expected) }

for (const scenario of [{ initial: 4800, partial: '20', after: '28.00' }, { initial: 500, partial: null, after: '0.00' }]) {
  test(`real direct cash confirmation: ${scenario.initial} -> ${scenario.after}`, async ({ browser }, testInfo) => {
    test.setTimeout(120_000)
    const runId = `${Date.now()}-${testInfo.parallelIndex}-${scenario.initial}`
    const debtor = await createConfirmedAccount(`cp-debtor`, 'CP Payer', runId)
    const creditor = await createConfirmedAccount(`cp-creditor`, 'CP Receiver', runId)
    const debtorClient = await session(debtor), creditorClient = await session(creditor)
    const debtorId = await rpc(debtorClient, 'current_participant_id'), creditorId = await rpc(creditorClient, 'current_participant_id')
    const token = await rpc(creditorClient, 'create_friend_invite'); await rpc(debtorClient, 'accept_friend_invite', { raw_token: token })
    for (const client of [debtorClient, creditorClient]) await rpc(client, 'create_personal_account', {
      request_id: randomUUID(), account_name: 'A real local test wallet with a deliberately long account name', account_type: 'bank',
      currency_code: 'MYR', opening_balance_minor: 10000, balance_as_of: '2026-10-09', make_default: false,
    })
    const expense = await rpc(creditorClient, 'create_expense', { request_id: randomUUID(), expense_scope: 'direct', target_space_id: null,
      total_minor: scenario.initial, currency_code: 'MYR', description: `CP confirmed source ${runId}`, category: 'Food', occurred_on: '2026-10-09',
      participant_ids: [creditorId, debtorId], contribution_amounts: [scenario.initial, 0], share_amounts: [0, scenario.initial] })
    await rpc(debtorClient, 'respond_to_direct_expense', { target_expense_id: expense, response: 'accepted', expected_expense_version: 1 })
    const payer = await openAuthenticatedBrowser(browser, debtor), receiver = await openAuthenticatedBrowser(browser, creditor)
    try {
      await payer.page.goto('/'); await receiver.page.goto('/')
      await shot(payer.page, `pay-home-${scenario.initial}`)
      await payer.page.getByTestId('home-payable').click()
      await shot(payer.page, `pay-list-${scenario.initial}`)
      await payer.page.locator('.cp-item').first().click()
      await amount(payer.page, (scenario.initial / 100).toFixed(2))
      await payer.page.getByRole('button', { name: 'Record repayment', exact: true }).click()
      const form = payer.page.getByTestId('collect-pay-form')
      if (scenario.partial) {
        await form.getByRole('button', { name: 'Partial', exact: true }).click()
        await form.locator('input[inputmode="decimal"]').fill(scenario.partial)
      }
      await form.getByLabel('Paid from').selectOption({ index: 1 })
      await form.getByLabel('Note (optional)').fill('Recorded after payment, not a bank transfer')
      await form.getByRole('button', { name: 'Review this payment' }).click()
      await expect(payer.page.getByTestId('collect-pay-preview')).toContainText(scenario.after)
      await shot(payer.page, `pay-form-${scenario.initial}`)
      await form.getByRole('button', { name: 'Confirm repayment record' }).click()
      await expect(payer.page.locator('.cp-feedback[role="status"]')).toContainText('Awaiting the other person’s confirmation')
      await amount(payer.page, (scenario.initial / 100).toFixed(2))
      await shot(payer.page, `pending-${scenario.initial}`)
      await receiver.page.getByTestId('home-receivable').click()
      await shot(receiver.page, `collect-list-${scenario.initial}`)
      await receiver.page.locator('.cp-item').first().click()
      await receiver.page.getByLabel('Received into').selectOption({ index: 1 })
      await shot(receiver.page, `collect-form-${scenario.initial}`)
      await receiver.page.getByRole('button', { name: 'Confirm received' }).click()
      await expect(receiver.page.locator('.cp-feedback[role="status"]')).toContainText('Payment confirmed')
      await amount(receiver.page, scenario.after)
      await shot(receiver.page, `confirmed-history-${scenario.initial}`)
      await payer.page.getByRole('button', { name: 'Retry', exact: true }).click()
      await amount(payer.page, scenario.after)
      if (scenario.initial === 500) {
        await receiver.page.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(receiver.page.getByText('No confirmed amounts to collect.').first()).toBeVisible()
        await shot(receiver.page, 'empty-collect')
        await receiver.page.getByRole('button', { name: 'History', exact: true }).click()
        await expect(receiver.page.locator('.cp-item')).toHaveCount(1)
      }
      for (const width of [320, 360, 390, 430]) {
        await payer.page.setViewportSize({ width, height: 844 })
        expect(await payer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await shot(payer.page, `history-${scenario.initial}-${width}`)
      }
    } finally { await closeBrowsers([payer, receiver]); await debtorClient.auth.signOut(); await creditorClient.auth.signOut() }
  })
}
