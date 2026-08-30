import { beforeEach, describe, expect, it, vi } from 'vitest'

type SupabaseStub = {
  rpc: ReturnType<typeof vi.fn>
}

async function loadAdapter(supabase: SupabaseStub | null) {
  vi.doMock('./supabase', () => ({ supabase }))
  return import('./captureEntitlement')
}

describe('capture entitlement Supabase adapter', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('rejects entitlement lookup when Supabase is unconfigured', async () => {
    const { ensureCaptureEntitlement } = await loadAdapter(null)

    await expect(ensureCaptureEntitlement()).rejects.toThrow('not_configured')
  })

  it('rejects quota consumption when Supabase is unconfigured', async () => {
    const { consumeCaptureQuota } = await loadAdapter(null)

    await expect(consumeCaptureQuota('ocr')).rejects.toThrow('not_configured')
  })

  it('preserves Supabase errors from the entitlement RPC', async () => {
    const error = new Error('database_unavailable')
    const rpc = vi.fn().mockResolvedValue({ data: null, error })
    const { ensureCaptureEntitlement } = await loadAdapter({ rpc })

    await expect(ensureCaptureEntitlement()).rejects.toBe(error)
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('ensure_capture_entitlement')
  })

  it('maps the first entitlement row from Supabase data', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        plan: 'free',
        status: 'active',
        trial_ends_at: null,
        capture_quota_monthly: '100',
        ocr_quota_monthly: 20,
      }],
      error: null,
    })
    const { ensureCaptureEntitlement } = await loadAdapter({ rpc })

    await expect(ensureCaptureEntitlement()).resolves.toEqual({
      plan: 'free',
      status: 'active',
      trialEndsAt: null,
      captureQuotaMonthly: 100,
      ocrQuotaMonthly: 20,
    })
  })

  it('fails with a stable error when entitlement data is missing', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const { ensureCaptureEntitlement } = await loadAdapter({ rpc })

    await expect(ensureCaptureEntitlement()).rejects.toThrow('capture_entitlement_unavailable')
  })

  it('maps quota data and sends only the requested capture source', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        plan: 'free',
        usage_count: '7',
        quota: 500,
        period_month: '2026-08-01',
      },
      error: null,
    })
    const { consumeCaptureQuota } = await loadAdapter({ rpc })

    await expect(consumeCaptureQuota('voice')).resolves.toEqual({
      plan: 'free',
      usageCount: 7,
      quota: 500,
      periodMonth: '2026-08-01',
    })
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('consume_capture_quota', {
      capture_source: 'voice',
    })
  })

  it('preserves Supabase errors from the quota RPC', async () => {
    const error = new Error('quota_service_unavailable')
    const rpc = vi.fn().mockResolvedValue({ data: null, error })
    const { consumeCaptureQuota } = await loadAdapter({ rpc })

    await expect(consumeCaptureQuota('natural_language')).rejects.toBe(error)
  })

  it('fails with a stable error when quota data is missing', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const { consumeCaptureQuota } = await loadAdapter({ rpc })

    await expect(consumeCaptureQuota('ocr')).rejects.toThrow('capture_quota_unavailable')
  })
})

describe('capture localization safety', () => {
  it('keeps every Tabby translation key populated in English and Simplified Chinese', async () => {
    const { missingTranslationKeys } = await import('./i18n')
    const tabbyPrefixes = [
      'common.',
      'role.',
      'scope.',
      'spaceType.',
      'ledger.',
      'capture.',
      'quickAdd.',
      'expenseCapture.',
      'library.',
      'space.',
      'spaceInvite.',
      'friends.',
      'friendInvite.',
      'settlement.',
      'activity.',
      'friendlyError.',
    ]

    expect(missingTranslationKeys('en', tabbyPrefixes)).toEqual([])
    expect(missingTranslationKeys('zh', tabbyPrefixes)).toEqual([])
  })

  it('maps capture machine codes to friendly localized copy', async () => {
    const { captureMessageKey, t } = await import('./i18n')
    const codes = [
      'capture_quota_exceeded',
      'capture_rate_limit_exceeded',
      'capture_entitlement_inactive',
      'permission_denied',
      'provider_unavailable',
      'invalid_image',
    ]

    for (const code of codes) {
      const key = captureMessageKey(code)
      expect(t(key, 'en')).not.toContain(code)
      expect(t(key, 'zh')).not.toContain(code)
      expect(t(key, 'en')).not.toMatch(/\b[a-z]+_[a-z_]+\b/)
      expect(t(key, 'zh')).not.toMatch(/\b[a-z]+_[a-z_]+\b/)
    }
  })
})
