'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, Undo2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CHART, cardStyle, labelCaps, selectStyle, subtleButton, tableHeadStyle } from '@/lib/design'
import { NEUTRAL_SEVERITY, SEVERITY_LABELS, SEVERITY_ORDER, hasImpact, type Severity } from '@/lib/types'

export interface CategoryRow {
  id: string
  name: string
  applies_to: 'positive' | 'goofup'
  default_severity: Severity
  sort_order: number
  is_active: boolean
}

const COLS = 'minmax(150px,2fr) 130px 96px 84px'

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

export function CategoryAdmin({ rows, canEdit }: { rows: CategoryRow[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [adding, setAdding] = useState<'positive' | 'goofup' | null>(null)
  const [error, setError] = useState('')

  const active = rows.filter((r) => r.is_active)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.018em' }}>
          Performance categories
        </h2>
        <span style={{ fontSize: '13.5px', color: 'var(--epi-fg-3)' }}>
          {active.length} in use · what people pick from when recording performance
        </span>
      </div>

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

      <div
        className="epi-chart-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        <CategoryTable
          title="Positive contribution"
          appliesTo="positive"
          rows={rows.filter((r) => r.applies_to === 'positive')}
          canEdit={canEdit}
          onEdit={setEditing}
          onAdd={() => setAdding('positive')}
          onError={setError}
        />
        <CategoryTable
          title="Goofup"
          appliesTo="goofup"
          rows={rows.filter((r) => r.applies_to === 'goofup')}
          canEdit={canEdit}
          onEdit={setEditing}
          onAdd={() => setAdding('goofup')}
          onError={setError}
        />
      </div>

      {editing ? <CategoryModal existing={editing} close={() => setEditing(null)} /> : null}
      {adding ? <CategoryModal appliesTo={adding} close={() => setAdding(null)} /> : null}
    </>
  )
}

function CategoryTable({
  title,
  appliesTo,
  rows,
  canEdit,
  onEdit,
  onAdd,
  onError,
}: {
  title: string
  appliesTo: 'positive' | 'goofup'
  rows: CategoryRow[]
  canEdit: boolean
  onEdit: (r: CategoryRow) => void
  onAdd: () => void
  onError: (m: string) => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState('')

  /**
   * Retiring never deletes the row. Past events reference a category by id,
   * so a hard delete would either fail on the foreign key or orphan history.
   * `is_active = false` takes it out of the record form while leaving every
   * event that already used it intact and readable.
   */
  async function setActive(row: CategoryRow, is_active: boolean) {
    onError('')
    setBusy(row.id)
    const { error } = await createClient().from('categories').update({ is_active }).eq('id', row.id)
    setBusy('')
    if (error) {
      onError(
        error.message.includes('row-level security')
          ? 'Your role cannot change categories. Super Admin is required.'
          : error.message,
      )
      return
    }
    router.refresh()
  }

  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', height: '34px', marginBottom: '9px' }}>
        <span style={labelCaps}>{title}</span>
        <span style={{ fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>
          {rows.filter((r) => r.is_active).length} active
        </span>
        {canEdit ? (
          <button onClick={onAdd} style={{ ...subtleButton, height: '30px', marginLeft: 'auto' }}>
            <Plus size={14} />
            Add category
          </button>
        ) : null}
      </div>

      <div className="epi-scroll-x" style={{ ...cardStyle, overflow: 'hidden', overflowX: 'auto' }}>
        <div
          className="epi-grid-table epi-grid-table-head"
          style={{ minWidth: '420px', display: 'grid', gridTemplateColumns: COLS, ...tableHeadStyle }}
        >
          <span>Category</span>
          <span>Default impact</span>
          <span>Status</span>
          <span />
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '26px 18px', textAlign: 'center', fontSize: '14px', color: 'var(--epi-fg-2)' }}>
            No {appliesTo === 'positive' ? 'positive' : 'goofup'} categories yet.
          </div>
        ) : (
          rows.map((c) => (
            <div
              key={c.id}
              className="epi-row epi-grid-table"
              style={{
                minWidth: '420px',
                display: 'grid',
                gridTemplateColumns: COLS,
                alignItems: 'center',
                fontSize: '14px',
                opacity: c.is_active ? 1 : 0.55,
              }}
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>

              {/* A dot carries the impact colour; the label stays plain text.
                  Two filled chips per row read as noise at 23 rows. */}
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                {hasImpact(c.applies_to) ? (
                  <>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        flex: '0 0 7px',
                        borderRadius: '999px',
                        background: CHART.impact[c.default_severity],
                      }}
                    />
                    <span style={{ fontSize: '13.5px', color: 'var(--epi-fg-2)' }}>
                      {SEVERITY_LABELS[c.default_severity]}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '13.5px', color: 'var(--epi-fg-3)' }}>—</span>
                )}
              </span>

              <span
                style={{
                  fontSize: '13px',
                  color: c.is_active ? 'var(--epi-fg-3)' : 'var(--epi-orange)',
                  fontWeight: c.is_active ? 400 : 600,
                }}
              >
                {c.is_active ? 'Active' : 'Retired'}
              </span>

              {canEdit ? (
                <span style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`} title="Edit" style={iconBtn}>
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setActive(c, !c.is_active)}
                    disabled={busy === c.id}
                    aria-label={c.is_active ? `Retire ${c.name}` : `Restore ${c.name}`}
                    title={c.is_active ? 'Retire — hides it from the record form' : 'Restore'}
                    style={iconBtn}
                  >
                    {c.is_active ? <Trash2 size={13} /> : <Undo2 size={13} />}
                  </button>
                </span>
              ) : (
                <span />
              )}
            </div>
          ))
        )}
      </div>
      {rows.length ? <span className="epi-scroll-hint">Swipe sideways for status and actions →</span> : null}
    </section>
  )
}

function CategoryModal({
  existing,
  appliesTo,
  close,
}: {
  existing?: CategoryRow
  appliesTo?: 'positive' | 'goofup'
  close: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(existing?.name ?? '')
  const [severity, setSeverity] = useState<Severity>(existing?.default_severity ?? 'medium')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const kind = existing?.applies_to ?? appliesTo ?? 'positive'

  async function save() {
    setError('')
    if (!name.trim()) {
      setError('A category name is required.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error: err } = existing
      ? await supabase
          .from('categories')
          .update({ name: name.trim(), default_severity: hasImpact(kind) ? severity : NEUTRAL_SEVERITY })
          .eq('id', existing.id)
      : await supabase
          .from('categories')
          .insert({
            name: name.trim(),
            applies_to: kind,
            default_severity: hasImpact(kind) ? severity : NEUTRAL_SEVERITY,
            sort_order: 999,
          })
    setSaving(false)

    if (err) {
      setError(
        err.message.includes('row-level security')
          ? 'Your role cannot change categories. Super Admin is required.'
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
      aria-label={existing ? 'Edit category' : 'Add category'}
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
          maxWidth: '460px',
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
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
            {existing ? 'Edit category' : `Add ${kind === 'positive' ? 'positive' : 'goofup'} category`}
          </h2>
          <button onClick={close} aria-label="Close" style={{ ...iconBtn, marginLeft: 'auto' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={labelCaps}>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Machine Downtime"
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

          {/* Impact is a goofup scale, and the record form does not ask for
              it on a positive — so a positive category has no default to set. */}
          {hasImpact(kind) ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={labelCaps}>Default impact</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                style={selectStyle}
              >
                {SEVERITY_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABELS[s as Severity]}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
                Pre-selected when someone picks this category. They can still change it on the record.
              </span>
            </label>
          ) : null}

          {error ? <div style={{ fontSize: '13px', color: 'var(--epi-red)' }}>{error}</div> : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '16px 22px 20px',
            borderTop: '1px solid var(--epi-border)',
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
            }}
          >
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add category'}
          </button>
        </div>
      </div>
    </div>
  )
}
