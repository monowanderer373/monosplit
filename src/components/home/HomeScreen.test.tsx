/** @vitest-environment jsdom */
import { useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HomeAccount, HomeDateGroup } from '../../lib/homeView'
import { formatMinorAmount } from '../../lib/money'
import { useStore } from '../../store/useStore'
import GlobalMoneyAction from '../GlobalMoneyAction'
import HomeScreen, { type HomeScreenProps } from './HomeScreen'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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
  it('maps the grid to overall and the list to compact while keeping the selected view accessible', async () => {
    const user = userEvent.setup()
    const onDensityChange = vi.fn()
    const { rerender } = render(<HomeScreen {...props({ onDensityChange })} />)
    const toggle = screen.getByRole('switch', { name: 'Record detail' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(document.getElementById(toggle.getAttribute('aria-describedby')!)?.textContent).toBe('Overall')
    expect(toggle.querySelector('[data-icon="grid"]')?.classList.contains('is-detailed')).toBe(true)
    expect(toggle.querySelector('[data-icon="list"]')?.classList.contains('is-compact')).toBe(true)
    await user.click(toggle)
    expect(onDensityChange).toHaveBeenLastCalledWith('compact')
    rerender(<HomeScreen {...props({ onDensityChange, density: 'compact', recordGroups: groups.map(group => ({
      ...group, records: group.records.map(record => ({ ...record, compact: true, showIcon: false })),
    })) })} />)
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(document.getElementById(toggle.getAttribute('aria-describedby')!)?.textContent).toBe('Compact')
    expect(screen.getByTestId('home-record').querySelector('.home-shared-mark')).toBeTruthy()
    expect(screen.getByTestId('home-record').querySelector('.home-chip')?.textContent).toContain('Lan')
    expect(screen.getByTestId('home-record').querySelector('.home-record-icon')).toBeNull()
    toggle.focus()
    await user.keyboard(' ')
    expect(onDensityChange).toHaveBeenLastCalledWith('detailed')
  })

  it.each(['detailed', 'compact'] as const)('shows whole days and automatically appends older records in %s mode', async density => {
    let onIntersect!: IntersectionObserverCallback
    const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { onIntersect = callback }
      observe = vi.fn()
      disconnect = disconnect
    })
    const days: HomeDateGroup[] = [
      { ...groups[0]!, records: Array.from({ length: 12 }, (_, index) => ({ ...groups[0]!.records[0]!, id: `first:${index}`, description: `First day ${index}` })) },
      { ...groups[0]!, date: '2026-09-15', kind: 'yesterday', records: [{ ...groups[0]!.records[0]!, id: 'older', description: 'Older day record' }] },
    ]
    const { rerender } = render(<HomeScreen {...props({ density, recordGroups: days })} />)
    expect(screen.getByText('First day 11')).toBeTruthy()
    expect(screen.queryByText('Older day record')).toBeNull()
    expect(screen.queryByRole('button', { name: 'All ›' })).toBeNull()
    act(() => onIntersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver))
    expect(screen.getByText('Older day record')).toBeTruthy()
    expect(screen.getByText('All records shown')).toBeTruthy()
    rerender(<HomeScreen {...props({ density: density === 'compact' ? 'detailed' : 'compact', recordGroups: days })} />)
    expect(screen.getByText('Older day record')).toBeTruthy()
    expect(screen.getAllByText('Older day record')).toHaveLength(1)
  })

  it('offers manual continuation without IntersectionObserver and resets when the record filter changes', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const user = userEvent.setup()
    const days = [groups[0]!, { ...groups[0]!, date: '2026-09-15', records: [{ ...groups[0]!.records[0]!, id: 'older', description: 'Older day record' }] }]
    const { rerender } = render(<HomeScreen {...props({ recordGroups: days, recordsViewKey: 'wallet-a' })} />)
    await user.click(screen.getByRole('button', { name: 'Show earlier records' }))
    expect(screen.getByText('Older day record')).toBeTruthy()
    rerender(<HomeScreen {...props({ recordGroups: days, recordsViewKey: 'wallet-b' })} />)
    expect(screen.queryByText('Older day record')).toBeNull()
  })

  it('does not claim all records are shown while reads are loading or have failed', () => {
    const { rerender } = render(<HomeScreen {...props({ recordsStatus: 'ready', accountsRefreshing: true })} />)
    expect(screen.queryByText('All records shown')).toBeNull()
    rerender(<HomeScreen {...props({ recordsStatus: 'error' })} />)
    expect(screen.queryByText('All records shown')).toBeNull()
    expect(screen.getByText('Some records could not load')).toBeTruthy()
  })

  it('shows an overdrawn balance in the wallet and account selector', async () => {
    const user = userEvent.setup()
    render(<HomeScreen {...props({ accounts:[{...cimb,entrySumMinor:-1250}], balances:[{currency:'MYR',amountMinor:-1250,knownOnly:false,unknownOpeningCount:0}] })} />)
    expect(screen.queryByText('Amount unavailable')).toBeNull()
    expect(screen.getByText('12.50')).toBeTruthy()
    await user.click(screen.getByTestId('home-account-selector'))
    expect(screen.getByTestId('home-account-sheet').textContent).toContain('-RM')
  })

  it('opens the compact notice and dismisses it by clicking outside', async () => {
    const user = userEvent.setup()
    render(<HomeScreen {...props()} />)
    const trigger = screen.getByTestId('home-account-notice')
    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByTestId('home-task-sheet-backdrop')).toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
    await user.click(screen.getByRole('heading', { name: 'My day' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('toggles the notice and closes on Escape without trapping the page', async () => {
    const user = userEvent.setup()
    render(<HomeScreen {...props()} />)
    const trigger = screen.getByTestId('home-account-notice')
    await user.click(trigger)
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('false')
    await user.click(trigger)
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

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

  it('shows zero confirmed totals as noninteractive summaries', () => {
    render(<HomeScreen {...props({receivables:[],sharedContexts:[]})} />)
    expect(screen.getByTestId('home-receivable').textContent).toContain('0.00')
    expect(screen.getByTestId('home-payable').textContent).toContain('0.00')
    expect(screen.getByTestId('home-receivable').tagName).toBe('SECTION')
    expect(screen.getByTestId('home-receivable').hasAttribute('aria-expanded')).toBe(false)
    expect(screen.queryByTestId('home-unconfirmed-notice')).toBeNull()
  })

  it('makes manual splits discoverable without calling them settled or adding them to confirmed totals', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const preview = { id: 'preview:1', source: 'friend' as const, label: 'Test friend', personId: 'test-person', spaceId: null, status: 'manual' as const, description: 'Test split', lines: [{ currency: 'MYR', direction: 'receivable' as const, amountMinor: 500 }] }
    render(<HomeScreen {...props({ receivables: [], sharedContexts: [], sharedPreviews: [preview], onOpenSharedContext: onOpen })} />)
    const collect = screen.getByTestId('home-receivable')
    expect(collect.textContent).toContain('0.00')
    expect(screen.getByTestId('home-unconfirmed-notice').textContent).toContain('Unconfirmed')
    expect(screen.getByTestId('home-receivable-unconfirmed').textContent).toContain('5.00')
    await user.click(screen.getByTestId('home-unconfirmed-notice'))
    expect(screen.queryByText('All settled')).toBeNull()
    expect(screen.getByText('Your records')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Test friend.*Test split/ }))
    expect(onOpen).toHaveBeenCalledWith(preview)
  })

  it('separates preview currencies, directions and statuses while preserving confirmed totals', async () => {
    const user = userEvent.setup()
    const manual = { id: 'manual', source: 'friend' as const, label: 'Manual friend', personId: 'manual', spaceId: null, status: 'manual' as const, description: 'Car', lines: [
      { currency: 'MYR', direction: 'receivable' as const, amountMinor: 2500 },
      { currency: 'USD', direction: 'receivable' as const, amountMinor: 700 },
      { currency: 'MYR', direction: 'payable' as const, amountMinor: 900 },
    ] }
    const pending = { ...manual, id: 'pending', label: 'Pending friend', status: 'pending' as const, lines: [{ currency: 'MYR', direction: 'receivable' as const, amountMinor: 1000 }] }
    const view = render(<HomeScreen {...props({ sharedPreviews: [manual, pending] })} />)
    const collect = screen.getByTestId('home-receivable')
    expect(collect.querySelector('.home-debt-value')!.textContent).toContain('5.00')
    const hint = screen.getByTestId('home-receivable-unconfirmed').textContent!
    expect(hint).toContain('35.00')
    expect(hint).toContain('7.00')
    expect(hint).not.toContain('9.00')
    expect(screen.getByTestId('home-payable-unconfirmed').textContent).toContain('9.00')
    await user.click(screen.getByTestId('home-unconfirmed-notice'))
    expect(screen.getByText('These records are excluded from confirmed balances.')).toBeTruthy()
    expect(screen.getByText('Your records')).toBeTruthy()
    expect(screen.getByText('Pending confirmation')).toBeTruthy()
    const sections = screen.getByTestId('home-review-sheet').querySelectorAll('.home-split-preview-section')
    expect(sections[0]!.textContent).toContain('10.00')
    expect(sections[1]!.textContent).toContain('25.00')
    view.unmount()
    render(<HomeScreen {...props({ sharedPreviews: [manual], sharedStatus: 'error' })} />)
    expect(screen.queryByTestId('home-receivable-unconfirmed')).toBeNull()
  })

  it('selects Daily and Travel directly while preserving the mode handler', async () => {
    const user = userEvent.setup()
    const change = vi.fn()
    const {rerender} = render(<HomeScreen {...props({onModeChange:change})} />)
    expect(screen.getByRole('button',{name:'Daily'}).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button',{name:'Travel'}))
    expect(change).toHaveBeenCalledWith('travel')
    rerender(<HomeScreen {...props({mode:'travel',onModeChange:change})} />)
    expect(screen.getByRole('button',{name:'Travel'}).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button',{name:'Daily'}))
    expect(change).toHaveBeenLastCalledWith('daily')
  })

  it('keeps confirmed collection and payment totals separate without negative payment signs', () => {
    const contexts = [...props().sharedContexts, {id:'group:owes',source:'group' as const,label:'Travel group',personId:null,spaceId:'owes',lines:[{currency:'MYR',direction:'payable' as const,amountMinor:1200},{currency:'USD',direction:'payable' as const,amountMinor:300}]}]
    render(<HomeScreen {...props({sharedContexts:contexts})} />)
    expect(screen.getByTestId('home-receivable').textContent).toContain('5.00')
    const pay = screen.getByTestId('home-payable').textContent!
    expect(pay).toContain('12.00'); expect(pay).toContain('3.00'); expect(pay).not.toContain('−')
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
    expect(screen.getByRole('button', { name: 'Travel' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('opens an anchored nonmodal account menu and offers the existing add account form', async () => {
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
    expect(sheet.getAttribute('aria-modal')).toBe('false')
    expect(screen.getByTestId('home-add-account').textContent).toContain('Add account')
    expect(document.body.textContent).not.toContain('MYR · MYR')
    const action = screen.getByTestId('global-money-action-layer')
    expect(action.closest('[inert], [aria-hidden="true"]') ?? (action.inert ? action : null)).toBeNull()
    expect(action.className).toContain('z-[45]')
    expect(sheet.parentElement?.className).toContain('home-account-target')
    expect(screen.queryByTestId('home-account-sheet-backdrop')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const selector = screen.getByTestId('home-account-selector')
    selector.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('home-account-sheet')).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('dismisses the account menu outside without stealing focus and restores the trigger on Escape', async () => {
    const user = userEvent.setup()
    render(<div id="root"><HomeScreen {...props()} /></div>)
    const trigger = screen.getByTestId('home-account-selector')
    await user.click(trigger)
    const dialog = screen.getByTestId('home-account-sheet')
    await user.click(dialog.querySelector('h2')!)
    expect(screen.getByTestId('home-account-sheet')).toBeTruthy()
    const outside = screen.getByTestId('home-balance-eye')
    await user.click(outside)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(outside)
    expect(document.body.style.overflow).toBe('')
    await user.click(trigger); await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('moves between account options with arrow keys and lets focus leave the menu', async () => {
    const user = userEvent.setup()
    render(<HomeScreen {...props()} />)
    const trigger = screen.getByTestId('home-account-selector')
    await user.click(trigger)
    const all = within(screen.getByTestId('home-account-sheet')).getByRole('button', { name: /^All accounts/ })
    const cimbOption = screen.getByRole('button', { name: /^CIMB Savings/ })
    await waitFor(() => expect(document.activeElement).toBe(all))
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(cimbOption)
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(all)
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(cimbOption)
    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(screen.getByTestId('home-add-account'))
    await user.keyboard('{Tab}')
    expect(screen.queryByTestId('home-account-sheet')).toBeNull()
    expect(document.activeElement).not.toBe(trigger)
  })

  it('opens all unconfirmed details in a centered modal and restores the review trigger', async () => {
    const user = userEvent.setup()
    const base = props().sharedContexts[0]!
    render(<div id="root"><HomeScreen {...props({ sharedPreviews: [
      { ...base, id: 'pending', status: 'pending', description: 'Dinner pending' },
      { ...base, id: 'manual', status: 'manual', description: 'Manual lunch', lines: [] },
    ] })} /></div>)
    const trigger = screen.getByTestId('home-unconfirmed-notice')
    await user.click(trigger)
    const dialog = screen.getByTestId('home-review-sheet')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.classList.contains('home-paper-dialog')).toBe(true)
    expect(dialog.querySelector('.home-sheet-handle')).toBeNull()
    expect(screen.getByText('Dinner pending')).toBeTruthy()
    expect(screen.getByText('Manual lunch')).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('home-review-sheet')).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
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

  it('opens the existing pending person destination through Review', async () => {
    const user = userEvent.setup()
    const onOpenSharedContext = vi.fn()
    const preview = {...props().sharedContexts[0]!, status:'pending' as const, description:'Dinner'}
    render(<HomeScreen {...props({onOpenSharedContext,sharedPreviews:[preview]})} />)
    await user.click(screen.getByTestId('home-unconfirmed-notice'))
    await user.click(screen.getByRole('button',{name:/Lan.*Dinner/}))
    expect(onOpenSharedContext).toHaveBeenCalledWith(preview)
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

  it('keeps the bell by the title and hides the dot when there are no account tasks', () => {
    const { rerender } = render(<HomeScreen {...props({
      tileLayout: 'account',
      sharedContexts: [],
    })} />)
    expect(screen.getByTestId('home-account-notice').closest('.home-title-row')).toBeTruthy()
    expect(screen.queryByTestId('home-tiles')).toBeNull()
    expect(screen.queryByRole('button', { name: /To collect and pay/ })).toBeNull()
    rerender(<HomeScreen {...props({ tileLayout: 'hidden', accountTasks: [], sharedContexts: [] })} />)
    expect(screen.getByTestId('home-account-notice').querySelector('.home-account-notice-dot')).toBeNull()
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
  it.each([0,-500])('preserves a %s unconfirmed amount without adding it to confirmed totals', async amountMinor => {
    const preview = {...props().sharedContexts[0]!,status:'pending' as const,description:'Refund',lines:[{currency:'MYR',direction:'receivable' as const,amountMinor}]}
    render(<HomeScreen {...props({sharedPreviews:[preview]})} />)
    expect(screen.getByTestId('home-unconfirmed-notice')).toBeTruthy()
    expect(screen.getByTestId('home-receivable').textContent).toContain('5.00')
    expect(screen.getByTestId('home-receivable').querySelector('.home-unconfirmed-amount')).toBeNull()
    await userEvent.click(screen.getByTestId('home-unconfirmed-notice'))
    expect(screen.getByText('Pending confirmation')).toBeTruthy()
  })

  it('shows a real pending count when the preview has no debt amount', () => {
    const preview = {...props().sharedContexts[0]!,status:'pending' as const,description:'Zero balance split',lines:[]}
    render(<HomeScreen {...props({sharedPreviews:[preview]})} />)
    const text = screen.getByTestId('home-unconfirmed-notice').textContent!
    expect(text).toContain('1 records'); expect(text).not.toContain('0.00')
  })

  it.each(['loading','error'] as const)('does not present pending totals or false zeros during %s', sharedStatus => {
    const preview = {...props().sharedContexts[0]!,status:'pending' as const,description:'Dinner'}
    render(<HomeScreen {...props({sharedStatus,sharedPreviews:[preview]})} />)
    expect(screen.queryByTestId('home-unconfirmed-notice')).toBeNull()
    expect(screen.getByTestId('home-receivable').textContent).not.toContain('0.00')
  })

  it('keeps the existing card-only privacy scope when the picker is explicitly opened', async () => {
    render(<HomeScreen {...props({balanceHidden:true})} />)
    await userEvent.click(screen.getByTestId('home-account-selector'))
    const sheet = screen.getByTestId('home-account-sheet')
    expect(sheet.textContent).toContain('123,456,789.01')
    expect(screen.getAllByTestId('home-balance-values')[0]!.innerHTML).not.toContain('123,456,789.01')
    expect(screen.getByRole('button',{name:/CIMB Savings/})).toBeTruthy()
  })

  it('selects an account, closes the picker and restores its trigger', async () => {
    const select = vi.fn()
    render(<HomeScreen {...props({onSelectAccount:select})} />)
    await userEvent.click(screen.getByTestId('home-account-selector'))
    await userEvent.click(screen.getByRole('button',{name:/CIMB Savings/}))
    expect(select).toHaveBeenCalledWith('cimb')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByTestId('home-account-selector'))
  })

  it('enters the real account form from the picker and returns focus after closing it', async () => {
    render(<div id="root"><HomeScreen {...props()} /></div>)
    await userEvent.click(screen.getByTestId('home-account-selector'))
    await userEvent.click(screen.getByTestId('home-add-account'))
    await userEvent.click(screen.getByRole('button',{name:'Close'}))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(screen.getByTestId('home-account-selector'))
  })

  it('presents transfers and settlements as neutral money movements', () => {
    const base = groups[0]!.records[0]!
    render(<HomeScreen {...props({recordGroups:[{...groups[0]!,records:[
      {...base,id:'transfer',journalKind:'transfer',description:'Move money'},
      {...base,id:'settlement',journalKind:'settlement_in',direction:'in',description:'Settlement received'},
    ]}]})} />)
    const rows = screen.getAllByTestId('home-record')
    expect(rows[0]!.querySelector('.home-amount.movement')!.textContent).not.toContain('−')
    expect(rows[1]!.querySelector('.home-amount.movement')).toBeTruthy()
  })

})
