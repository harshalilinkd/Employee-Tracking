'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Ban, Check, Loader2, Pencil, PencilLine, Trash2, Undo2, UserPlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { avatarStyle, cardStyle, initials, pill, subtleButton, tableHeadStyle } from '@/lib/design'
import type { EmployeeStatus } from '@/lib/types'

/**
 * The table shows exactly what the Add/Edit form captures — no more code or
 * joining-date columns, because nothing collects them any more, and a column
 * that is a permanent em dash is just noise. Email takes their place.
 *
 * The columns stay in the database: existing codes and joining dates are
 * untouched, and the employee profile and printed report still read them.
 */
const DB_COLS =
  'minmax(170px,2fr) minmax(130px,1.4fr) minmax(130px,1.2fr) minmax(130px,1.2fr) minmax(150px,1.5fr) 104px 108px'

export interface EmployeeRow {
  id: string
  full_name: string
  employee_code: string | null
  joining_date: string | null
  status: EmployeeStatus
  department_id: string | null
  designation_id: string | null
  manager_id: string | null
  contact_email: string | null
  contact_phone: string | null
  departmentName: string
  designationName: string
  managerName: string
}

interface Props {
  rows: EmployeeRow[]
  departments: { id: string; name: string }[]
  designations: { id: string; title: string }[]
  deptCount: number
  canEdit: boolean
}

const field: CSSProperties = {
  height: '40px',
  width: '100%',
  borderRadius: '10px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border-2)',
  color: 'var(--epi-fg)',
  fontSize: '14px',
  padding: '0 12px',
  outline: 'none',
}

const label: CSSProperties = { fontSize: '13px', fontWeight: 600, color: 'var(--epi-fg-strong)' }

/** Compact control that fills its grid cell during inline editing. */
/** Height and width come from `.epi-grid-table.epi-editing` in globals.css. */
const inlineField: CSSProperties = {
  borderRadius: '6px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border-2)',
  color: 'var(--epi-fg)',
  fontSize: '13px',
  padding: '0 7px',
  outline: 'none',
}

/** The columns inline editing can change. */
type EditableField =
  | 'full_name'
  | 'designation_id'
  | 'department_id'
  | 'manager_id'
  | 'contact_email'
  | 'status'

type Draft = Record<string, Partial<Record<EditableField, string | null>>>

const STATUSES: EmployeeStatus[] = ['Active', 'On Hold', 'Inactive']

const rowIconBtn: CSSProperties = {
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
}

export function EmployeeAdmin({ rows, departments, designations, deptCount, canEdit }: Props) {
  const [editing, setEditing] = useState<EmployeeRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState('')
  const [rowError, setRowError] = useState('')
  const [deleting, setDeleting] = useState<EmployeeRow | null>(null)
  const [deleteError, setDeleteError] = useState('')

  // Inline bulk editing. `draft` holds only the fields actually changed, per
  // employee id, so saving touches exactly what the user edited and an
  // untouched row is never written to.
  const [bulk, setBulk] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [savingBulk, setSavingBulk] = useState(false)

  const dirtyIds = Object.keys(draft)

  function edit(row: EmployeeRow, field: EditableField, value: string | null) {
    setDraft((d) => {
      const current = { ...(d[row.id] ?? {}) }
      const original = (row[field] ?? null) as string | null
      const next = value === '' ? null : value

      if (next === original) delete current[field]
      else current[field] = next

      const out = { ...d }
      if (Object.keys(current).length === 0) delete out[row.id]
      else out[row.id] = current
      return out
    })
  }

  function valueOf(row: EmployeeRow, field: EditableField): string {
    const d = draft[row.id]
    if (d && field in d) return (d[field] ?? '') as string
    return ((row[field] ?? '') as string) || ''
  }

  function cancelBulk() {
    setDraft({})
    setBulk(false)
    setRowError('')
  }

  /**
   * Saves every changed row. Each row is its own UPDATE because the changed
   * fields differ per row, so there is no single statement to batch them
   * into. Failures are collected rather than thrown, so one bad row (a
   * duplicate code, say) does not hide the rest that saved fine.
   */
  async function saveBulk() {
    setRowError('')
    setSavingBulk(true)
    const supabase = createClient()

    const results = await Promise.all(
      dirtyIds.map(async (id) => {
        const patch = draft[id]!
        const { error } = await supabase.from('employees').update(patch).eq('id', id)
        return { id, error }
      }),
    )

    setSavingBulk(false)
    const failed = results.filter((r) => r.error)

    if (failed.length) {
      const nameOf = (id: string) => rows.find((r) => r.id === id)?.full_name ?? 'A row'
      setRowError(
        failed
          .map(({ id, error }) =>
            error!.message.includes('row-level security')
              ? `${nameOf(id)}: your role cannot change the employee database.`
              : `${nameOf(id)}: ${error!.message}`,
          )
          .join(' '),
      )
      // Keep the failures on screen so they can be corrected; drop the saved ones.
      const stillBad = new Set(failed.map((f) => f.id))
      setDraft((d) => Object.fromEntries(Object.entries(d).filter(([id]) => stillBad.has(id))))
      router.refresh()
      return
    }

    setDraft({})
    setBulk(false)
    router.refresh()
  }
  const router = useRouter()

  /**
   * Deactivating never deletes the employee. Every performance event points
   * at them by id, so removing the row would either fail on the foreign key
   * or orphan their history. `Inactive` takes them out of the record form
   * while leaving everything already recorded about them intact.
   */
  async function setRowStatus(row: EmployeeRow, status: EmployeeStatus) {
    setRowError('')
    setBusy(row.id)
    const { error } = await createClient().from('employees').update({ status }).eq('id', row.id)
    setBusy('')
    if (error) {
      setRowError(
        error.message.includes('row-level security')
          ? 'Your role cannot change the employee database. Super Admin or HR is required.'
          : error.message,
      )
      return
    }
    router.refresh()
  }

  /**
   * Hard delete. Only reaches the database for admins (RLS), and Postgres
   * refuses it outright for anyone who has performance history, because
   * performance_events.employee_id is ON DELETE RESTRICT. That refusal is
   * the useful case, so it gets a real explanation rather than the raw
   * constraint error.
   */
  async function remove(row: EmployeeRow) {
    setDeleteError('')
    setBusy(row.id)
    const { error, count } = await createClient()
      .from('employees')
      .delete({ count: 'exact' })
      .eq('id', row.id)
    setBusy('')

    if (error) {
      const fk = error.message.includes('foreign key') || error.code === '23503'
      // The message stays inside the dialog. It used to close the dialog and
      // write to a banner above the table, which on a 57-row list is far off
      // the top of the screen — so a refused delete looked like nothing
      // happening at all.
      setDeleteError(
        fk
          ? `${row.full_name} has performance history recorded against them. Deleting would orphan that history, so the database refuses it. Deactivate instead — it takes them out of the record form and keeps their record readable.`
          : error.message.includes('row-level security')
            ? 'Your role cannot delete employees. Super Admin is required.'
            : error.message,
      )
      return
    }

    // A delete that matches no row returns success with count 0. Without this
    // check an RLS-filtered delete would close the dialog and look like it
    // worked.
    if (count === 0) {
      setDeleteError('Nothing was deleted — your role is not permitted to delete this employee.')
      return
    }

    setDeleting(null)
    router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.018em' }}>
            Employee database
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--epi-fg-2)' }}>
            {rows.length} employees · {deptCount} departments
          </p>
        </div>
        {canEdit ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {bulk ? (
              <>
                <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--epi-fg-2)' }}>
                  {dirtyIds.length === 0
                    ? 'Edit any cell, then save'
                    : `${dirtyIds.length} ${dirtyIds.length === 1 ? 'employee' : 'employees'} changed`}
                </span>
                <button type="button" style={subtleButton} onClick={cancelBulk} disabled={savingBulk}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveBulk}
                  disabled={savingBulk || dirtyIds.length === 0}
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: 0,
                    background:
                      dirtyIds.length === 0
                        ? 'var(--epi-track)'
                        : 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
                    color: dirtyIds.length === 0 ? 'var(--epi-fg-3)' : '#fff',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: savingBulk ? 'progress' : dirtyIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                  }}
                >
                  {savingBulk ? <Loader2 size={14} className="epi-spin" /> : <Check size={14} />}
                  {savingBulk ? 'Saving…' : `Save${dirtyIds.length ? ` ${dirtyIds.length}` : ''}`}
                </button>
              </>
            ) : (
              <>
                <button type="button" style={subtleButton} onClick={() => setBulk(true)}>
                  <PencilLine size={14} />
                  Edit rows
                </button>
                <button type="button" style={subtleButton} onClick={() => setAdding(true)}>
                  <UserPlus size={14} />
                  Add employee
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {rowError ? (
        <div
          style={{
            ...cardStyle,
            padding: '12px 16px',
            marginBottom: '12px',
            fontSize: '13.5px',
            color: 'var(--epi-red)',
            borderColor: 'var(--epi-red-bd)',
            background: 'var(--epi-red-bg)',
          }}
        >
          {rowError}
        </div>
      ) : null}

      <div className="epi-table-desktop" style={{ ...cardStyle, overflow: 'hidden', overflowX: 'auto' }}>
        <div
          className="epi-grid-table epi-grid-table-head"
          style={{
            minWidth: '1000px',
            display: 'grid',
            gridTemplateColumns: DB_COLS,
            gap: '10px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--epi-border)',
            ...tableHeadStyle,
          }}
        >
          <span>Name</span>
          <span>Designation</span>
          <span>Department</span>
          <span>Reports to</span>
          <span>Email</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--epi-fg-2)', fontSize: '14px' }}>
            No employees yet. Add the first one to start recording performance against them.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className={`epi-row epi-grid-table${bulk ? ' epi-editing' : ''}`}
              style={{
                minWidth: '1000px',
                display: 'grid',
                gridTemplateColumns: DB_COLS,
                gap: '10px',
                padding: '12px 16px',
                borderBottom: '1px solid var(--epi-border-soft)',
                alignItems: 'center',
                fontSize: '14px',
              }}
            >
              {bulk ? (
                <span className="epi-edit-name epi-cell-control">
                  <span style={avatarStyle(28)}>{initials(r.full_name)}</span>
                  <input
                    value={valueOf(r, 'full_name')}
                    onChange={(e) => edit(r, 'full_name', e.target.value)}
                    aria-label={`Name of ${r.full_name}`}
                    style={inlineField}
                  />
                </span>
              ) : (
                <Link
                  href={`/employees/${r.id}`}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    minWidth: 0,
                    color: 'var(--epi-fg)',
                    textDecoration: 'none',
                  }}
                >
                  <span style={avatarStyle(28)}>{initials(r.full_name)}</span>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.full_name}
                  </span>
                </Link>
              )}

              {bulk ? (
                <span className="epi-cell-control">
                  <select
                    value={valueOf(r, 'designation_id')}
                    onChange={(e) => edit(r, 'designation_id', e.target.value)}
                    aria-label={`Designation of ${r.full_name}`}
                    style={inlineField}
                  >
                    <option value="">—</option>
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </span>
              ) : (
                <Cell>{r.designationName}</Cell>
              )}

              {bulk ? (
                <span className="epi-cell-control">
                  <select
                    value={valueOf(r, 'department_id')}
                    onChange={(e) => edit(r, 'department_id', e.target.value)}
                    aria-label={`Department of ${r.full_name}`}
                    style={inlineField}
                  >
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </span>
              ) : (
                <Cell>{r.departmentName}</Cell>
              )}

              {bulk ? (
                <span className="epi-cell-control">
                  <select
                    value={valueOf(r, 'manager_id')}
                    onChange={(e) => edit(r, 'manager_id', e.target.value)}
                    aria-label={`Manager of ${r.full_name}`}
                    style={inlineField}
                  >
                    <option value="">—</option>
                    {rows
                      .filter((m) => m.id !== r.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                  </select>
                </span>
              ) : (
                <Cell>{r.managerName}</Cell>
              )}

              {bulk ? (
                <span className="epi-cell-control">
                  <input
                    type="email"
                    value={valueOf(r, 'contact_email')}
                    onChange={(e) => edit(r, 'contact_email', e.target.value)}
                    aria-label={`Email of ${r.full_name}`}
                    style={{ ...inlineField, fontSize: '12.5px' }}
                  />
                </span>
              ) : (
                <Cell muted>{r.contact_email ?? '—'}</Cell>
              )}

              {bulk ? (
                <span className="epi-cell-control">
                  <select
                    value={valueOf(r, 'status') || 'Active'}
                    onChange={(e) => edit(r, 'status', e.target.value)}
                    aria-label={`Status of ${r.full_name}`}
                    style={inlineField}
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </span>
              ) : (
              /* Dot plus plain text. A filled chip repeated down 57 rows was
                 the loudest thing on the page and said the least. */
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    flex: '0 0 7px',
                    borderRadius: '999px',
                    background:
                      r.status === 'Active'
                        ? 'var(--epi-green)'
                        : r.status === 'On Hold'
                          ? 'var(--epi-orange)'
                          : 'var(--epi-fg-3)',
                  }}
                />
                <span style={{ fontSize: '13px', color: 'var(--epi-fg-2)' }}>{r.status}</span>
              </span>
              )}

              {bulk ? (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {draft[r.id] ? (
                    <span
                      title="Unsaved change"
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--epi-violet)',
                      }}
                    >
                      Edited
                    </span>
                  ) : null}
                </span>
              ) : canEdit ? (
                <span style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setEditing(r)}
                    aria-label={`Edit ${r.full_name}`}
                    title="Edit"
                    style={rowIconBtn}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setRowStatus(r, r.status === 'Inactive' ? 'Active' : 'Inactive')}
                    disabled={busy === r.id}
                    aria-label={r.status === 'Inactive' ? `Restore ${r.full_name}` : `Deactivate ${r.full_name}`}
                    title={
                      r.status === 'Inactive'
                        ? 'Restore'
                        : 'Deactivate — takes them out of the record form, keeps their history'
                    }
                    style={rowIconBtn}
                  >
                    {r.status === 'Inactive' ? <Undo2 size={13} /> : <Ban size={13} />}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteError('')
                      setDeleting(r)
                    }}
                    disabled={busy === r.id}
                    aria-label={`Delete ${r.full_name}`}
                    title="Delete permanently"
                    style={{ ...rowIconBtn, color: 'var(--epi-red)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ) : (
                <span />
              )}
            </div>
          ))
        )}
      </div>

      <div className="epi-cards-mobile">
        {rows.map((r) => (
          <div
            key={r.id}
            style={{ ...cardStyle, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={avatarStyle(32)}>{initials(r.full_name)}</span>
              <Link
                href={`/employees/${r.id}`}
                style={{ flex: 1, minWidth: 0, color: 'var(--epi-fg)', textDecoration: 'none' }}
              >
                <span style={{ display: 'block', fontSize: '15px', fontWeight: 600 }}>{r.full_name}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: 'var(--epi-fg-3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.contact_email ?? 'No email'}
                </span>
              </Link>
              <span style={pill(r.status === 'Active' ? 'pos' : r.status === 'On Hold' ? 'warn' : 'muted')}>
                {r.status}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)', lineHeight: 1.6 }}>
              {r.designationName} · {r.departmentName}
              <br />
              Reports to {r.managerName}
            </div>
            {canEdit ? (
              <button
                onClick={() => setEditing(r)}
                style={{ ...subtleButton, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
              >
                <Pencil size={13} /> Edit
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: '13px', color: 'var(--epi-fg-3)' }}>
        Deactivate takes someone out of the record form but keeps their history. Delete removes the row
        entirely and is only possible for employees with no performance history — the database refuses the
        rest, so nothing recorded can ever be orphaned.
      </p>

      {deleting ? (
        <ConfirmDelete
          row={deleting}
          busy={busy === deleting.id}
          error={deleteError}
          onCancel={() => {
            setDeleteError('')
            setDeleting(null)
          }}
          onConfirm={() => remove(deleting)}
          onDeactivate={async () => {
            await setRowStatus(deleting, 'Inactive')
            setDeleteError('')
            setDeleting(null)
          }}
        />
      ) : null}

      {adding || editing ? (
        <EmployeeModal
          existing={editing}
          departments={departments}
          designations={designations}
          managers={rows}
          close={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}

/**
 * Deleting is irreversible and sits next to two reversible buttons, so it
 * asks first and names the person being removed.
 */
function ConfirmDelete({
  row,
  busy,
  error,
  onCancel,
  onConfirm,
  onDeactivate,
}: {
  row: EmployeeRow
  busy: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
  onDeactivate: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${row.full_name}`}
      className="epi-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--epi-scrim)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'epiScrimIn 220ms ease-out',
      }}
    >
      <div
        className="epi-modal"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--epi-elev)',
          border: '1px solid var(--epi-border-2)',
          borderRadius: '18px',
          boxShadow: 'var(--epi-shadow-lg)',
          overflow: 'hidden',
          animation: 'epiModalIn 240ms cubic-bezier(0.2,0.8,0.2,1)',
        }}
      >
        <div style={{ padding: '22px 22px 6px', display: 'flex', gap: '13px' }}>
          <span
            style={{
              width: '36px',
              height: '36px',
              flex: '0 0 36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--epi-red-bg)',
              color: 'var(--epi-red)',
              border: '1px solid var(--epi-red-bd)',
            }}
          >
            <AlertTriangle size={17} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700 }}>
              {error ? `Cannot delete ${row.full_name}` : `Delete ${row.full_name}?`}
            </h2>
            <p
              style={{
                margin: '7px 0 0',
                fontSize: '13.5px',
                color: error ? 'var(--epi-red)' : 'var(--epi-fg-2)',
                lineHeight: 1.6,
              }}
            >
              {error ||
                'This removes the employee record permanently and cannot be undone. If they have any performance history the database will refuse — deactivate them instead.'}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '18px 22px 20px',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              height: '38px',
              padding: '0 15px',
              borderRadius: '9px',
              background: 'transparent',
              border: '1px solid var(--epi-border-2)',
              color: 'var(--epi-fg-2)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {error ? 'Close' : 'Cancel'}
          </button>

          {/* When the delete is refused, offer the thing that will work. */}
          {error && row.status !== 'Inactive' ? (
            <button
              onClick={onDeactivate}
              disabled={busy}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '9px',
                border: '1px solid var(--epi-border-2)',
                background: 'var(--epi-input)',
                color: 'var(--epi-fg)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <Ban size={14} />
              Deactivate instead
            </button>
          ) : null}

          {error ? null : (
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{
              height: '38px',
              padding: '0 18px',
              borderRadius: '9px',
              border: '1px solid var(--epi-red-bd)',
              background: 'var(--epi-red)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: busy ? 'progress' : 'pointer',
              opacity: busy ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
            }}
          >
            {busy ? <Loader2 size={14} className="epi-spin" /> : <Trash2 size={14} />}
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Cell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  // The inner span carries the truncation: the outer one is a grid cell and
  // is laid out as a flex box, which cannot ellipsis its own bare text.
  return (
    <span style={{ minWidth: 0, display: 'block' }}>
      <span
        style={{
          display: 'block',
          fontSize: '13px',
          color: muted ? 'var(--epi-fg-3)' : 'var(--epi-fg-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </span>
  )
}

function EmployeeModal({
  existing,
  departments,
  designations,
  managers,
  close,
}: {
  existing: EmployeeRow | null
  departments: { id: string; name: string }[]
  designations: { id: string; title: string }[]
  managers: EmployeeRow[]
  close: () => void
}) {
  const router = useRouter()
  const [fullName, setFullName] = useState(existing?.full_name ?? '')
  const [departmentId, setDepartmentId] = useState(existing?.department_id ?? '')
  const [designationId, setDesignationId] = useState(existing?.designation_id ?? '')
  const [managerId, setManagerId] = useState(existing?.manager_id ?? '')
  const [status, setStatus] = useState<EmployeeStatus>(existing?.status ?? 'Active')
  const [email, setEmail] = useState(existing?.contact_email ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [close])

  async function save() {
    setError('')
    if (!fullName.trim()) return setError('A name is required.')

    setSaving(true)
    const supabase = createClient()

    // employee_code, joining_date and contact_phone are deliberately absent:
    // an update only writes the keys it sends, so whatever those columns
    // already hold for an existing employee is left exactly as it was.
    const payload = {
      full_name: fullName.trim(),
      department_id: departmentId || null,
      designation_id: designationId || null,
      manager_id: managerId || null,
      status,
      contact_email: email.trim() || null,
    }

    const { error: err } = existing
      ? await supabase.from('employees').update(payload).eq('id', existing.id)
      : await supabase.from('employees').insert(payload)

    setSaving(false)

    if (err) {
      setError(
        err.message.includes('row-level security')
          ? 'Your role cannot change the employee database. Super Admin or HR is required.'
          : err.message,
      )
      return
    }

    router.refresh()
    close()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={existing ? 'Edit employee' : 'Add employee'}
      className="epi-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'var(--epi-scrim)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'epiScrimIn 220ms ease-out',
      }}
    >
      <div
        className="epi-modal"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '560px',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--epi-elev)',
          border: '1px solid var(--epi-border-2)',
          borderRadius: '20px',
          boxShadow: 'var(--epi-shadow-lg)',
          overflow: 'hidden',
          animation: 'epiModalIn 240ms cubic-bezier(0.2,0.8,0.2,1)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg,#14907c 0%,#0e7c6b 50%,#0a5f52 100%)',
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: '14px',
            alignItems: 'center',
            padding: '20px 22px 16px',
            borderBottom: '1px solid var(--epi-border)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              flex: '0 0 40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 22px rgba(14,124,107,0.28)',
            }}
          >
            <UserPlus size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--epi-fg-3)',
              }}
            >
              Employee database
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: '21px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              {existing ? 'Edit employee' : 'Add employee'}
            </h2>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'var(--epi-input)',
              border: '1px solid var(--epi-border-2)',
              color: 'var(--epi-fg-2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={label}>
              Full name <span style={{ color: 'var(--epi-neg)' }}>*</span>
            </span>
            <input
              className="epi-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ramesh Shinde"
              style={field}
            />
          </label>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={label}>Department</span>
              <select
                className="epi-field"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                style={{ ...field, padding: '0 10px' }}
              >
                <option value="">Unassigned</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={label}>Designation</span>
              <select
                className="epi-field"
                value={designationId}
                onChange={(e) => setDesignationId(e.target.value)}
                style={{ ...field, padding: '0 10px' }}
              >
                <option value="">Unassigned</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={label}>Reports to</span>
              <select
                className="epi-field"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                style={{ ...field, padding: '0 10px' }}
              >
                <option value="">Nobody</option>
                {managers
                  .filter((m) => m.id !== existing?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={label}>Status</span>
              <select
                className="epi-field"
                value={status}
                onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                style={{ ...field, padding: '0 10px' }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={label}>
              Email <span style={{ fontWeight: 400, color: 'var(--epi-fg-3)' }}>· optional</span>
            </span>
            <input
              className="epi-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@ldgroup.in"
              style={field}
            />
          </label>

          {error ? (
            <div
              role="alert"
              style={{
                display: 'flex',
                gap: '9px',
                alignItems: 'flex-start',
                border: '1px solid var(--epi-neg-bd)',
                background: 'var(--epi-neg-bg)',
                borderRadius: '11px',
                padding: '11px 13px',
                fontSize: '13px',
                color: 'var(--epi-neg-fg)',
              }}
            >
              <AlertTriangle size={15} style={{ flex: '0 0 15px', marginTop: '1px' }} />
              <span style={{ flex: 1, lineHeight: 1.45 }}>{error}</span>
            </div>
          ) : null}

          {existing ? (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--epi-fg-3)', lineHeight: 1.5 }}>
              Changing the department does not move this employee&rsquo;s past events — those stay attributed to
              the department the work happened in.
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
            padding: '14px 22px',
            borderTop: '1px solid var(--epi-border)',
            background: 'var(--epi-surface)',
          }}
        >
          <button
            onClick={close}
            style={{
              height: '40px',
              padding: '0 15px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1px solid var(--epi-border-2)',
              color: 'var(--epi-fg-2)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              height: '40px',
              padding: '0 20px',
              borderRadius: '10px',
              border: 0,
              background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'progress' : 'pointer',
              opacity: saving ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: '0 8px 22px rgba(14,124,107,0.28)',
            }}
          >
            {saving ? <Loader2 size={15} className="epi-spin" /> : <Check size={15} />}
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add employee'}
          </button>
        </div>
      </div>
    </div>
  )
}
