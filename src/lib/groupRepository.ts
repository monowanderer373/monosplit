import type { Group } from '../types'
import { supabase, supabaseEnabled } from './supabase'

/**
 * A group's remote state: the stored blob, its optimistic-write counter, and
 * the owner column (owner_id lives outside the JSONB blob, see uploadToSupabase
 * history — it must stay queryable for RLS).
 *
 * `group` never carries `ownerId` baked in — callers compose that themselves
 * from `ownerId`, exactly like the pre-repository call sites did. This keeps
 * the repository a thin, opinion-free data-access seam: it reports what the
 * `groups` table contains, nothing more.
 */
export type RemoteGroupRecord = {
  group: Group
  version: number
  ownerId: string | null
}

export type SaveGroupResult = { ok: true; version: number } | { ok: false; error: string }

export type SoftDeleteGroupResult = { ok: boolean; error: string | null }

export interface GroupRepository {
  /** Resolves to `null` when the group has no remote row (not yet synced, or never existed). */
  fetch(groupId: string): Promise<RemoteGroupRecord | null>
  /** Batched `fetch`. Skips any id with no remote row instead of failing. */
  fetchMany(groupIds: string[]): Promise<RemoteGroupRecord[]>
  /** All groups where `owner_id` matches `userId`. */
  listOwned(userId: string): Promise<RemoteGroupRecord[]>
  /**
   * Writes the group and returns the new version. `opts.version` is the
   * version the caller last observed — the next version is always
   * `opts.version + 1`, written unconditionally (no optimistic-lock
   * rejection; this matches the pre-existing last-write-wins behavior).
   */
  save(groupId: string, group: Group, opts: { version: number; ownerId?: string | null }): Promise<SaveGroupResult>
  /** Soft-deletes in place (expects `deletedAt`/`deletedBy` already set on `group`). Does not touch `version`. */
  softDelete(groupId: string, group: Group, ownerId: string | null): Promise<SoftDeleteGroupResult>
  /** Subscribes to remote changes for one group. Returns an unsubscribe function. */
  subscribe(groupId: string, onChange: (record: RemoteGroupRecord) => void): () => void
}

type GroupRow = { id: string; data: unknown; version: number | null; owner_id: string | null }

function toRecord(row: GroupRow): RemoteGroupRecord {
  return {
    group: { ...(row.data as Group), id: row.id },
    version: row.version ?? 0,
    ownerId: row.owner_id ?? null,
  }
}

function stripOwnerId(group: Group): Record<string, unknown> {
  const groupData = { ...group } as Group & { ownerId?: string }
  delete groupData.ownerId
  return groupData as unknown as Record<string, unknown>
}

export function createSupabaseGroupRepository(): GroupRepository {
  return {
    async fetch(groupId) {
      if (!supabase || !supabaseEnabled) return null
      const { data, error } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data?.data) return null
      return toRecord({ id: groupId, data: data.data, version: data.version, owner_id: (data as unknown as GroupRow).owner_id ?? null })
    },

    async fetchMany(groupIds) {
      if (!supabase || !supabaseEnabled || groupIds.length === 0) return []
      const { data, error } = await supabase.from('groups').select('id, data, version, owner_id').in('id', groupIds)
      if (error) throw new Error(error.message)
      return (data ?? [])
        .filter((row): row is GroupRow => !!row.data)
        .map((row) => toRecord(row as GroupRow))
    },

    async listOwned(userId) {
      if (!supabase || !supabaseEnabled) return []
      const { data, error } = await supabase.from('groups').select('id, data, version, owner_id').eq('owner_id', userId)
      if (error) throw new Error(error.message)
      return (data ?? [])
        .filter((row): row is GroupRow => !!row.data)
        .map((row) => toRecord(row as GroupRow))
    },

    async save(groupId, group, opts) {
      if (!supabase || !supabaseEnabled) return { ok: true, version: opts.version }
      const nextVersion = opts.version + 1
      const payload = {
        data: stripOwnerId(group),
        version: nextVersion,
        updated_at: new Date().toISOString(),
        ...(opts.ownerId ? { owner_id: opts.ownerId } : {}),
      }
      const operation =
        opts.version > 0
          ? supabase.from('groups').update(payload).eq('id', groupId)
          : supabase.from('groups').upsert({ id: groupId, ...payload })
      const { error } = await operation
      if (error) return { ok: false, error: error.message || 'Unknown sync error' }
      return { ok: true, version: nextVersion }
    },

    async softDelete(groupId, group, ownerId) {
      if (!supabase || !supabaseEnabled) return { ok: true, error: null }
      const { error } = await supabase.from('groups').upsert({
        id: groupId,
        data: stripOwnerId(group),
        updated_at: new Date().toISOString(),
        ...(ownerId ? { owner_id: ownerId } : {}),
      })
      return { ok: !error, error: error?.message ?? null }
    },

    subscribe(groupId, onChange) {
      if (!supabase || !supabaseEnabled) return () => {}
      const channel = supabase
        .channel(`group-${groupId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
          (payload) => {
            const incoming = payload.new as { data: unknown; version: number; owner_id?: string | null } | undefined
            if (!incoming?.data) return
            onChange(
              toRecord({
                id: groupId,
                data: incoming.data,
                version: incoming.version,
                owner_id: incoming.owner_id ?? null,
              }),
            )
          },
        )
        .subscribe()
      return () => {
        supabase!.removeChannel(channel)
      }
    },
  }
}

export const groupRepository: GroupRepository = createSupabaseGroupRepository()
