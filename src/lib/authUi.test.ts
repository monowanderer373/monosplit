import { describe, expect, it } from 'vitest'
import { authErrorKey, safeInternalRedirect } from './authUi'

describe('safeInternalRedirect', () => {
  it.each([
    ['/space/123?tab=people#member', '/space/123?tab=people#member'],
    ['/', '/'],
    ['/friend-invite/token', '/friend-invite/token'],
  ])('accepts internal path %s', (candidate, expected) => {
    expect(safeInternalRedirect(candidate)).toBe(expected)
  })

  it.each([
    null,
    '',
    'https://example.com',
    '//example.com/path',
    '/\\example.com',
    '/path\nLocation: https://example.com',
  ])('rejects unsafe redirect %s', (candidate) => {
    expect(safeInternalRedirect(candidate)).toBeNull()
  })
})

describe('authErrorKey', () => {
  it('maps known errors and bounds unknown messages', () => {
    expect(authErrorKey(new Error('Invalid login credentials'))).toBe('auth.errorCredentials')
    expect(authErrorKey(new Error('User already registered'))).toBe('auth.errorEmailTaken')
    expect(authErrorKey(new Error('backend secret detail'))).toBe('auth.errorGeneric')
  })
})
