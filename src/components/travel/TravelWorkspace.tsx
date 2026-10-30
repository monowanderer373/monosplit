import {useCallback,useEffect,useState} from 'react'
import {useLocation,useNavigate} from 'react-router-dom'
import {useAuth} from '../../hooks/useAuth'
import {usePersonalLedger} from '../../hooks/usePersonalLedger'
import {useSettlements} from '../../hooks/useSettlements'
import {useTripMembership} from '../../hooks/useTripMembership'
import {useAccessibleTrips} from '../../hooks/useAccessibleTrips'
import {useLocalCalendarDate} from '../../hooks/useLocalCalendarDate'
import {useUniversalQuickAdd} from '../../hooks/useUniversalQuickAdd'
import {useStore} from '../../store/useStore'
import {useT} from '../../lib/i18n'
import {selectWorkspaceTrip} from '../../lib/tripWorkspace'
import {replaceTravelWorkspace,readSpaceOrigin} from '../../lib/spaceNavigation'
import {ModeBookmark} from '../home/HomeScreen'
import TripLedger from './TripLedger'
import {TravelIcon} from './TravelUI'
import './trip-workspace.css'

export function TravelWorkspaceHome() {
 const t=useT(),{authUser}=useAuth(),navigate=useNavigate(),location=useLocation(),{setPageTarget}=useUniversalQuickAdd()
 const identity=authUser?.id??'',self=authUser?.participantId??'',pool=useAccessibleTrips(identity,self),today=useLocalCalendarDate(authUser?.timezone??'Asia/Kuala_Lumpur')
 const preferred=useStore(s=>s.travelTripByIdentity[identity]??null),setTrip=useStore(s=>s.setTravelTrip),setHome=useStore(s=>s.setHomeUi)
 const selected=pool.status==='ready'?selectWorkspaceTrip(pool.data,today,preferred):null
 useEffect(()=>{setPageTarget({pathname:location.pathname,ready:false,target:{kind:'ambiguous'}});return()=>setPageTarget(null)},[setPageTarget,location.pathname])
 useEffect(()=>{if(pool.status!=='ready'||!identity)return;if(selected){setTrip(identity,selected.space.id);replaceTravelWorkspace(navigate,location,identity,selected.space.id)}else if(preferred)setTrip(identity,null)},[pool.status,identity,selected,preferred,setTrip,navigate,location])
 return <main className="tw-page" data-testid="travel-workspace-home"><header className="tw-topbar" data-testid="home-header"><h1>{t('home.modeTravel')}</h1><ModeBookmark mode="travel" onChange={next=>{if(next!=='daily')return;setHome({mode:'daily'});navigate('/',{replace:true})}}/></header>
  {pool.status==='ready'&&!selected?<section className="tw-empty" data-testid="home-trip-empty"><TravelIcon name="map"/><h2>{t('travel.emptyTitle')}</h2><p>{t('travel.emptySubtitle')}</p><button type="button" className="tw-button" onClick={()=>navigate('/shared?tab=trips&create=1&return=travel',{state:{restoreScroll:0}})}>{t('travel.create')}</button><button type="button" className="tw-link" onClick={()=>navigate('/shared?tab=trips')}>{t('tw.viewTrips')}</button></section>:<section className="tw-empty" role={pool.status==='error'?'alert':'status'}><p>{t(pool.status==='error'?'travel.unavailable':'home.loading')}</p>{pool.status==='error'?<button className="tw-link" type="button" onClick={()=>void pool.refresh()}>{t('common.retry')}</button>:null}</section>}
 </main>
}

export function TravelWorkspaceRoute({tripId}:{tripId:string}) {
 const t=useT(),{authUser}=useAuth(),navigate=useNavigate(),location=useLocation(),ledger=usePersonalLedger(),{setPageTarget}=useUniversalQuickAdd()
 const identity=authUser?.id??'',self=authUser?.participantId??'',key=identity+':'+self+':'+tripId
 const membership=useTripMembership(identity,self,tripId),pool=useAccessibleTrips(identity,self),settlements=useSettlements(!!self,key),today=useLocalCalendarDate(authUser?.timezone??'Asia/Kuala_Lumpur')
 const origin=readSpaceOrigin(location.state,identity,location.pathname),home=origin?.workspaceHome===true
 const setTrip=useStore(s=>s.setTravelTrip)
 const [verified,setVerified]=useState<{key:string;data:NonNullable<typeof membership.data>}|null>(null)
 if(membership.status==='ready'&&membership.data&&verified?.data!==membership.data)setVerified({key,data:membership.data})
 const data=membership.status==='ready'?membership.data:membership.status==='loading'&&verified?.key===key?verified.data:null
 const refreshMembership=membership.refresh,refreshLedger=ledger.refresh,refreshSettlements=settlements.refresh,refreshPool=pool.refresh
 const refresh=useCallback(async()=>{await Promise.all([refreshMembership(),refreshLedger(),refreshSettlements(),refreshPool()])},[refreshMembership,refreshLedger,refreshSettlements,refreshPool])
 useEffect(()=>{if(home&&membership.status==='ready')setTrip(identity,tripId)},[home,membership.status,setTrip,identity,tripId])
 useEffect(()=>{if(membership.status!=='unavailable')return;setPageTarget({pathname:location.pathname,ready:false,target:{kind:'space-candidate',spaceId:tripId}});if(!home||pool.status!=='ready')return;const next=selectWorkspaceTrip(pool.data.filter(e=>e.space.id!==tripId),today);setTrip(identity,next?.space.id??null);if(next)replaceTravelWorkspace(navigate,location,identity,next.space.id);else navigate('/',{replace:true})},[membership.status,home,pool.status,pool.data,today,setTrip,identity,tripId,setPageTarget,location,navigate])
 useEffect(()=>{if(data)return;setPageTarget({pathname:location.pathname,ready:false,target:{kind:'space-candidate',spaceId:tripId}});return()=>setPageTarget(null)},[data,setPageTarget,location.pathname,tripId])
 if(!data||data.entry.space.type!=='trip')return <main className="tw-page"><button className="tw-link" type="button" onClick={()=>navigate(authUser?.isAnonymous?'/':'/shared?tab=trips',{replace:true})}>{t('sharedA.trips')}</button><section className="tw-empty" role={membership.status==='loading'?'status':'alert'}><p>{t(membership.status==='loading'?'home.loading':membership.status==='error'?'travel.unavailable':'travel.noAccess')}</p>{membership.status==='error'?<button className="tw-link" type="button" onClick={()=>void refresh()}>{t('common.retry')}</button>:null}</section></main>
 return <TripLedger key={key} entry={data.entry} members={data.members} ledger={ledger} settlementState={settlements} refresh={refresh} error={membership.status==='error'?membership.error:''} authorityReady={membership.status==='ready'} refreshing={membership.status==='loading'} travel={{home,pool:pool.data,poolStatus:pool.status,onRetry:refreshPool}}/>
}
