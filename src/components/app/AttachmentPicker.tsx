'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, ImageIcon, Mic, Paperclip, Square, Trash2, Volume2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ACCEPT, BUCKET, attachmentPath, isAudio, rejectReason } from '@/lib/attachments'

export interface PendingFile {
  key: string
  file: File
  /** Local object URL, so a clip can be played back before it is uploaded. */
  preview: string | null
}

/** Longest clip we will record. Past this it stops being a note. */
const MAX_SECONDS = 180

/** Containers, best first — Chrome and Android take webm, iOS takes mp4. */
const CONTAINERS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']

/**
 * Files chosen while the event is still being written.
 *
 * Nothing can be uploaded yet — storage paths are keyed on the event id, and
 * the event does not exist until Save. So the files are held here and sent
 * the moment the insert returns an id. If the form is abandoned, nothing was
 * ever written and there is nothing to clean up.
 *
 * The voice note is the reason this exists on a phone: describing a floor
 * incident by thumb is why events go unrecorded. Dictation on the field above
 * turns speech into text; this keeps the audio itself, for when the tone or
 * the background matters more than the transcript.
 */
export function AttachmentPicker({
  files,
  onChange,
}: {
  files: PendingFile[]
  onChange: (next: PendingFile[]) => void
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const startedAt = useRef(0)
  const filesRef = useRef(files)
  filesRef.current = files

  // Elapsed time comes from the clock, not from counting ticks — a
  // backgrounded phone throttles timers, and a counter would drift below the
  // real length of the clip it is guarding.
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => {
      const s = Math.floor((performance.now() - startedAt.current) / 1000)
      setSeconds(s)
      if (s >= MAX_SECONDS) stopRecording()
    }, 300)
    return () => clearInterval(t)
  }, [recording])

  // The microphone must be released with the form, and object URLs freed —
  // both outlive the component otherwise.
  useEffect(() => {
    return () => {
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stream.current?.getTracks().forEach((t) => t.stop())
      filesRef.current.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview)
      })
    }
  }, [])

  function add(list: FileList | File[]) {
    setError('')
    const next = [...filesRef.current]
    for (const file of Array.from(list)) {
      const bad = rejectReason(file)
      if (bad) {
        setError(bad)
        continue
      }
      next.push({
        key: `${file.name}-${file.size}-${next.length}-${performance.now()}`,
        file,
        preview: isAudio(file.type, file.name) ? URL.createObjectURL(file) : null,
      })
    }
    onChange(next)
  }

  function remove(key: string) {
    const gone = filesRef.current.find((f) => f.key === key)
    if (gone?.preview) URL.revokeObjectURL(gone.preview)
    onChange(filesRef.current.filter((f) => f.key !== key))
  }

  async function startRecording() {
    setError('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = s

      const type = CONTAINERS.find((c) => MediaRecorder.isTypeSupported(c))
      const rec = new MediaRecorder(s, type ? { mimeType: type } : undefined)
      const chunks: BlobPart[] = []

      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      rec.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop())
        stream.current = null
        setRecording(false)

        // The bucket lists plain container types; the codec parameter that
        // MediaRecorder reports back is not part of that list.
        const base = (rec.mimeType || 'audio/webm').split(';')[0] ?? 'audio/webm'
        const ext = base.includes('mp4') ? 'm4a' : base.includes('ogg') ? 'ogg' : 'webm'
        const stamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        const file = new File([new Blob(chunks, { type: base })], `Voice note ${stamp}.${ext}`, {
          type: base,
        })
        add([file])
      }

      rec.start()
      recorder.current = rec
      startedAt.current = performance.now()
      setSeconds(0)
      setRecording(true)
    } catch {
      setError('The microphone is blocked. Allow it in your browser settings and try again.')
    }
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop()
    else setRecording(false)
  }

  const canRecord =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined'

  return (
    <div className="epi-attach" style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--epi-fg-strong)',
          }}
        >
          <Paperclip size={13} style={{ color: 'var(--epi-fg-3)' }} />
          Attachments
          <span style={{ fontWeight: 500, color: 'var(--epi-fg-3)' }}>· optional</span>
        </span>

        <span style={{ flex: 1 }} />

        {canRecord ? (
          <button
            type="button"
            onClick={() => (recording ? stopRecording() : void startRecording())}
            style={{
              height: '32px',
              padding: '0 12px',
              borderRadius: '9px',
              border: `1px solid ${recording ? 'var(--epi-red-bd)' : 'var(--epi-border-2)'}`,
              background: recording ? 'var(--epi-red-bg)' : 'var(--epi-input)',
              color: recording ? 'var(--epi-red)' : 'var(--epi-fg)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
            }}
          >
            {recording ? <Square size={11} fill="currentColor" /> : <Mic size={13} />}
            {recording
              ? `Stop · ${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`
              : 'Voice note'}
          </button>
        ) : null}

        <label
          style={{
            height: '32px',
            padding: '0 12px',
            borderRadius: '9px',
            border: '1px solid var(--epi-border-2)',
            background: 'var(--epi-input)',
            color: 'var(--epi-fg)',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <Paperclip size={13} />
          Add file
          <input
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(e) => {
              if (e.target.files?.length) add(e.target.files)
              e.target.value = ''
            }}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {error ? (
        <div style={{ fontSize: '12px', color: 'var(--epi-red)', lineHeight: 1.45 }}>{error}</div>
      ) : null}

      {files.length === 0 ? (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--epi-fg-3)', lineHeight: 1.5 }}>
          Add a photo of the issue, a PDF, or record a voice note instead of typing.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {files.map((f) => {
            const audio = isAudio(f.file.type, f.file.name)
            return (
              <div
                key={f.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '9px',
                  border: '1px solid var(--epi-border)',
                  background: 'var(--epi-canvas)',
                }}
              >
                <span style={{ color: 'var(--epi-fg-3)', flex: '0 0 auto', display: 'flex' }}>
                  {audio ? (
                    <Volume2 size={15} />
                  ) : f.file.type === 'application/pdf' ? (
                    <FileText size={15} />
                  ) : (
                    <ImageIcon size={15} />
                  )}
                </span>

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.file.name}
                  </span>
                  {/* A clip you cannot hear back before saving is a clip you
                      have to trust blindly. */}
                  {f.preview ? (
                    <audio
                      controls
                      src={f.preview}
                      style={{ width: '100%', height: '30px', marginTop: '5px' }}
                    />
                  ) : null}
                </span>

                <span
                  className="epi-num"
                  style={{ fontSize: '11px', color: 'var(--epi-fg-3)', flex: '0 0 auto' }}
                >
                  {(f.file.size / 1024).toFixed(0)} KB
                </span>

                <button
                  type="button"
                  onClick={() => remove(f.key)}
                  aria-label={`Remove ${f.file.name}`}
                  className="epi-attach-del"
                  style={{
                    width: '26px',
                    height: '26px',
                    flex: '0 0 26px',
                    borderRadius: '7px',
                    border: '1px solid var(--epi-border)',
                    background: 'transparent',
                    color: 'var(--epi-red)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Send the held files once the event exists.
 *
 * Returns the names that did not make it. The event itself is already saved
 * by this point and is never rolled back for a failed file — the record of
 * what happened matters more than the photo of it, and losing the event to
 * save the attachment would be the wrong trade.
 */
export async function uploadPending(
  eventId: string,
  files: PendingFile[],
  uploadedBy: string,
): Promise<string[]> {
  if (files.length === 0) return []

  const supabase = createClient()
  const failed: string[] = []

  for (const { file } of files) {
    const path = attachmentPath(eventId, file.name)

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (upErr) {
      failed.push(file.name)
      continue
    }

    const { error: rowErr } = await supabase.from('attachments').insert({
      event_id: eventId,
      file_url: path,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: uploadedBy,
    })

    // An object with no row is invisible to the app and unreachable by the
    // person who uploaded it, so it goes back out.
    if (rowErr) {
      await supabase.storage.from(BUCKET).remove([path])
      failed.push(file.name)
    }
  }

  return failed
}
