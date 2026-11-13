/** All debt amounts in this reference are integer minor units of one frozen
 * settlement quote. Native source coverage remains authoritative in the app. */
export type Currency = "VND" | "MYR"
export type Rate = { numerator: string; denominator: string }
export type Edge = { id: string; from: string; to: string; minor: number }
export type Snapshot = {
  edgeBasis?: 'net'
  tripId: string
  revision: string
  quoteId: string
  ledgerCurrency: Currency
  rates: Partial<Record<Currency, Rate>>
  participants: string[]
  edges: Edge[]
}
export type Payment = {
  id: string
  payer: string
  recipient: string
  tenderCurrency: Currency
  tenderMinor: number
  method?: "cash" | "bank_transfer"
  via?: { person: string; minor?: number } // omitted amount requests a suggestion
}
export type Coverage = { edgeId: string; from: string; to: string; minor: number }
export type PlanLine = {
  payment: Payment
  valueMinor: number
  viaMinor: number
  directMinor: number
  unappliedMinor: number
  coverage: Coverage[]
}
export type Issue = {
  code: "SHARED_LIMIT" | "UNAPPLIED_CASH" | "ZERO_VALUE"
  paymentIds: string[]
  edgeId?: string
  capacityMinor?: number
}
export type Plan = {
  tripId: string
  revision: string
  quoteId: string
  ledgerCurrency: Currency
  rates: Partial<Record<Currency, Rate>>
  lines: PlanLine[]
  issues: Issue[]
  remaining: Edge[]
}

const moneyMax = 1_000_000_000_000
function amount(value: number, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > moneyMax) {
    throw new Error("INVALID_AMOUNT")
  }
  return value
}

function ratioPart(value: string): bigint {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,17}$/.test(value)) {
    throw new Error("INVALID_RATE")
  }
  return BigInt(value)
}

export function convertTender(snapshot: Snapshot, currency: Currency, minor: number): number {
  amount(minor, 1)
  if (currency !== "VND" && currency !== "MYR") throw new Error("INVALID_CURRENCY")
  if (currency === snapshot.ledgerCurrency) return minor
  const rate = snapshot.rates[currency]
  if (!rate) throw new Error("MISSING_RATE")
  const numerator = BigInt(minor) * ratioPart(rate.numerator)
  const denominator = ratioPart(rate.denominator)
  // Standalone reference policy. Use the repository's authoritative quote
  // and rounding before issuing a production preview or writing coverage.
  const converted = (2n * numerator + denominator) / (2n * denominator)
  if (converted > BigInt(moneyMax)) throw new Error("INVALID_AMOUNT")
  return Number(converted)
}

const pair = (from: string, to: string) => JSON.stringify([from, to])
const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

export function planSettlement(snapshot: Snapshot, payments: Payment[]): Plan {
  if (!payments.length || payments.length > 50) throw new Error("INVALID_PAYMENT_COUNT")
  const members = new Set(snapshot.participants)
  const edges = new Map<string, Edge>()
  const balances = new Map<string, number>()
  for (const edge of snapshot.edges) {
    amount(edge.minor)
    const key = pair(edge.from, edge.to)
    if (!edge.id || !members.has(edge.from) || !members.has(edge.to) ||
        edge.from === edge.to || edges.has(key) || balances.has(edge.id)) {
      throw new Error("INVALID_EDGE_SNAPSHOT")
    }
    edges.set(key, edge)
    balances.set(edge.id, edge.minor)
  }
  if(snapshot.edgeBasis==='net'&&snapshot.edges.some(e=>e.minor>0&&edges.get(pair(e.to,e.from))?.minor))throw new Error('INVALID_NET_SNAPSHOT')
  const paymentIds = new Set<string>()
  const tenderKeys = new Set<string>()
  const issues: Issue[] = []
  const reservations = new Map<string, { ids: string[]; total: number }>()
  const sortedPayments = [...payments].sort((a, b) => compareIds(a.id, b.id))
  const lines: PlanLine[] = sortedPayments.map(input => {
    const { id, payer, recipient, tenderCurrency, tenderMinor, method, via } = input
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || paymentIds.has(id) ||
        payer === recipient || !members.has(payer) || !members.has(recipient)) {
      throw new Error("INVALID_PAYMENT")
    }
    if (method !== undefined && method !== "cash" && method !== "bank_transfer") throw new Error("INVALID_METHOD")
    const tenderKey = JSON.stringify([payer, recipient, tenderCurrency])
    if (tenderKeys.has(tenderKey)) throw new Error("DUPLICATE_TENDER")
    tenderKeys.add(tenderKey)
    paymentIds.add(id)
    const payment = { id, payer, recipient, tenderCurrency, tenderMinor, ...(method ? { method } : {}),
      ...(via ? { via: { person: via.person, ...(via.minor === undefined ? {} : { minor: via.minor }) } } : {}) }
    const valueMinor = convertTender(snapshot, tenderCurrency, tenderMinor)
    if (!valueMinor) issues.push({ code: "ZERO_VALUE", paymentIds: [id] })
    const coverage: Coverage[] = []
    let viaMinor = 0
    if (via) {
      if (!members.has(via.person) || via.person === payer || via.person === recipient) {
        throw new Error("INVALID_INTERMEDIARY")
      }
      const upstream = edges.get(pair(payer, via.person))
      const downstream = edges.get(pair(via.person, recipient))
      if (!upstream?.minor || !downstream?.minor) throw new Error("NO_OPEN_ROUTE")
      const ceiling = Math.min(valueMinor, upstream.minor, downstream.minor)
      viaMinor = via.minor === undefined ? ceiling : amount(via.minor, 1)
      if (viaMinor > ceiling) throw new Error("INVALID_ROUTED_AMOUNT")
      if (viaMinor) {
        for (const edge of [upstream, downstream]) {
          const reservation = reservations.get(edge.id) ?? { ids: [], total: 0 }
          reservation.total += viaMinor
          reservation.ids.push(id)
          reservations.set(edge.id, reservation)
          coverage.push({ edgeId: edge.id, from: edge.from, to: edge.to, minor: viaMinor })
        }
      }
    }
    return { payment, valueMinor, viaMinor, directMinor: 0, unappliedMinor: valueMinor - viaMinor, coverage }
  })
  for (const [edgeId, reservation] of reservations) {
    const capacityMinor = balances.get(edgeId)!
    if (reservation.total > capacityMinor) {
      issues.push({ code: "SHARED_LIMIT", paymentIds: reservation.ids, edgeId, capacityMinor })
    }
  }
  const base = {
    tripId: snapshot.tripId, revision: snapshot.revision, quoteId: snapshot.quoteId,
    ledgerCurrency: snapshot.ledgerCurrency,
    rates: Object.fromEntries((["MYR", "VND"] as Currency[]).flatMap(currency => {
      const rate = snapshot.rates[currency]
      return rate ? [[currency, { numerator: rate.numerator, denominator: rate.denominator }]] : []
    })) as Snapshot["rates"],
  }
  const original = [...snapshot.edges].sort((a, b) => compareIds(a.id, b.id))
  if (issues.some(issue => issue.code === "SHARED_LIMIT")) {
    // There is no valid allocation to preview. Never present tentative
    // reductions as applied or pick one payer/recipient silently.
    return { ...base, issues, remaining: original,
      lines: lines.map(line => ({ ...line, viaMinor: 0, unappliedMinor: line.valueMinor, coverage: [] })) }
  }
  for (const [id, reservation] of reservations) balances.set(id, balances.get(id)! - reservation.total)
  for (const line of lines) {
    const { payer, recipient, id } = line.payment
    const edge = edges.get(pair(payer, recipient))
    if (edge) {
      const directMinor = Math.min(line.unappliedMinor, balances.get(edge.id)!)
      if (directMinor) {
        balances.set(edge.id, balances.get(edge.id)! - directMinor)
        line.coverage.push({ edgeId: edge.id, from: payer, to: recipient, minor: directMinor })
        line.directMinor = directMinor
        line.unappliedMinor -= directMinor
      }
    }
    if (line.unappliedMinor) issues.push({ code: "UNAPPLIED_CASH", paymentIds: [id] })
  }
  return { ...base, lines, issues, remaining: original.map(edge => ({ ...edge, minor: balances.get(edge.id)! })) }
}

export function tenderTotals(lines: PlanLine[]): Partial<Record<Currency, number>> {
  const totals: Partial<Record<Currency, number>> = {}
  for (const { payment } of lines) {
    totals[payment.tenderCurrency] = (totals[payment.tenderCurrency] ?? 0) + payment.tenderMinor
  }
  return totals
}
