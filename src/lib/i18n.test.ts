import { describe, expect, it } from 'vitest'
import { missingTranslationKeys } from './i18n'

const ACTIVE_PREFIXES = [
  'app.',
  'auth.',
  'cat.',
  'common.',
  'navigation.',
  'contextGate.',
  'contextPicker.',
  'expense.',
  'expenseCapture.',
  'quickAdd.',
  'library.',
  'role.',
  'scope.',
  'spaceType.',
  'spaces.',
  'space.',
  'spaceInvite.',
  'ledger.',
  'capture.',
  'friends.',
  'person.',
  'friendInvite.',
  'settlement.',
  'activity.',
  'friendlyError.',
  'lang.',
] as const

describe('active translations', () => {
  it.each(['en', 'zh'] as const)('has complete %s language coverage', (lang) => {
    expect(missingTranslationKeys(lang, ACTIVE_PREFIXES)).toEqual([])
  })
})
