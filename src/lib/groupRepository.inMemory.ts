import type { Group } from '../types'
import type { GroupRepository, RemoteGroupRecord } from './groupRepository'

export type InMemoryGroupRepository = GroupRepository & {
  /** Test hook: makes the next `save` call resolve with `{ ok: false, error: message }` instead of writing. */
  __setNextSaveError(message: string): void
  /** Test hook: makes the next `fetch` call reject with `message` instead of resolving. */
  __setNextFetchError(message: string): void
}

/**
 * Hand-written in-memory adapter for `GroupRepository`, used by tests as the
 * second seam implementation. See docs/adr for why this was chosen over PGlite:
 * the repository interface doesn't own RLS/SQL semantics, so a lightweight
 * map-backed fake is enough to prove the seam (fetch/save/subscribe/version
 * bookkeeping/softDelete) without a WASM Postgres dependency.
 */
export function createInMemoryGroupRepository(): InMemoryGroupRepository {
  const store = new Map<string, RemoteGroupRecord>()
  const listeners = new Map<string, Set<(record: RemoteGroupRecord) => void>>()
  let nextSaveError: string | null = null
  let nextFetchError: string | null = null

  function notify(groupId: string, record: RemoteGroupRecord) {
    for (const listener of listeners.get(groupId) ?? []) listener(record)
  }

  return {
    async fetch(groupId) {
      if (nextFetchError) {
        const message = nextFetchError
        nextFetchError = null
        throw new Error(message)
      }
      const record = store.get(groupId)
      return record ? { ...record } : null
    },

    async fetchMany(groupIds) {
      return groupIds.flatMap((id) => {
        const record = store.get(id)
        return record ? [{ ...record }] : []
      })
    },

    async listOwned(userId) {
      return [...store.values()].filter((record) => record.ownerId === userId).map((record) => ({ ...record }))
    },

    async save(groupId, group: Group, opts) {
      if (nextSaveError) {
        const message = nextSaveError
        nextSaveError = null
        return { ok: false, error: message }
      }
      const version = opts.version + 1
      const ownerId = opts.ownerId ?? store.get(groupId)?.ownerId ?? null
      const record: RemoteGroupRecord = { group, version, ownerId }
      store.set(groupId, record)
      notify(groupId, record)
      return { ok: true, version }
    },

    async softDelete(groupId, group, ownerId) {
      const existing = store.get(groupId)
      const record: RemoteGroupRecord = {
        group,
        version: existing?.version ?? 0,
        ownerId: ownerId ?? existing?.ownerId ?? null,
      }
      store.set(groupId, record)
      notify(groupId, record)
      return { ok: true, error: null }
    },

    subscribe(groupId, onChange) {
      const set = listeners.get(groupId) ?? new Set()
      set.add(onChange)
      listeners.set(groupId, set)
      return () => set.delete(onChange)
    },

    __setNextSaveError(message) {
      nextSaveError = message
    },
    __setNextFetchError(message) {
      nextFetchError = message
    },
  }
}
