/** @vitest-environment jsdom */
import {act,cleanup,render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router-dom'
import {webcrypto} from 'node:crypto'
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import NotificationTarget from './NotificationTarget'
import {loadNotificationSnapshot,notificationRpc} from '../../lib/notificationRepository'
import {noticeSnapshot} from '../../test/notificationFixtures'
import {useStore} from '../../store/useStore'
import type {usePersonalLedger} from '../../hooks/usePersonalLedger'
vi.mock('../../lib/notificationRepository',async original=>({...await original<typeof import('../../lib/notificationRepository')>(),loadNotificationSnapshot:vi.fn(),notificationRpc:vi.fn()}))
const load=vi.mocked(loadNotificationSnapshot),rpc=vi.mocked(notificationRpc)
const ledger={outbox:[],refresh:vi.fn(),retryCommand:vi.fn(),discardLocalCreate:vi.fn(),discardFailedCreate:vi.fn()} as unknown as ReturnType<typeof usePersonalLedger>
let current=noticeSnapshot()
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();useStore.setState({lang:'en',homeUi:{...useStore.getState().homeUi,balanceHidden:false}});current=noticeSnapshot();load.mockImplementation(async()=>structuredClone(current));vi.stubGlobal('requestAnimationFrame',()=>0);vi.stubGlobal('cancelAnimationFrame',()=>{});vi.stubGlobal('crypto',webcrypto)})
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
  await user.click(screen.getByRole('button',{name:'Complete debit'}));view.unmount();await act(async()=>{release(current);await new Promise(r=>setTimeout(r,0))});expect(rpc).not.toHaveBeenCalled()
 })
 it('completes only the selected intent with exact accepted payer amount; double submit produces one RPC and authoritative result',async()=>{
  const user=userEvent.setup(),{onChange,onViewed}=setup();await screen.findByRole('combobox',{name:'Choose account'})
  await user.selectOptions(screen.getByRole('combobox'),'bank');expect((screen.getByRole('textbox',{name:'Actual debit · MYR'}) as HTMLInputElement).value).toBe('6,000.00')
  rpc.mockImplementation(async(name,args)=>{expect(name).toBe('complete_pending_funding');expect(args).toMatchObject({target_funding_intent_id:'fund-1',target_account_id:'bank',account_amount_minor:600000});expect(args.request_id).toMatch(/^[a-f0-9-]{36}$/);current.funding[0]={...current.funding[0],status:'posted',version:2};return {funding_status:'posted'}})
  await user.dblClick(screen.getByRole('button',{name:'Complete debit'}));await screen.findByText('This task has already been handled. Only its current result is shown.')
  expect(rpc).toHaveBeenCalledTimes(1);expect(onChange).toHaveBeenCalled();expect(onViewed).toHaveBeenCalledWith(expect.objectContaining({ref:{kind:'funding',id:'fund-1'},state:'completed'}));expect(screen.queryByRole('button',{name:'Complete debit'})).toBeNull()
 })
 it('preserves a failed submission draft and reuses the same idempotent request ID after a fresh status check',async()=>{
  const user=userEvent.setup();setup();await screen.findByRole('combobox');await user.selectOptions(screen.getByRole('combobox'),'bank')
  const amount=screen.getByRole('textbox',{name:'Actual debit · MYR'});await user.clear(amount);await user.type(amount,'1250.05')
  rpc.mockRejectedValueOnce(new Error('network failure'));await user.click(screen.getByRole('button',{name:'Complete debit'}));await screen.findByText('The result is not confirmed. Check the latest status before retrying the same operation.')
  const first=rpc.mock.calls[0][1].request_id;await user.click(screen.getByRole('button',{name:'Check latest status'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Complete debit'}).hasAttribute('disabled')).toBe(false));expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('1,250.05')
  rpc.mockImplementationOnce(async()=>{current.funding[0]={...current.funding[0],status:'posted',version:2}});await user.click(screen.getByRole('button',{name:'Complete debit'}));await screen.findByText('This task has already been handled. Only its current result is shown.');expect(rpc.mock.calls[1][1].request_id).toBe(first)
 })
 it('rechecks another-device completion before writing and never offers stale debit controls',async()=>{
  const user=userEvent.setup();setup();await screen.findByRole('combobox');await user.selectOptions(screen.getByRole('combobox'),'bank');current.funding[0]={...current.funding[0],status:'posted',version:2};await user.click(screen.getByRole('button',{name:'Complete debit'}));await screen.findByText('This task has already been handled. Only its current result is shown.');expect(rpc).not.toHaveBeenCalled()
 })
 it('does not replace a newer target with a slow previous read, or treat failed queries as completion',async()=>{
  let resolveOld!:(s:ReturnType<typeof noticeSnapshot>)=>void;load.mockImplementationOnce(()=>new Promise(r=>{resolveOld=r}));const view=setup();view.changeTarget('fund-2');await screen.findByRole('heading',{name:'Dinner with friends'});await act(async()=>resolveOld(current));expect(screen.queryByRole('heading',{name:'Train ticket'})).toBeNull()
  load.mockRejectedValueOnce(new Error('offline'));view.changeTarget('fund-1');await screen.findByText('Updates could not load. Your tasks have not been cleared.');expect(screen.queryByText(/already been handled/)).toBeNull();expect(rpc).not.toHaveBeenCalled()
 })
 it('preserves amount privacy including inputs, aria and tooltip until explicitly revealed',async()=>{
  useStore.setState({homeUi:{...useStore.getState().homeUi,balanceHidden:true}});setup();await screen.findByText('Amounts are hidden. Show them to review or complete this task.');expect(screen.queryByRole('combobox')).toBeNull();expect(screen.queryByRole('textbox')).toBeNull();expect(screen.getByTestId('notification-target').textContent).not.toMatch(/6000|6,000|12.50/);expect(rpc).not.toHaveBeenCalled()
 })
})
