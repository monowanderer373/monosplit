/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const inventoryUrl = new URL(
  '../../scripts/phase-3-person-link-production-inventory.sql',
  import.meta.url,
)

function analyticalStatements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/'(?:''|[^'])*'/g, "''")
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

describe('Phase 3 production Person/link inventory', () => {
  it('enforces a read-only transaction containing only analytical queries', () => {
    const sql = readFileSync(inventoryUrl, 'utf8')
    const statements = analyticalStatements(sql)

    expect(statements[0]).toMatch(
      /^begin transaction isolation level repeatable read read only$/i,
    )
    expect(statements.at(-1)).toMatch(/^rollback$/i)
    expect(statements.slice(1, -1).every(
      (statement) => /^(select|with)\b/i.test(statement),
    )).toBe(true)
    expect(sql).not.toMatch(
      /^\s*(insert|update|delete|alter|create|drop|truncate|merge|call|do|copy|grant|revoke|execute)\b/im,
    )
    expect(sql).not.toMatch(
      /\bselect\s+(public|private)\.[a-z_][a-z0-9_]*\s*\(/i,
    )
  })
})
