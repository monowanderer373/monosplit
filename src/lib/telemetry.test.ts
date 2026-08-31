import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Breadcrumb, ErrorEvent } from '@sentry/react'
import {
  classifyAuthFailure,
  initializeObservability,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  shouldReportAuthFailure,
} from './telemetry'

describe('Sentry privacy sanitizer', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('retains only allowlisted diagnostics and removes financial, identity, and auth data', () => {
    const sensitive = {
      description: 'Secret dinner note',
      amount: '123.45',
      currency: 'MYR',
      name: 'Private Person',
      id: 'participant-123',
      invite: 'invite-token-abc',
      access: 'access-token-abc',
      refresh: 'refresh-token-abc',
      email: 'person@example.com',
      storage: 'persisted-private-ledger',
      auth: 'Bearer secret-jwt',
    }
    const event: ErrorEvent = {
      type: undefined,
      event_id: 'safe-event-id',
      timestamp: 1,
      environment: 'beta',
      release: 'tabby-tally@1.2.3',
      message: Object.values(sensitive).join(' '),
      user: { id: sensitive.id, email: sensitive.email, username: sensitive.name },
      request: {
        url: `https://app.example/space-invite/${sensitive.invite}?access_token=${sensitive.access}#refresh_token=${sensitive.refresh}`,
        headers: { authorization: sensitive.auth },
        data: sensitive,
      },
      contexts: {
        localStorage: sensitive,
        expense: sensitive,
      },
      extra: {
        requestBody: sensitive,
        localStorage: sensitive.storage,
      },
      tags: {
        feature: 'auth',
        'auth.operation': 'sign_in',
        'auth.outcome': 'failed',
        'auth.method': 'email',
        'auth.failure': 'invalid_credentials',
        participant_id: sensitive.id,
      },
      exception: {
        values: [{
          type: 'AuthApiError',
          value: `${sensitive.email}: ${sensitive.description} ${sensitive.amount} ${sensitive.currency}`,
          stacktrace: {
            frames: [{
              filename: `https://app.example/assets/index.js?token=${sensitive.access}#${sensitive.refresh}`,
              function: 'handleSignIn',
              lineno: 42,
              colno: 7,
              in_app: true,
              vars: sensitive,
              context_line: sensitive.description,
            }],
          },
        }],
      },
      breadcrumbs: [
        {
          category: 'auth',
          message: 'auth.sign_in.failed',
          data: sensitive,
        },
        {
          category: 'fetch',
          message: `POST /token?email=${sensitive.email}`,
          data: sensitive,
        },
      ],
    }

    const sanitized = sanitizeSentryEvent(event)
    const serialized = JSON.stringify(sanitized)

    expect(sanitized).toMatchObject({
      event_id: 'safe-event-id',
      environment: 'beta',
      release: 'tabby-tally@1.2.3',
      tags: {
        feature: 'auth',
        'auth.operation': 'sign_in',
        'auth.outcome': 'failed',
        'auth.method': 'email',
        'auth.failure': 'invalid_credentials',
      },
      exception: {
        values: [{
          type: 'AuthApiError',
          value: 'Application error',
          stacktrace: {
            frames: [{
              filename: 'assets/index.js',
              function: 'handleSignIn',
              lineno: 42,
            }],
          },
        }],
      },
      breadcrumbs: [{
        category: 'auth',
        message: 'auth.sign_in.failed',
      }],
    })
    for (const secret of Object.values(sensitive)) {
      expect(serialized).not.toContain(secret)
    }
    expect(serialized).not.toContain('participant_id')
    expect(serialized).not.toContain('request')
    expect(serialized).not.toContain('localStorage')
  })

  it('drops arbitrary breadcrumbs and their data', () => {
    const breadcrumb: Breadcrumb = {
      category: 'navigation',
      message: '/space-invite/private-token?access_token=secret',
      data: { email: 'person@example.com', amount: 99 },
    }

    expect(sanitizeSentryBreadcrumb(breadcrumb)).toBeNull()
  })

  it('rejects deployment labels that could contain identity data', () => {
    const sanitized = sanitizeSentryEvent({
      type: undefined,
      environment: 'person@example.com',
      release: 'person@example.com',
      exception: { values: [{ value: 'person@example.com' }] },
    })

    expect(sanitized.environment).toBeUndefined()
    expect(sanitized.release).toBeUndefined()
    expect(JSON.stringify(sanitized)).not.toContain('person@example.com')
  })

  it('maps raw auth errors to a bounded failure code', () => {
    expect(classifyAuthFailure(new Error('Email not confirmed for person@example.com')))
      .toBe('email_unconfirmed')
    expect(classifyAuthFailure(new Error('request failed with an unknown private response')))
      .toBe('other')
  })

  it('does not report expected user-correctable auth failures as exceptions', () => {
    expect(shouldReportAuthFailure('invalid_credentials')).toBe(false)
    expect(shouldReportAuthFailure('email_unconfirmed')).toBe(false)
    expect(shouldReportAuthFailure('weak_password')).toBe(false)
    expect(shouldReportAuthFailure('network')).toBe(true)
    expect(shouldReportAuthFailure('other')).toBe(true)
  })

  it('does not let Sentry initialization failure prevent application startup', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.ingest.sentry.io/1')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(initializeObservability(() => {
      throw new Error('private setup failure')
    })).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      'Production error monitoring could not be initialized.',
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private setup failure')
  })
})
