import type { LedgerDraftParticipant } from './compileExpense'
import {
  isSpaceExpenseEligible,
  isValidPersonExpenseTarget,
  type MoneyContextRef,
} from './moneyContext'
import { personRepository } from './personRepository'
import {
  isPersonDirectEligible,
  resolvePersonFinancialParticipant,
} from './personState'
import { spaceRepository } from './spaceRepository'
import type {
  Participant,
  PersonRelationship,
  SpaceMember,
} from '../types'
import type { ResolvedMoneyContext } from './universalQuickAdd'

export type MoneyContextCatalog = Readonly<{
  people: Extract<MoneyContextRef, { kind: 'person' }>[]
  groups: Extract<MoneyContextRef, { kind: 'space' }>[]
  trips: Extract<MoneyContextRef, { kind: 'space' }>[]
  peopleParticipants: LedgerDraftParticipant[]
}>

export const EMPTY_MONEY_CONTEXT_CATALOG: MoneyContextCatalog = {
  people: [],
  groups: [],
  trips: [],
  peopleParticipants: [],
}

export function personToMoneyContext(
  person: PersonRelationship,
): Extract<MoneyContextRef, { kind: 'person' }> | null {
  if (!isPersonDirectEligible(person)) return null
  const participant = resolvePersonFinancialParticipant(person)
  if (
    !participant
    || !isValidPersonExpenseTarget({
      id: person.id,
      displayName: person.displayName,
    })
  ) return null
  return {
    kind: 'person',
    personId: person.id,
    participantId: participant.id,
    participantIds: [
      participant.id,
      ...person.manualParticipantIds.filter((id) => id !== participant.id),
    ],
    participantKind: participant.kind,
    displayName: person.displayName,
  }
}

export async function loadMoneyContextCatalog(input: {
  isAnonymous: boolean
  excludedSpaceId?: string
}): Promise<MoneyContextCatalog> {
  const [spaces, personRelationships] = await Promise.all([
    spaceRepository.list(),
    input.isAnonymous ? Promise.resolve([]) : personRepository.listPeople(),
  ])
  const people = personRelationships
    .map(personToMoneyContext)
    .filter(
      (
        person,
      ): person is Extract<MoneyContextRef, { kind: 'person' }> =>
        Boolean(person),
    )
    .sort((left, right) => left.displayName.localeCompare(right.displayName))

  const eligibleSpaces = spaces
    .filter(
      ({ space, role }) =>
        space.id !== input.excludedSpaceId
        && isSpaceExpenseEligible(space, role),
    )
    .map(({ space }) => ({
      kind: 'space' as const,
      spaceId: space.id,
      spaceType: space.type,
      displayName: space.name,
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))

  return {
    people,
    peopleParticipants: people.map((person) => ({
      id: person.participantId,
      displayName: person.displayName,
      kind: person.participantKind,
    })),
    groups: eligibleSpaces.filter((space) => space.spaceType === 'group'),
    trips: eligibleSpaces.filter((space) => space.spaceType === 'trip'),
  }
}

export async function resolveMoneyContext(input: {
  ref: MoneyContextRef
  currentParticipant: LedgerDraftParticipant
  defaultCurrency: string
  isAnonymous: boolean
}): Promise<ResolvedMoneyContext | null> {
  if (input.ref.kind === 'personal') {
    if (input.isAnonymous) return null
    return {
      ref: input.ref,
      currentParticipantId: input.currentParticipant.id,
      availableParticipants: [input.currentParticipant],
      defaultCurrency: input.defaultCurrency,
    }
  }

  if (input.ref.kind === 'person') {
    if (input.isAnonymous) return null
    const personId = input.ref.personId
    const catalog = await loadMoneyContextCatalog({ isAnonymous: false })
    const personRef = catalog.people.find(
      (person) => person.personId === personId,
    )
    if (!personRef) return null
    return {
      ref: personRef,
      currentParticipantId: input.currentParticipant.id,
      availableParticipants: [
        input.currentParticipant,
        ...catalog.peopleParticipants.filter((participant) =>
          participant.id !== input.currentParticipant.id,
        ),
      ],
      defaultCurrency: input.defaultCurrency,
    }
  }

  const [entry, members] = await Promise.all([
    spaceRepository.get(input.ref.spaceId),
    spaceRepository.listMembers(input.ref.spaceId),
  ])
  if (
    !entry
    || !isSpaceExpenseEligible(entry.space, entry.role)
  ) return null

  const participants = members.map(
    ({
      participant,
    }: {
      member: SpaceMember
      participant: Participant
    }): LedgerDraftParticipant => ({
      id: participant.id,
      displayName: participant.displayName,
      kind: participant.kind,
    }),
  )
  if (!participants.some((participant) => participant.id === input.currentParticipant.id)) {
    return null
  }

  return {
    ref: {
      kind: 'space',
      spaceId: entry.space.id,
      spaceType: entry.space.type,
      displayName: entry.space.name,
    },
    currentParticipantId: input.currentParticipant.id,
    availableParticipants: participants,
    defaultCurrency: entry.space.defaultCurrency,
  }
}
