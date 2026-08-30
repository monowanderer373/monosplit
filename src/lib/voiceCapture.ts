export type VoiceCaptureErrorCode =
  | 'permission_denied'
  | 'unavailable'
  | 'no_speech'

export type VoiceCaptureError = Readonly<{
  code: VoiceCaptureErrorCode
}>

export type VoiceCaptureResult =
  | Readonly<{ ok: true; transcript: string }>
  | Readonly<{ ok: false; error: VoiceCaptureError }>

export type RecognizerErrorCode =
  | 'not-allowed'
  | 'service-not-allowed'
  | 'permission-denied'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'no-speech'
  | 'unavailable'

export type SpeechRecognizerListener = Readonly<{
  onTranscript: (transcript: string) => void
  onError: (code: RecognizerErrorCode) => void
  onEnd: () => void
}>

/**
 * Minimal injected boundary around a browser speech-recognition
 * implementation. The module intentionally does not reference window,
 * SpeechRecognition, or any other browser global.
 */
export interface SpeechRecognizer {
  readonly available?: boolean
  start(listener: SpeechRecognizerListener): void
  stop?(): void
}

function mapRecognizerError(code: RecognizerErrorCode): VoiceCaptureErrorCode {
  if (
    code === 'not-allowed'
    || code === 'service-not-allowed'
    || code === 'permission-denied'
  ) {
    return 'permission_denied'
  }
  if (code === 'no-speech') return 'no_speech'
  return 'unavailable'
}

/**
 * Captures one transcript from an injected recognizer. It has no expense
 * parsing, compilation, repository access, or persistence side effects.
 */
export function captureVoiceTranscript(
  recognizer: SpeechRecognizer | null | undefined,
): Promise<VoiceCaptureResult> {
  if (!recognizer || recognizer.available === false) {
    return Promise.resolve({ ok: false, error: { code: 'unavailable' } })
  }

  return new Promise((resolve) => {
    let settled = false
    let receivedTranscript = false

    const finish = (result: VoiceCaptureResult): void => {
      if (settled) return
      settled = true
      try {
        recognizer.stop?.()
      } catch {
        // Cleanup errors cannot replace the typed capture result.
      }
      resolve(result)
    }

    try {
      recognizer.start({
        onTranscript: (rawTranscript) => {
          receivedTranscript = true
          const transcript = rawTranscript.trim()
          if (!transcript) {
            finish({ ok: false, error: { code: 'no_speech' } })
            return
          }
          finish({ ok: true, transcript })
        },
        onError: (code) => {
          finish({ ok: false, error: { code: mapRecognizerError(code) } })
        },
        onEnd: () => {
          if (!receivedTranscript) {
            finish({ ok: false, error: { code: 'no_speech' } })
          }
        },
      })
    } catch {
      finish({ ok: false, error: { code: 'unavailable' } })
    }
  })
}
