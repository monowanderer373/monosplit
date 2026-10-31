import { supabase } from './supabase'

export type PersonalExpenseAffiliation = {
  tripId?: string | null
  id: string
  ownerParticipantId: string
  expenseId: string
  label: string
  archivedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type PersonalExpenseAffiliationRow = {
  trip_id?: string | null
  id: string
  owner_participant_id: string
  expense_id: string
  label: string
  archived_at: string | null
  version: number
  created_at: string
  updated_at: string
}

export function mapPersonalExpenseAffiliationRow(
  row: PersonalExpenseAffiliationRow,
): PersonalExpenseAffiliation {
  return {
    ...(row.trip_id?{tripId:row.trip_id}:{}),
    id: row.id,
    ownerParticipantId: row.owner_participant_id,
    expenseId: row.expense_id,
    label: row.label,
    archivedAt: row.archived_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const personalExpenseAffiliationRepository = {
  async listForTrip(tripId: string, ownerId: string): Promise<PersonalExpenseAffiliation[]> {
    if (!supabase) throw new Error('not_configured')
    const rows: PersonalExpenseAffiliation[] = []
    let after: string | null = null
    for (;;) {
      let query = supabase.from('personal_expense_affiliations').select('*')
        .eq('owner_participant_id', ownerId).eq('trip_id', tripId)
        .is('archived_at', null).order('id').limit(1000)
      if (after) query = query.gt('id', after)
      const {data, error} = await query
      if (error) throw error
      if (!Array.isArray(data)) throw new Error('invalid_affiliation_page')
      const next = data.at(-1)?.id
      if (data.length && (typeof next !== 'string' || after && next <= after)) {
        throw new Error('invalid_affiliation_page')
      }
      rows.push(...data.map(row => mapPersonalExpenseAffiliationRow(row as PersonalExpenseAffiliationRow)))
      if (data.length < 1000) return rows
      after = next
    }
  },

  async list(input: { includeArchived?: boolean } = {}): Promise<PersonalExpenseAffiliation[]> {
    if (!supabase) return []

    let query = supabase
      .from('personal_expense_affiliations')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!input.includeArchived) query = query.is('archived_at', null)

    const { data, error } = await query
    if (error) throw error

    return (data ?? []).map((row) => mapPersonalExpenseAffiliationRow(
      row as PersonalExpenseAffiliationRow,
    ))
  },

  async upsert(input: {
    expenseId: string
    label: string
    expectedVersion?: number | null
  }): Promise<string> {
    if (!supabase) throw new Error('not_configured')

    const { data, error } = await supabase.rpc('upsert_personal_expense_affiliation', {
      target_expense_id: input.expenseId,
      trip_label: input.label,
      expected_version: input.expectedVersion ?? null,
    })

    if (error || typeof data !== 'string') {
      throw error ?? new Error('expense_affiliation_upsert_failed')
    }
    return data
  },

  async archive(affiliationId: string, expectedVersion: number): Promise<string> {
    if (!supabase) throw new Error('not_configured')

    const { data, error } = await supabase.rpc('archive_personal_expense_affiliation', {
      target_affiliation_id: affiliationId,
      expected_version: expectedVersion,
    })

    if (error || typeof data !== 'string') {
      throw error ?? new Error('expense_affiliation_archive_failed')
    }
    return data
  },
}
