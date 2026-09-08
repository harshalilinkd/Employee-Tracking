'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

/**
 * The browser's own dictation, which TypeScript's DOM library still does not
 * describe. Only the handful of members used here are declared.
 */
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
interface SpeechEventLike {
  resultIndex: number
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
}
type SpeechCtor = new () => SpeechRecognitionLike

function ctor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor
    webkitSpeechRecognition?: SpeechCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const LANGS = [
  { code: 'en-IN', short: 'EN' },
  { code: 'hi-IN', short: 'हिं' },
] as const

/**
 * Speak instead of type.
 *
 * Dictation, not a recording: the words land in the field itself, so they are
 * searchable, they reach the report, and a manager reading this in three
 * months does not have to press play. A voice note is the other half of the
 * answer and lives with the attachments — that one keeps the audio when the
 * point is the tone or the noise on the floor, not the sentence.
 *
 * Hindi is offered beside English because that is the language the shop floor
 * gets described in, and a dictation button that only understands English is
 * a button that gets used once.
 *
 * Rendered only where the browser can do it. Chrome, Edge and Safari can;
 * Firefox cannot, and a dead microphone would be worse than none.
 */
export function VoiceDictation({ onText }: { onText: (chunk: string) => void }) {
  const [supported] = useState(() => ctor() !== null)
  const [listening, setListening] = useState(false)
  const [lang, setLang] = useState<string>(LANGS[0].code)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')

  const rec = useRef<SpeechRecognitionLike | null>(null)
  // Whether the user still wants to be heard. Recognition ends itself after a
  // pause, so without this the mic would die mid-sentence every time.
  const wanted = useRef(false)
  // Held in a ref so the recogniser's handlers always call the current
  // setter without the recogniser itself being torn down and restarted on
  // every parent render — restarting it mid-sentence loses the sentence.
  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  const stop = useCallback(() => {
    wanted.current = false
    rec.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(
    (code: string) => {
      const C = ctor()
      if (!C) return

      rec.current?.abort()
      const r = new C()
      r.lang = code
      r.continuous = true
      r.interimResults = true

      r.onresult = (e) => {
        let final = ''
        let pending = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (!res) continue
          if (res.isFinal) final += res[0].transcript
          else pending += res[0].transcript
        }
        setInterim(pending)
        const clean = final.trim()
        if (clean) onTextRef.current(clean)
      }

      r.onerror = (e) => {
        // Silence is not a failure — it is someone thinking. Everything else
        // is worth saying out loud, because the user is waiting to be heard.
        if (e.error === 'no-speech' || e.error === 'aborted') return
        wanted.current = false
        setListening(false)
        setError(
          e.error === 'not-allowed' || e.error === 'service-not-allowed'
            ? 'The microphone is blocked. Allow it in your browser settings and try again.'
            : 'Dictation stopped. Please try again.',
        )
      }

      r.onend = () => {
        if (wanted.current) r.start()
        else setListening(false)
      }

      rec.current = r
      wanted.current = true
      setError('')
      setInterim('')
      r.start()
      setListening(true)
    },
    [],
  )

  // Leaving the form mid-sentence must release the microphone; a live
  // recogniser outliving its component keeps the indicator burning.
  useEffect(() => {
    return () => {
      wanted.current = false
      rec.current?.abort()
    }
  }, [])

  if (!supported) return null

  return (
    <span
      className="epi-voice"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
    >
      {listening ? (
        <span
          style={{
            fontSize: '11.5px',
            color: 'var(--epi-fg-3)',
            maxWidth: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {interim || 'Listening…'}
        </span>
      ) : null}

      {/* Language sits next to the mic, not in a settings screen: which one
          you need changes sentence by sentence. */}
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => {
            setLang(l.code)
            if (listening) start(l.code)
          }}
          aria-pressed={lang === l.code}
          title={l.code === 'hi-IN' ? 'Hindi dictation' : 'English (India) dictation'}
          style={{
            height: '26px',
            minWidth: '30px',
            padding: '0 7px',
            borderRadius: '7px',
            border: `1px solid ${lang === l.code ? 'var(--epi-teal-bd)' : 'var(--epi-border)'}`,
            background: lang === l.code ? 'var(--epi-teal-bg)' : 'transparent',
            color: lang === l.code ? 'var(--epi-teal)' : 'var(--epi-fg-3)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {l.short}
        </button>
      ))}

      <button
        type="button"
        onClick={() => (listening ? stop() : start(lang))}
        title={listening ? 'Stop dictation' : 'Speak instead of typing'}
        style={{
          height: '28px',
          padding: '0 11px',
          borderRadius: '8px',
          border: `1px solid ${listening ? 'var(--epi-red-bd)' : 'var(--epi-border-2)'}`,
          background: listening ? 'var(--epi-red-bg)' : 'var(--epi-input)',
          color: listening ? 'var(--epi-red)' : 'var(--epi-fg)',
          fontSize: '12.5px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {listening ? <Square size={11} fill="currentColor" /> : <Mic size={13} />}
        {listening ? 'Stop' : 'Speak'}
      </button>

      {error ? (
        <span style={{ fontSize: '11.5px', color: 'var(--epi-red)', maxWidth: '190px', lineHeight: 1.35 }}>
          {error}
        </span>
      ) : null}
    </span>
  )
}
