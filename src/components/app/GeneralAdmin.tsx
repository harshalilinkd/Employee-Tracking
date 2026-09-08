'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  Globe,
  Hash,
  Loader2,
  Lock,
  Scale,
  SlidersHorizontal,
  Timer,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cardStyle, subtleButton } from '@/lib/design'

export interface GeneralSettings {
  organisation: string
  timezone: string
  date_format: string
}

export interface SignalSettings {
  window_days: number
  min_events_for_signal: number
  recency_decay_days: number
  severity_weight: { low: number; medium: number; high: number; critical: number }
}

/**
 * Editable workspace configuration.
 *
 * These values feed every calculation in the app, so a save re-scores every
 * record already captured. That is stated on the page and confirmed before
 * the write, rather than being a surprise afterwards.
 */
export function GeneralAdmin({
  general,
  signal,
  raw,
  canEdit,
}: {
  general: GeneralSettings
  signal: SignalSettings
  /** The full stored objects, so a save preserves keys this form does not show. */
  raw: { general: Record<string, unknown>; signal_config: Record<string, unknown> }
  canEdit: boolean
}) {
  const router = useRouter()
  const [g, setG] = useState(general)
  const [sig, setSig] = useState(signal)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const dirty =
    JSON.stringify(g) !== JSON.stringify(general) || JSON.stringify(sig) !== JSON.stringify(signal)

  function num(v: string, fallback: number) {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }

  async function save() {
    setError('')
    setSaved(false)

    if (sig.window_days < 7 || sig.window_days > 730) {
      setError('Window must be between 7 and 730 days.')
      return
    }
    if (sig.min_events_for_signal < 1 || sig.min_events_for_signal > 50) {
      setError('Minimum events must be between 1 and 50.')
      return
    }
    if (sig.recency_decay_days < 1 || sig.recency_decay_days > 365) {
      setError('Recency decay must be between 1 and 365 days.')
      return
    }
    const w = sig.severity_weight
    if ([w.low, w.medium, w.high, w.critical].some((x) => !(x > 0) || x > 100)) {
      setError('Each impact weight must be greater than 0 and at most 100.')
      return
    }
    if (!(w.low <= w.medium && w.medium <= w.high && w.high <= w.critical)) {
      setError('Impact weights must increase: Low ≤ Medium ≤ High ≤ Critical.')
      return
    }
    if (!g.organisation.trim()) {
      setError('Organisation name is required.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    // Merge into the stored objects so keys this form does not expose —
    // band thresholds, follow-up penalties — survive the save.
    const results = await Promise.all([
      supabase
        .from('settings')
        .update({ value: { ...raw.general, ...g, organisation: g.organisation.trim() } })
        .eq('key', 'general'),
      supabase
        .from('settings')
        .update({ value: { ...raw.signal_config, ...sig } })
        .eq('key', 'signal_config'),
    ])
    setSaving(false)

    const failed = results.find((r) => r.error)
    if (failed?.error) {
      setError(
        failed.error.message.includes('row-level security')
          ? 'Your role cannot change these settings. Super Admin is required.'
          : failed.error.message,
      )
      return
    }

    setSaved(true)
    router.refresh()
  }

  function reset() {
    setG(general)
    setSig(signal)
    setError('')
    setSaved(false)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.018em' }}>General</h2>
          <p style={{ margin: '5px 0 0', fontSize: '14px', color: 'var(--epi-fg-2)' }}>
            How this workspace is configured, and how the performance signal is calculated.
          </p>
        </div>

        {canEdit ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={subtleButton} onClick={reset} disabled={!dirty || saving}>
              Reset
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              style={{
                height: '34px',
                padding: '0 16px',
                borderRadius: '8px',
                border: 0,
                background: dirty
                  ? 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)'
                  : 'var(--epi-track)',
                color: dirty ? '#fff' : 'var(--epi-fg-3)',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: saving ? 'progress' : dirty ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              {saving ? <Loader2 size={14} className="epi-spin" /> : <Check size={14} />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <Banner tone="red">{error}</Banner> : null}
      {saved && !dirty ? <Banner tone="green">Saved. Every signal has been recalculated.</Banner> : null}

      <div
        className="epi-chart-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '20px', alignItems: 'start' }}
      >
        <Card icon={<Building2 size={15} />} title="Organisation">
          <Field
            icon={<Building2 size={14} />}
            label="Organisation"
            value={g.organisation}
            onChange={(v) => setG({ ...g, organisation: v })}
            disabled={!canEdit}
          />
          <Field
            icon={<Globe size={14} />}
            label="Timezone"
            value={g.timezone}
            onChange={(v) => setG({ ...g, timezone: v })}
            disabled={!canEdit}
            options={['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC']}
          />
          <Field
            icon={<CalendarDays size={14} />}
            label="Date format"
            value={g.date_format}
            onChange={(v) => setG({ ...g, date_format: v })}
            disabled={!canEdit}
            options={['dd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']}
            last
          />
        </Card>

        <Card icon={<SlidersHorizontal size={15} />} title="Signal configuration">
          <Field
            icon={<CalendarRange size={14} />}
            label="Window"
            hint="Only events inside this window count."
            value={String(sig.window_days)}
            onChange={(v) => setSig({ ...sig, window_days: num(v, sig.window_days) })}
            disabled={!canEdit}
            numeric
            suffix="days"
          />
          <Field
            icon={<Hash size={14} />}
            label="Minimum events"
            hint="Below this the band reads No signal."
            value={String(sig.min_events_for_signal)}
            onChange={(v) => setSig({ ...sig, min_events_for_signal: num(v, sig.min_events_for_signal) })}
            disabled={!canEdit}
            numeric
          />
          <Field
            icon={<Timer size={14} />}
            label="Recency decay"
            hint={`Half weight after about ${Math.round(sig.recency_decay_days * 0.693)} days.`}
            value={String(sig.recency_decay_days)}
            onChange={(v) => setSig({ ...sig, recency_decay_days: num(v, sig.recency_decay_days) })}
            disabled={!canEdit}
            numeric
            suffix="days"
          />

          <div style={{ display: 'flex', gap: '11px', alignItems: 'flex-start', padding: '12px 0 4px' }}>
            <span style={{ color: 'var(--epi-fg-3)', flex: '0 0 auto', marginTop: '2px' }}>
              <Scale size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 500 }}>Impact weights</div>
              <div style={{ fontSize: '11.5px', color: 'var(--epi-fg-3)', marginTop: '2px' }}>
                Must increase from Low to Critical.
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
                  gap: '8px',
                  marginTop: '10px',
                }}
              >
                {(['low', 'medium', 'high', 'critical'] as const).map((k) => (
                  <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--epi-fg-3)',
                      }}
                    >
                      {k}
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={sig.severity_weight[k]}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setSig({
                          ...sig,
                          severity_weight: {
                            ...sig.severity_weight,
                            [k]: num(e.target.value, sig.severity_weight[k]),
                          },
                        })
                      }
                      style={inputStyle}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

const inputStyle: React.CSSProperties = {
  height: '34px',
  width: '100%',
  minWidth: 0,
  borderRadius: '8px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border-2)',
  color: 'var(--epi-fg)',
  fontSize: '13.5px',
  padding: '0 9px',
  outline: 'none',
}

function Banner({ tone, children }: { tone: 'red' | 'green'; children: React.ReactNode }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: '11px 15px',
        fontSize: '13.5px',
        color: `var(--epi-${tone})`,
        borderColor: `var(--epi-${tone}-bd)`,
        background: `var(--epi-${tone}-bg)`,
      }}
    >
      {children}
    </div>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section style={{ ...cardStyle, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
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
          {icon}
        </span>
        <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.012em' }}>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Field({
  icon,
  label,
  hint,
  value,
  onChange,
  disabled,
  numeric,
  suffix,
  options,
  last,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  numeric?: boolean
  suffix?: string
  options?: string[]
  last?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '11px',
        alignItems: 'flex-start',
        padding: '11px 0',
        borderBottom: last ? 0 : '1px solid var(--epi-border-soft)',
      }}
    >
      <span style={{ color: 'var(--epi-fg-3)', flex: '0 0 auto', marginTop: '9px' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 500, marginBottom: '5px' }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {options ? (
            <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={inputStyle}>
              {options.includes(value) ? null : <option value={value}>{value}</option>}
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={numeric ? 'number' : 'text'}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              style={{ ...inputStyle, maxWidth: numeric ? '110px' : undefined }}
            />
          )}
          {suffix ? <span style={{ fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>{suffix}</span> : null}
        </span>
        {hint ? (
          <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--epi-fg-3)', marginTop: '5px' }}>
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  )
}

export function ReadOnlyNote() {
  return (
    <div
      style={{
        ...cardStyle,
        padding: '13px 16px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        fontSize: '13px',
        color: 'var(--epi-fg-2)',
        lineHeight: 1.6,
      }}
    >
      <Lock size={15} style={{ flex: '0 0 15px', marginTop: '2px', color: 'var(--epi-fg-3)' }} />
      <span>
        Only Super Admin can change these values. They feed every calculation in the app, so saving re-scores
        every record already captured.
      </span>
    </div>
  )
}
