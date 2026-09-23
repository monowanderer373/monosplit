import { useSearchParams } from 'react-router-dom'
import FriendsPage from './FriendsPage'
import SpacesPage from './SpacesPage'
import { useT } from '../lib/i18n'

type SharedTab = 'friends' | 'groups' | 'trips'

function tabFromParam(value: string | null): SharedTab {
  if (value === 'groups' || value === 'trips') return value
  return 'friends'
}

export default function SharedPage() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const tab = tabFromParam(params.get('tab'))
  const tabs: Array<{ id: SharedTab; label: string }> = [
    { id: 'friends', label: t('nav.sharedFriends') },
    { id: 'groups', label: t('nav.sharedGroups') },
    { id: 'trips', label: t('nav.sharedTrips') },
  ]

  return (
    <div>
      <div className="ms-page !pb-0">
        <div className="mx-auto flex max-w-4xl gap-2" role="tablist" aria-label={t('nav.shared')}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className="ms-btn-ghost min-h-11"
              onClick={() => setParams(item.id === 'friends' ? {} : { tab: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'friends' ? <FriendsPage /> : null}
      {tab === 'groups' ? <SpacesPage preferredType="group" /> : null}
      {tab === 'trips' ? <SpacesPage preferredType="trip" /> : null}
    </div>
  )
}
