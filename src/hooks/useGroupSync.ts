import { useEffect, useRef, useCallback, useState } from 'react'
import { supabaseEnabled } from '../lib/supabase'
import { groupRepository, type RemoteGroupRecord } from '../lib/groupRepository'
import { useStore } from '../store/useStore'
import type { Group } from '../types'

type SyncStatus = 'idle' | 'loading' | 'synced' | 'offline' | 'error'
type GroupSyncOptions = {
  authLoading?: boolean
  authUserId?: string
}
type SaveResult = {
  ok: boolean
  error: string | null
}

function serializeGroup(group: Group | null | undefined): string {
  return group ? JSON.stringify(group) : ''
}

/** Composes the remote blob + owner_id column into the shape the rest of the app expects. */
function toLocalGroup(record: RemoteGroupRecord, groupId: string): Group {
  return {
    ...record.group,
    id: groupId,
    ownerId: record.ownerId ?? undefined,
  }
}

/**
 * Syncs a single group between the local Zustand store and Supabase (via `groupRepository`).
 *
 * - On mount: fetches from the repository and merges into local state
 * - On local changes: upload back through the repository
 * - Subscribes to Realtime for live updates from other devices
 *
 * All last-write-wins version bookkeeping lives here, not in the repository —
 * `groupRepository` only reports/writes remote rows, it never decides whether
 * an update should be applied.
 */
export function useGroupSync(groupId: string | undefined, options?: GroupSyncOptions) {
  const group = useStore((s) => s.groups.find((g) => g.id === groupId))
  const upsertGroup = useStore((s) => s.upsertGroup)
  const replaceGroup = useStore((s) => s.replaceGroup)
  const authLoading = options?.authLoading ?? false
  const authUserId = options?.authUserId

  const [status, setStatus] = useState<SyncStatus>('idle')
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const versionRef = useRef(0)
  // Start as true: skip the very first upload effect that fires from existing
  // localStorage data on mount. Only real local mutations should upload.
  const skipNextUpload = useRef(true)
  const lastSyncedJson = useRef('')
  const uploadInFlight = useRef<{ json: string; promise: Promise<SaveResult> } | null>(null)

  const uploadToSupabase = useCallback(
    async (data: Group) => {
      if (!supabaseEnabled || !data) return { ok: true, error: null } satisfies SaveResult
      const jsonData = serializeGroup(data)
      if (jsonData === lastSyncedJson.current) return { ok: true, error: null } satisfies SaveResult
      if (uploadInFlight.current?.json === jsonData) return uploadInFlight.current.promise

      const promise = (async () => {
        const result = await groupRepository.save(data.id, data, {
          version: versionRef.current,
          ownerId: data.ownerId,
        })
        if (result.ok) {
          versionRef.current = result.version
          lastSyncedJson.current = jsonData
          setLastError(null)
          setStatus('synced')
        } else {
          // RLS or network failure — log with full detail so we can diagnose in DevTools
          console.error('[sync] upload blocked:', result.error)
          setLastError(result.error || 'Unknown sync error')
          setStatus('error')
        }
        return { ok: result.ok, error: result.ok ? null : result.error } satisfies SaveResult
      })()

      uploadInFlight.current = { json: jsonData, promise }
      try {
        return await promise
      } finally {
        if (uploadInFlight.current?.json === jsonData) {
          uploadInFlight.current = null
        }
      }
    },
    [],
  )

  // Initial fetch from the repository
  useEffect(() => {
    if (authLoading) {
      setStatus('loading')
      return
    }

    if (!groupId || !supabaseEnabled) {
      setStatus(supabaseEnabled ? 'idle' : 'offline')
      return
    }

    let cancelled = false
    setStatus('loading')

    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        cancelled = true
        setStatus('offline')
      }
    }, 8000)

    void groupRepository
      .fetch(groupId)
      .then((record) => {
        clearTimeout(timeoutId)
        if (cancelled) return
        if (record) {
          versionRef.current = record.version
          setOwnerId(record.ownerId)
          const syncedGroup = toLocalGroup(record, groupId)
          lastSyncedJson.current = serializeGroup(syncedGroup)
          // Skip the upload triggered by this upsert — we just fetched
          // the authoritative version, there is nothing new to push back.
          skipNextUpload.current = true
          upsertGroup(syncedGroup)
          setStatus('synced')
        } else {
          const localGroup = useStore.getState().groups.find((entry) => entry.id === groupId)
          if (localGroup) {
            // Group exists locally but not remotely — push it
            skipNextUpload.current = false
            void uploadToSupabase(localGroup)
          } else {
            setStatus('idle')
          }
        }
      })
      .catch((e: unknown) => {
        clearTimeout(timeoutId)
        if (!cancelled) {
          console.warn('[sync] fetch error:', e)
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [authLoading, authUserId, groupId, uploadToSupabase, upsertGroup])

  // Subscribe to Realtime changes
  useEffect(() => {
    if (!groupId || !supabaseEnabled) return

    const unsubscribe = groupRepository.subscribe(groupId, (record) => {
      // Use strict < so equal-version events (write conflicts) still get processed
      if (record.version < versionRef.current) return

      versionRef.current = record.version
      setOwnerId(record.ownerId)
      skipNextUpload.current = true
      const syncedGroup = toLocalGroup(record, groupId)
      lastSyncedJson.current = serializeGroup(syncedGroup)
      replaceGroup(groupId, syncedGroup)
      setStatus('synced')
    })

    return unsubscribe
  }, [groupId, replaceGroup])

  // Re-fetch when the tab/app comes back to the foreground.
  // This is the Realtime fallback: on mobile, WebSocket connections drop when
  // the user switches apps. Without this, members never see each other's changes
  // unless they close and reopen the group page.
  useEffect(() => {
    if (!groupId || !supabaseEnabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      void groupRepository.fetch(groupId).then((record) => {
        if (!record) return
        // Always apply on visibility change — user explicitly returned to the page
        if (record.version < versionRef.current) return
        versionRef.current = record.version
        setOwnerId(record.ownerId)
        skipNextUpload.current = true
        const syncedGroup = toLocalGroup(record, groupId)
        lastSyncedJson.current = serializeGroup(syncedGroup)
        upsertGroup(syncedGroup)
        setStatus('synced')
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [groupId, upsertGroup])

  // Upload immediately on local changes so saved expenses don't disappear if the
  // user backgrounds or refreshes the app right after tapping save.
  useEffect(() => {
    if (!group || !supabaseEnabled) return
    if (skipNextUpload.current) {
      skipNextUpload.current = false
      return
    }
    void uploadToSupabase(group)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group])

  const saveGroupNow = useCallback(
    async (nextGroup: Group) => uploadToSupabase(nextGroup),
    [uploadToSupabase],
  )

  return { status, supabaseEnabled, ownerId, setOwnerId, saveGroupNow, lastError }
}
