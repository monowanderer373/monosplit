import type {
  RecognizerErrorCode,
  SpeechRecognizer,
  SpeechRecognizerListener,
} from './voiceCapture'

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

export function createBrowserVoiceRecognizer(language = 'en-MY'): SpeechRecognizer | null {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
  const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  if (!Constructor) return null
  const recognition = new Constructor()
  recognition.continuous = false
  recognition.interimResults = false
  recognition.lang = language

  return {
    available: true,
    start(listener: SpeechRecognizerListener) {
      recognition.onresult = (event) => listener.onTranscript(event.results[0]?.[0]?.transcript ?? '')
      recognition.onerror = (event) => listener.onError(event.error as RecognizerErrorCode)
      recognition.onend = listener.onEnd
      recognition.start()
    },
    stop() {
      recognition.stop()
    },
  }
}
