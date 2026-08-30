import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuickAddSheet from '../components/QuickAddSheet'
import { useAuth } from '../hooks/useAuth'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { sanitizeReceiptImage, browserTesseractOcrProvider } from '../lib/browserOcrProvider'
import { createBrowserVoiceRecognizer } from '../lib/browserVoiceRecognizer'
import {
  createCaptureReview,
  type CaptureSource,
  type ExpenseDraftReviewModel,
} from '../lib/capturePipeline'
import {
  summarizeCaptureConfidence,
  summarizeCaptureCorrections,
} from '../lib/captureAnalytics'
import type { LedgerExpenseDraft } from '../lib/compileExpense'
import { captureOcrCandidates } from '../lib/ocrCapture'
import { parseNaturalLanguageCapture } from '../lib/naturalLanguageCapture'
import { recordProductEvent } from '../lib/productEvents'
import { captureVoiceTranscript } from '../lib/voiceCapture'
import {
  consumeCaptureQuota,
  ensureCaptureEntitlement,
  type CaptureEntitlement,
} from '../lib/captureEntitlement'
import { SELECTABLE_EXPENSE_CATEGORIES } from '../lib/categories'
import {
  captureMessageKey,
  captureSourceKey,
  captureWarningKey,
  categoryKey,
  useT,
  type TranslationKey,
} from '../lib/i18n'
import { localeForLang } from '../lib/locale'
import { useStore } from '../store/useStore'

type ReviewValues = {
  amount: string
  currency: string
  description: string
  category: string
  occurredOn: string
}

type SmartCaptureSource = Extract<CaptureSource, 'natural_language' | 'voice' | 'ocr'>

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function SmartCapturePage() {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const navigate = useNavigate()
  const { authUser, loading } = useAuth()
  const ledger = usePersonalLedger()
  const [text, setText] = useState('')
  const [review, setReview] = useState<ExpenseDraftReviewModel | null>(null)
  const [values, setValues] = useState<ReviewValues>({
    amount: '',
    currency: authUser?.defaultCurrency ?? 'MYR',
    description: '',
    category: 'Other',
    occurredOn: today(),
  })
  const [processing, setProcessing] = useState<'voice' | 'ocr' | null>(null)
  const [messages, setMessages] = useState<TranslationKey[]>([])
  const [captureStartedAt, setCaptureStartedAt] = useState<number | null>(null)
  const [entitlement, setEntitlement] = useState<CaptureEntitlement | null>(null)
  const [quota, setQuota] = useState<{ used: number; limit: number; source: 'text' | 'ocr' } | null>(null)
  const [fallbackSource, setFallbackSource] = useState<SmartCaptureSource | null>(null)

  useEffect(() => {
    if (!authUser || authUser.isAnonymous) return
    void ensureCaptureEntitlement()
      .then(setEntitlement)
      .catch((cause) => setMessages([captureMessageKey(cause)]))
  }, [authUser])

  const updateFromReview = (nextReview: ExpenseDraftReviewModel) => {
    setReview(nextReview)
    setValues((current) => ({
      amount: nextReview.fields.amount.candidate ?? nextReview.fields.amount.value ?? '',
      currency: nextReview.fields.currency.candidate ?? nextReview.fields.currency.value ?? current.currency,
      description: nextReview.fields.description.candidate ?? nextReview.fields.description.value ?? '',
      category: nextReview.fields.category.candidate ?? nextReview.fields.category.value ?? 'Other',
      occurredOn: nextReview.fields.occurredOn.candidate ?? nextReview.fields.occurredOn.value ?? today(),
    }))
  }

  const recordCaptureSuccess = (
    nextReview: ExpenseDraftReviewModel,
    startedAt: number,
    warningCount: number,
  ) => {
    void recordProductEvent({
      participantId: authUser?.participantId ?? null,
      eventName: 'capture_succeeded',
      source: nextReview.source,
      durationMs: Math.max(0, Date.now() - startedAt),
      succeeded: true,
      metadata: {
        ...summarizeCaptureConfidence(nextReview),
        warningCount,
      },
    })
  }

  const recordCaptureFailure = (
    source: SmartCaptureSource,
    startedAt: number,
    failureStage: 'quota' | 'voice' | 'ocr' | 'processing' | 'parser',
    failureReason:
      | 'quota_unavailable'
      | 'permission_denied'
      | 'unavailable'
      | 'no_speech'
      | 'provider_unavailable'
      | 'invalid_image'
      | 'image_too_large'
      | 'no_text'
      | 'processing_failed'
      | 'parser_failed',
  ) => {
    setFallbackSource(source)
    void recordProductEvent({
      participantId: authUser?.participantId ?? null,
      eventName: 'capture_failed',
      source,
      durationMs: Math.max(0, Date.now() - startedAt),
      succeeded: false,
      metadata: { failureStage, failureReason },
    })
  }

  const buildTextReview = (
    source: Extract<CaptureSource, 'natural_language' | 'voice'>,
    transcript: string,
  ) => {
    setMessages([])
    const result = parseNaturalLanguageCapture(transcript, { referenceDate: today() })
    const nextReview = createCaptureReview({
      source,
      draft: result.draft,
      confidence: result.confidence,
      requiresReview: true,
    })
    updateFromReview(nextReview)
    if (result.warnings.length > 0) {
      setMessages(result.warnings.map(captureWarningKey))
    }
    return { nextReview, warningCount: result.warnings.length }
  }

  const parseText = async () => {
    const startedAt = Date.now()
    setFallbackSource(null)
    try {
      const quota = await consumeCaptureQuota('natural_language')
      setQuota({ used: quota.usageCount, limit: quota.quota, source: 'text' })
    } catch (cause) {
      setMessages([captureMessageKey(cause)])
      recordCaptureFailure('natural_language', startedAt, 'quota', 'quota_unavailable')
      return
    }
    try {
      const { nextReview, warningCount } = buildTextReview('natural_language', text)
      recordCaptureSuccess(nextReview, startedAt, warningCount)
    } catch (cause) {
      setMessages([captureMessageKey(cause)])
      recordCaptureFailure('natural_language', startedAt, 'parser', 'parser_failed')
    }
  }

  const captureVoice = async () => {
    const startedAt = Date.now()
    setProcessing('voice')
    setMessages([])
    setFallbackSource(null)
    const result = await captureVoiceTranscript(createBrowserVoiceRecognizer(localeForLang(lang)))
    setProcessing(null)
    if (!result.ok) {
      setMessages([captureMessageKey(result.error.code)])
      recordCaptureFailure('voice', startedAt, 'voice', result.error.code)
      return
    }
    try {
      const quota = await consumeCaptureQuota('voice')
      setQuota({ used: quota.usageCount, limit: quota.quota, source: 'text' })
    } catch (cause) {
      setMessages([captureMessageKey(cause)])
      recordCaptureFailure('voice', startedAt, 'quota', 'quota_unavailable')
      return
    }
    try {
      setText(result.transcript)
      const { nextReview, warningCount } = buildTextReview('voice', result.transcript)
      recordCaptureSuccess(nextReview, startedAt, warningCount)
    } catch (cause) {
      setMessages([captureMessageKey(cause)])
      recordCaptureFailure('voice', startedAt, 'parser', 'parser_failed')
    }
  }

  const captureReceipt = async (file: File | undefined) => {
    if (!file) return
    const startedAt = Date.now()
    setProcessing('ocr')
    setMessages([])
    setFallbackSource(null)
    try {
      const quota = await consumeCaptureQuota('ocr')
      setQuota({ used: quota.usageCount, limit: quota.quota, source: 'ocr' })
    } catch (cause) {
      setMessages([captureMessageKey(cause)])
      recordCaptureFailure('ocr', startedAt, 'quota', 'quota_unavailable')
      setProcessing(null)
      return
    }
    try {
      const image = await sanitizeReceiptImage(file)
      const result = await captureOcrCandidates(image, browserTesseractOcrProvider)
      if (!result.ok) {
        setMessages([captureMessageKey(result.error.code)])
        recordCaptureFailure('ocr', startedAt, 'ocr', result.error.code)
        return
      }
      const nextReview = createCaptureReview({
        source: 'ocr',
        draft: {
          amount: result.candidates.total?.value,
          currency: authUser?.defaultCurrency ?? 'MYR',
          description: result.candidates.merchant?.value,
          occurredOn: result.candidates.date?.value,
          category: 'Other',
        },
        confidence: {
          amount: result.candidates.total?.confidence,
          currency: 0.5,
          description: result.candidates.merchant?.confidence,
          occurredOn: result.candidates.date?.confidence,
          category: 0,
        },
        requiresReview: true,
      })
      updateFromReview(nextReview)
      recordCaptureSuccess(nextReview, startedAt, 0)
    } catch (cause) {
      setMessages([captureMessageKey(cause)])
      recordCaptureFailure('ocr', startedAt, 'processing', 'processing_failed')
    } finally {
      setProcessing(null)
    }
  }

  const continueToFinalReview = () => {
    if (!review) return
    setCaptureStartedAt(Date.now())
  }

  const saveReviewedDraft = async (
    draft: LedgerExpenseDraft,
    startedAtMs: number,
  ) => {
    if (review && review.source !== 'manual') {
      const corrections = summarizeCaptureCorrections(review, draft)
      void recordProductEvent({
        participantId: authUser?.participantId ?? null,
        eventName: 'capture_reviewed',
        source: review.source,
        succeeded: true,
        correctionCount: corrections.correctionCount,
        metadata: {
          correctionRate: corrections.correctionRate,
          comparedFieldCount: corrections.comparedFieldCount,
        },
      })
    }
    return ledger.saveDraft(draft, startedAtMs)
  }

  const continueManually = () => {
    if (!fallbackSource) return
    void recordProductEvent({
      participantId: authUser?.participantId ?? null,
      eventName: 'capture_manual_fallback',
      source: fallbackSource,
      succeeded: true,
      metadata: { fallbackReason: 'capture_failed' },
    })
    updateFromReview(createCaptureReview({
      source: 'manual',
      draft: {
        currency: authUser?.defaultCurrency ?? 'MYR',
        category: 'Other',
        occurredOn: today(),
      },
      confidence: {},
      requiresReview: true,
    }))
    setMessages([])
    setFallbackSource(null)
  }

  const source = review?.source ?? 'natural_language'
  const canContinue = useMemo(
    () => values.amount.trim() !== '' && /^[A-Z]{3}$/.test(values.currency.toUpperCase()),
    [values.amount, values.currency],
  )
  const captureAvailable = entitlement?.status === 'active'

  if (loading) return <main className="ms-page flex min-h-dvh items-center justify-center">{t('capture.opening')}</main>
  if (!authUser || authUser.isAnonymous || !authUser.participantId) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md text-center">
          <h1 className="text-2xl font-extrabold">{t('capture.accountRequired')}</h1>
          <button className="ms-btn-primary mt-5 w-full" onClick={() => navigate(authUser ? '/profile' : '/login')}>{t('common.continue')}</button>
        </section>
      </main>
    )
  }

  return (
    <main className="ms-page pb-24">
      <header className="mx-auto max-w-2xl">
        <button className="mb-4 text-sm font-bold text-[var(--ms-text-secondary)]" onClick={() => navigate('/')}>{t('capture.backLedger')}</button>
        <p className="ms-label">{t('capture.reviewLabel')}</p>
        <h1 className="mt-1 text-3xl font-extrabold">{t('capture.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ms-text-secondary)]">
          {t('capture.help')}
        </p>
      </header>

      <section className="ms-card-hero mx-auto mt-6 max-w-2xl">
        <label className="block text-xs font-bold text-[var(--ms-text-secondary)]">
          {t('capture.describe')}
          <textarea
            className="ms-input mt-1 min-h-28 w-full resize-y py-3"
            placeholder={t('capture.example')}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button className="ms-btn-primary" disabled={!text.trim() || !captureAvailable} onClick={() => void parseText()}>{t('capture.parseText')}</button>
          <button className="ms-btn-ghost" disabled={processing != null || !captureAvailable} onClick={() => void captureVoice()}>
            {processing === 'voice' ? t('capture.listening') : t('capture.useVoice')}
          </button>
          <label className="ms-btn-ghost flex min-h-11 cursor-pointer items-center justify-center text-center">
            {processing === 'ocr' ? t('capture.readingReceipt') : t('capture.scanReceipt')}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={processing != null || !captureAvailable}
              aria-label={t('capture.scanReceipt')}
              onChange={(event) => void captureReceipt(event.target.files?.[0])}
            />
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--ms-text-muted)]">
          {t('capture.receiptPrivacy')}
        </p>
        {entitlement ? (
          <p className="mt-2 text-xs font-bold text-[var(--ms-text-muted)]">
            {t('capture.quotaAllowance', {
              textVoice: entitlement.captureQuotaMonthly,
              ocr: entitlement.ocrQuotaMonthly,
              status: t(`capture.status.${entitlement.status}` as TranslationKey),
            })}
            {quota ? ` · ${t(quota.source === 'ocr' ? 'capture.quotaOcr' : 'capture.quotaTextVoice', {
              used: quota.used,
              quota: quota.limit,
            })}` : ''}
          </p>
        ) : null}
        {messages.length > 0 ? (
          <div className="mt-3 rounded-xl bg-[var(--ms-info-bg)] px-3 py-2 text-xs text-[var(--ms-info)]">
            {messages.map((message) => <p key={message}>{t(message)}</p>)}
          </div>
        ) : null}
        {fallbackSource ? (
          <button className="ms-btn-ghost mt-3 w-full" onClick={continueManually}>
            {t('capture.manualFallback')}
          </button>
        ) : null}
      </section>

      {review ? (
        <section className="ms-card mx-auto mt-5 max-w-2xl">
          <p className="ms-label">{t('capture.draftLabel', { source: t(captureSourceKey(source)) })}</p>
          <h2 className="mt-1 text-xl font-extrabold">{t('capture.checkFields')}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('expense.amount')}
              <input className="ms-input mt-1 w-full" inputMode="decimal" value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} />
            </label>
            <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('expense.currency')}
              <input className="ms-input mt-1 w-full uppercase" maxLength={3} value={values.currency} onChange={(event) => setValues((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
            </label>
            <label className="text-xs font-bold text-[var(--ms-text-secondary)] sm:col-span-2">
              {t('expense.description')}
              <input className="ms-input mt-1 w-full" value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('expense.category')}
              <select className="ms-input mt-1 w-full" value={values.category} onChange={(event) => setValues((current) => ({ ...current, category: event.target.value }))}>
                {SELECTABLE_EXPENSE_CATEGORIES.map((item) => <option key={item} value={item}>{t(categoryKey(item))}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('expense.date')}
              <input className="ms-input mt-1 w-full" type="date" value={values.occurredOn} onChange={(event) => setValues((current) => ({ ...current, occurredOn: event.target.value }))} />
            </label>
          </div>
          <button className="ms-btn-primary mt-5 w-full" disabled={!canContinue} onClick={continueToFinalReview}>{t('capture.continueReview')}</button>
        </section>
      ) : null}

      {captureStartedAt != null ? (
        <QuickAddSheet
          participantId={authUser.participantId}
          participantName={authUser.displayName ?? authUser.email ?? t('common.me')}
          defaultCurrency={authUser.defaultCurrency ?? 'MYR'}
          startedAtMs={captureStartedAt}
          source={source}
          initialValues={values}
          onClose={() => setCaptureStartedAt(null)}
          onSave={saveReviewedDraft}
        />
      ) : null}
    </main>
  )
}
