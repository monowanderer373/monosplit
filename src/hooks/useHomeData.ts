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

const loading = <T,>(): Ready<T> => ({ status: 'loading', data: null })

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
  const [accounts, setAccounts] = useState<Ready<PersonalAccountHomeSnapshot>>(loading)
  const [people, setPeople] = useState<Ready<PersonRelationship[]>>(loading)
  const [settlements, setSettlements] = useState<Ready<SettlementPayment[]>>(loading)
  const [spaces, setSpaces] = useState<Ready<SpaceWithRole[]>>(loading)
  const [affiliations, setAffiliations] = useState<Ready<PersonalExpenseAffiliation[]>>(loading)

  if (loadedFor !== participantId) {
    setLoadedFor(participantId)
    setAccounts(loading())
    setPeople(loading())
    setSettlements(loading())
    setSpaces(loading())
    setAffiliations(loading())
  }

  useEffect(() => {
    if (!participantId) return
    const requestParticipantId = participantId
    let cancelled = false
    void (async () => {
      const [nextAccounts, nextPeople, nextSettlements, nextSpaces, nextAffiliations] = await Promise.all([
        settle(loadPersonalAccountHome({ includeAllActivity })),
        settle(personRepository.listPeople()),
        settle(settlementRepository.listSettlements()),
        settle(spaceRepository.list()),
        settle(personalExpenseAffiliationRepository.list()),
      ])
      if (cancelled || !shouldApplyHomeResult(requestParticipantId, currentParticipantRef.current)) return
      setAccounts(nextAccounts)
      setPeople(nextPeople)
      setSettlements(nextSettlements)
      setSpaces(nextSpaces)
      setAffiliations(nextAffiliations)
    })()
    return () => {
      cancelled = true
    }
  }, [includeAllActivity, participantId, refreshKey])

  return { accounts, people, settlements, spaces, affiliations }
}
