import type { ExpenseScope } from '../types'
import { supabase } from './supabase'

export type CaptureTemplate = {
  id: string
  ownerParticipantId: string
  scope: ExpenseScope | null
  spaceId: string | null
  label: string
  description: string | null
  category: string | null
  currency: string | null
  participantIds: string[]
  payerParticipantIds: string[]
  shareDefaults: Record<string, unknown>
  active: boolean
}

export type RecurringRule = {
  id: string
  captureTemplateId: string | null
  defaultDraftFields: Record<string, unknown>
  cadence: 'weekly' | 'monthly'
  localTime: string
  timezone: string
  nextDueOn: string
  endOn: string | null
  active: boolean
}

export type RecurringDraft = {
  id: string
  ruleId: string
  scheduledFor: string
  status: 'pending' | 'accepted' | 'dismissed'
  payload: Record<string, unknown>
}

export const captureRepository = {
  async listTemplates(): Promise<CaptureTemplate[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('capture_templates')
      .select('id, owner_participant_id, scope, space_id, label, description, category, currency, participant_defaults, payer_defaults, share_defaults, active')
      .eq('active', true)
      .order('updated_at', { ascending: false })
    if (error) {
      if (error.code === '42P01') return []
      throw error
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      ownerParticipantId: row.owner_participant_id,
      scope: row.scope as ExpenseScope | null,
      spaceId: row.space_id,
      label: row.label,
      description: row.description,
      category: row.category,
      currency: row.currency,
      participantIds: Array.isArray(row.participant_defaults) ? row.participant_defaults : [],
      payerParticipantIds: Array.isArray(row.payer_defaults) ? row.payer_defaults : [],
      shareDefaults: row.share_defaults && typeof row.share_defaults === 'object'
        ? row.share_defaults as Record<string, unknown>
        : {},
      active: row.active,
    }))
  },

  async createTemplate(input: {
    scope: ExpenseScope | null
    spaceId: string | null
    label: string
    description: string | null
    category: string | null
    currency: string | null
    participantIds: string[]
    payerParticipantIds: string[]
  }): Promise<string> {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('create_capture_template', {
      p_scope: input.scope,
      p_space_id: input.spaceId,
      p_label: input.label,
      p_description: input.description,
      p_category: input.category,
      p_currency: input.currency,
      p_participant_defaults: input.participantIds,
      p_payer_defaults: input.payerParticipantIds,
      p_share_defaults: {},
    })
    if (error || typeof data !== 'string') throw error ?? new Error('template_create_failed')
    return data
  },

  async archiveTemplate(templateId: string): Promise<void> {
    if (!supabase) throw new Error('not_configured')
    const { error } = await supabase.rpc('archive_capture_template', {
      p_template_id: templateId,
    })
    if (error) throw error
  },

  async listRecurringRules(): Promise<RecurringRule[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('recurring_rules')
      .select('id, capture_template_id, default_draft_fields, cadence, local_time, timezone, next_due_on, end_on, active')
      .order('next_due_on')
    if (error) {
      if (error.code === '42P01') return []
      throw error
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      captureTemplateId: row.capture_template_id,
      defaultDraftFields: row.default_draft_fields as Record<string, unknown>,
      cadence: row.cadence as 'weekly' | 'monthly',
      localTime: row.local_time,
      timezone: row.timezone,
      nextDueOn: row.next_due_on,
      endOn: row.end_on,
      active: row.active,
    }))
  },

  async createRecurringRule(input: {
    templateId: string
    cadence: 'weekly' | 'monthly'
    localTime: string
    timezone: string
    nextDueOn: string
    endOn: string | null
  }): Promise<string> {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('create_recurring_rule', {
      p_capture_template_id: input.templateId,
      p_default_draft_fields: {},
      p_cadence: input.cadence,
      p_local_time: input.localTime,
      p_timezone: input.timezone,
      p_next_due_on: input.nextDueOn,
      p_end_on: input.endOn,
    })
    if (error || typeof data !== 'string') throw error ?? new Error('recurring_rule_create_failed')
    return data
  },

  async pauseRecurringRule(ruleId: string): Promise<void> {
    if (!supabase) throw new Error('not_configured')
    const { error } = await supabase.rpc('pause_recurring_rule', { p_rule_id: ruleId })
    if (error) throw error
  },

  async generateDueDrafts(dueThrough = new Date().toISOString().slice(0, 10)): Promise<number> {
    if (!supabase) return 0
    const { data, error } = await supabase.rpc('generate_due_recurring_drafts', {
      p_due_through: dueThrough,
    })
    if (error || typeof data !== 'number') throw error ?? new Error('recurring_generation_failed')
    return data
  },

  async listRecurringDrafts(): Promise<RecurringDraft[]> {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('recurring_drafts')
      .select('id, rule_id, scheduled_for, status, payload')
      .eq('status', 'pending')
      .order('scheduled_for')
    if (error) {
      if (error.code === '42P01') return []
      throw error
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      ruleId: row.rule_id,
      scheduledFor: row.scheduled_for,
      status: row.status as RecurringDraft['status'],
      payload: row.payload as Record<string, unknown>,
    }))
  },

  async respondRecurringDraft(
    draftId: string,
    response: 'accepted' | 'dismissed',
  ): Promise<Record<string, unknown>> {
    if (!supabase) throw new Error('not_configured')
    const { data, error } = await supabase.rpc('respond_to_recurring_draft', {
      p_draft_id: draftId,
      p_response: response,
    })
    if (error || !data || typeof data !== 'object') throw error ?? new Error('recurring_response_failed')
    return data as Record<string, unknown>
  },
}
