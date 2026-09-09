'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, Undo2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { describeWriteError } from '@/lib/errors'
import { cardStyle, labelCaps, subtleButton, tableHeadStyle } from '@/lib/design'

export interface ObserverRow {
  id: string
  name: string
  role_note: string | null
  is_active: boolean
  sort_order: number
  /** How many events name this observer — a deactivate/delete guard. */
  useCount: number
}

const COLS = 'minmax(150px,2fr) minmax(120px,1.4fr) 90px 84px'

const iconBtn = {
  width: '28px',
  height: '28px',
  flex: '0 0 28px',
  borderRadius: '7px',
  background: 'transparent',
  border: '1px solid var(--epi-border)',
  color: 'var(--epi-fg-2)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const

/**
 * The master list behind "Who observed this?" on the record form.
 *
 * Deliberately separate from the employee database: the people who witness
 * events are the MD and senior staff, who are not rows in that table — it
 * holds the staff being assessed, not the people doing the assessing. A
 * floor supervisor with no login or a client contact are equally valid
 * answers to "who saw this happen". So these are just names, typed here.
 *
 * Note this is NOT "recorded by". That stays pinned to the signed-in user
 * by RLS and frozen by a trigger, because it is the audit trail.
 */
export function ObserverAdmin({ rows, canEdit }: { rows: ObserverRow[]; canEdit: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<ObserverRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const active = rows.filter((r) => r.is_active)

  async function setActive(row: ObserverRow, is_active: boolean) {
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('observers')
      .update({ is_active })
      .eq('id', row.id)
    if (err) return setError(describeWriteError(err.message).message)
    router.refresh()
  }

  async function remove(row: ObserverRow) {
    setError('')
    if (row.useCount > 0) {
      // The FK is ON DELETE SET NULL, so a delete would silently blank the
      // observer on every past event. Deactivating keeps the history intact.
      return setError(
        `${row.name} is named on ${row.useCount} record${row.useCount === 1 ? '' : 's'}. Deactivate instead — deleting would blank the observer on those records.`,
      )
    }
    if (!window.confirm(`Delete ${row.name} from the observer list?`)) return
    const supabase = createClient()
    const { error: err } = await supabase.from('observers').delete().eq('id', row.id)
    if (err) return setError(describeWriteError(err.message).message)
    router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.018em' }}>
          Observers
        </h2>
        <span style={{ fontSize: '13.5px', color: 'var(--epi-fg-3)' }}>
          {active.length} in use · who the recorder can name under &ldquo;Who observed this?&rdquo;
        </span>
      </div>

      <p style={{ margin: 0, fontSize: '13px', color: 'var(--epi-fg-3)', lineHeight: 1.55, maxWidth: '640px' }}>
        This is the person who witnessed the event, which is often not the person entering it. Who
        entered it is recorded separately and cannot be edited.
      </p>

      {error ? (
        <div
          style={{
            ...cardStyle,
            padding: '12px 16px',
            fontSize: '13.5px',
            color: 'var(--epi-red)',
            borderColor: 'var(--epi-red-bd)',
            background: 'var(--epi-red-bg)',
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="epi-scroll-x" style={{ ...cardStyle, overflow: 'hidden', overflowX: 'auto' }}>
        <div
          className="epi-grid-table epi-grid-table-head"
          style={{ minWidth: '520px', display: 'grid', gridTemplateColumns: COLS, ...tableHeadStyle }}
        >
          <span>Name</span>
          <span>Role / note</span>
          <span>Records</span>
          <span>Status</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '26px 18px', textAlign: 'center', fontSize: '13.5px', color: 'var(--epi-fg-2)' }}>
            No observers yet. Add the people who typically witness events.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="epi-row epi-grid-table"
              style={{ minWidth: '520px', display: 'grid', gridTemplateColumns: COLS, alignItems: 'center' }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600, opacity: r.is_active ? 1 : 0.55 }}>
                {r.name}
              </span>

              <span style={{ fontSize: '13.5px', color: 'var(--epi-fg-2)' }}>{r.role_note ?? '—'}</span>

              <span className="epi-num" style={{ fontSize: '13.5px', color: 'var(--epi-fg-3)' }}>
                {r.useCount}
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                <span
                  style={{
                    fontSize: '13px',
                    color: r.is_active ? 'var(--epi-fg-3)' : 'var(--epi-orange)',
                    fontWeight: r.is_active ? 400 : 600,
                    marginRight: 'auto',
                  }}
                >
                  {r.is_active ? 'Active' : 'Inactive'}
                </span>

                {canEdit ? (
                  <>
                    <button style={iconBtn} onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`}>
                      <Pencil size={13} />
                    </button>
                    <button
                      style={iconBtn}
                      onClick={() => setActive(r, !r.is_active)}
                      aria-label={r.is_active ? `Deactivate ${r.name}` : `Reactivate ${r.name}`}
                      title={r.is_active ? 'Hide from the dropdown, keep past records' : 'Show in the dropdown again'}
                    >
                      {r.is_active ? <X size={13} /> : <Undo2 size={13} />}
                    </button>
                    <button style={iconBtn} onClick={() => remove(r)} aria-label={`Delete ${r.name}`}>
                      <Trash2 size={13} />
                    </button>
                  </>
                ) : null}
              </span>
            </div>
          ))
        )}
      </div>

      {canEdit ? (
        <div>
          <button style={subtleButton} onClick={() => setAdding(true)}>
            <Plus size={14} /> Add observer
          </button>
        </div>
      ) : null}

      {adding || editing ? (
        <ObserverEditor
          existing={editing ?? undefined}
          close={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}

function ObserverEditor({ existing, close }: { existing?: ObserverRow; close: () => void }) {
  const router = useRouter()
  const [name, setName] = useState(existing?.name ?? '')
  const [roleNote, setRoleNote] = useState(existing?.role_note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!name.trim()) return setError('Give the observer a name.')

    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: name.trim(),
      role_note: roleNote.trim() || null,
    }

    const { error: err } = existing
      ? await supabase.from('observers').update(payload).eq('id', existing.id)
      : await supabase.from('observers').insert({ ...payload, sort_order: 999 })

    setSaving(false)
    if (err) {
      return setError(
        err.message.includes('observers_name_unique')
          ? 'An observer with that name already exists.'
          : err.message,
      )
    }
    close()
    router.refresh()
  }

  const field = {
    height: '40px',
    borderRadius: '9px',
    background: 'var(--epi-input)',
    border: '1px solid var(--epi-border-2)',
    color: 'var(--epi-fg)',
    fontSize: '14px',
    padding: '0 11px',
    outline: 'none',
  } as const

  return (
    <div
      className="epi-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--epi-scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="epi-modal"
        style={{
          ...cardStyle,
          width: '100%',
          maxWidth: '440px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
          {existing ? 'Edit observer' : 'Add observer'}
        </h3>

        {error ? (
          <div style={{ fontSize: '13px', color: 'var(--epi-red)' }}>{error}</div>
        ) : null}

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={labelCaps}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mahesh Gavhane"
            className="epi-field"
            style={field}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={labelCaps}>Role or note · optional</span>
          <input
            value={roleNote}
            onChange={(e) => setRoleNote(e.target.value)}
            placeholder="e.g. MD, or Floor supervisor — Weaving"
            className="epi-field"
            style={field}
          />
          <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
            Shown in Settings only, to tell two similar names apart.
          </span>
        </label>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button style={subtleButton} onClick={close} disabled={saving}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              height: '34px',
              padding: '0 15px',
              borderRadius: '8px',
              border: 0,
              background: 'linear-gradient(135deg,#14907c,#0a5f52)',
              color: '#fff',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: saving ? 'progress' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
