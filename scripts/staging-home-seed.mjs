const STAGING_REF = 'czfgglzxiinsyagquhkh'
const PRODUCTION_REF = 'skiqsxvmxvmxfzhrzcxh'

const IDS = {
  tng: '6a100000-0000-4000-8000-000000000001',
  cimb: '6a100000-0000-4000-8000-000000000002',
  coffee: '6a100000-0000-4000-8000-000000000011',
  coffeeFunding: '6a100000-0000-4000-8000-000000000012',
  grab: '6a100000-0000-4000-8000-000000000013',
  grabFunding: '6a100000-0000-4000-8000-000000000014',
  dinner: '6a100000-0000-4000-8000-000000000015',
  dinnerFunding: '6a100000-0000-4000-8000-000000000016',
  train: '6a100000-0000-4000-8000-000000000017',
  trainFunding: '6a100000-0000-4000-8000-000000000018',
  breakfast: '6a100000-0000-4000-8000-000000000019',
  breakfastFunding: '6a100000-0000-4000-8000-00000000001a',
  settlement: '6a100000-0000-4000-8000-000000000021',
  payerCash: '6a100000-0000-4000-8000-000000000022',
  receiverCash: '6a100000-0000-4000-8000-000000000023',
  lanWallet: '6a100000-0000-4000-8000-000000000024',
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is missing`)
  return value
}

function assertStaging() {
  const ref = required('STAGING_PROJECT_REF')
  const url = new URL(required('STAGING_SUPABASE_URL'))
  if (ref !== STAGING_REF || ref === PRODUCTION_REF) throw new Error('staging ref guard failed')
  if (url.hostname !== `${STAGING_REF}.supabase.co`) throw new Error('staging host guard failed')
  if (url.hostname.includes(PRODUCTION_REF)) throw new Error('production host blocked')
  return url.origin
}

async function api(url, options) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body = null
  if (text) {
    try { body = JSON.parse(text) } catch { body = text }
  }
  if (!response.ok) {
    const message = body && typeof body === 'object'
      ? body.message || body.msg || body.error_description || body.error || body.code
      : 'request_failed'
    throw new Error(`${response.status} ${message}`)
  }
  return body
}

function authHeaders(key, token) {
  return {
    apikey: key,
    Authorization: `Bearer ${token ?? key}`,
    'Content-Type': 'application/json',
  }
}

async function ensureUser(origin, serviceKey, email, password, displayName) {
  const created = await fetch(`${origin}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders(serviceKey),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  })
  if (created.status === 422 || created.status === 409) return
  if (!created.ok) {
    const body = await created.json().catch(() => ({}))
    if (String(body.msg ?? body.message ?? body.error_code ?? '').includes('already')) return
    throw new Error(`create_user_${created.status}`)
  }
}

async function signIn(origin, anonKey, email, password) {
  const body = await api(`${origin}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(anonKey),
    body: JSON.stringify({ email, password }),
  })
  if (!body?.access_token) throw new Error('sign_in_failed')
  return body.access_token
}

function client(origin, anonKey, token) {
  return async function rpc(name, args) {
    return api(`${origin}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: authHeaders(anonKey, token),
      body: JSON.stringify(args),
    })
  }
}

async function rows(origin, anonKey, token, path) {
  return api(`${origin}/rest/v1/${path}`, {
    headers: authHeaders(anonKey, token),
  })
}

async function main() {
  const origin = assertStaging()
  const anonKey = required('STAGING_ANON_KEY')
  const serviceKey = required('STAGING_SERVICE_ROLE_KEY')
  if (anonKey === serviceKey) throw new Error('anon and service role must differ')
  const ownerEmail = required('STAGING_OWNER_EMAIL')
  const ownerPassword = required('STAGING_OWNER_PASSWORD')
  const lanEmail = required('STAGING_LAN_EMAIL')
  const lanPassword = required('STAGING_LAN_PASSWORD')

  await ensureUser(origin, serviceKey, ownerEmail, ownerPassword, 'Staging Owner')
  await ensureUser(origin, serviceKey, lanEmail, lanPassword, 'Lan')
  const ownerToken = await signIn(origin, anonKey, ownerEmail, ownerPassword)
  const lanToken = await signIn(origin, anonKey, lanEmail, lanPassword)
  const owner = client(origin, anonKey, ownerToken)
  const lan = client(origin, anonKey, lanToken)
  const ownerId = await owner('current_participant_id', {})
  const lanId = await lan('current_participant_id', {})

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())
  const yesterdayDate = new Date(`${today}T12:00:00+08:00`)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(yesterdayDate)
  const tripDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(
    new Date(yesterdayDate.getTime() - 24 * 60 * 60 * 1000),
  )

  await owner('create_personal_account', {
    request_id: IDS.tng,
    account_name: 'TNG',
    account_type: 'ewallet',
    currency_code: 'MYR',
    opening_balance_minor: 20000,
    balance_as_of: '2026-09-01',
    make_default: true,
  })
  await owner('create_personal_account', {
    request_id: IDS.cimb,
    account_name: 'CIMB',
    account_type: 'bank',
    currency_code: 'MYR',
    opening_balance_minor: 50000,
    balance_as_of: '2026-09-01',
    make_default: false,
  })
  await lan('create_personal_account', {
    request_id: IDS.lanWallet,
    account_name: 'Lan Cash',
    account_type: 'cash',
    currency_code: 'MYR',
    opening_balance_minor: 10000,
    balance_as_of: '2026-09-01',
    make_default: true,
  })

  const accounts = await rows(origin, anonKey, ownerToken, 'personal_accounts?select=id,name')
  const accountId = (name) => {
    const account = accounts.find((row) => row.name === name)
    if (!account) throw new Error('account_missing')
    return account.id
  }
  const lanAccounts = await rows(origin, anonKey, lanToken, 'personal_accounts?select=id,name')
  const lanCash = lanAccounts.find((row) => row.name === 'Lan Cash')
  if (!lanCash) throw new Error('lan_account_missing')

  const friendships = await rows(origin, anonKey, ownerToken, 'friendships?select=id')
  if (!Array.isArray(friendships) || friendships.length === 0) {
    const token = await owner('create_friend_invite', {})
    await lan('accept_friend_invite', { raw_token: token })
  }

  await owner('create_expense_with_funding', {
    request_id: IDS.coffee,
    expense_scope: 'personal',
    target_space_id: null,
    total_minor: 1250,
    currency_code: 'MYR',
    description: 'Coffee',
    category: 'Food',
    occurred_on: today,
    participant_ids: [ownerId],
    contribution_amounts: [1250],
    share_amounts: [1250],
    funding_request_id: IDS.coffeeFunding,
    funding_account_id: accountId('TNG'),
    funding_account_amount_minor: 1250,
  })
  await owner('create_expense_with_funding', {
    request_id: IDS.grab,
    expense_scope: 'personal',
    target_space_id: null,
    total_minor: 800,
    currency_code: 'MYR',
    description: 'Grab',
    category: 'Transport',
    occurred_on: yesterday,
    participant_ids: [ownerId],
    contribution_amounts: [800],
    share_amounts: [800],
    funding_request_id: IDS.grabFunding,
    funding_account_id: accountId('CIMB'),
    funding_account_amount_minor: 800,
  })

  const dinner = await owner('create_expense_with_funding', {
    request_id: IDS.dinner,
    expense_scope: 'direct',
    target_space_id: null,
    total_minor: 8000,
    currency_code: 'MYR',
    description: 'Dinner with Lan',
    category: 'Food',
    occurred_on: today,
    participant_ids: [ownerId, lanId],
    contribution_amounts: [8000, 0],
    share_amounts: [4000, 4000],
    funding_request_id: IDS.dinnerFunding,
    funding_account_id: accountId('CIMB'),
    funding_account_amount_minor: 8000,
  })
  const dinnerId = dinner.expense_id
  const dinnerRows = await rows(
    origin,
    anonKey,
    lanToken,
    `expenses?select=version&id=eq.${dinnerId}`,
  )
  await lan('respond_to_direct_expense', {
    target_expense_id: dinnerId,
    response: 'accepted',
    expected_expense_version: dinnerRows[0]?.version ?? 1,
  })

  const tripId = await owner('create_space', {
    space_type: 'trip',
    space_name: 'Hanoi Days',
    start_date: tripDay,
    end_date: today,
    default_currency: 'MYR',
  })
  await owner('create_expense_with_funding', {
    request_id: IDS.train,
    expense_scope: 'space',
    target_space_id: tripId,
    total_minor: 250000,
    currency_code: 'VND',
    description: 'Train ticket',
    category: 'Transport',
    occurred_on: tripDay,
    participant_ids: [ownerId],
    contribution_amounts: [250000],
    share_amounts: [250000],
    funding_request_id: IDS.trainFunding,
    funding_account_id: null,
    funding_account_amount_minor: null,
  })
  await owner('create_expense_with_funding', {
    request_id: IDS.breakfast,
    expense_scope: 'space',
    target_space_id: tripId,
    total_minor: 1500,
    currency_code: 'MYR',
    description: 'Breakfast',
    category: 'Food',
    occurred_on: yesterday,
    participant_ids: [ownerId],
    contribution_amounts: [1500],
    share_amounts: [1500],
    funding_request_id: IDS.breakfastFunding,
    funding_account_id: accountId('TNG'),
    funding_account_amount_minor: 1500,
  })

  const outstanding = await lan('get_direct_outstanding', {
    target_counterparty_id: ownerId,
    currency_code: 'MYR',
  })
  const owed = Number(outstanding?.signed_outstanding_minor ?? outstanding)
  if (owed !== 4000) throw new Error(`unexpected_outstanding_${owed}`)
  const paymentId = await lan('propose_settlement', {
    request_id: IDS.settlement,
    settlement_scope: 'direct',
    target_space_id: null,
    currency_code: 'MYR',
    total_amount_minor: 2000,
    payment_date: today,
    creditor_ids: [ownerId],
    allocation_amounts: [2000],
    settlement_note: 'Partial dinner repayment',
    overpay_disposition: null,
    expected_outstanding_minor: 4000,
    selected_expense_ids: [dinnerId],
    attribution_amounts: [2000],
    source_payment_request_id: null,
  })
  const allocations = await rows(
    origin,
    anonKey,
    ownerToken,
    `settlement_allocations?select=id,settlement_payment_id&settlement_payment_id=eq.${paymentId}`,
  )
  const allocationId = allocations[0]?.id
  if (!allocationId) throw new Error('allocation_missing')
  await lan('authorize_personal_settlement_cash_leg', {
    request_id: IDS.payerCash,
    target_allocation_id: allocationId,
    cash_role: 'payer',
    target_account_id: lanCash.id,
    supplied_cash_amount_minor: 2000,
  })
  await owner('authorize_personal_settlement_cash_leg', {
    request_id: IDS.receiverCash,
    target_allocation_id: allocationId,
    cash_role: 'receiver',
    target_account_id: accountId('CIMB'),
    supplied_cash_amount_minor: 2000,
  })
  await owner('respond_to_settlement', {
    target_allocation_id: allocationId,
    response: 'accepted',
    expected_payment_version: 1,
  })

  console.log(JSON.stringify({
    ok: true,
    projectRef: STAGING_REF,
    dates: { today, yesterday, tripDay },
    records: ['coffee', 'grab', 'dinner', 'train', 'breakfast', 'partial-repayment'],
  }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'seed_failed')
  process.exit(1)
})
