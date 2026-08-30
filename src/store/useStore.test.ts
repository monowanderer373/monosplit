import { describe, expect, it } from 'vitest'
import { migratePersistedState } from './useStore'

describe('migratePersistedState', () => {
  it('drops legacy group caches while preserving relational preferences and outbox state', () => {
    const ledgerByIdentity = {
      participant: {
        expenses: [],
        outbox: [{ command: { requestId: 'request-id' } }],
      },
    }

    const migrated = migratePersistedState({
      lang: 'zh',
      themeId: 'solid-vintage',
      ledgerByIdentity,
      groups: [{ id: 'legacy-group' }],
      hiddenDeletedGroupIds: ['legacy-group'],
      myPersonIdByGroupId: { 'legacy-group': 'legacy-person' },
      fontId: 'legacy-font',
    })

    expect(migrated).toMatchObject({
      lang: 'zh',
      themeId: 'solid-vintage',
      ledgerByIdentity,
    })
    expect(migrated).not.toHaveProperty('groups')
    expect(migrated).not.toHaveProperty('hiddenDeletedGroupIds')
    expect(migrated).not.toHaveProperty('myPersonIdByGroupId')
    expect(migrated).not.toHaveProperty('fontId')
  })

  it('initializes an empty relational ledger cache for malformed persisted state', () => {
    expect(migratePersistedState({ ledgerByIdentity: null })).toMatchObject({
      ledgerByIdentity: {},
    })
  })
})
