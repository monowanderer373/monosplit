export type SplitMode = 'equal' | 'itemized' | 'percentage' | 'shares' | 'adjustment'
export type ItemizedInputMode = 'pretax' | 'total'
export type RateMode = 'auto' | 'manual'
export type PaymentMethod = 'card' | 'cash'

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
  date: string
  createdAt: string
  splits: Split[]
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
  comments: GroupComment[]
  createdAt: string
  ownerId?: string
  deletedAt?: string | null
  deletedBy?: string | null
}

export interface GroupComment {
  id: string
  personId: string
  message: string
  createdAt: string
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
