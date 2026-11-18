import type { ContraSnapshot } from '../../lib/tripContra'

type Props = {
  snapshot: ContraSnapshot | null
  names: ReadonlyMap<string, string>
  chinese: boolean
  money: (minor: number, currency: string) => string
}

export default function TripBalanceList({ snapshot, names, chinese, money }: Props) {
  const balances = snapshot?.tripBalances
  if (!balances || !snapshot) return null

  const label = chinese ? '旅行欠款' : 'Trip balances'
  const unknownMember = chinese ? '旅行成员' : 'Trip member'

  return (
    <section className="tw-trip-balances" aria-label={label}>
      <h3>{label}</h3>
      {balances.rows.length > 0 && (
        <ul>
          {balances.rows.map(({ payer, recipient, minor, estimated }) => (
            <li key={payer + ':' + recipient}>
              <span>{names.get(payer) ?? unknownMember}{chinese ? ' 欠 ' : ' owes '}{names.get(recipient) ?? unknownMember}</span>
              <strong>{estimated ? '≈ ' : ''}{money(minor, snapshot.quote.displayCurrency)}</strong>
            </li>
          ))}
        </ul>
      )}
      {balances.incomplete ? (
        <p>{chinese ? '部分余额暂缺汇率。' : 'Exchange rates are unavailable for some balances.'}</p>
      ) : balances.rows.length === 0 && (
        <p>{chinese ? '目前没有未结清的欠款。' : 'No outstanding trip balances.'}</p>
      )}
    </section>
  )
}
