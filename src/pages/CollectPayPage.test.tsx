/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CollectPayScreen } from './CollectPayPage'
import { collectPayService, CollectPaySaveError } from '../lib/collectPayRepository'
import { buildCollectPayItems, financialFingerprint, resolveCollectPayPreview } from '../lib/collectPay'
import { obligation, payment, snapshot } from '../test/collectPayFixtures'
import { useStore } from '../store/useStore'

beforeEach(() => {
  useStore.setState({ lang: 'en' })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
function setup(s = snapshot(), direction: 'pay' | 'collect' = 'pay', detail = true, status: 'loading' | 'ready' | 'error' = 'ready') {
  const item = buildCollectPayItems(s).find(i => i.direction === direction)
  const path = `/collect-pay/${direction}${detail && item ? `?${new URLSearchParams({ item: item.key })}` : ''}`
  const refresh = vi.fn(async (): Promise<void> => undefined)
  const service = { ...collectPayService,
    preview: vi.fn(async (_owner, key, input) => {
      const item = buildCollectPayItems(s).find(i => i.key === key)!
      const proposal = resolveCollectPayPreview(item, { intent: input.intent, partialAmount: input.partialAmount, overpayDisposition: input.overpay })
      return { item, input, fingerprint: financialFingerprint(s, item), ...proposal, accountCurrency: 'MYR' }
    }), save: vi.fn<typeof collectPayService.save>(async () => ({ kind: 'pending' as const, id: 'saved' })) } satisfies typeof collectPayService
  const tree = (readStatus: typeof status) => <MemoryRouter initialEntries={[path]}><Routes><Route path="/collect-pay/:direction" element={
    <CollectPayScreen snapshot={s} status={readStatus} timezone="Asia/Kuala_Lumpur" onRefresh={refresh} service={service} />
  } /></Routes></MemoryRouter>
  const view = render(tree(status))
  return { refresh, service, item, setReadStatus: (status: 'ready' | 'error') => view.rerender(tree(status)) }
}
describe('collect/pay navigable flows', () => {
  it('retains the same attempt if balance_changed follows an already committed proposal', async () => {
    const user = userEvent.setup(); const { service } = setup()
    service.save.mockRejectedValueOnce(new CollectPaySaveError('balance_changed', true))
    await user.click(screen.getByRole('button', { name: 'Record repayment' }))
    const form = screen.getByTestId('collect-pay-form')
    await user.selectOptions(within(form).getByLabelText('Paid from'), 'wallet')
    await user.click(within(form).getByRole('button', { name: 'Review this payment' }))
    await user.click(within(form).getByRole('button', { name: 'Confirm repayment record' }))
    const firstAttempt = service.save.mock.calls[0][2]
    expect(screen.getByTestId('collect-pay-preview')).toBeTruthy()
    expect(within(form).getByLabelText('Paid from').matches(':disabled')).toBe(true)
    await user.click(within(form).getByRole('button', { name: 'Confirm repayment record' }))
    expect(service.save.mock.calls[1][2]).toEqual(firstAttempt)
  })
  it('renders an obsolete group receipt as a blocked confirmation while keeping decline available', () => {
    const s = snapshot([obligation(2800, 'collect')])
    s.expenses[0].scope = 'space'; s.expenses[0].spaceId = 'trip'
    const p = payment(4800, 'collect'); p.scope = 'space'; p.spaceId = 'trip'; s.payments = [p]
    s.cashTrackedPaymentIds = [p.id]
    s.paymentIntents = { [p.id]: { overpay: null, sourceRequestId: null, expectedOutstandingMinor: 4800 } }
    setup(s, 'collect')
    expect(screen.getByRole('alert').textContent).toContain('changed')
    const confirm = screen.getByRole('button', { name: 'Confirm received' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Decline' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('preserves the list context filter and expanded group when returning from detail', async () => {
    const user = userEvent.setup(); setup(snapshot(), 'pay', false)
    await user.selectOptions(screen.getByLabelText('Context filter'), 'friend')
    await user.click(screen.getByRole('button', { name: /Direct shared balance.*Source expense/ }))
    expect(screen.getByText('Source expenses')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect((screen.getByLabelText('Context filter') as HTMLSelectElement).value).toBe('friend')
    expect(screen.getByRole('button', { name: /Direct shared balance.*Source expense/ })).toBeTruthy()
  })
  it('keeps partial input and preview on a save failure and blocks duplicate in-flight submits', async () => {
    const user = userEvent.setup(); const { service, refresh, setReadStatus } = setup()
    refresh.mockImplementationOnce(async () => setReadStatus('error'))
    let reject!: (reason: Error) => void
    service.save.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    await user.click(screen.getByRole('button', { name: 'Record repayment' }))
    const form = screen.getByTestId('collect-pay-form')
    await user.click(within(form).getByRole('button', { name: 'Partial' }))
    const amount = form.querySelector('input[inputmode="decimal"]') as HTMLInputElement
    await user.type(amount, '20')
    await user.selectOptions(within(form).getByLabelText('Paid from'), 'wallet')
    await user.type(within(form).getByLabelText('Note (optional)'), 'Already paid')
    await user.click(within(form).getByRole('button', { name: 'Review this payment' }))
    expect(screen.getByTestId('collect-pay-preview').textContent).toContain('28.00')
    const submit = within(form).getByRole('button', { name: 'Confirm repayment record' })
    fireEvent.click(submit); fireEvent.click(submit)
    expect(service.save).toHaveBeenCalledTimes(1)
    await act(async () => { reject(new Error('network')); await Promise.resolve() })
    expect(form.closest('.cp-content')?.hasAttribute('hidden')).toBe(true)
    act(() => setReadStatus('ready'))
    expect(screen.getByTestId('collect-pay-form')).toBe(form)
    expect(amount.value).toBe('20')
    expect((within(form).getByLabelText('Note (optional)') as HTMLTextAreaElement).value).toBe('Already paid')
    const firstAttempt = service.save.mock.calls[0][2]
    await user.click(within(form).getByRole('button', { name: 'Confirm repayment record' }))
    expect(service.save.mock.calls[1][2]).toEqual(firstAttempt)
    expect(screen.getByRole('status').textContent).toContain('Awaiting the other person’s confirmation')
  })
  it('requires a new preview after concurrent change while keeping editable input', async () => {
    const user = userEvent.setup(); const { service } = setup()
    service.save.mockRejectedValueOnce(new CollectPaySaveError('balance_changed', false))
    await user.click(screen.getByRole('button', { name: 'Record repayment' }))
    const form = screen.getByTestId('collect-pay-form')
    await user.click(within(form).getByRole('button', { name: 'Partial' }))
    const amount = form.querySelector('input[inputmode="decimal"]') as HTMLInputElement
    await user.type(amount, '20'); await user.selectOptions(within(form).getByLabelText('Paid from'), 'wallet')
    await user.click(within(form).getByRole('button', { name: 'Review this payment' }))
    await user.click(within(form).getByRole('button', { name: 'Confirm repayment record' }))
    expect(amount.value).toBe('20'); expect(amount.disabled).toBe(false)
    expect(screen.queryByTestId('collect-pay-preview')).toBeNull()
    expect(within(form).getByRole('button', { name: 'Review this payment' })).toBeTruthy()
  })
  it('shows confirmation and receiving account for a real incoming pending payment without reducing confirmed totals', () => {
    const s = snapshot([obligation(500, 'collect')]); s.payments = [payment(500, 'collect')]; s.cashTrackedPaymentIds = ['payment']
    setup(s, 'collect')
    expect(screen.getByLabelText('Received into')).toBeTruthy()
    expect(screen.getByText(/After confirming receipt:.*0\.00 remaining/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm received' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/5\.00/, { selector: '.cp-total' })).toBeTruthy()
  })
  it('keeps completed payments in history at zero', async () => {
    const s = snapshot([obligation(500, 'collect')]); s.payments = [payment(500, 'collect', 'accepted')]
    const user = userEvent.setup(); setup(s, 'collect', false)
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByRole('button', { name: /Direct shared balance.*Source expense/ })).toBeTruthy()
    expect(screen.queryByText(/All settled/)).toBeNull()
  })
  it.each(['loading', 'error'] as const)('never displays stale amounts or a fake zero while %s', status => {
    setup(snapshot(), 'pay', false, status)
    expect(screen.getByTestId('collect-pay-page').querySelector('.cp-content')?.hasAttribute('hidden')).toBe(true)
    expect(screen.queryByRole('button', { name: /Direct shared balance/ })).toBeNull()
  })
  it('renders incoming unconfirmed records independently when the confirmed balance is zero', () => {
    const s = snapshot(); s.expenses[0].participations.find(p => p.participantId === 'owner')!.state = 'pending'
    setup(s, 'pay', false)
    expect(screen.getAllByText('No confirmed amounts to pay.')[0]).toBeTruthy()
    expect(screen.getByRole('button', { name: /Source expense.*Friend.*Awaiting confirmation/ })).toBeTruthy()
  })
  it('uses the user timezone calendar date and system decimal keyboard fields', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T20:00:00Z')); setup()
    fireEvent.click(screen.getByRole('button', { name: 'Record repayment' }))
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-09')
    fireEvent.click(screen.getByRole('button', { name: 'Partial' }))
    expect(document.querySelector('input[inputmode="decimal"]')?.getAttribute('type')).toBe('text')
  })
  it('renders Chinese labels without altering the scope model', () => {
    useStore.setState({ lang: 'zh' }); setup()
    expect(screen.getByRole('button', { name: '记录还款' })).toBeTruthy()
    expect(screen.getByText('此范围原始净额')).toBeTruthy()
  })
})
