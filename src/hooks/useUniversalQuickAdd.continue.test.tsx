// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { UniversalQuickAddProvider, useUniversalQuickAdd } from './useUniversalQuickAdd'
import type { ResolvedMoneyContext } from '../lib/universalQuickAdd'
const mocks=vi.hoisted(()=>({save:vi.fn(),close:vi.fn(),replace:vi.fn(),resolve:vi.fn(),collapse:vi.fn()}))
vi.mock('./useAuth',()=>({useAuth:()=>({authUser:{id:'u',participantId:'self',defaultCurrency:'MYR'}})}))
vi.mock('./usePersonalLedger',()=>({usePersonalLedger:()=>({saveDraft:mocks.save})}))
vi.mock('./useMoneyActionHistory',()=>({useMoneyActionHistory:()=>({action:null,push:vi.fn(),replace:mocks.replace,close:mocks.close,collapseSwitchToCapture:mocks.collapse})}))
vi.mock('../lib/moneyContextCatalog',()=>({resolveMoneyContext:mocks.resolve}))
const self={id:'self',displayName:'Me',kind:'account' as const}
const friend={id:'friend',displayName:'Friend',kind:'manual' as const}
const shared:ResolvedMoneyContext={ref:{kind:'space',spaceId:'trip',spaceType:'trip',displayName:'Trip'},currentParticipantId:'self',availableParticipants:[self,friend],defaultCurrency:'MYR'}
let quick:ReturnType<typeof useUniversalQuickAdd>
function Capture(){const value=useUniversalQuickAdd();useEffect(()=>{quick=value},[value]);return null}
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.save.mockResolvedValue({ok:true,saveState:'recorded'});mocks.resolve.mockImplementation(async({ref}:{ref:ResolvedMoneyContext['ref']})=>({ref,currentParticipantId:'self',defaultCurrency:'MYR',availableParticipants:ref.kind==='personal'?[self]:[self,friend]}));render(<MemoryRouter><UniversalQuickAddProvider identityKey="u"><Capture/></UniversalQuickAddProvider></MemoryRouter>)})
afterEach(cleanup)
describe('Quick Add save lifecycle',()=>{
 it('gives a manually changed ledger a separate request without invalidating the source draft',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared,followPageContext:true});quick.updateValues({amount:'44'})})
  const tripRequest=quick.session!.clientRequestId
  await act(async()=>{quick.requestContextSwitch({kind:'personal'})})
  const personalRequest=quick.session!.clientRequestId
  expect(personalRequest).not.toBe(tripRequest)
  await act(async()=>{await quick.submit()})
  await act(async()=>{quick.open({entryPoint:'global',context:shared,followPageContext:true})})
  expect(quick.session!.clientRequestId).toBe(tripRequest)
  expect(quick.session!.values.amount).toBe('44')
  await act(async()=>{await quick.configureSplit({kind:'personal'})})
  expect(quick.session!.clientRequestId).not.toBe(tripRequest)
 })

 it('remaps a restored friend draft when the manual principal becomes linked',async()=>{
  const oldRef={kind:'person' as const,personId:'person',participantId:'old',participantIds:['old'],participantKind:'manual' as const,displayName:'Alex'}
  const oldContext:ResolvedMoneyContext={...shared,ref:oldRef,availableParticipants:[self,{...friend,id:'old'}]}
  act(()=>{quick.open({entryPoint:'global',context:oldContext});quick.updateValues({amount:'20',splitMode:'exact',exactShareAmounts:{self:'10',old:'10'},payerAmounts:{old:'20'}});quick.close()})
  mocks.resolve.mockResolvedValue({...shared,ref:{...oldRef,participantId:'friend',participantIds:['friend'],participantKind:'account'},availableParticipants:[self,friend]})
  await act(async()=>{quick.open({entryPoint:'global',context:oldRef})})
  expect(quick.session!.values).toMatchObject({selectedParticipantIds:['self','friend'],exactShareAmounts:{self:'10',friend:'10'},payerAmounts:{friend:'20'}})
  expect(quick.contextError).toBe(false)
 })

 it('revalidates draft permissions and keeps inaccessible drafts without personal fallback',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared});quick.updateValues({amount:'99'});quick.close()})
  mocks.resolve.mockResolvedValue(null)
  await act(async()=>{quick.open({entryPoint:'global',spaceCandidateId:'trip',followPageContext:true})})
  expect(quick.contextError).toBe(true)
  expect(quick.session!.context).toBeNull()
  expect(mocks.replace).toHaveBeenLastCalledWith(expect.objectContaining({step:'gate',excludedSpaceId:'trip'}))
  expect(mocks.save).not.toHaveBeenCalled()
 })
 it('does not silently drop a removed draft participant or change their share',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared});quick.updateValues({amount:'99'});quick.close()})
  mocks.resolve.mockResolvedValue({...shared,availableParticipants:[self]})
  await act(async()=>{quick.open({entryPoint:'global',context:shared})})
  expect(quick.contextError).toBe(true)
  expect(quick.session!.context).toBeNull()
  expect(quick.session!.values.selectedParticipantIds).toEqual(['self','friend'])
  await act(async()=>{quick.selectEntryContext(shared.ref)})
  expect(quick.session!.context!.ref).toEqual(shared.ref)
  expect(quick.session!.values).toMatchObject({amount:'99',selectedParticipantIds:['self'],splitMode:'equal'})
 })
 it('shows a target error after a resolution failure and can open another ledger',async()=>{
  mocks.resolve.mockRejectedValue(new Error('network'))
  await act(async()=>{quick.open({entryPoint:'global',context:shared.ref})})
  expect(quick.contextError).toBe(true);expect(quick.resolving).toBe(false)
  act(()=>{quick.close();quick.open({entryPoint:'global',context:{...shared,ref:{kind:'personal'},availableParticipants:[self]}})})
  expect(quick.session!.context!.ref).toEqual({kind:'personal'})
  expect(quick.contextError).toBe(false)
 })

 it('keeps the page ledger for Save and next, and resets its split to self',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared,followPageContext:true});quick.updateValues({amount:'20',selectedParticipantIds:['self','friend'],splitMode:'exact',exactShareAmounts:{self:'10',friend:'10'}})})
  await act(async()=>{await quick.submit({continueAdding:true})})
  expect(quick.session!.context!.ref).toEqual(shared.ref)
  expect(quick.session!.values).toMatchObject({amount:'',selectedParticipantIds:['self'],splitMode:'equal',exactShareAmounts:{},payerAmounts:{}})
 })
 it('restores each ledger independently and only clears the saved ledger',async()=>{
  const personal:ResolvedMoneyContext={...shared,ref:{kind:'personal'},availableParticipants:[self]}
  act(()=>{quick.open({entryPoint:'global',context:shared,followPageContext:true});quick.updateValues({amount:'88'});quick.close()})
  act(()=>{quick.open({entryPoint:'global',context:personal,followPageContext:true});quick.updateValues({amount:'12'});quick.close()})
  await act(async()=>{quick.open({entryPoint:'global',context:shared,followPageContext:true})})
  expect(quick.session!.values.amount).toBe('88')
  await act(async()=>{await quick.submit()})
  await act(async()=>{quick.open({entryPoint:'global',context:personal,followPageContext:true})})
  expect(quick.session!.values.amount).toBe('12')
 })

 it('opens a personal shortcut without borrowing a shared draft',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared});quick.updateValues({amount:'8',category:'Food'});quick.close()})
  mocks.replace.mockClear()
  await act(async()=>{quick.open({entryPoint:'global',directDeepLink:true,context:{...shared,ref:{kind:'personal'},availableParticipants:[self]}})})
  expect(quick.session!.values.amount).toBe('')
  expect(quick.session!.context!.ref).toEqual({kind:'personal'})
 })
 it('saves the evaluated amount atomically, resets Split, and gives the next expense a new request',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared});quick.updateValues({amount:'12+8',calculation:'12+8',description:'Coffee',category:'Coffee',categorySource:'USER',accountId:'wallet',splitMode:'exact',exactShareAmounts:{self:'10',friend:'10'},payerAmounts:{self:'20'}})})
  const previous=quick.session!.clientRequestId
  await act(async()=>{await quick.submit({continueAdding:true,values:{amount:'20.00'}})})
  expect(mocks.save.mock.calls[0][0]).toMatchObject({amount:'20.00',fundingAccountId:'wallet',scope:'space'})
  expect(quick.session!.clientRequestId).not.toBe(previous)
  expect(quick.session!.context!.ref).toEqual({kind:'personal'})
  expect(quick.session!.values).toMatchObject({amount:'',description:'',category:'Coffee',accountId:'wallet',splitMode:'equal',payerAmounts:{},exactShareAmounts:{},selectedParticipantIds:['self']})
  expect(quick.session!.values.calculation).toBeUndefined()
  expect(mocks.close).not.toHaveBeenCalled()
 })
 it('keeps a failed capture and request intact instead of clearing it',async()=>{
  mocks.save.mockResolvedValue({ok:false,error:'invalid_shares'})
  act(()=>quick.open({entryPoint:'global',context:shared,initialValues:{amount:'90',category:'Food'}}))
  const request=quick.session!.clientRequestId
  await act(async()=>{await quick.submit({continueAdding:true})})
  expect(quick.session!.clientRequestId).toBe(request)
  expect(quick.session!.values.amount).toBe('90')
  expect(mocks.close).not.toHaveBeenCalled()
 })
 it('restores today’s draft but clears it after save and close',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared});quick.updateValues({amount:'8',category:'Food'});quick.close()})
  expect(quick.session).toBeNull()
  await act(async()=>{quick.open({entryPoint:'global',context:shared})})
  expect(quick.session!.values.amount).toBe('8')
  await act(async()=>{await quick.submit()})
  expect(quick.session).toBeNull()
  expect(localStorage.getItem('tt-quick-draft:u')).toBeNull()
 })
 it('runs the original refresh callback once and stays open when continuing',async()=>{
  const refreshed=vi.fn()
  act(()=>quick.open({entryPoint:'person',context:shared,onSaved:refreshed,initialValues:{amount:'8',category:'Food'}}))
  await act(async()=>{await quick.submit({continueAdding:true})})
  expect(refreshed).toHaveBeenCalledTimes(1)
  expect(quick.session!.context!.ref.kind).toBe('personal')
 })
})

describe('Inline ledger commits',()=>{
 it('locks the service entry during selection and restores the original validation path',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared,initialValues:{amount:'20',category:'Food'}});quick.setContextPickerOpen(true)})
  let result
  await act(async()=>{result=await quick.submit({continueAdding:true})})
  expect(result).toMatchObject({ok:false,error:'selection_in_progress'});expect(mocks.save).not.toHaveBeenCalled()
  act(()=>quick.setContextPickerOpen(false))
  await act(async()=>{await quick.submit()})
  expect(mocks.save).toHaveBeenCalledOnce()
 })
 it('keeps the real currency, account, expression, note, category and date when moving to a VND trip',async()=>{
  const personal={...shared,ref:{kind:'personal' as const},availableParticipants:[self]}
  act(()=>{quick.open({entryPoint:'global',context:personal});quick.updateValues({amount:'12+8',calculation:'12+8',currency:'MYR',accountId:'wallet',description:'Coffee',category:'Coffee',categorySource:'SUGGESTED',occurredOn:'2026-10-01'});quick.setContextPickerOpen(true)})
  mocks.resolve.mockResolvedValue({...shared,defaultCurrency:'VND'})
  await act(async()=>{await quick.commitInlineContext(shared.ref)})
  expect(quick.session!.values).toMatchObject({amount:'12+8',calculation:'12+8',currency:'MYR',accountId:'wallet',description:'Coffee',category:'Coffee',categorySource:'SUGGESTED',occurredOn:'2026-10-01',selectedParticipantIds:['self']})
  expect(mocks.replace).toHaveBeenLastCalledWith(expect.objectContaining({step:'capture',context:shared.ref}))
 })
 it('cancels an in-flight commit without changing the draft or ledger',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared});quick.updateValues({amount:'37'});quick.setContextPickerOpen(true)})
  let release!:(value:ResolvedMoneyContext)=>void
  mocks.resolve.mockImplementation(()=>new Promise(resolve=>{release=resolve}))
  let request!:ReturnType<typeof quick.commitInlineContext>
  act(()=>{request=quick.commitInlineContext({kind:'personal'})})
  act(()=>quick.setContextPickerOpen(false))
  await act(async()=>{release({...shared,ref:{kind:'personal'},availableParticipants:[self]});expect(await request).toMatchObject({ok:false,error:'cancelled'})})
  expect(quick.session!.context!.ref).toEqual(shared.ref);expect(quick.session!.values.amount).toBe('37')
 })
 it('distinguishes network and permission failures and never commits an unavailable friend',async()=>{
  act(()=>{quick.open({entryPoint:'global',context:shared});quick.setContextPickerOpen(true)})
  mocks.resolve.mockRejectedValueOnce(new Error('network'))
  await act(async()=>expect(await quick.commitInlineContext({kind:'personal'})).toMatchObject({ok:false,error:'network'}))
  mocks.resolve.mockResolvedValueOnce(null)
  await act(async()=>expect(await quick.commitInlineContext({kind:'personal'})).toMatchObject({ok:false,error:'unavailable'}))
  await act(async()=>expect(await quick.commitInlineContext(shared.ref,['missing'])).toMatchObject({ok:false,error:'unavailable'}))
  expect(quick.session!.context!.ref).toEqual(shared.ref);expect(mocks.save).not.toHaveBeenCalled()
 })
 it('does not overwrite the target draft until the user chooses and can resume it independently',async()=>{
  const personal={...shared,ref:{kind:'personal' as const},availableParticipants:[self]}
  act(()=>{quick.open({entryPoint:'global',context:personal});quick.updateValues({amount:'11'});quick.close();quick.open({entryPoint:'global',context:shared});quick.updateValues({amount:'44'});quick.setContextPickerOpen(true)})
  await act(async()=>expect(await quick.commitInlineContext({kind:'personal'})).toMatchObject({ok:false,error:'draft-conflict'}))
  expect(quick.session!.values.amount).toBe('44')
  await act(async()=>{await quick.commitInlineContext({kind:'personal'},undefined,'resume')})
  expect(quick.session!.values.amount).toBe('11')
  act(()=>quick.close())
  await act(async()=>quick.open({entryPoint:'global',context:shared}))
  expect(quick.session!.values.amount).toBe('44')
 })
 it('prefills multiple existing friend Participants through direct scope and preserves same-selection exact shares',async()=>{
  const person={kind:'person' as const,personId:'p',participantId:'friend',participantIds:['friend'],participantKind:'manual' as const,displayName:'Friend'}
  const another={...friend,id:'another',displayName:'Another'}
  mocks.resolve.mockResolvedValue({...shared,ref:person,availableParticipants:[self,friend,another]})
  act(()=>{quick.open({entryPoint:'global',context:{...shared,ref:{kind:'personal'},availableParticipants:[self]}});quick.updateValues({amount:'60',category:'Food'});quick.setContextPickerOpen(true)})
  await act(async()=>{await quick.commitInlineContext(person,['friend','another'])})
  expect(quick.session!.values.selectedParticipantIds).toEqual(['self','friend','another']);expect(mocks.save).not.toHaveBeenCalled()
  act(()=>quick.updateValues({splitMode:'exact',exactShareAmounts:{self:'20',friend:'10',another:'30'}}))
  await act(async()=>{await quick.commitInlineContext(person,['friend','another'])})
  expect(quick.session!.values.exactShareAmounts).toEqual({self:'20',friend:'10',another:'30'})
  act(()=>quick.setContextPickerOpen(false))
  await act(async()=>{await quick.submit()})
  expect(mocks.save.mock.calls[0][0]).toMatchObject({scope:'direct',spaceId:null,participants:[self,friend,another],splitMode:'exact',exactShareAmounts:{self:'20',friend:'10',another:'30'}})
 })
})

 it('preserves allocations when inline revalidation links a Manual Person principal',async()=>{
  const oldRef={kind:'person' as const,personId:'p',participantId:'old',participantIds:['old'],participantKind:'manual' as const,displayName:'Ada'}
  const oldContext={...shared,ref:oldRef,availableParticipants:[self,{...friend,id:'old'}]}
  act(()=>{quick.open({entryPoint:'global',context:oldContext});quick.updateValues({amount:'20',splitMode:'exact',exactShareAmounts:{self:'8',old:'12'},payerAmounts:{old:'20'}});quick.setContextPickerOpen(true)})
  mocks.resolve.mockResolvedValue({...shared,ref:{...oldRef,participantId:'friend',participantKind:'account'},availableParticipants:[self,friend]})
  await act(async()=>{await quick.commitInlineContext(oldRef,['old'])})
  expect(quick.session!.values).toMatchObject({selectedParticipantIds:['self','friend'],splitMode:'exact',exactShareAmounts:{self:'8',friend:'12'},payerAmounts:{friend:'20'}})
 })
