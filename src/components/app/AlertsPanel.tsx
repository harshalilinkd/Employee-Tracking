'use client'

import Link from 'next/link'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { initials } from '@/lib/design'

export interface Alert {
  id: string
  name: string
  reason: string
  load: number
  critical: number
}

/**
 * The attention panel.
 *
 * Built to stay readable when the list is long. With fifty people flagged a
 * flat scrolling list is unusable, so this shows only the worst few, ranks
 * criticals above heavy load, states the true total, and hands the rest to
 * the dashboard rather than pretending a dropdown can hold them.
 */
export function AlertsPanel({
  alerts,
  total,
  critical,
  onGo,
}: {
  alerts: Alert[]
  total: number
  critical: number
  onGo: () => void
}) {
  const peak = Math.max(1, ...alerts.map((a) => a.load))
  const rest = total - alerts.length

  return (
    <div
      role="dialog"
      aria-label="Needs attention"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 'min(344px, calc(100vw - 26px))',
        background: 'var(--epi-elev)',
        border: '1px solid var(--epi-border-2)',
        borderRadius: '13px',
        boxShadow: 'var(--epi-shadow-lg)',
        overflow: 'hidden',
        zIndex: 60,
        animation: 'epiModalIn 160ms cubic-bezier(0.2,0.8,0.2,1)',
      }}
    >
      <div style={{ padding: '13px 15px 12px', borderBottom: '1px solid var(--epi-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <AlertTriangle size={14} style={{ color: 'var(--epi-red)', flex: '0 0 14px' }} />
          <span style={{ fontSize: '13.5px', fontWeight: 700 }}>Needs attention</span>
          <span
            className="epi-num"
            style={{
              marginLeft: 'auto',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--epi-red)',
              background: 'var(--epi-red-bg)',
              border: '1px solid var(--epi-red-bd)',
              borderRadius: '999px',
              padding: '1px 9px',
            }}
          >
            {total}
          </span>
        </div>

        {/* The split matters more than the total: criticals get acted on
            today, heavy load is a conversation this week. */}
        {total > 0 ? (
          <div style={{ fontSize: '11.5px', color: 'var(--epi-fg-3)', marginTop: '6px' }}>
            {critical > 0 ? (
              <>
                <strong style={{ color: 'var(--epi-red)' }}>{critical} critical</strong>
                {total - critical > 0 ? ` · ${total - critical} on heavy load` : null}
              </>
            ) : (
              'All from issue load — no critical events'
            )}
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--epi-green)' }}>
            Nothing needs attention
          </div>
          <div style={{ fontSize: '12px', color: 'var(--epi-fg-2)', marginTop: '4px' }}>
            No critical or heavy issues in this period.
          </div>
        </div>
      ) : (
        <div>
          {alerts.map((a) => (
            <Link
              key={a.id}
              href={`/employees/${a.id}`}
              onClick={onGo}
              className="epi-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '28px minmax(0,1fr) 42px 14px',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 15px',
                borderBottom: '1px solid var(--epi-border-soft)',
                color: 'var(--epi-fg)',
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '999px',
                  background: a.critical > 0 ? 'var(--epi-red-bg)' : 'var(--epi-orange-bg)',
                  color: a.critical > 0 ? 'var(--epi-red)' : 'var(--epi-orange)',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {initials(a.name)}
              </span>

              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.name}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11.5px',
                    color: a.critical > 0 ? 'var(--epi-red)' : 'var(--epi-fg-3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.reason}
                </span>
              </span>

              {/* A bar under the figure, so rows rank by eye instead of by
                  reading every number in turn. */}
              <span style={{ textAlign: 'right' }}>
                <span
                  className="epi-num"
                  style={{ display: 'block', fontSize: '12px', fontWeight: 700, lineHeight: 1.2 }}
                >
                  {a.load.toFixed(1)}
                </span>
                <span
                  style={{
                    display: 'block',
                    height: '3px',
                    marginTop: '3px',
                    borderRadius: '999px',
                    background: 'var(--epi-track)',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${Math.max(10, (a.load / peak) * 100)}%`,
                      marginLeft: 'auto',
                      borderRadius: '999px',
                      background: a.critical > 0 ? 'var(--epi-red)' : 'var(--epi-orange)',
                    }}
                  />
                </span>
              </span>

              <ChevronRight size={14} style={{ color: 'var(--epi-fg-3)' }} />
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/#management-attention"
        onClick={onGo}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          height: '42px',
          fontSize: '12.5px',
          fontWeight: 600,
          color: 'var(--epi-teal)',
          textDecoration: 'none',
          background: 'var(--epi-canvas)',
          borderTop: total === 0 ? '1px solid var(--epi-border)' : 0,
        }}
      >
        {rest > 0 ? `View all ${total} on the dashboard` : 'Open the dashboard panel'}
        <ChevronRight size={14} />
      </Link>
    </div>
  )
}
