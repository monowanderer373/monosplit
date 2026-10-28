import {expect,it}from'vitest'
import {tripFinancialParticipantIds,tripItemMinorShares}from'./tripSplit'
import {compileLedgerExpense,type LedgerExpenseDraft}from'./compileExpense'
import {createUniversalQuickAddSession}from'./universalQuickAdd'
const people=['a','b','c'].map(id=>({id,displayName:id,kind:'account' as const}))
const draft:LedgerExpenseDraft={clientRequestId:'r',currentParticipantId:'a',scope:'space',spaceId:'trip',amount:'1000',currency:'MYR',description:'',category:'Food',occurredOn:'2026-10-28',participants:people,payerAmounts:{a:'1000'},splitMode:'equal',exactShareAmounts:{}}
it('only consumers divide Equal while recorder and payer-only principals survive',()=>{
 const result=compileLedgerExpense({...draft,consumerParticipantIds:['b']});expect(result).toMatchObject({ok:true,command:{participantIds:['a','b','c'],contributionAmounts:[100000,0,0],shareAmounts:[0,100000,0]}})
 expect(tripFinancialParticipantIds({consumers:['b'],payerAmounts:{a:'600',c:'400'},currency:'MYR',recorder:'a'})).toEqual(['a','b','c'])
 expect(compileLedgerExpense({...draft,consumerParticipantIds:['a','b'],payerAmounts:{a:'600',c:'400'}})).toMatchObject({ok:true,command:{contributionAmounts:[60000,0,40000],shareAmounts:[50000,50000,0]}})
})
it('keeps integer remainder and historical order; rejects no consumers, unknown IDs and incomplete payments',()=>{
 const r=compileLedgerExpense({...draft,amount:'10',payerAmounts:{a:'10'},consumerParticipantIds:['a','b','c']});expect(r).toMatchObject({ok:true,command:{shareAmounts:[334,333,333]}})
 expect(tripFinancialParticipantIds({consumers:['c','a'],payerAmounts:{b:'10'},currency:'MYR',originalIds:['b','a']})).toEqual(['b','a','c'])
 for(const consumerParticipantIds of[[],['unknown']])expect(compileLedgerExpense({...draft,consumerParticipantIds})).toMatchObject({ok:false})
 expect(compileLedgerExpense({...draft,consumerParticipantIds:['b'],payerAmounts:{a:'0'}})).toMatchObject({ok:false,error:'invalid_payers'})
 expect(compileLedgerExpense({...draft,scope:'direct',spaceId:null,consumerParticipantIds:['b']})).toMatchObject({ok:false,error:'invalid_participants'})
})
it('starts a Trip with self but preserves explicit existing allocations; Group keeps its defaults',()=>{
 const context={ref:{kind:'space' as const,spaceId:'trip',spaceType:'trip' as const,displayName:'Trip'},currentParticipantId:'a',availableParticipants:people,defaultCurrency:'MYR'}
 const input={identityKey:'u',sessionId:'s',clientRequestId:'r',startedAtMs:1,entryPoint:'space' as const,context}
 expect(createUniversalQuickAddSession(input).values.selectedParticipantIds).toEqual(['a'])
 expect(createUniversalQuickAddSession({...input,initialValues:{selectedParticipantIds:['b'],payerAmounts:{c:'1000'},splitMode:'exact',exactShareAmounts:{b:'1000'}}}).values).toMatchObject({selectedParticipantIds:['b'],payerAmounts:{c:'1000'},exactShareAmounts:{b:'1000'}})
 expect(createUniversalQuickAddSession({...input,context:{...context,ref:{...context.ref,spaceType:'group'}}}).values.selectedParticipantIds).toEqual(['a','b','c'])
})

it('item allocation consumes only selected people and keeps the established minor-unit remainder',()=>{
 expect([...tripItemMinorShares(1000,'MYR',['a','b','c'],[{amount:'10',participantIds:['a','b','c']}]).values()]).toEqual([334,333,333])
 expect(()=>tripItemMinorShares(1000,'MYR',['a'],[{amount:'10',participantIds:['b']}])).toThrow()
 expect(()=>tripItemMinorShares(1000,'MYR',['a'],[{amount:'9',participantIds:['a']}])).toThrow()
})
