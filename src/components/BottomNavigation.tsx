import { useLocation, useNavigate } from 'react-router-dom'
import { useT, type TranslationKey } from '../lib/i18n'
import {
  globalDestinationForPath,
  type GlobalDestination,
} from '../lib/moneyContext'

type Props = {
  onAdd: () => void
}

const destinations: ReadonlyArray<{
  id: GlobalDestination
  label: TranslationKey
  path: string
}> = [
  { id: 'personal', label: 'common.personal', path: '/' },
  { id: 'friends', label: 'common.friends', path: '/friends' },
  { id: 'groups-trips', label: 'common.groupsTrips', path: '/spaces' },
  { id: 'me', label: 'common.me', path: '/profile' },
]

export default function BottomNavigation({ onAdd }: Props) {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const active = globalDestinationForPath(location.pathname)
  const [personal, friends, groupsTrips, me] = destinations

  const destinationButton = (item: (typeof destinations)[number]) => (
    <button
      key={item.id}
      className={`flex min-h-11 min-w-0 items-center justify-center px-1 text-center text-[10px] font-extrabold leading-tight sm:px-3 sm:text-sm ${
        active === item.id ? 'text-[var(--ms-accent)]' : 'text-[var(--ms-text-secondary)]'
      }`}
      aria-current={active === item.id ? 'page' : undefined}
      onClick={() => navigate(item.path)}
    >
      <span className="max-w-full">{t(item.label)}</span>
    </button>
  )

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ms-border)] bg-[var(--ms-surface)]/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-4"
      aria-label={t('navigation.primary')}
    >
      <div className="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-0">
        {destinationButton(personal)}
        {destinationButton(friends)}
        <button
          className="flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-[var(--ms-accent)] text-3xl font-light text-white shadow-[var(--ms-elev-accent)]"
          onClick={onAdd}
          aria-label={t('ledger.quickAddLabel')}
        >
          +
        </button>
        {destinationButton(groupsTrips)}
        {destinationButton(me)}
      </div>
    </nav>
  )
}
