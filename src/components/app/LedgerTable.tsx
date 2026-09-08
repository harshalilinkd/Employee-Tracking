'use client'

import { useState } from 'react'
import { EventDetail, type DetailEvent } from './EventDetail'
import { cardStyle, iconStyle, pill, tableHeadStyle } from '@/lib/design'
import { fmtFull, fmtShort } from '@/lib/format'
import { hasImpact, impactLabel, type Category } from '@/lib/types'

const COLS = '92px minmax(140px,1.4fr) 100px minmax(230px,2.8fr) minmax(130px,1.3fr) 92px minmax(120px,1.1fr)'
const HEADS = ['Date', 'Employee', 'Type', 'Event', 'Category', 'Impact', 'Recorded by']

function Cell({
  children,
  mono,
  muted,
  bold,
  accent,
  title,
}: {
  children: React.ReactNode
  mono?: boolean
  muted?: boolean
  bold?: boolean
  accent?: boolean
  title?: string
}) {
  return (
    <span title={title} style={{ minWidth: 0, display: 'block' }}>
      <span
        className={mono ? 'epi-mono' : undefined}
        style={{
          display: 'block',
          fontSize: mono ? '12px' : '13.5px',
          fontWeight: bold ? 600 : 400,
          color: accent ? 'var(--epi-accent-fg)' : muted ? 'var(--epi-fg-2)' : 'var(--epi-fg)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </span>
  )
}

export function LedgerTable({
  rows,
  categories,
  currentAppUserId,
  isAdmin,
}: {
  rows: DetailEvent[]
  categories: Category[]
  currentAppUserId: string
  isAdmin: boolean
}) {
  const [open, setOpen] = useState<DetailEvent | null>(null)

  return (
    <>
      {/* Desktop: full gridlines, every cell bordered */}
      <div className="epi-table-desktop epi-scroll-x" style={{ ...cardStyle, overflow: 'hidden', overflowX: 'auto' }}>
        <div className="epi-xls-head" style={{ minWidth: '1000px', display: 'grid', gridTemplateColumns: COLS }}>
          {HEADS.map((h) => (
            <span key={h} style={{ ...tableHeadStyle, padding: '10px 13px' }}>
              {h}
            </span>
          ))}
        </div>

        {rows.map((e) => (
          <button
            key={e.id}
            onClick={() => setOpen(e)}
            className="epi-row epi-xls"
            style={{
              minWidth: '1000px',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: COLS,
              alignItems: 'center',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--epi-fg)',
            }}
          >
            <Cell mono muted>
              {fmtShort(e.event_date)}
            </Cell>
            <Cell bold>{e.employeeName}</Cell>
            <Cell>
              <span style={pill(e.type === 'positive' ? 'violet' : 'orange')}>
                {e.type === 'positive' ? 'Positive' : 'Goofup'}
              </span>
            </Cell>
            <Cell title={e.description ?? e.title}>{e.title}</Cell>
            <Cell accent>{e.categoryName}</Cell>
            {/* Impact grades goofups; a positive has none to show. */}
            <Cell bold={hasImpact(e.type)} muted={!hasImpact(e.type)}>
              {impactLabel(e.type, e.severity)}
            </Cell>
            <Cell muted>{e.recordedBy}</Cell>
          </button>
        ))}
      </div>

      {/* Mobile: cards */}
      <div className="epi-cards-mobile">
        {rows.map((e) => (
          <button
            key={e.id}
            onClick={() => setOpen(e)}
            style={{
              ...cardStyle,
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              gap: '12px',
              color: 'var(--epi-fg)',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span style={iconStyle(e.type)}>{e.type === 'positive' ? '✓' : '⚠'}</span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.35 }}>{e.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--epi-accent-fg)' }}>{e.employeeName}</div>
              <div style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
                {e.categoryName}
                {hasImpact(e.type) ? ` · ${impactLabel(e.type, e.severity)} impact` : ''} ·{' '}
                {fmtFull(e.event_date)}
              </div>
            </div>
          </button>
        ))}
      </div>

      <span className="epi-scroll-hint">Swipe sideways to see all columns →</span>

      {open ? (
        <EventDetail
          event={open}
          close={() => setOpen(null)}
          categories={categories}
          currentAppUserId={currentAppUserId}
          isAdmin={isAdmin}
        />
      ) : null}
    </>
  )
}
