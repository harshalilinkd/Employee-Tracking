import Link from 'next/link'
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock,
  Lightbulb,
  Scale,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import { ManagementNotes } from './ManagementNotes'
import { PerformanceTrendCard, type TrendPoint } from './PerformanceTrendCard'
import { cardStyle, pill, tableHeadStyle } from '@/lib/design'

export type Tone = 'green' | 'orange' | 'red' | 'blue' | 'teal'

export interface OverviewEvent {
  id: string
  date: string
  type: 'positive' | 'goofup'
  title: string
  category: string
  impact: string
  impactTone: Tone
  recordedBy: string
}

export interface HeatCell {
  label: string
  load: number
  count: number
}

export interface InsightRow {
  icon: 'alert' | 'calendar' | 'trend' | 'target'
  tone: Tone
  head: string
  sub: string
  href: string
}

interface Props {
  employeeId: string
  employeeName: string
  department: string
  designation: string
  positives: number
  goofups: number
  lastActivity: string
  lastActivitySub: string
  recognitionSub: string
  goofupSub: string
  trend: TrendPoint[]
  events: OverviewEvent[]
  heat: HeatCell[]
  insights: InsightRow[]
  mayNote: boolean
  currentAppUserId: string
}

/* ------------------------------------------------------------------ */
/* Shared card chrome — one header treatment for every panel here      */
/* ------------------------------------------------------------------ */

function Head({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: subtitle ? '3px' : '14px' }}>
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
          {icon}
        </span>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.015em' }}>{title}</h2>
        {right ? <span style={{ marginLeft: 'auto', flex: '0 0 auto' }}>{right}</span> : null}
      </div>
      {subtitle ? (
        <p style={{ margin: '0 0 15px 41px', fontSize: '12px', color: 'var(--epi-fg-3)' }}>{subtitle}</p>
      ) : null}
    </>
  )
}

const ICONS = {
  alert: AlertTriangle,
  calendar: CalendarDays,
  trend: TrendingUp,
  target: Scale,
}

/* ------------------------------------------------------------------ */

export function ProfileOverview({
  employeeId,
  employeeName,
  department,
  designation,
  positives,
  goofups,
  lastActivity,
  lastActivitySub,
  recognitionSub,
  goofupSub,
  trend,
  events,
  heat,
  insights,
  mayNote,
  currentAppUserId,
}: Props) {
  const net = positives - goofups
  const heatMax = Math.max(1, ...heat.map((h) => h.load))
  const heatTotal = heat.reduce((a, h) => a + h.load, 0)

  const tiles: { icon: React.ReactNode; label: string; value: string; sub: string; tone: Tone }[] = [
    { icon: <Star size={14} />, label: 'Recognition', value: String(positives), sub: recognitionSub, tone: 'green' },
    { icon: <AlertTriangle size={14} />, label: 'Goofups', value: String(goofups), sub: goofupSub, tone: 'orange' },
    {
      icon: <Scale size={14} />,
      label: 'Net Balance',
      value: net > 0 ? `+${net}` : String(net),
      // The sign is the whole message, so it is spelled out rather than left
      // for the reader to infer from a minus.
      sub: net < 0 ? 'issues ahead' : net > 0 ? 'recognition ahead' : 'evenly balanced',
      tone: net < 0 ? 'red' : net > 0 ? 'green' : 'blue',
    },
    { icon: <Clock size={14} />, label: 'Last Activity', value: lastActivity, sub: lastActivitySub, tone: 'blue' },
  ]

  const EV_COLS = '110px 96px minmax(160px,2.2fr) minmax(110px,1fr) 104px minmax(120px,1.1fr)'
  const HEAT_COLS = `minmax(140px,1.5fr) repeat(${heat.length},minmax(46px,1fr)) 68px`

  return (
    <div className="epi-ov">
      <div className="epi-ov-main">
        {/* ---------- Performance Summary ---------- */}
        {/* The tile count follows this card's own width, not the window's —
            see .epi-ov-summary. Four across only fits when the card is wide,
            and the card's width depends on two enclosing grids. */}
        <section className="epi-ov-summary" style={{ ...cardStyle, padding: '17px 19px' }}>
          <Head
            icon={<TrendingUp size={16} />}
            title="Performance Summary"
            subtitle="Key metrics from the selected period"
          />
          <div className="epi-ov-tiles">
            {tiles.map((t) => (
              <div
                key={t.label}
                style={{
                  borderRadius: '13px',
                  padding: '13px 14px',
                  background: `var(--epi-${t.tone}-bg)`,
                  border: `1px solid var(--epi-${t.tone}-bd)`,
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      flex: '0 0 24px',
                      borderRadius: '7px',
                      background: 'var(--epi-surface)',
                      color: `var(--epi-${t.tone})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {t.icon}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--epi-fg-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.label}
                  </span>
                </div>
                <div
                  className="epi-num"
                  style={{
                    fontSize: '25px',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                    color: `var(--epi-${t.tone})`,
                  }}
                >
                  {t.value}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--epi-fg-3)', marginTop: '3px' }}>{t.sub}</div>
              </div>
            ))}
          </div>
        </section>

        <PerformanceTrendCard points={trend} />

        {/* ---------- Detailed Events ---------- */}
        <section className="epi-ov-wide" style={{ ...cardStyle, padding: '17px 19px', overflow: 'hidden' }}>
          <Head icon={<CalendarDays size={16} />} title="Detailed Events" />

          {events.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--epi-fg-3)' }}>
              Nothing recorded for {employeeName} yet.
            </p>
          ) : (
            <div className="epi-scroll-x" style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: '760px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: EV_COLS,
                    gap: '10px',
                    padding: '9px 11px',
                    borderRadius: '9px',
                    background: 'var(--epi-canvas)',
                    border: '1px solid var(--epi-border-soft)',
                  }}
                >
                  {['Date', 'Type', 'Event', 'Category', 'Impact', 'Recorded by'].map((h) => (
                    <span key={h} style={tableHeadStyle}>
                      {h}
                    </span>
                  ))}
                </div>

                {events.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: EV_COLS,
                      gap: '10px',
                      alignItems: 'center',
                      padding: '11px',
                      borderBottom: '1px solid var(--epi-border-soft)',
                    }}
                  >
                    <span className="epi-num" style={{ fontSize: '12.5px', color: 'var(--epi-fg-2)' }}>
                      {e.date}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={pill(e.type === 'positive' ? 'green' : 'orange')}>
                        {e.type === 'positive' ? 'Positive' : 'Goofup'}
                      </span>
                    </span>
                    <span
                      title={e.title}
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.title}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          ...pill('blue'),
                          textTransform: 'none',
                          letterSpacing: 0,
                          fontSize: '11.5px',
                          maxWidth: '100%',
                          display: 'inline-block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={e.category}
                      >
                        {e.category}
                      </span>
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          ...pill(e.impactTone),
                          textTransform: 'none',
                          letterSpacing: 0,
                          fontSize: '11.5px',
                        }}
                      >
                        {e.impact}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--epi-fg-2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.recordedBy}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---------- Issue heat ---------- */}
        <section className="epi-ov-wide" style={{ ...cardStyle, padding: '17px 19px', overflow: 'hidden' }}>
          <Head
            icon={<Users size={16} />}
            title="Issue Heat by Employee"
            subtitle="Weighted goofup load per month — darker is heavier"
          />

          <div className="epi-scroll-x" style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '560px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: HEAT_COLS, gap: '7px', alignItems: 'center' }}>
                <span />
                {heat.map((h) => (
                  <span key={h.label} style={{ ...tableHeadStyle, textAlign: 'center' }}>
                    {h.label}
                  </span>
                ))}
                <span style={{ ...tableHeadStyle, textAlign: 'center' }}>Load</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: HEAT_COLS, gap: '7px', alignItems: 'center' }}>
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
                    {employeeName}
                  </span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--epi-fg-3)' }}>
                    {designation === '—' ? department : designation}
                  </span>
                </span>

                {heat.map((h) => {
                  const intensity = h.load / heatMax
                  return (
                    <span
                      key={h.label}
                      title={`${h.label} · ${h.count} goofup${h.count === 1 ? '' : 's'}, weighted load ${h.load.toFixed(1)}`}
                      style={{
                        height: '32px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: h.load === 0 ? 'var(--epi-fg-3)' : intensity > 0.55 ? '#5c2d00' : 'var(--epi-fg-2)',
                        background:
                          h.load === 0 ? 'var(--epi-track)' : `rgba(245,158,11,${(0.18 + intensity * 0.62).toFixed(2)})`,
                        border:
                          h.load === 0 ? '1px solid var(--epi-border-soft)' : '1px solid rgba(245,158,11,0.34)',
                      }}
                    >
                      {h.count || '–'}
                    </span>
                  )
                })}

                <span
                  className="epi-num"
                  style={{ fontSize: '13px', fontWeight: 700, textAlign: 'center', color: 'var(--epi-fg-2)' }}
                >
                  {heatTotal.toFixed(1)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={tableHeadStyle}>Lighter</span>
                <span
                  style={{
                    flex: '0 1 170px',
                    height: '7px',
                    borderRadius: '999px',
                    background:
                      'linear-gradient(90deg,rgba(245,158,11,0.16),rgba(245,158,11,0.50),rgba(245,158,11,0.82))',
                  }}
                />
                <span style={tableHeadStyle}>Heavier</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--epi-fg-3)' }}>
                  * severity-weighted, not a raw count
                </span>
              </div>
            </div>
          </div>
          <span className="epi-scroll-hint">Swipe sideways to see every month →</span>
        </section>
      </div>

      {/* ---------- Side column ---------- */}
      <div className="epi-ov-side">
        <section style={{ ...cardStyle, padding: '17px 19px' }}>
          <Head icon={<Lightbulb size={16} />} title="Quick Insights" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {insights.map((ins, i) => {
              const Icon = ICONS[ins.icon]
              return (
                <Link
                  key={i}
                  href={ins.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '11px',
                    padding: '11px 12px',
                    borderRadius: '11px',
                    border: '1px solid var(--epi-border)',
                    background: 'var(--epi-canvas)',
                    color: 'var(--epi-fg)',
                    textDecoration: 'none',
                  }}
                >
                  <span
                    style={{
                      width: '30px',
                      height: '30px',
                      flex: '0 0 30px',
                      borderRadius: '9px',
                      background: `var(--epi-${ins.tone}-bg)`,
                      color: `var(--epi-${ins.tone})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={15} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, lineHeight: 1.35 }}>
                      {ins.head}
                    </span>
                    <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--epi-fg-3)', marginTop: '2px' }}>
                      {ins.sub}
                    </span>
                  </span>
                  <ChevronRight size={15} style={{ color: 'var(--epi-fg-3)', flex: '0 0 15px' }} />
                </Link>
              )
            })}
          </div>
        </section>

        {mayNote ? (
          <ManagementNotes
            employeeId={employeeId}
            employeeName={employeeName}
            currentAppUserId={currentAppUserId}
            compact
          />
        ) : null}
      </div>
    </div>
  )
}
