import {useEffect,useRef,useState} from 'react'
import {useLocation,useNavigate,useNavigationType,useSearchParams} from 'react-router-dom'
import {useAuth} from '../hooks/useAuth'
import {useRouteScroll} from '../hooks/useRouteScroll'
import {useT} from '../lib/i18n'
import {authErrorKey,safeInternalRedirect} from '../lib/authUi'
import {hasMeaningfulQuickDraft} from '../lib/quickDraft'
import {useStore} from '../store/useStore'
import {supabase} from '../lib/supabase'
import {CenteredDialog} from '../components/shared/SharedComponents'
import MeIcon from '../components/me/MeIcon'
import {MeNote,MePaper,MeRow,MeSection} from '../components/me/MeUI'
import FreshStart from '../components/me/FreshStart'
import './me-v2.css'

export default function ProfilePage(){
 const {authUser}=useAuth()
 return <ProfileContents key={authUser?.id??'signed-out'}/>
}
function ProfileContents(){
 const t=useT(),navigate=useNavigate(),location=useLocation(),[params]=useSearchParams()
 const auth=useAuth(),{authUser,loading}=auth
 const lang=useStore(s=>s.lang),setLang=useStore(s=>s.setLang)
 const c=(en:string,zh:string)=>lang==='zh'?zh:en
 const navigationType=useNavigationType(),mainRef=useRef<HTMLElement>(null),previousPage=useRef('')
 useRouteScroll(!loading&&!!authUser,authUser?.id??'')
 const page=location.pathname.replace(/^\/profile\/?/,'')
 useEffect(()=>{
  const root=mainRef.current,previous=previousPage.current;previousPage.current=page
  const target=navigationType==='POP'&&previous?[...root?.querySelectorAll<HTMLElement>('[data-me-route]')??[]].find(el=>el.dataset.meRoute===previous):null
  ;(target??root?.querySelector<HTMLHeadingElement>('h1'))?.focus({preventScroll:true})
 },[page,navigationType])
 const [name,setName]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[feedback,setFeedback]=useState('')
 const [verifiedEmail,setVerifiedEmail]=useState('')
 const [emailStatus,setEmailStatus]=useState<'loading'|'verified'|'unverified'|'unavailable'>('loading')
 const lock=useRef(false),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  if(page!=='security'||!authUser||authUser.isAnonymous)return
  let active=true
  void supabase?.auth.getUser().then(({data,error})=>{if(active){const valid=!error&&data.user?.id===authUser.id;setVerifiedEmail(valid?data.user!.email??'':'');setEmailStatus(!valid?'unavailable':data.user!.email_confirmed_at?'verified':'unverified')}}).catch(()=>{if(active)setEmailStatus('unavailable')})
  return()=>{active=false}
 },[page,authUser])
 const go=(path:string)=>{setError('');setMessage('');setPassword('');navigate('/profile'+(path?'/'+path:''),{state:{meParent:true}})}
 const modal=params.get('dialog')
 const openModal=(kind:string)=>{const next=new URLSearchParams(params);next.set('dialog',kind);navigate({pathname:location.pathname,search:next.toString()},{state:{meModal:true}})}
 const closeModal=()=>{if(location.state?.meModal)navigate(-1);else{const next=new URLSearchParams(params);next.delete('dialog');navigate({pathname:location.pathname,search:next.toString()},{replace:true})}}
 const back=()=>{setError('');setMessage('');setPassword('');if(location.state?.meParent)navigate(-1);else navigate('/profile',{replace:true})}
 const run=async(action:()=>Promise<void>)=>{
  if(lock.current)return
  lock.current=true;setBusy(true);setError('');setMessage('')
  try{await action()}catch(cause){if(mounted.current)setError(t(authErrorKey(cause)))}finally{lock.current=false;if(mounted.current)setBusy(false)}
 }
 const signOut=()=>void run(async()=>{await auth.signOut();navigate('/',{replace:true})})
 const requestSignOut=()=>{
  if(!authUser)return
  const pending=useStore.getState().ledgerByIdentity[authUser.id]?.outbox.length??0
  if(authUser.isAnonymous||pending||hasMeaningfulQuickDraft(authUser.id)||name!==null&&name.trim()!==(authUser.displayName??''))openModal('signout')
  else signOut()
 }
 if(loading)return <main className="tt-me-v2"><p role="status">{t('expense.loading')}</p></main>
 if(!authUser)return <main className="tt-me-v2"><MePaper><p>{t('auth.signInToSave')}</p><button className="me-primary" onClick={()=>navigate('/login')}>{t('auth.signIn')}</button><button className="me-link" onClick={()=>navigate('/')}>{t('common.back')}</button></MePaper></main>
 const displayName=authUser.displayName??c('Your account','我的账户'),initial=Array.from(displayName)[0]?.toUpperCase()??'?'
 const emailLabel=authUser.isAnonymous?t('auth.profile.guestSession'):(page.startsWith('security')&&verifiedEmail?verifiedEmail:authUser.email)??c('No email address','未关联邮箱')
 const later=c('Later','稍后提供'),notAvailable=c('This feature is not available yet.','此功能暂未开放。')
 const title=page==='details'?c('Personal details','个人资料'):page.startsWith('security')?c('Sign-in & security','登录与安全'):page==='privacy'?c('Privacy & data','隐私与数据'):page==='help'?c('Help & feedback','帮助与反馈'):page==='feedback/feature'?c('Feature suggestion','功能建议'):page==='feedback/bug'?c('Bug report','问题反馈'):c('Me','我的')
 const isFresh=page.startsWith('fresh-start')||page.startsWith('archives')
 return <main ref={mainRef} className={`tt-me-v2${!page?' me-home':''}`}>
 {isFresh?<FreshStart page={page} onHome={()=>go('')} />:<>
 <header className="me-header">{page?<button type="button" className="me-back" aria-label={c('Back to Me','返回我的')} onClick={back}><MeIcon name="back"/></button>:null}<h1 tabIndex={-1}>{title}</h1></header>
 {!page?<>
  <button data-me-route="details" className="me-profile" onClick={()=>go('details')}><span className="me-avatar">{initial}</span><span className="me-grow"><strong>{displayName}</strong><span className="me-row-sub">{emailLabel}</span></span><MeIcon name="chevron" size={18}/></button>
  {params.get('upgrade')==='preserve-session'&&authUser.isAnonymous?<MeNote><strong>{t('auth.profile.preserveTitle')}</strong><br/>{t('auth.profile.preserveHelp')}</MeNote>:null}
  <MeSection title={c('Preferences','偏好设置')}><MeRow icon="globe" title={c('Language','语言')} value={lang==='zh'?'简体中文':'English'} onClick={()=>openModal('language')}/></MeSection>
  <MeSection title={c('Account','账户')}><MeRow route="security" icon="shield" title={c('Sign-in & security','登录与安全')} onClick={()=>{const redirect=safeInternalRedirect(params.get('redirect'));navigate('/profile/security'+(redirect?'?redirect='+encodeURIComponent(redirect):''),{state:{meParent:true}})}}/><MeRow route="privacy" icon="file" title={c('Privacy & data','隐私与数据')} onClick={()=>go('privacy')}/></MeSection>
  <MeSection title={c('Support','支持')}><MeRow route="help" icon="chat" title={c('Help & feedback','帮助与反馈')} onClick={()=>go('help')}/></MeSection>
  <MeSection title={c('Account actions','账户操作')}><MeRow route="fresh-start" icon="reset" title={c('Reset account','重新开始')} sub={c('Start a new personal ledger','开启新的个人账期')} onClick={()=>go('fresh-start')}/><MeRow icon="logout" title={t('auth.signOut')} onClick={requestSignOut}/></MeSection>
  <footer className="me-brand">Tabby Tally · Matte Paper</footer>
 </>:null}
 {page==='details'?<>
  <MePaper><div className="me-photo"><span className="me-avatar me-avatar-large">{initial}</span><h2>{c('Profile photo','头像')}</h2><p>{c('Photo upload is planned for a later release.','头像上传将在后续版本提供。')}</p><button className="me-secondary" disabled>{c('Choose a photo','选择照片')} · {later}</button></div></MePaper>
  <MeSection title={c('Basic information','基本资料')}><MePaper><label className="me-label">{t('auth.editDisplayName')}<input value={name??authUser.displayName??''} maxLength={100} autoComplete="name" onChange={e=>{setName(e.target.value);setMessage('')}}/></label><div className="me-label">{c('Email address','邮箱地址')}</div><p className="me-email">{emailLabel}</p><span className="me-muted">{c('Managed in security','在登录与安全中管理')}</span></MePaper></MeSection>
  <p className="me-help">{c('Your display name can change without changing your Shared or Trip participant identity.','修改显示名称不会改变共享或旅程账目中的参与者身份。')}</p>
  <button className="me-primary" disabled={busy||!name?.trim()||name.trim()===authUser.displayName} onClick={()=>void run(async()=>{await auth.updateProfile({displayName:name!.trim()});setName(null);setMessage(c('Changes saved.','修改已保存。'))})}>{busy?t('auth.saving'):c('Save changes','保存修改')}</button>
 </>:null}
 {page==='security'?<>
  <div className="me-hero-icon"><MeIcon name="shield" size={28}/></div><h2 className="me-headline">{c('Keep your account secure','保护你的账户')}</h2><p className="me-intro">{c('Manage the essentials of your account, all in one quiet place.','在这里管理账户的重要设置。')}</p>
  <MePaper><div className="me-detail"><MeIcon name="mail"/><span className="me-grow"><strong>{c('Email address','邮箱地址')}</strong><span className="me-row-sub">{emailLabel}</span></span>{!authUser.isAnonymous?<span className="me-tag">{emailStatus==='verified'?c('Verified','已验证'):emailStatus==='unverified'?c('Not verified','未验证'):emailStatus==='loading'?c('Checking…','检查中…'):c('Status unavailable','状态暂不可用')}</span>:null}</div>
  {!authUser.isAnonymous?<MeRow icon="lock" title={c('Password','密码')} sub={c('Manage your password','管理密码')} onClick={()=>go('security/password')}/>:null}</MePaper>
  {authUser.isAnonymous?<MeSection title={t('auth.profile.keepAccess')}><MePaper><h2>{t('auth.profile.linkTitle')}</h2><p className="me-help">{t('auth.profile.linkHelp')}</p><label className="me-label">{t('auth.email')}<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="me-primary" disabled={busy||!email.trim()} onClick={()=>void run(async()=>{const redirect=safeInternalRedirect(params.get('redirect'))??'/profile';await auth.linkAnonymousEmail(email.trim(),`${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`);setMessage(t('auth.profile.verificationSent'))})}>{busy?t('auth.profile.sending'):t('auth.profile.sendVerification')}</button></MePaper></MeSection>:null}
  <MeSection title={c('Recovery','找回账户')}><MePaper><MeRow icon="mail" title={c('Forgot password?','忘记密码？')} sub={c('Recovery by email · planned integration','邮箱找回 · 待接入')} disabled later={later}/></MePaper></MeSection><p className="me-help">{c('Email recovery is not enabled here yet. Keep access to your current sign-in method.','此处尚未开放邮箱找回，请保留现有登录方式。')}</p>
 </>:null}
 {page==='security/password'?<MePaper><h2>{c('Manage password','管理密码')}</h2><p className="me-help">{c('Choose a new password for this account. Your sign-in provider handles verification; this page does not assume whether a password was previously set.','为当前账户选择新密码。验证由登录服务处理，此页面不会推测此前是否设置过密码。')}</p>{authUser.isAnonymous?<MeNote>{c('Link and verify an email before managing a password.','请先关联并验证邮箱。')}</MeNote>:<><label className="me-label">{t('auth.profile.newPassword')}<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} aria-describedby="me-password-help"/></label><p id="me-password-help" className="me-help">{t('auth.passwordHelp')}</p><button className="me-primary" disabled={busy||password.length<8||!/[a-z]/i.test(password)||!/[0-9]/.test(password)} onClick={()=>void run(async()=>{await auth.setAccountPassword(password);setPassword('');setMessage(t('auth.profile.passwordUpdated'))})}>{busy?t('auth.profile.updating'):c('Update password','更新密码')}</button></>}</MePaper>:null}
 {page==='privacy'?<><p className="me-intro">{c('Manage your personal records and privacy in one place.','在这里管理个人记录与隐私。')}</p><MePaper><MeRow icon="export" title={c('Export my data','导出我的数据')} sub={c('Download records as CSV','下载 CSV 记录')} disabled later={later}/><MeRow icon="file" title={c('Privacy policy','隐私政策')} sub={c('How your data is handled','数据如何被处理')} disabled later={later}/></MePaper><MeSection title={c('Permanent actions','永久性操作')}><MePaper><MeRow icon="trash" title={c('Delete account','删除账户')} sub={c('Not the same as Reset account','与重新开始个人账期不同')} disabled later={later} destructive/></MePaper></MeSection><MeNote warning>{c('Shared records matter. Deleting an account is a different action from starting a new personal ledger.','共享记录很重要。删除账户与开启新的个人账期是不同的操作。')}</MeNote><p className="me-help">{notAvailable}</p></>:null}
 {page==='help'?<><p className="me-intro">{c('A simple way to get help and share what could make Tabby Tally better.','了解使用方式，分享让 Tabby Tally 更好的建议。')}</p><MePaper><MeRow icon="book" title={c('How to use Tabby Tally','如何使用 Tabby Tally')} sub={c('Quick Add, Split, Settlements','快速记账、分账、结算')} disabled later={later}/><MeRow route="feedback/bug" icon="bug" title={c('Report a problem','报告问题')} sub={c('Tell us what went wrong','描述遇到的问题')} onClick={()=>go('feedback/bug')}/><MeRow route="feedback/feature" icon="idea" title={c('Suggest a feature','提出功能建议')} sub={c('Share ideas for the app','分享你的想法')} onClick={()=>go('feedback/feature')}/></MePaper><MeNote>{c('Feedback screens are UI-only. Nothing will be submitted or uploaded in this release.','反馈页面仅提供界面，本版本不会提交或上传任何内容。')}</MeNote><MeSection title={c('About','关于')}><MePaper><strong>Tabby Tally</strong><p className="me-help">{__TABBY_TALLY_DEPLOYMENT_RELEASE__??c('Local development build','本地开发版本')}</p><p>{c('A personal finance and shared expenses companion.','个人财务与共享支出助手。')}</p></MePaper></MeSection></>:null}
 {page.startsWith('feedback/')?<><MeSection title={c('Your feedback','你的反馈')}><MePaper><label className="me-label">{c('What would you like us to know?','你希望我们了解什么？')}<textarea value={feedback} maxLength={4000} onChange={e=>setFeedback(e.target.value)} placeholder={c('Describe the issue or your idea…','描述问题或想法…')}/></label><MeRow icon="camera" title={c('Attach screenshot','附加截图')} sub={c('Optional · never attach financial data automatically','可选 · 绝不自动附上财务资料')} disabled later={later}/></MePaper></MeSection><MeNote>{c('Design only. Submitting and attaching screenshots are not enabled. Your text stays on this screen only.','仅界面，尚未开放提交和附图。文字仅暂存于当前页面。')}</MeNote><button className="me-primary" disabled>{c('Submit feedback · Coming later','提交反馈 · 稍后提供')}</button></>:null}
 </>}
 {error?<p className="me-error" role="alert">{error}</p>:null}{message?<p className="me-note" role="status">{message}</p>:null}
 <CenteredDialog open={modal==='language'} title={c('App language','应用语言')} closeLabel={c('Cancel','取消')} onClose={closeModal}><p className="me-help">{c('Choose display language','选择显示语言')}</p>{(['en','zh']as const).map(code=><button key={code} className="me-language" aria-pressed={lang===code} onClick={()=>{setLang(code);closeModal()}}><span>{code==='en'?'English':'简体中文'}</span>{lang===code?<MeIcon name="check"/>:null}</button>)}</CenteredDialog>
 <CenteredDialog open={modal==='signout'} title={c('Sign out?','退出登录？')} closeLabel={c('Cancel','取消')} onClose={closeModal}><p className="me-help">{authUser.isAnonymous?t('auth.profile.signOutWarningHelp'):c('There is unfinished local work or a Quick Add draft on this device. Keep this session to finish it, or sign out without submitting anything.','此设备存在尚未处理的本地操作或记账草稿。你可以保留会话先完成它，或不提交任何内容直接退出。')}</p><button className="me-primary" disabled={busy} onClick={signOut}>{authUser.isAnonymous?t('auth.profile.signOutAnyway'):c('Sign out anyway','仍然退出')}</button><button className="me-link" onClick={closeModal}>{c('Keep session','保留会话')}</button>{error?<p role="alert">{error}</p>:null}</CenteredDialog>
 </main>
}
