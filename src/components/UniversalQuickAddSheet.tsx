import {suggestQuickAddDescriptions} from '../lib/quickAddSuggestions'
import QuickPeoplePicker from './QuickPeoplePicker'
import QuickSaveKey from './QuickSaveKey'
import QuickPayment from './accounts/QuickPayment'
import { useQuickPayment, type QuickPaymentState } from '../hooks/useQuickPayment'
import { groupCalculation, groupAmount } from '../lib/amountDisplay'
import { capitalizeDescription } from '../lib/description'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { useAuth } from '../hooks/useAuth'
import type { CanonicalExpense } from '../types'
import { CURRENCIES } from '../lib/currency'
import { friendlyErrorKey, useT } from '../lib/i18n'
import type { UniversalQuickAddSession, UniversalQuickAddValues } from '../lib/universalQuickAdd'
import { todayIso } from '../lib/universalQuickAdd'
import { calculateQuickAmount } from '../lib/quickCalculator'
import { useStore } from '../store/useStore'
import { readQuickCategories, QUICK_CATEGORIES, type QuickCategory } from '../lib/quickCategories'
import { loadQuickAccounts, type QuickAccount } from '../lib/quickAccounts'
import { createPersonalAccount } from '../lib/personalAccountRepository'
import { loadMoneyContextCatalog, EMPTY_MONEY_CONTEXT_CATALOG, type MoneyContextCatalog } from '../lib/moneyContextCatalog'
import type { MoneyContextRef } from '../lib/moneyContext'
import { parseMajorAmount } from '../lib/money'
import QuickIcon from './QuickIcon'
import { QuickPanel, SplitConfiguration } from './SplitConfiguration'
import './quick-add.css'
import './quick-add-material.css'
import './quick-add-context.css'
import './quick-add-compact.css'
import './quick-add-v3.css'
import InlineContextPicker, { ContextIcon, type InlineCommit } from './InlineContextPicker'

type SaveOptions = { continueAdding?: boolean; beforeClose?: () => Promise<void>; values?: Partial<UniversalQuickAddValues> }
type Props = {
 session: UniversalQuickAddSession; expenses: CanonicalExpense[]
 onUpdate: (patch: Partial<UniversalQuickAddValues>) => void
 onCommitContext: InlineCommit
 onPickerOpenChange: (open: boolean) => void
 onConfigureSplit: (ref: MoneyContextRef, selectedIds?: string[]) => Promise<boolean>
 onClose: () => void
 onSubmit: (options?: SaveOptions) => Promise<{ok:boolean;error?:string;saveState?:string}>
}
type Panel = 'account'|'date'|'split'|'categories'|'categoryPicker'|null
function zeroOrMinor(raw:string,currency:string) {return !raw.trim() || /^0+(\.0*)?$/.test(raw.trim()) ? 0 : parseMajorAmount(raw,currency)}
export default function UniversalQuickAddSheet({session,expenses,onUpdate,onCommitContext,onPickerOpenChange,onConfigureSplit,onClose,onSubmit}:Props) {
 const {authUser}=useAuth()
 const zh=useStore(s=>s.lang)==='zh'
 const t=useT()
 const copy=(en:string,cn:string)=>zh?cn:en
 const values=session.values, context=session.context!
 const identity=session.identityKey
 const [panel,setPanel]=useState<Panel>(null)
 const [pickerHeight,setPickerHeight]=useState<number|null>(null)
 const [pickerOpen,setPickerOpen]=useState(false)
 const pickerOpenRef=useRef(false)
 const headerRef=useRef<HTMLButtonElement>(null)
 const closePicker=()=>{pickerOpenRef.current=false;onPickerOpenChange(false);setPickerOpen(false);window.requestAnimationFrame(()=>headerRef.current?.focus())}
 const togglePicker=()=>{if(pickerOpenRef.current){closePicker();return}setPickerHeight(document.getElementById('qa-context-picker')?.getBoundingClientRect().height??null);pickerOpenRef.current=true;onPickerOpenChange(true);setPickerOpen(true)}
 const pickerChangeRef=useRef(onPickerOpenChange);pickerChangeRef.current=onPickerOpenChange
 useEffect(()=>()=>pickerChangeRef.current(false),[])
 const panelSnapshot=useRef({values,ref:context.ref})
 const paymentSnapshot=useRef<QuickPaymentState['draft']|null>(null)
 const openPanel=(next:Panel)=>{if(pickerOpenRef.current)closePicker();panelSnapshot.current={values,ref:context.ref};if(next==='account')paymentSnapshot.current=payment.draft;setError('');setPanel(next)}
 const cancelPanel=async()=>{
  if(panel==='split'){
   const before=panelSnapshot.current
   if(session.contextPolicy==='switchable'){try{if(!await onConfigureSplit(before.ref,before.values.selectedParticipantIds)){setError(copy('The original split is unavailable. Choose people again.','原分摊对象已不可用，请重新选择。'));return}}catch{setError(copy('Could not restore the previous split. Please retry.','无法恢复原分摊，请重试。'));return}}
   onUpdate({selectedParticipantIds:before.values.selectedParticipantIds,splitMode:before.values.splitMode,exactShareAmounts:before.values.exactShareAmounts,payerAmounts:before.values.payerAmounts,items:before.values.items,detailsExpanded:before.values.detailsExpanded})
  }else if(panel==='account'){onUpdate({accountId:panelSnapshot.current.values.accountId});if(paymentSnapshot.current)payment.restore(paymentSnapshot.current)}
  else if(panel==='date')onUpdate({occurredOn:panelSnapshot.current.values.occurredOn})
  setPanel(null);setError('')
 }
 const [closing,setClosing]=useState(false)
 const closingTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const [saving,setSaving]=useState(false)
 const savingRef=useRef(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [categories,setCategories]=useState(()=>readQuickCategories(identity))
 const [categoryName,setCategoryName]=useState('')
 const [editingCategory,setEditingCategory]=useState<string|null>(null)
 const [accounts,setAccounts]=useState<QuickAccount[]>([])
 const [offline,setOffline]=useState(()=>!navigator.onLine)
 useEffect(()=>{const update=()=>setOffline(!navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])
 const [accountLoad,setAccountLoad]=useState<{sessionId:string;status:'loading'|'ready'|'error'}>({sessionId:session.sessionId,status:'loading'})
 const accountStatus=accountLoad.sessionId===session.sessionId?accountLoad.status:'loading'
 const setAccountStatus=useCallback((status:'loading'|'ready'|'error')=>setAccountLoad({sessionId:session.sessionId,status}),[session.sessionId])
 const [accountName,setAccountName]=useState('')
 const [accountType,setAccountType]=useState<'cash'|'bank'|'ewallet'>('ewallet')
 const [addingAccount,setAddingAccount]=useState(false)
 const [accountBusy,setAccountBusy]=useState(false)
 const [catalog,setCatalog]=useState<MoneyContextCatalog>(EMPTY_MONEY_CONTEXT_CATALOG)
 const [catalogStatus,setCatalogStatus]=useState<'loading'|'ready'|'error'>('loading')
 const [tab,setTab]=useState<'people'|'groups'|'trips'>('people')
 const [friendIds,setFriendIds]=useState<string[]>([])
 const [splitStage,setSplitStage]=useState<'pick'|'configure'>('pick')
 const [splitBusy,setSplitBusy]=useState(false)
 const [month,setMonth]=useState(()=>values.occurredOn.slice(0,7))
 const evaluatedRef=useRef(false)
 const close=()=>{
  if(savingRef.current||accountBusy||splitBusy)return
  if(pickerOpenRef.current){pickerOpenRef.current=false;onPickerOpenChange(false)}
  if(panel){void cancelPanel();return}
  if(closingTimer.current)return
  setClosing(true)
  closingTimer.current=setTimeout(onClose,200)
 }
 const dialogRef=useAccessibleDialog<HTMLElement>(()=>{if(pickerOpenRef.current){closePicker();return}close()})
 useEffect(()=>()=>{if(closingTimer.current)clearTimeout(closingTimer.current)},[])
 const noteKeyboard=useRef(false)
 useEffect(()=>{
  const viewport=window.visualViewport
  if(!viewport)return
  let baseline=viewport.height
  const resize=()=>{const node=dialogRef.current;const focused=node?.querySelector('.qa-note input')===document.activeElement;if(!focused){baseline=viewport.height;noteKeyboard.current=false;node?.classList.remove('qa-note-editing');return}baseline=Math.max(baseline,viewport.height);noteKeyboard.current=viewport.height<baseline-80;node?.classList.toggle('qa-note-editing',noteKeyboard.current)}
  viewport.addEventListener('resize',resize);return()=>viewport.removeEventListener('resize',resize)
 },[dialogRef])
 const updateRef=useRef(onUpdate); updateRef.current=onUpdate
 const valuesRef=useRef(values);valuesRef.current=values
 useEffect(()=>{
  let active=true
  void loadQuickAccounts().then(rows=>{
   if(!active)return
   setAccounts(rows);setAccountStatus('ready')
   if(valuesRef.current.accountId===undefined) updateRef.current({accountId:rows.find(r=>r.is_default)?.id??null})
  }).catch(()=>{if(active)setAccountStatus('error')})
  return()=>{active=false}
 },[identity,offline,session.sessionId,setAccountStatus])
 const selectedAccount=accounts.find(a=>a.id===values.accountId)
 const expression=values.calculation??values.amount
 const currentCategory=categories.find(c=>c.name===values.category)
 const categoryLabel=(category:QuickCategory)=>zh?(category.zh??category.name):category.name
 const computedAmount=(()=>{try{return calculateQuickAmount(expression,values.currency)}catch{return ''}})()
 const selected=context.availableParticipants.filter(p=>values.selectedParticipantIds.includes(p.id))
 const friends=context.ref.kind==='person'?selected.filter(p=>p.id!==context.currentParticipantId):[]
 const ledgerName=context.ref.kind==='personal'?copy('Personal ledger','个人账本'):context.ref.kind==='space'?context.ref.displayName:friends.length>1?`${friends[0].displayName} +${friends.length-1}`:friends[0]?.displayName??context.ref.displayName
 const ledgerNames=context.ref.kind==='person'?friends.map(p=>p.displayName).join(', ')||context.ref.displayName:ledgerName
 const total=(()=>{try{return parseMajorAmount(computedAmount,values.currency)}catch{return 0}})()
 const selfPaid=(()=>{try{return Object.values(values.payerAmounts).some(a=>a.trim())?zeroOrMinor(values.payerAmounts[context.currentParticipantId]??'',values.currency):total}catch{return 0}})()
 const payment=useQuickPayment({draftKey:session.sessionId,accounts,parentId:selectedAccount?.parentAccountId??null,currency:values.currency,selfPaid,identity,offline,enabled:accountStatus==='ready',onPlan:fundingPlan=>onUpdate({fundingPlan})})
 const fundingValid=payment.valid
 const recommendation=useMemo(()=>values.categorySource==='USER'?'':values.categorySource==='SUGGESTED'?values.category:suggestQuickAddDescriptions({expenses,context:context.ref,limit:1}).find(s=>s.score>0)?.category??'',[expenses,context.ref,values.categorySource,values.category])
 const featuredCategories=categories===QUICK_CATEGORIES?['Food','Coffee','Drink','Groceries','Transport','Shopping','Bills'].map(name=>categories.find(c=>c.name===name)!):categories.slice(0,7)
 if(currentCategory&&!featuredCategories.includes(currentCategory))featuredCategories[featuredCategories.length-1]=currentCategory
 const splitEnabled=values.selectedParticipantIds.some(id=>id!==context.currentParticipantId)
 const keypad=(key:string)=>{
  if(saving)return
  setError('');setNotice('')
  if(key==='='){
   if(!computedAmount){setError(copy('Check the calculation.','请检查算式。'));return}
   onUpdate({amount:computedAmount,calculation:computedAmount});evaluatedRef.current=true;return
  }
  const previous=evaluatedRef.current && /^[\d.]$/.test(key)?'':expression
  evaluatedRef.current=false
  const next=key==='C'?'':key==='⌫'?previous.slice(0,-1):(previous+key).slice(0,120)
  onUpdate({calculation:next,amount:next})
 }
 const chooseCategory=(category:QuickCategory)=>{
  setError('')
  onUpdate({category:category.name,categorySource:'USER'})
 }
 const save=async(continueAdding:boolean)=>{
  if(panel||savingRef.current||pickerOpenRef.current||!offline&&(accountStatus!=='ready'||selfPaid>0&&!fundingValid))return
  if(!computedAmount||!total||!values.category||values.categorySource==='SUGGESTED'){setError(copy('Choose a category and enter a valid amount.','请选择分类并输入有效金额。'));return}
  savingRef.current=true;setSaving(true);setError('')
  try{
   const result=await onSubmit({continueAdding,beforeClose:async()=>{setClosing(true);await new Promise<void>(resolve=>setTimeout(resolve,200))},values:{...(selfPaid>0?{fundingPlan:payment.plan}:{}),...(offline&&selfPaid>0&&!fundingValid?{fundingPlan:{mode:'deferred' as const,primary_account_id:selectedAccount?.parentAccountId??null,legs:[],covers_owner_payment:false}}:{}),amount:computedAmount,calculation:computedAmount,description:capitalizeDescription(values.description.trim()|| (currentCategory?categoryLabel(currentCategory):values.category))}})
   if(!result.ok){setError(t(friendlyErrorKey(result.error)));return}
   if(continueAdding){evaluatedRef.current=false;setNotice(result.saveState==='pending-sync'?copy('Saved on this device · waiting to sync.','已保存在本机，等待同步。'):result.saveState==='needs-attention'?copy('This record needs attention in Daily.','这笔记录需要在 Daily 中处理。'):result.saveState==='awaiting-confirmation'?copy('Saved · awaiting your friend’s confirmation.','已保存，等待朋友确认。'):copy('Saved. Ready for the next one.','已保存，可以继续记下一笔。'))}
  }catch{setError(copy('Could not save. Your input is still here.','暂时无法保存，输入内容已保留。'))}
  finally{savingRef.current=false;setSaving(false)}
 }
 const openSplit=async()=>{
  if(panel!=='split')openPanel('split');setError('');setSplitStage(context.ref.kind!=='personal'?'configure':'pick');setCatalogStatus('loading')
  setFriendIds(values.selectedParticipantIds.filter(id=>id!==context.currentParticipantId))
  try{setCatalog(await loadMoneyContextCatalog({isAnonymous:Boolean(authUser?.isAnonymous)}));setCatalogStatus('ready')}
  catch{setCatalogStatus('error')}
 }
 const configure=async(ref:MoneyContextRef,ids?:string[])=>{
  setSplitBusy(true);setError('')
  try{if(await onConfigureSplit(ref,ids)){setSplitStage('configure')}else setError(copy('This selection is no longer available.','这个对象已不可用。'))}
  catch{setError(copy('Could not load members. Please retry.','无法加载成员，请重试。'))}
  finally{setSplitBusy(false)}
 }
 const storeCategories=(rows:QuickCategory[])=>{
  setCategories(rows)
  try{localStorage.setItem(`tt-categories:${identity}`,JSON.stringify(rows))}catch{setError(copy('Category settings could not be saved on this device.','分类设置无法保存在本机。'))}
 }
 const addCategory=()=>{
  const name=categoryName.trim()
  if(!name||categories.some(c=>c.name===name&&c.name!==editingCategory)){setError(copy('Use a unique category name.','请输入不重复的分类名称。'));return}
  const rows=editingCategory?categories.map(c=>c.name===editingCategory?{name,icon:c.icon}:c):[...categories,{name,icon:'Other'}]
  storeCategories(rows)
  if(editingCategory===values.category)onUpdate({category:name})
  setCategoryName('');setEditingCategory(null);setError('')
 }
 const addAccount=async()=>{
  if(!accountName.trim()||accountBusy)return
  setAccountBusy(true);setError('')
  try{const {accountId}=await createPersonalAccount({name:accountName.trim(),accountType,currency:values.currency,openingBalanceMinor:null,balanceAsOf:null});setAccounts(await loadQuickAccounts());onUpdate({accountId});setAccountName('');setAddingAccount(false);setAccountStatus('ready');window.dispatchEvent(new Event('tt:accounts-changed'))}
  catch{setError(copy('Account could not be created. Please retry.','账户创建失败，请重试。'))}
  finally{setAccountBusy(false)}
 }
 const shiftMonth=(delta:number)=>{const [y,m]=month.split('-').map(Number);const date=new Date(y,m-1+delta,1);setMonth(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`)}
 const [year,monthNumber]=month.split('-').map(Number)
 const monthStart=new Date(year,monthNumber-1,1),days=new Date(year,monthNumber,0).getDate()
 return <div className={`qa-backdrop${closing?' qa-leaving':''}`}><main ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="qa-title" tabIndex={-1} className="qa-main qa-stationery tt-qa-context qa-v3">
 <div className="qa-content" inert={saving}>
 <h1 id="qa-title" className="qa-sr-only">{copy('Quick Add','记一笔')}</h1>
 <header className="qa-header"><button type="button" className="qa-icon-button" onClick={close} aria-label={copy('Close Quick Add','关闭快速记账')}><QuickIcon name="back"/></button><button ref={headerRef} type="button" className="qa-context-button" data-testid="quick-add-ledger" aria-label={copy(`Change ledger: ${ledgerNames}`,`切换账本：${ledgerNames}`)} aria-expanded={pickerOpen} aria-controls="qa-context-picker" onClick={togglePicker} disabled={session.contextPolicy==='locked'}><ContextIcon name={context.ref.kind==='personal'?'user':context.ref.kind==='space'&&context.ref.spaceType==='trip'?'map':'users'}/><span><span className="qa-context-name">{ledgerName}</span></span><ContextIcon name={pickerOpen?'chevron-up':'chevron-down'}/></button></header>
 <div className={`qa-category-or-picker-slot${pickerOpen?' is-picker-open':''}`} id="qa-context-picker" style={pickerOpen&&pickerHeight?{height:pickerHeight,flexBasis:pickerHeight,minHeight:pickerHeight}:undefined}>{pickerOpen?<InlineContextPicker session={session} expenses={expenses} zh={zh} onCommit={onCommitContext} onCancel={closePicker} onCommitted={(next,friends)=>{closePicker();if(friends){panelSnapshot.current={values:next.values,ref:next.context!.ref};setSplitStage('configure');setPanel('split');setError('')}}}/>:
 <div className="qa-categories" aria-label={copy('Expense categories','支出分类')}><div className="qa-category-grid">{featuredCategories.map(category=><button key={category.name} type="button" aria-pressed={values.category===category.name&&values.categorySource==='USER'} className={`qa-category${values.category===category.name?(values.categorySource==='USER'?' is-selected':' is-suggested'):category.name===recommendation?' is-suggested':''}`} onClick={()=>chooseCategory(category)}><QuickIcon name={category.icon}/><span>{categoryLabel(category)}</span>{values.category===category.name&&values.categorySource==='USER'?<span className="qa-category-check" aria-hidden="true"><QuickIcon name="check" size={11}/></span>:null}</button>)}<button type="button" className="qa-category qa-category-more" onClick={()=>openPanel('categoryPicker')}><QuickIcon name="Other"/><span>{copy('All categories','全部分类')}</span></button></div></div>}</div>
 <div className="qa-entry-zone">
 {notice?<p className="qa-notice" role="status"><QuickIcon name="check" size={16}/>{notice}</p>:null}
 <div className="qa-context-row">
 <button type="button" className="qa-account-trigger" onClick={()=>openPanel('account')}><small>{copy('ACCOUNT','账户')}</small><span><QuickIcon name="wallet"/><span>{selectedAccount?.name??copy('No account','无账户')}</span><span>⌄</span></span>{accountStatus==='loading'||selfPaid>0&&!fundingValid?<small>{accountStatus==='loading'?copy('Loading…','加载中…'):copy('Review','核对')}</small>:null}</button>
 <button type="button" className="qa-split-trigger" aria-label={copy('Split expense','分摊消费')} onClick={()=>void openSplit()}><small>{copy('SPLIT','分摊')}</small><span><QuickIcon name="split"/>{splitEnabled?copy(`Shared · ${selected.length}`,`共享 · ${selected.length}`):copy('Personal','个人')}<span>⌄</span></span></button>
 </div>
 <div className="qa-receipt"><div className="qa-receipt-line"><select aria-label={t('expense.currency')} value={values.currency} onChange={e=>onUpdate({currency:e.target.value})}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code==='MYR'?'RM':c.code}</option>)}</select><input className="qa-receipt-amount" aria-label={t('expense.amount')} value={groupCalculation(expression)} readOnly inputMode="none" onKeyDown={e=>{if(/^[0-9.+%*/-]$/.test(e.key)){e.preventDefault();keypad(e.key)}else if(e.key==='Backspace'){e.preventDefault();keypad('⌫')}else if(e.key==='Enter'){e.preventDefault();keypad('=')}}} placeholder="0.00"/><button type="button" className="qa-receipt-date" data-changed={values.occurredOn!==todayIso()} aria-label={copy(`Date: ${values.occurredOn}`,`日期：${values.occurredOn}`)} onClick={()=>{setMonth(values.occurredOn.slice(0,7));openPanel('date')}}><QuickIcon name="calendar"/><small>{values.occurredOn===todayIso()?copy('Today','今天'):values.occurredOn.slice(5)}</small></button></div>
 {/[+×÷−%]/.test(expression)&&computedAmount?<small className="qa-calculated">= {groupAmount(computedAmount)}</small>:null}
 <label className="qa-note"><QuickIcon name="edit" size={16}/><input aria-label={copy('Note','备注')} value={values.description} placeholder={copy('Add note (optional)','添加备注（可选）')} maxLength={500} autoCapitalize="sentences" enterKeyHint="done" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}} onFocus={()=>{if(noteKeyboard.current)dialogRef.current?.classList.add('qa-note-editing')}} onBlur={()=>dialogRef.current?.classList.remove('qa-note-editing')} onChange={e=>onUpdate({description:e.target.value})}/></label></div>
 <div className="qa-keypad">{['C','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','='].map(key=><button type="button" key={key} className={key==='='?'qa-operator qa-equals':['÷','×','−','+','%'].includes(key)?'qa-operator':''} aria-label={key==='C'?copy('Clear calculation','清除算式'):key==='⌫'?copy('Backspace','退格'):key==='='?copy('Calculate amount','计算金额'):key} onClick={()=>keypad(key)}>{key}</button>)}<QuickSaveKey key={session.sessionId} zh={zh} disabled={panel!==null||pickerOpen||saving||(!offline&&(accountStatus!=='ready'||selfPaid>0&&!fundingValid))} canContinue={session.captureSource==='manual'&&session.contextPolicy!=='locked'} onSave={next=>void save(next)}/></div>
 {accountStatus==='error'&&!offline?<p className="qa-helper">{copy('Accounts unavailable · retry before saving.','账户暂不可用：请重试后再保存。')}</p>:null}
 {offline?<p className="qa-helper">{t('mc.offlineDraft')}</p>:null}

 {error&&!panel?<p className="qa-error" role="alert">{error}</p>:null}

 </div></div>
 {panel==='account'?<QuickPanel title={copy('Payment account','付款账户')} onClose={()=>{if(!accountBusy)void cancelPanel()}}><div className="qa-panel-body">
 {accountStatus==='error'?<div className="qa-error" role="alert">{copy('Could not load accounts.','无法加载账户。')}<button type="button" onClick={()=>{setAccountStatus('loading');void loadQuickAccounts().then(rows=>{setAccounts(rows);setAccountStatus('ready')}).catch(()=>setAccountStatus('error'))}}>{copy('Retry','重试')}</button></div>:accountStatus==='loading'?<p>{copy('Loading accounts…','正在加载账户…')}</p>:<>{accounts.filter(a=>a.id===a.parentAccountId).map(a=><button type="button" key={a.id} className={`qa-account-row${a.id===values.accountId?' is-selected':''}`} aria-pressed={a.id===values.accountId} onClick={()=>{onUpdate({accountId:a.id});setPanel(null)}}><span className="qa-icon-tile"><QuickIcon name={a.account_type==='bank'?'bank':a.account_type==='cash'?'cash':'wallet'}/></span><span><strong>{a.name}</strong><small>{a.account_type==='ewallet'?copy('E-wallet','电子钱包'):a.account_type==='cash'?copy('Cash','现金'):copy('Bank account','银行账户')} · {[...new Set(accounts.filter(unit=>(unit.parentAccountId??unit.id)===(a.parentAccountId??a.id)).map(unit=>unit.currency))].join(' · ')}</small></span>{a.is_default?<small className="qa-badge">{copy('Default','默认')}</small>:null}<span className="qa-radio">{a.id===values.accountId?<QuickIcon name="check" size={14}/>:null}</span></button>)}<button className={`qa-account-row${values.accountId===null?' is-selected':''}`} aria-pressed={values.accountId===null} type="button" onClick={()=>{onUpdate({accountId:null});setPanel(null)}}><span className="qa-icon-tile"><QuickIcon name="wallet"/></span><span><strong>{copy('No account','无账户')}</strong><small>{copy('Record without wallet debit','只记录消费，不扣钱包')}</small></span><span className="qa-radio">{values.accountId===null?<QuickIcon name="check" size={14}/>:null}</span></button></>}
 {addingAccount?<div className="qa-stack"><label>{copy('Account name','账户名称')}<input value={accountName} maxLength={100} onChange={e=>setAccountName(e.target.value)} placeholder="Touch ’n Go"/></label><label>{copy('Type','类型')}<select value={accountType} onChange={e=>setAccountType(e.target.value as typeof accountType)}><option value="ewallet">{copy('E-wallet','电子钱包')}</option><option value="cash">{copy('Cash','现金')}</option><option value="bank">{copy('Bank account','银行账户')}</option></select></label><p className="qa-helper">{values.currency} · {copy('Opening balance can be completed in account settings.','期初余额可在账户设置中补充。')}</p><button className="qa-primary" type="button" disabled={accountBusy||!accountName.trim()} onClick={()=>void addAccount()}>{accountBusy?copy('Creating…','创建中…'):copy('Create account','创建账户')}</button></div>:<button className="qa-add-row" type="button" onClick={()=>setAddingAccount(true)}><QuickIcon name="plus"/>{copy('Add account','新增账户')}</button>}
 {selfPaid>0&&accountStatus==='ready'?<QuickPayment payment={payment} accounts={accounts} busy={saving||accountBusy}/>:null}
 </div>{error?<p className="qa-error" role="alert">{error}</p>:null}<button className="qa-primary qa-panel-footer" type="button" onClick={()=>setPanel(null)} disabled={accountBusy||accountStatus==='loading'||selfPaid>0&&!fundingValid}>{copy('Done','完成')}</button></QuickPanel>:null}
 {panel==='date'?<QuickPanel title={copy('Date','日期')} onClose={()=>void cancelPanel()}><div className="qa-calendar-top"><button type="button" aria-label={copy('Previous month','上个月')} onClick={()=>shiftMonth(-1)}>‹</button><strong>{monthStart.toLocaleDateString(zh?'zh-CN':'en-GB',{month:'long',year:'numeric'})}</strong><button type="button" aria-label={copy('Next month','下个月')} onClick={()=>shiftMonth(1)}>›</button></div><div className="qa-calendar">{(zh?['日','一','二','三','四','五','六']:['Su','Mo','Tu','We','Th','Fr','Sa']).map(d=><small key={d}>{d}</small>)}{Array.from({length:monthStart.getDay()},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:days},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,'0')}`;return <button type="button" key={date} aria-label={date} aria-pressed={values.occurredOn===date} className={values.occurredOn===date?'is-selected':''} onClick={()=>onUpdate({occurredOn:date})}>{i+1}</button>})}</div><div className="qa-two-buttons"><button type="button" onClick={()=>{onUpdate({occurredOn:todayIso()});setMonth(todayIso().slice(0,7))}}>{copy('Today','今天')}</button><button type="button" className="qa-primary" onClick={()=>setPanel(null)}>{copy('Confirm date','确认日期')}</button></div></QuickPanel>:null}
 {panel==='categoryPicker'?<QuickPanel title={copy('All categories','全部分类')} onClose={()=>setPanel(null)}><div className="qa-panel-body"><div className="qa-category-grid">{categories.map(category=><button key={category.name} type="button" aria-pressed={values.category===category.name&&values.categorySource==='USER'} className={`qa-category${values.category===category.name?(values.categorySource==='USER'?' is-selected':' is-suggested'):category.name===recommendation?' is-suggested':''}`} onClick={()=>{chooseCategory(category);setPanel(null)}}><QuickIcon name={category.icon}/><span>{categoryLabel(category)}</span></button>)}</div></div><button type="button" className="qa-text-button qa-panel-footer" onClick={()=>setPanel('categories')}><QuickIcon name="edit"/>{copy('Edit categories','编辑分类')}</button></QuickPanel>:null}
 {panel==='categories'?<QuickPanel title={copy('Edit categories','编辑分类')} onClose={()=>setPanel(null)}><div className="qa-panel-body"><div className="qa-stack"><label>{editingCategory?copy('Rename category','重命名分类'):copy('New category','新增分类')}<input value={categoryName} maxLength={100} onChange={e=>setCategoryName(e.target.value)}/></label><button type="button" className="qa-primary" onClick={addCategory}>{editingCategory?copy('Update','更新'):copy('Add category','新增分类')}</button></div>{categories.map((c,i)=><div className="qa-category-edit-row" key={c.name}><QuickIcon name={c.icon}/><button type="button" onClick={()=>{setEditingCategory(c.name);setCategoryName(c.name)}}>{categoryLabel(c)}</button><button type="button" aria-label={copy(`Move ${c.name} up`,`${c.name} 上移`)} disabled={i===0} onClick={()=>{const next=[...categories];[next[i-1],next[i]]=[next[i],next[i-1]];storeCategories(next)}}>↑</button><button type="button" aria-label={copy(`Move ${c.name} down`,`${c.name} 下移`)} disabled={i===categories.length-1} onClick={()=>{const next=[...categories];[next[i+1],next[i]]=[next[i],next[i+1]];storeCategories(next)}}>↓</button><button type="button" aria-label={copy(`Remove ${c.name}`,`删除 ${c.name}`)} disabled={categories.length<=1} onClick={()=>{storeCategories(categories.filter(row=>row.name!==c.name));if(values.category===c.name)onUpdate({category:'',categorySource:'DEFAULT'})}}><QuickIcon name="close" size={16}/></button></div>)}</div>{error?<p role="alert" className="qa-error">{error}</p>:null}<button type="button" className="qa-primary qa-panel-footer" onClick={()=>setPanel(null)}>{copy('Done','完成')}</button></QuickPanel>:null}
 {panel==='split'?<QuickPanel title={copy('Split expense','分摊消费')} onClose={()=>{if(!splitBusy)void cancelPanel()}}><div className="qa-panel-body qa-split-host">
 {splitStage==='pick'?<QuickPeoplePicker catalog={catalog} status={catalogStatus} ids={friendIds} onIds={setFriendIds} tab={tab} onTab={setTab} busy={splitBusy} zh={zh} total={`${values.currency==='MYR'?'RM':values.currency} ${groupAmount(computedAmount||'0')}`} onChoose={(ref,ids)=>void configure(ref,ids)} onRetry={()=>void openSplit()}/>:<>
 <SplitConfiguration compact values={values} participants={context.availableParticipants} currentParticipantId={context.currentParticipantId} label={context.ref.kind==='personal'?copy('Personal','个人'):context.ref.displayName} accountLabel={selectedAccount?.name??copy('No account linked','未关联账户')} zh={zh} onUpdate={onUpdate} onApply={()=>setPanel(null)} allowEmptyTotal busy={splitBusy} onChoosePeople={session.contextPolicy==='switchable'?()=>{void openSplit();setSplitStage('pick')}:undefined} onRemove={session.contextPolicy==='switchable'?()=>{void onConfigureSplit(context.ref.kind==='space'?context.ref:{kind:'personal'},context.ref.kind==='space'?[context.currentParticipantId]:undefined).then(ok=>{if(ok)setPanel(null)}).catch(()=>setError(copy('Could not remove split. Please retry.','无法取消分摊，请重试。')))}:undefined}/></>}

 </div>{error?<p role="alert" className="qa-error">{error}</p>:null}</QuickPanel>:null}
 </main></div>
}
