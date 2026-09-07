import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'

const ENV_FILE = '.env.production-smoke.local'
const KNOWN_PRODUCTION_ORIGIN =
  'https://tabby-tally-monowanderer373s-projects.vercel.app'

type SmokeAccount = Readonly<{
  label: 'A' | 'B' | 'C'
  email: string
  password: string
}>

export type ProductionSmokeEnvironment = Readonly<{
  productionUrl: string
  accounts: Readonly<{
    A: SmokeAccount
    B: SmokeAccount
    C: SmokeAccount
  }>
}>

let cachedEnvironment: ProductionSmokeEnvironment | null = null

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Production smoke preflight: ${name} is required.`)
  return value
}

export function loadProductionSmokeEnvironment(): ProductionSmokeEnvironment {
  if (cachedEnvironment) return cachedEnvironment
  if (process.env.PROD_SMOKE !== '1') {
    throw new Error(
      'Production smoke preflight refused: set PROD_SMOKE=1 explicitly.',
    )
  }

  const envPath = resolve(process.cwd(), ENV_FILE)
  if (!existsSync(envPath)) {
    throw new Error(`Production smoke preflight: ${ENV_FILE} is missing.`)
  }
  loadEnvFile(envPath)

  const url = new URL(required('TABBY_TALLY_PROD_URL'))
  const isLoopback =
    url.hostname === 'localhost'
    || url.hostname === '127.0.0.1'
    || url.hostname === '[::1]'
    || url.hostname.endsWith('.localhost')
  if (
    url.protocol !== 'https:'
    || url.origin !== KNOWN_PRODUCTION_ORIGIN
    || url.username
    || url.password
    || isLoopback
  ) {
    throw new Error(
      `Production smoke preflight refused: URL must be ${KNOWN_PRODUCTION_ORIGIN}.`,
    )
  }

  const accounts = {
    A: {
      label: 'A' as const,
      email: required('TABBY_TALLY_TEST_USER_A_EMAIL'),
      password: required('TABBY_TALLY_TEST_USER_A_PASSWORD'),
    },
    B: {
      label: 'B' as const,
      email: required('TABBY_TALLY_TEST_USER_B_EMAIL'),
      password: required('TABBY_TALLY_TEST_USER_B_PASSWORD'),
    },
    C: {
      label: 'C' as const,
      email: required('TABBY_TALLY_TEST_USER_C_EMAIL'),
      password: required('TABBY_TALLY_TEST_USER_C_PASSWORD'),
    },
  }
  const distinctEmails = new Set(
    Object.values(accounts).map((account) => account.email.toLowerCase()),
  )
  if (distinctEmails.size !== 3) {
    throw new Error(
      'Production smoke preflight refused: A, B, and C must be distinct emails.',
    )
  }

  cachedEnvironment = Object.freeze({
    productionUrl: url.origin,
    accounts: Object.freeze(accounts),
  })
  return cachedEnvironment
}

export function redactedAccountIdentifier(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12)
}
