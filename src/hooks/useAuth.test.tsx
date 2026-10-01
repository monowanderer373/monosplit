/** @vitest-environment jsdom */
import { StrictMode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './useAuth'

const mock = vi.hoisted(() => ({
  callbacks: new Set<(event: string, session: unknown) => void>(),
  getSession: vi.fn(),
  profile: vi.fn(),
  participant: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabaseEnabled: true,
  supabase: {
    auth: {
      getSession: mock.getSession,
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        mock.callbacks.add(callback)
        return { data: { subscription: { unsubscribe: () => mock.callbacks.delete(callback) } } }
      },
    },
    from: (table: string) => ({ select: () => ({ eq: () => ({
      maybeSingle: table === 'participants' ? mock.participant : mock.profile,
    }) }) }),
  },
}))
vi.mock('../lib/telemetry', () => ({ observeAuthFailure: vi.fn(), observeAuthOutcome: vi.fn() }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const user = { id: 'account-a', email: 'a@example.test', is_anonymous: false, user_metadata: {} }
const sessionResult = (signedIn: boolean) => ({ data: { session: signedIn ? { user } : null }, error: null })
function Probe() {
  const auth = useAuth()
  return <>
    <p>{auth.loading ? 'opening' : auth.sessionError ? 'retry' : auth.authUser ? `home:${auth.authUser.participantId}` : 'signed-out'}</p>
    <button onClick={auth.retrySession}>Retry</button>
  </>
}
async function emit(event: string, session: unknown) {
  await act(async () => { mock.callbacks.forEach((callback) => callback(event, session)) })
}
beforeEach(() => {
  mock.callbacks.clear()
  vi.clearAllMocks()
  mock.profile.mockResolvedValue({ data: { display_name: 'Dav' }, error: null })
  mock.participant.mockResolvedValue({ data: { id: 'participant-a' }, error: null })
})
afterEach(cleanup)

describe('session startup', () => {
  it('never shows signed-out or missing participant while a saved session and profile restore', async () => {
    const session = deferred<ReturnType<typeof sessionResult>>()
    const participant = deferred<unknown>()
    mock.getSession.mockReturnValue(session.promise)
    mock.participant.mockReturnValue(participant.promise)
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByText('opening')).toBeTruthy()
    await emit('INITIAL_SESSION', null)
    expect(screen.queryByText('signed-out')).toBeNull()
    await act(async () => session.resolve(sessionResult(true)))
    expect(screen.getByText('opening')).toBeTruthy()
    await act(async () => participant.resolve({ data: { id: 'participant-a' }, error: null }))
    expect(await screen.findByText('home:participant-a')).toBeTruthy()
  })

  it('shows signed-out only after a successful empty session read', async () => {
    mock.getSession.mockResolvedValue(sessionResult(false))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('signed-out')).toBeTruthy()
  })

  it('offers retry instead of implying signed-out on a session read failure', async () => {
    mock.getSession.mockResolvedValue({ data: { session: null }, error: new Error('offline') })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('retry')).toBeTruthy()
    expect(screen.queryByText('signed-out')).toBeNull()
    mock.getSession.mockResolvedValue(sessionResult(true))
    await act(async () => screen.getByRole('button').click())
    expect(await screen.findByText('home:participant-a')).toBeTruthy()
  })

  it('preserves the participant while the same user refreshes their token', async () => {
    mock.getSession.mockResolvedValue(sessionResult(true))
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('home:participant-a')
    const participant = deferred<unknown>()
    mock.participant.mockReturnValue(participant.promise)
    await emit('TOKEN_REFRESHED', { user })
    expect(screen.getByText('home:participant-a')).toBeTruthy()
    await act(async () => participant.resolve({ data: { id: 'participant-a' }, error: null }))
  })

  it('does not let a delayed bootstrap undo a newer sign-in', async () => {
    const session = deferred<ReturnType<typeof sessionResult>>()
    mock.getSession.mockReturnValue(session.promise)
    render(<AuthProvider><Probe /></AuthProvider>)
    await emit('SIGNED_IN', { user })
    expect(await screen.findByText('home:participant-a')).toBeTruthy()
    await act(async () => session.resolve(sessionResult(false)))
    expect(screen.getByText('home:participant-a')).toBeTruthy()
  })

  it('does not let a delayed profile undo sign-out', async () => {
    const participant = deferred<unknown>()
    mock.getSession.mockResolvedValue(sessionResult(true))
    mock.participant.mockReturnValue(participant.promise)
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(async () => {})
    await emit('SIGNED_OUT', null)
    await act(async () => participant.resolve({ data: { id: 'participant-a' }, error: null }))
    expect(screen.getByText('signed-out')).toBeTruthy()
  })

  it('ignores responses from the cleaned-up StrictMode effect', async () => {
    const first = deferred<ReturnType<typeof sessionResult>>()
    mock.getSession.mockReturnValueOnce(first.promise).mockResolvedValue(sessionResult(true))
    render(<StrictMode><AuthProvider><Probe /></AuthProvider></StrictMode>)
    expect(await screen.findByText('home:participant-a')).toBeTruthy()
    await act(async () => first.resolve(sessionResult(false)))
    expect(screen.getByText('home:participant-a')).toBeTruthy()
    expect(mock.callbacks.size).toBe(1)
  })

  it('does not label a failed participant read as missing schema', async () => {
    mock.getSession.mockResolvedValue(sessionResult(true))
    mock.participant.mockResolvedValue({ data: null, error: new Error('network failed') })
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(await screen.findByText('retry')).toBeTruthy()
    expect(screen.queryByText('home:null')).toBeNull()
  })
})
