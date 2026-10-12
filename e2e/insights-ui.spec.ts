import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { spendingExpense } from '../src/test/spendingFixtures'
import type { CanonicalExpense } from '../src/types'

/** API-intercepted UI contract tests. These are not claims of real database/RLS validation. */
function apiExpense(expense: CanonicalExpense) {
  return { id: expense.id, client_request_id: expense.clientRequestId, scope: expense.scope, space_id: expense.spaceId, created_by: expense.createdBy, total_minor: expense.totalMinor, participant_count: expense.participantCount, currency: expense.currency, description: expense.description, category: expense.category, occurred_on: expense.occurredOn, status: expense.status, version: expense.version, corrects_expense_id: expense.correctsExpenseId, termination_kind: expense.terminationKind, voided_at: expense.voidedAt, created_at: expense.createdAt, updated_at: expense.updatedAt,
    participations: expense.participations.map(item => ({ id: item.id, expense_id: item.expenseId, participant_id: item.participantId, name_snapshot: item.nameSnapshot, participant_order: item.order, state: item.state, tracking_mode: item.trackingMode })),
    payer_contributions: expense.payerContributions.map(item => ({ expense_id: item.expenseId, expense_participation_id: item.expenseParticipationId, amount_minor: item.amountMinor })),
    expense_shares: expense.shares.map(item => ({ expense_id: item.expenseId, expense_participation_id: item.expenseParticipationId, amount_minor: item.amountMinor })) }
}
const fixtures = [spendingExpense('lunch', 7200, 'direct', { description: 'Lunch with friends' }), spendingExpense('coffee', 1200, 'personal', { description: 'Morning coffee', category: 'Drinks' }), spendingExpense('groceries', 3800, 'personal', { description: 'Groceries', category: 'Groceries', occurredOn: '2026-10-01' }), spendingExpense('train', 3000, 'space', { description: 'Train share', category: 'Transportation', occurredOn: '2026-10-01' })]
async function setup(page: Page, records = fixtures, status = 200, hidden = false, lang = 'en') {
  await page.addInitScript(({ hidden, lang }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const access_token = [btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), btoa(JSON.stringify({ sub: 'ui-contract-user', exp })), 'test-only'].join('.')
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token, refresh_token: 'test-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: 'ui-contract-user', aud: 'authenticated', role: 'authenticated', email: 'ui-contract@example.test', user_metadata: {}, is_anonymous: false } }))
    localStorage.setItem('monosplit-storage', JSON.stringify({ version: 6, state: { lang, themeId: 'solid-vintage', homeUi: { balanceHidden: hidden, mode: 'daily', density: 'detailed', selectedAccountId: 'all', selectedTripId: null }, ledgerByIdentity: {} } }))
  }, { hidden, lang })
  await page.route('http://127.0.0.1:54321/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.includes('/user_profiles')) return route.fulfill({ json: { display_name: 'UI contract tester', default_currency: 'MYR', timezone: 'Asia/Kuala_Lumpur' } })
    if (path.includes('/participants')) return route.fulfill({ json: { id: 'you' } })
    if (path.endsWith('/expenses')) return route.fulfill({ status, json: status === 200 ? records.map(apiExpense) : { code: 'test_error', message: 'Test read failure' } })
    return route.fulfill({ json: [] })
  })
}
async function capture(page: Page, name: string) {
  await mkdir('test-results/insights-ui', { recursive: true })
  await page.screenshot({ path: `test-results/insights-ui/${name}.png`, fullPage: true, animations: 'disabled' })
  const geometry = await page.locator('.tt-insights').first().evaluate(root => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, controls: [...root.querySelectorAll('button,a')].map(el => { const box = el.getBoundingClientRect(); return { text: el.textContent, width: box.width, height: box.height } }) }))
  await writeFile(`test-results/insights-ui/${name}.json`, JSON.stringify(geometry, null, 2))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1)
  for (const control of geometry.controls) expect(control.height).toBeGreaterThanOrEqual(44)
}
for (const width of [320, 360, 390, 430, 1024]) test(`paper Insights / records and anchored popovers at ${width}px (intercepted API)`, async ({ page }) => {
  await setup(page); await page.setViewportSize({ width, height: 844 })
  await page.goto('/insights?month=2026-10&currency=MYR')
  await expect(page.getByTestId('spending-total')).toContainText('101.00')
  await expect(page.getByText('4 records', { exact: true })).toBeVisible()
  await capture(page, `categories-${width}`)
  for (const kind of ['Month: Oct 2026', 'Scope: All spending', 'Currency: MYR']) {
    const anchor = page.getByRole('button', { name: kind, exact: true }); await anchor.click()
    const popup = page.getByRole('dialog'); await expect(popup).toBeVisible()
    const box = await popup.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(15); expect(box!.x + box!.width).toBeLessThanOrEqual(width - 15); expect(box!.height).toBeLessThan(450)
    await capture(page, `${kind.split(':')[0].toLowerCase()}-${width}`)
    await page.keyboard.press('Escape'); await expect(popup).toHaveCount(0); await expect(anchor).toBeFocused()
  }
  await page.getByRole('tab', { name: 'Trend', exact: true }).click(); await capture(page, `trend-${width}`)
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click(); await capture(page, `ranking-${width}`)
  await page.getByRole('link', { name: 'View records' }).click()
  await expect(page.getByRole('heading', { name: 'Spending records' })).toBeVisible()
  await expect(page.getByTestId('spending-total')).toContainText('101.00')
  await expect(page.locator('.paper-bottom-nav')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Quick add expense', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit Lunch with friends' })).toContainText('36.00')
  await expect(page.getByRole('button', { name: 'Edit Lunch with friends' })).toContainText('72.00')
  await capture(page, `records-${width}`)
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Ranking' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Month: Oct 2026' })).toBeVisible()
})
test('draft years, keyboard commit, exclusive popovers and original record editor (intercepted API)', async ({ page }) => {
  await setup(page); await page.goto('/insights?month=2026-10&currency=MYR')
  const month = page.getByRole('button', { name: 'Month: Oct 2026' })
  await month.click(); await page.getByRole('button', { name: 'Previous year' }).click()
  await expect(month).toContainText('Oct 2026'); await expect(page.getByTestId('spending-total')).toContainText('101.00')
  await page.getByRole('button', { name: 'Choose year: 2025' }).click(); await page.getByRole('button', { name: '2026', exact: true }).click()
  await page.getByRole('button', { name: 'October 2026' }).focus(); await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('button', { name: 'September 2026' })).toBeFocused()
  await page.keyboard.press('Enter'); await expect(page.getByText('No spending recorded')).toBeVisible()
  await page.getByRole('button', { name: /^Month: Sept? 2026$/ }).click(); await page.getByRole('button', { name: 'October 2026' }).click()
  await page.getByRole('button', { name: 'Month: Oct 2026' }).click(); await page.getByRole('button', { name: 'Currency: MYR' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1); await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', 'Currency')
  await page.getByRole('heading', { name: 'Insights', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('link', { name: 'View records' }).click(); await page.getByRole('button', { name: 'Edit Morning coffee' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit record' })).toBeVisible(); await expect(page.getByRole('textbox', { name: 'Total amount' })).toHaveValue('12.00')
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Edit Morning coffee' })).toBeFocused()
})
test('200% text, long records/currencies and Chinese remain usable (intercepted API)', async ({ page }) => {
  const records = [spendingExpense('long', 98765432100, 'direct', { description: 'A deliberately long shared record name that remains readable without covering amounts', currency: 'JPY' }), ...fixtures]
  await setup(page, records, 200, false, 'zh'); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/insights?month=2026-10&currency=JPY')
  await expect(page.getByTestId('spending-total')).toBeVisible(); await page.addStyleTag({ content: 'html { font-size:200% !important; }' })
  await capture(page, 'text-200-zh')
  await page.getByRole('button', { name: '币种: JPY' }).click(); await capture(page, 'currency-200-zh'); await page.keyboard.press('Escape')
  await page.getByRole('link', { name: '查看记录' }).click(); await capture(page, 'records-200-zh')
})
test('read error is distinct from zero and concealed amounts stay hidden (intercepted API)', async ({ page, context }) => {
  await setup(page, fixtures, 500); await page.goto('/insights?month=2026-10&currency=MYR')
  await expect(page.getByRole('alert')).toContainText('Could not verify'); await expect(page.getByTestId('spending-total')).toHaveCount(0); await capture(page, 'error')
  const empty = await context.newPage(); await setup(empty, []); await empty.goto('/insights?month=2026-10&currency=MYR'); await expect(empty.getByText('No spending recorded')).toBeVisible(); await capture(empty, 'empty'); await empty.close()
  const advance=spendingExpense('zero-share',2400,'direct'); advance.shares[0].amountMinor=0; advance.shares[1].amountMinor=2400
  const zero=await context.newPage(); await setup(zero,[advance]); await zero.goto('/insights?month=2026-10&currency=MYR'); await expect(zero.getByText('Your share is zero',{exact:true})).toBeVisible(); await expect(zero.getByText('1 record',{exact:true})).toBeVisible(); await capture(zero,'zero-share'); await zero.close()
  const hidden = await context.newPage(); await setup(hidden, fixtures, 200, true); await hidden.goto('/insights?month=2026-10&currency=MYR'); await expect(hidden.getByTestId('spending-total')).toContainText('••••'); await hidden.getByRole('link', { name: 'View records' }).click(); await expect(hidden.locator('main')).not.toContainText('72.00'); await capture(hidden, 'concealed'); await hidden.close()
})
test('Insights history restores scroll and Records retains loaded rows through the editor (intercepted API)', async ({ page }) => {
  const records = Array.from({ length: 85 }, (_, index) => spendingExpense(`scroll-${String(index).padStart(3, '0')}`, 100, 'personal', { description: `Scroll record ${index}` }))
  await setup(page, records); await page.setViewportSize({ width: 390, height: 600 }); await page.goto('/insights?month=2026-10&currency=MYR&tab=trend')
  await expect(page.getByTestId('spending-total')).toContainText('85.00')
  await page.evaluate(() => scrollTo(0, 180)); await expect.poll(() => page.evaluate(() => scrollY)).toBe(180)
  await page.getByRole('link', { name: 'View records' }).click()
  await expect(page.locator('button.i-record-row')).toHaveCount(40)
  await page.getByRole('button', { name: 'Load more records' }).click(); await expect(page.locator('button.i-record-row')).toHaveCount(80)
  await page.getByRole('button', { name: 'Edit Scroll record 60', exact: true }).click()
  const before = await page.evaluate(() => scrollY)
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('button.i-record-row')).toHaveCount(80)
  expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThan(2)
  await page.goBack(); await expect(page.getByRole('tab', { name: 'Trend' })).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(180)
})
