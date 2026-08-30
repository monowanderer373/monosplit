export type SplitMode = 'equal' | 'itemized' | 'percentage' | 'shares' | 'adjustment' | 'receipt'
export type ItemizedInputMode = 'pretax' | 'total'
export type RateMode = 'auto' | 'manual'
export type PaymentMethod = 'card' | 'cash'
export type GroupRole = 'owner' | 'full_access' | 'view'

export interface PaymentInfo {
  qrCodeDataUrl: string | null
  bankName: string
  accountHolder: string
  accountNumber: string
  notes: string
}

export interface PaymentProof {
  id: string
  title: string
  dataUrl: string
  createdAt: string
}

export interface Person {
  id: string
  name: string
  avatarDataUrl: string | null
  nameColor: string | null
  authUserId?: string
  bio?: string | null
  paymentInfo: PaymentInfo
  paymentProofs: PaymentProof[]
  skipRepaidConfirm?: boolean
}

export interface Split {
  personId: string
  amount: number | null
  baseAmount: number | null
  taxAmount: number | null
  repayCurrency: string
  convertedAmount: number | null
  rate: number | null
  rateSource: string | null
  rateDate: string | null
  repaid: boolean
  repaidAt: string | null
  repaidDate: string | null
  repaidPayerIds?: string[]
}

export interface ReceiptItem {
  id: string
  name: string
  unitPrice: number | null
  quantity: number | null
  amount: number | null
  debtorIds: string[]
}

export type ExpenseType = 'expense' | 'refund'

export interface Expense {
  id: string
  type?: ExpenseType
  category: string
  description: string
  payerIds: string[]
  amount: number
  paidCurrency: string
  repayCurrency: string
  paymentMethod: PaymentMethod
  splitMode: SplitMode
  itemizedInputMode: ItemizedInputMode | null
  serviceTaxPct: number | null
  salesTaxPct: number | null
  tipsPct: number | null
  taxPctTotal: number | null
  receiptItems?: ReceiptItem[] | null
  receiptTaxAmount?: number | null
  date: string
  createdAt: string
  splits: Split[]
}

export interface SettlementPaymentAllocation {
  creditorId: string
  amount: number
}

export type SettlementPaymentSource = 'record_payment' | 'quick_settle' | 'history_edit'

export interface SettlementPayment {
  id: string
  debtorId: string
  currency: string
  repayCurrency: string
  repayAmount: number
  paymentDate: string
  createdAt: string
  updatedAt: string
  rate: number | null
  rateSource: string | null
  rateDate: string | null
  source: SettlementPaymentSource
  note?: string | null
  allocations: SettlementPaymentAllocation[]
}

export interface Group {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  defaultPaidCurrency: string
  defaultRepayCurrency: string
  people: Person[]
  expenses: Expense[]
  settlementPayments: SettlementPayment[]
  createdAt: string
  ownerId?: string
  deletedAt?: string | null
  deletedBy?: string | null
}

export interface GroupMembership {
  groupId: string
  userId: string
  role: GroupRole
}

export interface GroupInviteLink {
  token: string
  groupId: string
  role: Exclude<GroupRole, 'owner'>
  createdBy: string
  active: boolean
  createdAt: string
  expiresAt?: string | null
}

export interface Settlement {
  debtorId: string
  creditorId: string
  currency: string
  amount: number
}

export interface Currency {
  code: string
  label: string
  symbol: string
}

export interface UserProfile {
  id: string
  displayName: string | null
  avatarUrl: string | null
  lang: 'en' | 'zh'
  themeId: string
  email: string | undefined
}
