// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { UniversalQuickAddProvider, useUniversalQuickAdd } from './useUniversalQuickAdd'
import type { ResolvedMoneyContext } from '../lib/universalQuickAdd'
const mocks=vi.hoisted(()=>({save:vi.fn(),close:vi.fn(),replace:vi.fn()}))
vi.mock('./useAuth',()=>({useAuth:()=>({authUser:{id:'u',participantId:'self',defaultCurrency:'MYR'}})}))
vi.mock('./usePersonalLedger',()=>({usePersonalLedger:()=>({saveDraft:mocks.save})}))
vi.mock('./useMoneyActionHistory',()=>({useMoneyActionHistory:()=>({action:null,push:vi.fn(),replace:mocks.replace,close:mocks.close})}))
vi.mock('../lib/moneyContextCatalog',()=>({resolveMoneyContext:async({ref}:{ref:ResolvedMoneyContext['ref']})=>({ref,currentParticipantId:'self',defaultCurrency:'MYR',availableParticipants:ref.kind==='personal'?[self]:[self,friend]})}))
const self={id:'self',displayName:'Me',kind:'account' as const}
const friend={id:'friend',displayName:'Friend',kind:'manual' as const}
const shared:ResolvedMoneyContext={ref:{kind:'space',spaceId:'trip',spaceType:'trip',displayName:'Trip'},currentParticipantId:'self',availableParticipants:[self,friend],defaultCurrency:'MYR'}
let quick:ReturnType<typeof useUniversalQuickAdd>
function Capture(){const value=useUniversalQuickAdd();useEffect(()=>{quick=value},[value]);return null}
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.save.mockResolvedValue({ok:true,saveState:'recorded'});render(<MemoryRouter><UniversalQuickAddProvider identityKey="u"><Capture/></UniversalQuickAddProvider></MemoryRouter>)})
afterEach(cleanup)
describe('Quick Add save lifecycle',()=>{
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
