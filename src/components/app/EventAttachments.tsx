'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, ImageIcon, Loader2, Paperclip, Play, Trash2, Upload, Volume2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { describeWriteError } from '@/lib/errors'
import { labelCaps } from '@/lib/design'
import { ACCEPT, BUCKET, attachmentPath, isAudio, rejectReason } from '@/lib/attachments'

interface Row {
  id: string
  file_url: string
  file_name: string
  file_size: number | null
  created_at: string
  uploaded_by: string | null
}

/**
 * Evidence attached to one performance event.
 *
 * The bucket is private, so nothing here is a public URL — each file is
 * opened through a signed link valid for ten minutes, minted at the moment
 * the user clicks. A stored public URL would outlive the person's need to
 * see it and could be forwarded to anyone.
 */
export function EventAttachments({
  eventId,
  canUpload,
  currentAppUserId,
  isAdmin,
}: {
  eventId: string
  canUpload: boolean
  currentAppUserId: string
  isAdmin: boolean
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [openedAt] = useState(() => Date.now())
  // Signed URLs for clips the user has asked to hear, minted on the click.
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data, error: err } = await createClient()
      .from('attachments')
      .select('id, file_url, file_name, file_size, created_at, uploaded_by')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    if (err) setError(describeWriteError(err.message).message)
    setRows((data ?? []) as Row[])
    setLoading(false)
  }, [eventId])

  // Fetching on mount is what this rule warns about, but a network read IS
  // the external-system synchronisation effects exist for — the alternative
  // is threading attachments through a client-side modal chain that does not
  // know which event will be opened. Disabled deliberately, for this line
  // only, so the rule keeps working everywhere else.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function upload(file: File) {
    setError('')

    const bad = rejectReason(file)
    if (bad) {
      setError(bad)
      return
    }

    setBusy(true)
    const supabase = createClient()
    const path = attachmentPath(eventId, file.name)

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

    if (upErr) {
      setBusy(false)
      setError(
        upErr.message.toLowerCase().includes('row-level security') ||
          upErr.message.toLowerCase().includes('unauthorized')
          ? 'Your role cannot attach files to this event.'
          : upErr.message,
      )
      return
    }

    const { error: rowErr } = await supabase.from('attachments').insert({
      event_id: eventId,
      file_url: path,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: currentAppUserId,
    })

    // The row is what the app reads; an orphaned object would be invisible
    // and unreachable, so it is cleaned up rather than left behind.
    if (rowErr) {
      await supabase.storage.from(BUCKET).remove([path])
      setBusy(false)
      setError(rowErr.message)
      return
    }

    setBusy(false)
    await load()
  }

  async function signedUrl(row: Row) {
    const { data, error: err } = await createClient()
      .storage.from(BUCKET)
      .createSignedUrl(row.file_url, 600)

    if (err || !data?.signedUrl) {
      setError('Could not open that file. It may have been removed.')
      return null
    }
    return data.signedUrl
  }

  async function open(row: Row) {
    setError('')
    const url = await signedUrl(row)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  // A voice note opened in a new tab is a voice note nobody plays. It gets a
  // player in place instead, on the row where it was left.
  async function play(row: Row) {
    setError('')
    const url = await signedUrl(row)
    if (url) setAudioUrls((prev) => ({ ...prev, [row.id]: url }))
  }

  async function remove(row: Row) {
    setError('')
    setBusy(true)
    const supabase = createClient()

    const { error: rowErr, count } = await supabase
      .from('attachments')
      .delete({ count: 'exact' })
      .eq('id', row.id)

    if (rowErr || count === 0) {
      setBusy(false)
      setError(
        rowErr?.message ??
          'That file can no longer be removed — the 48-hour window has passed. Ask a Super Admin.',
      )
      return
    }

    await supabase.storage.from(BUCKET).remove([row.file_url])
    setBusy(false)
    await load()
  }

  // The clock is read once, when the panel opens. Reading it inside render
  // would make the component impure and its output depend on when React
  // happened to re-render — the same defect the lint config caught in
  // EventDetail.
  const canRemove = (r: Row) =>
    isAdmin ||
    (r.uploaded_by === currentAppUserId &&
      openedAt - new Date(r.created_at).getTime() < 48 * 3600 * 1000)

  return (
    <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--epi-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
        <Paperclip size={14} style={{ color: 'var(--epi-fg-3)' }} />
        <span style={labelCaps}>Attachments</span>
        {rows.length ? (
          <span className="epi-num" style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
            {rows.length}
          </span>
        ) : null}

        {canUpload ? (
          <label
            style={{
              marginLeft: 'auto',
              height: '30px',
              padding: '0 11px',
              borderRadius: '8px',
              border: '1px solid var(--epi-border-2)',
              background: 'var(--epi-input)',
              color: 'var(--epi-fg)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: busy ? 'progress' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
            }}
          >
            {busy ? <Loader2 size={13} className="epi-spin" /> : <Upload size={13} />}
            {busy ? 'Uploading…' : 'Add file'}
            <input
              type="file"
              accept={ACCEPT}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void upload(f)
              }}
              style={{ display: 'none' }}
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <div
          style={{
            fontSize: '12.5px',
            color: 'var(--epi-red)',
            background: 'var(--epi-red-bg)',
            border: '1px solid var(--epi-red-bd)',
            borderRadius: '8px',
            padding: '9px 12px',
            marginBottom: '10px',
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>
          {canUpload
            ? 'No files yet. Attach a photo, a PDF or a voice note as evidence for this event.'
            : 'No files attached.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.map((r) => {
            const audio = isAudio('', r.file_name)
            return (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 11px',
                borderRadius: '9px',
                border: '1px solid var(--epi-border)',
                background: 'var(--epi-canvas)',
              }}
            >
              <span style={{ color: 'var(--epi-fg-3)', flex: '0 0 auto', display: 'flex' }}>
                {audio ? (
                  <Volume2 size={15} />
                ) : r.file_name.toLowerCase().endsWith('.pdf') ? (
                  <FileText size={15} />
                ) : (
                  <ImageIcon size={15} />
                )}
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <button
                  onClick={() => void (audio ? play(r) : open(r))}
                  title={audio ? 'Play this clip' : 'Open in a new tab'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    width: '100%',
                    minWidth: 0,
                    textAlign: 'left',
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--epi-fg)',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  {audio && !audioUrls[r.id] ? (
                    <Play size={12} style={{ flex: '0 0 12px', color: 'var(--epi-teal)' }} />
                  ) : null}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.file_name}
                  </span>
                </button>
                {audioUrls[r.id] ? (
                  <audio
                    controls
                    autoPlay
                    src={audioUrls[r.id]}
                    style={{ width: '100%', height: '30px', marginTop: '6px' }}
                  />
                ) : null}
              </span>

              <span
                className="epi-num"
                style={{ fontSize: '11.5px', color: 'var(--epi-fg-3)', flex: '0 0 auto' }}
              >
                {r.file_size ? `${(r.file_size / 1024).toFixed(0)} KB` : ''}
              </span>

              {canRemove(r) ? (
                <button
                  onClick={() => void remove(r)}
                  disabled={busy}
                  aria-label={`Remove ${r.file_name}`}
                  title="Remove"
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
              ) : null}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
