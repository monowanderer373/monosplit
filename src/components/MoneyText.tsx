/** Preserve the original formatter's text while giving the currency less emphasis. */
export default function MoneyText({ value }: { value: string }) {
  const match = /^(\D*)([\d][\d\s.,]*)(\D*)$/.exec(value)
  if (!match) return <>{value}</>
  return <><span className="tt-money-currency">{match[1]}</span><span className="tt-money-number">{match[2]}</span><span className="tt-money-currency">{match[3]}</span></>
}
