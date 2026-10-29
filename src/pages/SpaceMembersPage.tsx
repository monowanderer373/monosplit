import {useTripFriends} from '../hooks/useTripFriends'
import {useEffect,useRef,useState} from 'react'
import {Link,useLocation,useNavigate,useParams} from 'react-router-dom'
import {useUniversalQuickAdd} from '../hooks/useUniversalQuickAdd'
import {useAuth} from '../hooks/useAuth'
import {useTripMembership} from '../hooks/useTripMembership'
import {useT,friendlyErrorKey,countKey,type TranslationKey} from '../lib/i18n'
import {spaceRepository} from '../lib/spaceRepository'
import {notifyTripMembersChanged,readTripMembership,tripMemberPermissions,type TripMember} from '../lib/tripMembers'
import {backFromMembers,prepareMembersBack} from '../lib/tripMembersNavigation'
import {supabase} from '../lib/supabase'
import MoneyDialog from '../components/accounts/MoneyDialog'
import {AnchoredPaperPopover,TravelIcon} from '../components/travel/TravelUI'
import '../components/travel/trip-members.css'

export default function SpaceMembersPage(){
  const {authUser,loading,sessionError,retrySession}=useAuth(),{spaceId=''}=useParams(),t=useT()
  if(loading||(authUser&&!authUser.participantId&&!sessionError))return <main className="tm-page"><p role="status">{t('home.loading')}</p></main>
  if(sessionError)return <main className="tm-page"><p role="alert">{t('ledger.sessionUnavailable')}</p><button type="button" onClick={retrySession}>{t('common.retry')}</button></main>
  if(!authUser?.participantId)return <main className="tm-page"><h1>{t('travel.members')}</h1><Link to={'/login?redirect='+encodeURIComponent('/space/'+spaceId+'/members')}>{t('common.signIn')}</Link></main>
  return <MembersContent key={authUser.id+':'+spaceId} identity={authUser.id} self={authUser.participantId} trip={spaceId} canRequestFriends={!authUser.isAnonymous}/>
}
function MembersContent({identity,self,trip,canRequestFriends}:{identity:string;self:string;trip:string;canRequestFriends:boolean}){
  const {setPageTarget}=useUniversalQuickAdd()
  const t=useT(),navigate=useNavigate(),location=useLocation(),snapshot=useTripMembership(identity,self,trip)
  const [menu,setMenu]=useState<TripMember|null>(null),[dialog,setDialog]=useState<'invite'|'add'|'remove'|null>(null),[target,setTarget]=useState<TripMember|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState<TranslationKey|''>(''),[name,setName]=useState(''),[inviteRole,setInviteRole]=useState<'full_access'|'view'>('full_access'),[invite,setInvite]=useState(''),[copied,setCopied]=useState(false)
  const lock=useRef(false),alive=useRef(true),anchor=useRef<HTMLButtonElement>(null),focusTarget=useRef<HTMLButtonElement|null>(null),prepared=useRef<'trip'|'unavailable'|null>(null)
  const friends=useTripFriends(snapshot.status==='ready'&&canRequestFriends?identity:'',trip)
  const entry=snapshot.data?.entry,ready=snapshot.status==='ready'&&entry?.space.type==='trip',permissions=entry?tripMemberPermissions(entry,self):null
  useEffect(()=>{setPageTarget({pathname:location.pathname,ready:!!ready&&!!permissions?.add,target:{kind:'space-candidate',spaceId:trip}});return()=>setPageTarget(null)},[setPageTarget,location.pathname,ready,permissions?.add,trip])
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  useEffect(()=>{
    if(entry&&entry.space.type!=='trip'){navigate('/space/'+encodeURIComponent(trip),{replace:true});return}
    const mode=snapshot.status==='unavailable'?'unavailable':entry?.space.type==='trip'?'trip':null
    if(mode&&prepared.current!==mode){prepared.current=mode;prepareMembersBack(navigate,location.state,identity,trip,mode==='unavailable',!canRequestFriends)}
  },[entry,snapshot.status,trip,identity,navigate,location.state,canRequestFriends])
  useEffect(()=>{
    if(snapshot.status==='unavailable'||snapshot.status==='error'||(snapshot.status==='ready'&&dialog==='invite'&&!permissions?.invite)){
      setMenu(null);setDialog(null);setInvite('');setTarget(null)
    }
  },[snapshot.status,permissions?.invite,dialog])
  const restoreFocus=()=>requestAnimationFrame(()=>{if(!alive.current)return;if(focusTarget.current?.isConnected)focusTarget.current.focus({preventScroll:true});else {const key=focusTarget.current?.dataset.tmFocus;const next=key?document.querySelector<HTMLButtonElement>('[data-tm-focus="'+CSS.escape(key)+'"]'):null;(next??document.getElementById('trip-members-title'))?.focus({preventScroll:true})}})
  const close=()=>{if(lock.current)return;setDialog(null);setMenu(null);setInvite('');setCopied(false);restoreFocus()}
  const back=()=>backFromMembers(navigate,location.state,identity,trip,snapshot.status==='unavailable',!canRequestFriends)
  const run=async(action:'invite'|'add'|'role'|'remove',member?:TripMember,role?:'full_access'|'view')=>{
    if(lock.current||!ready)return
    lock.current=true;setBusy(true);setError('')
    try{
      const user=await supabase?.auth.getUser()
      if(!alive.current||user?.data.user?.id!==identity)return
      const fresh=await readTripMembership(trip,self)
      if(!alive.current)return
      if(!fresh||fresh.entry.space.type!=='trip')throw new Error('space_write_denied')
      const current=member?fresh.members.find(row=>row.participant.id===member.participant.id):undefined
      const allowed=tripMemberPermissions(fresh.entry,self,current)
      if(!allowed[action]||(member&&!current))throw new Error('space_write_denied')
      if(action==='invite'){
        const token=await spaceRepository.createInvite(trip,inviteRole)
        if(!alive.current)return
        const url=window.location.origin+'/space-invite/'+token;setInvite(url);setCopied(false)
        try{if(!navigator.clipboard?.writeText)throw new Error('clipboard_unavailable');await navigator.clipboard.writeText(url);if(alive.current)setCopied(true)}catch{/* Show the authorized URL for manual copying; never claim success. */}
      }else{
        if(action==='add')await spaceRepository.addManualMember(trip,name.trim())
        else if(action==='role'&&member&&role)await spaceRepository.updateMemberRole(trip,member.participant.id,role)
        else if(action==='remove'&&member)await spaceRepository.removeMember(trip,member.participant.id)
        if(!alive.current)return
        notifyTripMembersChanged(trip)
        if(action==='remove'&&member?.participant.id===self){navigate(canRequestFriends?'/shared?tab=trips':'/',{replace:true});return}
        setDialog(null);setMenu(null);setName('');await snapshot.refresh();restoreFocus()
      }
    }catch(cause){if(alive.current){setError(friendlyErrorKey(cause));setMenu(null);setDialog(null);setInvite('');await snapshot.refresh();restoreFocus()}}
    finally{lock.current=false;if(alive.current)setBusy(false)}
  }
  const actionLabel=(row:TripMember)=>t('members.manage',{name:row.participant.id===self?t('members.you'):row.participant.displayName})
  return <main className="tm-page" data-testid="trip-members-page" aria-busy={busy||snapshot.status==='loading'}>
    <button type="button" className="tm-back" onClick={back}><TravelIcon name="chevron-left"/>{t('members.back')}</button>
    <header className="tm-heading"><div><h1 id="trip-members-title" tabIndex={-1}>{t('travel.members')}</h1><p>{ready?entry.space.name:t('members.loading')} {ready?' · '+t(countKey('common.count.member.one','common.count.member.many',snapshot.data!.members.length),{count:snapshot.data!.members.length}):''}</p></div>
      {ready&&permissions?.invite?<button type="button" className="tm-invite" data-tm-focus="invite" disabled={busy} onClick={event=>{focusTarget.current=event.currentTarget;setInvite('');setCopied(false);setDialog('invite')}}>{t('members.invite')}</button>:null}</header>
    {busy?<p className="tm-help" role="status">{t('members.working')}</p>:null}
    {error?<p className="tm-error" role="alert">{t(error)} <button type="button" className="tm-link" onClick={()=>void snapshot.refresh()} disabled={busy}>{t('common.retry')}</button></p>:null}
    {snapshot.status==='loading'?<div className="tm-loading" role="status" aria-label={t('home.loading')}>{[1,2,3].map(n=><div key={n}/>)}</div>:null}
    {snapshot.status==='error'?<section className="tm-state" role="alert"><p>{t(snapshot.error||'members.loadError')}</p><button type="button" className="tm-invite" onClick={()=>void snapshot.refresh()}>{t('common.retry')}</button></section>:null}
    {snapshot.status==='unavailable'?<section className="tm-state"><h2>{t('members.unavailable')}</h2><p>{t('members.noAccess')}</p><button type="button" className="tm-invite" onClick={back}>{t('members.backTrips')}</button></section>:null}
    {ready&&friends.error?<p className="tm-error" role="alert">{t('friendRequest.retryHelp')} <button type="button" className="tm-link" onClick={()=>void friends.refresh()}>{t('common.retry')}</button></p>:null}
    {ready?<><ul className="tm-list" aria-label={t('travel.members')}>
      {snapshot.data!.members.map(row=>{const {participant,member}=row,p=tripMemberPermissions(entry,self,row),label=participant.id===self?t('members.you'):participant.displayName||t('common.member')
        const role=participant.kind==='manual'?t('members.untracked'):member.role==='owner'?t('members.owner'):t(member.role==='view'?'members.viewOnly':'members.fullAccess')
        return <li className="tm-row" key={participant.id} data-participant-id={participant.id}><span className={'tm-avatar tm-avatar--'+(member.role==='owner'?'owner':participant.kind==='manual'?'manual':member.role==='view'?'view':'full')} aria-hidden="true">{Array.from(label)[0]}</span><div className="tm-person"><strong>{label}</strong><span>{role}</span></div>
          <div className="tm-row-actions">{canRequestFriends&&participant.id!==self&&participant.kind==='account'?(()=>{
            const state=friends.states.find(s=>s.participantId===participant.id)
            const disabled=!friends.ready||!!friends.busy||friends.error
            if(!state)return <span className="tm-friend-status">{t('friendRequest.loading')}</span>
            return <>{state.state==='available'?<button type="button" className="tm-friend-add" aria-label={t('friendRequest.addNamed',{name:label})} disabled={disabled} onClick={()=>void friends.send(participant.id)}>{friends.busy===participant.id?'…':'＋'}</button>:state.state==='incoming'?<button type="button" className="tm-friend-add" disabled={disabled} onClick={()=>void friends.respond({id:state.requestId!,version:state.version!},'accepted')}>{t('common.accept')}</button>:<span className="tm-friend-status">{t(state.state==='friend'?'friendRequest.friend':state.state==='sent'?'friendRequest.sent':'friendRequest.unavailable')}</span>}
            </>
          })():null}
          {p.role||p.remove||friends.states.some(s=>s.participantId===participant.id&&(s.state==='sent'||s.state==='incoming'))?<button type="button" className="tm-more" data-tm-focus={participant.id} aria-label={actionLabel(row)} aria-expanded={menu?.participant.id===participant.id} disabled={busy} onClick={event=>{anchor.current=event.currentTarget;focusTarget.current=event.currentTarget;setMenu(row)}}><span aria-hidden="true">⋯</span></button>:null}</div></li>})}
    </ul>{permissions?.add?<div className="tm-add"><button type="button" className="tm-link" aria-label={t('members.addManual')} data-tm-focus="add" disabled={busy} onClick={event=>{focusTarget.current=event.currentTarget;setName('');setDialog('add')}}>＋ {t('members.addManual')}</button><p>{t('members.untrackedHelp')}</p></div>:entry.role!=='owner'?<p className="tm-help">{t('members.readHelp')}</p>:null}</>:null}
    {menu&&ready?<AnchoredPaperPopover anchor={anchor} label={actionLabel(menu)} onClose={()=>{if(!lock.current){setMenu(null);restoreFocus()}}}>
      {busy?<p className="tm-menu-name" role="status">{t('members.working')}</p>:null}
      {(()=>{const state=friends.states.find(s=>s.participantId===menu.participant.id);return state?.requestId&&state.version?<button type="button" className="tt-popover-footer-control tm-menu-button" disabled={!!friends.busy||friends.error} onClick={()=>{void friends.respond({id:state.requestId!,version:state.version!},state.state==='sent'?'cancelled':'declined');setMenu(null)}}>{t(state.state==='sent'?'friendRequest.cancel':'common.decline')}</button>:null})()}
      <p className="tm-menu-name">{menu.participant.id===self?t('members.you'):menu.participant.displayName}</p>
      {tripMemberPermissions(entry,self,menu).role?(['full_access','view']as const).map(role=><button type="button" className="tt-popover-footer-control tm-menu-button" key={role} aria-pressed={menu.member.role===role} disabled={busy||menu.member.role===role} onClick={()=>void run('role',menu,role)}>{menu.member.role===role?'✓ ':''}{t(role==='view'?'members.viewOnly':'members.fullAccess')}</button>):null}
      {tripMemberPermissions(entry,self,menu).remove?<button type="button" className="tt-popover-footer-control tm-menu-button tm-danger" disabled={busy} onClick={()=>{setTarget(menu);setMenu(null);setDialog('remove')}}>{t(menu.participant.id===self?'common.leave':'members.remove')}</button>:null}
    </AnchoredPaperPopover>:null}
    {dialog&&ready?<MoneyDialog title={t(dialog==='invite'?'members.invite':dialog==='add'?'members.addManual':target?.participant.id===self?'members.leave':'members.remove')} onClose={close} testId="trip-members-dialog"><div className="tm-form" aria-busy={busy}>
      {dialog==='invite'?<><label>{t('space.inviteAccess')}<select value={inviteRole} disabled={busy} onChange={e=>{setInviteRole(e.target.value as 'full_access'|'view');setInvite('');setCopied(false)}}><option value="full_access">{t('members.fullAccess')}</option><option value="view">{t('members.viewOnly')}</option></select></label><button type="button" className="tm-invite" disabled={busy||!!invite} onClick={()=>void run('invite')}>{t(busy?'common.creating':'space.copyInvite')}</button>{invite?<><p role="status">{t(copied?'space.inviteCopied':'members.manualCopy')}</p>{!copied?<label>{t('members.inviteLink')}<input readOnly value={invite} onFocus={e=>e.target.select()}/></label>:null}</>:null}</>:dialog==='add'?<form onSubmit={e=>{e.preventDefault();if(name.trim())void run('add')}}><label>{t('space.addPersonPlaceholder')}<input value={name} maxLength={100} disabled={busy} autoComplete="off" onChange={e=>setName(e.target.value)}/></label><button type="submit" className="tm-invite" disabled={busy||!name.trim()}>{t(busy?'common.adding':'members.addManual')}</button></form>:<><p>{t(target?.participant.id===self?'members.leaveConfirm':'members.removeConfirm',{name:target?.participant.displayName??'',trip:entry.space.name})}</p><p>{t('members.historySafe')}</p><button type="button" className="tm-invite tm-danger" disabled={busy} onClick={()=>target&&void run('remove',target)}>{t(target?.participant.id===self?'common.leave':'common.remove')}</button></>}
      <button type="button" className="tm-link" disabled={busy} onClick={close}>{t('common.cancel')}</button>
    </div></MoneyDialog>:null}
  </main>
}
