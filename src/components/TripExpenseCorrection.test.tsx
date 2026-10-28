// @vitest-environment jsdom
import {render,screen,fireEvent,waitFor,cleanup}from'@testing-library/react'
import {afterEach,expect,it,vi}from'vitest'
import ExpenseActionSheet from'./ExpenseActionSheet'
import type{CanonicalExpense}from'../types'
const mocks=vi.hoisted(()=>({correct:vi.fn().mockResolvedValue({}),members:{status:'ready',refresh:vi.fn(),data:{entry:{space:{id:'trip',name:'Trip',type:'trip',status:'active'},role:'owner'},members:['a','b','c'].map(id=>({participant:{id,displayName:id,kind:'account'},member:{participantId:id,removedAt:null,role:'full_access'}}))}}}))
vi.mock('../hooks/useTripMembership',()=>({useTripMembership:()=>mocks.members}))
vi.mock('../lib/expenseChangeRepository',()=>({expenseChangeRepository:{correctSpaceExpense:mocks.correct}}))
vi.mock('../lib/ledgerRepository',()=>({ledgerRepository:{}}))
const expense={id:'old',version:1,scope:'space',spaceId:'trip',createdBy:'b',status:'active',currency:'MYR',totalMinor:100000,description:'Trip Dinner',category:'Food',occurredOn:'2026-10-28',participantCount:2,correctsExpenseId:null,participations:['b','a'].map((id,order)=>({id,participantId:id,expenseId:'old',nameSnapshot:id,order,state:'accepted',trackingMode:'tracked'})),payerContributions:[{expenseId:'old',expenseParticipationId:'b',amountMinor:100000},{expenseId:'old',expenseParticipationId:'a',amountMinor:0}],shares:[{expenseId:'old',expenseParticipationId:'b',amountMinor:0},{expenseId:'old',expenseParticipationId:'a',amountMinor:100000}]}as CanonicalExpense
afterEach(()=>{cleanup();mocks.correct.mockClear()})
it('preserves original values until explicitly applied and saves new candidates only through Space correction',async()=>{
 render(<ExpenseActionSheet expense={expense} currentParticipantId="a" spaceRole="owner" onRefresh={async()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Edit Trip Dinner'}));expect((screen.getByRole('button',{name:'Save changes'})as HTMLButtonElement).disabled).toBe(true)
 fireEvent.click(screen.getByRole('button',{name:'Split details'}));expect((screen.getByRole('checkbox',{name:'b'})as HTMLInputElement).checked).toBe(false);expect((screen.getByRole('checkbox',{name:'c'})as HTMLInputElement).checked).toBe(false);fireEvent.click(screen.getByRole('checkbox',{name:'c'}));fireEvent.click(screen.getByRole('button',{name:'Equally'}));fireEvent.click(screen.getByRole('button',{name:'Apply split'}));expect(mocks.correct).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(mocks.correct).toHaveBeenCalledOnce());expect(mocks.correct.mock.calls[0][0]).toMatchObject({targetExpenseId:'old',expectedVersion:1,replacement:{participantIds:['b','a','c'],contributionAmounts:[100000,0,0],shareAmounts:[0,50000,50000]}})
})
