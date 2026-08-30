export type GroupRole = 'owner' | 'full_access' | 'view'

export interface Currency {
  code: string
  label: string
  symbol: string
}

export interface UserProfile {
  id: string
  participantId?: string | null
  displayName: string | null
  avatarUrl: string | null
  lang: 'en' | 'zh'
  themeId: string
  defaultCurrency?: string
  timezone?: string
  isAnonymous?: boolean
  email: string | undefined
}

export type ParticipantKind = 'account' | 'manual'
export type SpaceType = 'group' | 'trip'
export type ExpenseScope = 'personal' | 'direct' | 'space'
export type FinancialRecordStatus = 'active' | 'voided'
export type DirectParticipationState = 'pending' | 'accepted' | 'declined' | 'untracked'
export type TrackingMode = 'tracked' | 'untracked'
export type SettlementConfirmationState =
  | 'pending'
  | 'partially_confirmed'
  | 'confirmed'
  | 'declined'
  | 'reversed'

export interface Participant {
  id: string
  authUserId: string | null
  kind: ParticipantKind
  displayName: string
  createdBy: string | null
}

export interface Space {
  id: string
  type: SpaceType
  name: string
  ownerParticipantId: string
  startDate: string | null
  endDate: string | null
  defaultCurrency: string
  status: 'active' | 'archived' | 'voided'
  version: number
  createdAt: string
  updatedAt: string
}

export interface SpaceMember {
  spaceId: string
  participantId: string
  role: GroupRole
  joinedAt: string
  removedAt: string | null
}

export interface ExpenseParticipation {
  id: string
  expenseId: string
  participantId: string
  nameSnapshot: string
  order: number
  state: DirectParticipationState
  trackingMode: TrackingMode
}

export interface PayerContribution {
  expenseParticipationId: string
  expenseId: string
  amountMinor: number
}

export interface ExpenseShare {
  expenseParticipationId: string
  expenseId: string
  amountMinor: number
}

export interface CanonicalExpense {
  id: string
  clientRequestId: string
  scope: ExpenseScope
  spaceId: string | null
  createdBy: string
  totalMinor: number
  participantCount: number
  currency: string
  description: string | null
  category: string
  occurredOn: string
  status: FinancialRecordStatus
  version: number
  voidedAt: string | null
  createdAt: string
  updatedAt: string
  participations: ExpenseParticipation[]
  payerContributions: PayerContribution[]
  shares: ExpenseShare[]
}
