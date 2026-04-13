import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { useStore } from '../store/useStore'
import type { Group } from '../types'

type SyncStatus = 'idle' | 'loading' | 'synced' | 'offline' | 'error'
type GroupRow = { data: unknown; version: number; owner_id: string | null }

/**
 * Syncs a single group between the local Zustand store and Supabase.
 *
 * - On mount: fetches from Supabase and merges into local state
 * - On local changes: debounced upsert back to Supabase
 * - Subscribes to Realtime for live updates from other devices
 */
export function useGroupSync(groupId: string | undefined) {
  const group = useStore((s) => s.groups.find((g) => g.id === groupId))
  const upsertGroup = useStore((s) => s.upsertGroup)
  const replaceGroup = useStore((s) => s.replaceGroup)

  const [status, setStatus] = useState<SyncStatus>('idle')
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const versionRef = useRef(0)
  // Start as true: skip the very first debounced-upload effect that fires from
  // existing localStorage data on mount.  Only real local mutations should upload.
  const skipNextUpload = useRef(true)
  const lastUploadJson = useRef('')

  const uploadToSupabase = useCallback(
    async (data: Group) => {
      if (!supabase || !supabaseEnabled || !data) return
      const nextVersion = versionRef.current + 1
      const jsonData = JSON.stringify(data)

      if (jsonData === lastUploadJson.current) return
      lastUploadJson.current = jsonData

      // Strip local-only ownerId field from the JSONB payload — owner is tracked in the owner_id column
      const { ownerId: _ownerId, ...groupData } = data

      const { error } = await supabase.from('groups').upsert({
        id: data.id,
        data: groupData as unknown as Record<string, unknown>,
        version: nextVersion,
        updated_at: new Date().toISOString(),
        // Only set owner_id when we know who owns this group (avoids overwriting others' ownership)
        ...(data.ownerId ? { owner_id: data.ownerId } : {}),
      })
      if (!error) {
        versionRef.current = nextVersion
        setStatus('synced')
      } else {
        console.warn('[sync] upload error:', error.message)
        setStatus('error')
      }
    },
    [],
  )

  // Initial fetch from Supabase
  useEffect(() => {
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
        // Skip the debounced upload triggered by this upsert — we just fetched
        // the authoritative version, there is nothing new to push back.
        skipNextUpload.current = true
        upsertGroup({
          ...remoteGroup,
          id: groupId,
          // Preserve ownerId from the owner_id column (not stored in JSONB)
          ownerId: (data as unknown as GroupRow).owner_id ?? undefined,
        })
        setStatus('synced')
      } else if (group) {
        // Group exists locally but not in Supabase — push it
        skipNextUpload.current = false
        void uploadToSupabase(group)
      } else {
        setStatus('idle')
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
    // Only run on mount / groupId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

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
          replaceGroup(groupId, {
            ...remoteGroup,
            ownerId: incoming.owner_id ?? undefined,
          })
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
        upsertGroup({
          ...(data.data as unknown as Group),
          id: groupId,
          ownerId: (data as unknown as { owner_id?: string | null }).owner_id ?? undefined,
        })
        setStatus('synced')
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [groupId, upsertGroup])

  // Debounced upload on local changes
  useEffect(() => {
    if (!group || !supabase || !supabaseEnabled) return
    if (skipNextUpload.current) {
      skipNextUpload.current = false
      return
    }

    const timer = setTimeout(() => {
      void uploadToSupabase(group)
    }, 600)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group])

  return { status, supabaseEnabled, ownerId, setOwnerId }
}
