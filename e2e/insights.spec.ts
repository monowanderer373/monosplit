import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { createConfirmedAccount, openAuthenticatedBrowser } from './fixtures/localSupabase'
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
test('real local ledger reconciles Insights/records and rejects foreign private expenses', async ({ browser }, info) => {
  test.setTimeout(120_000)
  const run = `${Date.now()}-${info.parallelIndex}`
  const owner = await createConfirmedAccount('insights', 'Insights tester', run)
  const other = await createConfirmedAccount('insights-other', 'Other tester', run)
  const session = async (account: typeof owner) => {
    const client = createClient('http://127.0.0.1:54321', anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password })
    if (error) throw error
    return client
  }
  const client = await session(owner), foreign = await session(other)
  const { data: self, error } = await client.rpc('current_participant_id'); if (error) throw error
  const add = async (amount: number, date: string, currency = 'MYR') => {
    const { data, error } = await client.rpc('create_expense', { request_id: randomUUID(), expense_scope: 'personal', target_space_id: null, total_minor: amount, currency_code: currency, description: `Insights controlled ${amount}`, category: 'Food', occurred_on: date, participant_ids: [self], contribution_amounts: [amount], share_amounts: [amount] })
    if (error) throw error; return data as string
  }
  const id = await add(1200, '2026-10-02'); await add(3800, '2026-10-01'); await add(999, '2026-09-30'); await add(2500, '2026-10-02', 'JPY')
  const rpc = async (target: typeof client, name: string, args: Record<string, unknown> = {}) => { const { data, error } = await target.rpc(name, args); if (error) throw error; return data }
  const otherId = await rpc(foreign, 'current_participant_id')
  const invite = await rpc(client, 'create_friend_invite'); await rpc(foreign, 'accept_friend_invite', { raw_token: invite })
  const shared = await rpc(client, 'create_expense', { request_id: randomUUID(), expense_scope: 'direct', target_space_id: null, total_minor: 7200, currency_code: 'MYR', description: 'Insights controlled shared bill', category: 'Food', occurred_on: '2026-10-02', participant_ids: [self, otherId], contribution_amounts: [7200, 0], share_amounts: [3600, 3600] })
  await rpc(foreign, 'respond_to_direct_expense', { target_expense_id: shared, response: 'accepted', expected_expense_version: 1 })
  const hiddenRead = await foreign.from('expenses').select('id').eq('id', id)
  expect(hiddenRead.error).toBeNull(); expect(hiddenRead.data).toEqual([])
  const actor = await openAuthenticatedBrowser(browser, owner)
  try {
    const page = actor.page; await page.goto('/insights?month=2026-10&scope=all&currency=MYR&tab=trend')
    await expect(page.getByTestId('spending-total')).toContainText('86.00'); await expect(page.getByText('3 records', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Month: Oct 2026' }).click()
    await page.getByRole('button', { name: 'Choose year: 2026' }).click()
    await expect(page.locator('.i-year-range')).toHaveText('2021–2032')
    await page.getByRole('button', { name: '2026', exact: true }).click()
    await page.getByRole('button', { name: 'October 2026' }).click()
    await expect(page.getByTestId('spending-total')).toContainText('86.00')
    await page.getByRole('button', { name: 'Scope: All spending' }).click()
    await page.getByRole('button', { name: 'Shared', exact: true }).click()
    await expect(page.getByTestId('spending-total')).toContainText('36.00')
    await expect(page.getByText('1 record', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Scope: Shared' }).click()
    await page.getByRole('button', { name: 'All spending', exact: true }).click()
    await page.getByRole('link', { name: 'View records' }).click(); await expect(page.getByTestId('spending-total')).toContainText('86.00')
    await expect(page.locator('.i-record-row')).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Edit Insights controlled shared bill' })).toContainText('36.00')
    await expect(page.getByRole('button', { name: 'Edit Insights controlled shared bill' })).toContainText('72.00')
    await expect(page.locator('main')).not.toContainText('999')
    await page.getByRole('button', { name: 'Edit Insights controlled 1200' }).click(); await expect(page.getByRole('dialog', { name: 'Edit record' })).toBeVisible()
    await page.getByRole('button', { name: 'Close', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Insights', exact: true }).click(); await expect(page.getByRole('tab', { name: 'Trend' })).toHaveAttribute('aria-selected', 'true')
    const advance = await rpc(client, 'create_expense', { request_id: randomUUID(), expense_scope: 'direct', target_space_id: null, total_minor: 2400, currency_code: 'MYR', description: 'Insights controlled zero own share', category: 'Food', occurred_on: '2026-08-01', participant_ids: [self, otherId], contribution_amounts: [2400, 0], share_amounts: [0, 2400] })
    await rpc(foreign, 'respond_to_direct_expense', { target_expense_id: advance, response: 'accepted', expected_expense_version: 1 })
    await page.goto('/insights?month=2026-08&currency=MYR')
    await expect(page.getByText('Your share is zero', { exact: true })).toBeVisible()
    await expect(page.getByText('1 record', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'View records' }).click()
    await expect(page.getByRole('button', { name: 'Edit Insights controlled zero own share' })).toContainText('24.00')
    const received = await rpc(foreign, 'create_expense', { request_id: randomUUID(), expense_scope: 'direct', target_space_id: null, total_minor: 2000, currency_code: 'MYR', description: 'Insights controlled received bill', category: 'Food', occurred_on: '2026-07-01', participant_ids: [otherId, self], contribution_amounts: [2000, 0], share_amounts: [1000, 1000] })
    await rpc(client, 'respond_to_direct_expense', { target_expense_id: received, response: 'accepted', expected_expense_version: 1 })
    await page.goto('/insights/records?month=2026-07&currency=MYR')
    await expect(page.getByText('1 record', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'View Insights controlled received bill' }).click()
    await expect(page.getByRole('dialog', { name: 'Record details' })).toContainText('10.00')
    await expect(page.getByRole('dialog')).toContainText('20.00')
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await page.goto('/insights?month=2026-10&currency=MYR')
    await page.getByRole('button', { name: 'Currency: MYR' }).click(); await page.getByRole('button', { name: /JPY/ }).last().click(); await expect(page.getByTestId('spending-total')).toContainText('2,500')
  } finally { await actor.context.close(); await client.auth.signOut(); await foreign.auth.signOut() }
})
