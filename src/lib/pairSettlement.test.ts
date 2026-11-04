import{expect,it}from'vitest'
import{pairExpenseSources,pairExpenseVersions,pairCoverageApplications,pairLines}from'./pairSettlement'
import{tripLedgerExpense,tripLedgerId}from'../test/tripLedgerFixtures'
it('binds source rows to the actual pair and Trip, not everyone sharing a currency',()=>{
 const own=tripLedgerExpense('own','Pair bill',[['owner',20000,5000],['alex',0,15000]])
 const unrelated=tripLedgerExpense('unrelated','Same currency, other pair',[['mia',50000,0],['alex',0,50000]])
 const foreign={...own,id:'foreign',spaceId:'other-trip'}
 const privateBill={...own,id:'private',scope:'personal' as const,spaceId:null}
 const sources=pairExpenseSources([own,unrelated,foreign,privateBill],tripLedgerId,'owner','alex')
 expect(sources.map(s=>[s.expenseId,s.amountMinor])).toEqual([['own',15000]])
 expect(pairExpenseVersions([own,unrelated],tripLedgerId,'owner','alex')).toEqual([{id:'own',version:1}])
 expect(pairCoverageApplications([own,unrelated],[],tripLedgerId,'owner','alex',[{direction:'they_owe',currency:'MYR',coveredMinor:7500n}]).get('own')).toBe(7500)
 expect(pairLines([{debtorParticipantId:'mia',creditorParticipantId:'alex',currency:'MYR',remainingMinor:100}], 'owner','alex')).toEqual({youOwe:[],theyOwe:[]})
})
