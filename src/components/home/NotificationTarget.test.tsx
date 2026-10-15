/** @vitest-environment jsdom */
import {act,cleanup,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {webcrypto} from 'node:crypto'
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import NotificationTarget from './NotificationTarget'
import {loadNotificationSnapshot,notificationRpc} from '../../lib/notificationRepository'
import {noticeSnapshot} from '../../test/notificationFixtures'
import {clearNotificationFundingDrafts} from '../../lib/notificationDrafts'
import {useStore} from '../../store/useStore'
import type {usePersonalLedger} from '../../hooks/usePersonalLedger'
vi.mock('../../lib/notificationRepository',async original=>({...await original<typeof import('../../lib/notificationRepository')>(),loadNotificationSnapshot:vi.fn(),notificationRpc:vi.fn()}))
const load=vi.mocked(loadNotificationSnapshot),rpc=vi.mocked(notificationRpc)
const ledger={outbox:[],refresh:vi.fn(),retryCommand:vi.fn(),discardLocalCreate:vi.fn(),discardFailedCreate:vi.fn()} as unknown as ReturnType<typeof usePersonalLedger>
let current=noticeSnapshot()
beforeEach(()=>{clearNotificationFundingDrafts();vi.clearAllMocks();sessionStorage.clear();useStore.setState({lang:'en',homeUi:{...useStore.getState().homeUi,balanceHidden:false}});current=noticeSnapshot();load.mockImplementation(async()=>structuredClone(current));vi.stubGlobal('requestAnimationFrame',()=>0);vi.stubGlobal('cancelAnimationFrame',()=>{});vi.stubGlobal('crypto',webcrypto)})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()})
function setup(id='fund-1'){
 const onChange=vi.fn(async()=>{}),onViewed=vi.fn(),onClose=vi.fn()
 const tree=(id:string)=><MemoryRouter><NotificationTarget key={id} identity="identity" owner="owner" target={{kind:'funding',id}} ledger={ledger} onChange={onChange} onViewed={onViewed} onClose={onClose}/></MemoryRouter>
 const view=render(tree(id));return {onChange,onViewed,onClose,unmount:()=>view.unmount(),changeTarget:(id:string)=>view.rerender(tree(id))}
}
describe('real notification target controller',()=>{
 it('does not submit an old financial action after its target has unmounted during a delayed status check',async()=>{
  const user=userEvent.setup(),view=setup();await screen.findByRole('combobox');await user.selectOptions(screen.getByRole('combobox'),'bank')
  let release!:(s:ReturnType<typeof noticeSnapshot>)=>void;load.mockImplementationOnce(()=>new Promise(r=>{release=r}));vi.spyOn(crypto.subtle,'digest').mockResolvedValue(new ArrayBuffer(32))
  await user.click(screen.getByRole('button',{name:'Update balance'}));view.unmount();await act(async()=>{release(current);await new Promise(r=>setTimeout(r,0))});expect(rpc).not.toHaveBeenCalled()
 })
 it('completes only the selected intent with exact accepted payer amount; double submit produces one RPC and authoritative result',async()=>{
  const user=userEvent.setup(),{onChange,onViewed}=setup();await screen.findByRole('combobox',{name:'Choose account'})
  await user.selectOptions(screen.getByRole('combobox'),'bank');expect(screen.queryByRole('textbox')).toBeNull();expect(screen.getByTestId('notification-target').textContent).toContain('6,000.00')
  rpc.mockImplementation(async(name,args)=>{expect(name).toBe('complete_pending_funding');expect(args).toMatchObject({target_funding_intent_id:'fund-1',target_account_id:'bank',account_amount_minor:600000});expect(args.request_id).toMatch(/^[a-f0-9-]{36}$/);current.funding[0]={...current.funding[0],status:'posted',version:2};return {funding_status:'posted'}})
  await user.dblClick(screen.getByRole('button',{name:'Update balance'}));await screen.findByText('This task has already been handled. Only its current result is shown.')
  expect(rpc).toHaveBeenCalledTimes(1);expect(onChange).toHaveBeenCalled();expect(onViewed).toHaveBeenCalledWith(expect.objectContaining({ref:{kind:'funding',id:'fund-1'},state:'completed'}));expect(screen.queryByRole('button',{name:'Update balance'})).toBeNull()
 })
 it('preserves a failed submission draft and reuses the same idempotent request ID after a fresh status check',async()=>{
  current.expenses[0].currency='VND';current.funding[0].expense_currency='VND'
  const user=userEvent.setup();setup();await screen.findByRole('combobox');await user.selectOptions(screen.getByRole('combobox'),'bank')
  const amount=screen.getByRole('textbox',{name:'Amount charged (MYR)'});await user.clear(amount);await user.type(amount,'1250.05')
  rpc.mockRejectedValueOnce(new Error('network failure'));await user.click(screen.getByRole('button',{name:'Update balance'}));await screen.findByText('The result is not confirmed. Check the latest status before retrying the same operation.')
  const first=rpc.mock.calls[0][1].request_id;await user.click(screen.getByRole('button',{name:'Check latest status'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Update balance'}).hasAttribute('disabled')).toBe(false));expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('1,250.05')
  rpc.mockImplementationOnce(async()=>{current.funding[0]={...current.funding[0],status:'posted',version:2}});await user.click(screen.getByRole('button',{name:'Update balance'}));await screen.findByText('This task has already been handled. Only its current result is shown.');expect(rpc.mock.calls[1][1].request_id).toBe(first)
 })
 it('rechecks another-device completion before writing and never offers stale debit controls',async()=>{
  const user=userEvent.setup();setup();await screen.findByRole('combobox');await user.selectOptions(screen.getByRole('combobox'),'bank');current.funding[0]={...current.funding[0],status:'posted',version:2};await user.click(screen.getByRole('button',{name:'Update balance'}));await screen.findByText('This task has already been handled. Only its current result is shown.');expect(rpc).not.toHaveBeenCalled()
 })
 it('does not replace a newer target with a slow previous read, or treat failed queries as completion',async()=>{
  let resolveOld!:(s:ReturnType<typeof noticeSnapshot>)=>void;load.mockImplementationOnce(()=>new Promise(r=>{resolveOld=r}));const view=setup();view.changeTarget('fund-2');await screen.findByRole('heading',{name:'Dinner with friends'});await act(async()=>resolveOld(current));expect(screen.queryByRole('heading',{name:'Train ticket'})).toBeNull()
  load.mockRejectedValueOnce(new Error('offline'));view.changeTarget('fund-1');await screen.findByText('Updates could not load. Your tasks have not been cleared.');expect(screen.queryByText(/already been handled/)).toBeNull();expect(rpc).not.toHaveBeenCalled()
 })
 it('preserves amount privacy including inputs, aria and tooltip until explicitly revealed',async()=>{
  useStore.setState({homeUi:{...useStore.getState().homeUi,balanceHidden:true}});setup();await screen.findByText('Amounts are hidden. Show them to review or complete this task.');expect(screen.queryByRole('combobox')).toBeNull();expect(screen.queryByRole('textbox')).toBeNull();expect(screen.getByTestId('notification-target').textContent).not.toMatch(/6000|6,000|12.50/);expect(rpc).not.toHaveBeenCalled()
 })
})

describe('approved A actual payment contract',()=>{
 it('shows actual paid contribution when bill/share differ and never submits either bill or consumption share',async()=>{
  const expense=current.expenses[0],own=expense.participations[0],other={...own,id:'part-other',participantId:'other',nameSnapshot:'Friend',order:1}
  current.expenses[0]={...expense,scope:'direct',totalMinor:720000,participantCount:2,participations:[own,other],payerContributions:[{expenseId:expense.id,expenseParticipationId:own.id,amountMinor:300000},{expenseId:expense.id,expenseParticipationId:other.id,amountMinor:420000}],shares:[{expenseId:expense.id,expenseParticipationId:own.id,amountMinor:240000},{expenseId:expense.id,expenseParticipationId:other.id,amountMinor:480000}]}
  current.funding[0].expense_amount_minor=300000
  const user=userEvent.setup();setup();await screen.findByRole('combobox');await user.selectOptions(screen.getByRole('combobox'),'bank')
  expect(screen.queryByRole('textbox')).toBeNull();expect(screen.getByTestId('notification-target').textContent).toContain('7,200.00');expect(screen.getByText('Your payment')).toBeTruthy();expect(screen.getByTestId('notification-target').textContent).toContain('3,000.00')
  rpc.mockResolvedValueOnce({});await user.click(screen.getByRole('button',{name:'Update balance'}));await waitFor(()=>expect(rpc).toHaveBeenCalledTimes(1));expect(rpc.mock.calls[0][1].account_amount_minor).toBe(300000)
 })
 it('clears foreign input on account/currency change, preserves a deliberately entered draft on close/reopen and requires explicit actual amount',async()=>{
  current.accounts.push({...current.accounts[1],id:'vnd',name:'Vietnam wallet',currency:'VND'})
  const user=userEvent.setup(),view=setup();await screen.findByRole('combobox');await user.selectOptions(screen.getByRole('combobox'),'vnd')
  const input=screen.getByRole('textbox',{name:'Amount charged (VND)'});expect((input as HTMLInputElement).value).toBe('');expect(screen.getByRole('button',{name:'Update balance'}).hasAttribute('disabled')).toBe(true)
  await user.type(input,'34000');expect((input as HTMLInputElement).value).toBe('34,000');view.unmount();setup();await screen.findByRole('combobox');expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('34,000')
  await user.selectOptions(screen.getByRole('combobox'),'bank');expect(screen.queryByRole('textbox')).toBeNull();await user.selectOptions(screen.getByRole('combobox'),'vnd');expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');expect(rpc).not.toHaveBeenCalled()
 })
 it('does not guess an unknown contribution from total/share and requires input even in the same currency',async()=>{
  current.funding[0].expense_amount_minor=undefined
  const user=userEvent.setup();setup();await screen.findByRole('combobox');await user.selectOptions(screen.getByRole('combobox'),'bank');expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');expect(screen.getByRole('button',{name:'Update balance'}).hasAttribute('disabled')).toBe(true);expect(screen.getByText('Enter your actual payment; the bill total is not used.')).toBeTruthy();expect(rpc).not.toHaveBeenCalled()
 })
 it('shows no-eligible-account recovery and never offers a financial confirmation',async()=>{
  current.accounts=[];setup();await screen.findByRole('heading',{name:'No account available'});expect(screen.queryByRole('combobox')).toBeNull();expect(screen.queryByRole('button',{name:'Update balance'})).toBeNull();expect(screen.getByRole('button',{name:'View accounts'})).toBeTruthy();expect(rpc).not.toHaveBeenCalled()
 })
 it('revalidates a newly archived account before dispatch and removes its stale submit capability',async()=>{
  const user=userEvent.setup();setup();await screen.findByRole('combobox');await user.selectOptions(screen.getByRole('combobox'),'bank');current.accounts[1].archived=true;await user.click(screen.getByRole('button',{name:'Update balance'}));await screen.findByText('This account is archived. The linked debit cannot be reassigned here.');expect(screen.getByRole('button',{name:'Update balance'}).hasAttribute('disabled')).toBe(true);expect(rpc).not.toHaveBeenCalled()
 })
})

it('refreshes account eligibility without changing the pending intent version and does not loop home reconciliation',async()=>{
 current.accounts=[]
 const onChange=vi.fn(async()=>{}),onViewed=vi.fn()
 const tree=(version:string)=><MemoryRouter><NotificationTarget sourceVersion={version} identity="identity" owner="owner" target={{kind:'funding',id:'fund-1'}} ledger={ledger} onChange={onChange} onViewed={onViewed} onClose={()=>{}}/></MemoryRouter>
 const view=render(tree('source-1'));await screen.findByRole('heading',{name:'No account available'})
 current.accounts=noticeSnapshot().accounts;view.rerender(tree('source-2'));await screen.findByRole('combobox');expect(screen.queryByRole('heading',{name:'No account available'})).toBeNull()
 current.funding[0]={...current.funding[0],status:'posted',version:2};view.rerender(tree('source-3'));await screen.findByText('This task has already been handled. Only its current result is shown.');await waitFor(()=>expect(onChange).toHaveBeenCalledTimes(1));view.rerender(tree('source-4'));await waitFor(()=>expect(load).toHaveBeenCalledTimes(4));expect(onChange).toHaveBeenCalledTimes(1);expect(rpc).not.toHaveBeenCalled()
})

it.each([{due:'2026-10-14',review:2,allowed:false},{due:'2999-10-15',review:3,allowed:false},{due:'2026-10-14',review:3,allowed:true}])('allows a scheduled installment only for fresh explicit review $review/$due',async({due,review,allowed})=>{
 current.plans=[{id:'plan',currency:'MYR',status:'active',version:1,updated_at:'2026-10-15'}];current.installments=[{id:'installment',plan_id:'plan',status:'scheduled',version:3,due_on:due,principal_minor:12000,repayment_account_id:'bank',updated_at:'2026-10-15'}]
 render(<MemoryRouter><NotificationTarget reviewVersion={review} identity="identity" owner="owner" target={{kind:'installment',id:'installment'}} ledger={ledger} onChange={async()=>{}} onViewed={()=>{}} onClose={()=>{}}/></MemoryRouter>)
 await waitFor(()=>expect(screen.getByTestId('notification-target').querySelector('[aria-busy="true"]')).toBeNull());expect(!!screen.queryByRole('button',{name:'Record as paid'})).toBe(allowed);expect(rpc).not.toHaveBeenCalled()
})
it('requires explicit reveal before notification details can open the original financial editor',async()=>{
 useStore.setState({homeUi:{...useStore.getState().homeUi,balanceHidden:true}});const user=userEvent.setup();render(<MemoryRouter><NotificationTarget details identity="identity" owner="owner" target={{kind:'funding',id:'fund-1'}} ledger={ledger} onChange={async()=>{}} onViewed={()=>{}} onClose={()=>{}}/></MemoryRouter>);await screen.findByText('Expense details');expect(screen.queryByRole('button',{name:/Edit Train ticket/})).toBeNull();expect(screen.queryByRole('textbox')).toBeNull();expect(screen.getByTestId('notification-target').textContent).not.toContain('6,000');await user.click(screen.getByText('View record',{selector:'summary'}));await user.click(screen.getAllByRole('button',{name:'Show amounts'})[0]);expect(screen.getByRole('button',{name:'Edit Train ticket'})).toBeTruthy()
})
