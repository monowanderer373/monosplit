import { execFileSync } from 'node:child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  devices,
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test'

const LOCAL_API_URL = 'http://127.0.0.1:54321'
const APP_ORIGIN = 'http://127.0.0.1:5173'
let adminClient: SupabaseClient | null = null

export const MOBILE_CONTEXT_OPTIONS: BrowserContextOptions = {
  ...devices['Pixel 7'],
  permissions: ['clipboard-read', 'clipboard-write'],
  locale: 'en-MY',
  timezoneId: 'Asia/Kuala_Lumpur',
}

export type FixtureAccount = {
  email: string
  password: string
  displayName: string
  userId: string
}

export type AuthenticatedBrowser = {
  context: BrowserContext
  page: Page
}

function parseEnvValue(output: string, name: string): string | undefined {
  const match = output.match(new RegExp(`^${name}="([^"]+)"$`, 'm'))
  return match?.[1]
}

function localAdminClient(): SupabaseClient {
  if (adminClient) return adminClient
  const configuredUrl = process.env.SUPABASE_URL ?? process.env.API_URL
  const configuredKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY

  if (configuredUrl && configuredKey) {
    if (!configuredUrl.startsWith('http://127.0.0.1:') && !configuredUrl.startsWith('http://localhost:')) {
      throw new Error('Multi-user E2E fixtures only accept a local Supabase URL.')
    }
    adminClient = createClient(configuredUrl, configuredKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    return adminClient
  }

  let statusOutput = ''
  try {
    const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npx'
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx supabase status -o env']
      : ['supabase', 'status', '-o', 'env']
    statusOutput = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    throw new Error('Start the local Supabase stack before running multi-user E2E tests.')
  }

  const apiUrl = parseEnvValue(statusOutput, 'API_URL')
  const serviceRoleKey = parseEnvValue(statusOutput, 'SERVICE_ROLE_KEY')
  if (!apiUrl || !serviceRoleKey || apiUrl !== LOCAL_API_URL) {
    throw new Error('Could not resolve local Supabase fixture credentials.')
  }

  adminClient = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}

export async function createConfirmedAccount(
  label: string,
  displayName: string,
  runId: string,
): Promise<FixtureAccount> {
  const admin = localAdminClient()
  const email = `${label}-${runId}@example.test`
  const password = `Local-${runId}-Pass9`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  })
  if (error || !data.user) {
    throw new Error(`Could not create local fixture account ${label}: ${error?.message ?? 'unknown error'}`)
  }
  return { email, password, displayName, userId: data.user.id }
}

export async function signIn(
  page: Page,
  account: Pick<FixtureAccount, 'email' | 'password' | 'displayName'>,
  redirect = '/',
): Promise<void> {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(new RegExp(`${redirect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  await expect(page.getByText(`Hello, ${account.displayName}.`)).toBeVisible()
}

export async function openAuthenticatedBrowser(
  browser: Browser,
  account: FixtureAccount,
): Promise<AuthenticatedBrowser> {
  const context = await browser.newContext(MOBILE_CONTEXT_OPTIONS)
  const page = await context.newPage()
  await signIn(page, account)
  return { context, page }
}

export async function waitForSpaceRole(
  account: FixtureAccount,
  spaceId: string,
  expectedRole: 'owner' | 'full_access' | 'view',
): Promise<void> {
  const client = createClient(LOCAL_API_URL, localAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  })
  if (signInError) {
    throw new Error(`Could not open local role observer: ${signInError.message}`)
  }

  try {
    const { data: participantId, error: participantError } = await client.rpc('current_participant_id')
    if (participantError || typeof participantId !== 'string') {
      throw new Error(`Could not resolve local participant: ${participantError?.message ?? 'missing participant'}`)
    }
    await expect.poll(async () => {
      const { data, error } = await client
        .from('space_members')
        .select('role')
        .eq('space_id', spaceId)
        .eq('participant_id', participantId)
        .is('removed_at', null)
        .maybeSingle()
      if (error) throw new Error(`Could not observe local role: ${error.message}`)
      return data?.role
    }, { message: `Wait for ${expectedRole} role to be visible to the member session` })
      .toBe(expectedRole)
  } finally {
    await client.auth.signOut()
  }
}

function localAnonKey(): string {
  const configuredKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY
  if (configuredKey) return configuredKey

  let statusOutput = ''
  try {
    const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npx'
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx supabase status -o env']
      : ['supabase', 'status', '-o', 'env']
    statusOutput = execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    throw new Error('Start the local Supabase stack before running role observers.')
  }

  const anonKey = parseEnvValue(statusOutput, 'ANON_KEY')
  if (!anonKey) throw new Error('Could not resolve the local Supabase anonymous key.')
  return anonKey
}

export async function copyInviteUrl(page: Page): Promise<string> {
  const url = await page.evaluate(() => navigator.clipboard.readText())
  if (!url.startsWith(`${APP_ORIGIN}/`)) {
    throw new Error('The local invite URL was not copied.')
  }
  return url
}

export async function acceptSpaceInvite(page: Page, inviteUrl: string): Promise<void> {
  await page.goto(inviteUrl)
  await page.getByRole('button', { name: 'Join space' }).click()
  await expect(page).toHaveURL(/\/space\/[0-9a-f-]+$/)
}

export async function createSpaceInvite(
  ownerPage: Page,
  role: 'full_access' | 'view',
): Promise<string> {
  const previousUrl = await ownerPage.evaluate(() => navigator.clipboard.readText())
  await ownerPage.getByLabel('Invite access').selectOption(role)
  await ownerPage.getByRole('button', { name: 'Copy secure invite' }).click()
  await expect(ownerPage.getByText('Invite copied · expires in 7 days')).toBeVisible()
  await expect.poll(
    () => ownerPage.evaluate(() => navigator.clipboard.readText()),
    { message: 'Wait for a newly generated local invite URL' },
  ).not.toBe(previousUrl)
  return copyInviteUrl(ownerPage)
}

export async function closeBrowsers(
  browsers: Array<AuthenticatedBrowser | undefined>,
): Promise<void> {
  await Promise.all(browsers.flatMap((entry) => entry ? [entry.context.close()] : []))
}
