/** @vitest-environment jsdom */
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HomeAccount, HomeDateGroup } from '../../lib/homeView'
import { formatMinorAmount } from '../../lib/money'
import { useStore } from '../../store/useStore'
import HomeScreen, { type HomeScreenProps } from './HomeScreen'

afterEach(() => {
  cleanup()
})

const cimb: HomeAccount = {
  id: 'cimb',
  name: 'CIMB Savings Account With A Very Long Name',
  accountClass: 'asset',
  accountType: 'bank',
  currency: 'MYR',
  archived: false,
  openingStatus: 'posted',
  entrySumMinor: 12_345_678_901,
}

const groups: HomeDateGroup[] = [{
  date: '2026-09-16',
  kind: 'today',
  records: [{
    id: 'expense:1',
    expenseId: '1',
    spaceId: null,
    occurredOn: '2026-09-16',
    createdAt: '2026-09-16T00:00:00.000Z',
    description: 'Dinner with a very long description that must stay fully available',
    category: 'Food',
    chip: { kind: 'direct', personName: 'Lan' },
    direction: 'out',
    amountMinor: 12_345_678_901,
    currency: 'MYR',
    accountId: 'cimb',
    walletName: 'CIMB',
    fundingPending: false,
    amountKnown: true,
    affectsPersonalSpending: true,
    showIcon: true,
    showChip: true,
    compact: false,
  }],
}]

function props(overrides: Partial<HomeScreenProps> = {}): HomeScreenProps {
  return {
    mode: 'daily',
    onModeChange: vi.fn(),
    density: 'detailed',
    onDensityChange: vi.fn(),
    balanceHidden: false,
    onToggleBalanceHidden: vi.fn(),
    selectedAccountId: 'all',
    onSelectAccount: vi.fn(),
    accounts: [cimb],
    accountsStatus: 'ready',
    balances: [{ currency: 'MYR', amountMinor: 12_345_678_901, knownOnly: false, unknownOpeningCount: 0 }],
    monthlySpending: [{ currency: 'MYR', amountMinor: 2_000 }],
    receivables: [{ currency: 'MYR', amountMinor: 500 }],
    tileLayout: 'both',
    accountTasks: [{ id: 'funding:1', kind: 'pending_funding', actionable: true }],
    sharedContexts: [{
      id: 'friend:lan',
      source: 'friend',
      label: 'Lan',
      personId: 'person-lan',
      spaceId: null,
      lines: [{ currency: 'MYR', direction: 'receivable', amountMinor: 500 }],
    }],
    sharedStatus: 'ready',
    recordGroups: groups,
    onShowAllRecords: vi.fn(),
    showingAllRecords: false,
    trip: null,
    trips: [],
    travelStatus: 'ready',
    tripSpending: [],
    onSelectTrip: vi.fn(),
    onCreateTrip: vi.fn(),
    onOpenSharedContext: vi.fn(),
    ...overrides,
  }
}

describe('HomeScreen', () => {
  it('keeps the daily and travel switch in the upper-right header', () => {
    const { rerender } = render(<HomeScreen {...props()} />)
    expect(screen.getByTestId('home-mode-switch').parentElement).toBe(screen.getByTestId('home-header'))
    rerender(<HomeScreen {...props({ mode: 'travel', trip: {
      phase: 'active',
      trip: {
        id: 'hanoi',
        type: 'trip',
        name: 'Hanoi Days',
        status: 'active',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    } })} />)
    expect(screen.getByTestId('home-mode-switch').parentElement).toBe(screen.getByTestId('home-header'))
    expect(screen.getByRole('button', { name: 'Travel' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('opens the account sheet and offers manage accounts', async () => {
    const user = userEvent.setup()
    render(<HomeScreen {...props()} />)
    await user.click(screen.getByTestId('home-account-selector'))
    expect(screen.getByRole('dialog', { name: 'Choose an account' })).toBeTruthy()
    expect(screen.getByTestId('home-manage-accounts').textContent).toContain('Manage accounts')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('hides only the balance value and remembers the eye through local state', async () => {
    const user = userEvent.setup()
    const formatted = formatMinorAmount(12_345_678_901, 'MYR', 'en-MY')
    function Harness() {
      const hidden = useStore((state) => state.homeUi.balanceHidden)
      const setHomeUi = useStore((state) => state.setHomeUi)
      const [localHidden, setLocalHidden] = useState(hidden)
      return (
        <HomeScreen
          {...props({
            balanceHidden: localHidden,
            onToggleBalanceHidden: () => {
              setLocalHidden((current) => !current)
              setHomeUi({ balanceHidden: !localHidden })
            },
          })}
        />
      )
    }
    useStore.setState({ homeUi: { ...useStore.getState().homeUi, balanceHidden: false } })
    render(<Harness />)
    expect(screen.getByTestId('home-balance-values').textContent).toContain(formatted)
    expect(screen.getByText(/Spent this month/)).toBeTruthy()
    await user.click(screen.getByTestId('home-balance-eye'))
    expect(screen.getByTestId('home-balance-values').textContent).not.toContain(formatted)
    expect(screen.getByTestId('home-balance-values').getAttribute('aria-label')).toBe('Account balances hidden')
    expect(screen.getByTestId('home-balance-eye').getAttribute('aria-label')).toBe('Show account balances')
    expect(screen.getByText(/Spent this month/).parentElement?.textContent).toContain('20.00')
    expect(useStore.getState().homeUi.balanceHidden).toBe(true)
  })

  it('opens summary destinations and the existing history action', async () => {
    const user = userEvent.setup()
    const onShowAllRecords = vi.fn()
    const onOpenSharedContext = vi.fn()
    render(<HomeScreen {...props({ onShowAllRecords, onOpenSharedContext })} />)
    await user.click(screen.getByRole('button', { name: /Account tasks/ }))
    expect(screen.getByRole('dialog', { name: 'Account tasks' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /To collect and pay/ }))
    await user.click(screen.getByRole('button', { name: /Lan/ }))
    expect(onOpenSharedContext).toHaveBeenCalledWith(expect.objectContaining({ personId: 'person-lan' }))
    await user.click(screen.getByRole('button', { name: 'All ›' }))
    expect(onShowAllRecords).toHaveBeenCalled()
  })

  it('keeps long labels and large amounts in the document', () => {
    const compactGroups: HomeDateGroup[] = [{
      ...groups[0]!,
      records: groups[0]!.records.map((record) => ({ ...record, showIcon: false, compact: true })),
    }]
    const { rerender } = render(<HomeScreen {...props({ selectedAccountId: 'cimb' })} />)
    const formatted = formatMinorAmount(12_345_678_901, 'MYR', 'en-MY')
    expect(screen.getByText('Dinner with a very long description that must stay fully available').textContent).toContain('Dinner')
    expect(screen.getByText('CIMB Savings Account With A Very Long Name').textContent).toContain('CIMB')
    expect(document.body.textContent).toContain('123,456,789.01')
    expect(formatted).toContain('123,456,789.01')
    rerender(<HomeScreen {...props({ selectedAccountId: 'cimb', density: 'compact', recordGroups: compactGroups })} />)
    expect(screen.getByTestId('home-record').className).toContain('is-compact')
    expect(screen.queryByText('🍽️')).toBeNull()
  })

  it('shows loading, empty, and error states', () => {
    const { rerender } = render(<HomeScreen {...props({
      accountsStatus: 'loading',
      recordGroups: [],
    })} />)
    expect(screen.getByText('Loading home…')).toBeTruthy()
    rerender(<HomeScreen {...props({
      accountsStatus: 'error',
      recordGroups: [],
      sharedStatus: 'error',
    })} />)
    expect(screen.getAllByText('These figures could not be loaded.').length).toBeGreaterThan(0)
    rerender(<HomeScreen {...props({
      accounts: [],
      balances: [],
      recordGroups: [],
      tileLayout: 'hidden',
    })} />)
    expect(screen.getByText('No cash accounts yet')).toBeTruthy()
    expect(screen.getByText('No records yet')).toBeTruthy()
    expect(screen.queryByTestId('home-tiles')).toBeNull()
  })

  it('shows one full-width tile and hides the row when both counts are zero', () => {
    const { rerender } = render(<HomeScreen {...props({
      tileLayout: 'account',
      sharedContexts: [],
    })} />)
    expect(screen.getByTestId('home-tiles').getAttribute('data-layout')).toBe('account')
    expect(screen.queryByRole('button', { name: /To collect and pay/ })).toBeNull()
    rerender(<HomeScreen {...props({ tileLayout: 'hidden', accountTasks: [], sharedContexts: [] })} />)
    expect(screen.queryByTestId('home-tiles')).toBeNull()
  })

  it('renders an ended trip and a no-trip empty state', async () => {
    const user = userEvent.setup()
    const onCreateTrip = vi.fn()
    const { rerender } = render(<HomeScreen {...props({
      mode: 'travel',
      trip: {
        phase: 'ended',
        trip: {
          id: 'old',
          type: 'trip',
          name: 'Penang',
          status: 'archived',
          startDate: '2026-01-01',
          endDate: '2026-01-05',
          updatedAt: '2026-01-06T00:00:00.000Z',
        },
      },
      trips: [],
    })} />)
    expect(screen.getByText('Ended')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Travel records' })).toBeTruthy()
    rerender(<HomeScreen {...props({ mode: 'travel', trip: null, onCreateTrip, recordGroups: [] })} />)
    expect(screen.getByTestId('home-trip-empty').textContent).toContain('No trip yet')
    await user.click(screen.getByRole('button', { name: 'View trips' }))
    expect(onCreateTrip).toHaveBeenCalled()
  })
})
