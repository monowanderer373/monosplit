import type { Currency } from '../types'

export const CURRENCIES: Currency[] = [
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'MYR', label: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'THB', label: 'Thai Baht', symbol: '฿' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'KRW', label: 'Korean Won', symbol: '₩' },
  { code: 'HKD', label: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: 'CN¥' },
  { code: 'TWD', label: 'Taiwan Dollar', symbol: 'NT$' },
]

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

export type RateResult = {
  rate: number
  source: string
  date: string
}

export async function fetchRate(fromCurrency: string, toCurrency: string, date = 'latest'): Promise<RateResult | null> {
  if (fromCurrency === toCurrency) return { rate: 1, source: 'same', date }

  const endpoints = [
    date === 'latest'
      ? `https://api.frankfurter.dev/v1/latest?from=${fromCurrency}&to=${toCurrency}`
      : `https://api.frankfurter.dev/v1/${date}?from=${fromCurrency}&to=${toCurrency}`,
    date === 'latest'
      ? `https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`
      : `https://api.frankfurter.app/${date}?from=${fromCurrency}&to=${toCurrency}`,
  ]

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) })
      if (!response.ok) continue
      const data = await response.json()
      const rate = data?.rates?.[toCurrency]
      if (!rate || Number.isNaN(Number(rate))) continue
      return { rate: Number(rate), source: 'Frankfurter (ECB)', date: data.date ?? date }
    } catch {
      continue
    }
  }

  return null
}
