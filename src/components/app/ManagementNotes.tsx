'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, NotebookPen, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { describeWriteError } from '@/lib/errors'
import { cardStyle, initials, subtleButton } from '@/lib/design'

interface Note {
  id: string
  body: string
  created_at: string
  updated_at: string
  author_id: string
  author: { full_name: string } | { full_name: string }[] | null
}

/**
 * Private management context on one employee.
 *
 * Deliberately separate from performance events: an event is a dated fact
 * that appears on the signed report, while a note is an observation the MD
 * wants remembered without it becoming a formal mark on someone's record.
 * Conflating the two would push soft context into a document that gets
 * signed and shared.
 *
 * Admins only, enforced by the database — management_notes_admin_all.
 */
export function ManagementNotes({
  employeeId,
  employeeName,
  currentAppUserId,
  compact = false,
}: {
  employeeId: string
  employeeName: string
  currentAppUserId: string
  /** Side-column form: the explanation is dropped and Add moves into the
      header, because at 430px wide the preamble is longer than the notes. */
  compact?: boolean
}) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: err } = await createClient()
      .from('management_notes')
      .select('id, body, created_at, updated_at, author_id, author:app_users(full_name)')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })

    if (err) setError(describeWriteError(err.message).message)
    setNotes((data ?? []) as Note[])
    setLoading(false)
  }, [employeeId])

  useEffect(() => {
    // See EventAttachments — a network read is the external-system sync that
    // effects are for; the rule cannot tell the two apart.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const authorOf = (n: Note) =>
    (Array.isArray(n.author) ? n.author[0] : n.author)?.full_name ?? 'Unknown'

  async function add() {
    const body = draft.trim()
    if (!body) return

    setError('')
    setBusy(true)
    const { error: err } = await createClient().from('management_notes').insert({
      employee_id: employeeId,
      author_id: currentAppUserId,
      body,
    })
    setBusy(false)

    if (err) {
      setError(
        describeWriteError(err.message).message,
      )
      return
    }
    setDraft('')
    await load()
  }

  async function saveEdit(id: string) {
    const body = editBody.trim()
    if (!body) return

    setError('')
    setBusy(true)
    const { error: err } = await createClient()
      .from('management_notes')
      .update({ body, updated_at: new Date().toISOString() })
      .eq('id', id)
    setBusy(false)

    if (err) {
      setError(describeWriteError(err.message).message)
      return
    }
    setEditing(null)
    await load()
  }

  async function remove(id: string) {
    setError('')
    setBusy(true)
    const { error: err, count } = await createClient()
      .from('management_notes')
      .delete({ count: 'exact' })
      .eq('id', id)
    setBusy(false)

    if (err || count === 0) {
      setError(err ? describeWriteError(err.message).message : 'That note could not be removed.')
      return
    }
    await load()
  }

  return (
    <section style={{ ...cardStyle, padding: compact ? '17px 19px' : '18px 20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: compact ? '13px' : '4px',
        }}
      >
        <span
          style={{
            width: '28px',
            height: '28px',
            flex: '0 0 28px',
            borderRadius: '8px',
            background: 'var(--epi-teal-bg)',
            color: 'var(--epi-teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <NotebookPen size={15} />
        </span>
        <h2 style={{ margin: 0, fontSize: compact ? '16px' : '15px', fontWeight: 700, letterSpacing: '-0.015em' }}>
          Management {compact ? 'Notes' : 'notes'}
        </h2>
        {notes.length ? (
          <span className="epi-num" style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
            {notes.length}
          </span>
        ) : null}
        {compact ? (
          <button
            onClick={() => void add()}
            disabled={busy || !draft.trim()}
            title={
              draft.trim()
                ? 'Save this note'
                : 'Type a note below, then add it — notes never appear on the report'
            }
            style={{
              marginLeft: 'auto',
              height: '28px',
              padding: '0 11px',
              borderRadius: '8px',
              border: `1px solid ${draft.trim() ? 'transparent' : 'var(--epi-border-2)'}`,
              background: draft.trim()
                ? 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)'
                : 'var(--epi-input)',
              color: draft.trim() ? '#fff' : 'var(--epi-fg-2)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: busy ? 'progress' : draft.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flex: '0 0 auto',
            }}
          >
            {busy ? <Loader2 size={12} className="epi-spin" /> : <Plus size={12} />}
            Add note
          </button>
        ) : (
          <span
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--epi-fg-3)',
            }}
          >
            <Lock size={11} />
            Never appears on the report
          </span>
        )}
      </div>

      {compact ? null : (
        <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--epi-fg-3)', lineHeight: 1.55 }}>
          Context on {employeeName} that is worth remembering but is not a formal performance record.
          Visible to Management and Executive Assistants only.
        </p>
      )}

      {error ? (
        <div
          style={{
            fontSize: '12.5px',
            color: 'var(--epi-red)',
            background: 'var(--epi-red-bg)',
            border: '1px solid var(--epi-red-bd)',
            borderRadius: '8px',
            padding: '9px 12px',
            marginBottom: '12px',
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          style={{
            width: '100%',
            minWidth: 0,
            borderRadius: '10px',
            background: 'var(--epi-input)',
            border: '1px solid var(--epi-border-2)',
            color: 'var(--epi-fg)',
            fontSize: '13.5px',
            lineHeight: 1.55,
            padding: '10px 12px',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: compact ? 'none' : 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => void add()}
            disabled={busy || !draft.trim()}
            style={{
              height: '34px',
              padding: '0 16px',
              borderRadius: '8px',
              border: 0,
              background: draft.trim()
                ? 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)'
                : 'var(--epi-track)',
              color: draft.trim() ? '#fff' : 'var(--epi-fg-3)',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: busy ? 'progress' : draft.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
            }}
          >
            {busy ? <Loader2 size={14} className="epi-spin" /> : null}
            Add note
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>Loading…</div>
      ) : notes.length === 0 ? (
        <div style={{ fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>No notes yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notes.map((n) => (
            <article
              key={n.id}
              style={{
                border: '1px solid var(--epi-border)',
                borderRadius: '10px',
                background: 'var(--epi-canvas)',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px' }}>
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    flex: '0 0 22px',
                    borderRadius: '999px',
                    background: 'var(--epi-teal-bg)',
                    color: 'var(--epi-teal)',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {initials(authorOf(n))}
                </span>
                <span style={{ fontSize: '12.5px', fontWeight: 600 }}>{authorOf(n)}</span>
                <span className="epi-num" style={{ fontSize: '11.5px', color: 'var(--epi-fg-3)' }}>
                  {new Date(n.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {n.updated_at !== n.created_at ? ' · edited' : ''}
                </span>

                {/* Editing is the author's own; the note carries their name,
                    so another admin rewriting it would be signing words the
                    author never wrote. The database enforces this — the
                    policy's WITH CHECK pins author_id to the current user.
                    Removing is open to any admin. */}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
                  {editing === n.id || n.author_id !== currentAppUserId ? null : (
                    <button
                      onClick={() => {
                        setEditing(n.id)
                        setEditBody(n.body)
                      }}
                      aria-label="Edit note"
                      title="Edit"
                      style={iconBtn}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => void remove(n.id)}
                    disabled={busy}
                    aria-label="Delete note"
                    title="Delete"
                    style={{ ...iconBtn, color: 'var(--epi-red)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>

              {editing === n.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      borderRadius: '9px',
                      background: 'var(--epi-input)',
                      border: '1px solid var(--epi-border-2)',
                      color: 'var(--epi-fg)',
                      fontSize: '13px',
                      lineHeight: 1.55,
                      padding: '9px 11px',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(null)} style={{ ...subtleButton, height: '30px' }}>
                      <X size={13} />
                      Cancel
                    </button>
                    <button
                      onClick={() => void saveEdit(n.id)}
                      disabled={busy || !editBody.trim()}
                      style={{
                        height: '30px',
                        padding: '0 13px',
                        borderRadius: '8px',
                        border: 0,
                        background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
                        color: '#fff',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: '13.5px',
                    lineHeight: 1.6,
                    color: 'var(--epi-fg-2)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {n.body}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

const iconBtn = {
  width: '24px',
  height: '24px',
  flex: '0 0 24px',
  borderRadius: '6px',
  border: '1px solid var(--epi-border)',
  background: 'transparent',
  color: 'var(--epi-fg-2)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const
