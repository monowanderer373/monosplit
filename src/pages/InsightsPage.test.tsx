/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InsightsPage from './InsightsPage'
import SpendingRecordsPage from './SpendingRecordsPage'
import { useStore } from '../store/useStore'
import { derivePersonalLedgerRows } from '../lib/ledgerSummary'
import { spendingExpense } from '../test/spendingFixtures'
const state = vi.hoisted(() => ({ expenses: [] as import('../types').CanonicalExpense[], status: 'ready' as 'ready' | 'error' | 'loading', auth: true, refresh: vi.fn(async () => undefined) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ authUser: state.auth ? { id: 'user', participantId: 'you', timezone: 'Asia/Kuala_Lumpur', defaultCurrency: 'MYR' } : null, loading: false }) }))
vi.mock('../hooks/usePersonalLedger', () => ({ usePersonalLedger: () => ({ participantId: 'you', rows: derivePersonalLedgerRows(state.expenses, 'you'), expensesStatus: state.status, refresh: state.refresh, voidExpense: vi.fn() }) }))
vi.mock('../hooks/useExpenseChanges', () => ({ useExpenseChanges: () => ({ requests: [], loading: false, error: '', refreshAuthoritative: state.refresh }) }))
vi.mock('../lib/personRepository', () => ({ personRepository: { listPeople: vi.fn(async () => []) } }))
function setup(path = '/insights?month=2026-10&currency=MYR') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/insights" element={<InsightsPage />} /><Route path="/insights/records" element={<SpendingRecordsPage />} /><Route path="/login" element={<p>Login</p>} /></Routes></MemoryRouter>)
}
beforeEach(() => {
  state.expenses = [spendingExpense('lunch', 7200, 'direct', { description: 'Lunch with friends' }), spendingExpense('coffee', 1200)]
  state.status = 'ready'; state.auth = true; state.refresh.mockClear()
  useStore.setState({ lang: 'en', homeUi: { ...useStore.getState().homeUi, balanceHidden: false } })
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 0 })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
describe('Insights and records read the same committed snapshot', () => {
  it('month/year browsing does not commit before selecting a month, and Escape returns focus', () => {
    setup()
    const trigger = screen.getByRole('button', { name: 'Month: Oct 2026' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }))
    expect(trigger.textContent).toContain('Oct 2026')
    expect(screen.getByTestId('spending-total').textContent).toMatch(/RM\s48\.00/)
    fireEvent.click(screen.getByRole('button', { name: 'Choose year: 2025' }))
    fireEvent.click(screen.getByRole('button', { name: '2024' }))
    fireEvent.click(screen.getByRole('button', { name: 'October 2024' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('spending-total').textContent).toMatch(/RM\s0\.00/)
    fireEvent.click(screen.getByRole('button', { name: 'Month: Oct 2024' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(trigger)
  })
  it('uses the current account-local month at click time after a month boundary', () => {
    vi.setSystemTime(new Date('2026-10-31T15:00:00Z'))
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Month: Oct 2026' }))
    vi.setSystemTime(new Date('2026-10-31T17:00:00Z'))
    fireEvent.click(screen.getByRole('button', { name: 'This month' }))
    expect(screen.getByRole('button', { name: 'Month: Nov 2026' })).toBeTruthy()
    vi.useRealTimers()
  })
  it('carries filters/tab into records, counts own shares and reuses the original editor', async () => {
    setup()
    fireEvent.click(screen.getByRole('tab', { name: 'Ranking' }))
    fireEvent.click(screen.getByRole('button', { name: 'Scope: All spending' }))
    fireEvent.click(screen.getByRole('button', { name: 'Shared' }))
    const link = screen.getByRole('link', { name: 'View records' })
    expect(link.getAttribute('href')).toContain('scope=shared&currency=MYR&tab=ranking')
    expect(screen.getByTestId('spending-total').textContent).toMatch(/RM\s36\.00/)
    fireEvent.click(link)
    expect(screen.getByRole('heading', { name: 'Spending records' })).toBeTruthy()
    expect(screen.getByTestId('spending-total').textContent).toMatch(/RM\s36\.00/)
    expect(screen.getByText(/Bill/).textContent).toContain('72.00')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Lunch with friends' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Total amount' })).toBeTruthy()
  })
  it('conceals totals, graph values and shared bills across records/back', () => {
    useStore.setState({ homeUi: { ...useStore.getState().homeUi, balanceHidden: true } })
    setup()
    expect(screen.queryByText(/48\.00/)).toBeNull()
    expect(screen.queryByRole('img', { name: 'Category proportions, detailed below' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'View records' }))
    expect(document.body.textContent).not.toMatch(/48\.00|72\.00|36\.00|12\.00/)
    fireEvent.click(screen.getByRole('button', { name: 'Insights' }))
    expect(screen.getByRole('heading', { name: 'Insights' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('48.00')
  })
  it('fails closed on read errors and refuses signed-out deep links', () => {
    state.status = 'error'; setup('/insights/records?month=2026-10&scope=shared&currency=MYR')
    expect(screen.queryByTestId('spending-total')).toBeNull()
    expect(screen.queryByText('No spending recorded')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(state.refresh).toHaveBeenCalled()
    cleanup(); state.auth = false; setup('/insights/records?month=2026-10')
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy()
    expect(screen.queryByText('Lunch with friends')).toBeNull()
  })
  it('retains received shared rows and opens readonly details without mutation controls', () => {
    state.expenses = [spendingExpense('received', 7200, 'direct', { createdBy: 'other', description: 'Received shared bill' })]
    setup('/insights/records?month=2026-10&currency=MYR')
    expect(screen.getByText('1 record')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'View Received shared bill' }))
    const dialog = screen.getByRole('dialog', { name: 'Record details' })
    expect(dialog.textContent).toMatch(/72\.00/)
    expect(dialog.textContent).toMatch(/36\.00/)
    expect(within(dialog).queryByRole('button', { name: 'Save changes' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Cancel expense' })).toBeNull()
    expect(within(dialog).queryByText(/waiting for a response/)).toBeNull()
  })
  it('keeps confirmed advances with zero own share distinct from no records', () => {
    const expense = spendingExpense('advance', 2400, 'direct')
    expense.shares[0].amountMinor = 0
    expense.shares[1].amountMinor = 2400
    state.expenses = [expense]
    setup()
    expect(screen.getByText('1 record')).toBeTruthy()
    expect(screen.getByText('Your share is zero')).toBeTruthy()
    expect(screen.queryByText('No spending recorded')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'View records' }))
    expect(screen.getByRole('button', { name: 'Edit Record advance' }).textContent).toMatch(/0\.00/)
    expect(screen.getByText(/Bill/).textContent).toMatch(/24\.00/)
  })
  it('counts all records while progressively displaying the list', () => {
    state.expenses = Array.from({ length: 85 }, (_, index) => spendingExpense(String(index), 100))
    setup('/insights/records?month=2026-10&currency=MYR')
    expect(screen.getByText('85 records')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Edit Record/ })).toHaveLength(40)
    fireEvent.click(screen.getByRole('button', { name: 'Load more records' }))
    expect(screen.getAllByRole('button', { name: /^Edit Record/ })).toHaveLength(80)
    expect(screen.getByTestId('spending-total').textContent).toMatch(/RM\s85\.00/)
  })
})
