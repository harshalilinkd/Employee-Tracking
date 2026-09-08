'use client'

import { useState } from 'react'

/**
 * One overflow mechanism for every dashboard list.
 *
 * The three people-lists on the dashboard each failed differently once the
 * headcount grew past a handful:
 *
 *  - Management Attention and the Recognition Leaderboard were sliced to six
 *    rows *silently*, and their header badges counted the sliced array — so
 *    with 23 people needing attention the panel said "6". A header that
 *    reports a display artefact as a figure is worse than no figure.
 *  - The performance matrix expanded to every ranked employee at once, so
 *    "Show all" on a 60-person roster buried the rest of the dashboard.
 *
 * So: the count always comes from the data (`total`), never from the rows;
 * nothing is hidden without the footer saying so; and expanding scrolls
 * inside a fixed height rather than growing the page. Panels keep the same
 * height at 15 employees and at 500.
 */
export function ExpandableList({
  rows,
  header,
  total,
  collapsed = 6,
  noun = 'employees',
  maxHeight = 430,
  gap,
  scrollX,
  containerStyle,
}: {
  /** Every row the server sent — already rendered, sliced here for display. */
  rows: React.ReactNode[]
  /** Column header, kept visible while the expanded list scrolls under it. */
  header?: React.ReactNode
  /** True size of the underlying set, which may exceed `rows.length`. */
  total: number
  collapsed?: number
  noun?: string
  maxHeight?: number
  /** Set when the rows are free-standing cards rather than table rows. */
  gap?: number
  /** Wide tables keep their sideways scroll on the same element. */
  scrollX?: boolean
  /** Card chrome, applied to the scroll box so the footer stays outside it. */
  containerStyle?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)

  const rendered = rows.length
  const showing = open ? rendered : Math.min(collapsed, rendered)
  const canToggle = rendered > collapsed
  // The server caps how many rows it sends; beyond that the answer is to
  // filter, not to scroll, so the footer says so rather than pretending.
  const beyondPayload = total > rendered

  return (
    <>
      <div
        className={scrollX ? 'epi-scroll-x' : undefined}
        style={{
          ...containerStyle,
          overflowX: scrollX ? 'auto' : undefined,
          maxHeight: open ? `${maxHeight}px` : undefined,
          overflowY: open ? 'auto' : undefined,
          ...(gap !== undefined
            ? { display: 'flex', flexDirection: 'column' as const, gap: `${gap}px` }
            : null),
        }}
      >
        {header ? (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              background: 'var(--epi-surface)',
            }}
          >
            {header}
          </div>
        ) : null}
        {rows.slice(0, showing)}
      </div>

      {canToggle || beyondPayload ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            padding: '10px 2px 0',
            fontSize: '13px',
          }}
        >
          <span className="epi-num" style={{ color: 'var(--epi-fg-3)' }}>
            Showing {showing} of {total} {noun}
          </span>

          {canToggle ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              style={{
                marginLeft: 'auto',
                height: '30px',
                padding: '0 11px',
                borderRadius: '8px',
                background: 'var(--epi-input)',
                border: '1px solid var(--epi-border-2)',
                color: 'var(--epi-fg)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                flex: '0 0 auto',
              }}
            >
              {open ? 'Show fewer' : `Show all ${rendered}`}
            </button>
          ) : null}

          {open && beyondPayload ? (
            <span style={{ flex: '1 1 100%', color: 'var(--epi-fg-3)', fontSize: '12.5px' }}>
              Narrow the filters above to see the remaining {total - rendered}.
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
