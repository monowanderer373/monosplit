import * as Sentry from '@sentry/react'
import type { Breadcrumb, ErrorEvent } from '@sentry/react'

export type AuthOperation =
  | 'initial_session'
  | 'profile_load'
  | 'sign_up'
  | 'sign_in'
  | 'anonymous_sign_in'
  | 'link_email'
  | 'set_password'
  | 'google_sign_in'
  | 'sign_out'
  | 'update_profile'

export type AuthMethod = 'email' | 'google' | 'anonymous' | 'session'
export type AuthOutcome = 'started' | 'succeeded' | 'failed'
export type AuthFailure =
  | 'not_configured'
  | 'invalid_credentials'
  | 'email_unconfirmed'
  | 'weak_password'
  | 'rate_limited'
  | 'account_conflict'
  | 'network'
  | 'other'

const AUTH_OPERATIONS = new Set<AuthOperation>([
  'initial_session',
  'profile_load',
  'sign_up',
  'sign_in',
  'anonymous_sign_in',
  'link_email',
  'set_password',
  'google_sign_in',
  'sign_out',
  'update_profile',
])
const AUTH_METHODS = new Set<AuthMethod>(['email', 'google', 'anonymous', 'session'])
const AUTH_OUTCOMES = new Set<AuthOutcome>(['started', 'succeeded', 'failed'])
const AUTH_FAILURES = new Set<AuthFailure>([
  'not_configured',
  'invalid_credentials',
  'email_unconfirmed',
  'weak_password',
  'rate_limited',
  'account_conflict',
  'network',
  'other',
])
const EXPECTED_AUTH_FAILURES = new Set<AuthFailure>([
  'invalid_credentials',
  'email_unconfirmed',
  'weak_password',
])
const SAFE_AUTH_BREADCRUMBS = new Set(
  [...AUTH_OPERATIONS].flatMap((operation) => (
    [...AUTH_OUTCOMES].map((outcome) => `auth.${operation}.${outcome}`)
  )),
)
let observabilityInitialized = false

function safeEnvironment(value: unknown): string | undefined {
  return typeof value === 'string'
    && new Set(['local', 'development', 'test', 'beta', 'preview', 'staging', 'production']).has(value)
    ? value
    : undefined
}

function safeRelease(value: unknown): string | undefined {
  return typeof value === 'string' && /^tabby-tally@[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)
    ? value
    : undefined
}

function safeAssetFilename(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const withoutSecrets = value.split(/[?#]/, 1)[0].replaceAll('\\', '/')
  if (!/\.(?:js|mjs|ts|tsx)$/i.test(withoutSecrets)) return undefined
  return withoutSecrets.split('/').filter(Boolean).slice(-2).join('/')
}

function safeFunctionName(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9_$.[\]<> -]{1,100}$/.test(value)
    ? value
    : undefined
}

function safeExceptionType(value: unknown): string {
  return typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_$.-]{0,79}$/.test(value)
    ? value
    : 'Error'
}

function sanitizeTags(tags: ErrorEvent['tags']): ErrorEvent['tags'] {
  if (!tags) return undefined
  const sanitized: NonNullable<ErrorEvent['tags']> = {}
  if (tags.feature === 'auth') sanitized.feature = 'auth'
  if (AUTH_OPERATIONS.has(tags['auth.operation'] as AuthOperation)) {
    sanitized['auth.operation'] = tags['auth.operation']
  }
  if (AUTH_METHODS.has(tags['auth.method'] as AuthMethod)) {
    sanitized['auth.method'] = tags['auth.method']
  }
  if (AUTH_OUTCOMES.has(tags['auth.outcome'] as AuthOutcome)) {
    sanitized['auth.outcome'] = tags['auth.outcome']
  }
  if (AUTH_FAILURES.has(tags['auth.failure'] as AuthFailure)) {
    sanitized['auth.failure'] = tags['auth.failure']
  }
  if (tags['error.boundary'] === 'app') sanitized['error.boundary'] = 'app'
  return Object.keys(sanitized).length ? sanitized : undefined
}

/**
 * Builds a minimal event from an explicit allowlist. Request data, user data,
 * contexts, extras, arbitrary tags/messages, and source context are discarded.
 */
export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const values = event.exception?.values?.map((exception) => ({
    type: safeExceptionType(exception.type),
    value: 'Application error',
    stacktrace: exception.stacktrace
      ? {
          frames: exception.stacktrace.frames?.map((frame) => ({
            filename: safeAssetFilename(frame.filename),
            function: safeFunctionName(frame.function),
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
          })),
        }
      : undefined,
  }))

  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: 'javascript',
    level: event.level,
    environment: safeEnvironment(event.environment),
    release: safeRelease(event.release),
    exception: values?.length ? { values } : undefined,
    tags: sanitizeTags(event.tags),
    breadcrumbs: event.breadcrumbs
      ?.map(sanitizeSentryBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null),
  }
}

/**
 * Only application-created auth lifecycle breadcrumbs are transmitted.
 * Browser, console, navigation, fetch, click, and arbitrary data breadcrumbs
 * are dropped, even if another integration creates them.
 */
export function sanitizeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (
    breadcrumb.category !== 'auth'
    || !breadcrumb.message
    || !SAFE_AUTH_BREADCRUMBS.has(breadcrumb.message)
  ) {
    return null
  }
  return {
    timestamp: breadcrumb.timestamp,
    type: 'default',
    category: 'auth',
    message: breadcrumb.message,
    level: breadcrumb.level,
  }
}

export function classifyAuthFailure(cause: unknown): AuthFailure {
  const message = cause instanceof Error ? cause.message.toLowerCase() : String(cause ?? '').toLowerCase()
  if (message.includes('not-configured')) return 'not_configured'
  if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
    return 'email_unconfirmed'
  }
  if (
    message.includes('invalid login')
    || message.includes('invalid credentials')
    || message.includes('wrong password')
  ) return 'invalid_credentials'
  if (message.includes('password') && (message.includes('weak') || message.includes('character'))) {
    return 'weak_password'
  }
  if (message.includes('rate') || message.includes('too many')) return 'rate_limited'
  if (
    message.includes('already registered')
    || message.includes('already in use')
    || message.includes('already exists')
  ) return 'account_conflict'
  if (message.includes('network') || message.includes('fetch')) return 'network'
  return 'other'
}

export function shouldReportAuthFailure(failure: AuthFailure): boolean {
  return !EXPECTED_AUTH_FAILURES.has(failure)
}

function addAuthBreadcrumb(
  operation: AuthOperation,
  outcome: AuthOutcome,
): void {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: `auth.${operation}.${outcome}`,
    level: outcome === 'failed' ? 'warning' : 'info',
  })
}

export function observeAuthOutcome(
  operation: AuthOperation,
  outcome: Exclude<AuthOutcome, 'failed'>,
  method: AuthMethod,
): void {
  void method
  addAuthBreadcrumb(operation, outcome)
}

export function observeAuthFailure(
  operation: AuthOperation,
  method: AuthMethod,
  cause: unknown,
): void {
  const failure = classifyAuthFailure(cause)
  addAuthBreadcrumb(operation, 'failed')
  if (!shouldReportAuthFailure(failure)) return

  Sentry.withScope((scope) => {
    scope.setLevel('warning')
    scope.setTag('feature', 'auth')
    scope.setTag('auth.operation', operation)
    scope.setTag('auth.outcome', 'failed')
    scope.setTag('auth.method', method)
    scope.setTag('auth.failure', failure)
    scope.captureException(new Error(`Auth operation failed: ${operation}/${failure}`))
  })
}

type SentryInitializer = (options: Parameters<typeof Sentry.init>[0]) => void

export function initializeObservability(
  initialize: SentryInitializer = Sentry.init,
): boolean {
  if (observabilityInitialized) return true

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) return false

  const deploymentEnvironment = typeof __TABBY_TALLY_DEPLOYMENT_ENVIRONMENT__ === 'string'
    ? __TABBY_TALLY_DEPLOYMENT_ENVIRONMENT__
    : undefined
  const deploymentRelease = typeof __TABBY_TALLY_DEPLOYMENT_RELEASE__ === 'string'
    ? __TABBY_TALLY_DEPLOYMENT_RELEASE__
    : undefined

  try {
    initialize({
      dsn,
      environment: safeEnvironment(import.meta.env.VITE_SENTRY_ENVIRONMENT)
        ?? safeEnvironment(deploymentEnvironment)
        ?? safeEnvironment(import.meta.env.MODE)
        ?? 'unknown',
      release: safeRelease(import.meta.env.VITE_SENTRY_RELEASE)
        ?? safeRelease(deploymentRelease)
        ?? 'tabby-tally@0.0.0',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      enableLogs: false,
      attachStacktrace: true,
      maxBreadcrumbs: 20,
      normalizeDepth: 2,
      beforeSend: sanitizeSentryEvent,
      beforeBreadcrumb: sanitizeSentryBreadcrumb,
    })
    observabilityInitialized = true
    return true
  } catch {
    // Observability must never become an application availability dependency.
    console.warn('Production error monitoring could not be initialized.')
    return false
  }
}
