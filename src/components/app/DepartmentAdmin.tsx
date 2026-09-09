'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Undo2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { describeWriteError } from '@/lib/errors'
import { cardStyle, labelCaps, primaryButton, subtleButton, tableHeadStyle } from '@/lib/design'

export interface DepartmentRow {
  id: string
  name: string
  code: string | null
  is_active: boolean
  /** Employees currently assigned — the guard against hiding a live one. */
  useCount: number
}

const COLS = 'minmax(160px,2fr) minmax(90px,1fr) 96px minmax(150px,1.2fr)'

const iconBtn = {
  width: '28px',
  height: '28px',
  flex: '0 0 28px',
  borderRadius: '8px',
  border: '1px solid var(--epi-border-2)',
  background: 'transparent',
  color: 'var(--epi-fg-2)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const

/**
 * The department master list.
 *
 * Departments arrived with the spreadsheet import and had no screen, so the
 * only way to correct one was to ask for a migration. The pickers elsewhere
 * read this list, which is why a missing entry stops an employee record from
 * being right.
 *
 * There is no delete. Employees carry a foreign key to their department and
 * events snapshot it at the moment they are recorded, so removing a row would
 * either be refused or quietly rewrite history. Deactivating takes it out of
 * every picker while leaving what it already explains intact.
 */
export function DepartmentAdmin({ rows, canEdit }: { rows: DepartmentRow[]; canEdit: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<DepartmentRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const active = rows.filter((r) => r.is_active)
  const assigned = rows.reduce((a, r) => a + r.useCount, 0)

  async function setActive(row: DepartmentRow, is_active: boolean) {
    setError('')
    if (is_active === false && row.useCount > 0) {
      setError(
        `${row.name} still has ${row.useCount} ${row.useCount === 1 ? 'employee' : 'employees'}. Move them first, or leave it active — hiding it now would leave those records pointing at a department nobody can pick again.`,
      )
      return
    }

    const { error: err } = await createClient()
      .from('departments')
      .update({ is_active })
      .eq('id', row.id)

    if (err) {
      setError(describeWriteError(err.message).message)
      return
    }
    router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.018em' }}>
          Departments
        </h2>
        <span style={{ fontSize: '13.5px', color: 'var(--epi-fg-3)' }}>
          {active.length} active · {assigned} {assigned === 1 ? 'employee' : 'employees'} assigned
        </span>
      </div>

      <p style={{ margin: 0, fontSize: '13px', color: 'var(--epi-fg-3)', lineHeight: 1.55, maxWidth: '660px' }}>
        Every department picker in the app reads this list. Adding one here makes it available
        immediately when editing an employee — and you can also add one without leaving that screen.
      </p>

      {error ? (
        <div
          style={{
            ...cardStyle,
            padding: '12px 16px',
            fontSize: '13.5px',
            lineHeight: 1.5,
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
          style={{ minWidth: '540px', display: 'grid', gridTemplateColumns: COLS, ...tableHeadStyle }}
        >
          <span>Name</span>
          <span>Code</span>
          <span>Employees</span>
          <span>Status</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '26px 18px', textAlign: 'center', fontSize: '13.5px', color: 'var(--epi-fg-2)' }}>
            No departments yet.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="epi-row epi-grid-table"
              style={{ minWidth: '540px', display: 'grid', gridTemplateColumns: COLS, alignItems: 'center' }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600, opacity: r.is_active ? 1 : 0.55 }}>
                {r.name}
              </span>

              <span className="epi-mono" style={{ fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>
                {r.code ?? '—'}
              </span>

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
                    <button style={iconBtn} onClick={() => setEditing(r)} aria-label={`Rename ${r.name}`}>
                      <Pencil size={13} />
                    </button>
                    <button
                      style={iconBtn}
                      onClick={() => void setActive(r, !r.is_active)}
                      aria-label={r.is_active ? `Deactivate ${r.name}` : `Reactivate ${r.name}`}
                      title={
                        r.is_active
                          ? 'Hide from every picker, keep existing records'
                          : 'Show in the pickers again'
                      }
                    >
                      {r.is_active ? <X size={13} /> : <Undo2 size={13} />}
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
            <Plus size={14} /> Add department
          </button>
        </div>
      ) : null}

      {adding || editing ? (
        <DepartmentEditor
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

function DepartmentEditor({ existing, close }: { existing?: DepartmentRow; close: () => void }) {
  const router = useRouter()
  const [name, setName] = useState(existing?.name ?? '')
  const [code, setCode] = useState(existing?.code ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!name.trim()) return setError('Give the department a name.')

    setSaving(true)
    const supabase = createClient()
    const payload = { name: name.trim(), code: code.trim() || null }

    const { error: err } = existing
      ? await supabase.from('departments').update(payload).eq('id', existing.id)
      : await supabase.from('departments').insert(payload)

    setSaving(false)
    if (err) {
      setError(
        err.message.includes('departments_name_unique')
          ? 'A department with that name already exists.'
          : describeWriteError(err.message).message,
      )
      return
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
          {existing ? 'Rename department' : 'Add department'}
        </h3>

        {error ? <div style={{ fontSize: '13px', color: 'var(--epi-red)', lineHeight: 1.5 }}>{error}</div> : null}

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={labelCaps}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
            placeholder="e.g. Printing"
            autoFocus
            style={field}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={labelCaps}>Code · optional</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. PRN"
            style={field}
          />
        </label>

        {existing ? (
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--epi-fg-3)', lineHeight: 1.5 }}>
            Renaming updates this department everywhere it is shown. The {existing.useCount}{' '}
            {existing.useCount === 1 ? 'employee' : 'employees'} in it stay where they are.
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button style={subtleButton} onClick={close} disabled={saving}>
            Cancel
          </button>
          <button style={primaryButton} onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : existing ? 'Save' : 'Add department'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Add a department without leaving the screen you needed it on.
 *
 * The picker is where the gap is discovered — you go to set someone's
 * department and the one they are in was never imported. Sending the user to
 * Settings to add it, then back, loses whatever else they had part-typed in
 * the row they were editing.
 */
export function QuickAddDepartment({
  initialName = '',
  onCreated,
  onCancel,
}: {
  initialName?: string
  onCreated: (created: { id: string; name: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const value = name.trim()
    if (!value) return setError('Give the department a name.')

    setError('')
    setSaving(true)
    const { data, error: err } = await createClient()
      .from('departments')
      .insert({ name: value })
      .select('id, name')
      .single()
    setSaving(false)

    if (err || !data) {
      setError(
        (err?.message ?? '').includes('departments_name_unique')
          ? 'A department with that name already exists — pick it from the list instead.'
          : describeWriteError(err?.message).message,
      )
      return
    }
    onCreated(data as { id: string; name: string })
  }

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
        zIndex: 80,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="epi-modal"
        style={{
          ...cardStyle,
          width: '100%',
          maxWidth: '400px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>New department</h3>

        {error ? <div style={{ fontSize: '13px', color: 'var(--epi-red)', lineHeight: 1.5 }}>{error}</div> : null}

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={labelCaps}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
              if (e.key === 'Escape') onCancel()
            }}
            placeholder="e.g. Printing"
            autoFocus
            style={{
              height: '40px',
              borderRadius: '9px',
              background: 'var(--epi-input)',
              border: '1px solid var(--epi-border-2)',
              color: 'var(--epi-fg)',
              fontSize: '14px',
              padding: '0 11px',
              outline: 'none',
            }}
          />
        </label>

        <p style={{ margin: 0, fontSize: '12px', color: 'var(--epi-fg-3)', lineHeight: 1.5 }}>
          It is added to the master list and selected here straight away.
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button style={subtleButton} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button style={primaryButton} onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? 'Adding…' : 'Add and select'}
          </button>
        </div>
      </div>
    </div>
  )
}
