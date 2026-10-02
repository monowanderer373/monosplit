// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UniversalQuickAddSheet from './UniversalQuickAddSheet'
import { createUniversalQuickAddSession, updateUniversalQuickAddValues } from '../lib/universalQuickAdd'
const mocked=vi.hoisted(()=>({submit:vi.fn()}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({authUser:{participantId:'self'}})}))
vi.mock('../lib/moneyContextCatalog',()=>({EMPTY_MONEY_CONTEXT_CATALOG:{people:[],groups:[],trips:[],peopleParticipants:[]},loadMoneyContextCatalog:async()=>({people:[],groups:[],trips:[],peopleParticipants:[]})}))
vi.mock('../lib/quickAccounts',()=>({loadQuickAccounts:async()=>[{id:'wallet',name:'Touch n Go',currency:'MYR',account_type:'ewallet',is_default:true}]}))
const self={id:'self',displayName:'Me',kind:'account' as const}
function Harness({shared=false}:{shared?:boolean}={}){const [session,setSession]=useState(()=>createUniversalQuickAddSession({identityKey:'u',sessionId:'s',clientRequestId:'r',startedAtMs:1,entryPoint:'global',context:{ref:shared?{kind:'space',spaceId:'g',spaceType:'group',displayName:'Group'}:{kind:'personal'},currentParticipantId:'self',availableParticipants:shared?[self,{id:'friend',displayName:'Alex',kind:'manual'}]:[self],defaultCurrency:'MYR'}}));return <UniversalQuickAddSheet session={session} expenses={[]} onUpdate={patch=>setSession(s=>updateUniversalQuickAddValues(s,patch))} onClose={()=>{}} onOpenContextPicker={()=>{}} onConfigureSplit={async()=>true} onSubmit={mocked.submit}/>}
beforeEach(()=>{localStorage.clear();mocked.submit.mockReset();mocked.submit.mockResolvedValue({ok:true});render(<Harness/>)})
afterEach(cleanup)
describe('Quick Add capture',()=>{
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
   fireEvent.click(screen.getByRole('button',{name:/Date$/}));
   expect(screen.getByRole('dialog',{name:'Date'})).toBeTruthy();
  } finally {
   cleanup();delete (HTMLElement.prototype as unknown as {inert?:boolean}).inert;
  }
 })
 it('uses category as an editable description and saves an expression without pressing equals',async()=>{
  fireEvent.click(screen.getByRole('button',{name:'Coffee'}))
  expect((screen.getByRole('textbox',{name:'Description'}) as HTMLInputElement).value).toBe('Coffee')
  for(const name of ['1','2','+','8'])fireEvent.click(screen.getByRole('button',{name}))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Save and continue'}).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'Save and continue'}))
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
