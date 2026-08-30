import type { Lang } from './i18n'

export function localeForLang(lang: Lang): string {
  return lang === 'zh' ? 'zh-CN' : 'en-MY'
}

export function formatDate(value: string, lang: Lang): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(localeForLang(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(value: string, lang: Lang): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(localeForLang(lang), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
