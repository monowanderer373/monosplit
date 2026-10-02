import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { useAuth } from '../hooks/useAuth'
import type { CanonicalExpense } from '../types'
import { CURRENCIES } from '../lib/currency'
import { friendlyErrorKey, useT } from '../lib/i18n'
import type { UniversalQuickAddSession, UniversalQuickAddValues } from '../lib/universalQuickAdd'
import { todayIso } from '../lib/universalQuickAdd'
import { calculateQuickAmount } from '../lib/quickCalculator'
import { useStore } from '../store/useStore'
import { readQuickCategories, type QuickCategory } from '../lib/quickCategories'
import { loadQuickAccounts, type QuickAccount } from '../lib/quickAccounts'
import { createPersonalAccount } from '../lib/personalAccountRepository'
import { loadMoneyContextCatalog, EMPTY_MONEY_CONTEXT_CATALOG, type MoneyContextCatalog } from '../lib/moneyContextCatalog'
import type { MoneyContextRef } from '../lib/moneyContext'
import { currencyExponent, equalMinorShares, parseMajorAmount } from '../lib/money'
import QuickIcon from './QuickIcon'
import './quick-add.css'

type SaveOptions = { continueAdding?: boolean; beforeClose?: () => Promise<void>; values?: Partial<UniversalQuickAddValues> }
type Props = {
 session: UniversalQuickAddSession; expenses: CanonicalExpense[]
 onUpdate: (patch: Partial<UniversalQuickAddValues>) => void
 onOpenContextPicker: () => void
 onConfigureSplit: (ref: MoneyContextRef, selectedIds?: string[]) => Promise<boolean>
 onClose: () => void
 onSubmit: (options?: SaveOptions) => Promise<{ok:boolean;error?:string;saveState?:string}>
}
type Panel = 'account'|'date'|'split'|'categories'|null
function QuickPanel({title,onClose,children}: {title:string;onClose:()=>void;children:ReactNode}) {
 const ref=useAccessibleDialog<HTMLElement>(onClose)
 return <div className="qa-overlay"><div className="qa-scrim" onClick={onClose} aria-hidden="true"/><section ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="qa-panel"><div className="qa-handle"/><header><h2>{title}</h2><button type="button" className="qa-icon-button" aria-label="Close panel" onClick={onClose}><QuickIcon name="close"/></button></header>{children}</section></div>
}
function major(minor:number,currency:string) {return (minor/10**currencyExponent(currency)).toFixed(currencyExponent(currency))}
function zeroOrMinor(raw:string,currency:string) {return !raw.trim() || /^0+(\.0*)?$/.test(raw.trim()) ? 0 : parseMajorAmount(raw,currency)}
export default function UniversalQuickAddSheet({session,onUpdate,onConfigureSplit,onClose,onSubmit}:Props) {
 const {authUser}=useAuth()
 const zh=useStore(s=>s.lang)==='zh'
 const t=useT()
 const copy=(en:string,cn:string)=>zh?cn:en
 const values=session.values, context=session.context!
 const identity=session.identityKey
 const [panel,setPanel]=useState<Panel>(null)
 const panelSnapshot=useRef({values,ref:context.ref})
 const openPanel=(next:Panel)=>{panelSnapshot.current={values,ref:context.ref};setError('');setPanel(next)}
 const cancelPanel=async()=>{
  if(panel==='split'){
   const before=panelSnapshot.current
   if(session.contextPolicy==='switchable'){try{if(!await onConfigureSplit(before.ref,before.values.selectedParticipantIds)){setError(copy('The original split is unavailable. Choose people again.','原分摊对象已不可用，请重新选择。'));return}}catch{setError(copy('Could not restore the previous split. Please retry.','无法恢复原分摊，请重试。'));return}}
   onUpdate({selectedParticipantIds:before.values.selectedParticipantIds,splitMode:before.values.splitMode,exactShareAmounts:before.values.exactShareAmounts,payerAmounts:before.values.payerAmounts,items:before.values.items,detailsExpanded:before.values.detailsExpanded})
  }else if(panel==='account')onUpdate({accountId:panelSnapshot.current.values.accountId})
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
 const [accountStatus,setAccountStatus]=useState<'loading'|'ready'|'error'>('loading')
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
 const [payerOpen,setPayerOpen]=useState(false)
 const [month,setMonth]=useState(()=>values.occurredOn.slice(0,7))
 const evaluatedRef=useRef(false)
 const close=()=>{
  if(savingRef.current||accountBusy||splitBusy)return
  if(panel){void cancelPanel();return}
  if(closingTimer.current)return
  setClosing(true)
  closingTimer.current=setTimeout(onClose,200)
 }
 const dialogRef=useAccessibleDialog<HTMLElement>(close)
 useEffect(()=>()=>{if(closingTimer.current)clearTimeout(closingTimer.current)},[])
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
 },[identity])
 const selectedAccount=accounts.find(a=>a.id===values.accountId)
 const expression=values.calculation??values.amount
 const currentCategory=categories.find(c=>c.name===values.category)
 const categoryLabel=(category:QuickCategory)=>zh?(category.zh??category.name):category.name
 const computedAmount=(()=>{try{return calculateQuickAmount(expression,values.currency)}catch{return ''}})()
 const money=(n:number)=>`${values.currency==='MYR'?'RM':values.currency} ${major(n,values.currency)}`
 const selected=context.availableParticipants.filter(p=>values.selectedParticipantIds.includes(p.id))
 const ordered=[...selected].sort((a,b)=>a.id===context.currentParticipantId?-1:b.id===context.currentParticipantId?1:0)
 const total=(()=>{try{return parseMajorAmount(computedAmount,values.currency)}catch{return 0}})()
 const shares=(()=>{try{return values.splitMode==='equal'?equalMinorShares(total,ordered.map(p=>p.id)):new Map(ordered.map(p=>[p.id,zeroOrMinor(values.exactShareAmounts[p.id]??'',values.currency)]))}catch{return new Map<string,number>()}})()
 const selfPaid=(()=>{try{return Object.values(values.payerAmounts).some(a=>a.trim())?zeroOrMinor(values.payerAmounts[context.currentParticipantId]??'',values.currency):total}catch{return 0}})()
 const selfShare=shares.get(context.currentParticipantId)??0
 const setExact=(id:string,raw:string)=>{
  const amounts={...values.exactShareAmounts,[id]:raw},last=ordered.at(-1)?.id
  if(last && last!==id && total>0){try{const assigned=ordered.filter(p=>p.id!==last).reduce((sum,p)=>sum+zeroOrMinor(amounts[p.id]??'',values.currency),0);if(assigned<=total)amounts[last]=major(total-assigned,values.currency)}catch{/* Keep invalid input visible until corrected. */}}
  onUpdate({exactShareAmounts:amounts})
 }
 const splitEnabled=context.ref.kind!=='personal'
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
  const old=currentCategory?categoryLabel(currentCategory):values.category
  onUpdate({category:category.name,categorySource:'USER',description:!values.description||values.description===old?categoryLabel(category):values.description})
 }
 const save=async(continueAdding:boolean)=>{
  if(savingRef.current)return
  if(!computedAmount||!total||!values.category){setError(copy('Choose a category and enter a valid amount.','请选择分类并输入有效金额。'));return}
  savingRef.current=true;setSaving(true);setError('')
  try{
   const result=await onSubmit({continueAdding,beforeClose:async()=>{setClosing(true);await new Promise<void>(resolve=>setTimeout(resolve,200))},values:{amount:computedAmount,calculation:computedAmount,description:values.description.trim()|| (currentCategory?categoryLabel(currentCategory):values.category)}})
   if(!result.ok){setError(t(friendlyErrorKey(result.error)));return}
   if(continueAdding){evaluatedRef.current=false;setNotice(result.saveState==='pending-sync'?copy('Saved on this device · waiting to sync.','已保存在本机，等待同步。'):result.saveState==='needs-attention'?copy('This record needs attention in Daily.','这笔记录需要在 Daily 中处理。'):result.saveState==='awaiting-confirmation'?copy('Saved · awaiting your friend’s confirmation.','已保存，等待朋友确认。'):copy('Saved. Ready for the next one.','已保存，可以继续记下一笔。'))}
  }catch{setError(copy('Could not save. Your input is still here.','暂时无法保存，输入内容已保留。'))}
  finally{savingRef.current=false;setSaving(false)}
 }
 const openSplit=async()=>{
  if(panel!=='split')openPanel('split');setError('');setSplitStage(splitEnabled?'configure':'pick');setCatalogStatus('loading')
  setFriendIds(values.selectedParticipantIds.filter(id=>id!==context.currentParticipantId))
  try{setCatalog(await loadMoneyContextCatalog({isAnonymous:Boolean(authUser?.isAnonymous)}));setCatalogStatus('ready')}
  catch{setCatalogStatus('error')}
 }
 const configure=async(ref:MoneyContextRef,ids?:string[])=>{
  setSplitBusy(true);setError('')
  try{if(await onConfigureSplit(ref,ids)){setSplitStage('configure');setPayerOpen(false)}else setError(copy('This selection is no longer available.','这个对象已不可用。'))}
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
  if(editingCategory===values.category)onUpdate({category:name,description:values.description===editingCategory?name:values.description})
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
 return <div className={`qa-backdrop${closing?' qa-leaving':''}`}><main ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="qa-title" tabIndex={-1} className="qa-main">
 <div className="qa-content" inert={panel!==null || saving}>
 <header className="qa-header"><button type="button" className="qa-icon-button" onClick={close} aria-label={copy('Close Quick Add','关闭快速记账')}><QuickIcon name="back"/></button><div><h1 id="qa-title">{copy('Quick Add','记一笔')}</h1><p>{copy('Expense','支出')}</p></div><span className="qa-header-spacer"/></header>
 <div className="qa-categories" aria-label={copy('Expense categories','支出分类')}><div className="qa-category-grid">{categories.map(category=><button key={category.name} type="button" aria-pressed={values.category===category.name} className={`qa-category${values.category===category.name?' is-selected':''}`} onClick={()=>chooseCategory(category)}><QuickIcon name={category.icon}/><span>{categoryLabel(category)}</span></button>)}<button type="button" className="qa-category qa-edit" onClick={()=>{setError('');setPanel('categories')}}><QuickIcon name="edit"/><span>{copy('Edit','编辑')}</span></button></div></div>
 <div className="qa-entry-zone">
 {notice?<p className="qa-notice" role="status"><QuickIcon name="check" size={16}/>{notice}</p>:null}
 <div className="qa-inputs"><label className="qa-amount"><span>{copy('Amount','金额')}</span><div><select aria-label={t('expense.currency')} value={values.currency} onChange={e=>onUpdate({currency:e.target.value})}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code==='MYR'?'RM':c.code}</option>)}</select><input aria-label={t('expense.amount')} value={expression} readOnly inputMode="none" onKeyDown={e=>{if(/^[0-9.+%*/-]$/.test(e.key)){e.preventDefault();keypad(e.key)}else if(e.key==='Backspace'){e.preventDefault();keypad('⌫')}else if(e.key==='Enter'){e.preventDefault();keypad('=')}}} placeholder="0.00"/></div>{/[+×÷−%]/.test(expression)&&computedAmount?<small>= {computedAmount}</small>:null}</label><label className="qa-description"><span>{copy('Description','描述')}</span><input aria-label={t('expense.description')} value={values.description} placeholder={copy('Optional note','备注可留空')} maxLength={500} onChange={e=>onUpdate({description:e.target.value})}/></label></div>
 <div className="qa-keypad-and-actions"><div className="qa-keypad">{['C','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','='].map(key=><button type="button" key={key} className={['÷','×','−','+','%','='].includes(key)?'qa-operator':''} aria-label={key==='C'?copy('Clear calculation','清除算式'):key==='⌫'?copy('Backspace','退格'):key==='='?copy('Calculate amount','计算金额'):key} onClick={()=>keypad(key)}>{key}</button>)}<span/></div>
 <div className="qa-actions"><button type="button" onClick={()=>{setMonth(values.occurredOn.slice(0,7));openPanel('date')}}><QuickIcon name="calendar"/><span>{values.occurredOn===todayIso()?copy('Today','今天'):values.occurredOn.slice(5)}<small>{copy('Date','日期')}</small></span></button><button type="button" onClick={()=>{openPanel('account')}}><QuickIcon name="wallet"/><span>{selectedAccount?.name??copy('Account','账户')}<small>{accountStatus==='loading'?copy('Loading…','加载中…'):selectedAccount?selectedAccount.currency:copy('Choose','选择')}</small></span></button><button type="button" className={splitEnabled?'is-selected':''} onClick={()=>void openSplit()}><QuickIcon name="split"/><span>{copy('Split','分摊')}<small>{splitEnabled?copy(`${selected.length} people`,`${selected.length} 人`):copy('Personal','个人')}</small></span></button></div></div>
 {accountStatus==='error'?<p className="qa-helper">{copy('Accounts unavailable · saving will record the expense without a wallet debit.','账户暂不可用：保存仅记录消费，不扣账户余额。')}</p>:null}
 {selectedAccount && selectedAccount.currency!==values.currency && selfPaid>0?<p className="qa-helper">{copy('Different currency · account debit stays pending until its actual amount is entered.','币种不同：实际扣款金额待补，暂不计入账户余额。')}</p>:null}
 {error&&!panel?<p className="qa-error" role="alert">{error}</p>:null}
 <div className="qa-save-buttons"><button type="button" aria-label={copy('Save and continue','保存并继续')} onClick={()=>void save(true)} disabled={saving || accountStatus==='loading' || session.captureSource!=='manual' || session.contextPolicy==='locked'}><QuickIcon name="next" size={26}/><span>{copy('Save & next','保存并继续')}</span></button><button type="button" className="qa-primary" aria-label={copy('Save and close','保存并收起')} onClick={()=>void save(false)} disabled={saving || accountStatus==='loading'}><QuickIcon name="check" size={26}/><span>{saving?copy('Saving…','保存中…'):copy('Save & close','保存并收起')}</span></button></div>
 </div></div>
 {panel==='account'?<QuickPanel title={copy('Payment account','付款账户')} onClose={()=>{if(!accountBusy)void cancelPanel()}}><div className="qa-panel-body">
 {accountStatus==='error'?<div className="qa-error" role="alert">{copy('Could not load accounts.','无法加载账户。')}<button type="button" onClick={()=>{setAccountStatus('loading');void loadQuickAccounts().then(rows=>{setAccounts(rows);setAccountStatus('ready')}).catch(()=>setAccountStatus('error'))}}>{copy('Retry','重试')}</button></div>:accountStatus==='loading'?<p>{copy('Loading accounts…','正在加载账户…')}</p>:<>{accounts.map(a=><button type="button" key={a.id} className={`qa-account-row${a.id===values.accountId?' is-selected':''}`} aria-pressed={a.id===values.accountId} onClick={()=>onUpdate({accountId:a.id})}><span className="qa-icon-tile"><QuickIcon name={a.account_type==='bank'?'bank':a.account_type==='cash'?'cash':'wallet'}/></span><span><strong>{a.name}</strong><small>{a.account_type==='ewallet'?copy('E-wallet','电子钱包'):a.account_type==='cash'?copy('Cash','现金'):copy('Bank account','银行账户')} · {a.currency}</small></span>{a.is_default?<small className="qa-badge">{copy('Default','默认')}</small>:null}<span className="qa-radio">{a.id===values.accountId?<QuickIcon name="check" size={14}/>:null}</span></button>)}<button className="qa-text-button" type="button" onClick={()=>onUpdate({accountId:null})}>{copy('No account · record without a wallet debit','不关联账户 · 只记录消费')}</button></>}
 {addingAccount?<div className="qa-stack"><label>{copy('Account name','账户名称')}<input value={accountName} maxLength={100} onChange={e=>setAccountName(e.target.value)} placeholder="Touch ’n Go"/></label><label>{copy('Type','类型')}<select value={accountType} onChange={e=>setAccountType(e.target.value as typeof accountType)}><option value="ewallet">{copy('E-wallet','电子钱包')}</option><option value="cash">{copy('Cash','现金')}</option><option value="bank">{copy('Bank account','银行账户')}</option></select></label><p className="qa-helper">{values.currency} · {copy('Opening balance can be completed in account settings.','期初余额可在账户设置中补充。')}</p><button className="qa-primary" type="button" disabled={accountBusy||!accountName.trim()} onClick={()=>void addAccount()}>{accountBusy?copy('Creating…','创建中…'):copy('Create account','创建账户')}</button></div>:<button className="qa-add-row" type="button" onClick={()=>setAddingAccount(true)}><QuickIcon name="plus"/>{copy('Add account','新增账户')}</button>}
 </div>{error?<p className="qa-error" role="alert">{error}</p>:null}<button className="qa-primary qa-panel-footer" type="button" onClick={()=>setPanel(null)} disabled={accountBusy||accountStatus==='loading'}>{selectedAccount?copy(`Use ${selectedAccount.name}`,`使用 ${selectedAccount.name}`):copy('Done','完成')}</button></QuickPanel>:null}
 {panel==='date'?<QuickPanel title={copy('Date','日期')} onClose={()=>void cancelPanel()}><div className="qa-calendar-top"><button type="button" aria-label={copy('Previous month','上个月')} onClick={()=>shiftMonth(-1)}>‹</button><strong>{monthStart.toLocaleDateString(zh?'zh-CN':'en-GB',{month:'long',year:'numeric'})}</strong><button type="button" aria-label={copy('Next month','下个月')} onClick={()=>shiftMonth(1)}>›</button></div><div className="qa-calendar">{(zh?['日','一','二','三','四','五','六']:['Su','Mo','Tu','We','Th','Fr','Sa']).map(d=><small key={d}>{d}</small>)}{Array.from({length:monthStart.getDay()},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:days},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,'0')}`;return <button type="button" key={date} aria-label={date} aria-pressed={values.occurredOn===date} className={values.occurredOn===date?'is-selected':''} onClick={()=>onUpdate({occurredOn:date})}>{i+1}</button>})}</div><div className="qa-two-buttons"><button type="button" onClick={()=>{onUpdate({occurredOn:todayIso()});setMonth(todayIso().slice(0,7))}}>{copy('Today','今天')}</button><button type="button" className="qa-primary" onClick={()=>setPanel(null)}>{copy('Confirm date','确认日期')}</button></div></QuickPanel>:null}
 {panel==='categories'?<QuickPanel title={copy('Edit categories','编辑分类')} onClose={()=>setPanel(null)}><div className="qa-panel-body"><div className="qa-stack"><label>{editingCategory?copy('Rename category','重命名分类'):copy('New category','新增分类')}<input value={categoryName} maxLength={100} onChange={e=>setCategoryName(e.target.value)}/></label><button type="button" className="qa-primary" onClick={addCategory}>{editingCategory?copy('Update','更新'):copy('Add category','新增分类')}</button></div>{categories.map((c,i)=><div className="qa-category-edit-row" key={c.name}><QuickIcon name={c.icon}/><button type="button" onClick={()=>{setEditingCategory(c.name);setCategoryName(c.name)}}>{categoryLabel(c)}</button><button type="button" aria-label={copy(`Move ${c.name} up`,`${c.name} 上移`)} disabled={i===0} onClick={()=>{const next=[...categories];[next[i-1],next[i]]=[next[i],next[i-1]];storeCategories(next)}}>↑</button><button type="button" aria-label={copy(`Move ${c.name} down`,`${c.name} 下移`)} disabled={i===categories.length-1} onClick={()=>{const next=[...categories];[next[i+1],next[i]]=[next[i],next[i+1]];storeCategories(next)}}>↓</button><button type="button" aria-label={copy(`Remove ${c.name}`,`删除 ${c.name}`)} disabled={categories.length<=1} onClick={()=>{storeCategories(categories.filter(row=>row.name!==c.name));if(values.category===c.name)onUpdate({category:'',categorySource:'DEFAULT'})}}><QuickIcon name="close" size={16}/></button></div>)}</div>{error?<p role="alert" className="qa-error">{error}</p>:null}<button type="button" className="qa-primary qa-panel-footer" onClick={()=>setPanel(null)}>{copy('Done','完成')}</button></QuickPanel>:null}
 {panel==='split'?<QuickPanel title={copy('Split expense','分摊消费')} onClose={()=>{if(!splitBusy)void cancelPanel()}}><div className="qa-panel-body">
 {splitStage==='pick'?<><div className="qa-segment">{(['people','groups','trips'] as const).map(v=><button type="button" key={v} aria-pressed={tab===v} onClick={()=>setTab(v)}>{v==='people'?copy('Friends','朋友'):v==='groups'?copy('Groups','群组'):copy('Trips','旅行')}</button>)}</div>{catalogStatus==='loading'?<p>{copy('Loading…','加载中…')}</p>:catalogStatus==='error'?<p className="qa-error">{copy('Could not load shared lists.','无法加载共享列表。')}<button type="button" onClick={()=>void openSplit()}>{copy('Retry','重试')}</button></p>:tab==='people'?<>{!catalog.people.length?<p className="qa-helper">{copy('Add a friend in Shared to split with them.','先在 Shared 添加朋友，再与他们分摊。')}</p>:catalog.people.map(person=><label key={person.personId} className="qa-person-choice"><span className="qa-avatar">{person.displayName.slice(0,1)}</span><span>{person.displayName}</span><input type="checkbox" checked={friendIds.includes(person.participantId)} onChange={()=>setFriendIds(ids=>ids.includes(person.participantId)?ids.filter(id=>id!==person.participantId):[...ids,person.participantId])}/></label>)}<button type="button" className="qa-primary qa-panel-footer" disabled={splitBusy||!friendIds.length} onClick={()=>{const first=catalog.people.find(p=>friendIds.includes(p.participantId));if(first)void configure(first,friendIds)}}>{copy('Split with selected friends','与所选朋友分摊')}</button></>:<>{!catalog[tab].length?<p className="qa-helper">{copy('No active spaces available.','暂无可记账的有效群组／旅行。')}</p>:catalog[tab].map(ref=><button type="button" disabled={splitBusy} className="qa-account-row" key={ref.spaceId} onClick={()=>void configure(ref)}><QuickIcon name={tab==='trips'?'Travel':'split'}/><strong>{ref.displayName}</strong><span>›</span></button>)}</>}</>:<>
 <div className="qa-split-context"><strong>{context.ref.kind==='personal'?copy('Personal','个人'):context.ref.displayName}</strong>{session.contextPolicy==='switchable'?<button className="qa-text-button" type="button" onClick={()=>setSplitStage('pick')}>{copy('Choose people','选择对象')}</button>:null}</div>
 <p className="qa-helper">{copy('Total amount','总金额')}</p><p className="qa-split-total">{money(total)}</p>
 <div className="qa-segment"><button type="button" aria-pressed={values.splitMode==='equal'} onClick={()=>onUpdate({splitMode:'equal',exactShareAmounts:{}})}>{copy('Equally','平均')}</button><button type="button" aria-pressed={values.splitMode==='exact'} onClick={()=>onUpdate({splitMode:'exact'})}>{copy('Amounts','指定金额')}</button><button type="button" onClick={()=>onUpdate({detailsExpanded:!values.detailsExpanded})}>{copy('By item','按项目')}</button></div>
 <button type="button" className="qa-account-row" onClick={()=>setPayerOpen(v=>!v)}><QuickIcon name="wallet"/><span><strong>{Object.values(values.payerAmounts).some(v=>v.trim())?copy('Payment amounts','付款金额'):copy('Paid by You','由我付款')}</strong><small>{selectedAccount?.name??copy('No account linked','未关联账户')}</small></span><span>›</span></button>
 {payerOpen?<div className="qa-stack">{ordered.map(p=><label className="qa-split-person" key={p.id}><span>{p.id===context.currentParticipantId?copy('You','我'):p.displayName}</span><input aria-label={copy(`Paid by ${p.displayName}`,`${p.displayName} 付款`)} type="text" inputMode="decimal" placeholder={p.id===context.currentParticipantId?computedAmount:'0'} value={values.payerAmounts[p.id]??''} onChange={e=>onUpdate({payerAmounts:{...values.payerAmounts,[p.id]:e.target.value}})}/></label>)}<button className="qa-text-button" type="button" onClick={()=>onUpdate({payerAmounts:{}})}>{copy('Reset · I paid all','重置为我付全额')}</button></div>:null}
 {values.detailsExpanded?<QuickItems values={values} participants={ordered.map(p=>({id:p.id,name:p.displayName}))} onUpdate={onUpdate} zh={zh}/>:null}
 {context.availableParticipants.map(p=><div key={p.id} className="qa-split-person"><label><input type="checkbox" checked={values.selectedParticipantIds.includes(p.id)} disabled={p.id===context.currentParticipantId} onChange={()=>onUpdate({selectedParticipantIds:values.selectedParticipantIds.includes(p.id)?values.selectedParticipantIds.filter(id=>id!==p.id):[...values.selectedParticipantIds,p.id],payerAmounts:{},exactShareAmounts:{}})}/><span className="qa-avatar">{p.displayName.slice(0,1)}</span><span>{p.id===context.currentParticipantId?copy('You','我'):p.displayName}</span></label>{values.selectedParticipantIds.includes(p.id)?values.splitMode==='exact'?<input inputMode="decimal" aria-label={copy(`Share for ${p.displayName}`,`${p.displayName} 份额`)} value={values.exactShareAmounts[p.id]??''} placeholder="0.00" onChange={e=>setExact(p.id,e.target.value)}/>:<strong>{money(shares.get(p.id)??0)}</strong>:null}</div>)}
 <div className="qa-split-summary"><p><span>{copy('You pay','我支付')}</span><strong>{money(selfPaid)}</strong></p><p><span>{selfPaid>=selfShare?copy('To collect','待收回'):copy('You owe','我待付')}</span><strong>{money(Math.abs(selfPaid-selfShare))}</strong></p></div>
 <button type="button" className="qa-primary qa-panel-footer" disabled={splitBusy} onClick={()=>{
  const shareTotal=[...shares.values()].reduce((sum,n)=>sum+n,0)
  let paidTotal=total;try{if(Object.values(values.payerAmounts).some(v=>v.trim()))paidTotal=ordered.reduce((sum,p)=>sum+zeroOrMinor(values.payerAmounts[p.id]??'',values.currency),0)}catch{paidTotal=-1}
  if(total>0&&(shareTotal!==total||paidTotal!==total)){setError(copy('Shares and payments must each add up to the total.','份额和付款金额都必须等于总金额。'));return}
  setPanel(null)
 }}>{copy('Apply split','应用分摊')}</button>{session.contextPolicy==='switchable'?<button type="button" className="qa-text-button" onClick={async()=>{if(await onConfigureSplit({kind:'personal'}))setPanel(null)}}>{copy('Remove split · personal expense','取消分摊 · 个人消费')}</button>:null}</>}
 </div>{error?<p role="alert" className="qa-error">{error}</p>:null}</QuickPanel>:null}
 </main></div>
}
function QuickItems({values,participants,onUpdate,zh}:{values:UniversalQuickAddValues;participants:{id:string;name:string}[];onUpdate:(patch:Partial<UniversalQuickAddValues>)=>void;zh:boolean}){
 const items=values.items??[]
 const [error,setError]=useState('')
 const patch=(next:NonNullable<UniversalQuickAddValues['items']>)=>onUpdate({items:next})
 const apply=()=>{try{
  const amounts:Record<string,number>=Object.fromEntries(participants.map(p=>[p.id,0]))
  let total=0
  if(!items.length)throw new Error()
  for(const item of items){const minor=parseMajorAmount(item.amount,values.currency);const ids=item.participantIds.filter(id=>participants.some(p=>p.id===id));const shares=equalMinorShares(minor,ids);total+=minor;for(const [id,n] of shares)amounts[id]+=n}
  const expected=parseMajorAmount(calculateQuickAmount(values.calculation??values.amount,values.currency),values.currency)
  if(total!==expected)throw new Error()
  onUpdate({splitMode:'exact',exactShareAmounts:Object.fromEntries(Object.entries(amounts).map(([id,n])=>[id,major(n,values.currency)])),detailsExpanded:false});setError('')
 }catch{setError(zh?'每个项目需要金额及成员，项目总额须等于消费总额。':'Each item needs an amount and people; item amounts must match the total.') }}
 return <div className="qa-items"><h3>{zh?'按项目分摊':'Split by item'}</h3>{items.map((item,i)=><div className="qa-item" key={item.id}><div className="qa-two-buttons"><input aria-label={`Item ${i+1} name`} placeholder={zh?'项目名称':'Item name'} value={item.name} onChange={e=>patch(items.map((r,j)=>j===i?{...r,name:e.target.value}:r))}/><input aria-label={`Item ${i+1} amount`} inputMode="decimal" placeholder="0.00" value={item.amount} onChange={e=>patch(items.map((r,j)=>j===i?{...r,amount:e.target.value}:r))}/><button type="button" aria-label={`Remove item ${i+1}`} onClick={()=>patch(items.filter((_,j)=>j!==i))}><QuickIcon name="close" size={16}/></button></div><div className="qa-item-people">{participants.map(p=><label key={p.id}><input type="checkbox" checked={item.participantIds.includes(p.id)} onChange={()=>patch(items.map((r,j)=>j===i?{...r,participantIds:r.participantIds.includes(p.id)?r.participantIds.filter(id=>id!==p.id):[...r.participantIds,p.id]}:r))}/>{p.name}</label>)}</div></div>)}<div className="qa-two-buttons"><button type="button" onClick={()=>patch([...items,{id:crypto.randomUUID(),name:'',amount:'',participantIds:participants.map(p=>p.id)}])}>{zh?'新增项目':'Add item'}</button><button type="button" className="qa-primary" onClick={apply}>{zh?'计算份额':'Calculate shares'}</button></div>{error?<p className="qa-error" role="alert">{error}</p>:null}</div>
}
