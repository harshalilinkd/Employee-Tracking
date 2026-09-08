'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { cardStyle, selectStyle } from '@/lib/design'
import { SEVERITY_LABELS, SEVERITY_ORDER } from '@/lib/types'
import { ExportCsvButton } from './ExportCsvButton'
import { SavedViews } from './SavedViews'

interface Props {
  departments: { id: string; name: string }[]
  categories: { id: string; name: string; applies_to: string }[]
  employees: { id: string; full_name: string }[]
  rows: Record<string, unknown>[]
  currentAppUserId: string
}

const RANGES = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Last 3 months' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
]

export function LedgerFilters({ departments, categories, employees, rows, currentAppUserId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  // Phones only: the six dropdowns start collapsed behind the Filters button.
  // On desktop the panel dissolves (display: contents) and `open` is ignored.
  const [open, setOpen] = useState(false)

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      router.push(`${pathname}?${next.toString()}`)
    },
    [params, pathname, router],
  )

  // Debounced so typing does not push a history entry per keystroke.
  useEffect(() => {
    const current = params.get('q') ?? ''
    if (q === current) return
    const t = setTimeout(() => setParam('q', q), 350)
    return () => clearTimeout(t)
  }, [q, params, setParam])

  const type = params.get('type') ?? ''
  const visibleCategories = type ? categories.filter((c) => c.applies_to === type) : categories

  const hasAny = ['q', 'emp', 'dept', 'type', 'cat', 'sev', 'range'].some((k) => params.get(k))
  const activeCount = ['emp', 'dept', 'type', 'cat', 'sev', 'range'].filter((k) =>
    params.get(k),
  ).length

  return (
    <div
      className="epi-filterbar epi-ledger-bar"
      style={{
        ...cardStyle,
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        padding: '12px',
        borderRadius: '12px',
        alignItems: 'center',
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search performance records…"
        aria-label="Search performance records"
        className="epi-filter-wide epi-ledger-search"
        style={{
          flex: '1 1 200px',
          height: '34px',
          borderRadius: '8px',
          background: 'var(--epi-input)',
          border: '1px solid var(--epi-border)',
          color: 'var(--epi-fg)',
          padding: '0 12px',
          fontSize: '14px',
          outline: 'none',
        }}
      />

      {currentAppUserId ? <SavedViews currentAppUserId={currentAppUserId} /> : null}

      {/* Hidden on desktop by the global .epi-filter-toggle rule; on phones it
          sits beside the search box and expands the panel underneath. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="epi-filter-toggle epi-ledger-toggle"
        aria-expanded={open}
        aria-controls="ledger-filter-panel"
        style={{
          height: '34px',
          padding: '0 12px',
          borderRadius: '8px',
          background: activeCount ? 'var(--epi-teal-bg)' : 'var(--epi-input)',
          border: `1px solid ${activeCount ? 'var(--epi-teal-bd)' : 'var(--epi-border-2)'}`,
          color: activeCount ? 'var(--epi-teal)' : 'var(--epi-fg)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          flex: '0 0 auto',
        }}
      >
        <SlidersHorizontal size={15} />
        Filters
        {activeCount ? (
          <span
            style={{
              minWidth: '18px',
              height: '18px',
              padding: '0 5px',
              borderRadius: '999px',
              background: 'var(--epi-teal)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeCount}
          </span>
        ) : null}
        <span style={{ fontSize: '11px', opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      <div
        id="ledger-filter-panel"
        className={`epi-ledger-panel${open ? ' epi-open' : ''}`}
        style={{ display: 'contents' }}
      >
        <select
          aria-label="Employee"
          value={params.get('emp') ?? ''}
          onChange={(e) => setParam('emp', e.target.value)}
          style={{ ...selectStyle, fontWeight: 600, border: '1px solid var(--epi-border-2)' }}
        >
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>

        <select
          aria-label="Department"
          value={params.get('dept') ?? ''}
          onChange={(e) => setParam('dept', e.target.value)}
          style={selectStyle}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Type"
          value={type}
          onChange={(e) => setParam('type', e.target.value)}
          style={selectStyle}
        >
          <option value="">All types</option>
          <option value="positive">Positive contributions</option>
          <option value="goofup">Goofups</option>
        </select>

        <select
          aria-label="Category"
          value={params.get('cat') ?? ''}
          onChange={(e) => setParam('cat', e.target.value)}
          style={selectStyle}
        >
          <option value="">All categories</option>
          {visibleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Impact"
          value={params.get('sev') ?? ''}
          onChange={(e) => setParam('sev', e.target.value)}
          style={selectStyle}
        >
          <option value="">Any impact</option>
          {SEVERITY_ORDER.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          aria-label="Date range"
          value={params.get('range') ?? 'quarter'}
          onChange={(e) => setParam('range', e.target.value)}
          style={selectStyle}
        >
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>

        {/* On phones this moves up to the page header as a download icon. */}
        <ExportCsvButton rows={rows} className="epi-hide-mobile" />

        {hasAny ? (
          <button
            onClick={() => router.push(pathname)}
            style={{
              ...selectStyle,
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--epi-fg-2)',
            }}
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  )
}
