// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import UniversalQuickAddSheet from './UniversalQuickAddSheet'
import { createUniversalQuickAddSession, updateUniversalQuickAddValues } from '../lib/universalQuickAdd'
import type { MoneyContextCatalog } from '../lib/moneyContextCatalog'
const mocks=vi.hoisted(()=>({load:vi.fn(),submit:vi.fn(),commit:vi.fn(),lock:vi.fn()}))
vi.mock('../hooks/useAuth',()=>({useAuth:()=>({authUser:{participantId:'self'}})}))
vi.mock('../lib/moneyContextCatalog',()=>({EMPTY_MONEY_CONTEXT_CATALOG:{people:[],groups:[],trips:[],peopleParticipants:[]},loadMoneyContextCatalog:mocks.load}))
vi.mock('../lib/quickAccounts',()=>({loadQuickAccounts:async()=>[{id:'wallet',name:'Wallet',currency:'MYR',account_type:'cash',is_default:true}]}))
const self={id:'self',displayName:'Me',kind:'account' as const}
const people=['Ada','Ben','Cora'].map((displayName,i)=>({kind:'person' as const,personId:`p${i}`,participantId:`f${i}`,participantIds:[`f${i}`],participantKind:'manual' as const,displayName}))
const trips=Array.from({length:6},(_,i)=>({kind:'space' as const,spaceId:`t${i}`,spaceType:'trip' as const,displayName:`Journey ${i}`}))
const catalog:MoneyContextCatalog={people,peopleParticipants:people.map(p=>({id:p.participantId,displayName:p.displayName,kind:p.participantKind})),groups:[{...trips[0],spaceId:'g0',spaceType:'group',displayName:'Home group'}],trips}
function Harness({shared=false}:{shared?:boolean}){
 const [session,setSession]=useState(()=>createUniversalQuickAddSession({identityKey:'u',sessionId:'s',clientRequestId:'r',entryPoint:'global',startedAtMs:1,context:{ref:shared?trips[0]:{kind:'personal'},availableParticipants:shared?[self,...catalog.peopleParticipants]:[self],currentParticipantId:'self',defaultCurrency:'MYR'},initialValues:{amount:'12+8',calculation:'12+8',description:'Tea',category:'Coffee',categorySource:'USER',selectedParticipantIds:shared?['self','f0']:['self']}}))
 return <UniversalQuickAddSheet session={session} expenses={[]} onUpdate={patch=>setSession(s=>updateUniversalQuickAddValues(s,patch))} onClose={()=>{}} onPickerOpenChange={mocks.lock} onCommitContext={async(ref,ids)=>{mocks.commit(ref,ids);const next={...session,context:{...session.context!,ref,availableParticipants:[self,...catalog.peopleParticipants]},values:{...session.values,selectedParticipantIds:ids?['self',...ids]:['self']}};setSession(next);return {ok:true,session:next}}} onConfigureSplit={async()=>true} onSubmit={mocks.submit}/>
}
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.load.mockResolvedValue(catalog);render(<Harness/>)})
afterEach(cleanup)
const header=()=>screen.getByTestId('quick-add-ledger')
it('replaces categories, keeps draft values, pauses every save button and Escape returns focus',async()=>{
 await screen.findByRole('button',{name:/Wallet/});fireEvent.click(header())
 expect(screen.queryByRole('button',{name:'Coffee'})).toBeNull()
 expect(screen.getByRole('button',{name:'Save and close'}).hasAttribute('disabled')).toBe(true)
 fireEvent.click(screen.getByRole('tab',{name:'Trips'}));await screen.findByRole('button',{name:'Journey 0'})
 expect(header().textContent).toContain('Personal ledger');expect(mocks.commit).not.toHaveBeenCalled()
 expect((screen.getByRole('textbox',{name:'Amount'}) as HTMLInputElement).value).toBe('12+8')
 expect(document.activeElement).not.toBe(screen.getByRole('searchbox'))
 fireEvent.keyDown(header(),{key:'Escape'})
 await waitFor(()=>expect(document.activeElement).toBe(header()))
 expect(screen.getByRole('button',{name:'Coffee'}).getAttribute('aria-pressed')).toBe('true')
 expect(mocks.lock).toHaveBeenLastCalledWith(false);expect(mocks.submit).not.toHaveBeenCalled()
})
it('expands More within the same panel and commits only a real option',async()=>{
 fireEvent.click(header());fireEvent.click(screen.getByRole('tab',{name:'Trips'}));await screen.findByRole('button',{name:'Journey 0'})
 expect(screen.queryByRole('button',{name:'Journey 5'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'More trips ↓'}))
 expect(screen.getByRole('button',{name:'Journey 5'})).toBeTruthy();expect(screen.getAllByRole('dialog')).toHaveLength(1)
 fireEvent.click(screen.getByRole('button',{name:'Journey 5'}));await waitFor(()=>expect(header().getAttribute('aria-expanded')).toBe('false'))
 expect(mocks.commit).toHaveBeenCalledWith(trips[5],undefined);expect(header().textContent).toContain('Journey 5')
 expect((screen.getByRole('textbox',{name:'Description'}) as HTMLInputElement).value).toBe('Tea')
})
it('keeps pending friends across filters and only confirmation enters the prefilled original split',async()=>{
 fireEvent.click(header());fireEvent.click(screen.getByRole('tab',{name:'Friends'}));await screen.findByRole('checkbox',{name:'Ada'})
 fireEvent.click(screen.getByRole('checkbox',{name:'Ada'}));fireEvent.click(screen.getByRole('checkbox',{name:'Cora'}))
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Ben'}})
 expect(screen.getByText('2 selected')).toBeTruthy();expect(mocks.commit).not.toHaveBeenCalled();expect(header().textContent).toContain('Personal ledger')
 fireEvent.click(screen.getByRole('button',{name:'Use selected friends'}))
 await screen.findByRole('dialog',{name:'Split expense'})
 expect((screen.getByRole('checkbox',{name:'Ada'}) as HTMLInputElement).checked).toBe(true)
 expect((screen.getByRole('checkbox',{name:'Cora'}) as HTMLInputElement).checked).toBe(true)
 expect(mocks.commit).toHaveBeenCalledWith(people[0],['f0','f2']);expect(mocks.submit).not.toHaveBeenCalled()
})
it('cancels a pending friend set by clicking the header again',async()=>{
 fireEvent.click(header());fireEvent.click(screen.getByRole('tab',{name:'Friends'}));await screen.findByRole('checkbox',{name:'Ada'});fireEvent.click(screen.getByRole('checkbox',{name:'Ada'}));fireEvent.click(header());fireEvent.click(header());fireEvent.click(screen.getByRole('tab',{name:'Friends'}));await screen.findByRole('checkbox',{name:'Ada'})
 expect((screen.getByRole('checkbox',{name:'Ada'}) as HTMLInputElement).checked).toBe(false);expect(mocks.commit).not.toHaveBeenCalled()
})
it('shows actual split impact inline and Keep current leaves the committed configuration',async()=>{
 cleanup();render(<Harness shared/>);fireEvent.click(header());fireEvent.click(screen.getByRole('tab',{name:'Groups'}));await screen.findByRole('button',{name:'Home group'});fireEvent.click(screen.getByRole('button',{name:'Home group'}))
 expect(screen.getByText(/replace this 2-person split/)).toBeTruthy();expect(screen.getAllByRole('dialog')).toHaveLength(1);expect(mocks.commit).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Keep current'}));expect(header().textContent).toContain('Journey 0')
 expect(screen.getByRole('button',{name:/Split/}).textContent).toContain('2 people')
})
it('distinguishes fetch failure from empty results and supports Retry',async()=>{
 cleanup();mocks.load.mockRejectedValueOnce(new Error('offline'));render(<Harness/>);fireEvent.click(header());fireEvent.click(screen.getByRole('tab',{name:'Trips'}))
 await screen.findByRole('alert');expect(screen.queryByText('No trips yet.')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByRole('button',{name:'Journey 0'})
})
it('supports arrow navigation while browsing without committing a ledger',async()=>{
 fireEvent.click(header());fireEvent.keyDown(screen.getByRole('tab',{name:'Personal'}),{key:'ArrowRight'})
 expect(screen.getByRole('tab',{name:'Trips'}).getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Trips'}));expect(mocks.commit).not.toHaveBeenCalled()
})
