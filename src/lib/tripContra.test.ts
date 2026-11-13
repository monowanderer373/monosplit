import {describe,it,expect} from 'vitest'
import {validateContraSnapshot,contraTotals,contraChoice,contraDraft,type ContraPair,type ContraSnapshot} from './tripContra'
function pair(b:string,forward:number,reverse:number):ContraPair {
 const d={known:true,currency:'MYR',estimated:true,aOwesB:forward,bOwesA:reverse,contraMinor:Math.min(forward,reverse),netMinor:Math.abs(forward-reverse),payer:forward>reverse?'david':b,recipient:forward>reverse?b:'david'}
 // UUID ordering is represented by stable lexical test IDs (a precedes b).
 const a='david',other=b,native=[{from:a,to:other,currency:'MYR',minor:forward},{from:other,to:a,currency:'VND',minor:reverse*60}]
 return{id:a+':'+b,a,b,edgeBasis:'net',nativeBasis:'same_currency_net',native,availableNative:native,audit:[],display:d,grossDisplay:d,ledgerCurrency:'MYR',ledger:d,netMinor:d.netMinor,availableMinor:d.netMinor,payer:d.payer,recipient:d.recipient,pending:false,currentMembers:true,sourceVersions:[]}
}
function sample():ContraSnapshot {
 // The sample is independently constructed already-net server output. Consumers
 // must sum it, not contra gross/native lines again.
 return{tripId:'trip',viewer:'david',revision:'a'.repeat(64),edgeBasis:'net',canRecord:true,quote:{mode:'custom',snapshotId:null,displayCurrency:'MYR',numerator:'6000',denominator:'1',rates:{}},pairs:[pair('z-chong',2286,37150),pair('z-kian',8339,37150),pair('z-lii',6138,21303)]}
}
describe('shared bilateral contra DTO',()=>{
 it('sums the authoritative Hanoi net once and never offers David as payer',()=>{const s=validateContraSnapshot(sample(),'trip','david');expect(contraTotals(s,'david')).toEqual({pay:0n,collect:78840n,known:true});expect(s.pairs.map(p=>p.netMinor)).toEqual([34864,28811,15165]);expect(s.pairs.every(p=>contraChoice(p)?.recipient==='david')).toBe(true)})
 it('binds a payment to the same quote/ledger revision',()=>{const s=sample();expect(contraDraft(s)).toEqual({edgeBasis:'net',contraSnapshot:{revision:s.revision,displayCurrency:'MYR'}})})
 it('does not globally minimize independent debts',()=>{const s=sample();const independent=pair('z-ps',0,2000);independent.a='lii';independent.id='lii:z-ps';independent.display={...independent.display,payer:'z-ps',recipient:'lii'};s.pairs.push(independent);expect(contraTotals(s,'david').collect).toBe(78840n)})
 it.each(['trip','viewer','basis','double-contra','reverse','pending','cap','native','available','ledger','gross','unknown'])('rejects inconsistent %s output before rendering it',fault=>{const s=sample(),p=s.pairs[0];switch(fault){case'trip':s.tripId='other';break;case'viewer':s.viewer='other';break;case'basis':Object.assign(s,{edgeBasis:'gross'});break;case'double-contra':p.display.netMinor=32578;break;case'reverse':p.display.payer='david';break;case'pending':p.pending=true;break;case'cap':p.availableMinor=p.netMinor!+1;break;case'native':p.native.push({...p.native[0],from:p.b,to:p.a});break;case'available':p.availableNative=[{...p.native[0],minor:p.native[0].minor+1}];break;case'ledger':p.netMinor=1;break;case'gross':p.grossDisplay={...p.display,contraMinor:0};break;case'unknown':p.display={...p.display,known:false};break}expect(()=>validateContraSnapshot(s,'trip','david')).toThrow('invalid_contra_snapshot')})
 it('does not show a missing FX valuation as zero',()=>{const s=sample();s.pairs[0].display={known:false,currency:'MYR',estimated:true,aOwesB:null,bOwesA:null,contraMinor:null,netMinor:null,payer:null,recipient:null};s.pairs[0].grossDisplay=null;expect(contraTotals(s,'david').known).toBe(false)})
 it('pending blocks capacity while keeping standing direction and totals',()=>{const s=sample();s.pairs[0].pending=true;s.pairs[0].availableMinor=0;expect(validateContraSnapshot(s,'trip','david')).toBe(s);expect(contraTotals(s,'david')).toEqual({pay:0n,collect:78840n,known:true})})
})
