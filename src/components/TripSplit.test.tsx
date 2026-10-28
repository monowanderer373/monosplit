// @vitest-environment jsdom
import {useState}from'react'
import {render,screen,fireEvent,cleanup}from'@testing-library/react'
import {afterEach,expect,it,vi}from'vitest'
import {SplitConfiguration,type SplitValues}from'./SplitConfiguration'
const people=[{id:'a',displayName:'Alpha'},{id:'b',displayName:'Beta'},{id:'c',displayName:'Gamma'}]
afterEach(cleanup)
function Harness({initial={}}:{initial?:Partial<SplitValues>}){const[values,set]=useState<SplitValues>({amount:'1000',currency:'MYR',selectedParticipantIds:['a'],splitMode:'equal',exactShareAmounts:{},payerAmounts:{a:'600',c:'400'},detailsExpanded:false,...initial});return <><SplitConfiguration trip compact values={values} participants={people} currentParticipantId="a" label="Trip" zh={false} onUpdate={patch=>set({...values,...patch})} onApply={()=>{}}/><output data-testid="draft">{JSON.stringify(values)}</output></>}
it('lets the recorder consume zero without dropping an independent payment or payer-only member',()=>{
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Select all'}));fireEvent.click(screen.getByRole('checkbox',{name:'You'}));fireEvent.click(screen.getByRole('button',{name:'Change consumers'}));expect(JSON.parse(screen.getByTestId('draft').textContent!)).toMatchObject({selectedParticipantIds:['b','c'],payerAmounts:{a:'600',c:'400'}})
 fireEvent.click(screen.getByRole('button',{name:'Payment amounts'}));expect(screen.getByRole('textbox',{name:'Paid by Alpha'})).toBeTruthy();expect(screen.getByRole('textbox',{name:'Paid by Gamma'})).toBeTruthy()
})
it('keeps explicit amounts/items for review and prevents Apply with no consumers',()=>{
 render(<Harness initial={{splitMode:'exact',exactShareAmounts:{a:'1000'},items:[{id:'item',name:'Food',amount:'1000',participantIds:['a']}]}}/>);fireEvent.click(screen.getByRole('checkbox',{name:'You'}));expect(screen.getByRole('checkbox',{name:'You'}).getAttribute('checked')).not.toBeNull();fireEvent.click(screen.getByRole('button',{name:'Change consumers'}));const values=JSON.parse(screen.getByTestId('draft').textContent!);expect(values.selectedParticipantIds).toEqual([]);expect(values.exactShareAmounts).toEqual({a:'1000'});expect(values.items[0].participantIds).toEqual(['a']);expect((screen.getByRole('button',{name:'Apply split'})as HTMLButtonElement).disabled).toBe(true)
})
it('uses the original selected-member restriction outside Trip',()=>{
 const onUpdate=vi.fn();render(<SplitConfiguration values={{amount:'10',currency:'MYR',selectedParticipantIds:['a','b'],splitMode:'equal',payerAmounts:{a:'10'},exactShareAmounts:{},detailsExpanded:false}} participants={people} currentParticipantId="a" label="Group" zh={false} onUpdate={onUpdate} onApply={()=>{}}/>);expect((screen.getByRole('checkbox',{name:'You'})as HTMLInputElement).disabled).toBe(true);fireEvent.click(screen.getByRole('checkbox',{name:'Beta'}));expect(onUpdate).toHaveBeenLastCalledWith({selectedParticipantIds:['a'],payerAmounts:{},exactShareAmounts:{},splitMode:'equal'})
})
