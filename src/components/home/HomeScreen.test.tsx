/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs'
import { useState } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HomeAccount, HomeDateGroup } from '../../lib/homeView'
import { formatMinorAmount } from '../../lib/money'
import { useStore } from '../../store/useStore'
import GlobalMoneyAction from '../GlobalMoneyAction'
import HomeScreen, { type HomeScreenProps } from './HomeScreen'

const homeCss = readFileSync('src/components/home/home.css', 'utf8')

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
    onCreateAccount: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('HomeScreen', () => {
  it('shows separate outgoing currency totals and sentence case in compact records', () => {
    const base = groups[0]!.records[0]!
    const records = [
      {...base, id:'one',description:'dinner at IKEA',amountMinor:3000,compact:true,showIcon:false},
      {...base, id:'two',description:'coffee',amountMinor:5000,compact:true,showIcon:false},
      {...base, id:'three',currency:'USD',amountMinor:700,compact:true,showIcon:false},
      {...base, id:'four',direction:'in' as const,amountMinor:900,compact:true,showIcon:false},
    ]
    render(<HomeScreen {...props({density:'compact',recordGroups:[{...groups[0]!,records}]})} />)
    expect(screen.getByText('Dinner at IKEA')).toBeTruthy()
    const total = screen.getByTestId('home-day-total').textContent!
    expect(total).toContain('Total')
    expect(total).toContain('80.00')
    expect(total).toContain('7.00')
    expect(total).not.toContain('89.00')
  })

  it('does not show a misleading subtotal when an outgoing amount is unknown', () => {
    render(<HomeScreen {...props({density:'compact',recordGroups:[{
      ...groups[0]!, records:[{...groups[0]!.records[0]!,amountKnown:false,compact:true}],
    }]})} />)
    expect(screen.getByTestId('home-day-total').textContent).not.toContain('123,456,789.01')
  })

  it('keeps zero debt clickable and opens a settled empty state', async () => {
    const user = userEvent.setup()
    render(<div id="root"><HomeScreen {...props({receivables:[],sharedContexts:[]})} /></div>)
    const collect = screen.getByTestId('home-receivable')
    expect(collect.textContent).toContain('0.00')
    expect(collect.getAttribute('data-empty')).toBe('true')
    expect(collect.getAttribute('aria-expanded')).toBe('false')
    await user.click(collect)
    expect(screen.getByRole('dialog', {name:'To collect'})).toBeTruthy()
    expect(screen.getByText('All settled')).toBeTruthy()
    expect(collect.getAttribute('aria-expanded')).toBe('true')
    await user.click(screen.getByTestId('home-shared-sheet-scrim'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(collect.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens mode choices, selects Travel and restores trigger focus', async () => {
    const user = userEvent.setup()
    const change = vi.fn()
    render(<HomeScreen {...props({onModeChange:change})} />)
    const trigger = screen.getByRole('button', {name:'Daily'})
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(trigger)
    expect(screen.getByRole('menuitemradio', {name:'Daily'}).getAttribute('aria-checked')).toBe('true')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(change).toHaveBeenCalledWith('travel')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(trigger)
    await user.click(screen.getByRole('heading', {name:'Recent records'}))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('separates collection and payment totals and opens only the selected direction', async () => {
    const user = userEvent.setup()
    const onOpenSharedContext = vi.fn()
    const contexts = [...props().sharedContexts, {id:'group:owes',source:'group' as const,label:'Travel group',personId:null,spaceId:'owes',lines:[{currency:'MYR',direction:'payable' as const,amountMinor:1200},{currency:'USD',direction:'payable' as const,amountMinor:300}]}]
    render(<div id="root"><HomeScreen {...props({sharedContexts:contexts,onOpenSharedContext})} /></div>)
    expect(screen.getByTestId('home-receivable').textContent).toContain('5.00')
    expect(screen.getByTestId('home-payable').textContent).toContain('12.00')
    expect(screen.getByTestId('home-payable').textContent).toContain('3.00')
    expect(screen.queryByRole('button',{name:/To collect and pay/})).toBeNull()
    await user.click(screen.getByTestId('home-payable'))
    expect(screen.getByRole('dialog',{name:'To pay'})).toBeTruthy()
    expect(screen.queryByRole('button',{name:/Lan/})).toBeNull()
    await user.click(screen.getByRole('button',{name:/Travel group/}))
    expect(onOpenSharedContext).toHaveBeenCalledWith(expect.objectContaining({spaceId:'owes'}))
    await user.click(screen.getByTestId('home-receivable'))
    expect(screen.getByRole('dialog',{name:'To collect'})).toBeTruthy()
    expect(screen.queryByRole('button',{name:/Travel group/})).toBeNull()
    expect(screen.getByRole('button',{name:/Lan/})).toBeTruthy()
  })
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
    expect(screen.getByRole('button', { name: 'Travel' }).getAttribute('aria-haspopup')).toBe('menu')
  })

  it('opens the account sheet and offers manage accounts', async () => {
    const user = userEvent.setup()
    render(
      <div id="root">
        <HomeScreen {...props()} />
        <GlobalMoneyAction onAdd={() => undefined} />
      </div>,
    )
    await user.click(screen.getByTestId('home-account-selector'))
    const sheet = screen.getByTestId('home-account-sheet')
    expect(sheet.getAttribute('role')).toBe('dialog')
    expect(screen.getByTestId('home-manage-accounts').textContent).toContain('Manage accounts')
    expect(document.body.textContent).not.toContain('MYR · MYR')
    const action = screen.getByTestId('global-money-action-layer')
    expect(action.closest('[inert], [aria-hidden="true"]') ?? (action.inert ? action : null)).toBeTruthy()
    expect(action.className).toContain('z-[45]')
    const backdrop = sheet.parentElement as HTMLElement
    expect(backdrop.className).toContain('home-sheet-backdrop')
    expect(homeCss).toContain('.home-sheet-backdrop')
    expect(homeCss).toContain('z-index: 220')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const selector = screen.getByTestId('home-account-selector')
    selector.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('home-account-sheet')).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('dismisses each home window from outside, keeps inside clicks open, and restores the trigger', async () => {
    const user = userEvent.setup()
    render(<div id="root"><HomeScreen {...props()} /></div>)
    for (const [triggerId, sheetId] of [['home-account-selector','home-account-sheet'],['home-manage','home-manage-sheet']] as const) {
      const trigger = screen.getByTestId(triggerId)
      await user.click(trigger)
      const dialog = screen.getByTestId(sheetId)
      expect((screen.getByTestId(`${sheetId}-scrim`) as HTMLElement).inert).not.toBe(true)
      await user.click(dialog.querySelector('h2')!)
      expect(screen.getByTestId(sheetId)).toBeTruthy()
      await user.click(screen.getByTestId(`${sheetId}-scrim`))
      await waitFor(() => expect(screen.queryByTestId(sheetId)).toBeNull())
      expect(document.activeElement).toBe(trigger)
      expect(document.body.style.overflow).toBe('')
    }
    const sharedTrigger = screen.getByTestId('home-receivable')
    await user.click(sharedTrigger)
    await user.click(screen.getByTestId('home-shared-sheet-scrim'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(sharedTrigger)
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
    expect(screen.queryByText(/Spent this month/)).toBeNull()
    await user.click(screen.getByTestId('home-balance-eye'))
    expect(screen.getByTestId('home-balance-values').textContent).not.toContain(formatted)
    expect(screen.getByTestId('home-balance-values').getAttribute('aria-label')).toBe('Account balances hidden')
    expect(screen.getByTestId('home-balance-eye').getAttribute('aria-label')).toBe('Show account balances')
    expect(screen.getByTestId('home-receivable').textContent).toContain('5.00')
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
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByTestId('home-receivable'))
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
    expect(screen.getByText('CIMB').closest('[data-testid="home-record"]')?.textContent).toContain('−')
  })

  it('keeps one currency token and stacks mixed amounts without a dangling separator', async () => {
    render(<HomeScreen {...props({
      receivables: [
        { currency: 'MYR', amountMinor: 7_550 },
        { currency: 'VND', amountMinor: 250_000 },
      ],
      recordActions: {
        'expense:1': <button type="button">Record actions</button>,
      },
    })} />)
    const lines = screen.getAllByText(/MYR|₫|VND/)
    expect(document.body.textContent).not.toContain('MYR · MYR')
    expect(document.body.textContent).not.toMatch(/·\s*$/m)
    expect(screen.getAllByText((_, node) => node?.classList.contains('home-money-line') ?? false).length).toBeGreaterThan(1)
    expect(lines.length).toBeGreaterThan(0)
    expect(screen.getByTestId('home-record').querySelector('.home-record-icon')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Record actions' })).toBeTruthy()
    expect(screen.getByText('CIMB')).toBeTruthy()
  })

  it.each(['detailed', 'compact'] as const)('places the %s edit trigger over the whole card and supports keyboard activation', async density => {
    const edited = vi.fn()
    function Action({ triggerClassName }: { triggerClassName?: string }) {
      return <button type="button" className={triggerClassName} onClick={edited}>Edit record</button>
    }
    render(<HomeScreen {...props({
      density,
      recordGroups: groups.map(group => ({ ...group, records: group.records.map(record => ({ ...record, compact: density === 'compact' })) })),
      recordActions: { 'expense:1': <Action /> },
    })} />)
    const card = screen.getByTestId('home-record')
    const trigger = screen.getByRole('button', { name: 'Edit record' })
    expect(card.querySelector('.home-record-trigger')).toBe(trigger)
    expect(card.querySelector('.home-amount button')).toBeNull()
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    expect(edited).toHaveBeenCalledTimes(1)
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

  it('shows a retry when records fail and keeps readable trips when affiliations fail', async () => {
    const user = userEvent.setup()
    const onRetryRecords = vi.fn()
    const { rerender } = render(<HomeScreen {...props({
      recordsStatus: 'error',
      recordGroups: [],
      onRetryRecords,
    })} />)
    expect(screen.queryByText('No records yet')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetryRecords).toHaveBeenCalledOnce()
    rerender(<HomeScreen {...props({
      mode: 'travel',
      travelStatus: 'ready',
      affiliationsStatus: 'error',
      trip: {
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
      },
    })} />)
    expect(screen.getByText('Hanoi Days')).toBeTruthy()
    expect(screen.getByText(/Private trip labels could not be loaded/)).toBeTruthy()
    expect(screen.queryByText('These figures could not be loaded.')).toBeNull()
  })

  it('offers a first-account action that opens the real create form', async () => {
    const user = userEvent.setup()
    const onCreateAccount = vi.fn(async () => undefined)
    render(<HomeScreen {...props({
      accounts: [],
      balances: [],
      recordGroups: [],
      tileLayout: 'hidden',
      onCreateAccount,
    })} />)
    await user.click(screen.getByTestId('home-add-first-account'))
    expect(screen.getByTestId('home-create-account-sheet')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' })))
    await user.type(screen.getByLabelText('Account name'), 'Touch n Go')
    await user.click(screen.getByTestId('home-create-account'))
    expect(onCreateAccount).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Touch n Go',
      accountType: 'ewallet',
      openingBalanceMinor: null,
      balanceAsOf: null,
    }))
  })

  it('shows loading instead of an amount error while funding is still pending', () => {
    const pending = groups[0]!.records.map((record) => ({ ...record, amountKnown: false, walletName: null }))
    const { rerender } = render(<HomeScreen {...props({
      accountsStatus: 'loading',
      recordGroups: [{ ...groups[0]!, records: pending }],
    })} />)
    expect(screen.getAllByText('Loading home…').length).toBeGreaterThan(0)
    expect(screen.queryByText('Amount unavailable')).toBeNull()
    rerender(<HomeScreen {...props({
      accountsStatus: 'error',
      recordGroups: [{ ...groups[0]!, records: pending }],
      sharedStatus: 'error',
    })} />)
    expect(screen.getAllByText('Amount unavailable').length).toBeGreaterThan(0)
  })

  it('keeps a verified amount visible with an updating indication during refresh', () => {
    render(<HomeScreen {...props({ accountsRefreshing: true })} />)
    expect(screen.getAllByText(/123,456,789\.01/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Updating…').length).toBeGreaterThan(0)
    expect(screen.queryByText('Amount unavailable')).toBeNull()
  })
})
