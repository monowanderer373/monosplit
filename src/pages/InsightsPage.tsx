import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { useT } from '../lib/i18n'
import { isBookedHomeExpense, localCalendarDate, monthlyPersonalSpending } from '../lib/homeView'
import { localeForLang } from '../lib/locale'
import { formatMinorAmount } from '../lib/money'
import { useStore } from '../store/useStore'

export default function InsightsPage() {
  const t = useT()
  const navigate = useNavigate()
  const lang = useStore((state) => state.lang)
  const { authUser, loading } = useAuth()
  const ledger = usePersonalLedger()
  const totals = useMemo(() => {
    if (!ledger.participantId) return []
    const today = localCalendarDate(new Date(), authUser?.timezone ?? 'Asia/Kuala_Lumpur')
    const rows = ledger.rows.filter((row) => isBookedHomeExpense(row.expense, ledger.participantId!))
    return monthlyPersonalSpending(rows, today.slice(0, 7))
  }, [authUser?.timezone, ledger.participantId, ledger.rows])

  if (loading) {
    return <main className="ms-page flex min-h-dvh items-center justify-center">{t('ledger.opening')}</main>
  }

  if (!authUser) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <button className="ms-btn-primary" type="button" onClick={() => navigate('/login')}>{t('common.signIn')}</button>
      </main>
    )
  }

  return (
    <main className="ms-page pb-28">
      <header className="mx-auto max-w-xl">
        <h1 className="text-3xl font-extrabold">{t('insights.title')}</h1>
        <p className="mt-2 text-sm text-[var(--ms-text-secondary)]">{t('insights.help')}</p>
      </header>
      <section className="mx-auto mt-6 max-w-xl rounded-[20px] bg-[#f3ede4] p-4">
        <p className="text-xs font-bold text-[#77736e]">{t('home.monthSpending')}</p>
        <p className="mt-2 text-lg font-extrabold">
          {totals.length === 0
            ? '—'
            : totals.map((line) => formatMinorAmount(line.amountMinor, line.currency, localeForLang(lang))).join(' · ')}
        </p>
      </section>
    </main>
  )
}
