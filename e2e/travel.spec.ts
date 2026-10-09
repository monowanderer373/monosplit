import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'
import { createConfirmedAccount, openAuthenticatedBrowser, type FixtureAccount } from './fixtures/localSupabase'
import { enterQuickAmount } from './fixtures/quickAdd'
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
async function clientFor(account: FixtureAccount) {
  const client = createClient('http://127.0.0.1:54321', anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password })
  if (error) throw error
  return client
}
async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}
async function capture(page: Page, name: string) {
  await mkdir('test-results/travel', { recursive: true })
  await page.screenshot({ path: `test-results/travel/${name}.png`, fullPage: true })
  const dimensions = await page.locator('.tt-travel').first().evaluate(root => ({
    viewport: window.innerWidth, scrollWidth: document.documentElement.scrollWidth,
    elements: [...root.querySelectorAll('.tt-summary,.tt-trip-label,.tt-section-head,.tt-view-switch,.home-day,.home-record,.tt-detail-summary,.tt-detail-action,.tt-empty-map,.tt-pocket')].map(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el)
      return { class: el.className, x: r.x, y: r.y, width: r.width, height: r.height, font: s.fontSize, background: s.backgroundColor }
    }),
  }))
  await writeFile(`test-results/travel/${name}.json`, JSON.stringify(dimensions, null, 2))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport + 1)
}
for (const width of [320, 390, 430]) test(`Travel real RPC flows and approved states at ${width}px`, async ({ browser }, info) => {
  test.setTimeout(180_000)
  const account = await createConfirmedAccount('travel', 'Travel Tester', `${Date.now()}-${info.parallelIndex}-${width}`)
  const client = await clientFor(account)
  const current = await rpc(client, 'current_participant_id')
  const actor = await openAuthenticatedBrowser(browser, account), page = actor.page
  await page.setViewportSize({ width, height: 844 })
  try {
    await page.getByRole('button', { name: 'Travel', exact: true }).click()
    await expect(page.getByTestId('travel-first-guide')).toBeVisible()
    await expect(page.getByTestId('travel-spending')).toHaveCount(0)
    await capture(page, `01-no-trip-${width}`)
    await page.getByRole('button', { name: 'Create a trip', exact: true }).click()
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible()
    await page.getByLabel('Name', { exact: true }).fill('Mountain weekend')
    await page.getByLabel('Currency', { exact: true }).fill('VND')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page).toHaveURL('http://127.0.0.1:5173/')
    await expect(page.getByTestId('home-trip-selector')).toHaveText('Mountain weekend')
    await expect(page.getByTestId('travel-empty-records')).toBeVisible()
    await expect(page.getByTestId('travel-spending')).toContainText('0')
    await capture(page, `05-trip-zero-records-${width}`)
    const { data: trips, error } = await client.from('spaces').select('id').eq('name', 'Mountain weekend')
    if (error || !trips?.length) throw new Error('missing_created_trip')
    const id = trips[0].id
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const yesterday = new Date(new Date(`${today}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0,10)
    await rpc(client, 'update_space', { target_space_id: id, space_name: 'Mountain weekend', start_date: yesterday, end_date: today, default_currency: 'VND', expected_version: 1 })
    const guest = await rpc(client, 'add_manual_space_member', { target_space_id: id, display_name: 'Guest' })
    for (const entry of [
      { amount: 180000, description: 'Lunch in town', category: 'Food', date: today },
      { amount: 120000, description: 'Taxi to the hotel', category: 'Transport', date: today },
      { amount: 550000, description: 'Hotel check-in', category: 'Stay', date: yesterday },
    ]) await rpc(client, 'create_expense', { request_id: randomUUID(), expense_scope: 'space', target_space_id: id,
      total_minor: entry.amount, currency_code: 'VND', description: entry.description, category: entry.category, occurred_on: entry.date,
      participant_ids: [current, guest], contribution_amounts: [entry.amount, 0], share_amounts: [entry.amount / 2, entry.amount / 2] })
    await rpc(client, 'create_space', { space_type: 'trip', space_name: 'Coastal weekend', start_date: null, end_date: null, default_currency: 'MYR' })
    await page.reload()
    await expect(page.getByTestId('travel-spending')).toContainText('425,000')
    await expect(page.getByTestId('home-record')).toHaveCount(3)
    await capture(page, `02-has-trip-${width}`)
    await page.getByTestId('home-trip-selector').click()
    const dialog = page.getByRole('dialog', { name: 'Switch trip' })
    await expect(dialog).toBeVisible()
    const anchor = await page.getByTestId('home-trip-selector').boundingBox(), panel = await dialog.boundingBox()
    expect(panel!.y).toBeGreaterThanOrEqual(anchor!.y + anchor!.height)
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width - 15)
    await capture(page, `03-dropdown-${width}`)
    await page.keyboard.press('End'); await page.keyboard.press('Enter')
    await expect(page.getByTestId('home-trip-selector')).toHaveText('Coastal weekend')
    await expect(page.getByTestId('travel-empty-records')).toBeVisible()
    await expect(page.getByTestId('home-record')).toHaveCount(0)
    await page.getByTestId('home-trip-selector').click()
    await page.getByRole('option', { name: /Mountain weekend/ }).click()
    await expect(page.getByTestId('travel-spending')).toContainText('425,000')
    await page.getByRole('button', { name: 'Compact', exact: true }).click()
    await page.getByRole('button', { name: 'View trip', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/travel/trip/${id}$`))
    await expect(page.getByRole('heading', { name: 'Mountain weekend' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0)
    await expect(page.getByTestId('trip-detail-summary')).toContainText('3 records')
    await expect(page.getByTestId('trip-detail-summary')).toContainText('2 people')
    await capture(page, `04-trip-details-${width}`)
    await page.getByRole('button', { name: 'Trip info', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/space/${id}\\?section=info$`))
    await expect(page.getByTestId('space-manage')).toBeInViewport()
    await page.goBack()
    await page.getByRole('button', { name: 'Members', exact: true }).click()
    await expect(page.locator('#trip-members')).toBeInViewport()
    await page.goBack()
    await page.getByRole('button', { name: 'Add expense', exact: true }).click()
    const quick = page.getByRole('dialog', { name: 'Quick Add', exact: true })
    await expect(quick).toBeVisible()
    await expect(quick.getByLabel('Currency', { exact: true })).toHaveValue('VND')
    await enterQuickAmount(quick, '60000')
    await quick.getByRole('button', { name: 'Food', exact: true }).click()
    await quick.getByRole('textbox', { name: 'Description', exact: true }).fill('Trip quick add verification')
    await quick.getByRole('button', { name: 'Save and close', exact: true }).click()
    await expect(quick).toHaveCount(0)
    const { data: saved } = await client.from('expenses').select('space_id').eq('description', 'Trip quick add verification')
    expect(saved?.[0]?.space_id).toBe(id)
    await page.getByRole('button', { name: 'Travel', exact: true }).click()
    await expect(page).toHaveURL('http://127.0.0.1:5173/')
    await expect(page.getByTestId('home-trip-selector')).toHaveText('Mountain weekend')
    await expect(page.getByRole('button', { name: 'Compact', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Overall', exact: true }).click()
    if (width === 390) {
      await page.setViewportSize({ width: 1024, height: 900 })
      await capture(page, 'desktop-1024')
      await page.setViewportSize({ width: 390, height: 844 })
    }
    await rpc(client, 'update_space', { target_space_id: id, space_name: 'A very long travel name with enough text to wrap on small screens', start_date: yesterday, end_date: today, default_currency: 'VND', expected_version: 2 })
    await rpc(client, 'create_expense', { request_id: randomUUID(), expense_scope: 'space', target_space_id: id,
      total_minor: 12345678900, currency_code: 'VND', description: 'A long expense description that remains readable with an unusually long amount', category: 'Other', occurred_on: today,
      participant_ids: [current, guest], contribution_amounts: [12345678900, 0], share_amounts: [6172839450, 6172839450] })
    await page.reload()
    await expect(page.getByTestId('home-trip-selector')).toContainText('A very long travel name')
    await expect(page.getByTestId('travel-spending')).toContainText('6,173,')
    await capture(page, `long-name-and-amount-${width}`)
    await page.locator('.tt-travel').evaluate(root => {
      for (const el of root.querySelectorAll<HTMLElement>('h1,h2,h3,p,button,.tt-status,.home-chip')) {
        const s = getComputedStyle(el), size = parseFloat(s.fontSize), line = parseFloat(s.lineHeight)
        el.dataset.textSize = String(size); el.dataset.lineSize = String(line)
      }
      for (const el of root.querySelectorAll<HTMLElement>('[data-text-size]')) {
        el.style.fontSize = `${Number(el.dataset.textSize) * 2}px`
        el.style.lineHeight = `${Number(el.dataset.lineSize) * 2}px`
      }
    })
    await capture(page, `text-200-percent-${width}`)
  } finally { await actor.context.close() }
})

test('Travel view-only membership and inaccessible deep links use real permissions', async ({ browser }) => {
  test.setTimeout(120_000)
  const run = String(Date.now()), owner = await createConfirmedAccount('travel-owner', 'Owner', run), viewer = await createConfirmedAccount('travel-viewer', 'Viewer', run)
  const client = await clientFor(owner), v = await clientFor(viewer)
  const id = await rpc(client, 'create_space', { space_type: 'trip', space_name: 'Private journey', start_date: null, end_date: null, default_currency: 'MYR' })
  const actor = await openAuthenticatedBrowser(browser, viewer)
  try {
    await actor.page.goto(`/travel/trip/${id}`)
    await expect(actor.page.getByText('This trip is no longer accessible.')).toBeVisible()
    await expect(actor.page.getByText('Private journey')).toHaveCount(0)
    await capture(actor.page, 'no-access')
    const token = await rpc(client, 'create_space_invite', { target_space_id: id, invite_role: 'view' })
    await rpc(v, 'accept_space_invite', { raw_token: token })
    await actor.page.reload()
    await expect(actor.page.getByRole('heading', { name: 'Private journey' })).toBeVisible()
    await expect(actor.page.getByRole('button', { name: 'Add expense', exact: true })).toHaveCount(0)
    await expect(actor.page.getByText('This trip is read-only.')).toBeVisible()
    await capture(actor.page, 'view-only')
  } finally { await actor.context.close() }
})
