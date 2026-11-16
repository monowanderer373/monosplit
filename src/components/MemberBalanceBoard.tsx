import {useRef,useState}from'react'
import{useStore}from'../store/useStore'
import type {ContraSnapshot,ContraPair}from'../lib/tripContra'
import type {CreatorPerson}from'../lib/creatorSettlement'
import {RoutedAvatar}from'./RoutedSettlementMap'
import {routedMoney}from'../lib/routedSettlement'
export function MemberBalanceBoard({snapshot,people,onChoose,disabled}:{snapshot:ContraSnapshot;people:CreatorPerson[];onChoose:(pair:ContraPair,recipient?:string)=>void;disabled:boolean}){
 const lang=useStore(s=>s.lang)
 const[selected,setSelected]=useState<ContraPair|null>(null),drag=useRef<{pair:ContraPair;x:number;y:number;moved:boolean}|null>(null),suppress=useRef(false)
 const edges=snapshot.pairs.filter(p=>p.currentMembers&&p.availableMinor>0&&p.payer&&p.recipient)
 const valid=(pair:ContraPair,id:string)=>id!==pair.payer&&id!==pair.recipient&&edges.some(e=>e.payer===pair.recipient&&e.recipient===id)
 const person=(id:string)=>people.find(p=>p.id===id)??{id,name:'—'}
 return <section className="tt-final-board"><div className="tt-final-targets">{people.map(p=><button type="button" key={p.id} data-recipient={p.id} disabled={disabled||!selected||!valid(selected,p.id)} aria-label={p.name} onClick={()=>{if(selected&&valid(selected,p.id)){onChoose(selected,p.id);setSelected(null)}}}><RoutedAvatar person={p}/><span>{p.name}</span>{selected&&valid(selected,p.id)?'✓':null}</button>)}</div><p>{lang==='zh'?'先选欠款，再选有效收款人。拖放只打开预览。':'Select a debt, then a valid recipient. Dragging only opens a preview.'}</p>{edges.map(pair=><div className="tt-final-debt" key={pair.id}><span>{person(pair.payer!).name} → {person(pair.recipient!).name}</span><button type="button" className="tt-final-chip" disabled={disabled} aria-pressed={selected?.id===pair.id} onPointerDown={e=>{if(disabled)return;drag.current={pair,x:e.clientX,y:e.clientY,moved:false};setSelected(pair);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const d=drag.current;if(d&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>8)d.moved=true}} onPointerCancel={()=>{drag.current=null;setSelected(null)}} onPointerUp={e=>{const d=drag.current;drag.current=null;if(!d?.moved)return;suppress.current=true;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-recipient]')?.dataset.recipient;if(target&&valid(d.pair,target))onChoose(d.pair,target);setSelected(null)}} onClick={()=>{if(suppress.current){suppress.current=false;return}setSelected(pair)}}>{pair.display.known?routedMoney(pair.display.netMinor!,pair.display.currency):routedMoney(pair.availableMinor,'VND')}</button><button type="button" disabled={disabled} onClick={()=>onChoose(pair)}>{lang==='zh'?'录款':'Record'}</button></div>)}</section>
}
