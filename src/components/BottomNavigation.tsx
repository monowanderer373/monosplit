import { useLocation, useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { globalDestinationForPath } from '../lib/moneyContext'
import NavItem from './navigation/NavItem'
import { NavIcon } from './navigation/NavIcon'
import PaperSurface from './navigation/PaperSurface'
import { primaryNavItems } from './navigation/navConfig'

export default function BottomNavigation() {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const active = globalDestinationForPath(location.pathname)
  const [daily, insights, shared, me] = primaryNavItems

  const item = (entry: (typeof primaryNavItems)[number]) => (
    <NavItem
      key={entry.id}
      label={t(entry.label)}
      active={active === entry.id}
      icon={<NavIcon id={entry.id} />}
      onClick={() => navigate(entry.path)}
    />
  )

  return (
    <nav className="tt-nav" aria-label={t('navigation.primary')}>
      <PaperSurface className="tt-nav-surface">
        <div className="tt-nav-grid">
          {item(daily)}
          {item(insights)}
          <span aria-hidden="true" />
          {item(shared)}
          {item(me)}
        </div>
      </PaperSurface>
    </nav>
  )
}
