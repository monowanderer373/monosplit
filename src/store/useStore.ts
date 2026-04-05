import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId, generateGroupId } from '../lib/id'
import { todayISO } from '../lib/format'
import type { Expense, Group, PaymentInfo, PaymentProof, Person } from '../types'

type NewExpense = Omit<Expense, 'id' | 'createdAt'>
type NewGroupOptions = {
  startDate?: string | null
  endDate?: string | null
}

type AppState = {
  lang: 'en' | 'zh'
  setLang: (lang: 'en' | 'zh') => void
  themeId: string
  setThemeId: (id: string) => void
  groups: Group[]
  addGroup: (name: string, options?: NewGroupOptions) => string
  updateGroup: (groupId: string, updates: Partial<Group>) => void
  deleteGroup: (groupId: string) => void
  replaceGroup: (groupId: string, data: Group) => void
  upsertGroup: (data: Group) => void
  addPerson: (groupId: string, name: string) => void
  updatePerson: (groupId: string, personId: string, name: string) => void
  updatePersonProfile: (
    groupId: string,
    personId: string,
    updates: Partial<Pick<Person, 'name' | 'avatarDataUrl' | 'nameColor'>>,
  ) => void
  removePerson: (groupId: string, personId: string) => void
  updatePersonPaymentInfo: (groupId: string, personId: string, updates: Partial<PaymentInfo>) => void
  addPersonPaymentProof: (groupId: string, personId: string, proof: Omit<PaymentProof, 'id' | 'createdAt'>) => void
  removePersonPaymentProof: (groupId: string, personId: string, proofId: string) => void
  addExpense: (groupId: string, expense: NewExpense) => void
  updateExpense: (groupId: string, expenseId: string, updates: Partial<Expense>) => void
  removeExpense: (groupId: string, expenseId: string) => void
  markSplitRepaid: (groupId: string, expenseId: string, splitIndex: number, repaidDate: string) => void
  unmarkSplitRepaid: (groupId: string, expenseId: string, splitIndex: number) => void
  markSettlementPairRepaid: (groupId: string, debtorId: string, creditorId: string, currency: string, repaidDate: string) => void
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

function migrateExpensePayerIds(expense: Expense & { payerId?: string }): Expense {
  if (expense.payerIds && expense.payerIds.length > 0) return expense as Expense
  const legacyId = expense.payerId
  if (legacyId) {
    const { payerId: _, ...rest } = expense
    return { ...rest, payerIds: [legacyId] } as Expense
  }
  return { ...expense, payerIds: expense.payerIds ?? [] } as Expense
}

function migrateGroupData(group: Group): Group {
  if (!group.expenses || !Array.isArray(group.expenses)) return group
  const migrated = group.expenses.map((e) => migrateExpensePayerIds(e as Expense & { payerId?: string }))
  return { ...group, expenses: migrated }
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
    (set) => ({
      lang: 'en' as 'en' | 'zh',
      setLang: (lang: 'en' | 'zh') => set({ lang }),
      themeId: 'solid-vintage',
      setThemeId: (id: string) => set({ themeId: id }),
      groups: [],
      addGroup: (name, options) => {
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
              comments: [],
              createdAt: new Date().toISOString(),
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
        const migrated = migrateGroupData({ ...data, id: groupId })
        set((state) => ({
          groups: state.groups.map((g) => (g.id === groupId ? migrated : g)),
        }))
      },
      upsertGroup: (data) => {
        const migrated = migrateGroupData(data)
        set((state) => {
          const exists = state.groups.some((g) => g.id === migrated.id)
          if (exists) {
            return { groups: state.groups.map((g) => (g.id === migrated.id ? migrated : g)) }
          }
          return { groups: [...state.groups, migrated] }
        })
      },
      addPerson: (groupId, name) => {
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
              }
            }),
          })),
        }))
      },
      removePerson: (groupId, personId) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            people: group.people.filter((person) => person.id !== personId),
            comments: group.comments.filter((comment) => comment.personId !== personId),
            expenses: group.expenses.map((expense) => ({
              ...expense,
              payerIds: (expense.payerIds ?? []).filter((pid) => pid !== personId),
              splits: expense.splits.filter((split) => split.personId !== personId),
            })),
          })),
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
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            expenses: [...group.expenses, { ...expense, id: generateId('exp'), createdAt: new Date().toISOString() }],
          })),
        }))
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
      markSplitRepaid: (groupId, expenseId, splitIndex, repaidDate) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.map((expense) => {
              if (expense.id !== expenseId) return expense
              return {
                ...expense,
                splits: expense.splits.map((split, index) =>
                  index === splitIndex
                    ? {
                        ...split,
                        repaid: true,
                        repaidAt: new Date().toISOString(),
                        repaidDate: repaidDate || todayISO(),
                      }
                    : split,
                ),
              }
            }),
          })),
        }))
      },
      unmarkSplitRepaid: (groupId, expenseId, splitIndex) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.map((expense) => {
              if (expense.id !== expenseId) return expense
              return {
                ...expense,
                splits: expense.splits.map((split, index) =>
                  index === splitIndex
                    ? {
                        ...split,
                        repaid: false,
                        repaidAt: null,
                        repaidDate: null,
                      }
                    : split,
                ),
              }
            }),
          })),
        }))
      },
      markSettlementPairRepaid: (groupId, debtorId, creditorId, currency, repaidDate) => {
        set((state) => ({
          groups: updateGroupById(state.groups, groupId, (group) => ({
            ...group,
            expenses: group.expenses.map((expense) => {
              if (!(expense.payerIds ?? []).includes(creditorId)) return expense
              return {
                ...expense,
                splits: expense.splits.map((split) => {
                  const cur = split.repayCurrency || expense.paidCurrency
                  const shouldMark = split.personId === debtorId && !split.repaid && cur === currency
                  if (!shouldMark) return split
                  return {
                    ...split,
                    repaid: true,
                    repaidAt: new Date().toISOString(),
                    repaidDate: repaidDate || todayISO(),
                  }
                }),
              }
            }),
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
      version: 1,
      partialize: (state) => ({
        lang: state.lang,
        themeId: state.themeId,
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
            .map((expense) => migrateExpensePayerIds(expense))
            .filter(
              (expense) =>
                (expense.payerIds ?? []).every((pid) => personInGroup(group.people, pid)) &&
                expense.splits.every((split) => personInGroup(group.people, split.personId)),
            ),
        })),
      }),
    },
  ),
)
