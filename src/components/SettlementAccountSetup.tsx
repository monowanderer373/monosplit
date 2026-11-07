import { useRef, useState } from 'react'
import { createPersonalAccount, type CashAccountType } from '../lib/personalAccountRepository'
import { generateId } from '../lib/id'
import { settlementRequestId } from '../lib/fxSettlement'
import { friendlyErrorKey, useT } from '../lib/i18n'

/** Explicit account creation only; never submits the surrounding payment. */
export function SettlementAccountSetup({ currency, disabled, onCreated }: { currency: string; disabled: boolean; onCreated: (id: string) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [type, setType] = useState<CashAccountType>('cash')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [created, setCreated] = useState(false)
  const pending = useRef(false), request = useRef<{ fingerprint: string; id: string } | null>(null)
  const create = async () => {
    if (pending.current || disabled || !name.trim() || created) return
    pending.current = true; setBusy(true); setError('')
    request.current = settlementRequestId(request.current, JSON.stringify([currency, name.trim(), type]), generateId())
    try {
      const { accountId } = await createPersonalAccount({ name: name.trim(), accountType: type, currency, openingBalanceMinor: null, balanceAsOf: null, requestId: request.current.id })
      setCreated(true); onCreated(accountId)
      window.dispatchEvent(new Event('tt:accounts-changed'))
    } catch (cause) { setError(t(friendlyErrorKey(cause))) }
    finally { pending.current = false; setBusy(false) }
  }
  if (created) return <p role="status" className="fx-muted">{t('fx.accountCreated')}</p>
  return <div className="fx-account-setup">
    {!open ? <button type="button" className="fx-text" disabled={disabled} onClick={() => setOpen(true)}>{t('fx.addAccount', { currency })}</button> : <fieldset disabled={disabled || busy}>
      <legend>{t('fx.addAccount', { currency })}</legend>
      <label>{t('fx.accountName')}<input maxLength={100} value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
      <label>{t('fx.accountType')}<select value={type} onChange={e => setType(e.target.value as CashAccountType)}><option value="cash">{t('fx.cashAccount')}</option><option value="bank">{t('fx.bankAccount')}</option><option value="ewallet">{t('fx.walletAccount')}</option></select></label>
      <p className="fx-muted">{t('fx.createAccountHelp', { currency })}</p>
      {error ? <p role="alert" className="fx-error">{error}</p> : null}
      <div className="fx-setup-actions"><button type="button" className="fx-secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</button><button type="button" className="fx-primary" disabled={!name.trim()} onClick={() => void create()}>{t(busy ? 'common.loading' : 'fx.createAccount')}</button></div>
    </fieldset>}
  </div>
}
