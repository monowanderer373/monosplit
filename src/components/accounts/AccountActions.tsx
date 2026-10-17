import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MoneyDialog from './MoneyDialog'
import QuickIcon from '../QuickIcon'
import { useT } from '../../lib/i18n'

export default function AccountActions({ accountId, accountName }: { accountId: string; accountName: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const hintId = useId()
  const t = useT(), navigate = useNavigate()
  const go = (path: string) => { setOpen(false); navigate(path) }
  const actions = [
    { kind: 'transfer', title: t('mc.move.transfer'), hint: t('mc.account.transferHint'), path: `/accounts/move/transfer?from=${encodeURIComponent(accountId)}` },
    { kind: 'exchange', title: t('mc.move.exchange'), hint: t('mc.account.exchangeHint'), path: `/accounts/move/exchange?from=${encodeURIComponent(accountId)}` },
    { kind: 'view', title: t('mc.account.view'), hint: t('mc.account.viewHint'), path: accountId === 'all' ? '/accounts' : `/accounts/${encodeURIComponent(accountId)}` },
  ] as const
  return <>
    <button ref={trigger} type="button" className="home-account-actions" data-testid="home-account-actions"
      aria-label={t('mc.account.moreActions')} title={t('mc.account.moreActions')} aria-haspopup="dialog"
      aria-expanded={open} onClick={() => setOpen(true)}>
      <img src="/denim-paper/pocket-clear.png" width="64" height="64" alt="" aria-hidden="true" draggable={false} />
    </button>
    {open ? <MoneyDialog title={t('mc.account.moreActions')} onClose={() => setOpen(false)}
      testId="account-actions" returnFocusRef={trigger}>
      <div className="ttmc-module ttmc-account-actions">
        <p className="ttmc-action-account">{accountName}</p>
        <div className="ttmc-account-action-list">
          {actions.map(action => <button key={action.kind} type="button" aria-label={action.title} aria-describedby={`${hintId}-${action.kind}`}
            className="ttmc-account-action" onClick={() => go(action.path)}>
            <span className="ttmc-action-icon">
              {action.kind === 'view' ? <QuickIcon name="wallet" /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={action.kind === 'transfer' ? 'M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4' : 'M20 9a8 8 0 0 0-14-3L3 9m0-6v6h6M4 15a8 8 0 0 0 14 3l3-3m0 6v-6h-6'} />
              </svg>}
            </span>
            <span className="ttmc-action-copy"><strong>{action.title}</strong><span id={`${hintId}-${action.kind}`}>{action.hint}</span></span>
            <svg className="ttmc-action-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </button>)}
        </div>
      </div>
    </MoneyDialog> : null}
  </>
}
