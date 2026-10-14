/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import ExpenseHistoryList from './ExpenseHistoryList'
import { noticeExpense } from '../test/notificationFixtures'
import { useStore } from '../store/useStore'

afterEach(cleanup)

it('shows the full authoritative correction chain from any selected generation without unrelated history', () => {
  useStore.setState({ lang: 'en' })
  const a = { ...noticeExpense('a', 'Original train'), status: 'voided' as const, terminationKind: 'corrected' as const }
  const b = { ...noticeExpense('b', 'First correction'), correctsExpenseId: 'a', status: 'voided' as const, terminationKind: 'corrected' as const }
  const c = { ...noticeExpense('c', 'Final correction'), correctsExpenseId: 'b' }
  const other = { ...noticeExpense('other', 'Unrelated cancelled record'), status: 'voided' as const, terminationKind: 'cancelled' as const }
  const expenses = [a, b, c, other]
  const view = render(<ExpenseHistoryList expenses={expenses} directRequests={[]} focusExpenseId="a" />)
  for (const focus of ['a', 'b', 'c']) {
    view.rerender(<ExpenseHistoryList expenses={expenses} directRequests={[]} focusExpenseId={focus} />)
    for (const id of ['a', 'b', 'c']) expect(screen.getByTestId(`expense-history-${id}`)).toBeTruthy()
    expect(screen.queryByTestId('expense-history-other')).toBeNull()
    expect(screen.getAllByText('Current version')).toHaveLength(1)
  }
  view.rerender(<ExpenseHistoryList expenses={expenses} directRequests={[]} />)
  expect(screen.getByTestId('expense-history-other')).toBeTruthy()
})
