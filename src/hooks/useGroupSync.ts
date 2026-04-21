import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { useStore } from '../store/useStore'
import type { Group } from '../types'

type SyncStatus = 'idle' | 'loading' | 'synced' | 'offline' | 'error'
type GroupRow = { data: unknown; version: number; owner_id: string | null }
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

/**
 * Syncs a single group between the local Zustand store and Supabase.
 *
 * - On mount: fetches from Supabase and merges into local state
 * - On local changes: upload back to Supabase
 * - Subscribes to Realtime for live updates from other devices
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
      if (!supabase || !supabaseEnabled || !data) return { ok: true, error: null } satisfies SaveResult
      const nextVersion = versionRef.current + 1
      const jsonData = serializeGroup(data)

      // #region agent log
      fetch('http://127.0.0.1:7535/ingest/48c41b95-ad70-4dfa-a2e2-dad5cb32b9bc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3a896c'},body:JSON.stringify({sessionId:'3a896c',location:'useGroupSync.ts:uploadToSupabase',message:'upload attempt',data:{groupId:data.id,peopleCount:data.people?.length,nextVersion,sameAsLast:jsonData===lastSyncedJson.current},hypothesisId:'H-D,H-E',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (jsonData === lastSyncedJson.current) return { ok: true, error: null } satisfies SaveResult
      if (uploadInFlight.current?.json === jsonData) return uploadInFlight.current.promise

      const promise = (async () => {
        // Strip local-only ownerId field from the JSONB payload — owner is tracked in the owner_id column
        const groupData = { ...data }
        delete (groupData as Group & { ownerId?: string }).ownerId

        const payload = {
          data: groupData as unknown as Record<string, unknown>,
          version: nextVersion,
          updated_at: new Date().toISOString(),
          ...(data.ownerId ? { owner_id: data.ownerId } : {}),
        }
        const operation =
          versionRef.current > 0
            ? supabase.from('groups').update(payload).eq('id', data.id)
            : supabase.from('groups').upsert({
                id: data.id,
                ...payload,
              })
        const { error } = await operation
        // #region agent log
        fetch('http://127.0.0.1:7535/ingest/48c41b95-ad70-4dfa-a2e2-dad5cb32b9bc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3a896c'},body:JSON.stringify({sessionId:'3a896c',location:'useGroupSync.ts:uploadToSupabase',message:'upload result',data:{groupId:data.id,error:error?.message??null,newVersion:nextVersion},hypothesisId:'H-D',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!error) {
          versionRef.current = nextVersion
          lastSyncedJson.current = jsonData
          setLastError(null)
          setStatus('synced')
        } else {
          // RLS or network failure — log with full detail so we can diagnose in DevTools
          console.error('[sync] upload blocked:', error.message, '| code:', error.code, '| hint:', error.hint)
          setLastError(error.message || 'Unknown sync error')
          setStatus('error')
        }
        return { ok: !error, error: error?.message ?? null } satisfies SaveResult
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

  // Initial fetch from Supabase
  useEffect(() => {
    if (authLoading) {
      setStatus('loading')
      return
    }

    if (!groupId || !supabase || !supabaseEnabled) {
      setStatus(supabaseEnabled ? 'idle' : 'offline')
      return
    }

    let cancelled = false
    setStatus('loading')

    const controller = new AbortController()
    // Treat as offline if the fetch hasn't resolved within 8 s on slow mobile
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        cancelled = true
        controller.abort()
        setStatus('offline')
      }
    }, 8000)

    void Promise.resolve(
      supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle()
    ).then(({ data, error }) => {
      clearTimeout(timeoutId)
      if (cancelled) return
      if (error) {
        console.warn('[sync] fetch error:', error.message)
        setStatus('error')
        return
      }
      if (data?.data) {
        versionRef.current = data.version ?? 0
        setOwnerId((data as unknown as GroupRow).owner_id ?? null)
        const remoteGroup = data.data as unknown as Group
        const syncedGroup = {
          ...remoteGroup,
          id: groupId,
          // Preserve ownerId from the owner_id column (not stored in JSONB)
          ownerId: (data as unknown as GroupRow).owner_id ?? undefined,
        }
        lastSyncedJson.current = serializeGroup(syncedGroup)
        // Skip the upload triggered by this upsert — we just fetched
        // the authoritative version, there is nothing new to push back.
        skipNextUpload.current = true
        upsertGroup(syncedGroup)
        setStatus('synced')
      } else {
        const localGroup = useStore.getState().groups.find((entry) => entry.id === groupId)
        if (localGroup) {
        // Group exists locally but not in Supabase — push it
        skipNextUpload.current = false
          void uploadToSupabase(localGroup)
        } else {
          setStatus('idle')
        }
      }
    }).catch((e: unknown) => {
      clearTimeout(timeoutId)
      if (!cancelled) {
        console.warn('[sync] fetch exception:', e)
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
    if (!groupId || !supabase || !supabaseEnabled) return

    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'groups',
          filter: `id=eq.${groupId}`,
        },
        (payload) => {
          const incoming = payload.new as { data: unknown; version: number; owner_id?: string | null } | undefined
          if (!incoming?.data) return
          const incomingVersion = incoming.version ?? 0
          // Use strict < so equal-version events (write conflicts) still get processed
          if (incomingVersion < versionRef.current) return

          versionRef.current = incomingVersion
          // Keep ownerId from the separate owner_id column (not stored in JSONB)
          if (incoming.owner_id !== undefined) setOwnerId(incoming.owner_id ?? null)
          skipNextUpload.current = true
          const remoteGroup = incoming.data as unknown as Group
          const syncedGroup = {
            ...remoteGroup,
            ownerId: incoming.owner_id ?? undefined,
          }
          lastSyncedJson.current = serializeGroup(syncedGroup)
          replaceGroup(groupId, syncedGroup)
          setStatus('synced')
        },
      )
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [groupId, replaceGroup])

  // Re-fetch when the tab/app comes back to the foreground.
  // This is the Realtime fallback: on mobile, WebSocket connections drop when
  // the user switches apps. Without this, members never see each other's changes
  // unless they close and reopen the group page.
  useEffect(() => {
    if (!groupId || !supabase || !supabaseEnabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      void Promise.resolve(
        supabase!.from('groups').select('*').eq('id', groupId).maybeSingle(),
      ).then(({ data }) => {
        if (!data?.data) return
        const incomingVersion = (data.version as number) ?? 0
        // Always apply on visibility change — user explicitly returned to the page
        if (incomingVersion < versionRef.current) return
        versionRef.current = incomingVersion
        if ((data as unknown as { owner_id?: string | null }).owner_id !== undefined) {
          setOwnerId((data as unknown as { owner_id: string | null }).owner_id ?? null)
        }
        skipNextUpload.current = true
        const syncedGroup = {
          ...(data.data as unknown as Group),
          id: groupId,
          ownerId: (data as unknown as { owner_id?: string | null }).owner_id ?? undefined,
        }
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
    if (!group || !supabase || !supabaseEnabled) return
    // #region agent log
    fetch('http://127.0.0.1:7535/ingest/48c41b95-ad70-4dfa-a2e2-dad5cb32b9bc',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3a896c'},body:JSON.stringify({sessionId:'3a896c',location:'useGroupSync.ts:debouncedEffect',message:'effect ran',data:{groupId:group.id,skipNextUpload:skipNextUpload.current,peopleCount:group.people?.length},hypothesisId:'H-C,H-E',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
