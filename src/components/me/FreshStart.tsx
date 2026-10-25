import {useEffect,useRef,useState} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {useAuth} from '../../hooks/useAuth'
import {usePersonalLedger} from '../../hooks/usePersonalLedger'
import {useStore} from '../../store/useStore'
import {supabase} from '../../lib/supabase'
import {formatMinorAmount} from '../../lib/money'
import {parseObservedBalance} from '../../lib/multicurrency'
import {applyPersonalFreshStart,getFreshPreview,loadPersonalArchive,previewPersonalFreshStart,reconcileFreshStart,type FreshCommand,type FreshPreview,type FreshReceipt,type PersonalArchive} from '../../lib/personalPeriods'
import MeIcon from './MeIcon'
import {MeNote,MePaper,MeRow,MeSection} from './MeUI'

const recoveryKey=(owner:string)=>`tabby:fresh-start:pending:${owner}`
function pendingRequest(owner:string):string|null{
 try{const id=sessionStorage.getItem(recoveryKey(owner));return id&&/^[0-9a-f-]{36}$/i.test(id)?id:null}catch{return null}
}
function rememberRequest(owner:string,id:string|null){
 // Persist only the request identifier. Never store a password or balances.
 if(id)sessionStorage.setItem(recoveryKey(owner),id);else sessionStorage.removeItem(recoveryKey(owner))
}
export default function FreshStart({page,onHome}:{page:string;onHome:()=>void}){
 const auth=useAuth(),ledger=usePersonalLedger(),navigate=useNavigate(),location=useLocation()
 const lang=useStore(s=>s.lang),hidden=useStore(s=>s.homeUi.balanceHidden)
 const c=(en:string,zh:string)=>lang==='zh'?zh:en
 const actor=auth.authUser?.participantId??'',identity=auth.authUser?.id??''
 const [preview,setPreview]=useState<FreshPreview|null>(null),[archive,setArchive]=useState<PersonalArchive|null>(null)
 const [custom,setCustom]=useState<Record<string,string>>({}),[checked,setChecked]=useState(false),[password,setPassword]=useState('')
 const [providers,setProviders]=useState<string[]>([]),[verified,setVerified]=useState(false),[openingsReviewed,setOpeningsReviewed]=useState(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<FreshReceipt|null>(null)
 const [unresolved,setUnresolved]=useState(()=>actor?pendingRequest(actor):null)
 const lock=useRef(false),lease=useRef(identity),mounted=useRef(true)
 lease.current=identity
 const current=(who:string)=>mounted.current&&lease.current===who
 const previewId=new URLSearchParams(location.search).get('preview')
 const step=page==='fresh-start/impact'?2:page==='fresh-start/openings'?3:page==='fresh-start/confirm'?4:1
 const archived=page.startsWith('archives'),archiveId=archived?page.split('/')[1]:null
 const available=ledger.periodState?.available===true&&ledger.periodStatus==='ready'&&!auth.authUser?.isAnonymous
 const money=(amount:string,currency:string)=>hidden?'••••':formatMinorAmount(Number(amount),currency,lang==='zh'?'zh-CN':'en-MY')
 const explain=(cause:unknown)=>{
  const code=(cause as {message?:string})?.message??''
  if(code.includes('reauthentication'))return c('Please sign in again before confirming.','请重新验证登录后再确认。')
  if(code.includes('preview_changed'))return c('Your ledger changed. Go back and review a new impact preview. Nothing was reset.','账目已有变化。请返回并重新核对影响预览，尚未重新开始。')
  if(code.includes('preview_expired'))return c('This review expired. Go back and request a new preview.','预览已过期，请返回重新核对。')
  if(code.includes('fenced'))return c('This request is closed. Review again before starting a new request.','此请求已安全关闭，请重新核对后再开始。')
  if(code.includes('Invalid login')||code.includes('invalid_credentials'))return c('Sign-in verification failed. Check your current sign-in method and password.','登录验证失败，请核对当前登录方式和密码。')
  return c('This action could not be verified. Check the connection and retry. Your financial history has not been deleted.','无法核验此操作，请检查连接后重试。财务历史不会被删除。')
 }
 const go=(path:string,id=preview?.id)=>{if(path.startsWith('archives'))setReceipt(null);setError('');setPassword('');navigate('/profile/'+path+(id&&path.startsWith('fresh-start/')?'?preview='+encodeURIComponent(id):''),{state:{meParent:true}})}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  setPreview(null);setCustom({});setChecked(false);setVerified(false);setOpeningsReviewed(false);setPassword('');setReceipt(null);setUnresolved(actor?pendingRequest(actor):null)
 },[identity,actor])
 useEffect(()=>{
  let active=true
  if(!supabase||!identity)return
  void supabase.auth.getUser().then(({data,error})=>{
   if(active&&!error&&data.user?.id===identity){
    setProviders([...new Set((data.user.identities??[]).map(i=>i.provider))])
    void supabase!.auth.getSession().then(({data})=>{if(!active)return;try{const token=data.session?.access_token.split('.')[1];const claims=token?JSON.parse(atob(token.replace(/-/g,'+').replace(/_/g,'/'))):{};setVerified(claims.sub===identity&&Array.isArray(claims.amr)&&claims.amr.some((a:{method:string;timestamp:number})=>['password','oauth','otp','sso/saml'].includes(a.method)&&a.timestamp>Date.now()/1000-240))}catch{setVerified(false)}})
   }
  }).catch(()=>{if(active)setProviders([])})
  return()=>{active=false}
 },[identity])
 useEffect(()=>{
  if(!previewId||preview?.id===previewId||!available)return
  let active=true;setBusy(true)
  void getFreshPreview(previewId,actor).then(p=>{if(active)setPreview(p)}).catch(cause=>{if(active)setError(explain(cause))}).finally(()=>{if(active)setBusy(false)})
  return()=>{active=false}
  // Errors are localized when the request settles; changing language cannot repeat a write.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[previewId,preview?.id,available,actor])
 useEffect(()=>{
  if(!archiveId||!available)return
  let active=true;setArchive(null);setBusy(true)
  void loadPersonalArchive(archiveId).then(value=>{if(active)setArchive(value)}).catch(cause=>{if(active)setError(explain(cause))}).finally(()=>{if(active)setBusy(false)})
  return()=>{active=false}
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[archiveId,available,actor])
 const run=async(action:(who:string)=>Promise<void>)=>{
  if(lock.current)return
  lock.current=true;setBusy(true);setError('');const who=identity
  try{await action(who)}catch(cause){if(current(who))setError(explain(cause))}finally{lock.current=false;if(current(who))setBusy(false)}
 }
 const completed=async(result:FreshReceipt,who:string)=>{
  if(!current(who))return
  rememberRequest(actor,null);setUnresolved(null);setReceipt(result);setChecked(false);setPassword('')
  window.dispatchEvent(new Event('tt:accounts-changed'));await ledger.refresh()
 }
 const reconcile=()=>void run(async who=>{
  const id=unresolved??pendingRequest(actor);if(!id)return
  const result=await reconcileFreshStart(id,actor)
  if(!current(who))return
  if(result)await completed(result,who)
  else{rememberRequest(actor,null);setUnresolved(null);setPreview(null);setCustom({});setChecked(false);setVerified(false);go('fresh-start');setError(c('No reset committed for this request. It is now safely closed; review again to start a new one.','此请求未提交重新开始，现已安全关闭。请重新核对后再开始。'))}
 })
 const openingValues=()=>{
  if(!preview)throw new Error('missing_preview')
  return preview.accounts.map(a=>({account_id:a.account_id,amount_minor:a.account_id in custom?String(parseObservedBalance(custom[a.account_id],a.currency)):a.known?a.balance_minor:(()=>{throw new Error('opening_required')})()}))
 }
 let openingsValid=true
 try{openingValues()}catch{openingsValid=false}
 const requestPreview=()=>void run(async who=>{
  if(unresolved||pendingRequest(actor))throw new Error('unresolved_request')
  const value=await previewPersonalFreshStart(actor)
  if(!current(who))return
  setPreview(value);setCustom({});setChecked(false);setVerified(false);go('fresh-start/impact',value.id)
 })
 const reauthenticate=()=>void run(async who=>{
  if(!supabase||!auth.authUser?.email||!password)throw new Error('missing_auth')
  const live=await supabase.auth.getUser()
  if(live.error||live.data.user?.id!==who||!live.data.user.email||!current(who))throw new Error('identity_changed')
  const {data,error}=await supabase.auth.signInWithPassword({email:live.data.user.email,password})
  setPassword('')
  if(error)throw error
  if(data.user?.id!==who||!current(who))throw new Error('identity_changed')
  setVerified(true)
 })
 const apply=()=>void run(async who=>{
  if(!preview||!checked||!openingsReviewed||!verified||!available||unresolved||pendingRequest(actor))throw new Error('invalid_confirmation')
  const {data,error}=await supabase!.auth.getUser()
  if(error||data.user?.id!==who||!current(who))throw new Error('identity_changed')
  const command:FreshCommand={requestId:crypto.randomUUID(),previewId:preview.id,openings:openingValues()}
  // If storage is unavailable, fail before posting: recovery must be possible.
  rememberRequest(actor,command.requestId);setUnresolved(command.requestId)
  try{await completed(await applyPersonalFreshStart(command,actor),who)}catch(cause){if(current(who))setError(explain(cause));/* retain request ID until authoritative reconciliation */}
 })
 const back=()=>{if(busy)return;if(archived){if(archiveId)go('archives');else go('fresh-start')}else if(step===1)onHome();else go(step===2?'fresh-start':step===3?'fresh-start/impact':'fresh-start/openings')}
 const title=archived?c('Past personal ledgers','过去的个人账期'):step===2?c('Review the impact','核对影响'):step===3?c('Opening balances','期初余额'):step===4?c('Confirm Fresh Start','确认重新开始'):c('Reset account','重新开始')
 return <>
  <header className="me-header"><button className="me-back" aria-label={c('Back','返回')} disabled={busy} onClick={back}><MeIcon name="back"/></button><h1 tabIndex={-1}>{title}</h1></header>
  {!archived&&!receipt?<div className="me-stepper" aria-label={c(`Step ${step} of 4`,`第 ${step} 步，共 4 步`)}>{[1,2,3,4].map(n=><i key={n} data-active={n<=step}/>)}<span>{step}/4</span></div>:null}
  {!available?<MeNote warning>{auth.authUser?.isAnonymous?c('Link and verify your account before starting a new ledger. Your guest history will be preserved.','请先关联并验证账户，再开始新账期。访客历史会保留。'):ledger.periodStatus==='loading'?c('Checking ledger capability…','正在核验账期功能…'):c('Fresh Start is unavailable until its financial safeguards are installed and verified. Your existing ledger continues normally.','财务保护功能安装并核验前，暂不能重新开始。原账目可继续正常使用。')}</MeNote>:null}
  {error?<p className="me-error" role="alert">{error}</p>:null}
  {unresolved?<MePaper><h2>{c('Check the last request first','请先核对上次请求')}</h2><p>{c('The result may have committed even if the connection was interrupted. This status check waits for that request and prevents a delayed duplicate.','即使连接中断，操作仍可能已提交。状态核对会等待上次请求，并防止延迟的重复操作。')}</p><button className="me-primary" disabled={busy||!available} onClick={reconcile}>{c('Check request status','核对请求状态')}</button></MePaper>:null}
  {receipt?<MePaper><span className="me-hero-icon"><MeIcon name="check"/></span><h2>{c('Your new personal ledger is ready','新的个人账期已开启')}</h2><p>{c('History is preserved. Shared balances, identities and ongoing obligations continue unchanged.','历史已保留。共享余额、身份与持续义务继续沿用。')}</p><p className="me-help">{new Date(receipt.completed_at).toLocaleString(lang==='zh'?'zh-CN':'en-MY')}<br/>{c('Period','账期')} {receipt.period_id}</p><button className="me-primary" onClick={()=>go('archives/'+receipt.archived_period_id)}>{c('View archived ledger','查看归档账期')}</button><button className="me-link" onClick={onHome}>{c('Back to Me','返回我的')}</button></MePaper>:null}
  {!receipt&&!archived&&step===1?<>
   <span className="me-hero-icon"><MeIcon name="reset"/></span><h2 className="me-headline">{c('A fresh personal ledger.','开启新的个人账期。')}</h2><p className="me-intro">{c('Keep your history. Start a new period for your personal records and account opening balances.','保留历史，为个人记录和账户期初余额开启新账期。')}</p>
   <MePaper><h2>{c('What changes','将会改变')}</h2><p>{c('Personal-only records move to a read-only archive. Daily and Insights use the new period.','纯个人记录进入只读归档。Daily 与 Insights 使用新账期。')}</p><h2>{c('What stays safe','保持不变')}</h2><p>{c('Your identity, friends, Shared / Group / Trip records, debts and settlements.','你的身份、朋友、共享／群组／旅程记录、债务和结算。')}</p></MePaper>
   <MeNote>{c('Instalments, recurring bills and pending deductions continue through their existing workflows. Actual later postings enter the new period; old spending is never counted twice.','未完成分期、周期账单和待核对扣款继续原流程。后续实际发生的流水进入新期间，旧支出不会重复计算。')}</MeNote>
   <button className="me-primary" disabled={!available||busy||!!unresolved} onClick={requestPreview}>{c('Review Fresh Start','核对重新开始')}</button><button className="me-link" onClick={()=>go('archives')}>{c('View past personal ledgers','查看过去的个人账期')}<MeIcon name="chevron" size={16}/></button>
  </>:null}
  {!receipt&&!archived&&step>1&&!preview?<MeNote>{busy?c('Loading authoritative review…','正在读取权威预览…'):c('Start with a new impact review. No changes have been made.','请先核对新的影响预览，尚未修改账目。')}<button className="me-link" disabled={busy||!!unresolved} onClick={()=>go('fresh-start')}>{c('Back to review','返回核对')}</button></MeNote>:null}
  {!receipt&&!archived&&preview&&step===2?<>
   <p className="me-intro">{c('Computed from your current ledger. If anything changes before confirmation, the operation will stop for a new review.','根据当前权威账目计算。确认前如有变化，将停止操作并要求重新核对。')}</p>
   <MePaper><h2>{c('Personal history to archive','将归档的个人历史')}</h2><div className="me-summary-line"><span>{c('Personal-only records','纯个人记录')}</span><strong>{preview.personal_count}</strong></div>{preview.currencies.map(v=><div className="me-summary-line" key={v.currency}><span>{v.currency}</span><strong className="me-native-amount">{money(v.amount_minor,v.currency)}</strong></div>)}<div className="me-summary-line"><span>{c('Account currencies to review','待核对的账户币种')}</span><strong>{preview.accounts.length}</strong></div></MePaper>
   <MeSection title={c('Protected and continuing','保留并继续')}><MePaper>{[[c('Shared records','共享记录'),preview.protected_shared_count],[c('Settlements','结算'),preview.protected_settlement_count],[c('Pending deductions','待核对扣款'),preview.pending_funding_count],[c('Open instalment plans','未完成分期'),preview.ongoing_installment_count],[c('Recurring rules','周期规则'),preview.recurring_rule_count]].map(([label,value])=><div className="me-summary-line" key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</MePaper></MeSection>
   <MeNote>{c('All ongoing obligations carry forward unchanged. No shared or settlement history is erased or recalculated.','所有持续义务保留并继续。共享和结算历史不会被删除或重算。')}</MeNote>{preview.conflicts.length?<MeNote warning>{c('A financial relationship needs review. Fresh Start is blocked.','存在需要核验的财务关系，重新开始已被阻止。')}</MeNote>:null}
   <button className="me-primary" disabled={!available||busy||!!unresolved||!!preview.conflicts.length} onClick={()=>go('fresh-start/openings')}>{c('Review opening balances','核对期初余额')}</button>
  </>:null}
  {!receipt&&!archived&&preview&&step===3?<>
   <p className="me-intro">{c('Use each account’s actual native-currency balance. Keep its recorded balance, or enter a current observed balance. Unknown balances need an explicit value.','逐账户使用实际原币余额。保留记录余额，或输入当前观察到的余额。未知余额必须明确填写。')}</p>
   {preview.accounts.map(a=><MePaper key={a.account_id}><h2>{a.name} · {a.currency}</h2><p className="me-help">{a.known?c('Recorded balance: ','记录余额：')+money(a.balance_minor,a.currency):c('Balance not yet known','余额未知')}</p>{a.known?<label className="me-check"><input type="checkbox" checked={!(a.account_id in custom)} onChange={e=>setCustom(old=>{const next={...old};if(e.target.checked)delete next[a.account_id];else next[a.account_id]='';return next})}/>{c('Keep recorded balance','保留记录余额')}</label>:null}{!a.known||a.account_id in custom?<label className="me-label">{c('Observed balance','实际观察余额')} ({a.currency})<input inputMode="decimal" autoComplete="off" value={custom[a.account_id]??''} onChange={e=>setCustom(old=>({...old,[a.account_id]:e.target.value}))}/></label>:null}</MePaper>)}
   <MeNote>{c('Native balances only. No reference FX conversion. The existing balance-anchor rules still decide whether a later verified deduction was already included.','仅使用原币余额，不使用参考汇率。后补扣款是否已包含在余额中，仍按原有余额锚点规则确认。')}</MeNote><button className="me-primary" disabled={!available||!openingsValid||busy||!!unresolved} onClick={()=>{setOpeningsReviewed(true);go('fresh-start/confirm')}}>{c('Continue','继续')}</button>
  </>:null}
  {!receipt&&!archived&&preview&&step===4?<>
   <MePaper><h2>{c('Ready for a new personal period?','准备开启新的个人账期？')}</h2><p>{c('Your old personal records remain in the archive. Shared records, balances owed, settlements and ongoing obligations are protected.','旧个人记录保存在归档中。共享记录、债权债务、结算与持续义务受到保护。')}</p><p className="me-help">{c('Opening balances are recorded once per account currency. This cannot be undone from this screen.','每个账户币种的期初余额仅记录一次。此页面不提供撤销。')}</p></MePaper>
   <MeSection title={c('Verify it is you','验证是你本人')}><MePaper>{providers.includes('email')?<><label className="me-label">{c('Current password','当前密码')}<input type="password" autoComplete="current-password" value={password} onChange={e=>{setPassword(e.target.value);setVerified(false)}}/></label><button className="me-secondary" disabled={busy||!password||!!unresolved} onClick={reauthenticate}>{c('Verify sign-in','验证登录')}</button></>:null}{providers.includes('google')?<button className="me-secondary" disabled={busy||!!unresolved} onClick={()=>void run(async()=>{await auth.signInWithGoogle('/profile/fresh-start/confirm?preview='+encodeURIComponent(preview.id))})}>{c('Verify with Google','通过 Google 验证')}</button>:null}{!providers.includes('email')&&!providers.includes('google')?<p>{c('Sign in again using your existing method before continuing.','继续前，请通过原有方式重新登录。')}</p>:null}{verified?<p role="status">{c('Sign-in verified. The server will recheck its recency.','登录已验证，服务器将再次核验时效。')}</p>:null}</MePaper></MeSection>
   <label className="me-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>{c('I understand that personal history will be archived, and shared obligations will continue unchanged.','我理解个人历史会归档，共享义务继续保持不变。')}</label>
   {!openingsValid||!openingsReviewed?<MeNote warning>{c('Opening choices were not retained after leaving this screen. Return to Opening balances and review them again.','离开页面后未保留期初余额选择，请返回重新核对。')}</MeNote>:null}<button className="me-primary" disabled={!available||busy||!checked||!openingsValid||!openingsReviewed||!verified||!!unresolved} onClick={apply}>{busy?c('Verifying…','正在核验…'):c('Start new personal ledger','开启新的个人账期')}</button>
  </>:null}
  {!receipt&&archived&&!archiveId?<>
   <p className="me-intro">{c('Read-only personal history. Shared and settlement records remain in their original views.','只读个人历史。共享和结算记录保留在原来的页面。')}</p>{available&&!ledger.periodState!.periods.some(p=>p.status==='archived')?<MeNote>{c('No archived personal ledgers yet.','尚无归档的个人账期。')}</MeNote>:null}{ledger.periodState?.periods.filter(p=>p.status==='archived').map(p=><MePaper key={p.id}><MeRow icon="file" title={new Date(p.started_at).toLocaleDateString(lang==='zh'?'zh-CN':'en-MY')+' – '+new Date(p.ended_at!).toLocaleDateString(lang==='zh'?'zh-CN':'en-MY')} sub={c('Archived · read only','已归档 · 只读')} onClick={()=>go('archives/'+p.id)}/></MePaper>)}
  </>:null}
  {!receipt&&archived&&archiveId&&archive?<>
   <MeNote>{c('Archived personal ledger · Read only','归档的个人账期 · 只读')}</MeNote><MeSection title={c('Opening snapshots','期初快照')}>{archive.openings.map(o=><MePaper key={o.account_id}><p className="me-native-amount">{money(o.amount_minor,o.currency)}</p></MePaper>)}</MeSection><MeSection title={c('Personal expenses','个人支出')}>{archive.expenses.map(e=><MePaper key={e.id}><h2>{e.description||e.category}</h2><div className="me-summary-line"><span>{e.occurred_on} · {e.status}</span><strong className="me-native-amount">{money(e.total_minor,e.currency)}</strong></div></MePaper>)}</MeSection><MeSection title={c('Native account activity','原币账户流水')}>{archive.transactions.map(t=><MePaper key={t.id+':'+t.account_id}><h2>{t.account_name}</h2><p>{t.occurred_on} · {t.kind}</p><p className="me-native-amount">{money(t.amount_minor,t.currency)}</p></MePaper>)}</MeSection>
  </>:null}
  {busy?<p className="me-help" role="status">{c('Verifying with your account…','正在向服务器核验…')}</p>:null}
 </>
}
