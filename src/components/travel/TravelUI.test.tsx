/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomeScreen, { type HomeScreenProps } from '../home/HomeScreen'
import { useStore } from '../../store/useStore'
import TripDetails from './TripDetails'

function travelProps(patch: Partial<HomeScreenProps> = {}): HomeScreenProps {
  const trip = { id: 'a', type: 'trip' as const, name: 'Mountain weekend', status: 'active' as const, startDate: null, endDate: null, updatedAt: '', defaultCurrency: 'MYR', role: 'owner' as const }
  return {
    mode: 'travel', onModeChange: vi.fn(), density: 'detailed', onDensityChange: vi.fn(), balanceHidden: false,
    onToggleBalanceHidden: vi.fn(), selectedAccountId: 'all', onSelectAccount: vi.fn(), accounts: [], accountsStatus: 'ready',
    balances: [], monthlySpending: [], receivables: [], tileLayout: 'hidden', accountTasks: [], sharedContexts: [], sharedStatus: 'ready',
    recordGroups: [], recordsStatus: 'ready', affiliationsStatus: 'ready', trip: { trip, phase: 'active' },
    trips: [trip, { ...trip, id: 'b', name: 'Coastal weekend' }], travelStatus: 'ready', tripSpending: [], tripSpendingStatus: 'ready',
    onSelectTrip: vi.fn(), onCreateTrip: vi.fn(), onManageTrips: vi.fn(), onViewTrip: vi.fn(), onAddTripExpense: vi.fn(), onRetryTravel: vi.fn(),
    onOpenSharedContext: vi.fn(), onCreateAccount: vi.fn(async () => {}), ...patch,
  }
}
afterEach(cleanup)
beforeEach(() => useStore.setState({ lang: 'en' }))

describe('Travel states and accessible selector', () => {
  it('distinguishes no trip from a trip with no records', () => {
    const view = render(<HomeScreen {...travelProps({ trip: null, trips: [] })} />)
    expect(screen.getByTestId('travel-first-guide')).toBeTruthy()
    expect(screen.queryByText('My spending')).toBeNull()
    view.rerender(<HomeScreen {...travelProps()} />)
    expect(screen.queryByTestId('travel-first-guide')).toBeNull()
    expect(screen.getByTestId('travel-empty-records')).toBeTruthy()
    expect(screen.getByTestId('travel-spending').textContent).toContain('0.00')
  })
  it.each(['loading', 'error'] as const)('never presents %s as a confirmed empty trip', status => {
    render(<HomeScreen {...travelProps({ trip: null, trips: [], travelStatus: status })} />)
    expect(screen.queryByTestId('travel-first-guide')).toBeNull()
    expect(screen.queryByTestId('home-trip-empty')).toBeNull()
    expect(screen.queryByTestId('travel-spending')).toBeNull()
  })
  it('selects with arrows and Enter, closes and restores trigger focus', async () => {
    const user = userEvent.setup(), props = travelProps()
    render(<HomeScreen {...props} />)
    const trigger = screen.getByTestId('home-trip-selector')
    await user.click(trigger)
    expect(document.activeElement?.getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{End}{Enter}')
    expect(props.onSelectTrip).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
  it('closes on Escape, trigger toggle and outside pointer, without a backdrop', async () => {
    const user = userEvent.setup(); render(<HomeScreen {...travelProps()} />)
    const trigger = screen.getByTestId('home-trip-selector')
    await user.click(trigger); await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(trigger)
    await user.click(trigger); await user.click(trigger)
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(trigger); fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('.home-sheet-backdrop')).toBeNull()
  })
  it('routes Create and Manage through their callbacks', async () => {
    const user = userEvent.setup(), props = travelProps(); render(<HomeScreen {...props} />)
    await user.click(screen.getByTestId('home-trip-selector'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create a trip' }))
    expect(props.onCreateTrip).toHaveBeenCalledOnce()
    await user.click(screen.getByTestId('home-trip-selector'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Manage trips' }))
    expect(props.onManageTrips).toHaveBeenCalledOnce()
  })
  it('conceals summary amounts and keeps multiple currencies separate', () => {
    const props = travelProps({ tripSpending: [{ currency: 'MYR', amountMinor: 1500 }, { currency: 'USD', amountMinor: 200 }] })
    const view = render(<HomeScreen {...props} />)
    expect(screen.getByTestId('travel-spending').querySelectorAll('.tt-amount-line')).toHaveLength(2)
    view.rerender(<HomeScreen {...props} balanceHidden />)
    expect(screen.getByTestId('travel-spending').textContent).toBe('••••')
    view.rerender(<HomeScreen {...props} tripSpendingStatus="error" />)
    expect(screen.getByTestId('travel-spending').textContent).not.toContain('15.00')
  })
  it('shows a no-access deep link without exposing a name or members', () => {
    render(<TripDetails props={travelProps({ trip: null })} participantId="owner" members={[]} membersStatus="ready" canWrite={false}
      records={null} onBack={vi.fn()} onInfo={vi.fn()} onMembers={vi.fn()} onManage={vi.fn()} />)
    expect(screen.getByText('This trip is no longer accessible.')).toBeTruthy()
    expect(screen.queryByText('Mountain weekend')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull()
  })
})
it('renders real localized counts instead of unresolved placeholders in details', () => {
  render(<TripDetails props={travelProps()} participantId="owner" members={[]} membersStatus="ready" canWrite={false}
    records={null} onBack={vi.fn()} onInfo={vi.fn()} onMembers={vi.fn()} onManage={vi.fn()} />)
  expect(screen.getByTestId('trip-detail-summary').textContent).toContain('0 records')
  expect(screen.getByTestId('trip-detail-summary').textContent).toContain('0 people')
  expect(screen.getByTestId('trip-detail-summary').textContent).not.toContain('{count}')
})
