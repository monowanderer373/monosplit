import { useNavigate } from 'react-router-dom'
import { useT } from '../../lib/i18n'

export default function AccountActions({ accountId }: { accountId: string; accountName: string }) {
  const t = useT()
  const navigate = useNavigate()
  const actions = [
    { kind: 'transfer', title: t('mc.move.transfer'), path: `/accounts/move/transfer?from=${encodeURIComponent(accountId)}` },
    { kind: 'exchange', title: t('mc.move.exchange'), path: `/accounts/move/exchange?from=${encodeURIComponent(accountId)}` },
    { kind: 'view', title: t('mc.account.view'), path: accountId === 'all' ? '/accounts' : `/accounts/${encodeURIComponent(accountId)}` },
  ] as const
  return (
    <div className="ttc-ui" role="group" aria-label={t('mc.account.moreActions')} data-testid="home-account-actions">
      {actions.map(action => (
        <button
          key={action.kind}
          type="button"
          className="ttc-account-menu-row"
          data-testid={`home-account-action-${action.kind}`}
          aria-label={action.title}
          onClick={() => navigate(action.path)}
        >
          <span className="ttc-spacer">{action.title}</span>
          <span aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  )
}
