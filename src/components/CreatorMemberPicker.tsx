import {useId,useState}from'react'
import {RoutedAvatar}from'./RoutedSettlementMap'
import type{CreatorPerson}from'../lib/creatorSettlement'
/** Package MemberPicker adapted to the existing authorized Trip principals. */
export function CreatorMemberPicker({label,value,people,onChange,emptyLabel,allowEmpty=false}:{label:string;value:string;people:CreatorPerson[];onChange:(id:string)=>void;emptyLabel:string;allowEmpty?:boolean}){
 const[open,setOpen]=useState(false),id=useId(),selected=people.find(p=>p.id===value)
 return <div className="tt-c-picker"><span>{label}</span><button type="button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}>{selected?<RoutedAvatar person={selected}/>:null}<span>{selected?.name??emptyLabel}</span><span aria-hidden="true">⌄</span></button>{open?<div className="tt-c-people" id={id} role="group" aria-label={label}>{allowEmpty?<button type="button" aria-pressed={!value} onClick={()=>{onChange('');setOpen(false)}}>{emptyLabel}</button>:null}{people.map(p=><button type="button" key={p.id} aria-pressed={p.id===value} onClick={()=>{onChange(p.id);setOpen(false)}}><RoutedAvatar person={p}/><span>{p.name}</span></button>)}</div>:null}</div>
}
