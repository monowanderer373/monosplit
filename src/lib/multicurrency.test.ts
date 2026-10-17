import { t } from './i18n'
import { describe, it, expect } from 'vitest'
import { accountValuation, validateMovementAmounts, compileFundingSources, currencyGroups, parseCurrencyAccounts, parseObservedBalance, type CurrencyAccount, type BalanceAnchor } from './multicurrency'
import { unavailableFx, type FxSnapshot } from './fx'
import { availableMoney, accountRecordsFilter } from './homeView'
import { buildHomeNotifications, pendingFundingGroups, resolveNotice } from './homeNotifications'
import { noticeExpense, funding, noticeSnapshot } from '../test/notificationFixtures'
const unit=(id:string,parent=id,currency='MYR',balance=10000):CurrencyAccount=>({id,parentAccountId:parent,name:'Same name',currency,accountClass:'asset',accountType:'ewallet',archived:false,openingStatus:'posted',entrySumMinor:balance,version:2,parentVersion:4,displayOrder:id===parent?0:1,isDefault:false,openingBalanceAsOf:null})
const anchor:BalanceAnchor={id:'anchor',account_id:'myr',anchor_sequence:'2',observed_at:'2026-10-16',pending_intent_ids:[],captured_entry_ids:[]}
const rates:FxSnapshot={...unavailableFx,id:'snapshot',status:'cached',rates:{VND:{currency:'VND',quote:'MYR',direction:'MYR-per-foreign',numerator:'0.00018',denominator:'1',rateDate:'2026-10-15',fetchedAt:'2026-10-16T00:00:00Z',provider:'Frankfurter'}}}
describe('native currency units and display-only valuations',()=>{
 it('keeps archived, deleted and unknown record scopes explicit, while grouping a selected child under its real parent',()=>{
  const accounts=[{...unit('old'),archived:true},unit('vnd','old','VND')]
  expect(accountRecordsFilter(accounts,'old')).toBe('old');expect(accountRecordsFilter(accounts,'deleted')).toBe('deleted');expect(accountRecordsFilter(accounts,'vnd')).toBe('old')
  expect(accountValuation([accounts[0]],unavailableFx).minor).toBeNull();expect(accountValuation([accounts[0]],unavailableFx,true).minor).toBe(10000n)
 })
 it('retains exact display aggregates above one account bound and never reports all-unknown pockets as zero',()=>{
  expect(availableMoney([unit('large','large','MYR',Number.MAX_SAFE_INTEGER),unit('small')],'all')[0]).toMatchObject({amountMinor:null,amountMinorExact:'9007199254750991'})
  expect(availableMoney([{...unit('u1'),openingStatus:'unknown'},{...unit('u2'),openingStatus:'unknown'}],'all')[0]).toMatchObject({amountMinor:null,unknownOpeningCount:2})
 })
 it('checks fees and same-currency actual amounts without mixing foreign units or adding included fees twice',()=>{
  expect(()=>validateMovementAmounts(15000,900000,'MYR','VND',{mode:'included_source',amount_minor:200})).not.toThrow()
  expect(()=>validateMovementAmounts(15000,14800,'MYR','MYR',{mode:'included_source',amount_minor:200})).not.toThrow()
  expect(()=>validateMovementAmounts(15000,15000,'MYR','MYR',{mode:'included_source',amount_minor:200})).toThrow('movement_same_currency_mismatch')
  expect(()=>validateMovementAmounts(15000,900000,'MYR','VND',{mode:'included_source',amount_minor:15000})).toThrow('invalid_fee')
 })
 it('adapts approved copy to the existing interpolation contract',()=>{expect(t('mc.verify.group','en',{account:'Wise',count:2})).toBe('Wise · 2 deductions to verify');expect(t('mc.funding.actual','zh',{currency:'VND'})).toBe('实际扣款（VND）')})
 it('groups explicit parents only; identical account names never merge history',()=>{
  const accounts=[unit('myr'),unit('vnd','myr','VND',900000),unit('other')]
  expect(currencyGroups(accounts).map(g=>g.units.length)).toEqual([2,1])
  expect(availableMoney(accounts,'myr').map(v=>[v.currency,v.amountMinor])).toEqual([['MYR',10000],['VND',900000]])
 })
 it('uses exact original currency precision and cached FX without passing estimates to funding',()=>{
  const accounts=[unit('myr'),unit('vnd','myr','VND',900000)]
  expect(accountValuation(accounts,rates)).toEqual({minor:26200n,unknown:0,missingRates:0,partial:false})
  const legs=compileFundingSources([{key:'a',accountId:'vnd',amount:'90,000',coverage:''}],accounts,[])
  expect(legs[0].amount_minor).toBe(90000)
 })
 it('excludes unknown and unavailable balances, preserves a real zero and never manufactures RM 0',()=>{
  const unknown={...unit('unknown'),openingStatus:'unknown' as const,entrySumMinor:-2000}
  expect(accountValuation([unknown,unit('foreign','foreign','VND',90000)],unavailableFx)).toEqual({minor:null,unknown:1,missingRates:1,partial:true})
  expect(accountValuation([unit('zero','zero','MYR',0)],unavailableFx).minor).toBe(0n)
  expect(accountValuation([unit('myr'),unknown],unavailableFx)).toMatchObject({minor:10000n,unknown:1,partial:true})
 })
 it('requires explicit latest-anchor coverage and immutable current versions for every leg',()=>{
  const accounts=[unit('myr')],draft={key:'a',accountId:'myr',amount:'16.20',coverage:'' as const}
  expect(()=>compileFundingSources([draft],accounts,[anchor])).toThrow('funding_coverage_required')
  expect(compileFundingSources([{...draft,coverage:'included',coverageAnchorId:anchor.id}],accounts,[anchor])).toEqual([{account_id:'myr',version:2,parent_version:4,amount_minor:1620,anchor_id:'anchor',included_in_anchor:true}])
  expect(()=>compileFundingSources([{...draft,coverage:'included',coverageAnchorId:'superseded-anchor'}],accounts,[anchor])).toThrow('funding_coverage_required')
  expect(()=>compileFundingSources([draft,draft],accounts,[])).toThrow('invalid_funding_bundle')
  expect(()=>compileFundingSources([draft],[{...accounts[0],archived:true}],[])).toThrow('personal_account_archived')
 })
 it('rejects fractional zero-digit payments and overflow; observed balances accept exact zero and negative values',()=>{
  expect(()=>parseObservedBalance('1.01','VND')).toThrow()
  expect(parseObservedBalance('0','MYR')).toBe(0)
  expect(parseObservedBalance('-1,200.30','MYR')).toBe(-120030)
  expect(()=>parseObservedBalance('9007199254740992','VND')).toThrow('amount_overflow')
 })
 it('rejects a missing server upgrade, orphan currencies and malformed native balances',()=>{
  expect(()=>parseCurrencyAccounts([])).toThrow('multicurrency_unavailable')
  const raw={schema_version:1,accounts:[{id:'myr',parent_account_id:'missing',name:'Wallet',account_type:'ewallet',account_class:'asset',currency:'MYR',opening_status:'unknown',version:1,parent_version:1,display_order:0,entry_sum_minor:'0'}]}
  expect(()=>parseCurrencyAccounts(raw)).toThrow('invalid_account_snapshot')
 })
})
describe('parent funding reminders',()=>{
 it('orders the current group by source calendar day then stable intent ID and omits unavailable expense targets',()=>{
  const snapshot=noticeSnapshot();snapshot.money={bundles:snapshot.funding.map(f=>({funding_intent_id:f.id,primary_account_id:'bank',confirmed_operation_id:null})),anchors:[]}
  snapshot.expenses[0].occurredOn='2026-10-15';snapshot.expenses[1].occurredOn='2026-10-14'
  expect(pendingFundingGroups(snapshot)[0].intentIds).toEqual(['fund-2','fund-1'])
  snapshot.expenses[0].occurredOn='2026-10-14';snapshot.funding.reverse()
  expect(pendingFundingGroups(snapshot)[0].intentIds).toEqual(['fund-1','fund-2'])
  snapshot.expenses.shift();expect(pendingFundingGroups(snapshot)[0].intentIds).toEqual(['fund-2'])
  expect(resolveNotice(snapshot,{kind:'funding',id:'fund-1'},[]).state).toBe('unavailable')
 })
 it('shows three grouped deductions plus an independent shared review as four distinct tasks in two rows',()=>{
  const snapshot=noticeSnapshot(),third=noticeExpense('third')
  snapshot.expenses.push(third);snapshot.funding.push(funding('third-funding',third.id))
  const shared=noticeExpense('shared-review');shared.scope='direct';shared.createdBy='other';shared.participations[0].state='pending'
  snapshot.expenses.push(shared)
  snapshot.money={bundles:snapshot.funding.map(f=>({funding_intent_id:f.id,primary_account_id:'bank',confirmed_operation_id:null})),anchors:[]}
  const tasks=buildHomeNotifications(snapshot,[]).filter(n=>n.tab==='tasks')
  expect(tasks).toHaveLength(2)
  expect(tasks.reduce((sum,n)=>sum+(n.taskCount??1),0)).toBe(4)
  expect(tasks.find(n=>n.fundingGroup)?.fundingGroup?.intentIds).toHaveLength(3)
  expect(tasks.find(n=>n.ref.kind==='expense')?.ref).toEqual({kind:'expense',id:'shared-review'})
 })

 it('counts underlying pending intents while preserving individual resolver authority',()=>{
  const snapshot=noticeSnapshot();snapshot.money={bundles:snapshot.funding.map(f=>({funding_intent_id:f.id,primary_account_id:'wallet-1',confirmed_operation_id:null})),anchors:[]}
  const pending=snapshot.funding.filter(f=>f.status==='pending')
  expect(pendingFundingGroups(snapshot)).toEqual([{parentId:'wallet-1',intentIds:pending.map(f=>f.id)}])
  const notices=buildHomeNotifications(snapshot,[]).filter(n=>n.tab==='tasks')
  expect(notices).toHaveLength(1);expect(notices[0].taskCount).toBe(pending.length)
  for(const f of pending)expect(resolveNotice(snapshot,{kind:'funding',id:f.id},[]).state).toBe('ready')
 })
})
