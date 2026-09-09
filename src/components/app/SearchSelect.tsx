'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  /** Shown beside the label and searched along with it — a department, a code. */
  hint?: string | null
}

/** Below this many choices, a search box is more furniture than help. */
const SEARCH_FROM = 8

/**
 * A filter picker you can type into.
 *
 * A native select is the right control for three or four choices, and the
 * wrong one for fifty: finding an employee meant scrolling a list with no
 * way in but the first letter, and only if you guessed the spelling. This
 * keeps a select's shape — one value, a clear "all" — and adds the thing
 * fifty rows need, which is a search box.
 *
 * Matching is a plain substring on the label and its hint, deliberately:
 * fuzzy matching would put "Ankit Nai" ahead of "Nandkishor Desai" for the
 * query "nai" often enough to be irritating, and nobody can predict it.
 */
export function SearchSelect({
  value,
  options,
  onChange,
  allLabel,
  ariaLabel,
  minWidth = '150px',
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  /** The empty selection — "All employees". Also the reset row in the list. */
  allLabel: string
  ariaLabel: string
  minWidth?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value) ?? null
  const searchable = options.length >= SEARCH_FROM

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
    )
  }, [options, query])

  // The "all" row sits at index 0 of what the keyboard walks, so the arrow
  // keys can reach it like any other choice.
  const rows: (SelectOption | null)[] = [null, ...matches]

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  // Focus follows opening, and the highlight follows the arrow keys — both
  // are DOM effects of a state change, which is what an effect is for.
  useEffect(() => {
    if (open && searchable) input.current?.focus()
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
    setActive(0)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1
        return Math.max(0, Math.min(rows.length - 1, next))
      })
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const row = rows[active]
      choose(row ? row.value : '')
    }
  }

  return (
    <div
      ref={box}
      className="epi-combo"
      style={{ position: 'relative', minWidth, flex: '0 1 auto' }}
      onKeyDown={onKey}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setQuery('')
          setActive(0)
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        title={selected ? selected.label : allLabel}
        style={{
          width: '100%',
          height: '34px',
          borderRadius: '8px',
          background: 'var(--epi-input)',
          border: `1px solid ${value ? 'var(--epi-teal-bd)' : 'var(--epi-border)'}`,
          color: value ? 'var(--epi-teal)' : 'var(--epi-fg)',
          fontWeight: value ? 600 : 400,
          fontSize: '13px',
          padding: '0 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : allLabel}
        </span>

        {/* Clearing is one click, not "scroll back to the top and pick All". */}
        {value ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Clear ${ariaLabel}`}
            onClick={(e) => {
              e.stopPropagation()
              choose('')
            }}
            style={{ display: 'flex', flex: '0 0 auto', color: 'var(--epi-fg-3)' }}
          >
            <X size={13} />
          </span>
        ) : (
          <ChevronDown size={13} style={{ flex: '0 0 auto', color: 'var(--epi-fg-3)' }} />
        )}
      </button>

      {open ? (
        <div
          className="epi-combo-pop"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: 'min(320px, calc(100vw - 32px))',
            background: 'var(--epi-elev)',
            border: '1px solid var(--epi-border-2)',
            borderRadius: '11px',
            boxShadow: 'var(--epi-shadow-lg)',
            zIndex: 70,
            overflow: 'hidden',
            animation: 'epiModalIn 140ms cubic-bezier(0.2,0.8,0.2,1)',
          }}
        >
          {searchable ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '8px 10px',
                borderBottom: '1px solid var(--epi-border)',
              }}
            >
              <Search size={13} style={{ color: 'var(--epi-fg-3)', flex: '0 0 13px' }} />
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                placeholder="Type to search…"
                aria-label={`Search ${ariaLabel}`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--epi-fg)',
                  fontSize: '13px',
                }}
              />
            </div>
          ) : null}

          <div ref={list} id={listId} role="listbox" style={{ maxHeight: '246px', overflowY: 'auto' }}>
            <Row
              label={allLabel}
              selected={value === ''}
              active={active === 0}
              onPick={() => choose('')}
              muted
            />

            {matches.length === 0 ? (
              <div style={{ padding: '14px 12px', fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>
                Nothing matches “{query.trim()}”.
              </div>
            ) : (
              matches.map((o, i) => (
                <Row
                  key={o.value}
                  label={o.label}
                  hint={o.hint}
                  selected={o.value === value}
                  active={active === i + 1}
                  onPick={() => choose(o.value)}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Row({
  label,
  hint,
  selected,
  active,
  onPick,
  muted,
}: {
  label: string
  hint?: string | null
  selected: boolean
  active: boolean
  onPick: () => void
  muted?: boolean
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      data-active={active}
      onMouseDown={(e) => {
        // mousedown, not click: the outside-click listener fires first
        // otherwise and closes the panel before the choice registers.
        e.preventDefault()
        onPick()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 11px',
        cursor: 'pointer',
        background: active ? 'var(--epi-hover)' : 'transparent',
        borderBottom: '1px solid var(--epi-border-soft)',
      }}
    >
      <Check
        size={13}
        style={{ flex: '0 0 13px', opacity: selected ? 1 : 0, color: 'var(--epi-teal)' }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '13px',
          fontWeight: selected ? 600 : 400,
          color: muted && !selected ? 'var(--epi-fg-2)' : 'var(--epi-fg)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {hint ? (
        <span style={{ fontSize: '11.5px', color: 'var(--epi-fg-3)', flex: '0 0 auto' }}>{hint}</span>
      ) : null}
    </div>
  )
}
