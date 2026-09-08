import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Building2,
  PieChart,
  ShieldCheck,
  Star,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { Collapsible } from './Collapsible'
import { ExpandableList } from './ExpandableList'
import { DASH, avatarStyle, cardStyle, initials, tableHeadStyle } from '@/lib/design'

export interface MonthBar {
  key: string
  label: string
  pos: number
  goof: number
}

export interface DeptRow {
  id: string
  name: string
  people: number
  pos: number
  goof: number
  trend: number
}

export interface DonutSlice {
  name: string
  count: number
  pct: number
  color: string
}

export interface LeaderRow {
  id: string
  name: string
  dept: string
  designation: string
  pos: number
  goof: number
  band: string
}

export interface HeatRow {
  id: string
  name: string
  cells: { load: number; count: number }[]
}

/* ------------------------------------------------------------------ */
/* Shared card chrome                                                  */
/* ------------------------------------------------------------------ */

function Panel({
  title,
  subtitle,
  icon,
  iconTone = 'violet',
  right,
  children,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  iconTone?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section style={{ minWidth: 0, width: '100%', display: 'flex' }}>
      <div style={{ ...cardStyle, flex: 1, padding: '18px 20px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', marginBottom: '16px' }}>
          {icon ? (
            <span
              style={{
                width: '30px',
                height: '30px',
                flex: '0 0 30px',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                background: `var(--epi-${iconTone}-bg)`,
                color: `var(--epi-${iconTone})`,
                border: `1px solid var(--epi-${iconTone}-bd)`,
              }}
            >
              {icon}
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.015em' }}>{title}</h2>
            {subtitle ? (
              <p
                className="epi-hide-mobile"
                style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--epi-fg-3)' }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {right ? <div style={{ flex: '0 0 auto' }}>{right}</div> : null}
        </div>
        {children}
      </div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '22px 0', fontSize: '13px', color: 'var(--epi-fg-2)' }}>{children}</div>
}

/* ------------------------------------------------------------------ */
/* Line chart                                                          */
/* SVG draws the paths (stretched), while dots and labels are HTML so  */
/* they stay circular and legible instead of being scaled with it.     */
/* ------------------------------------------------------------------ */

interface Series {
  name: string
  colour: string
  values: number[]
  fill?: boolean
}

function LineChart({
  series,
  labels,
  height = 190,
  showZero = false,
}: {
  series: Series[]
  labels: string[]
  height?: number
  showZero?: boolean
}) {
  const peak = Math.max(1, ...series.flatMap((s) => s.values.map(Math.abs)))
  const step = Math.max(1, Math.ceil(peak / 3))
  const max = step * 3
  const min = showZero ? -max : 0
  const span = max - min || 1

  const x = (i: number) => (labels.length > 1 ? (i / (labels.length - 1)) * 100 : 50)
  const y = (v: number) => 100 - ((v - min) / span) * 100
  const ticks = showZero ? [max, step, 0, -step, -max] : [max, step * 2, step, 0]

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <div
        className="epi-num"
        style={{ flex: '0 0 26px', height: `${height}px`, position: 'relative', fontSize: '11px', color: 'var(--epi-fg-3)' }}
      >
        {ticks.map((t) => (
          <span key={t} style={{ position: 'absolute', top: `${y(t)}%`, right: 0, transform: 'translateY(-50%)' }}>
            {t}
          </span>
        ))}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: 'relative', height: `${height}px` }}>
          {ticks.map((t) => (
            <span
              key={t}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${y(t)}%`,
                height: '1px',
                background: t === 0 && showZero ? 'var(--epi-border-2)' : 'var(--epi-border-soft)',
              }}
            />
          ))}
          {showZero ? (
            <span
              className="epi-mono"
              style={{
                position: 'absolute',
                left: '4px',
                top: `${y(0)}%`,
                transform: 'translateY(-130%)',
                fontSize: '10px',
                color: 'var(--epi-fg-3)',
              }}
            >
              Break-even
            </span>
          ) : null}

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <defs>
              {series.map((s) => (
                <linearGradient key={s.name} id={`epiFill${s.name.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: s.colour }} stopOpacity="0.28" />
                  <stop offset="100%" style={{ stopColor: s.colour }} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {series.map((s) => {
              const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
              return (
                <g key={s.name}>
                  {s.fill ? <path d={`${d} L 100 100 L 0 100 Z`} fill={`url(#epiFill${s.name.replace(/\W/g, '')})`} /> : null}
                  <path
                    d={d}
                    fill="none"
                    style={{ stroke: s.colour }}
                    strokeWidth="2.25"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )
            })}
          </svg>

          {/* A marker on every point meant two dots stacked on the baseline
              for each empty month, and a "0" label above each of them — six
              months of noise saying nothing. Only points that carry a value
              are marked and labelled; the line itself still shows the zeros. */}
          {series.map((s) =>
            s.values.map((v, i) =>
              v === 0 ? null : (
                <span key={`${s.name}-${i}`}>
                  <span
                    style={{
                      position: 'absolute',
                      left: `${x(i)}%`,
                      top: `${y(v)}%`,
                      width: '9px',
                      height: '9px',
                      marginLeft: '-4.5px',
                      marginTop: '-4.5px',
                      borderRadius: '999px',
                      background: s.colour,
                      border: '2px solid var(--epi-surface)',
                      boxShadow: `0 0 0 1px ${s.colour}`,
                    }}
                  />
                  <span
                    className="epi-num"
                    style={{
                      position: 'absolute',
                      left: `${x(i)}%`,
                      top: `${y(v)}%`,
                      transform: 'translate(-50%, -24px)',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: s.colour,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v}
                  </span>
                </span>
              ),
            ),
          )}
        </div>

        {/* Labels are positioned on the same scale as the points. `flex: 1`
            centres each label in an equal column (8.3%, 25%, 41.7%…) while
            x() spaces the points endpoint-to-endpoint (0%, 20%, 40%…), so
            every label sat to the right of the point it named. */}
        <div style={{ position: 'relative', height: '18px', marginTop: '8px' }}>
          {labels.map((l, i) => (
            <span
              key={l}
              style={{
                position: 'absolute',
                left: `${x(i)}%`,
                transform: 'translateX(-50%)',
                fontSize: '12px',
                color: 'var(--epi-fg-3)',
                whiteSpace: 'nowrap',
              }}
            >
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Dot({ colour, label }: { colour: string; label: string }) {
  return (
    <span style={{ display: 'flex', gap: '7px', alignItems: 'center', fontSize: '13px', color: 'var(--epi-fg-2)' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: colour }} />
      {label}
    </span>
  )
}

function StatTile({
  icon,
  tone,
  value,
  label,
  delta,
  good,
}: {
  icon: React.ReactNode
  tone: string
  value: number
  label: string
  delta: string
  good?: boolean
}) {
  const up = delta.startsWith('+')
  const neutral = !delta.startsWith('+') && !delta.startsWith('-')
  return (
    <div
      style={{
        border: '1px solid var(--epi-border)',
        borderRadius: '12px',
        padding: '14px',
        display: 'flex',
        gap: '11px',
        alignItems: 'flex-start',
        background: 'var(--epi-canvas)',
      }}
    >
      <span
        style={{
          width: '32px',
          height: '32px',
          flex: '0 0 32px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '15px',
          background: `var(--epi-${tone}-bg)`,
          color: `var(--epi-${tone})`,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="epi-num" style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)' }}>{label}</div>
        <div
          style={{
            fontSize: '12px',
            marginTop: '4px',
            fontWeight: 600,
            color: neutral ? 'var(--epi-fg-3)' : up === Boolean(good) ? 'var(--epi-green)' : 'var(--epi-red)',
          }}
        >
          {neutral ? delta : `${up ? '↑' : '↓'} ${delta.replace(/^[+-]/, '')}`}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Performance trend                                                   */
/* ================================================================== */

/**
 * Monthly volume as grouped columns.
 *
 * A line chart implies a continuous quantity moving between readings. These
 * are counts of discrete events per month, so columns are the honest shape —
 * and with mostly-empty months a line reads as a flat baseline with a spike,
 * which overstates the trend.
 *
 * Drawn as SVG so the bars print and follow the theme through CSS variables.
 */
export function PerformanceTrend({
  months,
  posDelta,
  goofDelta,
}: {
  months: MonthBar[]
  posDelta: string
  goofDelta: string
}) {
  const totalPos = months.reduce((a, m) => a + m.pos, 0)
  const totalGoof = months.reduce((a, m) => a + m.goof, 0)

  const peak = Math.max(1, ...months.map((m) => Math.max(m.pos, m.goof)))
  // Round the axis to a number a person would draw, so gridlines land on
  // whole events rather than on 1.33 of one.
  const top = peak <= 3 ? 3 : peak <= 5 ? 5 : Math.ceil(peak / 5) * 5
  const ticks = top <= 3 ? [top, 2, 1, 0] : [top, Math.round(top / 2), 0]

  const W = 600
  const H = 168
  const slot = W / Math.max(1, months.length)
  const barW = Math.min(26, slot * 0.2)
  const y = (v: number) => H - (v / top) * H

  return (
    <Panel
      title="Performance Overview"
      subtitle="Employee activity, recognition and issues over time"
      icon={<TrendingUp size={15} />}
      iconTone="teal"
    >
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div
              className="epi-num"
              style={{
                width: '18px',
                height: `${H}px`,
                position: 'relative',
                fontSize: '11px',
                color: 'var(--epi-fg-3)',
              }}
            >
              {ticks.map((t) => (
                <span
                  key={t}
                  style={{ position: 'absolute', top: `${(1 - t / top) * 100}%`, right: 0, transform: 'translateY(-50%)' }}
                >
                  {t}
                </span>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                style={{ width: '100%', height: `${H}px`, display: 'block' }}
                role="img"
                aria-label="Recognitions and issues per month"
              >
                {ticks.map((t) => (
                  <line
                    key={t}
                    x1={0}
                    x2={W}
                    y1={y(t)}
                    y2={y(t)}
                    stroke="currentColor"
                    strokeOpacity={t === 0 ? 0.22 : 0.09}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {months.map((m, i) => {
                  const cx = i * slot + slot / 2
                  return (
                    <g key={m.label}>
                      {m.pos > 0 ? (
                        <rect
                          x={cx - barW - 3}
                          y={y(m.pos)}
                          width={barW}
                          height={H - y(m.pos)}
                          rx={4}
                          style={{ fill: DASH.recognition }}
                        >
                          <title>{`${m.label}: ${m.pos} recognitions`}</title>
                        </rect>
                      ) : null}
                      {m.goof > 0 ? (
                        <rect
                          x={cx + 3}
                          y={y(m.goof)}
                          width={barW}
                          height={H - y(m.goof)}
                          rx={4}
                          style={{ fill: DASH.issues }}
                        >
                          <title>{`${m.label}: ${m.goof} issues`}</title>
                        </rect>
                      ) : null}
                    </g>
                  )
                })}
              </svg>

              <div style={{ display: 'flex', marginTop: '8px' }}>
                {months.map((m) => (
                  <span
                    key={m.label}
                    style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '12px', color: 'var(--epi-fg-3)' }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '18px',
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid var(--epi-border)',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Dot colour={DASH.recognition} label="Recognitions" />
            <Dot colour={DASH.issues} label="Goofups" />
          </div>
        </div>

        <div style={{ flex: '1 1 170px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatTile icon={<Star size={14} />} tone="green" value={totalPos} label="Recognitions" delta={posDelta} good />
          <StatTile icon={<AlertTriangle size={14} />} tone="orange" value={totalGoof} label="Goofups" delta={goofDelta} />
        </div>
      </div>
    </Panel>
  )
}

/* ================================================================== */
/* Department overview — a table, per the reference                    */
/* ================================================================== */

const DEPT_COLS = 'minmax(120px,1.6fr) 90px minmax(120px,1.6fr) minmax(110px,1.4fr) 70px'

export function DepartmentOverview({ rows }: { rows: DeptRow[] }) {
  const maxPos = Math.max(1, ...rows.map((d) => d.pos))
  const maxGoof = Math.max(1, ...rows.map((d) => d.goof))

  return (
    <Panel
      title="Department Overview"
      subtitle="Where activity concentrates — recognition vs issues"
      icon={<Building2 size={15} />}
      iconTone="teal"
      right={
        <Link href="/reports" style={{ fontSize: '13px', fontWeight: 600 }}>
          View full report →
        </Link>
      }
    >
      {rows.length === 0 ? (
        <Empty>No department activity in this period.</Empty>
      ) : (
        <div style={{ overflowX: 'auto' }} className="epi-scroll-x">
          <div className="epi-dept-table" style={{ minWidth: '520px' }}>
            <div
              className="epi-grid-table epi-grid-table-head"
              style={{
                display: 'grid',
                gridTemplateColumns: DEPT_COLS,
                gap: '12px',
                padding: '0 0 10px',
                borderBottom: '1px solid var(--epi-border)',
                ...tableHeadStyle,
              }}
            >
              <span>Department</span>
              <span style={{ textAlign: 'right' }}>Employees</span>
              <span>Recognitions</span>
              <span>Issues</span>
              <span style={{ textAlign: 'right' }}>Trend</span>
            </div>
            {rows.map((d) => (
              <div
                key={d.id}
                className="epi-grid-table"
                style={{
                  display: 'grid',
                  gridTemplateColumns: DEPT_COLS,
                  gap: '12px',
                  padding: '13px 0',
                  borderBottom: '1px solid var(--epi-border-soft)',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {d.name}
                </span>
                <span className="epi-num" style={{ fontSize: '13px', color: 'var(--epi-fg-2)', textAlign: 'right' }}>
                  {d.people}
                </span>
                <MeterCell value={d.pos} max={maxPos} colour={DASH.recognition} />
                <MeterCell value={d.goof} max={maxGoof} colour={DASH.issues} muted={d.goof === 0} />
                <span
                  title={d.trend > 0 ? 'Improving' : d.trend < 0 ? 'Worse than previous period' : 'Unchanged'}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    color: d.trend > 0 ? 'var(--epi-green)' : d.trend < 0 ? 'var(--epi-red)' : 'var(--epi-fg-3)',
                  }}
                >
                  {d.trend > 0 ? (
                    <ArrowUpRight size={16} />
                  ) : d.trend < 0 ? (
                    <ArrowDownRight size={16} />
                  ) : (
                    <Minus size={16} />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}

function MeterCell({ value, max, colour, muted }: { value: number; max: number; colour: string; muted?: boolean }) {
  return (
    <span style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
      <span
        className="epi-num"
        style={{ fontSize: '14px', fontWeight: 700, width: '22px', color: muted ? 'var(--epi-fg-3)' : 'var(--epi-fg)' }}
      >
        {value}
      </span>
      {/* An empty track next to a 0 reads as a chart that failed to load.
          Nothing recorded gets a rule instead. */}
      {value === 0 ? (
        <span className="epi-meter-bar" style={{ flex: 1, minWidth: '40px', height: '1px', background: 'var(--epi-border-2)' }} />
      ) : (
        <span
          className="epi-meter-bar"
          style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--epi-track)', minWidth: '40px' }}
        >
          <span
            style={{
              display: 'block',
              height: '100%',
              width: `${Math.max(6, (value / max) * 100)}%`,
              borderRadius: '999px',
              background: colour,
            }}
          />
        </span>
      )}
    </span>
  )
}

/* ================================================================== */
/* Momentum                                                            */
/* ================================================================== */

export function PerformanceMomentum({ points }: { points: { label: string; net: number }[] }) {
  const thisMonth = points[points.length - 1]?.net ?? 0
  const prevMonth = points[points.length - 2]?.net ?? 0
  const improving = thisMonth >= prevMonth

  return (
    <Panel
      title="Performance Momentum"
      subtitle="Net monthly balance — trending up or down"
      icon={<Activity size={15} />}
      iconTone="teal"
    >
      <LineChart
        labels={points.map((p) => p.label)}
        series={[{ name: 'Net', colour: DASH.accent, values: points.map((p) => p.net), fill: true }]}
        showZero
        height={170}
      />
      <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
        <div
          style={{ flex: '1 1 140px', border: '1px solid var(--epi-border)', borderRadius: '12px', padding: '14px', background: 'var(--epi-canvas)' }}
        >
          <div
            className="epi-num"
            style={{ fontSize: '24px', fontWeight: 700, color: thisMonth >= 0 ? 'var(--epi-violet)' : 'var(--epi-red)' }}
          >
            {thisMonth > 0 ? '+' : ''}
            {thisMonth}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)', marginTop: '2px' }}>Net balance</div>
          <div style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>this month</div>
        </div>
        <div
          style={{ flex: '1 1 140px', border: '1px solid var(--epi-border)', borderRadius: '12px', padding: '14px', background: 'var(--epi-canvas)' }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700, color: improving ? 'var(--epi-green)' : 'var(--epi-red)' }}>
            {improving ? '↑ Improving' : '↓ Softening'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)', marginTop: '4px' }}>Workforce momentum</div>
        </div>
      </div>
    </Panel>
  )
}

/* ================================================================== */
/* Impact mix                                                          */
/* ================================================================== */

/**
 * Severity mix as a stacked bar and a ladder.
 *
 * This was a donut. A donut answers "what share of the whole" and needs
 * several comparable slices to be worth drawing — with one event it was a
 * solid ring reading 100%, which is a fact you can state in three words.
 * A ladder works at any volume: one event or four hundred, the rows still
 * rank and the bars still compare, and it fills the card instead of leaving
 * a circle floating in white space.
 */
export function ImpactMix({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const present = slices.filter((s) => s.count > 0)
  const peak = Math.max(1, ...slices.map((s) => s.count))
  // "Serious" is the number a manager acts on, so it gets stated outright
  // rather than left to be added up from the rows.
  const serious = slices
    .filter((s) => s.name === 'Critical' || s.name === 'High')
    .reduce((a, s) => a + s.count, 0)

  return (
    <Panel title="Impact Mix" subtitle="How serious the recorded events are" icon={<PieChart size={15} />} iconTone="red">
      {total === 0 ? (
        <Empty>No events recorded in this period.</Empty>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* One bar showing the whole mix at a glance */}
          <div>
            <div
              style={{
                display: 'flex',
                height: '13px',
                borderRadius: '999px',
                overflow: 'hidden',
                background: 'var(--epi-track)',
              }}
            >
              {present.map((s) => (
                <span
                  key={s.name}
                  title={`${s.name}: ${s.count} (${s.pct}%)`}
                  style={{ width: `${s.pct}%`, background: s.color }}
                />
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '7px',
                fontSize: '12px',
                color: 'var(--epi-fg-3)',
              }}
            >
              <span>
                <span className="epi-num" style={{ fontWeight: 700, color: 'var(--epi-fg)' }}>
                  {total}
                </span>{' '}
                event{total === 1 ? '' : 's'} in this period
              </span>
              <span>most serious first</span>
            </div>
          </div>

          {/* The ladder — every level shown, so an empty Critical row still
              tells you something */}
          <div style={{ flex: 1 }}>
            {slices.map((s, i) => (
              <div
                key={s.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '11px minmax(58px, 84px) 1fr 34px 44px',
                  gap: '11px',
                  alignItems: 'center',
                  padding: '11px 0',
                  borderTop: i === 0 ? 0 : '1px solid var(--epi-border-soft)',
                }}
              >
                <span
                  style={{
                    width: '11px',
                    height: '11px',
                    borderRadius: '3px',
                    background: s.color,
                    opacity: s.count === 0 ? 0.35 : 1,
                  }}
                />
                <span
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: s.count === 0 ? 'var(--epi-fg-3)' : 'var(--epi-fg)',
                  }}
                >
                  {s.name}
                </span>

                {s.count === 0 ? (
                  <span style={{ height: '1px', background: 'var(--epi-border-2)' }} />
                ) : (
                  <span style={{ height: '8px', borderRadius: '999px', background: 'var(--epi-track)', overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${Math.max(6, (s.count / peak) * 100)}%`,
                        borderRadius: '999px',
                        background: s.color,
                      }}
                    />
                  </span>
                )}

                <span
                  className="epi-num"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    textAlign: 'right',
                    color: s.count === 0 ? 'var(--epi-fg-3)' : 'var(--epi-fg)',
                  }}
                >
                  {s.count}
                </span>
                <span
                  className="epi-num"
                  style={{ fontSize: '12.5px', textAlign: 'right', color: 'var(--epi-fg-3)' }}
                >
                  {s.pct}%
                </span>
              </div>
            ))}
          </div>

          {/* The takeaway, stated rather than implied */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: serious ? 'var(--epi-red-bg)' : 'var(--epi-green-bg)',
              border: `1px solid var(--epi-${serious ? 'red' : 'green'}-bd)`,
              fontSize: '12.5px',
              color: 'var(--epi-fg-2)',
            }}
          >
            <span style={{ color: `var(--epi-${serious ? 'red' : 'green'})`, display: 'flex' }}>
              {serious ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
            </span>
            {serious ? (
              <span>
                <strong style={{ color: 'var(--epi-red)' }}>
                  {serious} of {total}
                </strong>{' '}
                {serious === 1 ? 'event is' : 'events are'} high or critical impact
              </span>
            ) : (
              <span>Nothing recorded at high or critical impact</span>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ================================================================== */
/* Recognition leaderboard                                             */
/* ================================================================== */

const MEDAL = ['#F5C542', '#C3CAD6', '#D08B54']

/**
 * Ranking as bars rather than a list of figures.
 *
 * Every row used to repeat the words "Recognitions" and "Issues" under its
 * own number — the same two labels printed once per person. They are column
 * headings, so they are stated once, and the comparison people actually want
 * (who is ahead) is carried by bar length instead of by reading digits.
 */
export function RecognitionLeaderboard({ rows, total }: { rows: LeaderRow[]; total: number }) {
  const peak = Math.max(1, ...rows.map((r) => Math.max(r.pos, r.goof)))

  return (
    <Panel
      title="Recognition Leaderboard"
      subtitle="Who is being recognised most"
      icon={<Trophy size={15} />}
      iconTone="teal"
      right={
        // "View full" pointed at /reports, which is a per-employee report
        // rather than a longer leaderboard. The ranking now extends in place,
        // so this link says what it actually opens.
        <Link href="/reports" style={{ fontSize: '13px', fontWeight: 600 }}>
          Reports →
        </Link>
      }
    >
      {rows.length === 0 ? (
        <Empty>No recognition recorded in this period.</Empty>
      ) : (
        <div>
          <ExpandableList
            total={total}
            noun="ranked"
            header={
              /* labelled once, not once per row */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '22px 30px minmax(0,1fr) minmax(60px,1.1fr) 26px',
                  gap: '10px',
                  alignItems: 'center',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--epi-border)',
                  ...tableHeadStyle,
                  fontSize: '9.5px',
                }}
              >
                <span />
                <span />
                <span>Employee</span>
                <span>Recognitions · issues</span>
                <span style={{ textAlign: 'right' }}>Net</span>
              </div>
            }
            rows={rows.map((l, i) => (
            <Link
              key={l.id}
              href={`/employees/${l.id}`}
              className="epi-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '22px 30px minmax(0,1fr) minmax(60px,1.1fr) 26px',
                gap: '10px',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--epi-border-soft)',
                color: 'var(--epi-fg)',
                textDecoration: 'none',
              }}
            >
              <span
                className="epi-num"
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: i < 3 ? '#1c1c1f' : 'var(--epi-fg-3)',
                  background: i < 3 ? MEDAL[i] : 'var(--epi-track)',
                }}
              >
                {i + 1}
              </span>

              <span style={avatarStyle(30)}>{initials(l.name)}</span>

              <span style={{ minWidth: 0 }}>
                <span
                  style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {l.name}
                </span>
                <span
                  style={{ display: 'block', fontSize: '11.5px', color: 'var(--epi-fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {l.designation}
                </span>
              </span>

              {/* two stacked bars — length is the comparison, the figure sits
                  on the bar so no extra column is needed */}
              <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                <MiniBar value={l.pos} peak={peak} colour={DASH.recognition} />
                <MiniBar value={l.goof} peak={peak} colour={DASH.issues} />
              </span>

              <span
                className="epi-num"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  textAlign: 'right',
                  color:
                    l.pos - l.goof > 0
                      ? 'var(--epi-green)'
                      : l.pos - l.goof < 0
                        ? 'var(--epi-red)'
                        : 'var(--epi-fg-3)',
                }}
              >
                {l.pos - l.goof > 0 ? `+${l.pos - l.goof}` : l.pos - l.goof}
              </span>
            </Link>
            ))}
          />
        </div>
      )}
    </Panel>
  )
}

function MiniBar({ value, peak, colour }: { value: number; peak: number; colour: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
      <span style={{ flex: 1, height: '7px', borderRadius: '999px', background: 'var(--epi-track)', minWidth: 0, overflow: 'hidden' }}>
        {value > 0 ? (
          <span
            style={{
              display: 'block',
              height: '100%',
              width: `${Math.max(8, (value / peak) * 100)}%`,
              borderRadius: '999px',
              background: colour,
            }}
          />
        ) : null}
      </span>
      <span
        className="epi-num"
        style={{
          fontSize: '11.5px',
          fontWeight: 700,
          width: '13px',
          textAlign: 'right',
          color: value ? colour : 'var(--epi-fg-3)',
        }}
      >
        {value}
      </span>
    </span>
  )
}

/* ================================================================== */
/* Issue heat                                                          */
/* ================================================================== */

export function IssueHeat({ rows, monthLabels }: { rows: HeatRow[]; monthLabels: string[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.load)))
  // Month cells are capped, not proportional. A single digit does not read
  // better in a 135px cell, and at full width every one of them inflated
  // into a slab. The name column absorbs whatever is left over.
  const cols = `minmax(140px,250px) repeat(${monthLabels.length},minmax(38px,58px)) 56px`
  // Mobile squeezes these via --heat-cols; see globals.css.
  const colTotals = monthLabels.map((_, i) => rows.reduce((a, r) => a + (r.cells[i]?.load ?? 0), 0))

  return (
    <Collapsible
      title="Issue heat by employee"
      subtitle="Weighted goofup load per month — darker is heavier"
      count={rows.length}
      emptyNote="no issues recorded"
      defaultOpen={rows.length > 0}
    >
      <div className="epi-heat epi-scroll-x" style={{ ...cardStyle, padding: '18px 20px', overflowX: 'auto' }}>
        {/* 500, not 560: at 1440 this card's half of the charts grid is
            574px and its own padding takes 40 of that, so 560 overflowed by
            a hair and put a scrollbar under a table that fits. The columns
            themselves need 476, so 500 still leaves them room. */}
        <div style={{ minWidth: '500px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px', alignItems: 'center', justifyContent: 'start' }}>
            <span />
            {monthLabels.map((m) => (
              <span key={m} style={{ ...tableHeadStyle, textAlign: 'center' }}>
                {m}
              </span>
            ))}
            <span style={{ ...tableHeadStyle, textAlign: 'right' }}>Load</span>
          </div>

          {rows.map((r) => {
            const rowLoad = r.cells.reduce((a, c) => a + c.load, 0)
            return (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px', alignItems: 'center', justifyContent: 'start' }}>
                <span
                  style={{ fontSize: '13px', color: 'var(--epi-fg-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {r.name}
                </span>
                {r.cells.map((c, i) => {
                  const intensity = c.load / max
                  return (
                    <span
                      key={i}
                      title={`${r.name} · ${monthLabels[i]} · ${c.count} goofup${c.count === 1 ? '' : 's'}, weighted load ${c.load.toFixed(1)}`}
                      style={{
                        height: '28px',
                        borderRadius: '7px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: intensity > 0.55 ? '#5c2d00' : 'var(--epi-fg-2)',
                        background: c.load === 0 ? 'var(--epi-track)' : `rgba(245,158,11,${(0.14 + intensity * 0.66).toFixed(2)})`,
                        border: c.load === 0 ? '1px solid var(--epi-border-soft)' : '1px solid rgba(245,158,11,0.32)',
                      }}
                    >
                      {c.count || ''}
                    </span>
                  )
                })}
                <span
                  className="epi-num epi-mono"
                  style={{ fontSize: '12px', color: 'var(--epi-fg-2)', textAlign: 'right', fontWeight: 700 }}
                >
                  {rowLoad.toFixed(1)}
                </span>
              </div>
            )
          })}

          <div
            style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px', alignItems: 'center', justifyContent: 'start', paddingTop: '8px', borderTop: '1px solid var(--epi-border-soft)' }}
          >
            <span style={tableHeadStyle}>Month load</span>
            {colTotals.map((t, i) => (
              <span key={i} className="epi-num epi-mono" style={{ fontSize: '11px', color: 'var(--epi-fg-3)', textAlign: 'center' }}>
                {t ? t.toFixed(1) : '—'}
              </span>
            ))}
            <span />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={tableHeadStyle}>Lighter</span>
            <span
              style={{ flex: 1, maxWidth: '180px', height: '6px', borderRadius: '999px', background: 'linear-gradient(90deg,rgba(245,158,11,0.14),rgba(245,158,11,0.48),rgba(245,158,11,0.80))' }}
            />
            <span style={tableHeadStyle}>Heavier</span>
            <span
              className="epi-mono epi-hide-mobile"
              style={{ marginLeft: 'auto', paddingLeft: '14px', fontSize: '11px', color: 'var(--epi-fg-3)' }}
            >
              severity-weighted, not a raw count
            </span>
          </div>
        </div>
      </div>
      {/* The matrix cannot compress below one column per month, so on a phone
          it scrolls — and says so, rather than looking clipped. */}
      <span className="epi-scroll-hint">Swipe sideways to see every month →</span>
    </Collapsible>
  )
}
