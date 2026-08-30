import { describe, expect, it, vi } from 'vitest'
import {
  captureVoiceTranscript,
  type SpeechRecognizer,
  type SpeechRecognizerListener,
} from './voiceCapture'

function controlledRecognizer(): {
  recognizer: SpeechRecognizer
  listener: () => SpeechRecognizerListener
  stop: ReturnType<typeof vi.fn>
} {
  let current: SpeechRecognizerListener | undefined
  const stop = vi.fn()
  return {
    recognizer: {
      start(listener) {
        current = listener
      },
      stop,
    },
    listener() {
      if (!current) throw new Error('recognizer has not started')
      return current
    },
    stop,
  }
}

describe('captureVoiceTranscript', () => {
  it('returns a trimmed transcript from an injected recognizer', async () => {
    const controlled = controlledRecognizer()
    const pending = captureVoiceTranscript(controlled.recognizer)
    controlled.listener().onTranscript('  Dinner RM 20  ')

    await expect(pending).resolves.toEqual({
      ok: true,
      transcript: 'Dinner RM 20',
    })
    expect(controlled.stop).toHaveBeenCalledOnce()
  })

  it.each([
    'not-allowed',
    'service-not-allowed',
    'permission-denied',
  ] as const)('maps %s to a permission error', async (code) => {
    const controlled = controlledRecognizer()
    const pending = captureVoiceTranscript(controlled.recognizer)
    controlled.listener().onError(code)

    await expect(pending).resolves.toEqual({
      ok: false,
      error: { code: 'permission_denied' },
    })
  })

  it('returns unavailable when no recognizer exists or startup throws', async () => {
    await expect(captureVoiceTranscript(null)).resolves.toEqual({
      ok: false,
      error: { code: 'unavailable' },
    })

    const recognizer: SpeechRecognizer = {
      start() {
        throw new Error('browser service missing')
      },
    }
    await expect(captureVoiceTranscript(recognizer)).resolves.toEqual({
      ok: false,
      error: { code: 'unavailable' },
    })
  })

  it('returns no-speech when recognition ends without a transcript', async () => {
    const controlled = controlledRecognizer()
    const pending = captureVoiceTranscript(controlled.recognizer)
    controlled.listener().onEnd()

    await expect(pending).resolves.toEqual({
      ok: false,
      error: { code: 'no_speech' },
    })
  })

  it('returns no-speech for a blank transcript', async () => {
    const controlled = controlledRecognizer()
    const pending = captureVoiceTranscript(controlled.recognizer)
    controlled.listener().onTranscript('   ')

    await expect(pending).resolves.toEqual({
      ok: false,
      error: { code: 'no_speech' },
    })
  })
})
