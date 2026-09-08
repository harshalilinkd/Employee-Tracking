'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronRight,
  Loader2,
  Sparkles,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AttachmentPicker, uploadPending, type PendingFile } from './AttachmentPicker'
import { VoiceDictation } from './VoiceDictation'
import {
  NEUTRAL_SEVERITY,
  SEVERITY_HINTS,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  hasImpact,
  type Category,
  type EventType,
  type Severity,
} from '@/lib/types'

interface EmployeeOption {
  id: string
  full_name: string
  department: string | null
}

interface Props {
  open: boolean
  intent: { type?: EventType; employeeId?: string }
  close: () => void
  employees: EmployeeOption[]
  categories: Category[]
  /** The Settings-managed master list behind "Who observed this?". */
  observers: { id: string; name: string }[]
  appUserId: string
  currentUserName: string
  selfEmployeeId: string | null
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  transition: 'border-color 160ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 160ms cubic-bezier(0.2,0.8,0.2,1)',
}

const labelRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--epi-fg-strong)',
}

const SEV_TONE: Record<Severity, string> = {
  low: 'accent',
  medium: 'accent',
  high: 'warn',
  critical: 'neg',
}

export function RecordDrawer({
  open,
  intent,
  close,
  employees,
  categories,
  observers,
  appUserId,
  currentUserName,
  selfEmployeeId,
}: Props) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  // Shell only renders this while it is open, so the component remounts on
  // every open and the initial state IS the reset. The effect that used to
  // do this fired after a first render with stale values.
  const [type, setType] = useState<EventType | null>(intent.type ?? null)
  const [quick, setQuick] = useState(false)
  const [employeeId, setEmployeeId] = useState(intent.employeeId ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(todayIso())
  const [categoryId, setCategoryId] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  // Who witnessed it, which is often not who is typing it in. Distinct from
  // recorded_by, which the database pins to the signed-in user and freezes.
  const [observedBy, setObservedBy] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [files, setFiles] = useState<PendingFile[]>([])
  // Set only when the event was written but a file was not. The form is done
  // at that point — leaving Save live would let one incident be recorded
  // twice while the user tries to fix an attachment.
  const [postSave, setPostSave] = useState('')

  const reset = (keepType: boolean) => {
    if (!keepType) setType(null)
    setEmployeeId('')
    setTitle('')
    setDescription('')
    setDate(todayIso())
    setCategoryId('')
    setSeverity('medium')
    setObservedBy('')
    setError('')
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview)
    })
    setFiles([])
  }

  const dirty = Boolean(employeeId || title || description || files.length)

  // SPEC §9.5 — never silently lose unsaved input.
  useEffect(() => {
    if (!open || !dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [open, dirty])

  // Escape to close, and lock the page behind the modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') attemptClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty])

  function attemptClose() {
    // Nothing is unsaved once the event is written — only the attachment
    // failed, and the warning has already been read.
    if (postSave) {
      setPostSave('')
      reset(false)
      close()
      return
    }
    if (dirty && !window.confirm('Discard this unsaved record?')) return
    reset(false)
    close()
  }

  const typeCategories = useMemo(
    () => categories.filter((c) => c.applies_to === type && c.is_active),
    [categories, type],
  )

  // Picking a category pre-selects its default impact, which the user may
  // then override — so it is state, not a derived value. Adjusting it during
  // render with a previous-value guard is React's documented pattern; doing
  // it in an effect renders once with the wrong impact first.
  const [prevCategoryId, setPrevCategoryId] = useState(categoryId)
  if (categoryId !== prevCategoryId) {
    setPrevCategoryId(categoryId)
    const cat = typeCategories.find((c) => c.id === categoryId)
    if (cat && type && hasImpact(type)) setSeverity(cat.default_severity)
  }

  async function save(addAnother: boolean) {
    setError('')

    if (!type) return setError('Choose whether this is a positive contribution or a goofup.')
    if (!employeeId) return setError('Choose the employee this is about.')
    if (!title.trim()) return setError('Give the event a short title.')
    if (selfEmployeeId && employeeId === selfEmployeeId) {
      return setError('You cannot record a performance event about yourself.')
    }
    if (date > todayIso()) return setError('The event date cannot be in the future.')

    setSaving(true)
    const supabase = createClient()

    const { data: created, error: err } = await supabase
      .from('performance_events')
      .insert({
        employee_id: employeeId,
        type,
        title: title.trim(),
        description: description.trim() || null,
        event_date: date,
        category_id: categoryId || null,
        // Impact is a goofup scale; a positive is stored at the neutral grade.
        severity: type && hasImpact(type) ? severity : NEUTRAL_SEVERITY,
        observed_by: observedBy || null,
        recorded_by: appUserId,
        // Tags and follow-ups were removed from this form. The columns stay so
        // the data model and the follow-up reporting are unchanged if they return.
        tags: [],
        follow_up_required: false,
        follow_up_date: null,
        follow_up_status: null,
        follow_up_notes: null,
      })
      .select('id')
      .single()

    if (err) {
      setSaving(false)
      setError(
        err.message.includes('themselves')
          ? 'You cannot record a performance event about yourself.'
          : err.message,
      )
      return
    }

    // Files can only be sent now — their storage path is keyed on the id the
    // insert just returned.
    const failed = created?.id ? await uploadPending(created.id, files, appUserId) : []
    setSaving(false)
    router.refresh()

    if (failed.length) {
      setPostSave(
        `The event was saved, but ${failed.length === 1 ? 'this file' : 'these files'} could not be attached: ${failed.join(', ')}. Open the event from the Performance page and attach ${failed.length === 1 ? 'it' : 'them'} again.`,
      )
      return
    }

    if (addAnother) {
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
      reset(true)
    } else {
      reset(false)
      close()
    }
  }

  if (!open) return null

  const tone = type === 'goofup' ? 'neg' : 'pos'

  const choiceStyle = (active: boolean, t: 'pos' | 'neg'): CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px',
    borderRadius: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    background: active ? `var(--epi-${t}-bg)` : 'var(--epi-surface)',
    border: active ? `1px solid var(--epi-${t})` : '1px solid var(--epi-border-2)',
    boxShadow: active ? `0 0 0 3px var(--epi-${t}-bg), 0 8px 24px rgba(0,0,0,0.10)` : 'none',
    color: 'var(--epi-fg)',
    transition: 'all 180ms cubic-bezier(0.2,0.8,0.2,1)',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Record performance"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) attemptClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'var(--epi-scrim)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'epiScrimIn 220ms ease-out',
      }}
      className="epi-modal-overlay"
    >
      <div
        ref={dialogRef}
        className="epi-modal"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '580px',
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
        {/* Brand hairline across the top edge */}
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
        {/* Soft glow behind the header */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: '-90px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '380px',
            height: '180px',
            background: 'radial-gradient(closest-side, rgba(14,124,107,0.20), rgba(14,124,107,0))',
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <div
          style={{
            position: 'relative',
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
            <Zap size={19} />
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
              Record performance
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: '21px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              What happened?
            </h2>
          </div>

          <button
            onClick={() => setQuick((q) => !q)}
            title={quick ? 'Quick mode: employee, type and one line' : 'Full detail: date, category and impact'}
            style={{
              height: '30px',
              padding: '0 11px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: quick ? 'var(--epi-pos-bg)' : 'var(--epi-input)',
              border: quick ? '1px solid var(--epi-pos-bd)' : '1px solid var(--epi-border-2)',
              color: quick ? 'var(--epi-pos)' : 'var(--epi-fg-2)',
              transition: 'all 160ms cubic-bezier(0.2,0.8,0.2,1)',
            }}
          >
            {quick ? <Sparkles size={13} /> : null}
            {quick ? 'Quick' : 'Full detail'}
          </button>

          <button
            onClick={attemptClose}
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

        {/* Body */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          <div className="epi-choices" style={{ display: 'flex', gap: '12px' }}>
            <button
              className="epi-choice"
              onClick={() => {
                setType('positive')
                setSeverity(NEUTRAL_SEVERITY)
              }}
              style={choiceStyle(type === 'positive', 'pos')}
            >
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    type === 'positive'
                      ? 'linear-gradient(135deg,#14907c,#0a5f52)'
                      : 'var(--epi-pos-bg)',
                  color: type === 'positive' ? '#fff' : 'var(--epi-pos)',
                  border: type === 'positive' ? 'none' : '1px solid var(--epi-pos-bd)',
                }}
              >
                <Check size={17} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Positive Contribution
                </span>
                <span style={{ fontSize: '12px', color: 'var(--epi-fg-2)', lineHeight: 1.45 }}>
                  Recognition, ownership, problem solved
                </span>
              </span>
            </button>

            <button
              className="epi-choice"
              onClick={() => {
                setType('goofup')
                setSeverity(NEUTRAL_SEVERITY)
              }}
              style={choiceStyle(type === 'goofup', 'neg')}
            >
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    type === 'goofup' ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : 'var(--epi-neg-bg)',
                  color: type === 'goofup' ? '#fff' : 'var(--epi-neg)',
                  border: type === 'goofup' ? 'none' : '1px solid var(--epi-neg-bd)',
                }}
              >
                <AlertTriangle size={17} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em' }}>Goofup</span>
                <span style={{ fontSize: '12px', color: 'var(--epi-fg-2)', lineHeight: 1.45 }}>
                  Mistake, delay, process or quality issue
                </span>
              </span>
            </button>
          </div>

          {!type ? (
            <div
              style={{
                marginTop: '18px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--epi-surface)',
                border: '1px dashed var(--epi-border-2)',
                fontSize: '13px',
                color: 'var(--epi-fg-2)',
                lineHeight: 1.55,
              }}
            >
              <ChevronRight size={15} style={{ marginTop: '2px', flex: '0 0 15px', color: 'var(--epi-fg-3)' }} />
              <span>
                Pick a type above to continue. <strong style={{ color: 'var(--epi-fg)' }}>Quick</strong> records
                employee, type and one line — everything else can be added later.
              </span>
            </div>
          ) : (
            <div
              style={{
                marginTop: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                animation: 'epiIn 200ms cubic-bezier(0.2,0.8,0.2,1)',
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={labelRow}>
                  <UserRound size={13} style={{ color: 'var(--epi-fg-3)' }} />
                  Employee <span style={{ color: 'var(--epi-neg)' }}>*</span>
                </span>
                <select
                  className="epi-field"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  style={{ ...field, padding: '0 10px' }}
                >
                  <option value="">Select an employee…</option>
                  {employees
                    .filter((e) => e.id !== selfEmployeeId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name}
                        {e.department ? ` · ${e.department}` : ''}
                      </option>
                    ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <span style={labelRow}>
                  Event title <span style={{ color: 'var(--epi-neg)' }}>*</span>
                </span>
                <input
                  className="epi-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short summary, e.g. Solved urgent production issue"
                  style={field}
                />
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <label htmlFor="epi-what-happened" style={labelRow}>
                    What happened?
                  </label>
                  <VoiceDictation
                    onText={(chunk) => setDescription((prev) => (prev ? `${prev} ${chunk}` : chunk))}
                  />
                </div>
                <textarea
                  id="epi-what-happened"
                  className="epi-field"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Type, or press Speak and say it…"
                  style={{ ...field, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              <div
                style={{
                  paddingTop: '14px',
                  borderTop: '1px solid var(--epi-border)',
                }}
              >
                <AttachmentPicker files={files} onChange={setFiles} />
              </div>

              {!quick ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    animation: 'epiIn 200ms cubic-bezier(0.2,0.8,0.2,1)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <label style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      <span style={labelRow}>
                        <CalendarDays size={13} style={{ color: 'var(--epi-fg-3)' }} />
                        Date
                      </span>
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
                      <span style={labelRow}>Category</span>
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

                  {/* Impact grades a goofup. It says nothing about a positive
                      contribution, so it is not offered for one. */}
                  {type && hasImpact(type) ? (
                  <div>
                    <span style={{ ...labelRow, marginBottom: '8px' }}>Impact</span>
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
                      {SEVERITY_ORDER.map((s) => {
                        const active = severity === s
                        const t = SEV_TONE[s]
                        return (
                          <button
                            key={s}
                            onClick={() => setSeverity(s)}
                            title={SEVERITY_HINTS[s]}
                            style={{
                              height: '32px',
                              borderRadius: '9px',
                              border: 0,
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              background: active ? `var(--epi-${t}-bg)` : 'transparent',
                              color: active ? `var(--epi-${t})` : 'var(--epi-fg-2)',
                              boxShadow: active ? `inset 0 0 0 1px var(--epi-${t}-bd)` : 'none',
                              transition: 'all 140ms cubic-bezier(0.2,0.8,0.2,1)',
                            }}
                          >
                            {SEVERITY_LABELS[s]}
                          </button>
                        )
                      })}
                    </div>
                    <p style={{ margin: '7px 0 0', fontSize: '12px', color: 'var(--epi-fg-3)' }}>
                      {SEVERITY_HINTS[severity]}
                    </p>
                  </div>
                  ) : null}

                  {/* Two different questions, deliberately separated:
                      who saw it (editable, from the Settings master) and who
                      entered it (pinned to the signed-in user by RLS and
                      frozen by a trigger — it is the audit trail). */}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <span style={labelRow}>Who observed this?</span>
                    {observers.length === 0 ? (
                      <>
                        <input
                          value=""
                          readOnly
                          placeholder="No observers set up yet"
                          style={{ ...field, color: 'var(--epi-fg-3)', cursor: 'not-allowed' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
                          Add names under Settings → Observers to use this field.
                        </span>
                      </>
                    ) : (
                      <select
                        value={observedBy}
                        onChange={(e) => setObservedBy(e.target.value)}
                        aria-label="Who observed this"
                        style={field}
                      >
                        <option value="">Not specified</option>
                        {observers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
                      Recorded by {currentUserName} — that cannot be changed.
                    </span>
                  </label>
                </div>
              ) : null}

              {postSave ? (
                <div
                  role="status"
                  style={{
                    display: 'flex',
                    gap: '9px',
                    alignItems: 'flex-start',
                    border: '1px solid var(--epi-orange-bd)',
                    background: 'var(--epi-orange-bg)',
                    borderRadius: '11px',
                    padding: '11px 13px',
                    fontSize: '13px',
                    color: 'var(--epi-orange)',
                  }}
                >
                  <AlertTriangle size={15} style={{ flex: '0 0 15px', marginTop: '1px' }} />
                  <span style={{ flex: 1, lineHeight: 1.45 }}>{postSave}</span>
                </div>
              ) : null}

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
                    animation: 'epiIn 160ms cubic-bezier(0.2,0.8,0.2,1)',
                  }}
                >
                  <AlertTriangle size={15} style={{ flex: '0 0 15px', marginTop: '1px' }} />
                  <span style={{ flex: 1, lineHeight: 1.45 }}>{error}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        {type ? (
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
            {saved ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--epi-pos)',
                  animation: 'epiIn 160ms ease-out',
                }}
              >
                <Check size={14} /> Saved
              </span>
            ) : null}
            <span style={{ flex: 1 }} />
            {postSave ? (
              <button
                onClick={attemptClose}
                style={{
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: '10px',
                  border: 0,
                  background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            ) : (
              <>
            <button
              onClick={attemptClose}
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
              onClick={() => save(true)}
              disabled={saving}
              style={{
                height: '40px',
                padding: '0 15px',
                borderRadius: '10px',
                background: 'var(--epi-raised)',
                border: '1px solid var(--epi-border-2)',
                color: 'var(--epi-fg)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'progress' : 'pointer',
              }}
            >
              Save &amp; add another
            </button>
            <button
              onClick={() => save(false)}
              disabled={saving}
              style={{
                height: '40px',
                padding: '0 20px',
                borderRadius: '10px',
                border: 0,
                background:
                  tone === 'neg'
                    ? 'linear-gradient(135deg,#FBBF24,#F59E0B)'
                    : 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'progress' : 'pointer',
                opacity: saving ? 0.75 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow:
                  tone === 'neg'
                    ? '0 8px 22px rgba(245,158,11,0.30)'
                    : '0 8px 22px rgba(14,124,107,0.28)',
              }}
            >
              {saving ? <Loader2 size={15} className="epi-spin" /> : null}
              {saving ? 'Saving…' : 'Save event'}
            </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
