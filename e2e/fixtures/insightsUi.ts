import { expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { spendingExpense } from '../../src/test/spendingFixtures'
import { autoFxSnapshot } from './autoFx'
import type { CanonicalExpense } from '../../src/types'

/** API-intercepted UI contract tests. These are not claims of real database/RLS validation. */
export function apiExpense(expense: CanonicalExpense) {
  return { id: expense.id, client_request_id: expense.clientRequestId, scope: expense.scope, space_id: expense.spaceId, created_by: expense.createdBy, total_minor: expense.totalMinor, participant_count: expense.participantCount, currency: expense.currency, description: expense.description, category: expense.category, occurred_on: expense.occurredOn, status: expense.status, version: expense.version, corrects_expense_id: expense.correctsExpenseId, termination_kind: expense.terminationKind, voided_at: expense.voidedAt, created_at: expense.createdAt, updated_at: expense.updatedAt,
    participations: expense.participations.map(item => ({ id: item.id, expense_id: item.expenseId, participant_id: item.participantId, name_snapshot: item.nameSnapshot, participant_order: item.order, state: item.state, tracking_mode: item.trackingMode })),
    payer_contributions: expense.payerContributions.map(item => ({ expense_id: item.expenseId, expense_participation_id: item.expenseParticipationId, amount_minor: item.amountMinor })),
    expense_shares: expense.shares.map(item => ({ expense_id: item.expenseId, expense_participation_id: item.expenseParticipationId, amount_minor: item.amountMinor })) }
}
export const fixtures = [spendingExpense('lunch', 7200, 'direct', { description: 'Lunch with friends' }), spendingExpense('coffee', 1200, 'personal', { description: 'Morning coffee', category: 'Drinks' }), spendingExpense('groceries', 3800, 'personal', { description: 'Groceries', category: 'Groceries', occurredOn: '2026-10-01' }), spendingExpense('train', 3000, 'space', { description: 'Train share', category: 'Transportation', occurredOn: '2026-10-01' })]
export async function setup(page: Page, records = fixtures, status = 200, hidden = false, lang = 'en') {
  await page.addInitScript(({ hidden, lang }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const access_token = [btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), btoa(JSON.stringify({ sub: 'ui-contract-user', exp })), 'test-only'].join('.')
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token, refresh_token: 'test-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: 'ui-contract-user', aud: 'authenticated', role: 'authenticated', email: 'ui-contract@example.test', user_metadata: {}, is_anonymous: false } }))
    localStorage.setItem('monosplit-storage', JSON.stringify({ version: 6, state: { lang, themeId: 'solid-vintage', homeUi: { balanceHidden: hidden, mode: 'daily', density: 'detailed', selectedAccountId: 'all', selectedTripId: null }, ledgerByIdentity: {} } }))
  }, { hidden, lang })
  await page.route('http://127.0.0.1:54321/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/rpc/insights_fx_snapshot')) return route.fulfill({json:autoFxSnapshot})
    if (path.includes('/user_profiles')) return route.fulfill({ json: { display_name: 'UI contract tester', default_currency: 'MYR', timezone: 'Asia/Kuala_Lumpur' } })
    if (path.includes('/participants')) return route.fulfill({ json: { id: 'you' } })
    if (path.endsWith('/expenses')) return route.fulfill({ status, json: status === 200 ? records.map(apiExpense) : { code: 'test_error', message: 'Test read failure' } })
    return route.fulfill({ json: [] })
  })
}
export async function capture(page: Page, name: string, screenshot = true) {
  await mkdir('test-results/insights-ui', { recursive: true })
  if (screenshot) await page.screenshot({ path: `test-results/insights-ui/${name}.png`, fullPage: true, animations: 'disabled' })
  const geometry = await page.locator('.tt-insights').first().evaluate(root => ({ width: innerWidth, visualViewport: visualViewport?.width, dpr: devicePixelRatio, rootFont: getComputedStyle(document.documentElement).fontSize, layout: root.querySelector<HTMLElement>('.i-filter-row')?.dataset.layout, filters: [...root.querySelectorAll<HTMLElement>('.i-filter-button')].map(button => { const rect = button.getBoundingClientRect(); const value = button.querySelector<HTMLElement>('.i-filter-value'); const range = document.createRange(); if (value) range.selectNodeContents(value); return { text: value?.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height, font: getComputedStyle(button).fontSize, stacked: button.dataset.stacked, textRects: [...range.getClientRects()].map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height })), valueOverflow: value ? value.scrollWidth > value.clientWidth + 1 : false } }), scrollWidth: document.documentElement.scrollWidth, controls: [...root.querySelectorAll('button,a')].map(el => { const box = el.getBoundingClientRect(); return { text: el.textContent, width: box.width, height: box.height } }) }))
  await writeFile(`test-results/insights-ui/${name}.json`, JSON.stringify(geometry, null, 2))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1)
  for (const control of geometry.controls) expect(control.height).toBeGreaterThanOrEqual(44)
}
