'use client'

import { useCallback, useState, type CSSProperties } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, SlidersHorizontal } from 'lucide-react'
import { SEVERITY_LABELS, SEVERITY_ORDER, hasImpact } from '@/lib/types'

function useSetParams() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      const qs = next.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, params],
  )
}

const control: CSSProperties = {
  height: '40px',
  width: '100%',
  minWidth: 0,
  borderRadius: '9px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border-2)',
  color: 'var(--epi-fg)',
  fontSize: '13.5px',
  padding: '0 10px',
  outline: 'none',
}

/* ------------------------------------------------------------------ */
/* Controls — dates and filters share one row                          */
/*                                                                     */
/* On desktop the select panel is `display: contents`, so the four      */
/* selects become direct children of this flex row and everything sits  */
/* on one line. On mobile the panel becomes a 2x2 grid that drops below */
/* the Filters button.                                                  */
/* ------------------------------------------------------------------ */

const filterLabel: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  color: 'var(--epi-fg-3)',
}

const dateLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flex: '1 1 190px',
  minWidth: 0,
}

/* Compact variant for the page header — shorter, tighter, no filler text. */
const compactControl: CSSProperties = {
  ...control,
  height: '34px',
  width: 'auto',
  fontSize: '13px',
  padding: '0 8px',
}

/**
 * Rendered twice on purpose: here in the page header for desktop, and again
 * inside the filters row for mobile. Both only ever write to the URL, so
 * there is no state to keep in sync — CSS shows whichever one fits.
 */
export function DateRange({ from, to }: { from: string; to: string }) {
  const setParams = useSetParams()

  return (
    <div
      className="epi-dates-header epi-hide-mobile"
      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
    >
      <CalendarDays size={14} style={{ color: 'var(--epi-fg-3)', flex: '0 0 14px' }} />
      <input
        type="date"
        value={from}
        max={to}
        onChange={(e) => setParams({ from: e.target.value })}
        aria-label="From date"
        style={compactControl}
      />
      <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>to</span>
      <input
        type="date"
        value={to}
        min={from}
        onChange={(e) => setParams({ to: e.target.value })}
        aria-label="To date"
        style={compactControl}
      />
    </div>
  )
}

export function DashboardFilters({
  employees,
  departments,
  summary,
  from,
  to,
}: {
  employees: { id: string; full_name: string }[]
  departments: { id: string; name: string }[]
  summary: string
  from: string
  to: string
}) {
  const params = useSearchParams()
  const setParams = useSetParams()
  const [open, setOpen] = useState(false)

  const typeFilter = params.get('type') ?? ''
  // Impact grades goofups only, so the control is dropped once the type
  // filter has excluded them — and it stops counting toward the badge.
  const showImpact = typeFilter !== 'positive'
  const active = ['emp', 'dept', 'type', 'sev'].filter(
    (k) => params.get(k) && !(k === 'sev' && !showImpact),
  ).length

  return (
    <div
      className="epi-controls"
      style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="epi-filter-toggle"
        aria-expanded={open}
        style={{
          height: '40px',
          padding: '0 14px',
          borderRadius: '9px',
          background: active ? 'var(--epi-violet-bg)' : 'var(--epi-input)',
          border: `1px solid ${active ? 'var(--epi-violet-bd)' : 'var(--epi-border-2)'}`,
          color: active ? 'var(--epi-violet)' : 'var(--epi-fg)',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: '0 0 auto',
        }}
      >
        <SlidersHorizontal size={15} />
        Filters
        {active ? (
          <span
            className="epi-num"
            style={{
              minWidth: '19px',
              height: '19px',
              padding: '0 5px',
              borderRadius: '999px',
              background: 'var(--epi-violet)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {active}
          </span>
        ) : null}
        <span style={{ fontSize: '12px', opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Mobile only — on desktop these live in the page header instead. */}
      <div className="epi-dates-inline">
        <label style={dateLabel}>
          <CalendarDays size={15} style={{ color: 'var(--epi-fg-3)', flex: '0 0 15px' }} />
          <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)', flex: '0 0 auto' }}>From</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setParams({ from: e.target.value })}
            aria-label="From date"
            style={control}
          />
        </label>

        <label style={dateLabel}>
          <CalendarDays size={15} style={{ color: 'var(--epi-fg-3)', flex: '0 0 15px' }} />
          <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)', flex: '0 0 auto' }}>To</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setParams({ to: e.target.value })}
            aria-label="To date"
            style={control}
          />
        </label>
      </div>

      <div
        className={`epi-filter-panel${open ? ' epi-open' : ''}`}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '10px' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0, flex: '1 1 150px' }}>
          <span style={filterLabel}>Employee</span>
          <select
            aria-label="Employee"
            value={params.get('emp') ?? ''}
            onChange={(e) => setParams({ emp: e.target.value })}
            style={control}
          >
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0, flex: '1 1 150px' }}>
          <span style={filterLabel}>Department</span>
          <select
            aria-label="Department"
            value={params.get('dept') ?? ''}
            onChange={(e) => setParams({ dept: e.target.value })}
            style={control}
          >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0, flex: '1 1 150px' }}>
          <span style={filterLabel}>Type</span>
          <select
            aria-label="Type"
            value={typeFilter}
            onChange={(e) => {
              const next = e.target.value
              // Drop any impact already set, in the same push, so the list is
              // never filtered by a control that has left the screen.
              setParams(
                next && !hasImpact(next as 'positive' | 'goofup')
                  ? { type: next, sev: '' }
                  : { type: next },
              )
            }}
            style={control}
          >
          <option value="">All types</option>
          <option value="positive">Positive contributions</option>
          <option value="goofup">Goofups</option>
          </select>
        </label>

        {showImpact ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0, flex: '1 1 150px' }}>
            <span style={filterLabel}>Impact</span>
            <select
              aria-label="Impact"
              value={params.get('sev') ?? ''}
              onChange={(e) => setParams({ sev: e.target.value })}
              style={control}
            >
              <option value="">All severities</option>
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <span style={{ fontSize: '13px', color: 'var(--epi-fg-3)', flex: '0 0 auto' }}>{summary}</span>

      {active ? (
        <button
          onClick={() => setParams({ emp: '', dept: '', type: '', sev: '' })}
          style={{
            height: '40px',
            padding: '0 12px',
            borderRadius: '9px',
            background: 'transparent',
            border: '1px solid var(--epi-border-2)',
            color: 'var(--epi-fg-2)',
            fontSize: '13px',
            cursor: 'pointer',
            flex: '0 0 auto',
          }}
        >
          Clear
        </button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Scope toggle only.
 *
 * The sort dropdown that used to sit beside it is gone: the filter bar above
 * already carries employee, department, type and impact, and a second row of
 * chart-level controls read as more of the same while crowding the section
 * header on a phone. The matrix now always ranks needs-attention first, which
 * is what the dropdown defaulted to anyway.
 *
 * This is a view switch rather than a filter — dropping it too would remove
 * the department breakdown entirely — so it stays.
 */
export function MatrixControls() {
  const params = useSearchParams()
  const setParams = useSetParams()
  const scope = params.get('scope') ?? 'employee'

  return (
    <>
      <div
        className="epi-scope-toggle"
        style={{
          display: 'flex',
          gap: '2px',
          padding: '3px',
          borderRadius: '999px',
          background: 'var(--epi-input)',
          border: '1px solid var(--epi-border)',
        }}
      >
        {(['employee', 'department'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setParams({ scope: s === 'employee' ? '' : s })}
            style={{
              height: '28px',
              padding: '0 12px',
              borderRadius: '999px',
              border: 0,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: scope === s ? 'var(--epi-raised)' : 'transparent',
              color: scope === s ? 'var(--epi-fg)' : 'var(--epi-fg-2)',
            }}
          >
            {s === 'employee' ? 'By employee' : 'By department'}
          </button>
        ))}
      </div>
    </>
  )
}
