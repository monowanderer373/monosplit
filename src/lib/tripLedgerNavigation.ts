import {saveNavigationSession} from './navigationStorage'
import {spaceParentState} from './spaceNavigation'
import type{Location,NavigateFunction}from'react-router-dom'
import type{TripLedgerTab}from'./tripLedger'
type Ui={limit:number;scroll:Record<TripLedgerTab,number>;focus:string;focusPath:string}
const views=new Map<string,Ui>();let identity=''
export function tripLedgerUi(actor:string,trip:string){if(identity!==actor){views.clear();identity=actor}const key=actor+':'+trip;if(!views.has(key))views.set(key,{limit:20,scroll:{expenses:0,balances:0},focus:'',focusPath:''});return views.get(key)!}
export function setTripLedgerFocus(actor:string,trip:string,focus:string,path=''){const ui=tripLedgerUi(actor,trip);ui.focus=focus;ui.focusPath=path}
export function setTripLedgerScroll(actor:string,trip:string,tab:TripLedgerTab,scroll:number){tripLedgerUi(actor,trip).scroll[tab]=scroll}
export function setTripLedgerLimit(actor:string,trip:string,limit:number){tripLedgerUi(actor,trip).limit=limit}
type Origin={actor:string;trip:string;path:string;index:number;scroll:number}
const origins=new Map<string,Origin>(),prefix='tt:trip-ledger-origin:'
export function openTripLedgerView(navigate:NavigateFunction,location:Pick<Location,'pathname'|'search'|'state'>,actor:string,trip:string,view:'history'|'summary',focus?:string){
 const path=location.pathname+location.search;if(location.pathname!=='/space/'+trip)return
 const token=crypto.randomUUID(),origin={actor,trip,path,index:window.history.state?.idx??0,scroll:window.scrollY}
 origins.set(token,origin);if(origins.size>40)origins.delete(origins.keys().next().value!);try{saveNavigationSession(prefix,token,JSON.stringify(origin))}catch{/* memory preserves this session */}
 navigate(path,{replace:true,state:{...location.state,restoreScroll:window.scrollY}})
 const params=new URLSearchParams(location.search);params.delete('section');params.set('view',view);if(focus){params.set('focusExpenseId',focus);params.set('history','expenses')}
 navigate({pathname:location.pathname,search:params.toString()},{state:{...location.state,ledgerOrigin:token,restoreScroll:0}})
}
export function backFromTripLedgerView(navigate:NavigateFunction,state:unknown,actor:string,trip:string,tab:TripLedgerTab){
 const token=(state as {ledgerOrigin?:unknown}|null)?.ledgerOrigin
 try{const origin=typeof token==='string'?origins.get(token)??JSON.parse(sessionStorage.getItem(prefix+token)??'null')as Origin|null:null
 if(origin&&origin.actor===actor&&origin.trip===trip&&origin.path.split('?')[0]==='/space/'+trip&&window.history.state?.idx===origin.index+1){navigate(-1);return}}catch{/* same-Trip fallback */}
 navigate('/space/'+encodeURIComponent(trip)+'?tab='+tab,{replace:true,state:{...spaceParentState(state,actor,'/space/'+trip),restoreScroll:0}})
}
