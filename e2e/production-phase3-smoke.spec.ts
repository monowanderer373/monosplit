/// <reference types="node" />

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Request,
  type TestInfo,
} from '@playwright/test'
import {
  loadProductionSmokeEnvironment,
  redactedAccountIdentifier,
} from './fixtures/productionSmoke'

const smoke = loadProductionSmokeEnvironment()
const EXPECTED_SUPABASE_HOST = 'skiqsxvmxvmxfzhrzcxh.supabase.co'
const PREFIX = '[PHASE3-SMOKE]'
const evidenceRoot = resolve(process.cwd(), 'test-results', 'production-phase3')
const EXISTING_RESUME_FIXTURE = Object.freeze({
  runId: '20260907T103234533Z',
  personalExpenseId: '3639fa0d-cf15-46bc-b53d-45f008d83739',
  personId: '7c8f0f91-0908-4e05-bba0-681f8a5059d1',
  manualParticipantId: '4af4acb1-0b7a-42fa-8217-ca4826358373',
  manualExpenseId: 'c38e83e3-bb5c-4e91-8eae-f3a29963bcf4',
  friendshipId: '5127375c-3c19-466c-8ab5-b4ad7bf8c6a4',
  linkRequestId: 'aada3b37-5f10-46f3-b0d7-d73550ae3522',
})

type AccountLabel = 'A' | 'B' | 'C'

type PublicSupabaseConfig = Readonly<{
  url: string
  key: string
}>

type AccountSession = Readonly<{
  label: AccountLabel
  client: SupabaseClient
  userId: string
  participantId: string
  displayName: string
}>

type BrowserSession = Readonly<{
  context: BrowserContext
  page: Page
}>

type NetworkEvidence = {
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: Array<{
    method: string
    url: string
    reason: string
  }>
  errorResponses: Array<{
    method: string
    url: string
    status: number
  }>
}

type SmokeManifest = {
  runId: string
  startedAt: string
  completedAt?: string
  accountFingerprints: Record<AccountLabel, string>
  userIds?: Record<AccountLabel, string>
  participantIds?: Record<AccountLabel, string>
  personId?: string
  manualParticipantId?: string
  personalExpenseId?: string
  manualExpenseId?: string
  friendshipId?: string
  linkRequestId?: string
  linkedExpenseId?: string
  settlementPaymentId?: string
}

type ExpenseSnapshot = Readonly<{
  expense: Record<string, unknown>
  participations: Array<Record<string, unknown>>
  payerContributions: Array<Record<string, unknown>>
  shares: Array<Record<string, unknown>>
}>

test.describe.configure({ mode: 'serial' })

test('runs the final Phase 3 production smoke journey', async ({
  browser,
}, testInfo) => {
  test.setTimeout(15 * 60_000)
  mkdirSync(evidenceRoot, { recursive: true })

  const requestedRunId = process.env.PROD_SMOKE_RUN_ID?.trim()
  if (requestedRunId && !/^\d{8}T\d{9}Z$/.test(requestedRunId)) {
    throw new Error('PROD_SMOKE_RUN_ID has an invalid format.')
  }
  const runId = requestedRunId
    ?? new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z')
  const resumeFixture = runId === EXISTING_RESUME_FIXTURE.runId
    ? EXISTING_RESUME_FIXTURE
    : null
  const personalDescription = `${PREFIX} Personal ${runId}`
  const manualName = `${PREFIX} Manual Person ${runId}`
  const manualDirectDescription = `${PREFIX} Manual Direct ${runId}`
  const linkedDirectDescription = `${PREFIX} Linked Direct ${runId}`
  const startedAt = new Date().toISOString()
  const skipped: string[] = []
  const manifest: SmokeManifest = {
    runId,
    startedAt,
    accountFingerprints: {
      A: redactedAccountIdentifier(smoke.accounts.A.email),
      B: redactedAccountIdentifier(smoke.accounts.B.email),
      C: redactedAccountIdentifier(smoke.accounts.C.email),
    },
  }

  const browserSessions: Partial<Record<AccountLabel, BrowserSession>> = {}
  const accountSessions: Partial<Record<AccountLabel, AccountSession>> = {}
  const networkEvidence: Partial<Record<AccountLabel, NetworkEvidence>> = {}
  const traceStarted = new Set<AccountLabel>()
  let failed = false

  try {
    let discoveredConfig: PublicSupabaseConfig | null = null
    browserSessions.A = await openBrowserSession(browser)
    networkEvidence.A = monitorPage(
      browserSessions.A.page,
      credentialSecrets(),
    )
    browserSessions.A.page.on('request', (request) => {
      discoveredConfig ??= publicSupabaseConfigFromRequest(request)
    })
    await signInThroughUi(browserSessions.A.page, smoke.accounts.A)
    await expect.poll(
      () => discoveredConfig,
      { message: 'Discover the public Production Supabase client configuration' },
    ).not.toBeNull()
    if (!discoveredConfig) {
      throw new Error('Production smoke preflight could not discover Supabase.')
    }

    for (const label of ['A', 'B', 'C'] as const) {
      accountSessions[label] = await authenticateAccount(
        label,
        discoveredConfig,
      )
    }
    manifest.userIds = mapSessions(accountSessions, (session) => session.userId)
    manifest.participantIds = mapSessions(
      accountSessions,
      (session) => session.participantId,
    )

    for (const label of ['B', 'C'] as const) {
      browserSessions[label] = await openBrowserSession(browser)
      networkEvidence[label] = monitorPage(
        browserSessions[label].page,
        credentialSecrets(),
      )
      await signInThroughUi(browserSessions[label].page, smoke.accounts[label])
    }

    for (const label of ['A', 'B', 'C'] as const) {
      await browserSessions[label]!.context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      })
      traceStarted.add(label)
    }

    const A = accountSessions.A!
    const B = accountSessions.B!
    const C = accountSessions.C!
    const pageA = browserSessions.A!.page
    const pageB = browserSessions.B!.page
    const pageC = browserSessions.C!.page

    await test.step('validate identities and unrelated User C', async () => {
      expect(new Set([A.userId, B.userId, C.userId]).size).toBe(3)
      expect(new Set([A.participantId, B.participantId, C.participantId]).size)
        .toBe(3)

      await assertNoRelationship(C.client, C.participantId, A.participantId)
      await assertNoRelationship(C.client, C.participantId, B.participantId)
      await assertNoRelationship(A.client, A.participantId, C.participantId)
      await assertNoRelationship(B.client, B.participantId, C.participantId)

      await expectNoRows(
        C.client
          .from('person_relationships')
          .select('id')
          .in('owner_participant_id', [A.participantId, B.participantId]),
        'User C Person isolation preflight',
      )
      await expectNoRows(
        A.client
          .from('person_relationships')
          .select('id')
          .eq('linked_participant_id', C.participantId),
        'User A has no Person linked to User C',
      )
      await expectNoRows(
        B.client
          .from('person_relationships')
          .select('id')
          .eq('linked_participant_id', C.participantId),
        'User B has no Person linked to User C',
      )

      await pageC.goto('/friends')
      await expect(
        pageC.getByRole('heading', { name: 'Friends', exact: true }),
      ).toBeVisible()
      await expect(pageC.getByText(A.displayName, { exact: true })).toHaveCount(0)
      await expect(pageC.getByText(B.displayName, { exact: true })).toHaveCount(0)
    })

    await test.step('verify authenticated production read health', async () => {
      await pageA.goto('/')
      await expect(pageA.getByText('TABBY TALLY', { exact: true })).toBeVisible()
      await expect(primaryNavigation(pageA)).toBeVisible()

      await pageA.goto('/friends')
      await expect(
        pageA.getByRole('heading', { name: 'Friends', exact: true }),
      ).toBeVisible()
      await pageA.goto('/spaces')
      await expect(
        primaryNavigation(pageA).getByRole('button', {
          name: 'Groups / Trips',
          exact: true,
        }),
      ).toHaveAttribute('aria-current', 'page')
      await pageA.goto('/profile')
      await expect(
        primaryNavigation(pageA).getByRole('button', {
          name: 'Me',
          exact: true,
        }),
      ).toHaveAttribute('aria-current', 'page')

      const { error } = await A.client
        .from('expenses')
        .select('id', { head: true, count: 'exact' })
      expect(error, safeSupabaseFailure('Production ledger read', error)).toBeNull()
      assertNoFatalBrowserErrors(networkEvidence.A!)
    })

    await test.step('record one Personal expense exactly once', async () => {
      let rows = await queryRows(
        A.client
          .from('expenses')
          .select('id, scope, total_minor, currency, category, status')
          .eq('description', personalDescription),
        'Existing Personal expense lookup',
      )
      if (rows.length === 0) {
        if (resumeFixture) {
          throw new Error('Existing resume Personal expense is missing; refusing to replace it.')
        }
        await pageA.goto('/')
        await globalMoneyAction(pageA).click()
        const capture = pageA.getByRole('dialog', { name: 'Quick tally' })
        await capture.getByRole('textbox', { name: /^Amount/ }).fill('1.01')
        await capture.getByPlaceholder('What was this for?').fill(personalDescription)
        await capture.getByRole('button', { name: 'More details' }).click()
        await capture
          .locator('label', { hasText: /^Category/ })
          .locator('select')
          .selectOption('Food')
        await capture.getByRole('button', { name: 'Save expense' }).click()
        await expect(pageA.getByRole('status')).toHaveText('Expense recorded')
        rows = await queryRows(
          A.client
            .from('expenses')
            .select('id, scope, total_minor, currency, category, status')
            .eq('description', personalDescription),
          'Created Personal expense lookup',
        )
      }
      await pageA.goto('/')
      await expect(
        pageA.getByRole('article').filter({ hasText: personalDescription }),
      ).toHaveCount(1)

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        scope: 'personal',
        total_minor: 101,
        category: 'Food',
        status: 'active',
      })
      manifest.personalExpenseId = stringField(rows[0], 'id')
      if (resumeFixture) {
        expect(manifest.personalExpenseId).toBe(resumeFixture.personalExpenseId)
      }
      const snapshot = await expenseSnapshot(A.client, manifest.personalExpenseId)
      expect(snapshot.participations).toHaveLength(1)
      expect(sumMinor(snapshot.payerContributions)).toBe(101)
      expect(sumMinor(snapshot.shares)).toBe(101)
    })

    await test.step('create one Manual Person and expose one context', async () => {
      let people = await queryRows(
        A.client
          .from('person_relationships')
          .select(`
            id, owner_participant_id, linked_participant_id,
            merged_into_person_id
          `)
          .eq('display_name', manualName),
        'Existing Manual Person lookup',
      )
      if (people.length === 0) {
        if (resumeFixture) {
          throw new Error('Existing resume Person is missing; refusing to replace it.')
        }
        await pageA.goto('/friends')
        await pageA.getByPlaceholder('Person’s name').fill(manualName)
        await pageA.getByRole('button', { name: 'Add person' }).click()
        people = await queryRows(
          A.client
            .from('person_relationships')
            .select(`
              id, owner_participant_id, linked_participant_id,
              merged_into_person_id
            `)
            .eq('display_name', manualName),
          'Created Manual Person lookup',
        )
      }
      expect(people).toHaveLength(1)
      expect(people[0]).toMatchObject({
        owner_participant_id: A.participantId,
        linked_participant_id: null,
        merged_into_person_id: null,
      })
      manifest.personId = stringField(people[0], 'id')
      if (resumeFixture) {
        expect(manifest.personId).toBe(resumeFixture.personId)
      }

      const attachments = await queryRows(
        A.client
          .from('person_manual_participants')
          .select('person_id, manual_participant_id, is_primary')
          .eq('person_id', manifest.personId),
        'Manual Person attachment lookup',
      )
      expect(attachments).toHaveLength(1)
      expect(attachments[0]).toMatchObject({
        person_id: manifest.personId,
        is_primary: true,
      })
      manifest.manualParticipantId = stringField(
        attachments[0],
        'manual_participant_id',
      )
      if (resumeFixture) {
        expect(manifest.manualParticipantId)
          .toBe(resumeFixture.manualParticipantId)
      }

      await pageA.goto('/friends')
      await expect(
        pageA.getByRole('button', { name: `Split with ${manualName}` }),
      ).toHaveCount(1)

      const principals = await queryRows(
        A.client
          .from('participants')
          .select('id, kind, created_by')
          .eq('id', manifest.manualParticipantId),
        'Manual principal lookup',
      )
      expect(principals).toHaveLength(1)
      expect(principals[0]).toMatchObject({
        kind: 'manual',
        created_by: A.userId,
      })

      const linkSelect = pageA.getByLabel(`Link ${manualName} to friend`)
      await linkSelect.selectOption({ label: B.displayName })
      await expect(linkSelect.locator('option:checked')).toHaveText(B.displayName)
      const add = globalMoneyAction(pageA)
      await alignScrollableControlWithFixedAction(pageA, linkSelect, add)
      await add.click()
      const gate = pageA.getByRole('dialog', { name: 'Where should this go?' })
      await expect(gate.getByRole('button', { name: manualName, exact: true }))
        .toHaveCount(1)
      await gate.getByRole('searchbox').fill(manualName)
      await expect(gate.getByRole('button', { name: manualName, exact: true }))
        .toHaveCount(1)
      await gate.getByRole('button', { name: 'Close' }).click()
      await expect(linkSelect.locator('option:checked')).toHaveText(B.displayName)

      await primaryNavigation(pageA)
        .getByRole('button', { name: 'Personal', exact: true })
        .click()
      await expect(pageA).toHaveURL(`${smoke.productionUrl}/`)
      await primaryNavigation(pageA)
        .getByRole('button', { name: 'Friends', exact: true })
        .click()
      await expect(pageA).toHaveURL(`${smoke.productionUrl}/friends`)
    })

    let historicalBeforeLink: ExpenseSnapshot
    let settlementIdsBeforeLink: string[]
    const bSpaceMembershipsBefore = await ownSpaceMemberships(B)
    const manualSpaceMembershipsBefore = await participantSpaceMemberships(
      A,
      () => requiredManifestId(manifest.manualParticipantId, 'Manual Participant'),
    )

    await test.step('record Manual Direct money with untracked trust', async () => {
      let expenses = await queryRows(
        A.client
          .from('expenses')
          .select('id')
          .eq('description', manualDirectDescription),
        'Existing Manual Direct lookup',
      )
      if (expenses.length === 0) {
        if (resumeFixture) {
          throw new Error(
            'Existing resume Manual Direct expense is missing; refusing to replace it.',
          )
        }
        await pageA.goto('/friends')
        await pageA
          .getByRole('button', { name: `Split with ${manualName}` })
          .click()
        await saveCapture(pageA, manualDirectDescription, '2.02')
        await expect(pageA.getByRole('status')).toHaveText('Expense recorded')
        expenses = await queryRows(
          A.client
            .from('expenses')
            .select('id')
            .eq('description', manualDirectDescription),
          'Created Manual Direct lookup',
        )
      }
      expect(expenses).toHaveLength(1)
      manifest.manualExpenseId = stringField(expenses[0], 'id')
      if (resumeFixture) {
        expect(manifest.manualExpenseId).toBe(resumeFixture.manualExpenseId)
      }
      historicalBeforeLink = await expenseSnapshot(
        A.client,
        manifest.manualExpenseId,
      )
      const manualParticipation = historicalBeforeLink.participations.find(
        (row) => row.participant_id === manifest.manualParticipantId,
      )
      expect(manualParticipation).toMatchObject({
        participant_id: manifest.manualParticipantId,
        tracking_mode: 'untracked',
        state: 'untracked',
      })
      const ownerParticipation = historicalBeforeLink.participations.find(
        (row) => row.participant_id === A.participantId,
      )
      expect(ownerParticipation).toBeDefined()
      expect(sumMinor(historicalBeforeLink.payerContributions)).toBe(202)
      expect(sumMinor(historicalBeforeLink.shares)).toBe(202)
      expect(
        amountForParticipation(
          historicalBeforeLink.payerContributions,
          stringField(ownerParticipation!, 'id'),
        ),
      ).toBe(202)
      expect(
        amountForParticipation(
          historicalBeforeLink.shares,
          stringField(ownerParticipation!, 'id'),
        ),
      ).toBe(101)
      expect(
        amountForParticipation(
          historicalBeforeLink.shares,
          stringField(manualParticipation!, 'id'),
        ),
      ).toBe(101)
      settlementIdsBeforeLink = await visibleSettlementIds(A.client)
    })

    await test.step('establish the A/B Friendship prerequisite', async () => {
      let friendship = await friendshipBetween(A, B.participantId)
      if (friendship?.status === 'archived' || friendship?.status === 'blocked') {
        throw new Error(
          `Production smoke fixture A/B friendship is ${friendship.status}; refusing to repair it.`,
        )
      }
      if (!friendship || friendship.status === 'pending') {
        if (resumeFixture) {
          throw new Error(
            'Existing resume Friendship is missing or pending; refusing to replace it.',
          )
        }
        const { data: token, error: inviteError } = await A.client.rpc(
          'create_friend_invite',
        )
        if (inviteError || typeof token !== 'string') {
          throw new Error(safeSupabaseFailure('Create friend invite', inviteError))
        }
        const { error: acceptError } = await B.client.rpc(
          'accept_friend_invite',
          { raw_token: token },
        )
        if (acceptError) {
          throw new Error(safeSupabaseFailure('Accept friend invite', acceptError))
        }
        friendship = await friendshipBetween(A, B.participantId)
      }
      expect(friendship?.status).toBe('accepted')
      manifest.friendshipId = friendship!.id
      if (resumeFixture) {
        expect(manifest.friendshipId).toBe(resumeFixture.friendshipId)
      }

      await pageA.goto('/friends')
      await pageB.goto('/friends')
      await expect(
        pageA.getByRole('article').filter({ hasText: B.displayName }),
      ).toHaveCount(1)
      await expect(
        pageB.getByRole('article').filter({ hasText: A.displayName }),
      ).toHaveCount(1)
      await assertNoRelationship(C.client, C.participantId, A.participantId)
      await assertNoRelationship(C.client, C.participantId, B.participantId)
    })

    await test.step('transition Manual to Link Pending to Linked', async () => {
      const personId = requiredManifestId(manifest.personId, 'Person')
      const existingPending = await personLinkRequests(A, {
        personId,
        targetParticipantId: B.participantId,
        status: 'pending',
      })
      if (existingPending.length > 1) {
        throw new Error(
          `Duplicate pending Person link requests found: ${existingPending.length}.`,
        )
      }
      if (resumeFixture && existingPending.length !== 1) {
        throw new Error(
          `Expected exactly one existing pending resume link request; found ${existingPending.length}.`,
        )
      }
      const existingAccepted = existingPending.length === 0
        ? await personLinkRequests(A, {
          personId,
          targetParticipantId: B.participantId,
          status: 'accepted',
        })
        : []
      if (existingAccepted.length > 1) {
        throw new Error(
          `Duplicate accepted Person link requests found: ${existingAccepted.length}.`,
        )
      }

      let request = existingPending[0] ?? existingAccepted[0]
      if (!request) {
        if (resumeFixture) {
          throw new Error(
            'Existing resume link request is missing; refusing to create another.',
          )
        }
        await pageA.goto('/friends')
        await pageB.goto('/friends')
        await pageA
          .getByLabel(`Link ${manualName} to friend`)
          .selectOption({ label: B.displayName })
        await pageA.getByRole('button', { name: 'Request link' }).click()
        request = await waitForSinglePendingLinkRequest(A, {
          personId,
          targetParticipantId: B.participantId,
          timeoutMs: 20_000,
        })
      }

      expect(request).toMatchObject({
        person_relationship_id: manifest.personId,
        manual_participant_id: manifest.manualParticipantId,
        target_participant_id: B.participantId,
        requested_by: A.participantId,
      })
      manifest.linkRequestId = stringField(request, 'id')
      if (resumeFixture) {
        expect(manifest.linkRequestId).toBe(resumeFixture.linkRequestId)
      }

      if (request.status === 'pending') {
        await pageB.goto('/friends')
        await expect.poll(async () => {
          await pageB.reload()
          return pageB
            .getByRole('article')
            .filter({
              hasText: 'A friend wants to link an untracked person to your account.',
            })
            .count()
        }, { timeout: 20_000 }).toBe(1)
        await pageB
          .getByRole('article')
          .filter({
            hasText: 'A friend wants to link an untracked person to your account.',
          })
          .getByRole('button', { name: 'Accept link' })
          .click()
      }

      await expect(
        pageA.getByRole('button', { name: `Split with ${manualName}` }),
      ).toHaveCount(0, { timeout: 20_000 })

      const { error: idempotentError } = await B.client.rpc(
        'respond_manual_participant_link',
        {
          target_request_id: requiredManifestId(
            manifest.linkRequestId,
            'Link request',
          ),
          response: 'accepted',
        },
      )
      expect(
        idempotentError,
        safeSupabaseFailure('Idempotent link acceptance', idempotentError),
      ).toBeNull()

      const linkedPeople = await queryRows(
        A.client
          .from('person_relationships')
          .select('id, linked_participant_id, merged_into_person_id')
          .eq('owner_participant_id', A.participantId)
          .eq('linked_participant_id', B.participantId)
          .is('merged_into_person_id', null),
        'Active linked Person lookup',
      )
      expect(linkedPeople).toHaveLength(1)
      expect(linkedPeople[0]).toMatchObject({
        id: manifest.personId,
        linked_participant_id: B.participantId,
      })

      await pageA.reload()
      await expect(
        pageA.getByRole('article').filter({ hasText: B.displayName }),
      ).toHaveCount(1)
      await expect(
        pageA.getByRole('button', { name: `Split with ${manualName}` }),
      ).toHaveCount(0)
    })

    await test.step('prove historical financial immutability', async () => {
      const after = await expenseSnapshot(
        A.client,
        requiredManifestId(manifest.manualExpenseId, 'Manual expense'),
      )
      expect(after).toEqual(historicalBeforeLink)
      expect(await visibleSettlementIds(A.client)).toEqual(
        settlementIdsBeforeLink,
      )
      await expectNoRows(
        B.client
          .from('expenses')
          .select('id')
          .eq('id', requiredManifestId(manifest.manualExpenseId, 'Manual expense')),
        'Linked user cannot see historical Manual expense',
      )
    })

    await test.step('prove linking did not grant or rewrite Space membership', async () => {
      expect(await ownSpaceMemberships(B)).toEqual(bSpaceMembershipsBefore)
      expect(
        await participantSpaceMemberships(
          A,
          () => requiredManifestId(
            manifest.manualParticipantId,
            'Manual Participant',
          ),
        ),
      ).toEqual(manualSpaceMembershipsBefore)
    })

    await test.step('record and confirm a new linked Direct expense', async () => {
      await pageA.goto('/friends')
      const friendCard = pageA
        .getByRole('article')
        .filter({ hasText: B.displayName })
      await friendCard.getByRole('button', { name: 'Split', exact: true }).click()
      const capture = pageA.getByRole('dialog', { name: 'Add Expense' })
      await capture.getByRole('textbox', { name: /^Amount/ }).fill('3.03')
      await capture
        .getByPlaceholder('What was this for?')
        .fill(linkedDirectDescription)
      await capture.getByLabel('Split').selectOption('exact')
      await capture.getByLabel('Share for You').fill('1.02')
      await capture.getByLabel(`Share for ${B.displayName}`).fill('2.01')
      await capture.getByRole('button', { name: 'Multiple payers' }).click()
      await capture.getByLabel('Paid by You').fill('2.03')
      await capture.getByLabel(`Paid by ${B.displayName}`).fill('1.00')
      await capture.getByRole('button', { name: 'Save expense' }).click()
      await expect(pageA.getByRole('status')).toHaveText(
        'Recorded · waiting for confirmation',
      )

      const expenses = await queryRows(
        A.client
          .from('expenses')
          .select('id')
          .eq('description', linkedDirectDescription),
        'Linked Direct lookup',
      )
      expect(expenses).toHaveLength(1)
      manifest.linkedExpenseId = stringField(expenses[0], 'id')
      const pendingSnapshot = await expenseSnapshot(
        A.client,
        manifest.linkedExpenseId,
      )
      expect(pendingSnapshot.participations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          participant_id: A.participantId,
          tracking_mode: 'tracked',
          state: 'accepted',
        }),
        expect.objectContaining({
          participant_id: B.participantId,
          tracking_mode: 'tracked',
          state: 'pending',
        }),
      ]))
      expect(pendingSnapshot.participations.some(
        (row) => row.participant_id === manifest.manualParticipantId,
      )).toBe(false)
      expect(sumMinor(pendingSnapshot.payerContributions)).toBe(303)
      expect(sumMinor(pendingSnapshot.shares)).toBe(303)

      const pending = pageB
        .getByRole('article')
        .filter({ hasText: linkedDirectDescription })
      await expect(pending).toBeVisible({ timeout: 20_000 })
      await pending.getByRole('button', { name: 'Accept share' }).click()
      await expect.poll(async () => {
        const snapshot = await expenseSnapshot(
          A.client,
          requiredManifestId(manifest.linkedExpenseId, 'Linked expense'),
        )
        return snapshot.participations.find(
          (row) => row.participant_id === B.participantId,
        )?.state
      }).toBe('accepted')
    })

    await test.step('exercise Universal Quick Add context and category rules', async () => {
      await pageA.goto('/friends')
      await clickGlobalAdd(pageA)
      const gate = pageA.getByRole('dialog', { name: 'Where should this go?' })
      await expect(gate).toBeVisible()
      await expect(gate.getByRole('button', { name: manualName, exact: true }))
        .toHaveCount(1)
      await gate.getByRole('button', { name: 'Close' }).click()

      await pageA.goto('/')
      await globalMoneyAction(pageA).click()
      const personalCapture = pageA.getByRole('dialog', { name: 'Quick tally' })
      await expect(
        personalCapture.getByRole('button', {
          name: 'Current context: Personal. Change context',
        }),
      ).toBeVisible()
      const personalSuggestion = personalCapture.getByRole('button', {
        name: personalDescription,
        exact: true,
      })
      if (await personalSuggestion.count()) {
        await personalSuggestion.click()
        await personalCapture.getByRole('button', { name: 'More details' }).click()
        await expect(categorySelect(personalCapture)).toHaveValue('Food')
        await personalCapture
          .getByRole('button', {
            name: 'Current context: Personal. Change context',
          })
          .click()
        await pageA
          .getByRole('dialog', { name: 'Move this draft?' })
          .getByRole('button', { name: manualName, exact: true })
          .click()
        await expect(
          categorySelect(pageA.getByRole('dialog', { name: 'Add Expense' })),
        ).toHaveValue('Other')
        await pageA
          .getByRole('dialog', { name: 'Add Expense' })
          .getByRole('button', { name: 'Close' })
          .click()
      } else {
        skipped.push(
          'Suggested-category recomputation: deterministic suggestion was not available in the Production ranking window.',
        )
        await personalCapture.getByRole('button', { name: 'Close' }).click()
      }

      await pageA.goto('/friends')
      await pageA
        .getByRole('article')
        .filter({ hasText: B.displayName })
        .getByRole('button', { name: 'Split', exact: true })
        .click()
      const personCapture = pageA.getByRole('dialog', { name: 'Add Expense' })
      await personCapture.getByRole('button', { name: 'More details' }).click()
      await categorySelect(personCapture).selectOption('Shopping')
      await personCapture
        .getByRole('button', {
          name: new RegExp('^Current context: .*\\. Change context$'),
        })
        .click()
      await pageA
        .getByRole('dialog', { name: 'Move this draft?' })
        .getByRole('button', { name: 'Personal', exact: true })
        .first()
        .click()
      await expect(
        categorySelect(pageA.getByRole('dialog', { name: 'Quick tally' })),
      ).toHaveValue('Shopping')
      await pageA
        .getByRole('dialog', { name: 'Quick tally' })
        .getByRole('button', { name: 'Close' })
        .click()

      const dedicatedSpaces = await queryRows(
        A.client
          .from('spaces')
          .select('id, name, status')
          .like('name', `${PREFIX}%`)
          .eq('status', 'active'),
        'Dedicated Production smoke Space lookup',
      )
      if (dedicatedSpaces.length === 0) {
        skipped.push(
          'Group/Trip Universal Quick Add and Space balances: no dedicated eligible [PHASE3-SMOKE] Space exists.',
        )
      }
    })

    await test.step('verify anonymous, linked, and unrelated-user RLS', async () => {
      const anonymous = createClient(discoveredConfig!.url, discoveredConfig!.key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      })
      await expectNoRows(
        anonymous.from('person_relationships').select('id'),
        'Anonymous Person relationships',
      )
      await expectNoRows(
        anonymous.from('person_manual_participants').select('person_id'),
        'Anonymous Person/manual mappings',
      )
      await expectNoRows(
        anonymous
          .from('expenses')
          .select('id')
          .in('id', [
            requiredManifestId(manifest.manualExpenseId, 'Manual expense'),
            requiredManifestId(manifest.linkedExpenseId, 'Linked expense'),
          ]),
        'Anonymous financial data',
      )

      await expectNoRows(
        B.client
          .from('person_relationships')
          .select('id')
          .eq('id', requiredManifestId(manifest.personId, 'Person')),
        'Linked counterpart owner-private Person row',
      )
      await expectNoRows(
        B.client
          .from('person_manual_participants')
          .select('person_id')
          .eq('person_id', requiredManifestId(manifest.personId, 'Person')),
        'Linked counterpart owner-private manual mapping',
      )
      await expectNoRows(
        C.client
          .from('expenses')
          .select('id')
          .in('id', [
            requiredManifestId(manifest.manualExpenseId, 'Manual expense'),
            requiredManifestId(manifest.linkedExpenseId, 'Linked expense'),
          ]),
        'Unrelated User C financial isolation',
      )
      await expectNoRows(
        C.client
          .from('person_relationships')
          .select('id')
          .in('owner_participant_id', [A.participantId, B.participantId]),
        'Unrelated User C Person isolation',
      )
      await expectNoRows(
        C.client
          .from('person_manual_participants')
          .select('person_id')
          .eq('person_id', requiredManifestId(manifest.personId, 'Person')),
        'Unrelated User C mapping isolation',
      )
      await expectNoRows(
        A.client
          .from('person_relationships')
          .select('id')
          .eq('owner_participant_id', C.participantId),
        'User A cannot enumerate User C Person rows',
      )
      await expectNoRows(
        B.client
          .from('person_relationships')
          .select('id')
          .eq('owner_participant_id', C.participantId),
        'User B cannot enumerate User C Person rows',
      )

      await pageC.goto('/friends')
      await expect(pageC.getByText(manualName, { exact: true })).toHaveCount(0)
      await expect(pageC.getByText(manualDirectDescription)).toHaveCount(0)
      await expect(pageC.getByText(linkedDirectDescription)).toHaveCount(0)
    })

    await test.step('verify settlement confirmation and reversal when safe', async () => {
      await pageB.goto('/friends')
      const aCard = pageB.getByRole('article').filter({ hasText: A.displayName })
      await aCard.getByRole('button', { name: 'Balance' }).click()
      const propose = pageB.getByRole('button', { name: 'Propose paid' })
      if (await propose.count()) {
        await pageB.getByPlaceholder('Full amount').fill('0.01')
        await propose.click()
        const payments = await queryRows(
          B.client
            .from('settlement_payments')
            .select('id, status, amount_minor')
            .eq('debtor_participant_id', B.participantId)
            .eq('amount_minor', 1)
            .gte('created_at', startedAt)
            .order('created_at', { ascending: false }),
          'Smoke settlement lookup',
        )
        expect(payments.length).toBeGreaterThan(0)
        manifest.settlementPaymentId = stringField(payments[0], 'id')

        await pageA.goto('/friends')
        await pageA
          .getByRole('article')
          .filter({ hasText: B.displayName })
          .getByRole('button', { name: 'Balance' })
          .click()
        const confirmation = pageA.getByRole('article').filter({
          hasText: `${B.displayName} says they paid you`,
        })
        await expect(confirmation).toBeVisible({ timeout: 20_000 })
        await confirmation
          .getByRole('button', { name: 'Confirm received' })
          .click()
        await pageA.getByRole('button', { name: 'Reverse RM 0.01' }).click()
        const reversed = await queryRows(
          A.client
            .from('settlement_payments')
            .select('id, status')
            .eq(
              'id',
              requiredManifestId(
                manifest.settlementPaymentId,
                'Settlement payment',
              ),
            ),
          'Reversed settlement lookup',
        )
        expect(reversed).toHaveLength(1)
        expect(reversed[0]?.status).toBe('reversed')
        await expectNoRows(
          C.client
            .from('settlement_payments')
            .select('id')
            .eq(
              'id',
              requiredManifestId(
                manifest.settlementPaymentId,
                'Settlement payment',
              ),
            ),
          'Unrelated User C settlement isolation',
        )
      } else {
        skipped.push(
          'Settlement confirmation/reversal: the dedicated A/B fixture had no safe payable debt in the required direction.',
        )
      }
    })

    await test.step('verify recurring idempotency only when a fixture exists', async () => {
      const rules = await queryRows(
        A.client
          .from('recurring_rules')
          .select('id')
          .eq('active', true),
        'Recurring rule lookup',
      )
      if (rules.length === 0) {
        skipped.push(
          'Recurring generation: Test User A has no dedicated active recurring fixture; none was created to avoid Production contamination.',
        )
        return
      }
      const expenseIdsBefore = await visibleExpenseIds(A.client)
      await pageA.goto('/')
      await pageA.reload()
      const firstDrafts = await recurringDraftKeys(A.client)
      await pageA.reload()
      const secondDrafts = await recurringDraftKeys(A.client)
      expect(secondDrafts).toEqual(firstDrafts)
      expect(new Set(secondDrafts).size).toBe(secondDrafts.length)
      expect(await visibleExpenseIds(A.client)).toEqual(expenseIdsBefore)
    })

    skipped.push(
      'Offline Manual-before-link ordering: exercising it now would require creating and consolidating a second Manual Person into the already-linked B identity, introducing avoidable Production identity state.',
    )
    for (const reason of skipped) {
      testInfo.annotations.push({ type: 'skip-reason', description: reason })
    }

    assertNoFatalBrowserErrors(networkEvidence.A!)
    assertNoFatalBrowserErrors(networkEvidence.B!)
    assertNoFatalBrowserErrors(networkEvidence.C!)
  } catch (error) {
    failed = true
    await captureFailureScreenshots(browserSessions, testInfo)
    throw error
  } finally {
    manifest.completedAt = new Date().toISOString()
    writeFileSync(
      resolve(evidenceRoot, 'phase3-smoke-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { encoding: 'utf8' },
    )
    writeFileSync(
      resolve(evidenceRoot, 'phase3-smoke-network.json'),
      `${JSON.stringify(networkEvidence, null, 2)}\n`,
      { encoding: 'utf8' },
    )
    writeFileSync(
      resolve(evidenceRoot, 'phase3-smoke-skips.json'),
      `${JSON.stringify(skipped, null, 2)}\n`,
      { encoding: 'utf8' },
    )

    for (const label of traceStarted) {
      const context = browserSessions[label]?.context
      if (!context) continue
      await (
        failed
          ? context.tracing.stop({
            path: resolve(evidenceRoot, `phase3-smoke-${label}-trace.zip`),
          })
          : context.tracing.stop()
      ).catch(() => undefined)
    }
    await Promise.all(
      Object.values(browserSessions).map((session) => session?.context.close()),
    )
    await Promise.all(
      Object.values(accountSessions).map(
        (session) => session?.client.auth.signOut(),
      ),
    )
  }
})

async function openBrowserSession(browser: Browser): Promise<BrowserSession> {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    baseURL: smoke.productionUrl,
    locale: 'en-MY',
    timezoneId: 'Asia/Kuala_Lumpur',
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  return { context, page: await context.newPage() }
}

async function signInThroughUi(
  page: Page,
  account: Readonly<{ email: string; password: string }>,
): Promise<void> {
  await page.goto('/login?redirect=%2F')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(`${smoke.productionUrl}/`, { timeout: 20_000 })
  await expect(primaryNavigation(page)).toBeVisible()
}

function publicSupabaseConfigFromRequest(
  request: Request,
): PublicSupabaseConfig | null {
  const url = new URL(request.url())
  const key = request.headers().apikey
  if (url.hostname !== EXPECTED_SUPABASE_HOST || !key) return null
  return { url: url.origin, key }
}

async function authenticateAccount(
  label: AccountLabel,
  config: PublicSupabaseConfig,
): Promise<AccountSession> {
  const account = smoke.accounts[label]
  const client = createClient(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  })
  if (error || !data.user) {
    throw new Error(safeSupabaseFailure(`Test User ${label} authentication`, error))
  }
  const { data: participantId, error: participantError } = await client.rpc(
    'current_participant_id',
  )
  if (participantError || typeof participantId !== 'string') {
    throw new Error(
      safeSupabaseFailure(
        `Test User ${label} Participant resolution`,
        participantError,
      ),
    )
  }
  const rows = await queryRows(
    client
      .from('participants')
      .select('id, display_name, kind')
      .eq('id', participantId),
    `Test User ${label} Participant lookup`,
  )
  if (rows.length !== 1 || rows[0]?.kind !== 'account') {
    throw new Error(`Test User ${label} does not have one account Participant.`)
  }
  return {
    label,
    client,
    userId: data.user.id,
    participantId,
    displayName: stringField(rows[0], 'display_name'),
  }
}

function monitorPage(page: Page, secrets: string[]): NetworkEvidence {
  const evidence: NetworkEvidence = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    errorResponses: [],
  }
  page.on('console', (message) => {
    if (message.type() === 'error') {
      evidence.consoleErrors.push(redact(message.text(), secrets))
    }
  })
  page.on('pageerror', (error) => {
    evidence.pageErrors.push(redact(error.message, secrets))
  })
  page.on('requestfailed', (request) => {
    evidence.failedRequests.push({
      method: request.method(),
      url: safeUrl(request.url()),
      reason: redact(
        request.failure()?.errorText ?? 'unknown request failure',
        secrets,
      ),
    })
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      evidence.errorResponses.push({
        method: response.request().method(),
        url: safeUrl(response.url()),
        status: response.status(),
      })
    }
  })
  return evidence
}

function credentialSecrets(): string[] {
  return Object.values(smoke.accounts).flatMap((account) => [
    account.email,
    account.password,
  ])
}

function redact(value: string, secrets: string[]): string {
  return secrets.reduce(
    (result, secret) => result.split(secret).join('[REDACTED]'),
    value,
  )
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return '[invalid-url]'
  }
}

function assertNoFatalBrowserErrors(evidence: NetworkEvidence): void {
  expect(evidence.pageErrors, 'Uncaught browser exceptions').toEqual([])
  expect(
    evidence.errorResponses.filter((response) => response.status >= 500),
    'Unexpected HTTP 5xx responses',
  ).toEqual([])
}

async function captureFailureScreenshots(
  sessions: Partial<Record<AccountLabel, BrowserSession>>,
  testInfo: TestInfo,
): Promise<void> {
  await Promise.all(
    (['A', 'B', 'C'] as const).flatMap((label) => {
      const page = sessions[label]?.page
      return page
        ? [page.screenshot({
          path: testInfo.outputPath(`phase3-smoke-${label}-failure.png`),
          fullPage: true,
        }).catch(() => undefined)]
        : []
    }),
  )
}

async function queryRows(
  query: PromiseLike<{
    data: unknown[] | null
    error: { message?: string; code?: string } | null
  }>,
  operation: string,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await withTimeout(
    Promise.resolve(query),
    20_000,
    `${operation} timed out.`,
  )
  if (error) throw new Error(safeSupabaseFailure(operation, error))
  return (data ?? []) as Array<Record<string, unknown>>
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function expectNoRows(
  query: PromiseLike<{
    data: unknown[] | null
    error: { message?: string; code?: string } | null
  }>,
  operation: string,
): Promise<void> {
  expect(await queryRows(query, operation), operation).toEqual([])
}

function safeSupabaseFailure(
  operation: string,
  error: { message?: string; code?: string } | null,
): string {
  return error
    ? `${operation} failed (${error.code ?? 'unknown-code'}): ${redact(
      error.message ?? 'unknown error',
      credentialSecrets(),
    )}`
    : `${operation} failed.`
}

function stringField(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (typeof value !== 'string') throw new Error(`${field} is missing.`)
  return value
}

function requiredManifestId(
  value: string | undefined,
  label: string,
): string {
  if (!value) throw new Error(`${label} ID is missing from the smoke manifest.`)
  return value
}

function mapSessions(
  sessions: Partial<Record<AccountLabel, AccountSession>>,
  select: (session: AccountSession) => string,
): Record<AccountLabel, string> {
  return {
    A: select(sessions.A!),
    B: select(sessions.B!),
    C: select(sessions.C!),
  }
}

function primaryNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Primary navigation' })
}

async function alignScrollableControlWithFixedAction(
  page: Page,
  control: Locator,
  action: Locator,
): Promise<void> {
  await control.scrollIntoViewIfNeeded()
  const [controlBox, actionBox] = await Promise.all([
    control.boundingBox(),
    action.boundingBox(),
  ])
  if (!controlBox || !actionBox) {
    throw new Error('Could not measure mobile form and Global Money Action bounds.')
  }
  await page.evaluate(
    ({ controlCenter, actionCenter }) =>
      window.scrollBy(0, controlCenter - actionCenter),
    {
      controlCenter: controlBox.y + controlBox.height / 2,
      actionCenter: actionBox.y + actionBox.height / 2,
    },
  )
}

async function clickGlobalAdd(page: Page): Promise<void> {
  await globalMoneyAction(page).click()
}

function globalMoneyAction(page: Page): Locator {
  return page.getByRole('button', { name: 'Quick add expense' })
}

function categorySelect(dialog: ReturnType<Page['getByRole']>) {
  return dialog.locator('label', { hasText: /^Category/ }).locator('select')
}

async function saveCapture(
  page: Page,
  description: string,
  amount: string,
): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Add Expense' })
  await dialog.getByRole('textbox', { name: /^Amount/ }).fill(amount)
  await dialog.getByPlaceholder('What was this for?').fill(description)
  await dialog.getByRole('button', { name: 'Save expense' }).click()
  await expect(dialog).toHaveCount(0)
}

async function expenseSnapshot(
  client: SupabaseClient,
  expenseId: string,
): Promise<ExpenseSnapshot> {
  const expenses = await queryRows(
    client
      .from('expenses')
      .select(`
        id, client_request_id, scope, space_id, created_by, total_minor,
        participant_count, currency, description, category, occurred_on,
        status, version, voided_at, created_at, updated_at
      `)
      .eq('id', expenseId),
    'Expense snapshot header',
  )
  expect(expenses).toHaveLength(1)
  const participations = await queryRows(
    client
      .from('expense_participations')
      .select(`
        id, expense_id, participant_id, name_snapshot, participant_order,
        state, tracking_mode, created_at, updated_at
      `)
      .eq('expense_id', expenseId)
      .order('id'),
    'Expense snapshot participations',
  )
  const payerContributions = await queryRows(
    client
      .from('payer_contributions')
      .select('expense_participation_id, expense_id, amount_minor')
      .eq('expense_id', expenseId)
      .order('expense_participation_id'),
    'Expense snapshot payer contributions',
  )
  const shares = await queryRows(
    client
      .from('expense_shares')
      .select('expense_participation_id, expense_id, amount_minor')
      .eq('expense_id', expenseId)
      .order('expense_participation_id'),
    'Expense snapshot shares',
  )
  return {
    expense: expenses[0]!,
    participations,
    payerContributions,
    shares,
  }
}

function sumMinor(rows: Array<Record<string, unknown>>): number {
  return rows.reduce((sum, row) => (
    sum + (typeof row.amount_minor === 'number' ? row.amount_minor : 0)
  ), 0)
}

function amountForParticipation(
  rows: Array<Record<string, unknown>>,
  participationId: string,
): number {
  const row = rows.find(
    (candidate) =>
      candidate.expense_participation_id === participationId,
  )
  return typeof row?.amount_minor === 'number' ? row.amount_minor : 0
}

async function personLinkRequests(
  owner: AccountSession,
  input: {
    personId: string
    targetParticipantId: string
    status: 'pending' | 'accepted'
  },
): Promise<Array<Record<string, unknown>>> {
  return queryRows(
    owner.client
      .from('participant_link_requests')
      .select(`
        id, person_relationship_id, manual_participant_id,
        target_participant_id, requested_by, status
      `)
      .eq('person_relationship_id', input.personId)
      .eq('target_participant_id', input.targetParticipantId)
      .eq('requested_by', owner.participantId)
      .eq('status', input.status)
      .order('created_at'),
    `${input.status} Person-bound link request lookup`,
  )
}

async function waitForSinglePendingLinkRequest(
  owner: AccountSession,
  input: {
    personId: string
    targetParticipantId: string
    timeoutMs: number
  },
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + input.timeoutMs
  while (Date.now() < deadline) {
    const requests = await personLinkRequests(owner, {
      personId: input.personId,
      targetParticipantId: input.targetParticipantId,
      status: 'pending',
    })
    if (requests.length > 1) {
      throw new Error(
        `Duplicate pending Person link requests found: ${requests.length}.`,
      )
    }
    if (requests.length === 1) return requests[0]!
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 400))
  }
  throw new Error(
    `No pending Person link request appeared within ${input.timeoutMs}ms.`,
  )
}

async function friendshipBetween(
  actor: AccountSession,
  counterpartId: string,
): Promise<{ id: string; status: string } | null> {
  const rows = await queryRows(
    actor.client
      .from('friendships')
      .select('id, participant_low_id, participant_high_id, status')
      .or(
        `and(participant_low_id.eq.${actor.participantId},participant_high_id.eq.${counterpartId}),and(participant_low_id.eq.${counterpartId},participant_high_id.eq.${actor.participantId})`,
      ),
    `Friendship lookup for Test User ${actor.label}`,
  )
  if (rows.length > 1) throw new Error('Duplicate A/B Friendship rows found.')
  return rows[0]
    ? { id: stringField(rows[0], 'id'), status: stringField(rows[0], 'status') }
    : null
}

async function assertNoRelationship(
  actorClient: SupabaseClient,
  firstParticipantId: string,
  secondParticipantId: string,
): Promise<void> {
  await expectNoRows(
    actorClient
      .from('friendships')
      .select('id')
      .or(
        `and(participant_low_id.eq.${firstParticipantId},participant_high_id.eq.${secondParticipantId}),and(participant_low_id.eq.${secondParticipantId},participant_high_id.eq.${firstParticipantId})`,
      ),
    'Unrelated friendship assertion',
  )
}

async function visibleSettlementIds(client: SupabaseClient): Promise<string[]> {
  const rows = await queryRows(
    client.from('settlement_payments').select('id').order('id'),
    'Visible settlement IDs',
  )
  return rows.map((row) => stringField(row, 'id'))
}

async function visibleExpenseIds(client: SupabaseClient): Promise<string[]> {
  const rows = await queryRows(
    client.from('expenses').select('id').order('id'),
    'Visible expense IDs',
  )
  return rows.map((row) => stringField(row, 'id'))
}

async function ownSpaceMemberships(
  account: AccountSession,
): Promise<Array<Record<string, unknown>>> {
  return queryRows(
    account.client
      .from('space_members')
      .select('space_id, participant_id, role, removed_at')
      .eq('participant_id', account.participantId)
      .order('space_id'),
    `Test User ${account.label} own Space memberships`,
  )
}

async function participantSpaceMemberships(
  account: AccountSession,
  participantId: () => string,
): Promise<Array<Record<string, unknown>>> {
  return queryRows(
    account.client
      .from('space_members')
      .select('space_id, participant_id, role, removed_at')
      .eq('participant_id', participantId())
      .order('space_id'),
    `Test User ${account.label} visible Manual Space memberships`,
  )
}

async function recurringDraftKeys(client: SupabaseClient): Promise<string[]> {
  const rows = await queryRows(
    client
      .from('recurring_drafts')
      .select('rule_id, scheduled_for')
      .order('rule_id')
      .order('scheduled_for'),
    'Recurring draft keys',
  )
  return rows.map((row) => (
    `${stringField(row, 'rule_id')}:${stringField(row, 'scheduled_for')}`
  ))
}
