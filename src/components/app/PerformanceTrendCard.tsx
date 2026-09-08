'use client'

import { useState } from 'react'
import { Activity } from 'lucide-react'
import { cardStyle } from '@/lib/design'

export interface TrendPoint {
  label: string
  pos: number
  goof: number
}

const WINDOWS = [
  { months: 3, label: 'Last 3 months' },
  { months: 6, label: 'Last 6 months' },
  { months: 12, label: 'Last 12 months' },
]

const PLOT = 108

/**
 * Recognition against issues, month by month, for one person.
 *
 * Counts rather than weighted load: this chart answers "how often", and the
 * weighting already has two homes — the signal band above and the heat table
 * below. Three scales of the same thing on one screen would invite the reader
 * to compare numbers that are not comparable.
 *
 * The window always includes the current month, because that is where today's
 * events are; "last 3 months" with the current one missing would hide the
 * only column that can still change.
 */
export function PerformanceTrendCard({ points }: { points: TrendPoint[] }) {
  const [months, setMonths] = useState(3)
  const shown = points.slice(-(months + 1))

  // A three-step axis, rounded so the labels are whole numbers. The floor of
  // three keeps a single event from filling the plot to the ceiling.
  const peak = Math.max(1, ...shown.flatMap((p) => [p.pos, p.goof]))
  const step = Math.ceil(peak / 3)
  const top = step * 3
  const ticks = [top, step * 2, step, 0]

  return (
    <section style={{ ...cardStyle, padding: '17px 19px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '3px' }}>
        <span
          style={{
            width: '30px',
            height: '30px',
            flex: '0 0 30px',
            borderRadius: '9px',
            background: 'var(--epi-teal-bg)',
            color: 'var(--epi-teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Activity size={16} />
        </span>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.015em' }}>
          Performance Trend
        </h2>

        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          aria-label="Trend window"
          style={{
            marginLeft: 'auto',
            height: '30px',
            minHeight: '30px',
            borderRadius: '8px',
            background: 'var(--epi-input)',
            border: '1px solid var(--epi-border-2)',
            color: 'var(--epi-fg-2)',
            fontSize: '12px',
            fontWeight: 600,
            padding: '0 6px',
            outline: 'none',
            flex: '0 0 auto',
          }}
        >
          {WINDOWS.map((w) => (
            <option key={w.months} value={w.months}>
              {w.label}
            </option>
          ))}
        </select>
      </div>

      <p style={{ margin: '0 0 16px 41px', fontSize: '12px', color: 'var(--epi-fg-3)' }}>
        Recognition and issues volume, month by month
      </p>

      <div style={{ display: 'flex', gap: '9px' }}>
        {/* Axis labels sit outside the plot so the bars keep the full width */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: `${PLOT}px`,
            flex: '0 0 auto',
          }}
        >
          {ticks.map((t) => (
            <span key={t} className="epi-num" style={{ fontSize: '10.5px', color: 'var(--epi-fg-3)', lineHeight: 1 }}>
              {t}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', height: `${PLOT}px` }}>
            {ticks.map((t) => (
              <span
                key={t}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${((top - t) / top) * PLOT}px`,
                  height: '1px',
                  background: 'var(--epi-border-soft)',
                }}
              />
            ))}

            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-around',
                gap: '6px',
              }}
            >
              {shown.map((p) => (
                <span
                  key={p.label}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: '3px',
                  }}
                >
                  {/* Zero draws nothing — an empty month should read as empty,
                      not as a sliver that might be a rounding artefact. */}
                  {([
                    ['pos', p.pos, 'var(--epi-green)'],
                    ['goof', p.goof, 'var(--epi-orange)'],
                  ] as const).map(([k, v, colour]) =>
                    v > 0 ? (
                      <span
                        key={k}
                        title={`${p.label} · ${v} ${k === 'pos' ? 'recognition' : 'goofup'}${v === 1 ? '' : 's'}`}
                        style={{
                          width: '15px',
                          maxWidth: '46%',
                          height: `${Math.max(4, (v / top) * PLOT)}px`,
                          borderRadius: '4px 4px 0 0',
                          background: colour,
                        }}
                      />
                    ) : null,
                  )}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-around', gap: '6px', marginTop: '7px' }}>
            {shown.map((p) => (
              <span
                key={p.label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'var(--epi-fg-3)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingLeft: '29px' }}>
        {[
          ['Recognitions', 'var(--epi-green)'],
          ['Goofups', 'var(--epi-orange)'],
        ].map(([label, colour]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--epi-fg-3)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: colour }} />
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
