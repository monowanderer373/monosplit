import{randomUUID}from'node:crypto'
import{chooseTripEndpoint,chooseTripRange,openTripDates}from'./fixtures/tripDates'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'
import { createConfirmedAccount, openAuthenticatedBrowser, signIn, MOBILE_CONTEXT_OPTIONS, type FixtureAccount } from './fixtures/localSupabase'
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function clientFor(account: FixtureAccount) {
 const client = createClient('http://127.0.0.1:54321', anon, { auth: { persistSession: false, autoRefreshToken: false } })
 const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password }); if (error) throw error
 return client
}
async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown>) {
 const { data, error } = await client.rpc(name, args); if (error) throw error; return data
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const offset = (days: number) => new Date(Date.parse(`${today()}T12:00:00Z`) + days * 86400000).toISOString().slice(0,10)
async function readTrip(client: SupabaseClient, id: string) {
 const { data, error } = await client.from('spaces').select('name,start_date,end_date,default_currency,status,version').eq('id', id).single(); if (error) throw error; return data
}
async function capture(page: Page, name: string) {
 await mkdir('test-results/trip-period', { recursive: true })
 await page.screenshot({ path: `test-results/trip-period/${name}.png`, fullPage: true, animations: 'disabled' })
 const geometry = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth,
  fields: [...document.querySelectorAll('.trip-period-dates input,[data-trip-date-trigger],[data-date]')].map(el => { const r=el.getBoundingClientRect(); return { x:r.x,width:r.width,height:r.height } }) }))
 await writeFile(`test-results/trip-period/${name}.json`, JSON.stringify(geometry, null, 2))
 expect(geometry.width).toBeLessThanOrEqual(geometry.viewport + 1)
 for (const field of geometry.fields) { expect(field.x + field.width).toBeLessThanOrEqual(geometry.viewport + 1); expect(field.height).toBeGreaterThanOrEqual(44) }
}
for (const width of [320,360,390,430]) test(`Trip creation, date editing and lifecycle at ${width}px with real RPC`, async ({ browser }, info) => {
 test.setTimeout(120_000)
 const account = await createConfirmedAccount('period', 'Period Tester', `${Date.now()}-${info.parallelIndex}-${width}`)
 const client = await clientFor(account), actor = await openAuthenticatedBrowser(browser, account), page = actor.page
 await page.setViewportSize({ width, height: 844 })
 try {
  await page.goto('/travel/manage?create=1&return=travel')
  await page.getByLabel('Name', { exact: true }).fill('Mountain weekend')
  const create = page.getByRole('button', { name:'Create', exact:true })
  await expect(create).toBeDisabled()
  await page.getByLabel('Start date', { exact:true }).fill(offset(3)); await page.getByLabel('End date', { exact:true }).fill(offset(2))
  await expect(create).toBeDisabled(); await expect(page.getByRole('alert')).toContainText('end date')
  await page.getByLabel('End date', { exact:true }).fill(offset(7)); await expect(create).toBeEnabled()
  await capture(page, `01-create-${width}`); await create.click()
  await expect(page.getByTestId('home-trip-selector')).toHaveText('Mountain weekend'); await expect(page.locator('.tt-status')).toHaveText('Upcoming')
  const { data: list, error } = await client.from('spaces').select('id').eq('name','Mountain weekend'); if(error || !list?.length) throw new Error('missing_trip')
  const id = list[0].id
  expect(await readTrip(client,id)).toMatchObject({ start_date:offset(3),end_date:offset(7),default_currency:'MYR',version:1,status:'active' })
  await page.getByRole('button',{name:'View trip',exact:true}).click()
  await openTripDates(page)
  const editor=page.getByTestId('trip-dates-page')
  await expect(editor.getByRole('button',{name:/^Start/})).toContainText(new Intl.DateTimeFormat('en-MY',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(offset(3)+'T12:00:00Z')))
  await chooseTripRange(page,offset(-3),offset(-1))
  await capture(page,`02-edit-${width}`); await editor.getByRole('button',{name:'Save dates',exact:true}).click()
  await expect(editor).toHaveCount(0); await expect(page.locator('.tt-status')).toHaveText('Ended')
  await capture(page,`03-ended-${width}`)
  expect(await readTrip(client,id)).toMatchObject({ name:'Mountain weekend',start_date:offset(-3),end_date:offset(-1),default_currency:'MYR',version:2,status:'active' })
  // Extending a finished trip immediately restores its current status without archiving its ledger.
  await openTripDates(page)
  await chooseTripEndpoint(page,'End',offset(4)); await editor.getByRole('button',{name:'Save dates',exact:true}).click()
  await expect(page.locator('.tt-status')).toHaveText('In progress')
  await openTripDates(page); await chooseTripEndpoint(page,'End',offset(9)); await editor.getByRole('button',{name:'Trip',exact:true}).click()
  expect((await readTrip(client,id)).end_date).toBe(offset(4)); await expect(page.locator('[data-trip-date-trigger]')).toBeFocused()
  // The existing manage/info page uses the same versioned RPC.
  await page.getByRole('button',{name:'Trip info',exact:true}).click(); await expect(page.getByTestId('space-manage')).toContainText('In progress')
  await page.getByTestId('space-manage').locator('[data-trip-date-trigger]').click(); await editor.getByRole('checkbox',{name:'Dates not decided yet',exact:true}).check(); await editor.getByRole('button',{name:'Save dates',exact:true}).click()
  await expect(page.getByRole('button',{name:'Set trip dates',exact:true})).toBeVisible()
  expect(await readTrip(client,id)).toMatchObject({ start_date:null,end_date:null,version:4 })
  await page.goto(`/travel/trip/${id}`); await expect(page.locator('.tt-status')).toHaveText('Dates not set')
  await page.getByRole('button',{name:'Set trip dates',exact:true}).click(); await chooseTripRange(page,offset(-1),today()); await editor.getByRole('button',{name:'Save dates',exact:true}).click()
  await expect(page.locator('.tt-status')).toHaveText('In progress') // End date is inclusive.
  if(width===390) {
   await openTripDates(page)
   await page.addStyleTag({content:'html { font-size:200% !important; }'})
   const start=await editor.getByRole('button',{name:/^Start/}).boundingBox(), end=await editor.getByRole('button',{name:/^End/}).boundingBox()
   expect(end!.y).toBeGreaterThan(start!.y + start!.height)
   expect(await editor.getByRole('checkbox',{name:'Dates not decided yet',exact:true}).evaluate(el=>getComputedStyle(el).appearance)).not.toBe('none')
   await capture(page,'04-text-200-percent-390')
   await editor.getByRole('button',{name:'Trip',exact:true}).click()
   await page.goto('/profile'); await page.getByRole('button',{name:'Language',exact:false}).click(); await page.getByRole('button',{name:'简体中文',exact:true}).click(); await page.goto(`/travel/trip/${id}`)
   await expect(page.getByRole('button',{name:/^修改旅行日期/})).toBeVisible()
  }
  const {count,error:expensesError}=await client.from('expenses').select('id',{count:'exact',head:true}).eq('space_id',id)
  if(expensesError) throw expensesError; expect(count).toBe(0)
 } finally { await actor.context.close(); await client.auth.signOut() }
})
test('viewers cannot edit periods, while existing full-access members can', async ({browser},info) => {
 test.setTimeout(120_000)
 const run=`${Date.now()}-${info.parallelIndex}-roles`
 const owner=await createConfirmedAccount('period-owner','Owner',run), full=await createConfirmedAccount('period-full','Full',run), viewer=await createConfirmedAccount('period-view','Viewer',run)
 const ownerClient=await clientFor(owner), fullClient=await clientFor(full), viewClient=await clientFor(viewer)
 const id=await rpc(ownerClient,'create_space',{space_type:'trip',space_name:'Permission trip',start_date:offset(-2),end_date:today(),default_currency:'VND'})
 for(const [client,role] of [[fullClient,'full_access'],[viewClient,'view']] as const) {
  const token=await rpc(ownerClient,'create_space_invite',{target_space_id:id,invite_role:role}); await rpc(client,'accept_space_invite',{raw_token:token})
 }
 const v=await openAuthenticatedBrowser(browser,viewer), foreign=await browser.newContext({...MOBILE_CONTEXT_OPTIONS,timezoneId:'Pacific/Honolulu'}), f={context:foreign,page:await foreign.newPage()};await signIn(f.page,full)
 try {
  await v.page.goto(`/travel/trip/${id}`); await expect(v.page.getByRole('heading',{name:'Permission trip'})).toBeVisible(); await expect(v.page.locator('[data-trip-date-trigger]')).toHaveCount(0)
  await v.page.goto(`/space/${id}?section=info`); await expect(v.page.getByTestId('space-manage')).toContainText('In progress'); await expect(v.page.locator('[data-trip-date-trigger]')).toHaveCount(0)
  await v.page.goto(`/travel/trip/${id}/dates`);await expect(v.page.getByRole('heading',{name:'Trip dates are unavailable',exact:true})).toBeVisible();await expect(v.page.getByRole('button',{name:'Save dates',exact:true})).toHaveCount(0)
  const denied=await viewClient.rpc('update_space',{target_space_id:id,space_name:'Permission trip',start_date:offset(-2),end_date:offset(2),default_currency:'VND',expected_version:1})
  expect(denied.error).not.toBeNull(); expect((await readTrip(ownerClient,id)).version).toBe(1)
  await f.page.goto(`/travel/trip/${id}`); await openTripDates(f.page)
  const editor=f.page.getByTestId('trip-dates-page'); await chooseTripEndpoint(f.page,'End',offset(-1)); await editor.getByRole('button',{name:'Save dates',exact:true}).click(); await expect(f.page.locator('.tt-status')).toHaveText('Ended')
  expect(await readTrip(ownerClient,id)).toMatchObject({version:2,end_date:offset(-1),default_currency:'VND',status:'active'})
 } finally { await v.context.close(); await f.context.close(); await Promise.all([ownerClient,fullClient,viewClient].map(client=>client.auth.signOut())) }
})

async function financialFacts(client:SupabaseClient){const facts:Record<string,string[]>={};for(const table of['expenses','expense_participations','expense_shares','payer_contributions','settlement_payments','settlement_allocations','personal_account_entries','personal_account_transactions','personal_money_movements','personal_funding_bundle_legs']){const{data,error}=await client.from(table).select('*');if(error)throw error;facts[table]=data.map(row=>JSON.stringify(row)).sort()}return facts}
test('two-user date conflict retains drafts and immutable expense, accepted settlement and cash history',async({browser},info)=>{
 test.setTimeout(180000);const run=Date.now()+'-'+info.parallelIndex+'-date-conflict',owner=await createConfirmedAccount('date-owner','Dates owner',run),member=await createConfirmedAccount('date-editor','Dates editor',run),a=await clientFor(owner),b=await clientFor(member),aid=await rpc(a,'current_participant_id',{}),bid=await rpc(b,'current_participant_id',{});const id=await rpc(a,'create_space',{space_type:'trip',space_name:'Protected date history',start_date:offset(-2),end_date:offset(2),default_currency:'MYR'});const token=await rpc(a,'create_space_invite',{target_space_id:id,invite_role:'full_access'});await rpc(b,'accept_space_invite',{raw_token:token});
 await rpc(a,'create_expense',{request_id:randomUUID(),expense_scope:'space',target_space_id:id,total_minor:1000,currency_code:'MYR',description:'Date history purchase',category:'Food',occurred_on:offset(-20),participant_ids:[aid,bid],contribution_amounts:[1000,0],share_amounts:[500,500]});const payment=await rpc(b,'propose_settlement',{request_id:randomUUID(),settlement_scope:'space',target_space_id:id,currency_code:'MYR',total_amount_minor:200,payment_date:today(),creditor_ids:[aid],allocation_amounts:[200],settlement_note:'Original accepted date history',overpay_disposition:null,expected_outstanding_minor:500,selected_expense_ids:null,attribution_amounts:null,source_payment_request_id:null});const{data:allocation,error}=await a.from('settlement_allocations').select('id').eq('settlement_payment_id',payment).single();if(error)throw error;
 const account=async(client:SupabaseClient,name:string)=>(await rpc(client,'create_personal_account',{request_id:randomUUID(),account_name:name,account_type:'bank',currency_code:'MYR',opening_balance_minor:10000,balance_as_of:today(),make_default:false})).account_id;const payer=await account(b,'Date payer'),receiver=await account(a,'Date receiver');await rpc(b,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:allocation!.id,cash_role:'payer',target_account_id:payer,supplied_cash_amount_minor:200});await rpc(a,'authorize_personal_settlement_cash_leg',{request_id:randomUUID(),target_allocation_id:allocation!.id,cash_role:'receiver',target_account_id:receiver,supplied_cash_amount_minor:200});await rpc(a,'respond_to_settlement',{target_allocation_id:allocation!.id,response:'accepted',expected_payment_version:1});
 const beforeA=await financialFacts(a),beforeB=await financialFacts(b),actor=await openAuthenticatedBrowser(browser,owner);let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});let arrive!:()=>void;const arrived=new Promise<void>(resolve=>{arrive=resolve});
 try{await actor.page.goto('/travel/trip/'+id);await expect(actor.page.getByText('Date history purchase',{exact:true})).toBeVisible();await openTripDates(actor.page);await chooseTripEndpoint(actor.page,'End',offset(7));await actor.page.route('**/rest/v1/rpc/update_space',async route=>{arrive();await gate;await route.continue()});await actor.page.getByRole('button',{name:'Save dates',exact:true}).click();await arrived;await rpc(b,'update_space',{target_space_id:id,space_name:'Protected date history',start_date:offset(-2),end_date:offset(5),default_currency:'MYR',expected_version:1});release();await expect(actor.page.getByRole('alert')).toContainText('Your selection is kept');expect((await readTrip(a,id)).version).toBe(2);await expect(actor.page.getByRole('button',{name:/^End/})).toContainText(new Intl.DateTimeFormat('en-MY',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(offset(7)+'T12:00:00Z')));await actor.page.unroute('**/rest/v1/rpc/update_space');await actor.page.getByRole('button',{name:'Load latest dates',exact:true}).click();await expect(actor.page.getByRole('button',{name:'Save dates',exact:true})).toBeDisabled();await chooseTripEndpoint(actor.page,'End',offset(9));await actor.page.getByRole('button',{name:'Save dates',exact:true}).click();await expect(actor.page).toHaveURL(new RegExp('/travel/trip/'+id+'$'));expect(await readTrip(a,id)).toMatchObject({name:'Protected date history',default_currency:'MYR',status:'active',version:3,end_date:offset(9)});expect(await financialFacts(a)).toEqual(beforeA);expect(await financialFacts(b)).toEqual(beforeB);await expect(actor.page.getByText('Date history purchase',{exact:true})).toBeVisible();await actor.page.goto('/shared?tab=trips');await expect(actor.page.getByRole('button',{name:/Protected date history/})).toBeVisible();
 }finally{release();await actor.context.close();await a.auth.signOut();await b.auth.signOut()}
})
