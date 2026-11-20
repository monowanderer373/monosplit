import { useEffect, useRef, useState } from 'react'
import { HomeSheet } from '../home/HomeScreen'
import { supabase } from '../../lib/supabase'
import { validateContraSnapshot, type ContraSnapshot } from '../../lib/tripContra'
import TripBalanceList from './TripBalanceList'

type Statement = {
  snapshot: ContraSnapshot
  totals: {currency: string; minor: number}[]
  people: {id: string; name: string}[]
  generatedAt: string
  rateBasis: 'system' | 'latest_recorded_custom'
}

type Props = {
  identity: string
  actor: string
  trip: string
  tripName: string
  chinese: boolean
  money: (minor: number, currency: string) => string
}

export default function TripFinalStatement({identity, actor, trip, tripName, chinese, money}: Props) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return <>
    <button ref={trigger} type="button" className="tw-statement-trigger" onClick={() => setOpen(true)}>
      {chinese ? '结算总表' : 'Final statement'} <span aria-hidden="true">↗</span>
    </button>
    {open && <HomeSheet title={chinese ? '结算总表' : 'Final statement'} testId="trip-final-statement"
      presentation="dialog" returnFocusRef={trigger} onClose={() => setOpen(false)} className="tw-final-statement">
      <StatementBody key={identity + ':' + trip} {...{identity, actor, trip, tripName, chinese, money}} />
    </HomeSheet>}
  </>
}

function StatementBody({identity, actor, trip, tripName, chinese, money}: Props) {
  const [data, setData] = useState<Statement | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    void (async () => {
      if (!supabase) throw new Error('not_configured')
      const session = await supabase.auth.getSession()
      if (session.error || session.data.session?.user.id !== identity) throw new Error('session_changed')
      const result = await supabase.rpc('read_trip_final_statement', {target_space_id: trip})
      if (result.error) throw result.error
      const value = result.data as Statement
      validateContraSnapshot(value?.snapshot, trip, actor)
      if (!value.snapshot.tripBalances || !Array.isArray(value.totals) || !Array.isArray(value.people)
        || !Number.isFinite(Date.parse(value.generatedAt))
        || value.totals.some(row => !/^[A-Z]{3}$/.test(row.currency) || !Number.isSafeInteger(row.minor) || row.minor < 0)
        || value.people.some(person => typeof person.id !== 'string' || typeof person.name !== 'string')) {
        throw new Error('invalid_statement')
      }
      if (active) setData(value)
    })().catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [identity, actor, trip, retry])

  if (error) return <div role="alert"><p>{chinese ? '暂时无法读取结算总表。' : 'The statement could not be loaded.'}</p>
    <button type="button" className="tw-button" onClick={() => {setError(false); setRetry(n => n + 1)}}>{chinese ? '重试' : 'Retry'}</button></div>
  if (!data) return <p role="status">{chinese ? '读取中…' : 'Loading…'}</p>
  const names = new Map(data.people.map(person => [person.id, person.name]))
  const rows = data.snapshot.tripBalances!.rows
  return <div>
    <h3>{tripName}</h3>
    <p className="tw-statement-time">{new Date(data.generatedAt).toLocaleString()}</p>
    <section className="tw-statement-total">
      <h4>{chinese ? '共享账单总额' : 'Shared bills total'}</h4>
      {data.totals.map(row => <p key={row.currency}>{money(row.minor, row.currency)}</p>)}
    </section>
    <p className="tw-statement-rate">{data.rateBasis === 'latest_recorded_custom'
      ? (chinese ? '最近一笔收款的约定汇率' : 'Latest recorded custom rate')
      : (chinese ? '当前系统汇率' : 'Current system rate')}
      {data.snapshot.quote.numerator && <> · 1 MYR = {data.snapshot.quote.numerator}
        {data.snapshot.quote.denominator !== '1' ? ' / ' + data.snapshot.quote.denominator : ''} VND</>}
    </p>
    <TripBalanceList snapshot={data.snapshot} names={names} chinese={chinese} money={money} />
    {!data.snapshot.tripBalances!.incomplete && <section className="tw-trip-balances">
      <h3>{chinese ? '每人尚需付款与收款' : 'Remaining by member'}</h3>
      <ul>{data.people.map(person => {
        const pay = rows.filter(row => row.payer === person.id).reduce((sum, row) => sum + BigInt(row.minor), 0n)
        const collect = rows.filter(row => row.recipient === person.id).reduce((sum, row) => sum + BigInt(row.minor), 0n)
        if (pay > BigInt(Number.MAX_SAFE_INTEGER) || collect > BigInt(Number.MAX_SAFE_INTEGER)) return <li key={person.id}>{person.name} —</li>
        return <li key={person.id}><span>{person.name}</span><span>
          {chinese ? '应付 ' : 'Pay '}{money(Number(pay), 'MYR')}<br />
          {chinese ? '应收 ' : 'Collect '}{money(Number(collect), 'MYR')}</span></li>
      })}</ul>
    </section>}
  </div>
}
