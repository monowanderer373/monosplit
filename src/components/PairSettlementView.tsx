import { useEffect, useState } from 'react'
import AmountInput from './AmountInput'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { localeForLang } from '../lib/locale'
import { currencyExponent, parseMajorAmount } from '../lib/money'
import { exactAmount, fraction } from '../lib/fx'
import { customForeignPerTarget, quotePair, systemForeignPerTarget, type MoneyLine } from '../lib/fxSettlement'
import { useInsightsFx } from '../hooks/useInsightsFx'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../lib/i18n'
import { generateId } from '../lib/id'

export function PairSettlementView({ self, other, otherName, youOwe, theyOwe, target, spaceId, expenses, review, onClose, onDone }: {
  self: string; other: string; otherName: string; youOwe: MoneyLine[]; theyOwe: MoneyLine[]; target: string; spaceId: string
  expenses: readonly { id: string; description: string | null; occurredOn: string; currency: string; totalMinor: number }[]
  review?: { id: string; version: number; cashMinor: number; rates: Record<string, { numerator: string; denominator: string }>; mode: string } | null
  onClose: () => void; onDone: () => Promise<unknown>
}) {
  const t = useT(), { authUser } = useAuth(), lang = useStore(s => s.lang)
  const fx = useInsightsFx(authUser?.id ?? '', true)
  const [mode, setMode] = useState<'system' | 'custom'>(review?.mode === 'custom' ? 'custom' : 'system')
  const [intent, setIntent] = useState<'full' | 'partial'>('full')
  const [partial, setPartial] = useState('')
  const [rates, setRates] = useState<Record<string, string>>({})
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<{ id: string; name: string; currency: string }[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const money = (minor: bigint | number, currency: string) => exactAmount(BigInt(minor), currencyExponent(currency), localeForLang(lang))
  const foreign = [...youOwe, ...theyOwe].map(line => line.currency).filter(code => code !== target)
  const rateFor = (currency: string) => {
    if (currency === target) return fraction(1n)
    if (mode === 'custom') return rates[currency] ? customForeignPerTarget(rates[currency]) : null
    return systemForeignPerTarget(currency, target, fx.snapshot)
  }
  let quoted: ReturnType<typeof quotePair> | null = null
  let quoteError = ''
  try {
    quoted = review || (intent === 'partial' && !partial) ? null : quotePair({ youOwe, theyOwe, target, rateFor, intent, cashMinor: intent === 'partial' ? BigInt(parseMajorAmount(partial, target)) : undefined })
  } catch (cause) { quoted = null; quoteError = cause instanceof Error ? cause.message : 'invalid_amount' }
  useEffect(() => { if (!supabase) return; void supabase.from('personal_accounts').select('id,name,currency').eq('owner_participant_id', self).is('archived_at', null).then(({ data }) => setAccounts((data ?? []).filter(account => account.currency === target))) }, [self, target])
  const submit = async () => {
    if (!supabase || busy || !quoted?.ok || quoted.direction === 'collect') return
    setBusy(true); setError('')
    const { error: rpcError } = await supabase.rpc('propose_fx_settlement_bundle', {
      request_id: generateId(), target_space_id: spaceId, counterparty_id: other, target_currency: target,
      rate_mode: mode, custom_rates: mode === 'custom' ? rates : {}, cash_minor: Number(quoted.cashMinor), payer_account_id: quoted.cashMinor > 0n ? accountId || null : null,
    })
    setBusy(false)
    if (rpcError) { setError(rpcError.message); return }
    await onDone()
  }
  const respond = async (response: 'accepted' | 'declined') => {
    if (!supabase || !review || busy) return
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('respond_fx_settlement_bundle', { target_bundle_id: review.id, response, expected_version: review.version })
    setBusy(false)
    if (rpcError) { setError(rpcError.message); return }
    await onDone()
  }
  const net = review ? review.cashMinor : quoted?.ok ? quoted.cashMinor : null
  return <section className="fx-settle" role="dialog" aria-label={otherName}>
    <header><button type="button" onClick={onClose}>{t('members.back')}</button><strong>{otherName}</strong></header>
    <div className="fx-settle-body">
      <p className="fx-net">{net == null ? t('tw.estimateUnavailable') : <>{quoted?.ok && quoted.direction === 'collect' ? t('fx.collect') : '≈'} {target === 'MYR' ? 'RM' : target} {money(net ?? 0, target)}</>}</p>
      <p>{t('fx.pay')} {youOwe.map(line => `${line.currency} ${money(line.amountMinor, line.currency)}`).join(' · ') || '—'}</p>
      <p>{t('fx.collect')} {theyOwe.map(line => `${line.currency} ${money(line.amountMinor, line.currency)}`).join(' · ') || '—'}</p>
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{t('fx.included')}</button>
      {open ? <ul>{expenses.map(expense => <li key={expense.id}>{expense.occurredOn} · {expense.description ?? expense.currency} · {money(expense.totalMinor, expense.currency)}</li>)}</ul> : null}
      {review ? <p>{review.mode} · {Object.entries(review.rates).filter(([code]) => code !== target).map(([code, rate]) => `1 ${target} = ${rate.denominator === '1' ? rate.numerator : `${rate.numerator}/${rate.denominator}`} ${code}`).join(' · ')}</p> : <>
        <div role="group">{(['system', 'custom'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setError('') }}>{t(value === 'system' ? 'fx.system' : 'fx.custom')}</button>)}</div>
        {mode === 'custom' ? foreign.map(code => <label key={code}>1 {target} = <AmountInput value={rates[code] ?? ''} onValueChange={value => setRates(current => ({ ...current, [code]: value }))} aria-label={code} /> {code}</label>) : null}
        <div role="group">{(['full', 'partial'] as const).map(value => <button key={value} type="button" aria-pressed={intent === value} onClick={() => { setIntent(value); setError('') }}>{t(value === 'full' ? 'fx.full' : 'fx.partial')}</button>)}</div>
        {intent === 'partial' ? <AmountInput value={partial} onValueChange={setPartial} aria-label={t('fx.partial')} /> : null}
        {intent === 'partial' && quoted?.ok ? <p>{t('fx.remaining')} {money(quoted.fullMinor - quoted.cashMinor, target)}</p> : null}
        <label>{t('fx.record')}<select value={accountId} onChange={event => setAccountId(event.target.value)}><option value="" />{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      </>}
      {quoteError || error ? <p role="alert">{quoteError || error}</p> : null}
    </div>
    <footer>{review ? <><button type="button" disabled={busy} onClick={() => void respond('accepted')}>{t('settlement.confirmReceived')}</button><button type="button" disabled={busy} onClick={() => void respond('declined')}>{t('common.decline')}</button></> : <button type="button" disabled={busy || !quoted?.ok || quoted.direction === 'collect' || (quoted.cashMinor > 0n && !accountId)} onClick={() => void submit()}>{quoted?.ok && quoted.direction === 'offset' ? t('fx.offset') : t('fx.record')}</button>}</footer>
  </section>
}
