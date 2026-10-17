import { expect, test } from '@playwright/test'
import { setupMulticurrency } from './fixtures/multicurrency'

// Deterministic application contracts; live timings are recorded separately
// using a normal owned QA session, without intercepting production traffic.
test('Home balance and shared summaries do not wait for an unrelated trip read', async ({ page }) => {
  const state = await setupMulticurrency(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let held = false
  await page.route('http://127.0.0.1:54321/**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/personal_expense_affiliations')) {
      held = true
      await gate
    }
    await route.fallback()
  })
  try {
    await page.goto('/')
    await expect.poll(() => held).toBe(true)
    await expect(page.locator('.home-balance-line')).toContainText(/MYR|RM/)
    await expect(page.getByTestId('home-receivable')).toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('home-payable')).toHaveAttribute('data-state', 'ready')
    expect(state.writes).toHaveLength(0)
  } finally { release() }
})

test('Collect/Pay reads only needed accounts and returning Home keeps verified money while rereading', async ({ page }) => {
  const state = await setupMulticurrency(page)
  const cpReads: string[] = []
  let phase = 'home', release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const notNeeded = ['personal_money_movements', 'personal_money_movement_fees', 'personal_account_transactions', 'personal_funding_bundle_legs']
  await page.route('http://127.0.0.1:54321/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!
    if (phase === 'collect') {
      cpReads.push(name)
      if (notNeeded.includes(name)) return route.fulfill({ status: 503, json: { message: 'Unrelated history is unavailable' } })
    }
    if (phase === 'return') await gate
    await route.fallback()
  })
  try {
    await page.goto('/')
    await expect(page.locator('.home-balance-line')).toContainText(/MYR|RM/)
    await expect(page.getByTestId('home-receivable')).toHaveAttribute('data-state', 'ready')
    // Finish the initial notification/account reads before isolating route reads.
    await expect(page.getByTestId('home-account-notice')).toHaveAccessibleName(/2 to do/)
    phase = 'collect'
    await page.getByTestId('home-receivable').click()
    await expect(page.getByTestId('collect-pay-page').locator('.cp-content')).toBeVisible()
    expect(cpReads.filter(name => name === 'expenses')).toHaveLength(1)
    expect(cpReads.filter(name => notNeeded.includes(name))).toEqual([])
    expect(cpReads).toContain('get_personal_multicurrency_accounts')
    phase = 'return'
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'My day', exact: true })).toBeVisible()
    await expect(page.locator('.home-balance-line')).toContainText(/MYR|RM/)
    await expect(page.getByTestId('home-receivable')).toHaveAttribute('data-state', 'ready')
    await expect(page.getByTestId('home-payable')).toHaveAttribute('data-state', 'ready')
    await expect(page.locator('.home-balance-line')).not.toContainText('Loading home')
    expect(state.writes).toHaveLength(0)
  } finally { release() }
})
