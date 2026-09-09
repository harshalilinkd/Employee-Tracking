import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Clock,
  Eye,
  FileText,
  Lightbulb,
  Shield,
  Star,
  MessageSquare,
  Table2,
  Target,
  TrendingUp,
  User,
  UserRound,
} from 'lucide-react'

/**
 * The submitted report.
 *
 * This is a document, not an app screen, so it deliberately does not use the
 * app's theme tokens: it renders identically in light and dark mode and on
 * paper. Colours are literal hex for that reason.
 */

const INK = '#000000'
const TEAL = '#12645a'
const MUTED = '#3d3d3d'
const LINE = '#e2e7e4'

const TONE = {
  green: { fg: '#2e9e6b', bg: '#e8f5ee', bd: '#cfe9dc' },
  amber: { fg: '#d99a24', bg: '#fdf5e4', bd: '#f5e3bd' },
  red: { fg: '#dd5a51', bg: '#fdedec', bd: '#f7d3d1' },
  blue: { fg: '#3d7fd4', bg: '#eaf2fc', bd: '#cfe0f6' },
} as const

type ToneKey = keyof typeof TONE

export interface DocEvent {
  id: string
  date: string
  type: 'positive' | 'goofup'
  title: string
  category: string
  impact: string
  /** Null for a positive contribution, which has no impact grade. */
  impactTone: ToneKey | null
  recordedBy: string
}

export interface DocInsight {
  icon: 'alert' | 'calendar' | 'trend' | 'target'
  tone: ToneKey
  head: React.ReactNode
  sub: string
}

export function ReportDocument({
  generated,
  name,
  initials,
  code,
  designation,
  department,
  manager,
  joined,
  band,
  bandTone,
  periodLabel,
  kpis,
  months,
  events,
  insights,
  summary,
  preparedBy,
}: {
  generated: string
  name: string
  initials: string
  code: string
  designation: string
  department: string
  manager: string
  joined: string
  band: string
  bandTone: ToneKey
  periodLabel: string
  kpis: { label: string; value: string; note: string; tone: ToneKey; icon: 'user' | 'star' | 'alert' | 'clock' }[]
  months: { label: string; pos: number; goof: number }[]
  events: DocEvent[]
  insights: DocInsight[]
  summary: string[]
  preparedBy: string
}) {
  return (
    <div className="epi-doc" style={{ background: '#fff', color: INK }}>
      {/* ---------------- masthead ---------------- */}
      <div
        className="epi-doc-mast"
        style={{
          background: 'linear-gradient(100deg,#0a2723 0%,#0f3b33 55%,#12463c 100%)',
          color: '#fff',
          padding: '15px 26px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '25px', fontWeight: 800, letterSpacing: '0.02em', lineHeight: 1 }}>LD</span>
          <span style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.34)' }} />
          <span style={{ fontSize: '19px', fontWeight: 400, letterSpacing: '0.18em' }}>SILK MILLS</span>
        </span>

        <span
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '10.5px',
            letterSpacing: '0.16em',
            color: 'rgba(255,255,255,0.82)',
          }}
        >
          <span className="epi-doc-nav">PEOPLE&nbsp; / &nbsp;PROCESS&nbsp; / &nbsp;PERFORMANCE</span>
          <span style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.24)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: '7px', letterSpacing: 0, fontSize: '11.5px' }}>
            <Calendar size={13} />
            {generated}
          </span>
        </span>
      </div>

      <div className="epi-doc-body" style={{ padding: '18px 22px 0' }}>
        {/* ---------------- hero ---------------- */}
        <div
          className="epi-doc-hero"
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '12px',
            border: `1px solid ${LINE}`,
            background: 'linear-gradient(105deg,#f8f4ec 0%,#f2ece0 62%,#efe8da 100%)',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
          }}
        >
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.19em', color: TEAL }}>
              EMPLOYEE PERFORMANCE REPORT
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '11px' }}>
              <span
                style={{
                  width: '58px',
                  height: '58px',
                  flex: '0 0 58px',
                  borderRadius: '999px',
                  background: 'linear-gradient(140deg,#2f6f63,#1d5049)',
                  color: '#fff',
                  fontSize: '20px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {initials}
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  className="epi-doc-hero-name"
                  style={{
                    display: 'block',
                    fontSize: '26px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  {name}
                </span>
                <span style={{ display: 'block', fontSize: '14px', color: '#2b2b2b', marginTop: '3px' }}>
                  {designation} &nbsp;•&nbsp; {department}
                </span>
              </span>
            </div>

            <div className="epi-doc-facts" style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
              <MetaFact icon={<FileText size={13} />} label="Code" value={code} />
              <Divider />
              <MetaFact icon={<FileText size={13} />} label="Reports to" value={manager} />
              <Divider />
              <MetaFact icon={<Calendar size={13} />} label="Joined" value={joined} />
            </div>
          </div>

          <div
            className="epi-doc-signal"
            style={{
              flex: '0 0 auto',
              borderRadius: '11px',
              border: `1px solid ${TONE[bandTone].bd}`,
              background: TONE[bandTone].bg,
              padding: '13px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '11px',
            }}
          >
            <span
              style={{
                width: '30px',
                height: '30px',
                flex: '0 0 30px',
                borderRadius: '999px',
                background: '#fff',
                color: TONE[bandTone].fg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={18} />
            </span>
            <span>
              <span
                style={{
                  display: 'block',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.19em',
                  color: TONE[bandTone].fg,
                }}
              >
                SIGNAL
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: TONE[bandTone].fg,
                  lineHeight: 1.25,
                }}
              >
                {band}
              </span>
            </span>
          </div>
        </div>

        {/* ---------------- key metrics ---------------- */}
        <SectionRule title="KEY METRICS" right={<span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><Calendar size={13} color={MUTED} />{periodLabel}</span>} />

        <div className="epi-doc-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px' }}>
          {kpis.map((k) => (
            <div
              key={k.label}
              style={{
                borderRadius: '11px',
                border: `1px solid ${TONE[k.tone].bd}`,
                background: TONE[k.tone].bg,
                padding: '14px 15px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '30px',
                    height: '30px',
                    flex: '0 0 30px',
                    borderRadius: '999px',
                    background: '#fff',
                    color: TONE[k.tone].fg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {k.icon === 'user' ? (
                    <UserRound size={16} />
                  ) : k.icon === 'star' ? (
                    <Star size={16} />
                  ) : k.icon === 'alert' ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <Clock size={16} />
                  )}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: '#2b2b2b' }}>
                  {k.label}
                </span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.03em', marginTop: '9px' }}>
                {k.value}
              </div>
              <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '5px' }}>{k.note}</div>
            </div>
          ))}
        </div>

        {/* ---------------- chart + insights ---------------- */}
        <div className="epi-doc-split" style={{ display: 'grid', gridTemplateColumns: '1.32fr 1fr', gap: '15px', marginTop: '17px' }}>
          <Card>
            <CardHead
              icon={<TrendingUp size={15} />}
              title="ACTIVITY OVER TIME"
              right={<span style={{ fontSize: '11.5px', color: MUTED }}>Events per month</span>}
            />
            <MonthChart months={months} />
            <div style={{ display: 'flex', gap: '18px', marginTop: '12px', fontSize: '11.5px', color: '#1a1a1a' }}>
              <Dot colour="#3d7fd4" label="Recognitions" />
              <Dot colour="#e0a52e" label="Goofups" />
            </div>
          </Card>

          <div
            style={{
              borderRadius: '12px',
              border: '1px solid #d8ebe1',
              background: 'linear-gradient(160deg,#eef8f2 0%,#e9f4ee 100%)',
              padding: '15px 17px',
            }}
          >
            <CardHead icon={<Lightbulb size={15} />} title="QUICK INSIGHTS" />
            <div style={{ marginTop: '3px' }}>
              {insights.map((ins, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '11px',
                    padding: '10px 0',
                    borderTop: i === 0 ? 0 : '1px solid #d8e9df',
                  }}
                >
                  <span style={{ color: TONE[ins.tone].fg, flex: '0 0 auto', marginTop: '1px' }}>
                    {ins.icon === 'alert' ? (
                      <AlertCircle size={15} />
                    ) : ins.icon === 'calendar' ? (
                      <Calendar size={15} />
                    ) : ins.icon === 'trend' ? (
                      <TrendingUp size={15} />
                    ) : (
                      <Target size={15} />
                    )}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600 }}>{ins.head}</span>
                    <span style={{ display: 'block', fontSize: '11.5px', color: MUTED, marginTop: '2px' }}>
                      {ins.sub}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---------------- detailed events ---------------- */}
        <div style={{ marginTop: '17px' }}>
          <Card>
            <CardHead
              icon={<Table2 size={15} />}
              title="DETAILED EVENTS"
              right={
                <span style={{ fontSize: '11.5px', color: MUTED }}>
                  {events.length} recorded
                </span>
              }
            />
            <div className="epi-doc-table" style={{ border: `1px solid ${LINE}`, borderRadius: '9px', overflow: 'hidden' }}>
              <div style={{ ...EV_ROW, background: '#f6f8f7', borderBottom: `1px solid ${LINE}` }}>
                {['DATE', 'TYPE', 'EVENT', 'CATEGORY', 'IMPACT', 'RECORDED BY'].map((h) => (
                  <span
                    key={h}
                    style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.13em', color: '#2b2b2b' }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {events.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: MUTED }}>
                  No events recorded in this period.
                </div>
              ) : (
                events.map((e, i) => (
                  <div
                    key={e.id}
                    style={{ ...EV_ROW, borderTop: i === 0 ? 0 : `1px solid ${LINE}`, fontSize: '12.5px' }}
                  >
                    <span>{e.date}</span>
                    <span>
                      <Chip tone={e.type === 'positive' ? 'green' : 'amber'} caps>
                        {e.type === 'positive' ? 'POSITIVE' : 'GOOFUP'}
                      </Chip>
                    </span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.title}
                    </span>
                    <span>
                      <Chip tone="blue">{e.category}</Chip>
                    </span>
                    <span>
                      {/* Positives carry no impact grade — a dash, not a chip. */}
                      {e.impactTone ? (
                        <Chip tone={e.impactTone}>{e.impact}</Chip>
                      ) : (
                        <span style={{ color: MUTED }}>{e.impact}</span>
                      )}
                    </span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.recordedBy}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* ---------------- assessment ----------------
             Screen only. It is the most compressible block on the page and
             dropping it is what lets the printed report fit one sheet, but
             it is worth reading on screen. */}
        <div className="epi-print-hide" style={{ marginTop: '17px' }}>
          <Card>
            <CardHead icon={<Target size={15} />} title="ASSESSMENT" />
            <div
              style={{
                background: '#f6f9f8',
                border: `1px solid ${LINE}`,
                borderLeft: `3px solid ${TEAL}`,
                borderRadius: '8px',
                padding: '13px 15px',
                display: 'flex',
                gap: '12px',
              }}
            >
              <span style={{ color: TEAL, flex: '0 0 auto', marginTop: '1px' }}>
                <MessageSquare size={16} />
              </span>
              <span>
                {summary.map((line, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'block',
                      fontSize: i === 0 ? '13px' : '12.5px',
                      fontWeight: i === 0 ? 700 : 400,
                      color: i === 0 ? INK : '#1a1a1a',
                      marginTop: i === 0 ? 0 : '6px',
                      lineHeight: 1.55,
                    }}
                  >
                    {line}
                  </span>
                ))}
              </span>
            </div>
          </Card>
        </div>

        {/* ---------------- signatures ---------------- */}
        <div
          style={{
            marginTop: '17px',
            borderRadius: '12px',
            border: `1px solid ${LINE}`,
            background: '#fbfcfb',
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
          }}
          className="epi-doc-sign"
        >
          <Signature icon={<User size={16} />} role="PREPARED BY" name={preparedBy} date={generated.split(',')[0]} />
          <Signature icon={<Eye size={16} />} role="REVIEWED BY" divider />
          <Signature icon={<Shield size={16} />} role="APPROVED BY — MANAGING DIRECTOR" divider />
        </div>
      </div>

      {/* ---------------- footer ---------------- */}
      <div
        className="epi-doc-foot"
        style={{
          marginTop: '18px',
          borderTop: `1px solid ${LINE}`,
          padding: '11px 26px 14px',
          display: 'flex',
          alignItems: 'center',
          fontSize: '9.5px',
          fontWeight: 700,
          letterSpacing: '0.16em',
          color: '#7b8a87',
        }}
      >
        <span>LD SILK MILLS</span>
        <span style={{ margin: '0 12px', color: '#c9d3d0' }}>|</span>
        <span>EMPLOYEE PERFORMANCE REPORT</span>
        <span style={{ marginLeft: 'auto', letterSpacing: '0.06em' }}>1 / 1</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const EV_ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '108px 96px minmax(140px,1.6fr) 104px 92px minmax(110px,1fr)',
  gap: '10px',
  alignItems: 'center',
  padding: '11px 14px',
}

function Divider() {
  return <span aria-hidden="true" style={{ width: '1px', height: '15px', background: '#d6cfc0' }} />
}

function MetaFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px' }}>
      <span style={{ color: TEAL, display: 'flex' }}>{icon}</span>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </span>
  )
}

function SectionRule({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="epi-doc-rule" style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '20px 0 12px' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.16em', color: TEAL }}>{title}</span>
      <span style={{ width: '58px', height: '2px', background: TEAL, borderRadius: '2px' }} />
      <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: MUTED }}>{right}</span>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="epi-doc-card"
      style={{ borderRadius: '12px', border: `1px solid ${LINE}`, background: '#fff', padding: '15px 17px' }}
    >
      {children}
    </div>
  )
}

function CardHead({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '13px' }}>
      <span
        style={{
          width: '26px',
          height: '26px',
          flex: '0 0 26px',
          borderRadius: '7px',
          background: '#e8f2ee',
          color: TEAL,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', color: INK }}>{title}</span>
      {right ? <span style={{ marginLeft: 'auto' }}>{right}</span> : null}
    </div>
  )
}

function Dot({ colour, label }: { colour: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <svg width="9" height="9" aria-hidden="true">
        <circle cx="4.5" cy="4.5" r="4.5" fill={colour} />
      </svg>
      {label}
    </span>
  )
}

function Chip({ tone, caps, children }: { tone: ToneKey; caps?: boolean; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: '999px',
        background: TONE[tone].bg,
        color: TONE[tone].fg,
        border: `1px solid ${TONE[tone].bd}`,
        fontSize: caps ? '9.5px' : '11px',
        fontWeight: 700,
        letterSpacing: caps ? '0.1em' : 0,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function Signature({
  icon,
  role,
  name,
  date,
  divider,
}: {
  icon: React.ReactNode
  role: string
  name?: string
  date?: string
  divider?: boolean
}) {
  return (
    <div
      style={{
        padding: '15px 18px',
        display: 'flex',
        gap: '12px',
        borderLeft: divider ? `1px solid ${LINE}` : 0,
      }}
    >
      <span style={{ color: TEAL, flex: '0 0 auto', marginTop: '2px' }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: '9.5px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#2b2b2b',
          }}
        >
          {role}
        </span>
        <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginTop: '5px' }}>
          {name ?? '—'}
        </span>
        <span style={{ display: 'block', fontSize: '11.5px', color: MUTED, marginTop: '3px' }}>
          Date: {date ?? '—'}
        </span>
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Chart — SVG so the bars print in colour regardless of the browser's  */
/* "Background graphics" setting.                                       */
/* ------------------------------------------------------------------ */

function MonthChart({ months }: { months: { label: string; pos: number; goof: number }[] }) {
  const peak = Math.max(1, ...months.map((m) => Math.max(m.pos, m.goof)))
  const top = peak <= 2 ? 2 : peak <= 5 ? 5 : Math.ceil(peak / 5) * 5
  const ticks = Array.from({ length: top + 1 }, (_, i) => i).filter(
    (t) => top <= 5 || t % Math.ceil(top / 5) === 0,
  )

  const W = 560
  const H = 150
  const slot = W / Math.max(1, months.length)
  const barW = Math.min(20, slot * 0.22)
  const y = (v: number) => H - (v / top) * H

  return (
    <div style={{ display: 'flex', gap: '9px' }}>
      <div
        style={{
          width: '14px',
          height: `${H}px`,
          display: 'flex',
          flexDirection: 'column-reverse',
          justifyContent: 'space-between',
          textAlign: 'right',
          fontSize: '10.5px',
          color: MUTED,
        }}
      >
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: `${H}px`, display: 'block' }}
          role="img"
          aria-label="Recognitions and goofups per month"
        >
          {ticks.map((t) => (
            <line
              key={t}
              x1={0}
              x2={W}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? '#c2ccc9' : '#eef1f0'}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {months.map((m, i) => {
            const cx = i * slot + slot / 2
            return (
              <g key={m.label}>
                {m.pos > 0 ? (
                  <rect x={cx - barW - 2} y={y(m.pos)} width={barW} height={H - y(m.pos)} fill="#3d7fd4" />
                ) : null}
                {m.goof > 0 ? (
                  <rect x={cx + 2} y={y(m.goof)} width={barW} height={H - y(m.goof)} fill="#e0a52e" />
                ) : null}
              </g>
            )
          })}
        </svg>

        <div style={{ display: 'flex', marginTop: '7px' }}>
          {months.map((m) => (
            <span
              key={m.label}
              style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '11px', color: MUTED }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
