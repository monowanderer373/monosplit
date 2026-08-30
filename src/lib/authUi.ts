import type { TranslationKey } from './i18n'

const INTERNAL_ORIGIN = 'https://tabby-tally.internal'

export function safeInternalRedirect(candidate: string | null | undefined): string | null {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return null
  for (const character of candidate) {
    const code = character.charCodeAt(0)
    if (code <= 31 || code === 127 || character === '\\') return null
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN)
    if (url.origin !== INTERNAL_ORIGIN) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function authErrorKey(value: unknown): TranslationKey {
  const message = value instanceof Error ? value.message.toLowerCase() : String(value ?? '').toLowerCase()
  if (message.includes('not-configured')) return 'auth.errorNotConfigured'
  if (
    message.includes('invalid login')
    || message.includes('invalid credentials')
    || message.includes('wrong password')
  ) return 'auth.errorCredentials'
  if (
    message.includes('already registered')
    || message.includes('already in use')
    || message.includes('user already exists')
  ) return 'auth.errorEmailTaken'
  if (message.includes('password')) return 'auth.errorWeakPassword'
  return 'auth.errorGeneric'
}
