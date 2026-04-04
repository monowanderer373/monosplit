import type { Group } from '../types'

export function exportGroupAsJson(group: Group): void {
  const safeName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  const date = new Date().toISOString().slice(0, 10)
  const filename = `monosplit-${safeName}-${date}.json`

  const blob = new Blob([JSON.stringify(group, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportGroupAsCsv(group: Group): void {
  const safeName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  const date = new Date().toISOString().slice(0, 10)
  const filename = `monosplit-${safeName}-${date}.csv`

  const personName = (id: string) => group.people.find((p) => p.id === id)?.name ?? 'Unknown'

  const header = 'Date,Description,Category,Payer,Amount,Paid Currency,Repay Currency,Split Mode'
  const rows = group.expenses
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map((e) => {
      const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`
      return [
        e.date,
        escapeCsv(e.description),
        e.category,
        escapeCsv(personName(e.payerId)),
        e.amount,
        e.paidCurrency,
        e.repayCurrency,
        e.splitMode,
      ].join(',')
    })

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseImportedJson(text: string): Group | null {
  try {
    const data = JSON.parse(text)
    if (!data || typeof data !== 'object') return null
    if (!data.name || !Array.isArray(data.people) || !Array.isArray(data.expenses)) return null
    return data as Group
  } catch {
    return null
  }
}
