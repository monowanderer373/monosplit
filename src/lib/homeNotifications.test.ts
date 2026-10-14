import {describe,it,expect} from 'vitest'
import {buildHomeNotifications,resolveNotice,parseNotice,noticePath,noticeCalendarDate} from './homeNotifications'
import {noticeSnapshot,funding} from '../test/notificationFixtures'
import {noticeQueryFailure} from './notificationRepository'
import type {PendingLedgerCommand} from '../store/useStore'
describe('authoritative home notification lifecycle',()=>{
 it('uses the account local day for timestamp notices and preserves expense calendar dates',()=>{expect(noticeCalendarDate('2026-10-13T18:00:00Z','Asia/Kuala_Lumpur')).toBe('2026-10-14');expect(noticeCalendarDate('2026-10-13','Asia/Kuala_Lumpur')).toBe('2026-10-13')})
 it('distinguishes two pending debit objects; an ordinary negative balance is Activity, not a blocked debit',()=>{
  const n=buildHomeNotifications(noticeSnapshot(),[])
  expect(n.filter(n=>n.tab==='tasks').map(n=>[n.ref.id,n.description,n.intent])).toEqual([['fund-1','Train ticket','complete-funding'],['fund-2','Dinner with friends','complete-funding']])
  expect(n.find(n=>n.ref.kind==='account')).toMatchObject({tab:'activity',state:'info',ref:{kind:'account',id:'wallet-1'},relatedAccountId:'wallet-1'})
 })
 it('deduplicates identical entities and never lets a lower version reopen a posted task',()=>{
  const s=noticeSnapshot();s.funding=[{...funding(),status:'posted',version:3},funding(),funding()]
  const n=buildHomeNotifications(s,[]).filter(n=>n.ref.kind==='funding');expect(n).toHaveLength(1);expect(n[0]).toMatchObject({state:'completed',version:'3',tab:'activity'})
 })
 it('does not duplicate pending-principal plans as another debit; resolves a completed intent to its current result',()=>{
  const s=noticeSnapshot();s.plans=[{id:'plan',status:'pending_principal',version:1,updated_at:'',funding_intent_id:'fund-1'}]
  expect(buildHomeNotifications(s,[]).filter(n=>n.ref.id==='fund-1')).toHaveLength(1)
  s.funding[0]={...s.funding[0],status:'posted',version:2};expect(resolveNotice(s,{kind:'funding',id:'fund-1'},[])).toMatchObject({state:'ready',notice:{state:'completed',tab:'activity'}})
 })
 it('ends a low-balance reminder only after the fresh account sum is nonnegative',()=>{
  const s=noticeSnapshot();s.accounts[0].entrySumMinor=0
  expect(buildHomeNotifications(s,[]).some(n=>n.ref.kind==='account')).toBe(false)
  expect(resolveNotice(s,{kind:'account',id:'wallet-1'},[])).toMatchObject({state:'completed'})
 })
 it('keeps cancelled/reversed/voided funding out of actions and fails closed on lost visibility',()=>{
  const s=noticeSnapshot();s.expenses[0].status='voided';expect(resolveNotice(s,{kind:'funding',id:'fund-1'},[])).toMatchObject({state:'ready',notice:{state:'changed',tab:'activity'}})
  s.expenses=[];expect(resolveNotice(s,{kind:'funding',id:'fund-1'},[])).toEqual({state:'unavailable'})
 })
 it('requires login, differentiates query failures from absence and allows only typed internal intents',()=>{
  expect(resolveNotice(null,{kind:'funding',id:'fund-1'},[])).toEqual({state:'login'})
  expect(noticeQueryFailure({status:500})).toEqual({state:'retry'});expect(noticeQueryFailure(new Error('offline'))).toEqual({state:'retry'});expect(noticeQueryFailure({code:'PGRST301'})).toEqual({state:'login'})
  expect(parseNotice('?notice=funding&target=https://evil.example')).toBeNull();expect(parseNotice('?notice=delete&target=uuid')).toBeNull()
  const ref={kind:'funding' as const,id:'fund-1'};expect(parseNotice(noticePath(ref).slice(1))).toEqual(ref)
 })
 it('does not expose another participant pending review and excludes correction candidates from ordinary shared acceptance',()=>{
  const s=noticeSnapshot();s.expenses[0].scope='direct';s.expenses[0].participations[0].state='pending';s.expenses[0].correctsExpenseId='old'
  s.changes=[{id:'change',clientRequestId:'change-r',kind:'correction',state:'pending',proposedBy:'other',targetExpenseId:'expense-2',replacementExpenseId:'expense-1',targetVersion:1,version:1,reason:null,createdAt:'2026-10-14',updatedAt:'2026-10-14',approvals:[{participantId:'other',state:'pending',respondedAt:null,createdAt:'2026-10-14'}]}]
  expect(buildHomeNotifications(s,[]).some(n=>n.ref.kind==='expense'||n.ref.kind==='change')).toBe(false)
  s.changes[0].approvals[0].participantId='owner';expect(buildHomeNotifications(s,[]).find(n=>n.ref.kind==='change')).toMatchObject({ref:{kind:'change',id:'change'},intent:'review-change'})
 })
 it('treats an already submitted outbox request as a server result and never offers duplicate retry',()=>{
  const s=noticeSnapshot(),item={command:{requestId:s.expenses[0].clientRequestId},optimisticExpense:s.expenses[0],status:'rejected',commitState:'unknown',attempts:1} as PendingLedgerCommand
  expect(buildHomeNotifications(s,[item]).some(n=>n.ref.kind==='outbox')).toBe(false)
  expect(resolveNotice(s,{kind:'outbox',id:item.command.requestId},[item])).toMatchObject({state:'completed'})
 })
})
