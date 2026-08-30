import { supabase } from './supabase'

export type CaptureEntitlement = {
  plan: 'free' | 'trial' | 'pro'
  status: 'active' | 'past_due' | 'cancelled'
  trialEndsAt: string | null
  captureQuotaMonthly: number
  ocrQuotaMonthly: number
}

export type CaptureQuotaReceipt = {
  plan: CaptureEntitlement['plan']
  usageCount: number
  quota: number
  periodMonth: string
}

function firstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return data[0] as Record<string, unknown> | undefined ?? null
  return data && typeof data === 'object' ? data as Record<string, unknown> : null
}

export async function ensureCaptureEntitlement(): Promise<CaptureEntitlement> {
  if (!supabase) throw new Error('not_configured')
  const { data, error } = await supabase.rpc('ensure_capture_entitlement')
  const row = firstRow(data)
  if (error || !row) throw error ?? new Error('capture_entitlement_unavailable')
  return {
    plan: row.plan as CaptureEntitlement['plan'],
    status: row.status as CaptureEntitlement['status'],
    trialEndsAt: row.trial_ends_at as string | null,
    captureQuotaMonthly: Number(row.capture_quota_monthly),
    ocrQuotaMonthly: Number(row.ocr_quota_monthly),
  }
}

export async function consumeCaptureQuota(
  source: 'natural_language' | 'voice' | 'ocr',
): Promise<CaptureQuotaReceipt> {
  if (!supabase) throw new Error('not_configured')
  const { data, error } = await supabase.rpc('consume_capture_quota', {
    capture_source: source,
  })
  const row = firstRow(data)
  if (error || !row) throw error ?? new Error('capture_quota_unavailable')
  return {
    plan: row.plan as CaptureEntitlement['plan'],
    usageCount: Number(row.usage_count),
    quota: Number(row.quota),
    periodMonth: String(row.period_month),
  }
}
