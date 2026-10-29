import {backSpaceNavigation,readSpaceOrigin,prepareSpaceBack} from '../../lib/spaceNavigation'
import{useEffect,useLayoutEffect,useMemo,useRef,useState}from'react'
import{useLocation,useNavigate,useSearchParams}from'react-router-dom'
import type{SpaceWithRole}from'../../lib/spaceRepository'
import type{Participant,SpaceMember}from'../../types'
import{useAuth}from'../../hooks/useAuth'
import{usePersonalLedger}from'../../hooks/usePersonalLedger'
import{useSettlements}from'../../hooks/useSettlements'
import{useUniversalQuickAdd}from'../../hooks/useUniversalQuickAdd'
import{useRouteScroll}from'../../hooks/useRouteScroll'
import{useTripDatesReturn}from'../../hooks/useTripDatesReturn'
import{useLocalCalendarDate}from'../../hooks/useLocalCalendarDate'
import{useStore}from'../../store/useStore'
import{categoryKey,useT,type TranslationKey}from'../../lib/i18n'
import{formatMinorAmount}from'../../lib/money'
import{formatDate,localeForLang}from'../../lib/locale'
import{visibleSharedExpense}from'../../lib/sharedRestart'
import{tripCurrentPayments,tripAuthoritativeExpenses,tripDebtLines,tripDirectionalTotals,tripLedgerView,type TripLedgerTab}from'../../lib/tripLedger'
import{backFromTripLedgerView,openTripLedgerView,tripLedgerUi,setTripLedgerFocus,setTripLedgerScroll,setTripLedgerLimit}from'../../lib/tripLedgerNavigation'
import{openTripMembers}from'../../lib/tripMembersNavigation'
import{openTripDates}from'../../lib/tripDatesNavigation'
import{shiftCalendarDay}from'../../lib/tripCalendar'
import{tripPeriodStatus,tripPeriodStatusKeys}from'../../lib/tripPeriod'
import{buildTripRecap}from'../../lib/insights'
import{deriveExpenseRevisionEntries}from'../../lib/financialHistory'
import{AnchoredPaperPopover,TravelIcon}from'./TravelUI'
import TripDateEntry from'./TripDateEntry'
import SettlementPanel from'../SettlementPanel'
import ExpenseActionSheet from'../ExpenseActionSheet'
import ExpenseHistoryList from'../ExpenseHistoryList'
import PendingExpenseRecoveryActions from'../PendingExpenseRecoveryActions'
import SharedRestartActions from'../SharedRestartActions'
import ActivityFeed from'../ActivityFeed'
import'./trip-ledger.css'
type Props={entry:SpaceWithRole;members:{member:SpaceMember;participant:Participant}[];ledger:ReturnType<typeof usePersonalLedger>;settlementState:ReturnType<typeof useSettlements>;refresh:()=>Promise<void>;error:TranslationKey|'';authorityReady:boolean;refreshing:boolean}
export default function TripLedger({entry,members,ledger,settlementState,refresh,error,authorityReady,refreshing}:Props){
 const t=useT(),{authUser}=useAuth(),navigate=useNavigate(),location=useLocation(),[params]=useSearchParams(),lang=useStore(s=>s.lang),hidden=useStore(s=>s.homeUi.balanceHidden)
 const actor=authUser!.id,self=authUser!.participantId!,trip=entry.space.id,today=useLocalCalendarDate(authUser?.timezone??'Asia/Kuala_Lumpur'),{setPageTarget}=useUniversalQuickAdd(),ui=tripLedgerUi(actor,trip)
 const selection=tripLedgerView(params),{tab,view,history}=selection,anchor=useRef<HTMLButtonElement>(null),[menu,setMenu]=useState(false),[limit,setLimit]=useState(ui.limit)
 const canManage=authorityReady&&['owner','full_access'].includes(entry.role)
 const canWrite=canManage&&entry.space.status==='active'
 useEffect(()=>{setPageTarget({pathname:location.pathname,ready:canWrite,target:{kind:'space-candidate',spaceId:trip}});return()=>setPageTarget(null)},[setPageTarget,location.pathname,trip,canWrite])
 const all=useMemo(()=>Object.freeze(ledger.expenses.filter(e=>e.spaceId===trip).sort((a,b)=>b.occurredOn.localeCompare(a.occurredOn)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id))),[ledger.expenses,trip])
 const expenses=useMemo(()=>Object.freeze(all.filter(e=>e.status==='active')),[all])
 const authoritative=useMemo(()=>Object.freeze(tripAuthoritativeExpenses(expenses)),[expenses])
 const visible=useMemo(()=>Object.freeze(expenses.filter(visibleSharedExpense)),[expenses])
 const context=useMemo(()=>({scope:'space' as const,spaceId:trip}),[trip]),payments=useMemo(()=>tripCurrentPayments(settlementState.settlements,trip),[settlementState.settlements,trip])
 const names=useMemo(()=>{const map=new Map<string,string>();for(const expense of all)for(const person of expense.participations)map.set(person.participantId,person.nameSnapshot);for(const m of members)map.set(m.participant.id,m.participant.displayName);return map},[all,members])
 const summary=useMemo(()=>{try{return{rows:tripDirectionalTotals(tripDebtLines(expenses,settlementState.settlements,trip),self),failed:false}}catch{return{rows:[],failed:true}}},[expenses,settlementState.settlements,trip,self])
 const [verified,setVerified]=useState(false),loaded=ledger.expensesStatus==='ready'&&!settlementState.loading&&!settlementState.error;if(loaded&&!verified)setVerified(true)
 const ready=verified||loaded,failed=summary.failed||!!settlementState.error||ledger.expensesStatus==='error'||!!error
 const incoming=payments.flatMap(p=>p.allocations.filter(a=>a.state==='pending'&&a.creditorParticipantId===self)),outgoing=payments.flatMap(p=>p.debtorParticipantId===self?p.allocations.filter(a=>a.state==='pending'):[])
 const money=(amount:number,currency:string)=>hidden?'••••':formatMinorAmount(amount,currency,localeForLang(lang))
 useRouteScroll(ready,actor);useTripDatesReturn(ready,actor,trip)
 useLayoutEffect(()=>{if(!ready||!ui.focus||ui.focusPath!==location.pathname+location.search)return;const frame=requestAnimationFrame(()=>{const target=document.querySelector<HTMLButtonElement>('[data-tl-focus="'+CSS.escape(ui.focus)+'"]');if(target){target.focus({preventScroll:true});setTripLedgerFocus(actor,trip,'')}});return()=>cancelAnimationFrame(frame)},[ready,ui,view,tab,location.key,location.pathname,location.search,actor,trip])
 const closeMenu=()=>{setMenu(false);anchor.current?.focus({preventScroll:true})}
 const switchTab=(next:TripLedgerTab,pending=false)=>{setTripLedgerScroll(actor,trip,tab,window.scrollY);const nextParams=new URLSearchParams(location.search);nextParams.delete('view');nextParams.delete('section');nextParams.delete('focusExpenseId');nextParams.set('tab',next);navigate({pathname:location.pathname,search:nextParams.toString()},{replace:true,state:{...location.state,restoreScroll:ui.scroll[next]}});if(pending)requestAnimationFrame(()=>requestAnimationFrame(()=>{const target=document.querySelector<HTMLElement>('[data-trip-pending="incoming"]');target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true})}))}
 const openView=(next:'history'|'summary',focus?:string)=>{closeMenu();setTripLedgerFocus(actor,trip,'menu',location.pathname+location.search);openTripLedgerView(navigate,location,actor,trip,next,focus)}
 const changeHistory=(next:string)=>{const p=new URLSearchParams(location.search);p.set('history',next);p.delete('section');p.set('view','history');p.delete('focusExpenseId');navigate({search:p.toString()},{replace:true,state:{...location.state,restoreScroll:0}})}
 const origin=readSpaceOrigin(location.state,actor,location.pathname),source=origin?.source
 useEffect(()=>{if(view==='main'&&ready&&authorityReady&&!authUser?.isAnonymous)prepareSpaceBack(navigate,location,actor,'/shared?tab=trips')},[view,ready,authorityReady,authUser?.isAnonymous,navigate,location,actor])
 const back=()=>view!=='main'?backFromTripLedgerView(navigate,location.state,actor,trip,tab):backSpaceNavigation(navigate,location.state,actor,location.pathname,authUser?.isAnonymous?'/':'/shared?tab=trips')
 const recapResult=useMemo(()=>{if(view!=='summary'||!ready||failed)return{recap:null,failed:false};try{return{recap:buildTripRecap(visible),failed:false}}catch{return{recap:null,failed:true}}},[view,ready,failed,visible])
 const {recap,failed:recapFailed}=recapResult,focused=params.get('focusExpenseId')??undefined
 const historyResult=useMemo(()=>{if(view!=='history'||history!=='expenses')return{hasChanges:false,failed:false};try{return{hasChanges:deriveExpenseRevisionEntries(all,[]).some(e=>e.lifecycle!=='active'||e.previousExpenseId||e.nextExpenseId),failed:false}}catch{return{hasChanges:false,failed:true}}},[view,history,all])
 const {hasChanges,failed:historyFailed}=historyResult
 return <main className="tl-page" data-testid="trip-ledger" data-trip-id={trip}>
  <nav className="tl-nav"><button type="button" className="tl-text-button" onClick={back}><TravelIcon name="chevron-left"/>{t(view!=='main'||source==='/travel/trip/'+trip?'members.back':authUser?.isAnonymous?'common.back':'sharedA.trips')}</button><button ref={anchor} data-tl-focus="menu" type="button" className="tl-icon-button" aria-label={t('travel.actions')} aria-expanded={menu} onClick={()=>menu?closeMenu():setMenu(true)}><TravelIcon name="more"/></button></nav>
  {menu?<AnchoredPaperPopover anchor={anchor} onClose={closeMenu} label={t('travel.actions')}><button type="button" className="tt-popover-footer-control" data-tl-focus="history" onClick={()=>openView('history')}>{t('tl.history')}</button><button type="button" className="tt-popover-footer-control" data-tl-focus="summary" onClick={()=>openView('summary')}>{t('tl.summary')}</button><button type="button" className="tt-popover-footer-control" onClick={()=>{closeMenu();setTripLedgerFocus(actor,trip,'members',location.pathname+location.search);openTripMembers(navigate,location,actor,trip)}}>{t('travel.members')}</button></AnchoredPaperPopover>:null}
  <header className="tl-header" data-testid="space-manage"><div className="tl-title-line"><h1>{entry.space.name}</h1><span className="tl-status">• {t(tripPeriodStatusKeys[tripPeriodStatus(entry.space,today)])}</span></div><div className="tl-meta"><TripDateEntry trip={entry.space} canEdit={canManage&&entry.space.status!=='voided'} onOpen={()=>openTripDates(navigate,location,actor,trip)}/><span>{entry.space.defaultCurrency}</span></div><button type="button" className="tl-text-button" data-testid="trip-ledger-members" data-tl-focus="members" onClick={()=>{setTripLedgerFocus(actor,trip,'members',location.pathname+location.search);openTripMembers(navigate,location,actor,trip)}}>{t('tl.members',{count:members.length})} ›</button></header>
  {refreshing?<p role="status" className="tl-notice">{t('tl.refreshing')}</p>:null}
  {failed?<div className="tl-notice" role="alert"><p>{t(error||'tl.stale')}</p><button type="button" className="tl-text-button" onClick={()=>void refresh()}>{t('common.retry')}</button></div>:null}
  {view==='main'?<>
   <button type="button" className="tl-summary" data-testid="space-position" aria-label={t('tl.balances')} onClick={()=>switchTab('balances',incoming.length>0)}>
    {failed?<span>{t('tl.unavailable')}</span>:!ready?<span role="status">{t('common.loading')}</span>:hidden?<div className="tl-directions"><div><span>{t('tl.collect')}</span><strong>••••</strong></div><div><span>{t('tl.pay')}</span><strong>••••</strong></div></div>:summary.rows.length?<div className="tl-directions"><div><span>{t('tl.collect')}</span>{summary.rows.map(row=><strong key={row.currency}>{money(row.collectMinor,row.currency)}</strong>)}</div><div><span>{t('tl.pay')}</span>{summary.rows.map(row=><strong key={row.currency}>{money(row.payMinor,row.currency)}</strong>)}</div></div>:<span>{t(visible.length?'tl.none':'tl.empty')}</span>}
    {ready&&!failed&&incoming.length>0?<span className="tl-pending">• {t(incoming.length===1?'tl.reviewOne':'tl.review',{count:incoming.length})} ›</span>:null}{ready&&!failed&&outgoing.length>0?<span className="tl-pending">{t(outgoing.length===1?'tl.sentOne':'tl.sent',{count:outgoing.length})}</span>:null}
   </button>
   <div className="tl-tabs" role="tablist" aria-label={t('tl.content')}>{(['expenses','balances']as const).map(value=><button type="button" key={value} id={'tl-tab-'+value} role="tab" aria-selected={tab===value} aria-controls={'tl-panel-'+value} tabIndex={tab===value?0:-1} onClick={()=>switchTab(value)} onKeyDown={event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'expenses':event.key==='End'?'balances':value==='expenses'?'balances':'expenses';switchTab(next);requestAnimationFrame(()=>document.getElementById('tl-tab-'+next)?.focus({preventScroll:true}))}}}>{t(value==='expenses'?'tl.expenses':'tl.balances')}</button>)}</div>
  </>:<h2 className="tl-view-title">{t(view==='history'?'tl.history':'tl.summary')}</h2>}
  {view==='history'?<div className="tl-history-tabs" role="group" aria-label={t('tl.history')}>{(['expenses','payments','activity']as const).map(value=><button type="button" key={value} aria-pressed={history===value} onClick={()=>changeHistory(value)}>{t(value==='expenses'?'tl.expenseChanges':value==='payments'?'tl.payments':'tl.activity')}</button>)}</div>:null}
  <section id="tl-panel-expenses" role="tabpanel" aria-labelledby="tl-tab-expenses" hidden={view!=='main'||tab!=='expenses'} data-testid="space-recent">
   <div className="tl-list-toolbar"><span>{ready?t('tl.count',{count:visible.length}):t('common.loading')}</span><button type="button" className="tl-icon-button" aria-label={t('common.refresh')} disabled={refreshing} onClick={()=>void refresh()}>↻</button></div>
   {!ready?failed?<p>{t('tl.unavailable')}</p>:<p role="status">{t('common.loading')}</p>:<div className="tl-paper-list">{!visible.length?<div className="tl-empty"><h2>{t('tl.empty')}</h2>{canWrite?<p>{t('tl.addHint')}</p>:null}</div>:visible.slice(0,limit).map((expense,index)=>{
    const pending=ledger.outbox.find(item=>item.command.requestId===expense.clientRequestId),own=expense.participations.find(p=>p.participantId===self),share=expense.shares.find(s=>s.expenseParticipationId===own?.id)?.amountMinor??0
    const payers=expense.payerContributions.filter(p=>p.amountMinor>0).map(p=>expense.participations.find(person=>person.id===p.expenseParticipationId)).filter(p=>!!p),dateLabel=expense.occurredOn===today?t('tl.today')+' · '+formatDate(today,lang):expense.occurredOn===shiftCalendarDay(today,-1)?t('tl.yesterday')+' · '+formatDate(expense.occurredOn,lang):formatDate(expense.occurredOn,lang)
    const content=<><span className="tl-expense-heading"><strong>{expense.description??t(categoryKey(expense.category))}</strong><b>{money(expense.totalMinor,expense.currency)}</b></span><span className="tl-expense-meta">{t('tl.paidBy',{names:payers.map(p=>p.participantId===self?t('common.you'):p.nameSnapshot||names.get(p.participantId)||t('common.member')).join(', ')})}</span><span className="tl-expense-meta">{t('space.yourShare',{amount:money(share,expense.currency)})}<span aria-hidden="true"> ›</span></span></>
    return <article key={expense.id} className="tl-expense" data-expense-id={expense.id}>{index===0||visible[index-1].occurredOn!==expense.occurredOn?<h3 className="tl-date-heading">{dateLabel}</h3>:null}{pending?<div className="tl-record-content">{content}</div>:<ExpenseActionSheet trigger={content} triggerClassName="tl-record-trigger" readOnlyFallback expense={expense} currentParticipantId={self} spaceRole={entry.role} onRefresh={refresh} onViewHistory={()=>openView('history',expense.id)}/>}{pending?<div className="tl-recovery"><span>{t(pending.status==='rejected'?'ledger.needsAttention':'ledger.pendingSync')}</span><PendingExpenseRecoveryActions item={pending} onUndoAdd={ledger.discardLocalCreate} onRetry={ledger.retryCommand} onDiscardFailed={ledger.discardFailedCreate}/></div>:null}<SharedRestartActions expense={expense} owner={self} onRefresh={refresh}/></article>
   })}</div>}
   {visible.length>limit?<button type="button" className="tl-text-button tl-more" onClick={()=>{setTripLedgerLimit(actor,trip,limit+20);setLimit(limit+20)}}>{t('tl.more')}</button>:null}
  </section>
  <section id="tl-panel-balances" role={view==='main'?'tabpanel':undefined} aria-labelledby={view==='main'?'tl-tab-balances':undefined} hidden={!(view==='main'&&tab==='balances'||view==='history'&&history==='payments'&&!hidden)} data-testid="space-balances">
   {!ready?failed?<p>{t('tl.unavailable')}</p>:<p role="status">{t('common.loading')}</p>:null}
   <div hidden={!ready||failed}><SettlementPanel context={context} currentParticipantId={self} participantNames={names} expenses={authoritative} canPropose={canManage} state={settlementState} view={view==='history'&&history==='payments'?'trip-history':'trip-current'} draftKey={actor+':'+self+':'+trip} onChanged={refresh}/></div>
   {view==='history'&&history==='payments'&&ready&&!failed&&!payments.length?<p>{t('tl.noPayments')}</p>:null}
  </section>
  {view==='history'&&hidden?<p>{t('notice.hiddenReview')} <button type="button" className="tl-text-button" onClick={()=>useStore.getState().setHomeUi({balanceHidden:false})}>{t('notice.show')}</button></p>:null}
  {view==='history'&&!hidden&&ready&&!failed&&history==='expenses'?<section><ExpenseHistoryList expenses={all} directRequests={[]} focusExpenseId={focused} includeCurrent={!!focused}/>{historyFailed?<p role="alert">{t('history.unavailable')}</p>:!hasChanges?<p>{t('tl.noChanges')}</p>:null}</section>:null}
  {view==='history'&&!hidden&&ready&&!failed&&history==='activity'?<ActivityFeed pageable spaceId={trip} expenseIds={all.map(e=>e.id)} settlementIds={payments.map(p=>p.id)} refreshKey={payments.map(p=>p.updatedAt).join('|')}/>:null}
  {view==='summary'?<section data-testid="space-recap">{failed||recapFailed?<p role="alert">{t('tl.unavailable')}</p>:!ready?<p role="status">{t('common.loading')}</p>:recap?.currencies.length?<div className="tl-paper-list">{recap.currencies.map(row=><article className="tl-recap-row" key={row.currency}><h3>{row.currency}</h3><strong>{money(row.totalMinor,row.currency)}</strong><p>{t('tl.count',{count:row.expenseCount})}</p>{row.categories.slice(0,3).map(category=><p className="tl-category" key={category.category}><span>{t(categoryKey(category.category))}</span><span>{money(category.totalMinor,row.currency)}</span></p>)}</article>)}</div>:<p>{t('space.insightsEmpty')}</p>}</section>:null}
  {!canWrite?<p className="tl-notice">{t(['owner','full_access'].includes(entry.role)?'tl.cannotAdd':'tl.readOnly')}</p>:null}
 </main>
}
