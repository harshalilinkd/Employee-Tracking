'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'

export interface RowMenuItem {
  label: string
  icon?: React.ReactNode
  onSelect: () => void
  /** Greyed with `reason` as the tooltip rather than hidden. */
  disabled?: boolean
  reason?: string
  /** Destructive items are separated and tinted red. */
  danger?: boolean
}

/**
 * The per-row actions menu.
 *
 * The menu is `position: fixed` and measured off the trigger rather than
 * absolutely positioned inside the row, because the ledger table is a
 * horizontally scrolling box (`overflow-x: auto`) — an absolutely positioned
 * child would be clipped by it, and the last row's menu would open into the
 * clipped region and be unreachable.
 *
 * It closes on outside click, on Escape, and on scroll or resize, since a
 * fixed element does not travel with the content it was measured against.
 */
export function RowMenu({ items, label = 'Row actions' }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onMove = () => setOpen(false)

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // Capture phase, so a scroll inside the table is caught as well as the page.
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  function toggle() {
    if (open) return setOpen(false)
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const width = 188
    const height = items.length * 38 + 12
    setPos({
      // Flip above and pull left when the menu would leave the viewport.
      top: r.bottom + height > window.innerHeight ? Math.max(8, r.top - height - 4) : r.bottom + 4,
      left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
    })
    setOpen(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '7px',
          background: open ? 'var(--epi-hover)' : 'transparent',
          border: '1px solid var(--epi-border-2)',
          color: 'var(--epi-fg-2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <MoreVertical size={15} />
      </button>

      {open && pos ? (
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            width: '188px',
            zIndex: 80,
            padding: '6px',
            borderRadius: '11px',
            background: 'var(--epi-elev)',
            border: '1px solid var(--epi-border-2)',
            boxShadow: 'var(--epi-shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            animation: 'epiIn 120ms cubic-bezier(0.2,0.8,0.2,1) both',
          }}
        >
          {items.map((it, i) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              title={it.disabled ? it.reason : undefined}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
              className={it.disabled ? undefined : 'epi-menu-item'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '0 10px',
                borderRadius: '8px',
                border: 0,
                background: 'transparent',
                textAlign: 'left',
                fontSize: '13.5px',
                fontWeight: 500,
                cursor: it.disabled ? 'not-allowed' : 'pointer',
                opacity: it.disabled ? 0.42 : 1,
                color: it.danger ? 'var(--epi-red)' : 'var(--epi-fg)',
                // Destructive actions sit below a rule, so Delete is never
                // the neighbour your finger lands on by accident.
                ...(it.danger && i > 0
                  ? {
                      height: '40px',
                      marginTop: '5px',
                      paddingTop: '5px',
                      borderTop: '1px solid var(--epi-border)',
                    }
                  : { height: '34px' }),
              }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}
