import {describe,it,expect} from 'vitest'
import {orderedRepayments} from './orderedRepayments'
import type {ContraSnapshot} from './tripContra'
import type {CreatorRow} from '../components/CreatorRepaymentForm'
const snapshot={quote:{numerator:'1',denominator:'1'},pairs:[['p','l',100],['e','l',100],['l','d',100],['p','d',100],['e','d',100]].map(([payer,recipient,availableMinor])=>({payer,recipient,availableMinor,currentMembers:true}))}as unknown as ContraSnapshot
const row=(id:string,payer:string,amount:string,viaAmount=''):CreatorRow=>({id,payer,recipient:'d',amount,via:'l',viaAmount,currency:'VND',method:'cash'})
describe('ordered repayment drafts',()=>{
 it('shares the downstream edge in entry order, independent of random ids',()=>{const p=orderedRepayments(snapshot,[row('z','p','70'),row('a','e','50')]);expect(p.valid).toBe(true);expect(p.results.map(r=>[r.via,r.direct])).toEqual([[70,0],[30,20]])})
 it('recomputes automatic values after earlier manual edits',()=>{const p=orderedRepayments(snapshot,[row('z','p','70','60'),row('a','e','50')]);expect(p.results.map(r=>[r.via,r.direct])).toEqual([[60,10],[40,10]])})
 it('preserves conflicting manual input and names its row without applying a partial draft',()=>{const rows=[row('z','p','70','60'),row('a','e','50','45')];const p=orderedRepayments(snapshot,rows);expect(p.valid).toBe(false);expect(p.results[1].error).toContain('Via');expect(rows[1].viaAmount).toBe('45');expect(p.left.get('l:d')).toBe(100)})
 it('allows explicit zero and rejects reverse/overpayments',()=>{expect(orderedRepayments(snapshot,[row('z','p','70','0')]).results[0].direct).toBe(70);expect(orderedRepayments(snapshot,[{...row('z','d','1'),recipient:'p',via:''}]).valid).toBe(false)})
 it('converts a manually entered MYR via amount using the frozen native quote',()=>{const valued={...snapshot,quote:{...snapshot.quote,numerator:'6000',denominator:'1'},pairs:snapshot.pairs.map(p=>({...p,availableMinor:600000}))};const p=orderedRepayments(valued,[{...row('z','p','420000','60'),viaCurrency:'MYR'},row('a','e','300000')]);expect(p.valid).toBe(true);expect(p.results.map(r=>[r.via,r.direct])).toEqual([[360000,60000],[240000,60000]])})
 it('blocks MYR tender when the authoritative quote is unavailable',()=>{const p=orderedRepayments({...snapshot,quote:{...snapshot.quote,numerator:null}},[{...row('z','p','1'),currency:'MYR'}]);expect(p.valid).toBe(false);expect(p.results[0].error).toContain('rate unavailable')})
 it('accepts explicit MYR zero without inventing an intermediary allocation',()=>{const valued={...snapshot,quote:{...snapshot.quote,numerator:'6000'},pairs:snapshot.pairs.map(p=>({...p,availableMinor:600000}))};const p=orderedRepayments(valued,[{...row('z','p','70000','0.00'),viaCurrency:'MYR'}]);expect(p.valid).toBe(true);expect(p.results[0].via).toBe(0);expect(p.results[0].direct).toBe(70000)})
})
