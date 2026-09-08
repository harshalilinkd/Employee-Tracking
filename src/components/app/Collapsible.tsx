'use client'

import { useState, type ReactNode } from 'react'
import { chevStyle } from '@/lib/design'

/**
 * Section wrapper with the canvas's ▾ chevron.
 *
 * `count` sits next to the title so a collapsed section still says how much
 * is inside — an empty panel collapses to one line rather than occupying a
 * screenful of white space saying "nothing here".
 */
export function Collapsible({
  title,
  subtitle,
  count,
  emptyNote,
  right,
  defaultOpen = true,
  compact = false,
  children,
}: {
  title: string
  subtitle?: string
  count?: number
  emptyNote?: string
  right?: ReactNode
  defaultOpen?: boolean
  compact?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isEmpty = count === 0

  return (
    <section style={{ minWidth: 0 }}>
      <div
        className="epi-section-head"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          // Fixed height, matched to AttentionPanel's header. Without it the
          // control pills make this header taller than the one beside it and
          // the two cards start at different heights.
          minHeight: '36px',
          marginBottom: open ? (subtitle ? '4px' : '12px') : 0,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          style={{ ...chevStyle, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 160ms ease' }}
        >
          ▾
        </button>

        <h2
          style={{
            margin: 0,
            fontSize: '17px',
            fontWeight: 700,
            letterSpacing: '-0.018em',
            cursor: 'pointer',
          }}
          onClick={() => setOpen((o) => !o)}
        >
          {title}
        </h2>

        {count !== undefined ? (
          <span
            className="epi-num"
            style={{
              fontSize: '12px',
              fontWeight: 700,
              minWidth: '22px',
              height: '22px',
              padding: '0 7px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isEmpty ? 'var(--epi-track)' : 'var(--epi-pos-bg)',
              color: isEmpty ? 'var(--epi-fg-3)' : 'var(--epi-pos)',
              border: `1px solid ${isEmpty ? 'var(--epi-border)' : 'var(--epi-pos-bd)'}`,
            }}
          >
            {count}
          </span>
        ) : null}

        {isEmpty && emptyNote ? (
          <span style={{ fontSize: '13px', color: 'var(--epi-fg-3)' }}>{emptyNote}</span>
        ) : null}

        {right ? (
          <div
            className="epi-head-right"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            {right}
          </div>
        ) : null}
      </div>

      {open && subtitle ? (
        <p
          className="epi-hide-mobile"
          style={{
            margin: '0 0 16px',
            fontSize: '13px',
            color: 'var(--epi-fg-3)',
            paddingLeft: compact ? 0 : '34px',
          }}
        >
          {subtitle}
        </p>
      ) : null}

      {open ? children : null}
    </section>
  )
}
