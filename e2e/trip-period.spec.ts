import { mkdir, writeFile } from 'node:fs/promises'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'
import { createConfirmedAccount, openAuthenticatedBrowser, type FixtureAccount } from './fixtures/localSupabase'
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
  fields: [...document.querySelectorAll('.trip-period-dates input,.trip-period-entry')].map(el => { const r=el.getBoundingClientRect(); return { x:r.x,width:r.width,height:r.height } }) }))
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
  await page.getByRole('button',{name:'Edit trip dates',exact:true}).click()
  const editor=page.getByRole('region',{name:'Edit trip dates',exact:true})
  await expect(editor.getByLabel('Start date',{exact:true})).toHaveValue(offset(3))
  await editor.getByLabel('Start date',{exact:true}).fill(offset(-3)); await editor.getByLabel('End date',{exact:true}).fill(offset(-1))
  await capture(page,`02-edit-${width}`); await editor.getByRole('button',{name:'Save dates',exact:true}).click()
  await expect(editor).toHaveCount(0); await expect(page.locator('.tt-status')).toHaveText('Ended')
  await capture(page,`03-ended-${width}`)
  expect(await readTrip(client,id)).toMatchObject({ name:'Mountain weekend',start_date:offset(-3),end_date:offset(-1),default_currency:'MYR',version:2,status:'active' })
  // Extending a finished trip immediately restores its current status without archiving its ledger.
  await page.getByRole('button',{name:'Edit trip dates',exact:true}).click()
  await editor.getByLabel('End date',{exact:true}).fill(offset(4)); await editor.getByRole('button',{name:'Save dates',exact:true}).click()
  await expect(page.locator('.tt-status')).toHaveText('In progress')
  await page.getByRole('button',{name:'Edit trip dates',exact:true}).click(); await editor.getByLabel('End date',{exact:true}).fill(offset(9)); await editor.getByRole('button',{name:'Cancel',exact:true}).click()
  expect((await readTrip(client,id)).end_date).toBe(offset(4)); await expect(page.getByRole('button',{name:'Edit trip dates',exact:true})).toBeFocused()
  // The existing manage/info page uses the same versioned RPC.
  await page.getByRole('button',{name:'Trip info',exact:true}).click(); await expect(page.getByTestId('space-manage')).toContainText('In progress')
  await page.getByRole('button',{name:'Edit trip dates',exact:true}).click(); await editor.getByRole('checkbox',{name:'Dates not decided yet',exact:true}).check(); await editor.getByRole('button',{name:'Save dates',exact:true}).click()
  await expect(page.getByRole('button',{name:'Set trip dates',exact:true})).toBeVisible()
  expect(await readTrip(client,id)).toMatchObject({ start_date:null,end_date:null,version:4 })
  await page.goto(`/travel/trip/${id}`); await expect(page.locator('.tt-status')).toHaveText('Dates not set')
  await page.getByRole('button',{name:'Set trip dates',exact:true}).click(); await editor.getByLabel('Start date',{exact:true}).fill(offset(-1)); await editor.getByLabel('End date',{exact:true}).fill(today()); await editor.getByRole('button',{name:'Save dates',exact:true}).click()
  await expect(page.locator('.tt-status')).toHaveText('In progress') // End date is inclusive.
  if(width===390) {
   await page.getByRole('button',{name:'Edit trip dates',exact:true}).click()
   await page.addStyleTag({content:'html { font-size:200% !important; }'})
   await capture(page,'04-text-200-percent-390')
   await editor.getByRole('button',{name:'Cancel',exact:true}).click()
   await page.goto('/profile'); await page.getByRole('button',{name:'简中',exact:true}).click(); await page.goto(`/travel/trip/${id}`)
   await expect(page.getByRole('button',{name:'修改旅行日期',exact:true})).toBeVisible()
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
 const v=await openAuthenticatedBrowser(browser,viewer), f=await openAuthenticatedBrowser(browser,full)
 try {
  await v.page.goto(`/travel/trip/${id}`); await expect(v.page.getByRole('heading',{name:'Permission trip'})).toBeVisible(); await expect(v.page.getByRole('button',{name:'Edit trip dates'})).toHaveCount(0)
  await v.page.goto(`/space/${id}?section=info`); await expect(v.page.getByTestId('space-manage')).toContainText('In progress'); await expect(v.page.getByRole('button',{name:'Edit trip dates'})).toHaveCount(0)
  const denied=await viewClient.rpc('update_space',{target_space_id:id,space_name:'Permission trip',start_date:offset(-2),end_date:offset(2),default_currency:'VND',expected_version:1})
  expect(denied.error).not.toBeNull(); expect((await readTrip(ownerClient,id)).version).toBe(1)
  await f.page.goto(`/travel/trip/${id}`); await f.page.getByRole('button',{name:'Edit trip dates',exact:true}).click()
  const editor=f.page.getByRole('region',{name:'Edit trip dates',exact:true}); await editor.getByLabel('End date',{exact:true}).fill(offset(-1)); await editor.getByRole('button',{name:'Save dates',exact:true}).click(); await expect(f.page.locator('.tt-status')).toHaveText('Ended')
  expect(await readTrip(ownerClient,id)).toMatchObject({version:2,end_date:offset(-1),default_currency:'VND',status:'active'})
 } finally { await v.context.close(); await f.context.close(); await Promise.all([ownerClient,fullClient,viewClient].map(client=>client.auth.signOut())) }
})
