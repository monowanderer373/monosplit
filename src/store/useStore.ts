import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId, generateGroupId } from '../lib/id'
import { saveGroupBackup } from '../lib/groupBackups'
import { normalizeExpense, normalizeGroup, normalizeSettlementPayment } from '../lib/groupNormalize'
import type {
  Expense,
  Group,
  PaymentInfo,
  PaymentProof,
  Person,
  SettlementPayment,
} from '../types'

type NewExpense = Omit<Expense, 'id' | 'createdAt'>
type NewSettlementPayment = Omit<SettlementPayment, 'id' | 'createdAt' | 'updatedAt'>
type NewGroupOptions = {
  startDate?: string | null
  endDate?: string | null
}

type AppState = {
  lang: 'en' | 'zh'
  setLang: (lang: 'en' | 'zh') => void
  themeId: string
  setThemeId: (id: string) => void
  fontId: string
  setFontId: (id: string) => void
  groups: Group[]
  hiddenDeletedGroupIds: string[]
  hideDeletedGroup: (groupId: string) => void
  unhideDeletedGroup: (groupId: string) => void
  addGroup: (name: string, options?: NewGroupOptions, ownerId?: string) => string
  updateGroup: (groupId: string, updates: Partial<Group>) => void
  deleteGroup: (groupId: string) => void
  replaceGroup: (groupId: string, data: Group) => void
  upsertGroup: (data: Group) => void
  addPerson: (groupId: string, name: string, authUserId?: string) => void
  updatePerson: (groupId: string, personId: string, name: string) => void
  updatePersonProfile: (
    groupId: string,
    personId: string,
    updates: Partial<Pick<Person, 'name' | 'avatarDataUrl' | 'nameColor' | 'authUserId'>>,
  ) => void
  removePerson: (groupId: string, personId: string) => void
  updatePersonPaymentInfo: (groupId: string, personId: string, updates: Partial<PaymentInfo>) => void
  addPersonPaymentProof: (groupId: string, personId: string, proof: Omit<PaymentProof, 'id' | 'createdAt'>) => void
  removePersonPaymentProof: (groupId: string, personId: string, proofId: string) => void
  addExpense: (groupId: string, expense: NewExpense) => Expense | null
  updateExpense: (groupId: string, expenseId: string, updates: Partial<Expense>) => void
  removeExpense: (groupId: string, expenseId: string) => void
  addSettlementPayment: (groupId: string, payment: NewSettlementPayment) => SettlementPayment | null
  updateSettlementPayment: (groupId: string, paymentId: string, updates: Partial<Omit<SettlementPayment, 'id' | 'createdAt'>>) => void
  removeSettlementPayment: (groupId: string, paymentId: string) => void
  restoreGroupFromBackup: (groupId: string, expenses: Group['expenses'], settlementPayments: Group['settlementPayments']) => void
  setPersonSkipRepaidConfirm: (groupId: string, personId: string, skip: boolean) => void
  addGroupComment: (groupId: string, personId: string, message: string) => void
}

function updateGroupById(groups: Group[], groupId: string, updater: (group: Group) => Group): Group[] {
  return groups.map((group) => (group.id === groupId ? updater(group) : group))
}

function sanitizeName(name: string): string {
  return String(name).trim()
}

function personInGroup(people: Person[], personId: string): boolean {
  return people.some((person) => person.id === personId)
}

function defaultPaymentInfo(): PaymentInfo {
  return {
    qrCodeDataUrl: null,
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    notes: '',
  }
}

function normalizePersonName(name: string): string {
  return sanitizeName(name)
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      lang: 'en' as 'en' | 'zh',
      setLang: (lang: 'en' | 'zh') => set({ lang }),
      themeId: 'solid-vintage',
      setThemeId: (id: string) => set({ themeId: id }),
      fontId: 'departure-mono',
      setFontId: (id: string) => set({ fontId: id }),
      groups: [],
      hiddenDeletedGroupIds: [],
      hideDeletedGroup: (groupId) => {
        set((state) => ({
          hiddenDeletedGroupIds: state.hiddenDeletedGroupIds.includes(groupId)
            ? state.hiddenDeletedGroupIds
            : [...state.hiddenDeletedGroupIds, groupId],
        }))
      },
      unhideDeletedGroup: (groupId) => {
        set((state) => ({
          hiddenDeletedGroupIds: state.hiddenDeletedGroupIds.filter((id) => id !== groupId),
        }))
      },
      addGroup: (name, options, ownerId) => {
        const safeName = sanitizeName(name)
        const groupId = generateGroupId()
        if (!safeName) return groupId
        const startDate = options?.startDate || null
        const endDate = options?.endDate || null
        set((state) => ({
          groups: [
            ...state.groups,
            {
              id: groupId,
              name: safeName,
              startDate,
              endDate,
              defaultPaidCurrency: 'JPY',
              defaultRepayCurrency: 'MYR',
              people: [],
              expenses: [],
              settlementPayments: [],
              comments: [],
              createdAt: new Date().toISOString(),
              ownerId: ownerId ?? undefined,
            },
          ],
        }))
        return groupId
      },
      updateGroup: (groupId, updates) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({ ...group, ...updates })),
        }))
      },
      deleteGroup: (groupId) => {
        set((state) => ({ groups: state.groups.filter((group) => group.id !== groupId) }))
      },
      replaceGroup: (groupId, data) => {
        const migrated = normalizeGroup({ ...data, id: groupId })
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId
              // ownerId is not in the JSONB payload — keep whichever side has it
              ? { ...migrated, ownerId: migrated.ownerId ?? g.ownerId }
              : g,
          ),
        }))
      },
      upsertGroup: (data) => {
        const migrated = normalizeGroup(data)
        set((state) => {
          const exists = state.groups.some((g) => g.id === migrated.id)
          if (exists) {
            return { groups: state.groups.map((g) => (g.id === migrated.id ? migrated : g)) }
          }
          return { groups: [...state.groups, migrated] }
        })
      },
      addPerson: (groupId, name, authUserId) => {
        const safeName = sanitizeName(name)
        if (!safeName) return
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            people: [
              ...group.people,
              {
                id: generateId('person'),
                name: safeName,
                avatarDataUrl: null,
                nameColor: null,
                authUserId: authUserId || undefined,
                paymentInfo: defaultPaymentInfo(),
                paymentProofs: [],
              },
            ],
          })),
        }))
      },
      updatePerson: (groupId, personId, name) => {
        const safeName = sanitizeName(name)
        if (!safeName) return
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            people: group.people.map((person) => (person.id === personId ? { ...person, name: safeName } : person)),
          })),
        }))
      },
      updatePersonProfile: (groupId, personId, updates) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            people: group.people.map((person) => {
              if (person.id !== personId) return person
              const nextName =
                updates.name == null
                  ? person.name
                  : normalizePersonName(updates.name) || person.name
              return {
                ...person,
                name: nextName,
                avatarDataUrl: updates.avatarDataUrl === undefined ? person.avatarDataUrl : updates.avatarDataUrl,
                nameColor: updates.nameColor === undefined ? person.nameColor : updates.nameColor,
                authUserId: updates.authUserId === undefined ? person.authUserId : updates.authUserId,
              }
            }),
          })),
        }))
      },
      removePerson: (groupId, personId) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => {
            // If the removed person was any payer on an expense, delete the whole bill.
            // If they were only a debtor, keep the bill and remove just their split row.
            const updatedExpenses = group.expenses
              .filter((expense) => !(expense.payerIds ?? []).includes(personId))
              .map((expense) => ({
                ...expense,
                splits: expense.splits.filter((split) => split.personId !== personId),
              }))
            return {
              ...group,
              people: group.people.filter((person) => person.id !== personId),
              comments: group.comments.filter((comment) => comment.personId !== personId),
              expenses: updatedExpenses,
            }
          }),
        }))
      },
      updatePersonPaymentInfo: (groupId, personId, updates) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            people: group.people.map((person) =>
              person.id === personId
                ? { ...person, paymentInfo: { ...(person.paymentInfo || defaultPaymentInfo()), ...updates } }
                : person,
            ),
          })),
        }))
      },
      addPersonPaymentProof: (groupId, personId, proof) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            people: group.people.map((person) =>
              person.id === personId
                ? {
                    ...person,
                    paymentProofs: [
                      ...(person.paymentProofs || []),
                      {
                        ...proof,
                        id: generateId('proof'),
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  }
                : person,
            ),
          })),
        }))
      },
      removePersonPaymentProof: (groupId, personId, proofId) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            people: group.people.map((person) =>
              person.id === personId
                ? {
                    ...person,
                    paymentProofs: (person.paymentProofs || []).filter((proof) => proof.id !== proofId),
                  }
                : person,
            ),
          })),
        }))
      },
      addExpense: (groupId, expense) => {
        const createdExpense: Expense = { ...expense, id: generateId('exp'), createdAt: new Date().toISOString() }
        let inserted = false
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => {
            inserted = true
            return {
              ...group,
              expenses: [...group.expenses, createdExpense],
            }
          }),
        }))
        return inserted ? createdExpense : null
      },
      updateExpense: (groupId, expenseId, updates) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.map((expense) => (expense.id === expenseId ? { ...expense, ...updates } : expense)),
          })),
        }))
      },
      removeExpense: (groupId, expenseId) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.filter((expense) => expense.id !== expenseId),
          })),
        }))
      },
      addSettlementPayment: (groupId, payment) => {
        // Save backup before mutating
        const currentGroup = get().groups.find((g) => g.id === groupId)
        if (currentGroup) {
          saveGroupBackup(currentGroup, 'add_payment', `Before adding payment`)
        }
        const createdPayment: SettlementPayment = {
          ...payment,
          id: generateId('settlement'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        let inserted = false
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => {
            inserted = true
            return {
              ...group,
              settlementPayments: [...(group.settlementPayments || []), normalizeSettlementPayment(createdPayment)],
            }
          }),
        }))
        return inserted ? createdPayment : null
      },
      updateSettlementPayment: (groupId, paymentId, updates) => {
        const currentGroup = get().groups.find((g) => g.id === groupId)
        if (currentGroup) saveGroupBackup(currentGroup, 'update_payment', `Before editing payment`)
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            settlementPayments: (group.settlementPayments || []).map((payment) =>
              payment.id === paymentId
                ? normalizeSettlementPayment({
                    ...payment,
                    ...updates,
                    id: payment.id,
                    createdAt: payment.createdAt,
                    updatedAt: new Date().toISOString(),
                  })
                : payment,
            ),
          })),
        }))
      },
      removeSettlementPayment: (groupId, paymentId) => {
        const currentGroup = get().groups.find((g) => g.id === groupId)
        if (currentGroup) saveGroupBackup(currentGroup, 'remove_payment', `Before undoing payment`)
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            settlementPayments: (group.settlementPayments || []).filter((payment) => payment.id !== paymentId),
          })),
        }))
      },
      restoreGroupFromBackup: (groupId, expenses, settlementPayments) => {
        // Save current state before restoring (so the restore itself is undoable)
        const currentGroup = get().groups.find((g) => g.id === groupId)
        if (currentGroup) saveGroupBackup(currentGroup, 'manual', 'Before restore (auto-saved)')
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            expenses,
            settlementPayments: settlementPayments ?? [],
          })),
        }))
      },
      setPersonSkipRepaidConfirm: (groupId, personId, skip) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            people: group.people.map((person) =>
              person.id === personId ? { ...person, skipRepaidConfirm: skip } : person,
            ),
          })),
        }))
      },
      addGroupComment: (groupId, personId, message) => {
        const clean = String(message).trim()
        if (!clean) return
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            comments: [
              ...(group.comments || []),
              {
                id: generateId('comment'),
                personId,
                message: clean,
                createdAt: new Date().toISOString(),
              },
            ],
          })),
        }))
      },
    }),
    {
      name: 'monosplit-storage',
      version: 5,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        if (version < 2 && Array.isArray(state?.groups)) {
          state.groups = (state.groups as Array<Record<string, unknown>>).map((group) => ({
            ...group,
            expenses: Array.isArray(group.expenses)
              ? (group.expenses as Array<Expense & { payerId?: string }>).map((expense) => normalizeExpense(expense))
              : [],
          }))
        }
        // v3: reset themeId to solid-vintage if it was still the old glacial default
        if (version < 3 && state.themeId === 'glacial') {
          state.themeId = 'solid-vintage'
        }
        // v4: ensure fontId exists for existing users
        if (!state.fontId) {
          state.fontId = 'departure-mono'
        }
        if (version < 4 && Array.isArray(state?.groups)) {
          state.groups = (state.groups as Array<Record<string, unknown>>).map((group) => ({
            ...group,
            expenses: Array.isArray(group.expenses)
              ? (group.expenses as Array<Expense & { payerId?: string }>).map((expense) => normalizeExpense(expense))
              : [],
          }))
        }
        if (version < 5 && Array.isArray(state?.groups)) {
          state.groups = (state.groups as Array<Record<string, unknown>>).map((group) => ({
            ...group,
            settlementPayments: Array.isArray(group.settlementPayments)
              ? (group.settlementPayments as SettlementPayment[]).map((payment) => normalizeSettlementPayment(payment))
              : [],
          }))
        }
        return state
      },
      partialize: (state) => ({
        lang: state.lang,
        themeId: state.themeId,
        fontId: state.fontId,
        hiddenDeletedGroupIds: state.hiddenDeletedGroupIds,
        groups: state.groups.map((group) => ({
          ...group,
          startDate: group.startDate || null,
          endDate: group.endDate || null,
          comments: (group.comments || []).filter((comment) => personInGroup(group.people, comment.personId)),
          people: group.people
            .filter((person) => !!sanitizeName(person.name))
            .map((person) => ({
              ...person,
              avatarDataUrl: person.avatarDataUrl || null,
              nameColor: person.nameColor || null,
              paymentInfo: person.paymentInfo || defaultPaymentInfo(),
              paymentProofs: Array.isArray(person.paymentProofs) ? person.paymentProofs : [],
            })),
          expenses: group.expenses
            .map((expense) => normalizeExpense(expense))
            .filter(
              (expense) =>
                (expense.payerIds ?? []).every((pid) => personInGroup(group.people, pid)) &&
                expense.splits.every((split) => personInGroup(group.people, split.personId)),
            ),
          settlementPayments: (group.settlementPayments || [])
            .map((payment) => normalizeSettlementPayment(payment))
            .filter(
              (payment) =>
                personInGroup(group.people, payment.debtorId) &&
                payment.allocations.every((allocation) => personInGroup(group.people, allocation.creditorId)),
            ),
        })),
      }),
    },
  ),
)
