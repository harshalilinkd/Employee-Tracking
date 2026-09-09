'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Archive, Eye, Pencil, Trash2 } from 'lucide-react'
import { EventDetail, type DetailEvent } from './EventDetail'
import { RowMenu, type RowMenuItem } from './RowMenu'
import { cardStyle, iconStyle, pill, tableHeadStyle } from '@/lib/design'
import { fmtFull, fmtShort } from '@/lib/format'
import { hasImpact, impactLabel, type Category } from '@/lib/types'
import type { DetailMode } from './EventDetail'

const COLS =
  '92px minmax(140px,1.4fr) 100px minmax(230px,2.8fr) minmax(130px,1.3fr) 92px minmax(120px,1.1fr) 104px'
const HEADS = ['Date', 'Employee', 'Type', 'Event', 'Category', 'Impact', 'Recorded by', 'Actions']

/** What the row can offer, mirroring the pe_update policy exactly. */
const CORRECTION_WINDOW_HOURS = 48

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
  const [mode, setMode] = useState<DetailMode>('view')
  // Read once per mount rather than per render, so the 48-hour cutoff cannot
  // shift between one row and the next in the same paint.
  const [now] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()

  /**
   * Exactly the pe_update policy: Super Admin and Management may correct
   * anything, everyone else gets 48 hours on their own entries. Offering a
   * button the database would refuse is worse than not offering it, so the
   * two are disabled rather than hidden — an "Edit" that vanished would read
   * as a missing feature rather than a closed window.
   */
  const editable = (e: DetailEvent) =>
    e.status !== 'archived' &&
    (isAdmin ||
      (e.recorded_by === currentAppUserId &&
        (now - new Date(e.created_at).getTime()) / 36e5 < CORRECTION_WINDOW_HOURS))

  function open2(e: DetailEvent, m: DetailMode) {
    setMode(m)
    setOpen(e)
  }

  /** Deletes immediately, with no confirmation step, as asked. */
  async function removeEvent(e: DetailEvent) {
    setError('')
    setBusy(e.id)
    const supabase = createClient()
    const { error: err } = await supabase.from('performance_events').delete().eq('id', e.id)
    setBusy(null)

    if (err) {
      // The likeliest cause is the pe_delete policy not being in place yet,
      // which reads as a plain RLS refusal rather than anything more useful.
      return setError(
        err.message.includes('row-level security') || err.message.includes('violates')
          ? `${e.event_ref} was not deleted — only Super Admin and Management can delete records.`
          : `${e.event_ref} was not deleted — ${err.message}`,
      )
    }
    router.refresh()
  }

  /**
   * One menu definition, used by the table and the cards so the two can
   * never offer different actions for the same record.
   *
   * Nothing is hidden — unavailable actions are greyed with the reason,
   * because a Delete that simply is not there reads as a missing feature
   * rather than as a permission you do not hold.
   */
  function menuFor(e: DetailEvent): RowMenuItem[] {
    const canCorrect = editable(e)
    const closed = `Corrections close ${CORRECTION_WINDOW_HOURS} hours after recording`
    return [
      { label: 'View', icon: <Eye size={14} />, onSelect: () => open2(e, 'view') },
      {
        label: 'Edit',
        icon: <Pencil size={14} />,
        disabled: !canCorrect,
        reason: closed,
        onSelect: () => open2(e, 'edit'),
      },
      {
        label: 'Archive',
        icon: <Archive size={14} />,
        disabled: !canCorrect,
        reason: closed,
        onSelect: () => open2(e, 'archive'),
      },
      {
        label: 'Delete',
        icon: <Trash2 size={14} />,
        danger: true,
        disabled: !isAdmin,
        reason: 'Only Super Admin and Management can permanently delete a record',
        onSelect: () => removeEvent(e),
      },
    ]
  }

  return (
    <>
      {error ? (
        <div
          role="alert"
          style={{
            ...cardStyle,
            padding: '11px 15px',
            marginBottom: '10px',
            fontSize: '13.5px',
            color: 'var(--epi-red)',
            borderColor: 'var(--epi-red-bd)',
            background: 'var(--epi-red-bg)',
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Desktop: full gridlines, every cell bordered */}
      <div className="epi-table-desktop epi-scroll-x" style={{ ...cardStyle, overflow: 'hidden', overflowX: 'auto' }}>
        <div className="epi-xls-head" style={{ minWidth: '1104px', display: 'grid', gridTemplateColumns: COLS }}>
          {HEADS.map((h) => (
            <span key={h} style={{ ...tableHeadStyle, padding: '10px 13px' }}>
              {h}
            </span>
          ))}
        </div>

        {rows.map((e) => (
          /* A div, not a button: the row now holds its own action buttons and
             a button cannot legally nest inside another. The row keeps its
             click-to-open behaviour and stays keyboard reachable. */
          <div
            key={e.id}
            role="button"
            tabIndex={0}
            onClick={() => open2(e, 'view')}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault()
                open2(e, 'view')
              }
            }}
            className="epi-row epi-xls"
            style={{
              minWidth: '1104px',
              width: '100%',
              display: 'grid',
              gridTemplateColumns: COLS,
              alignItems: 'center',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--epi-fg)',
              opacity: busy === e.id ? 0.45 : 1,
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

            <span
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <RowMenu label={`Actions for ${e.title}`} items={menuFor(e)} />
            </span>
          </div>
        ))}
      </div>

      {/* Mobile: cards */}
      <div className="epi-cards-mobile">
        {rows.map((e) => (
          <div
            key={e.id}
            style={{
              ...cardStyle,
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              gap: '12px',
              color: 'var(--epi-fg)',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span style={iconStyle(e.type)}>{e.type === 'positive' ? '✓' : '⚠'}</span>
            {/* Tapping the card body still opens the record — the kebab is the
                affordance, not the only way in. */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => open2(e, 'view')}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  open2(e, 'view')
                }
              }}
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.35 }}>{e.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--epi-accent-fg)' }}>{e.employeeName}</div>
              <div style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
                {e.categoryName}
                {hasImpact(e.type) ? ` · ${impactLabel(e.type, e.severity)} impact` : ''} ·{' '}
                {fmtFull(e.event_date)}
              </div>
            </div>

            <span style={{ flex: '0 0 auto' }}>
              <RowMenu label={`Actions for ${e.title}`} items={menuFor(e)} />
            </span>
          </div>
        ))}
      </div>

      <span className="epi-scroll-hint">Swipe sideways to see all columns →</span>

      {open ? (
        <EventDetail
          event={open}
          initialMode={mode}
          close={() => setOpen(null)}
          categories={categories}
          currentAppUserId={currentAppUserId}
          isAdmin={isAdmin}
        />
      ) : null}
    </>
  )
}
