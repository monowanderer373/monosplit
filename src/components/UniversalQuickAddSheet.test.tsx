// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UniversalQuickAddSheet from './UniversalQuickAddSheet'
import { createUniversalQuickAddSession, updateUniversalQuickAddValues } from '../lib/universalQuickAdd'
const mocked=vi.hoisted(()=>({submit:vi.fn(),accounts:vi.fn()}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({authUser:{participantId:'self'}})}))
vi.mock('../lib/moneyContextCatalog',()=>({EMPTY_MONEY_CONTEXT_CATALOG:{people:[],groups:[],trips:[],peopleParticipants:[]},loadMoneyContextCatalog:async()=>({people:[],groups:[],trips:[],peopleParticipants:[]})}))
vi.mock('../lib/quickAccounts',()=>({loadQuickAccounts:mocked.accounts}))
vi.mock('../lib/multicurrencyRepository',()=>({loadFundingMetadata:async()=>({bundles:[],anchors:[]})}))
const self={id:'self',displayName:'Me',kind:'account' as const}
function Harness({shared=false}:{shared?:boolean}={}){const [session,setSession]=useState(()=>createUniversalQuickAddSession({identityKey:'u',sessionId:'s',clientRequestId:'r',startedAtMs:1,entryPoint:'global',context:{ref:shared?{kind:'space',spaceId:'g',spaceType:'group',displayName:'Group'}:{kind:'personal'},currentParticipantId:'self',availableParticipants:shared?[self,{id:'friend',displayName:'Alex',kind:'manual'}]:[self],defaultCurrency:'MYR'}}));return <UniversalQuickAddSheet session={session} expenses={[]} onUpdate={patch=>setSession(s=>updateUniversalQuickAddValues(s,patch))} onClose={()=>{}} onCommitContext={async()=>({ok:false})} onPickerOpenChange={()=>{}} onConfigureSplit={async()=>true} onSubmit={mocked.submit}/>}
beforeEach(()=>{mocked.accounts.mockReset();mocked.accounts.mockResolvedValue([{id:'wallet',parentAccountId:'wallet',name:'Touch n Go',currency:'MYR',account_type:'ewallet',accountType:'ewallet',accountClass:'asset',archived:false,openingStatus:'unknown',entrySumMinor:0,version:1,parentVersion:1,displayOrder:0,isDefault:true,is_default:true}]);localStorage.clear();mocked.submit.mockReset();mocked.submit.mockResolvedValue({ok:true});render(<Harness/>)})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
describe('Quick Add capture',()=>{
 it('preserves a never-dispatched offline expense draft when account reads are unavailable',async()=>{
  cleanup();vi.spyOn(navigator,'onLine','get').mockReturnValue(false);mocked.accounts.mockRejectedValue(new Error('offline'));render(<Harness/>)
  fireEvent.click(screen.getByRole('button',{name:'Food'}));fireEvent.click(screen.getByRole('button',{name:'1'}));fireEvent.click(screen.getByRole('button',{name:'2'}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Save and close'}).hasAttribute('disabled')).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Save and close'}))
  await waitFor(()=>expect(mocked.submit).toHaveBeenCalledOnce());expect(mocked.submit.mock.calls[0][0].values).toMatchObject({amount:'12.00',fundingPlan:{mode:'deferred',primary_account_id:null,legs:[]}})
 })
 it('blocks an unavailable online account capability instead of retrying a legacy debit path',async()=>{
  cleanup();mocked.accounts.mockRejectedValue(new Error('missing capability'));render(<Harness/>)
  fireEvent.click(screen.getByRole('button',{name:'Food'}));fireEvent.click(screen.getByRole('button',{name:'1'}));await screen.findByText(/Accounts unavailable/)
  expect(screen.getByRole('button',{name:'Save and close'}).hasAttribute('disabled')).toBe(true);expect(mocked.submit).not.toHaveBeenCalled()
 })

 it('groups calculator operands and results while saving the original exact amount',async()=>{
  fireEvent.click(screen.getByRole('button',{name:'Food'}))
  for(const name of ['9','0','0','0','0'])fireEvent.click(screen.getByRole('button',{name}))
  const input=screen.getByRole('textbox',{name:'Amount'}) as HTMLInputElement
  expect(input.value).toBe('90,000')
  fireEvent.click(screen.getByRole('button',{name:'Backspace'}))
  expect(input.value).toBe('9,000')
  fireEvent.click(screen.getByRole('button',{name:'+'}))
  for(const name of ['1','0','0','0'])fireEvent.click(screen.getByRole('button',{name}))
  expect(input.value).toBe('9,000+1,000')
  expect(screen.getByText('= 10,000.00')).toBeTruthy()
  await waitFor(()=>expect(screen.getByRole('button',{name:'Save and close'}).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'Save and close'}))
  await waitFor(()=>expect(mocked.submit).toHaveBeenCalled())
  expect(mocked.submit.mock.calls[0][0]).toMatchObject({values:{amount:'10000.00',calculation:'10000.00'}})
 })
 it('restores interaction after dismissing a nested panel',async()=>{
  cleanup()
  Object.defineProperty(HTMLElement.prototype,'inert',{configurable:true,get(){return this.hasAttribute('inert')},set(value){this.toggleAttribute('inert',!!value)}})
  try {
   render(<Harness/>);
   await screen.findByRole('button',{name:/Touch n Go/});
   fireEvent.click(screen.getByRole('button',{name:/Touch n Go/}));
   const content=screen.getByRole('textbox',{name:'Amount',hidden:true}).closest('.qa-content') as HTMLElement;
   expect(content.inert).toBe(true);
   fireEvent.click(screen.getByRole('button',{name:'Close panel'}));
   await waitFor(()=>expect(content.inert).toBe(false));
   fireEvent.click(screen.getByRole('button',{name:/^Date:/}));
   expect(screen.getByRole('dialog',{name:'Date'})).toBeTruthy();
  } finally {
   cleanup();delete (HTMLElement.prototype as unknown as {inert?:boolean}).inert;
  }
 })
 it('keeps Note empty on category selection and saves evaluated amount through the accessible next action',async()=>{
  fireEvent.click(screen.getByRole('button',{name:'Coffee'}))
  expect((screen.getByRole('textbox',{name:'Note'}) as HTMLInputElement).value).toBe('')
  for(const name of ['1','2','+','8'])fireEvent.click(screen.getByRole('button',{name}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Save options'}).hasAttribute('disabled')).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Save options'}))
  fireEvent.click(screen.getByRole('button',{name:'Save & next'}))
  await waitFor(()=>expect(mocked.submit).toHaveBeenCalled())
  expect(mocked.submit.mock.calls[0][0]).toMatchObject({continueAdding:true,values:{amount:'20.00',description:'Coffee'}})
 })
 it('keeps the draft on a failed save and clears both the expression and value with C',async()=>{
  mocked.submit.mockResolvedValue({ok:false,error:'invalid_amount'})
  fireEvent.click(screen.getByRole('button',{name:'Food'}));fireEvent.click(screen.getByRole('button',{name:'9'}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Save and close'}).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'Save and close'}))
  await screen.findByRole('alert')
  expect((screen.getByRole('textbox',{name:'Amount'}) as HTMLInputElement).value).toBe('9')
  fireEvent.click(screen.getByRole('button',{name:'Clear calculation'}))
  expect((screen.getByRole('textbox',{name:'Amount'}) as HTMLInputElement).value).toBe('')
 })
 it('shows equal shares and assigns the last person the exact remainder',async()=>{
  cleanup();render(<Harness shared/>);
  fireEvent.click(screen.getByRole('button',{name:'9'}));fireEvent.click(screen.getByRole('button',{name:'0'}));
  fireEvent.click(screen.getByRole('button',{name:/Split/}));
  await screen.findByRole('dialog',{name:'Split expense'});
  expect(screen.getAllByText('RM 45.00')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button',{name:'Amounts'}));
  fireEvent.change(screen.getByRole('textbox',{name:'Share for Me'}),{target:{value:'30'}});
  expect((screen.getByRole('textbox',{name:'Share for Alex'}) as HTMLInputElement).value).toBe('60.00');
 });
 it('opens the account panel and keeps its default selection visible',async()=>{
  await screen.findByRole('button',{name:/Touch n Go/})
  fireEvent.click(screen.getByRole('button',{name:/Touch n Go/}))
  const row=screen.getByRole('dialog',{name:'Payment account'}).querySelector('[aria-pressed=true]')! 
  expect(row.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('dialog',{name:'Payment account'})).toBeTruthy()
 })
})

 it('reflects participant selection on both the circle and the entire row', async () => {
  cleanup()
  render(<Harness shared />)
  fireEvent.click(screen.getByRole('button',{name:'9'}))
  fireEvent.click(screen.getByRole('button',{name:/Split/}))
  const alex=await screen.findByRole('checkbox',{name:'Alex'}) as HTMLInputElement
  expect(alex.checked).toBe(true)
  expect(alex.closest('.qa-split-person')?.getAttribute('data-selected')).toBe('true')
  fireEvent.click(alex)
  expect(alex.checked).toBe(false)
  expect(alex.closest('.qa-split-person')?.getAttribute('data-selected')).toBe('false')
  fireEvent.click(alex)
  expect(alex.checked).toBe(true)
  expect(alex.closest('.qa-split-person')?.getAttribute('data-selected')).toBe('true')
 })

 it('allows choosing a split before entering an amount without saving an expense', async () => {
  cleanup(); render(<Harness shared />)
  fireEvent.click(screen.getByRole('button',{name:/Split/}))
  await screen.findByRole('dialog',{name:'Split expense'})
  fireEvent.click(screen.getByRole('button',{name:'Apply split'}))
  expect(screen.queryByRole('dialog',{name:'Split expense'})).toBeNull()
  expect((screen.getByRole('textbox',{name:'Amount'}) as HTMLInputElement).value).toBe('')
  expect(mocked.submit).not.toHaveBeenCalled()
 })

it('uses the selected account for deferred funding without asking twice on the capture surface',async()=>{
 fireEvent.click(screen.getByRole('button',{name:'Food'}));fireEvent.click(screen.getByRole('button',{name:'9'}))
 await waitFor(()=>expect(screen.getByRole('button',{name:'Save and close'}).hasAttribute('disabled')).toBe(false))
 expect(screen.queryByText('Paid from',{exact:true})).toBeNull();expect(screen.queryByText('I know the deduction',{exact:true})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Save and close'}))
 await waitFor(()=>expect(mocked.submit).toHaveBeenCalledOnce())
 expect(mocked.submit.mock.calls[0][0].values.fundingPlan).toEqual({mode:'deferred',primary_account_id:'wallet',legs:[],covers_owner_payment:false})
})

it('retains a confirmed actual draft across account panel dismissal and rolls back cancelled edits',async()=>{
 fireEvent.click(screen.getByRole('button',{name:'Food'}));fireEvent.click(screen.getByRole('button',{name:'9'}))
 await screen.findByRole('button',{name:/Touch n Go/})
 fireEvent.click(screen.getByRole('button',{name:/Touch n Go/}))
 fireEvent.click(await screen.findByRole('button',{name:'Actual charge (optional)'}))
 fireEvent.change(screen.getByRole('combobox',{name:'Payment source'}),{target:{value:'wallet'}})
 fireEvent.change(screen.getByRole('textbox',{name:'Amount charged (MYR)'}),{target:{value:'9'}})
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Done'}))
 fireEvent.click(screen.getByRole('button',{name:/Touch n Go/}))
 expect((screen.getByRole('textbox',{name:'Amount charged (MYR)'}) as HTMLInputElement).value).toBe('9')
 fireEvent.change(screen.getByRole('textbox',{name:'Amount charged (MYR)'}),{target:{value:'10'}})
 fireEvent.click(screen.getByRole('button',{name:'Close panel'}))
 fireEvent.click(screen.getByRole('button',{name:'Save and close'}))
 await waitFor(()=>expect(mocked.submit).toHaveBeenCalledOnce())
 expect(mocked.submit.mock.calls[0][0].values.fundingPlan).toMatchObject({mode:'actual',covers_owner_payment:true,legs:[{account_id:'wallet',amount_minor:900}]})
})
