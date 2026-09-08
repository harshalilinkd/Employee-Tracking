'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Archive, Check, Loader2, Pencil, X } from 'lucide-react'
import { EventAttachments } from './EventAttachments'
import { createClient } from '@/lib/supabase/client'
import { iconStyle, pill } from '@/lib/design'
import { fmtFull } from '@/lib/format'
import { SEVERITY_HINTS, SEVERITY_LABELS, SEVERITY_ORDER, type Category, type Severity } from '@/lib/types'

export interface DetailEvent {
  id: string
  event_ref: string
  type: 'positive' | 'goofup'
  title: string
  description: string | null
  event_date: string
  severity: Severity
  status: string
  created_at: string
  recorded_by: string
  employeeId: string | null
  employeeName: string
  categoryId: string | null
  categoryName: string
  departmentName: string
  recordedBy: string
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

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function EventDetail({
  event,
  close,
  categories,
  currentAppUserId,
  isAdmin,
}: {
  event: DetailEvent
  close: () => void
  categories: Category[]
  currentAppUserId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit' | 'archive'>('view')
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description ?? '')
  const [date, setDate] = useState(event.event_date)
  const [categoryId, setCategoryId] = useState(event.categoryId ?? '')
  const [severity, setSeverity] = useState<Severity>(event.severity)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  /**
   * Mirrors the pe_update policy exactly: Super Admin and Management may
   * correct anything, everyone else gets 48 hours on their own entries.
   * Showing a button the database would reject is worse than hiding it.
   *
   * The clock is read once, when the dialog opens, rather than on every
   * render — reading Date.now() during render makes the component impure and
   * its output depend on when React happens to re-render it.
   */
  const [openedAt] = useState(() => Date.now())
  const hoursOld = (openedAt - new Date(event.created_at).getTime()) / 36e5
  const canEdit = isAdmin || (event.recorded_by === currentAppUserId && hoursOld < 48)
  const archived = event.status === 'archived'

  const typeCategories = useMemo(
    () => categories.filter((c) => c.applies_to === event.type && c.is_active),
    [categories, event.type],
  )

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

  async function saveEdit() {
    setError('')
    if (!title.trim()) return setError('A title is required.')
    if (date > todayIso()) return setError('The event date cannot be in the future.')

    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('performance_events')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        event_date: date,
        category_id: categoryId || null,
        severity,
      })
      .eq('id', event.id)
    setSaving(false)

    if (err) return setError(friendly(err.message))
    router.refresh()
    close()
  }

  async function archive() {
    setError('')
    if (!reason.trim()) return setError('Give a reason — it is kept in the audit log.')

    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('performance_events')
      .update({ status: 'archived', archived_reason: reason.trim() })
      .eq('id', event.id)
    setSaving(false)

    if (err) return setError(friendly(err.message))
    router.refresh()
    close()
  }

  function friendly(msg: string) {
    if (msg.includes('row-level security') || msg.includes('violates')) {
      return 'You can no longer change this record. Corrections are limited to 48 hours unless you are Management.'
    }
    if (msg.includes('immutable')) return 'That field is immutable and cannot be changed.'
    return msg
  }

  const meta = [
    ['Employee', event.employeeName],
    ['Department', event.departmentName],
    ['Category', event.categoryName],
    ['Impact', SEVERITY_LABELS[event.severity]],
    ['Happened on', fmtFull(event.event_date)],
    ['Recorded by', event.recordedBy],
  ] as const

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Performance record"
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
            background:
              event.type === 'positive'
                ? 'linear-gradient(90deg,#14907c,#0a5f52)'
                : 'linear-gradient(90deg,#FBBF24,#F59E0B)',
          }}
        />

        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '20px 22px 16px', borderBottom: '1px solid var(--epi-border)' }}>
          <span style={{ ...iconStyle(event.type), width: '32px', height: '32px', flex: '0 0 32px', fontSize: '14px' }}>
            {event.type === 'positive' ? '✓' : '⚠'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--epi-fg-3)' }}>
              {event.type === 'positive' ? 'Positive contribution' : 'Goofup'} ·{' '}
              <span className="epi-mono" style={{ letterSpacing: 0 }}>
                {event.event_ref}
              </span>
            </div>
            <h2 style={{ margin: '6px 0 0', fontSize: '19px', fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              {mode === 'edit' ? 'Edit record' : mode === 'archive' ? 'Archive record' : event.title}
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
          {archived ? (
            <div style={{ ...pill('muted'), alignSelf: 'flex-start' }}>Archived — excluded from signals and reports</div>
          ) : null}

          {mode === 'view' ? (
            <>
              {event.description ? (
                <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.6, color: 'var(--epi-fg-strong)' }}>
                  {event.description}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--epi-fg-3)' }}>No description was recorded.</p>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
                  gap: '14px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--epi-border)',
                }}
              >
                {meta.map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--epi-fg-3)' }}>
                      {k}
                    </div>
                    <div style={{ fontSize: '14px', marginTop: '4px' }}>{v}</div>
                  </div>
                ))}
              </div>

              {!canEdit && !archived ? (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--epi-fg-3)', lineHeight: 1.5 }}>
                  The 48-hour correction window has closed. Ask Management if this needs changing — the record stays
                  as it is so history cannot be quietly rewritten.
                </p>
              ) : null}
            </>
          ) : null}

          {mode === 'edit' ? (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={label}>Event title</span>
                <input className="epi-field" value={title} onChange={(e) => setTitle(e.target.value)} style={field} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={label}>What happened?</span>
                <textarea
                  className="epi-field"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{ ...field, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }}
                />
              </label>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={label}>Date</span>
                  <input
                    className="epi-field"
                    type="date"
                    value={date}
                    max={todayIso()}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ ...field, padding: '0 10px' }}
                  />
                </label>
                <label style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <span style={label}>Category</span>
                  <select
                    className="epi-field"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={{ ...field, padding: '0 10px' }}
                  >
                    <option value="">Uncategorised</option>
                    {typeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <span style={{ ...label, display: 'block', marginBottom: '8px' }}>Impact</span>
                <div
                  className="epi-impact"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                    padding: '4px',
                    borderRadius: '12px',
                    background: 'var(--epi-input)',
                    border: '1px solid var(--epi-border-2)',
                  }}
                >
                  {SEVERITY_ORDER.map((sv) => {
                    const active = severity === sv
                    return (
                      <button
                        key={sv}
                        onClick={() => setSeverity(sv)}
                        title={SEVERITY_HINTS[sv]}
                        style={{
                          height: '32px',
                          borderRadius: '9px',
                          border: 0,
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: active ? 'var(--epi-violet-bg)' : 'transparent',
                          color: active ? 'var(--epi-violet)' : 'var(--epi-fg-2)',
                        }}
                      >
                        {SEVERITY_LABELS[sv]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '12px', color: 'var(--epi-fg-3)', lineHeight: 1.5 }}>
                Employee, type and who recorded it cannot be changed — those are frozen at creation. Every edit is
                written to the audit log with the old and new value.
              </p>
            </>
          ) : null}

          {mode === 'archive' ? (
            <>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--epi-fg-2)' }}>
                Performance history is never deleted. The record is archived, stays in the audit log, and is
                excluded from signals and reports.
              </p>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={label}>
                  Reason <span style={{ color: 'var(--epi-red)' }}>*</span>
                </span>
                <input
                  className="epi-field"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Duplicate of PE-2026-0031"
                  style={field}
                />
              </label>
            </>
          ) : null}

          {error ? (
            <div
              role="alert"
              style={{
                display: 'flex',
                gap: '9px',
                alignItems: 'flex-start',
                border: '1px solid var(--epi-red-bd)',
                background: 'var(--epi-red-bg)',
                borderRadius: '11px',
                padding: '11px 13px',
                fontSize: '13px',
                color: 'var(--epi-red)',
              }}
            >
              <AlertTriangle size={15} style={{ flex: '0 0 15px', marginTop: '1px' }} />
              <span style={{ flex: 1, lineHeight: 1.45 }}>{error}</span>
            </div>
          ) : null}

          {/* Evidence lives with the event it belongs to, not on a screen of
              its own — the question "what proof is there" is only ever asked
              while looking at the record. */}
          {mode === 'view' ? (
            <EventAttachments
              eventId={event.id}
              canUpload={canEdit}
              currentAppUserId={currentAppUserId}
              isAdmin={isAdmin}
            />
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '14px 22px',
            borderTop: '1px solid var(--epi-border)',
            background: 'var(--epi-surface)',
          }}
        >
          {mode === 'view' ? (
            <>
              {event.employeeId ? (
                <Link
                  href={`/employees/${event.employeeId}`}
                  style={{
                    height: '40px',
                    padding: '0 14px',
                    borderRadius: '10px',
                    background: 'var(--epi-raised)',
                    border: '1px solid var(--epi-border-2)',
                    color: 'var(--epi-fg)',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                  }}
                >
                  Open {event.employeeName}
                </Link>
              ) : null}
              <span style={{ flex: 1 }} />
              {canEdit && !archived ? (
                <>
                  <button
                    onClick={() => {
                      setMode('edit')
                      setError('')
                    }}
                    style={{
                      height: '40px',
                      padding: '0 14px',
                      borderRadius: '10px',
                      background: 'transparent',
                      border: '1px solid var(--epi-border-2)',
                      color: 'var(--epi-fg)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                    }}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setMode('archive')
                      setError('')
                    }}
                    style={{
                      height: '40px',
                      padding: '0 14px',
                      borderRadius: '10px',
                      background: 'transparent',
                      border: '1px solid var(--epi-red-bd)',
                      color: 'var(--epi-red)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                    }}
                  >
                    <Archive size={14} /> Archive
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setMode('view')
                  setError('')
                }}
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
              <span style={{ flex: 1 }} />
              <button
                onClick={mode === 'edit' ? saveEdit : archive}
                disabled={saving}
                style={{
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: '10px',
                  border: 0,
                  background:
                    mode === 'archive'
                      ? 'linear-gradient(135deg,#F87171,#DC2626)'
                      : 'linear-gradient(135deg,#14907c,#0a5f52)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: saving ? 'progress' : 'pointer',
                  opacity: saving ? 0.75 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                }}
              >
                {saving ? <Loader2 size={15} className="epi-spin" /> : <Check size={15} />}
                {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Archive record'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
