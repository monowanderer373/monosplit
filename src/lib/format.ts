export function formatMoney(value: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return 'No trip dates'
  const fmt = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  if (startDate && endDate) return `${fmt(startDate)} - ${fmt(endDate)}`
  if (startDate) return `From ${fmt(startDate)}`
  return `Until ${fmt(endDate as string)}`
}
