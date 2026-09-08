import Link from 'next/link'
import { avatarStyle, cardStyle, initials, pill, tableHeadStyle } from '@/lib/design'

export interface AttentionRow {
  id: string
  name: string
  dept: string
  band: 'Attention' | 'Watch'
  reason: string
  issueLoad: number
}

const COLS = 'minmax(150px, 2fr) minmax(110px, 1fr) minmax(105px, 1.2fr)'

/**
 * Only the people a manager has to do something about.
 *
 * An earlier version charted the whole band distribution, but with 56 of 57
 * employees unscored the bar was 98% grey and said nothing. "No signal" is
 * not a management concern — it means nobody has recorded anything yet.
 *
 * Laid out as a table with the same header treatment as the performance
 * matrix beside it, so the two columns read as a matched pair rather than
 * a table next to a card. The headline count lives in the section header
 * badge; repeating it as a 30px numeral inside the card only made the panel
 * look padded out.
 */
export function AttentionPanel({ rows }: { rows: AttentionRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.issueLoad))
  const attention = rows.filter((r) => r.band === 'Attention').length
  const watch = rows.length - attention

  return (
    <section style={{ minWidth: 0 }}>
      <div
        className="epi-section-head epi-attention-head"
        style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '36px', marginBottom: '12px' }}
      >
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, letterSpacing: '-0.018em' }}>
          Management Attention
        </h2>
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
            background: rows.length ? 'var(--epi-red-bg)' : 'var(--epi-track)',
            color: rows.length ? 'var(--epi-red)' : 'var(--epi-fg-3)',
            border: `1px solid ${rows.length ? 'var(--epi-red-bd)' : 'var(--epi-border)'}`,
          }}
        >
          {rows.length}
        </span>

        {rows.length ? (
          <span className="epi-head-meta" style={{ fontSize: '13px', color: 'var(--epi-fg-3)' }}>
            {attention} needing action{watch ? ` · ${watch} on watch` : ''}
          </span>
        ) : null}

        {rows.length ? (
          <Link
            href="/performance?type=goofup"
            className="epi-head-link"
            style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 600 }}
          >
            View all →
          </Link>
        ) : null}
      </div>

      <div className="epi-table-desktop epi-scroll-x" style={{ ...cardStyle, overflow: 'hidden', overflowX: 'auto' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--epi-green)' }}>Nothing needs attention</div>
            <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)', marginTop: '5px' }}>
              No critical, repeated or high-load issues in this period.
            </div>
          </div>
        ) : (
          <>
            <div
              className="epi-grid-table epi-grid-table-head"
              style={{ minWidth: '308px', display: 'grid', gridTemplateColumns: COLS, ...tableHeadStyle }}
            >
              <span>Employee</span>
              <span>Issue load</span>
              <span>Reason</span>
            </div>

            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/employees/${r.id}`}
                className="epi-row epi-grid-table"
                style={{
                  minWidth: '308px',
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  alignItems: 'center',
                  color: 'var(--epi-fg)',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                  <span style={avatarStyle(30)}>{initials(r.name)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        color: 'var(--epi-fg-3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.dept}
                    </span>
                  </span>
                </span>

                {/* Severity as a figure plus a bar, so rows can be ranked at a
                    glance and still read exactly. The track needs its own
                    wrapper: as a bare grid cell its background painted the
                    cell's whole padding box and swallowed the fill. */}
                <span style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                  <span
                    className="epi-num"
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: r.band === 'Attention' ? 'var(--epi-red)' : 'var(--epi-orange)',
                    }}
                  >
                    {r.issueLoad.toFixed(1)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: '34px',
                      height: '6px',
                      borderRadius: '999px',
                      background: 'var(--epi-track)',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${Math.max(6, (r.issueLoad / max) * 100)}%`,
                        borderRadius: '999px',
                        background: r.band === 'Attention' ? 'var(--epi-red)' : 'var(--epi-orange)',
                      }}
                    />
                  </span>
                </span>

                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      ...pill(r.band === 'Attention' ? 'red' : 'orange'),
                      textTransform: 'none',
                      letterSpacing: 0,
                      fontSize: '11.5px',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={r.reason}
                  >
                    {r.reason}
                  </span>
                </span>
              </Link>
            ))}
          </>
        )}
      </div>

      {/* On a phone the three-column table pushed the reason off-screen, so
          the one column a manager actually acts on was the one you had to
          swipe for. One card per person instead: the reason reads in full and
          the load bar gets the whole width. */}
      <div className="epi-cards-mobile">
        {rows.length === 0 ? (
          <div style={{ ...cardStyle, padding: '26px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--epi-green)' }}>Nothing needs attention</div>
            <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)', marginTop: '5px' }}>
              No critical, repeated or high-load issues in this period.
            </div>
          </div>
        ) : (
          rows.map((r) => {
            const tone = r.band === 'Attention' ? 'red' : 'orange'
            return (
              <Link
                key={r.id}
                href={`/employees/${r.id}`}
                style={{
                  ...cardStyle,
                  borderRadius: '14px',
                  padding: '14px 15px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  color: 'var(--epi-fg)',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'flex', gap: '11px', alignItems: 'center', minWidth: 0 }}>
                  <span style={avatarStyle(36)}>{initials(r.name)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '15px', fontWeight: 700 }}>{r.name}</span>
                    <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>{r.dept}</span>
                  </span>
                  <span
                    style={{
                      ...pill(tone),
                      textTransform: 'none',
                      letterSpacing: 0,
                      fontSize: '11px',
                      flex: '0 0 auto',
                    }}
                  >
                    {r.band}
                  </span>
                </span>

                <span
                  style={{
                    fontSize: '13.5px',
                    color: `var(--epi-${tone})`,
                    fontWeight: 600,
                    lineHeight: 1.35,
                  }}
                >
                  {r.reason}
                </span>

                <span style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>Issue load</span>
                    <span
                      className="epi-num"
                      style={{ fontSize: '14px', fontWeight: 700, color: `var(--epi-${tone})` }}
                    >
                      {r.issueLoad.toFixed(1)}
                    </span>
                  </span>
                  <span
                    style={{
                      height: '7px',
                      borderRadius: '999px',
                      background: 'var(--epi-track)',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${Math.max(6, (r.issueLoad / max) * 100)}%`,
                        borderRadius: '999px',
                        background: `var(--epi-${tone})`,
                      }}
                    />
                  </span>
                </span>
              </Link>
            )
          })
        )}
      </div>
    </section>
  )
}
