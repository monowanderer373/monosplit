import { useEffect, useRef, useState } from 'react'
import { personalExpenseAffiliationRepository, type PersonalExpenseAffiliation } from '../lib/personalExpenseAffiliationRepository'
import { personRepository } from '../lib/personRepository'
import {
  loadPersonalAccountHome,
  type PersonalAccountHomeSnapshot,
} from '../lib/personalAccountReadRepository'
import { settlementRepository, type SettlementPayment } from '../lib/settlementRepository'
import { spaceRepository, type SpaceWithRole } from '../lib/spaceRepository'
import type { PersonRelationship } from '../types'

type Ready<T> = { status: 'loading' | 'error' | 'ready'; data: T | null }

type VerifiedHomeCache = {
  accounts?: PersonalAccountHomeSnapshot
  people?: PersonRelationship[]
  settlements?: SettlementPayment[]
  spaces?: SpaceWithRole[]
  affiliations?: PersonalExpenseAffiliation[]
}

const verifiedHomeCache = new Map<string, VerifiedHomeCache>()

export function resetVerifiedHomeCache() {
  verifiedHomeCache.clear()
}

const loading = <T,>(): Ready<T> => ({ status: 'loading', data: null })

function cachedSlice<T>(participantId: string | null, key: keyof VerifiedHomeCache): Ready<T> {
  if (!participantId) return loading()
  const value = verifiedHomeCache.get(participantId)?.[key]
  if (value === undefined) return loading()
  return { status: 'ready', data: value as T }
}

function rememberSlice<K extends keyof VerifiedHomeCache>(
  participantId: string,
  key: K,
  value: NonNullable<VerifiedHomeCache[K]>,
) {
  const current = verifiedHomeCache.get(participantId) ?? {}
  verifiedHomeCache.set(participantId, { ...current, [key]: value })
}

function forgetSlice(participantId: string, key: keyof VerifiedHomeCache) {
  const current = verifiedHomeCache.get(participantId)
  if (!current) return
  delete current[key]
  verifiedHomeCache.set(participantId, current)
}

function hasVerifiedHome(participantId: string | null) {
  if (!participantId) return false
  const cached = verifiedHomeCache.get(participantId)
  return Boolean(cached && Object.keys(cached).length > 0)
}

async function settle<T>(work: Promise<T>): Promise<Ready<T>> {
  try {
    return { status: 'ready', data: await work }
  } catch {
    return { status: 'error', data: null }
  }
}

export function shouldApplyHomeResult(
  requestParticipantId: string,
  currentParticipantId: string | null,
): boolean {
  return requestParticipantId === currentParticipantId
}

export function useHomeData(
  participantId: string | null,
  refreshKey: string,
  includeAllActivity: boolean,
) {
  const currentParticipantRef = useRef(participantId)
  // Updated during render so a resolved request cannot commit the previous
  // participant before the passive effect cleanup runs.
  // eslint-disable-next-line react-hooks/refs -- React documents this identity adjustment
  if (currentParticipantRef.current !== participantId) {
    // eslint-disable-next-line react-hooks/refs -- React documents this identity adjustment
    currentParticipantRef.current = participantId
  }
  const [loadedFor, setLoadedFor] = useState(participantId)
  const [accounts, setAccounts] = useState<Ready<PersonalAccountHomeSnapshot>>(() => cachedSlice(participantId, 'accounts'))
  const [people, setPeople] = useState<Ready<PersonRelationship[]>>(() => cachedSlice(participantId, 'people'))
  const [settlements, setSettlements] = useState<Ready<SettlementPayment[]>>(() => cachedSlice(participantId, 'settlements'))
  const [spaces, setSpaces] = useState<Ready<SpaceWithRole[]>>(() => cachedSlice(participantId, 'spaces'))
  const [affiliations, setAffiliations] = useState<Ready<PersonalExpenseAffiliation[]>>(() => cachedSlice(participantId, 'affiliations'))
  const [refreshing, setRefreshing] = useState(() => hasVerifiedHome(participantId))

  if (loadedFor !== participantId) {
    setLoadedFor(participantId)
    setAccounts(cachedSlice(participantId, 'accounts'))
    setPeople(cachedSlice(participantId, 'people'))
    setSettlements(cachedSlice(participantId, 'settlements'))
    setSpaces(cachedSlice(participantId, 'spaces'))
    setAffiliations(cachedSlice(participantId, 'affiliations'))
    setRefreshing(hasVerifiedHome(participantId))
  }

  useEffect(() => {
    if (!participantId) return
    const requestParticipantId = participantId
    let cancelled = false
    setRefreshing(hasVerifiedHome(requestParticipantId))
    void (async () => {
      const [nextAccounts, nextPeople, nextSettlements, nextSpaces, nextAffiliations] = await Promise.all([
        settle(loadPersonalAccountHome({ includeAllActivity })),
        settle(personRepository.listPeople()),
        settle(settlementRepository.listSettlements()),
        settle(spaceRepository.list()),
        settle(personalExpenseAffiliationRepository.list()),
      ])
      if (cancelled || !shouldApplyHomeResult(requestParticipantId, currentParticipantRef.current)) return
      applySlice(requestParticipantId, 'accounts', nextAccounts, setAccounts)
      applySlice(requestParticipantId, 'people', nextPeople, setPeople)
      applySlice(requestParticipantId, 'settlements', nextSettlements, setSettlements)
      applySlice(requestParticipantId, 'spaces', nextSpaces, setSpaces)
      applySlice(requestParticipantId, 'affiliations', nextAffiliations, setAffiliations)
      setRefreshing(false)
    })()
    return () => {
      cancelled = true
    }
  }, [includeAllActivity, participantId, refreshKey])

  return { accounts, people, settlements, spaces, affiliations, refreshing }
}

function applySlice<K extends keyof VerifiedHomeCache>(
  participantId: string,
  key: K,
  next: Ready<NonNullable<VerifiedHomeCache[K]>>,
  setSlice: (value: Ready<NonNullable<VerifiedHomeCache[K]>>) => void,
) {
  if (next.status === 'ready' && next.data) {
    rememberSlice(participantId, key, next.data)
    setSlice(next)
    return
  }
  forgetSlice(participantId, key)
  setSlice({ status: 'error', data: null })
}
