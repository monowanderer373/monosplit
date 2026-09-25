import type { TranslationKey } from '../../lib/i18n'
import type { GlobalDestination } from '../../lib/moneyContext'

export const primaryNavItems: ReadonlyArray<{
  id: GlobalDestination
  label: TranslationKey
  path: string
}> = [
  { id: 'daily', label: 'nav.daily', path: '/' },
  { id: 'insights', label: 'nav.insights', path: '/insights' },
  { id: 'shared', label: 'nav.shared', path: '/shared' },
  { id: 'me', label: 'nav.me', path: '/profile' },
]
