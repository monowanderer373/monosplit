import{test,expect}from'@playwright/test'
import{mkdir}from'node:fs/promises'
import{setupCreator,tripLedgerId}from'./fixtures/creatorSettlement'
import{tripLedgerExpense}from'../src/test/tripLedgerFixtures'
const root=(page:import('@playwright/test').Page)=>page.getByTestId('trip-creator-settlement')
async function hanoi(page:import('@playwright/test').Page){
 const s=await setupCreator(page);Object.assign(s.names,{owner:'David',alex:'Chong Pei Syiun',mia:'Kian Leong Liow',sam:'Yii Lii Duan'});
 s.ledger.expenses=[['alex',2347880,2286],['mia',2347880,8339],['sam',1346350,6138]].flatMap(([id,forward,reverse],index)=>[
  tripLedgerExpense('00000000-0000-4000-8000-'+String(880000+index*2).padStart(12,'0'),'Synthetic forward',[[String(id),0,Number(forward)],['owner',Number(forward),0]],'VND'),
  tripLedgerExpense('00000000-0000-4000-8000-'+String(880001+index*2).padStart(12,'0'),'Synthetic reverse',[[String(id),Number(reverse),0],['owner',0,Number(reverse)]],'MYR')])
 await page.route('**/rest/v1/space_members?*',async r=>{if(new URL(r.request().url()).searchParams.get('select')?.includes('spaces('))return r.fallback();return r.fulfill({json:Object.entries(s.names).map(([id,name])=>({space_id:tripLedgerId,participant_id:id,role:id==='owner'?'owner':'view',joined_at:'2026-11-10',removed_at:null,participants:{id,kind:'account',display_name:name,auth_user_id:id}}))})})
 return s
}
for(const width of[320,390,430])test('Hanoi net is shared by overview, chooser and name detail '+width,async({page})=>{
 const s=await hanoi(page);await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme:'dark'});await page.goto('/space/'+tripLedgerId+'?tab=balances');
 await expect(page.getByTestId('pair-totals')).toContainText('RM 0.00');await expect(page.getByTestId('pair-totals')).toContainText('RM 788.40');
 const list=page.locator('.fx-pair-list');for(const value of['348.64','288.11','151.65'])await expect(list).toContainText(value);
 const revision=await list.getAttribute('data-contra-revision');await page.getByRole('button',{name:'Chong Pei Syiun',exact:true}).click();
 await expect(root(page).getByTestId('contra-pair-detail')).toHaveAttribute('data-contra-revision',revision!);await expect(root(page).getByTestId('contra-pair-detail')).toContainText('RM 22.86');await expect(root(page).getByTestId('contra-pair-detail')).toContainText('RM 348.64');
 await expect.poll(async()=>(await root(page).boundingBox())?.x).toBe(0);const box=await root(page).boundingBox();expect(box?.x).toBe(0);expect(box?.y).toBe(0);expect(box?.width).toBe(width);expect(box?.height).toBe(844);expect(await root(page).evaluate(n=>n.scrollWidth)).toBeLessThanOrEqual(width);
 await mkdir('test-results/trip-contra',{recursive:true});await page.screenshot({path:'test-results/trip-contra/hanoi-detail-'+width+'.png'});
 await root(page).getByRole('button',{name:'Record a repayment',exact:true}).click();await expect(root(page).getByRole('button',{name:'Payer 1: Chong Pei Syiun',exact:true})).toBeVisible();await expect(root(page).getByRole('button',{name:'Recipient 1: David',exact:true})).toBeVisible();await expect(root(page).getByRole('textbox',{name:'Actual amount paid 1',exact:true})).toHaveValue('');expect(s.calls.filter(c=>/preview_|record_/.test(c.rpc))).toHaveLength(0);
 await root(page).getByRole('button',{name:'Back to Settle up',exact:true}).click();const choices=root(page).locator('.tt-c-choices');await expect(choices).toHaveAttribute('data-contra-revision',revision!);await expect(choices).toContainText('RM 348.64');await expect(choices.getByRole('heading',{name:'Owed to David',exact:true})).toBeVisible();await expect(choices.getByRole('button',{name:/David/})).toHaveCount(0);await page.screenshot({path:'test-results/trip-contra/hanoi-choices-'+width+'.png'});
})
test('a snapshot read failure blocks new posting and never reports verified zero',async({page})=>{await setupCreator(page);await page.route('**/rpc/read_trip_contra_snapshot',r=>r.fulfill({status:503,json:{message:'Synthetic unavailable'}}));await page.goto('/space/'+tripLedgerId+'?tab=balances');await expect(page.getByTestId('pair-totals')).toContainText('Estimate unavailable');await page.getByTestId('creator-entry').click();await root(page).getByRole('button',{name:'Choose payer and recipient',exact:true}).click();await expect(root(page).getByRole('button',{name:'Preview payment paths',exact:true})).toBeDisabled();await expect(root(page)).toContainText('Net balances could not be verified')})
test('ordinary viewer may inspect their pair but cannot record for members',async({page})=>{const s=await hanoi(page);s.canRecord=false;s.isCreator=false;await page.goto('/space/'+tripLedgerId+'?tab=balances');await page.getByRole('button',{name:'Chong Pei Syiun',exact:true}).click();await expect(root(page).getByTestId('contra-pair-detail')).toBeVisible();await expect(root(page).getByRole('button',{name:'Record a repayment',exact:true})).toHaveCount(0);expect(s.calls.filter(c=>c.rpc.startsWith('record_'))).toHaveLength(0)})
