// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExpenseActionSheet from './ExpenseActionSheet'
import { useStore } from '../store/useStore'
import type { CanonicalExpense } from '../types'
const mocks = vi.hoisted(() => ({ metadata: vi.fn(), financial: vi.fn(), direct: vi.fn(), space: vi.fn(), cancel: vi.fn(), refresh: vi.fn() }))
vi.mock('../lib/ledgerRepository', () => ({ ledgerRepository: { updateExpenseMetadata: mocks.metadata, replaceExpenseFinancials: mocks.financial, voidExpense: mocks.cancel } }))
vi.mock('../lib/personRepository', () => ({ personRepository: { listPeople: vi.fn().mockResolvedValue([{ id:'person-lan', ownerParticipantId:'you', displayName:'Lan', linkedParticipantId:null, mergedIntoPersonId:null, manualParticipantIds:['manual-lan'], primaryManualParticipantId:'manual-lan', state:'manual', friendshipStatus:'none' }]) } }))
vi.mock('../lib/expenseChangeRepository', () => ({ expenseChangeRepository: { proposeDirectChange: mocks.direct, correctSpaceExpense: mocks.space } }))
function expense(scope: CanonicalExpense['scope'] = 'personal', pending = false): CanonicalExpense {
  const people = scope === 'personal' ? ['you'] : ['you', 'lan']
  return {
    id: 'expense', clientRequestId: 'request', scope, spaceId: scope === 'space' ? 'group' : null, createdBy: 'you', totalMinor: 3500, currency: 'MYR', description: 'Dinner', category: 'Food', occurredOn: '2026-10-02', participantCount: people.length, status: 'active', version: 1, correctsExpenseId: null, terminationKind: null, voidedAt: null, createdAt: '2026-10-02T08:00:00Z', updatedAt: '2026-10-02T08:00:00Z',
    participations: people.map((id, order) => ({ id, expenseId: 'expense', participantId: id, nameSnapshot: id === 'you' ? 'You' : 'Lan', order, state: pending && id === 'lan' ? 'pending' : 'accepted', trackingMode: 'tracked' })),
    payerContributions: people.map((id, index) => ({ expenseId: 'expense', expenseParticipationId: id, amountMinor: index === 0 ? 3500 : 0 })),
    shares: people.map(id => ({ expenseId: 'expense', expenseParticipationId: id, amountMinor: scope === 'personal' ? 3500 : 1750 })),
  }
}
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Edit Dinner' }))
const amount = (value: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Total amount' }), { target: { value } })
const description = (value: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value } })
function mount(record = expense()) { return render(<ExpenseActionSheet expense={record} currentParticipantId="you" onRefresh={mocks.refresh} />) }
beforeEach(() => {
  vi.clearAllMocks()
  useStore.setState({ lang: 'en' })
  mocks.financial.mockReset().mockResolvedValue(2)
  mocks.metadata.mockReset().mockResolvedValue(3)
  mocks.direct.mockReset().mockResolvedValue({})
  mocks.space.mockReset().mockResolvedValue({})
  mocks.cancel.mockReset().mockResolvedValue(2)
  mocks.refresh.mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)
describe('unified paper expense editor', () => {
  it('places a live split summary between the type choices and Save changes', () => {
    mount(expense('direct', true)); open()
    const summary = screen.getByTestId('expense-edit-review')
    const shared = screen.getByRole('button', { name: 'Shared expense' })
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(shared.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(summary.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(summary.textContent).toContain('Split summary')
    expect(summary.textContent).toContain('17.50')
    expect(summary.textContent).not.toContain('→')
    amount('40')
    expect(summary.textContent).toContain('20.00')
    expect(summary.textContent).toContain('→')
    expect(screen.getByRole('textbox', { name: 'Total amount' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Review changes' })).toBeNull()
    expect(mocks.financial).not.toHaveBeenCalled()
  })

  it('opens shared options directly and keeps personal selected when the split is dismissed', () => {
    mount(); open()
    fireEvent.click(screen.getByRole('button', { name: 'Shared expense' }))
    expect(screen.getByRole('dialog', { name: 'Split expense' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.getByRole('button', { name: 'Personal expense' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('Split details')).toBeNull()
    expect(mocks.financial).not.toHaveBeenCalled()
  })

  it('reuses the split dialog and discards unapplied changes without closing the editor', () => {
    mount(expense('direct')); open()
    expect(screen.queryByRole('textbox', { name: 'Share for Lan' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Shared expense' }))
    expect(screen.getByRole('dialog', { name: 'Split expense' })).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: 'You' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('checkbox', { name: 'Lan' }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Share for You' }), { target: { value: '10' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Split expense' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Edit record' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Shared expense' }))
    expect((screen.getByRole('textbox', { name: 'Share for You' }) as HTMLInputElement).value).toBe('17.50')
    expect(mocks.financial).not.toHaveBeenCalled()
  })
  it('applies a split draft only to the editor until Save changes is clicked', async () => {
    mount(expense('direct')); open()
    fireEvent.click(screen.getByRole('button', { name: 'Shared expense' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Share for You' }), { target: { value: '10' } })
    expect((screen.getByRole('textbox', { name: 'Share for Lan' }) as HTMLInputElement).value).toBe('25.00')
    fireEvent.click(screen.getByRole('button', { name: 'Apply split' }))
    expect(mocks.direct).not.toHaveBeenCalled()
    expect(screen.getByTestId('expense-edit-review').textContent).toContain('25.00')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.direct).toHaveBeenCalledWith(expect.objectContaining({ replacement: expect.objectContaining({ shareAmounts: [1000,2500], contributionAmounts:[3500,0] }) })))
  })

  it('opens directly into all basic fields and hides personal split inputs', () => {
    mount(); open()
    expect(screen.getByRole('dialog', { name: 'Edit record' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Personal expense' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByText('Only you')).toBeNull()
    expect(screen.queryByText('Split details')).toBeNull()
    expect(screen.queryByText('Edit details')).toBeNull()
    expect(screen.queryByText('Edit expense')).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Paid by You' })).toBeNull()
  })
  it('changes a personal record to a shared split after selecting a friend', async () => {
    mount(); open()
    fireEvent.click(screen.getByRole('button', { name: 'Shared expense' }))
    await screen.findByRole('checkbox', { name: 'Lan' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply split' }))
    expect(screen.getByText('Personal → Shared')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.financial).toHaveBeenCalledWith(expect.objectContaining({ nextScope:'direct', participantIds:['you','manual-lan'], contributionAmounts:[3500,0], shareAmounts:[1750,1750] })))
  })
  it('changes an unconfirmed shared record to personal and preserves the whole amount', async () => {
    mount(expense('direct', true)); open()
    fireEvent.click(screen.getByRole('button', { name: 'Personal expense' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.financial).toHaveBeenCalledWith(expect.objectContaining({ nextScope:'personal', participantIds:['you'], contributionAmounts:[3500], shareAmounts:[3500] })))
  })
  it('does not allow a confirmed shared record to silently become personal', () => {
    mount(expense('direct')); open()
    expect((screen.getByRole('button', { name: 'Personal expense' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('requires a friend before saving a shared record', async () => {
    mount(); open()
    fireEvent.click(screen.getByRole('button', { name: 'Shared expense' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply split' }))
    expect(mocks.financial).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('saves amount and metadata from one form with the acknowledged version', async () => {
    mount(); open(); amount('40'); description('dinner and tea')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.financial).toHaveBeenCalledWith(expect.objectContaining({ totalMinor: 4000, contributionAmounts: [4000], shareAmounts: [4000], expectedVersion: 1 }))
    expect(mocks.metadata).toHaveBeenCalledWith(expect.objectContaining({ description: 'Dinner and tea', expectedVersion: 2 }))
  })
  it('uses just metadata RPC when confirmed shared money stays unchanged', async () => {
    mount(expense('direct')); open(); description('Dinner with Lan')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.metadata).toHaveBeenCalledTimes(1))
    expect(mocks.direct).not.toHaveBeenCalled()
    expect(mocks.financial).not.toHaveBeenCalled()
  })
  it('shows the correction summary inline and saves once while preserving principal IDs and currency', async () => {
    mount(expense('direct')); open(); amount('40')
    expect((screen.getByRole('combobox', { name: 'Currency' }) as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByTestId('expense-edit-review')).toBeTruthy()
    expect(mocks.direct).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.direct).toHaveBeenCalledWith(expect.objectContaining({ expectedTargetVersion: 1, kind: 'correction', replacement: expect.objectContaining({ currency: 'MYR', participantIds: ['you', 'lan'], totalMinor: 4000, shareAmounts: [2000, 2000] }) })))
    expect(mocks.financial).not.toHaveBeenCalled()
  })
  it('shows pending linked edits inline before updating and reconfirming the expense', async () => {
    mount(expense('direct', true)); open(); amount('40')
    expect(mocks.financial).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.financial).toHaveBeenCalledTimes(1))
    expect(mocks.direct).not.toHaveBeenCalled()
  })
  it('keeps group corrections on their existing authoritative route', async () => {
    mount(expense('space')); open(); amount('40')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.space).toHaveBeenCalledTimes(1))
    expect(mocks.financial).not.toHaveBeenCalled()
  })
  it('retains unsaved edits after outside dismissal, without writes', async () => {
    mount(); open(); description('Shopping'); amount('54')
    fireEvent.click(screen.getByTestId('expense-editor-scrim'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    open()
    expect((screen.getByRole('textbox', { name: 'Description' }) as HTMLInputElement).value).toBe('Shopping')
    expect((screen.getByRole('textbox', { name: 'Total amount' }) as HTMLInputElement).value).toBe('54')
    expect(mocks.metadata).not.toHaveBeenCalled()
    expect(mocks.financial).not.toHaveBeenCalled()
  })
  it('locks background scroll and restores focus after Escape dismissal', async () => {
    mount(); const trigger = screen.getByRole('button', { name: 'Edit Dinner' }); trigger.focus(); open()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
  })
  it('shows partial save truthfully and retries only remaining details', async () => {
    mocks.metadata.mockRejectedValueOnce(new Error('network')).mockResolvedValue(3)
    mount(); open(); amount('40'); description('Tea')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText(/Amount and split saved/)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.financial).toHaveBeenCalledTimes(1)
    expect(mocks.metadata.mock.calls[1][0].expectedVersion).toBe(2)
  })
  it('blocks inconsistent split changes without persisting anything', async () => {
    mount(expense('direct')); open()
    fireEvent.click(screen.getByRole('button', { name: 'Shared expense' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Share for Lan' }), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply split' }))
    await screen.findByRole('alert')
    expect(mocks.direct).not.toHaveBeenCalled()
    expect(mocks.financial).not.toHaveBeenCalled()
  })
  it('does not dismiss or double submit while saving', async () => {
    let finish!: (value: number) => void
    mocks.financial.mockImplementation(() => new Promise<number>(resolve => { finish = resolve }))
    mount(); open(); amount('40')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    fireEvent.click(screen.getByTestId('expense-editor-scrim'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Saving…' }).hasAttribute('disabled')).toBe(true)
    finish(2)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.financial).toHaveBeenCalledTimes(1)
  })
  it('requires a separate confirmation before cancelling the record', async () => {
    mount(); open()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel expense' }))
    expect(mocks.cancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith('expense', 1))
  })
  it('hides the editor when current participant has no mutation permission', () => {
    render(<ExpenseActionSheet expense={expense()} currentParticipantId="other" onRefresh={mocks.refresh} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('keeps metadata-only editing available for older incomplete split rows', async () => {
    const record = expense('direct')
    record.payerContributions = []
    record.shares = []
    mount(record); open(); description('Older dinner')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.metadata).toHaveBeenCalledTimes(1))
    expect(mocks.financial).not.toHaveBeenCalled()
    expect(mocks.direct).not.toHaveBeenCalled()
  })
})
