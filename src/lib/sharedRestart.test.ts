import {describe,it,expect} from 'vitest'
import {noticeExpense,noticeSnapshot} from '../test/notificationFixtures'
import {parseSharedRestart,currentSharedObligation} from './sharedRestart'
import {deriveRelationalDebtLines,type BalanceContext,type ConfirmedSettlement} from './relationalBalance'
import {activePersonalExpenses} from './personalPeriods'
import {buildHomeNotifications} from './homeNotifications'
import type {CanonicalExpense} from '../types'
function bill():CanonicalExpense{
 const e=noticeExpense('restart-bill','Original bill');e.scope='space';e.spaceId='trip';e.totalMinor=300;e.participantCount=3
 e.participations=['a','b','c'].map((id,order)=>({id,expenseId:e.id,participantId:id,nameSnapshot:id,order,state:'accepted',trackingMode:'tracked'}))
 e.payerContributions=[{expenseId:e.id,expenseParticipationId:'a',amountMinor:300}];e.shares=['a','b','c'].map(id=>({expenseId:e.id,expenseParticipationId:id,amountMinor:100}));return e
}
const context:BalanceContext={scope:'space',spaceId:'trip'}
describe('shared Reset preserves source facts and original pairing',()=>{
 it('clears only edges involving the resetting person, without redistributing their share',()=>{
  const e=bill(),original=structuredClone(e);e.sharedRestart={ownerIds:['b'],hiddenForViewer:false,retags:[],edges:[{id:'edge',recipientId:'b',debtorId:'b',creditorId:'a',remainingMinor:100,effectiveMinor:0}]}
  expect(deriveRelationalDebtLines([e],[],context)).toEqual([{debtorParticipantId:'c',creditorParticipantId:'a',currency:e.currency,remainingMinor:100}])
  expect(e.shares).toEqual(original.shares);expect(e.payerContributions).toEqual(original.payerContributions);expect(e.participations).toEqual(original.participations)
 })
 it('restores only the unpaid amount and excludes old transfers from F while including new accepted transfers',()=>{
  const e=bill();e.sharedRestart={ownerIds:['b'],hiddenForViewer:false,retags:[],edges:[{id:'edge',recipientId:'b',debtorId:'b',creditorId:'a',remainingMinor:60,effectiveMinor:60}]}
  const p:ConfirmedSettlement={id:'old',scope:'space',spaceId:'trip',debtorParticipantId:'b',currency:e.currency,status:'confirmed',paymentDate:'2026-10-26',createdAt:'2026-10-26',allocations:[{creditorParticipantId:'a',amountMinor:40,state:'accepted',sharedRestartCleared:true}]}
  expect(deriveRelationalDebtLines([e],[p],context).find(d=>d.debtorParticipantId==='b')?.remainingMinor).toBe(60)
  const next={...p,id:'new',allocations:[{creditorParticipantId:'a',amountMinor:20,state:'accepted' as const}]}
  expect(deriveRelationalDebtLines([e],[p,next],context).find(d=>d.debtorParticipantId==='b')?.remainingMinor).toBe(40)
  const reversed={...next,allocations:[{...next.allocations[0],reversalMinor:20}]}
  expect(deriveRelationalDebtLines([e],[p,reversed],context).find(d=>d.debtorParticipantId==='b')?.remainingMinor).toBe(60)
 })
 it('cannot inflate an original obligation through a malformed restored amount',()=>{
  const e=bill();e.sharedRestart={ownerIds:['b'],hiddenForViewer:false,retags:[],edges:[{id:'edge',recipientId:'b',debtorId:'b',creditorId:'a',remainingMinor:999,effectiveMinor:999}]}
  expect(currentSharedObligation(e,'b','a',100)).toBe(100)
 })
 it('keeps restored old purchases out of new-period personal spending',()=>{
  const e=bill();e.sharedRestart={ownerIds:['b'],hiddenForViewer:false,retags:[],edges:[]}
  expect(activePersonalExpenses([e],{available:true,ownerId:'b',periods:[],archivedExpenseIds:[],archivedTransactionIds:[],laterFunding:[]})).toEqual([])
  expect(activePersonalExpenses([e],{available:true,ownerId:'a',periods:[],archivedExpenseIds:[],archivedTransactionIds:[],laterFunding:[]})).toEqual([e])
 })
 it('rejects unsafe, negative, malformed or incomplete metadata instead of treating it as zero',()=>{
  for(const value of[{},{owner_ids:[],hidden_for_viewer:false,edges:[{id:'e',debtor_id:'a',creditor_id:'b',recipient_id:'a',remaining_minor:'9007199254740992',effective_minor:0}],retags:[]},{owner_ids:[],hidden_for_viewer:false,edges:[{id:'e',debtor_id:'a',creditor_id:'b',recipient_id:'a',remaining_minor:'-1',effective_minor:0}],retags:[]}])expect(()=>parseSharedRestart(value)).toThrow('invalid_shared_restart_state')
  expect(parseSharedRestart(null)).toBeUndefined()
 })
 it('does not notify anyone about Reset; only an explicit new tag creates a recipient task',()=>{
  const s=noticeSnapshot();s.funding=[];s.accounts=[];s.expenses=s.expenses.slice(0,1)
  const e=s.expenses[0];e.scope='direct';e.sharedRestart={ownerIds:[s.owner],hiddenForViewer:true,retags:[],edges:[]}
  expect(buildHomeNotifications(s,[])).toEqual([])
  e.sharedRestart.retags.push({id:'new-tag',edgeId:'edge',requesterId:'other',recipientId:s.owner,state:'pending',expenseVersion:e.version,createdAt:'2026-10-26'})
  expect(buildHomeNotifications(s,[])).toMatchObject([{ref:{kind:'retag',id:'new-tag'},tab:'tasks',intent:'review-retag'}])
  e.sharedRestart.retags[0].recipientId='other';expect(buildHomeNotifications(s,[])).toEqual([])
 })
})
