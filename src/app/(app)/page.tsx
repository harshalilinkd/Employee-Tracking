import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SignalBadge } from '@/components/app/SignalBadge'
import { EmptyState } from '@/components/app/EmptyState'
import { Collapsible } from '@/components/app/Collapsible'
import { AttentionPanel } from '@/components/app/AttentionPanel'
import { QuickInsights, type Insight } from '@/components/app/QuickInsights'
import {
  DepartmentOverview,
  ImpactMix,
  IssueHeat,
  PerformanceMomentum,
  PerformanceTrend,
  RecognitionLeaderboard,
} from '@/components/app/DashboardSections'
import { RecordCta } from '@/components/app/RecordCta'
import { ExpandableList } from '@/components/app/ExpandableList'
import {
  DashboardFilters,
  DateRange,
  MatrixControls,
} from '@/components/app/DashboardControls'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ListChecks,
  RefreshCw,
  Target,
  Users,
  UsersRound,
} from 'lucide-react'
import { DASH, avatarStyle, cardStyle, initials, tableHeadStyle } from '@/lib/design'
import { ago, fmtFull } from '@/lib/format'
import { SEVERITY_LABELS, hasImpact, impactLabel, type EmployeeSignal, type Severity } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * How many rows the dashboard's people-lists send to the browser. Everything
 * past this is reachable through the filters rather than by scrolling — the
 * dashboard is a summary, and a 400-row panel is not one.
 */
const LIST_PAYLOAD = 40

/** One label/value line inside a mobile performance card. */
function CardStat({
  label,
  value,
  badge,
  tone,
}: {
  label: string
  value?: string
  badge?: React.ReactNode
  tone?: 'green' | 'orange'
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ flex: 1, fontSize: '13px', color: 'var(--epi-fg-2)' }}>{label}</span>
      {badge ?? (
        <span
          className="epi-num"
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: tone ? `var(--epi-${tone})` : 'var(--epi-fg)',
          }}
        >
          {value}
        </span>
      )}
    </div>
  )
}

/** Whole days between an event date and today, for relative labels. */
const daysAgo = (iso: string) =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000))

/* Caps on the measure columns. Recognitions and Goofups are single digits
   and a signal is one word; left proportional they each took a share of the
   slack and the table read as five near-empty columns. The name column,
   which is the one that can actually run long, takes it instead. */
const MATRIX_COLS =
  'minmax(170px,1fr) minmax(100px,180px) minmax(110px,150px) minmax(100px,140px) minmax(140px,190px) 104px'
const DEPT_COLS = 'minmax(150px,2fr) 84px 60px 60px minmax(90px,1fr) 96px'

/** SPEC §5 trend glyphs, as shown in the design reference. */
function trendArrow(label: string) {
  return { Improving: '↗', Stable: '→', Softening: '↘', Slipping: '↓' }[label] ?? ''
}

function bandRank(band: string) {
  return { Attention: 0, Watch: 1, Stable: 2, Strong: 3, 'No signal': 4 }[band] ?? 5
}

interface Search {
  from?: string
  to?: string
  emp?: string
  dept?: string
  type?: string
  sev?: string
  scope?: string
  sort?: string
  all?: string
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const supabase = await createClient()

  // An explicit from/to beats preset pills: managers ask about a review
  // period, a month end, a specific incident window — not "last 3 months".
  // Events are written with the local calendar date (see RecordDrawer's
  // todayIso), so the range must be built the same way. toISOString() is UTC
  // and in IST that is yesterday for anything recorded after 05:30.
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = new Date()
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - 90)

  // `??` only guards null/undefined, so ?from= (empty) or a malformed value
  // passed straight through and produced Invalid Date downstream.
  const validDate = (v: string | undefined) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime()) ? v : undefined
  const toIso = validDate(sp.to) ?? iso(today)
  const sinceIso = validDate(sp.from) ?? iso(defaultFrom)

  // The comparison period is the same length, immediately before it.
  const spanDays = Math.max(
    1,
    Math.round((new Date(toIso).getTime() - new Date(sinceIso).getTime()) / 86400000),
  )
  const prevSince = new Date(sinceIso)
  prevSince.setDate(prevSince.getDate() - spanDays)
  const prevSinceIso = iso(prevSince)

  // The charts always cover six months regardless of the KPI range, so the
  // query reaches back to whichever is further.
  const chartSince = new Date()
  chartSince.setMonth(chartSince.getMonth() - 5)
  chartSince.setDate(1)
  const chartSinceIso = chartSince.toISOString().slice(0, 10)
  const fetchSinceIso = prevSinceIso < chartSinceIso ? prevSinceIso : chartSinceIso

  const [signalsRes, eventsRes, deptRes, empRes] = await Promise.all([
    supabase.from('v_employee_signal').select('*'),
    supabase
      .from('performance_events')
      .select(
        'id, type, title, event_date, severity, department_id, employee:employees(id, full_name), category:categories(name), recorder:app_users(full_name)',
      )
      .eq('status', 'active')
      .gte('event_date', fetchSinceIso)
      .order('event_date', { ascending: false }),
    supabase.from('departments').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('employees')
      .select('id, full_name, designation:designations(title)')
      .eq('status', 'Active')
      .order('full_name'),
  ])

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)
  const signals = (signalsRes.data ?? []) as EmployeeSignal[]
  const departments = (deptRes.data ?? []) as { id: string; name: string }[]
  const deptNames = new Map(departments.map((d) => [d.id, d.name]))
  const employeeRows = (empRes.data ?? []) as { id: string; full_name: string; designation: unknown }[]
  const employees = employeeRows.map((e) => ({ id: e.id, full_name: e.full_name }))
  const designationOf = new Map(
    employeeRows.map((e) => [e.id, (Array.isArray(e.designation) ? e.designation[0] : e.designation) as { title: string } | null]),
  )

  type EventRow = {
    id: string
    type: 'positive' | 'goofup'
    title: string
    event_date: string
    severity: Severity
    department_id: string | null
    employee: unknown
    category: unknown
    recorder: unknown
  }

  const allEvents = ((eventsRes.data ?? []) as EventRow[]).map((e) => ({
    ...e,
    employeeRef: one(e.employee) as { id: string; full_name: string } | null,
    categoryName: (one(e.category) as { name: string } | null)?.name ?? 'Uncategorised',
    recordedBy: (one(e.recorder) as { full_name: string } | null)?.full_name ?? 'Unknown',
  }))

  // A stale ?type=positive&sev=high URL would otherwise filter positives by a
  // grade none of them carry and come back empty, with no visible control to
  // explain why — so the impact filter is ignored once positives are the only
  // type in scope.
  const sevFilter = sp.type === 'positive' ? undefined : sp.sev

  const matchesFilters = (e: (typeof allEvents)[number]) =>
    (!sp.emp || e.employeeRef?.id === sp.emp) &&
    (!sp.dept || e.department_id === sp.dept) &&
    (!sp.type || e.type === sp.type) &&
    (!sevFilter || e.severity === sevFilter)

  const events = allEvents
    .filter((e) => e.event_date >= sinceIso && e.event_date <= toIso)
    .filter(matchesFilters)
  const previous = allEvents
    .filter((e) => e.event_date >= prevSinceIso && e.event_date < sinceIso)
    .filter(matchesFilters)

  const positives = events.filter((e) => e.type === 'positive').length
  const goofups = events.filter((e) => e.type === 'goofup').length
  const recognised = new Set(events.filter((e) => e.type === 'positive').map((e) => e.employeeRef?.id)).size

  const delta = (type: 'positive' | 'goofup') => {
    const r = type === 'positive' ? positives : goofups
    const p = previous.filter((e) => e.type === type).length
    if (p === 0) return 'no prior period'
    const pct = Math.round(((r - p) / p) * 100)
    return `${pct >= 0 ? '+' : ''}${pct}% vs previous`
  }

  // Signals are scoped by the department/employee filter so the KPI strip and
  // the matrix always describe the same population.
  const scopedSignals = signals.filter(
    (s) => (!sp.emp || s.employee_id === sp.emp) && (!sp.dept || s.department_id === sp.dept),
  )

  const needsAttention = scopedSignals.filter((s) => s.band === 'Attention').length

  const pctOf = (n: number) =>
    scopedSignals.length ? `${Math.round((n / scopedSignals.length) * 100)}% of total employees` : '—'

  const kpis = [
    {
      label: 'Total Employees',
      value: scopedSignals.length,
      icon: <Users size={18} />,
      tone: 'teal',
      // "active" here means someone has recorded something about them in the
      // window, not that they are employed — worth saying plainly.
      sub: `${scopedSignals.filter((x) => x.event_count > 0).length} with activity`,
      subTone: 'muted',
    },
    { label: 'Goofups', value: goofups, icon: <Target size={18} />, tone: 'orange',
      sub: delta('goofup'), subTone: 'delta-bad' },
    { label: 'Need Attention', value: needsAttention, icon: <AlertTriangle size={18} />, tone: 'red',
      sub: needsAttention ? pctOf(needsAttention) : 'all clear', subTone: needsAttention ? 'bad' : 'muted' },
    { label: 'Employees Recognised', value: recognised, icon: <UsersRound size={18} />, tone: 'blue',
      sub: pctOf(recognised), subTone: 'muted' },
  ]


  const sortKey = sp.sort ?? 'Needs attention'
  const big = 1e9
  const scope = sp.scope === 'department' ? 'department' : 'employee'

  const ranked = [...scopedSignals]
    .filter((s) => s.event_count > 0)
    .sort((a, b) => {
      switch (sortKey) {
        case 'Most positive':
          return b.positive_count - a.positive_count
        case 'Most goofups':
          return b.goofup_count - a.goofup_count
        case 'Most improved':
          return b.trend_delta - a.trend_delta
        case 'Recently active':
          return (a.days_since_any ?? big) - (b.days_since_any ?? big)
        case 'Longest silent':
          return (b.days_since_any ?? big) - (a.days_since_any ?? big)
        default:
          return bandRank(a.band) - bandRank(b.band) || b.issue_load - a.issue_load
      }
    })

  // Expansion is handled in the browser now, so the server ships a bounded
  // slice rather than every ranked employee. Past this the answer is the
  // filter bar, not a longer list.
  const matrix = ranked.slice(0, LIST_PAYLOAD)
  // Meter bars scale against the busiest person on screen, not an absolute.
  const maxPos = Math.max(1, ...ranked.map((r) => r.positive_count))
  const maxGoof = Math.max(1, ...ranked.map((r) => r.goofup_count))

  const deptMatrix = departments
    .map((d) => {
      const rows = events.filter((e) => e.department_id === d.id)
      const sigs = scopedSignals.filter((s) => s.department_id === d.id)
      return {
        id: d.id,
        name: d.name,
        people: sigs.length,
        pos: rows.filter((e) => e.type === 'positive').length,
        goof: rows.filter((e) => e.type === 'goofup').length,
        load: sigs.reduce((a, s) => a + Number(s.issue_load), 0),
        band:
          sigs.some((s) => s.band === 'Attention')
            ? 'Attention'
            : sigs.some((s) => s.band === 'Watch')
              ? 'Watch'
              : sigs.some((s) => s.event_count > 0)
                ? 'Stable'
                : 'No signal',
      }
    })
    .filter((d) => d.pos + d.goof > 0)
    .sort((a, b) => b.load - a.load)
  const loadMax = Math.max(1, ...deptMatrix.map((d) => d.load))

  // One short phrase per person, in the order a manager would care about.
  // The full explanation still lives on the badge tooltip and the profile.
  const reasonFor = (s: EmployeeSignal) => {
    if (s.critical_goofups > 0) return 'Critical issue'
    if (s.repeat_category) return `Repeat: ${s.repeat_category}`
    if (Number(s.issue_load) >= 7) return 'High issue load'
    if (s.trend_delta <= -2) return 'Declining trend'
    if (s.days_since_positive === null) return 'No recognition yet'
    return 'Needs review'
  }

  // The panel used to be handed six rows and count them for its own header,
  // so a roster with 23 people in trouble reported "6". The count now comes
  // from the filtered set; the slice is only how much markup we ship.
  const flagged = scopedSignals
    .filter((s) => s.band === 'Attention' || s.band === 'Watch')
    .sort((a, b) => bandRank(a.band) - bandRank(b.band) || Number(b.issue_load) - Number(a.issue_load))

  const attentionTotal = flagged.filter((s) => s.band === 'Attention').length

  const attentionRows = flagged
    .slice(0, LIST_PAYLOAD)
    .map((s) => ({
      id: s.employee_id,
      name: s.full_name,
      dept: s.department_id ? (deptNames.get(s.department_id) ?? '—') : '—',
      band: s.band as 'Attention' | 'Watch',
      reason: reasonFor(s),
      issueLoad: Number(s.issue_load),
    }))



  /* ---------- six-month chart data ---------- */
  const SEV_W: Record<string, number> = { low: 1, medium: 2, high: 3.5, critical: 6 }
  const chartEvents = allEvents.filter((e) => e.event_date >= chartSinceIso).filter(matchesFilters)

  const months: { key: string; label: string; pos: number; goof: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-GB', { month: 'short' }),
      pos: 0,
      goof: 0,
    })
  }
  for (const e of chartEvents) {
    const m = months.find((x) => e.event_date.startsWith(x.key))
    if (m) {
      if (e.type === 'positive') m.pos++
      else m.goof++
    }
  }

  const momentum = months.map((m) => ({ label: m.label, net: m.pos - m.goof }))

  // Impact hues escalate cool -> hot (DASH.impact), so severity reads off
  // the donut without consulting the legend.
  // Goofups only. Impact grades how bad an issue was — positives are all
  // stored at the neutral grade, so counting them here would have piled every
  // recognition into the "Medium" slice and made the mix meaningless.
  const gradedEvents = events.filter((e) => e.type === 'goofup')
  const donutTotal = gradedEvents.length
  const donutSlices = (['critical', 'high', 'medium', 'low'] as const).map((sev) => {
    const count = gradedEvents.filter((e) => e.severity === sev).length
    return {
      name: SEVERITY_LABELS[sev],
      count,
      pct: donutTotal ? Math.round((count / donutTotal) * 100) : 0,
      color: DASH.impact[sev] as string,
    }
  })

  const deptOverview = departments
    .map((d) => {
      const inWindow = events.filter((e) => e.department_id === d.id)
      const before = previous.filter((e) => e.department_id === d.id)
      const net = (f: typeof events) =>
        f.filter((x) => x.type === 'positive').length - f.filter((x) => x.type === 'goofup').length
      return {
        id: d.id,
        name: d.name,
        people: scopedSignals.filter((x) => x.department_id === d.id).length,
        pos: inWindow.filter((e) => e.type === 'positive').length,
        goof: inWindow.filter((e) => e.type === 'goofup').length,
        trend: net(inWindow) - net(before),
      }
    })
    .filter((d) => d.pos + d.goof > 0)
    .sort((a, b) => b.pos + b.goof - (a.pos + a.goof))
    .slice(0, 9)

  const ranking = scopedSignals
    .filter((s) => s.positive_count > 0 || s.goofup_count > 0)
    .sort((a, b) => b.positive_count - a.positive_count || a.goofup_count - b.goofup_count)

  const leaderboard = ranking
    .slice(0, LIST_PAYLOAD)
    .map((s) => ({
      id: s.employee_id,
      name: s.full_name,
      dept: s.department_id ? (deptNames.get(s.department_id) ?? '—') : '—',
      designation: designationOf.get(s.employee_id)?.title ?? '—',
      pos: s.positive_count,
      goof: s.goofup_count,
      band: s.band,
    }))

  // Weighted goofup load per employee per month, using the same severity
  // weights as the signal engine so heat and bands cannot contradict.
  const heatMap = new Map<string, { id: string; name: string; cells: { load: number; count: number }[] }>()
  for (const e of chartEvents) {
    if (e.type !== 'goofup' || !e.employeeRef) continue
    const idx = months.findIndex((m) => e.event_date.startsWith(m.key))
    if (idx < 0) continue
    const row =
      heatMap.get(e.employeeRef.id) ??
      { id: e.employeeRef.id, name: e.employeeRef.full_name, cells: months.map(() => ({ load: 0, count: 0 })) }
    const cell = row.cells[idx]
    if (cell) {
      cell.load += SEV_W[e.severity] ?? 1
      cell.count += 1
    }
    heatMap.set(e.employeeRef.id, row)
  }
  const heatRows = [...heatMap.values()]
    .sort((a, b) => b.cells.reduce((x, c) => x + c.load, 0) - a.cells.reduce((x, c) => x + c.load, 0))
    .slice(0, 10)

  /**
   * Quick Insights — each line pairs a counted observation with the action it
   * implies. Nothing here is inferred; every clause is backed by a figure
   * already on the page.
   */
  const criticalCount = events.filter((e) => e.type === 'goofup' && e.severity === 'critical').length
  const netBalance = positives - goofups
  const lastActivityDays = Math.min(
    ...[...scopedSignals.map((x) => x.days_since_any ?? Infinity), Infinity],
  )

  const insights: Insight[] = []

  if (criticalCount > 0) {
    insights.push({
      icon: 'alert',
      tone: 'red',
      head: `${criticalCount} critical goofup${criticalCount === 1 ? '' : 's'} recorded`,
      sub: 'Needs immediate attention',
      href: '/performance?sev=critical&type=goofup',
    })
  }

  if (Number.isFinite(lastActivityDays)) {
    insights.push({
      icon: 'calendar',
      tone: 'blue',
      head: `Last activity ${lastActivityDays} day${lastActivityDays === 1 ? '' : 's'} ago`,
      sub: lastActivityDays > 30 ? 'The picture is going stale' : 'Consider engagement check-in',
      href: '/performance',
    })
  }

  insights.push({
    icon: 'trend',
    tone: netBalance < 0 ? 'orange' : 'teal',
    head: `Net balance ${netBalance > 0 ? `+${netBalance}` : netBalance}`,
    sub:
      netBalance < 0
        ? 'Issues ahead – requires focus'
        : netBalance > 0
          ? 'Recognition ahead of issues'
          : 'Level for this period',
    href: '/reports',
  })

  if (positives === 0) {
    insights.push({
      icon: 'target',
      tone: 'teal',
      head: 'No recognitions yet',
      sub: 'Encourage and appreciate contributions',
      href: '/performance?type=positive',
    })
  } else {
    insights.push({
      icon: 'target',
      tone: 'green',
      head: `${recognised} employee${recognised === 1 ? '' : 's'} recognised`,
      sub: pctOf(recognised),
      href: '/performance?type=positive',
    })
  }

  const empty = allEvents.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="epi-page-head" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h1 className="epi-h1" style={{ margin: 0, fontSize: '25px', fontWeight: 700, letterSpacing: '-0.022em' }}>
            Employee Performance
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: '14px', color: 'var(--epi-fg-2)' }}>
            Track performance, identify trends and take action.
          </p>
        </div>
        <DateRange from={sinceIso} to={toIso} />
      </div>

      {/* KPI cards carry their own tint rather than sitting on plain white —
          the colour is the fastest read on the page. */}
      <div
        className="epi-kpis"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '14px' }}
      >
        {kpis.map((k) => (
          <div
            key={k.label}
            style={{
              borderRadius: '14px',
              border: `1px solid var(--epi-${k.tone}-bd)`,
              background: `var(--epi-${k.tone}-bg)`,
              padding: '16px 18px',
              display: 'flex',
              gap: '13px',
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                width: '40px',
                height: '40px',
                flex: '0 0 40px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--epi-surface)',
                color: `var(--epi-${k.tone})`,
              }}
            >
              {k.icon}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)', fontWeight: 500 }}>{k.label}</div>
              <div
                className="epi-num"
                style={{ fontSize: '29px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, marginTop: '2px' }}
              >
                {k.value}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  marginTop: '3px',
                  fontWeight: k.subTone === 'muted' ? 400 : 600,
                  color:
                    k.subTone === 'bad'
                      ? 'var(--epi-red)'
                      : k.subTone === 'delta-bad'
                        ? 'var(--epi-fg-2)'
                        : 'var(--epi-fg-3)',
                }}
              >
                {k.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      <DashboardFilters
        employees={employees}
        departments={departments}
        from={sinceIso}
        to={toIso}
        summary={`${events.length} event${events.length === 1 ? '' : 's'} in range`}
      />

      {/* Same gutter as the charts below, but a different split and a
          different breakpoint: the matrix carries six columns and needs
          780px before it stops clipping, which an even half never gives
          until the monitor is very wide. See the laptop tier in globals. */}
      <div
        className="epi-matrix-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1fr)',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Collapsible
            title={scope === 'department' ? 'Department Performance' : 'Employee Performance'}
            count={scope === 'department' ? deptMatrix.length : ranked.length}
            emptyNote="nothing recorded yet"
            right={<MatrixControls />}
          >
            {empty ? (
              <EmptyState
                title="No performance records yet"
                body="Once your team starts recording employee performance, the matrix will populate here."
                action={<RecordCta />}
              />
            ) : scope === 'department' ? (
              <>
                <div className="epi-scroll-x" style={{ ...cardStyle, overflow: 'hidden', overflowX: 'auto' }}>
                  <div
                    className="epi-grid-table epi-grid-table-head"
                    style={{
                      minWidth: '640px',
                      display: 'grid',
                      gridTemplateColumns: DEPT_COLS,
                      gap: '8px',
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--epi-border)',
                      ...tableHeadStyle,
                    }}
                  >
                    <span>Department</span>
                    <span style={{ textAlign: 'right' }}>People</span>
                    <span style={{ textAlign: 'right' }}>Pos</span>
                    <span style={{ textAlign: 'right' }}>Goof</span>
                    <span>Issue load</span>
                    <span>Signal</span>
                  </div>
                  {deptMatrix.map((d) => (
                    <div
                      key={d.id}
                      className="epi-row epi-grid-table"
                      style={{
                        minWidth: '640px',
                        display: 'grid',
                        gridTemplateColumns: DEPT_COLS,
                        gap: '8px',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--epi-border-soft)',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{d.name}</span>
                      <span className="epi-num" style={{ fontSize: '13px', textAlign: 'right', color: 'var(--epi-fg-2)' }}>
                        {d.people}
                      </span>
                      <span className="epi-num" style={{ fontSize: '14px', textAlign: 'right', color: 'var(--epi-violet)' }}>
                        {d.pos}
                      </span>
                      <span
                        className="epi-num"
                        style={{ fontSize: '14px', textAlign: 'right', color: d.goof ? 'var(--epi-orange)' : 'var(--epi-fg-3)' }}
                      >
                        {d.goof}
                      </span>
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                        <span style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--epi-track)' }}>
                          <span
                            style={{
                              display: 'block',
                              height: '100%',
                              width: `${(d.load / loadMax) * 100}%`,
                              borderRadius: '999px',
                              background: 'var(--epi-orange)',
                            }}
                          />
                        </span>
                        <span className="epi-num" style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
                          {d.load.toFixed(1)}
                        </span>
                      </span>
                      <SignalBadge band={d.band} />
                    </div>
                  ))}
                </div>
                <span className="epi-scroll-hint">Swipe sideways to see all columns →</span>
              </>
            ) : (
              <>
                <div className="epi-table-desktop">
                  <ExpandableList
                    scrollX
                    collapsed={7}
                    total={ranked.length}
                    containerStyle={{ ...cardStyle, overflow: 'hidden' }}
                    header={
                      <div
                        className="epi-grid-table epi-grid-table-head"
                        style={{
                          minWidth: '780px',
                          display: 'grid',
                          gridTemplateColumns: MATRIX_COLS,
                          gap: '10px',
                          padding: '10px 16px',
                          borderBottom: '1px solid var(--epi-border)',
                          ...tableHeadStyle,
                        }}
                      >
                        <span>Employee</span>
                        <span>Department</span>
                        <span>Recognitions</span>
                        <span>Goofups</span>
                        <span>Performance signal</span>
                        <span>Last activity</span>
                      </div>
                    }
                    rows={matrix.map((m) => (
                    <Link
                      key={m.employee_id}
                      href={`/employees/${m.employee_id}`}
                      className="epi-row epi-grid-table"
                      style={{
                        minWidth: '780px',
                        display: 'grid',
                        gridTemplateColumns: MATRIX_COLS,
                        gap: '10px',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--epi-border-soft)',
                        alignItems: 'center',
                        color: 'var(--epi-fg)',
                        textDecoration: 'none',
                      }}
                    >
                      <span style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                        <span style={avatarStyle(32)}>{initials(m.full_name)}</span>
                        <span style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '14px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {m.full_name}
                          </span>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '12px',
                              color: 'var(--epi-fg-3)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {designationOf.get(m.employee_id)?.title ?? ''}
                          </span>
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          color: 'var(--epi-fg-2)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {m.department_id ? (deptNames.get(m.department_id) ?? '—') : '—'}
                      </span>
                      <Meter value={m.positive_count} max={maxPos} colour="var(--epi-violet)" />
                      <Meter value={m.goofup_count} max={maxGoof} colour="var(--epi-orange)" />
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <SignalBadge band={m.band} explanation={m.explanation} />
                        <span
                          style={{
                            fontSize: '13px',
                            color:
                              m.trend_delta > 0
                                ? 'var(--epi-green)'
                                : m.trend_delta < 0
                                  ? 'var(--epi-red)'
                                  : 'var(--epi-fg-3)',
                          }}
                        >
                          {trendArrow(m.trend_label)}
                        </span>
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--epi-fg-3)', whiteSpace: 'nowrap' }}>
                        {ago(m.days_since_any)}
                      </span>
                    </Link>
                    ))}
                  />
                </div>

                {/* On a phone the six-column matrix becomes a label/value
                    card per person — a horizontally scrolling table hides the
                    signal, which is the column that matters most. */}
                <div className="epi-cards-mobile">
                  <ExpandableList
                    collapsed={4}
                    gap={10}
                    total={ranked.length}
                    rows={matrix.map((m) => (
                    <div
                      key={m.employee_id}
                      style={{
                        ...cardStyle,
                        borderRadius: '14px',
                        padding: '15px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
                        <span style={avatarStyle(38)}>{initials(m.full_name)}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: '15.5px', fontWeight: 700 }}>
                            {m.full_name}
                          </span>
                          <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>
                            {designationOf.get(m.employee_id)?.title ?? ''}
                            {m.department_id ? ` · ${deptNames.get(m.department_id) ?? ''}` : ''}
                          </span>
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                        <CardStat label="Recognitions" value={String(m.positive_count)} tone={m.positive_count ? 'green' : undefined} />
                        <CardStat label="Goofups" value={String(m.goofup_count)} tone={m.goofup_count ? 'orange' : undefined} />
                        <CardStat label="Signal" badge={<SignalBadge band={m.band} explanation={m.explanation} />} />
                        <CardStat label="Last activity" value={ago(m.days_since_any)} />
                      </div>

                      <Link
                        href={`/employees/${m.employee_id}`}
                        style={{
                          height: '40px',
                          borderRadius: '10px',
                          border: '1px solid var(--epi-teal-bd)',
                          background: 'var(--epi-teal-bg)',
                          color: 'var(--epi-teal)',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '7px',
                        }}
                      >
                        View report <ArrowRight size={14} />
                      </Link>
                    </div>
                    ))}
                  />
                </div>
              </>
            )}
          </Collapsible>
        </div>

        <div
          className="epi-attention-first"
          style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}
        >
          <AttentionPanel rows={attentionRows} total={flagged.length} attentionTotal={attentionTotal} />
        </div>
      </div>

      {/* One grid for every chart, not three independent flex rows. Each row
          used to size itself from its own flex bases (620/520, 420/340...),
          so no two columns lined up. A single grid makes the column edge
          continuous all the way down. */}
      <div
        className="epi-chart-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '20px',
          alignItems: 'stretch',
        }}
      >
        <PerformanceTrend months={months} posDelta={delta('positive')} goofDelta={delta('goofup')} />
        <QuickInsights items={insights} />
        <DepartmentOverview rows={deptOverview} />
        <PerformanceMomentum points={momentum} />
        <ImpactMix slices={donutSlices} total={donutTotal} />
        <RecognitionLeaderboard rows={leaderboard} total={ranking.length} />

        <section style={{ minWidth: 0, width: '100%', display: 'flex' }}>
          <div style={{ ...cardStyle, flex: 1, padding: '18px 20px 8px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '10px' }}>
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
                  background: 'var(--epi-blue-bg)',
                  color: 'var(--epi-blue)',
                  border: '1px solid var(--epi-blue-bd)',
                }}
              >
                <ListChecks size={16} />
              </span>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.015em', flex: 1 }}>
                Recent Performance Activity
              </h2>
              <Link href="/performance" style={{ fontSize: '13px', fontWeight: 600 }}>
                View all →
              </Link>
            </div>

            {events.length === 0 ? (
              <EmptyState
                dashed={false}
                title="No performance records yet"
                body="Once your team starts recording employee performance, activity will appear here."
                action={<RecordCta />}
              />
            ) : (
              events.slice(0, 6).map((e) => (
                <Link
                  key={e.id}
                  href={`/employees/${e.employeeRef?.id ?? ''}`}
                  className="epi-row"
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px 6px',
                    borderBottom: '1px solid var(--epi-border-soft)',
                    alignItems: 'flex-start',
                    color: 'var(--epi-fg)',
                    textDecoration: 'none',
                    borderRadius: '8px',
                  }}
                >
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      flex: '0 0 26px',
                      borderRadius: '999px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      background: e.type === 'positive' ? 'var(--epi-green-bg)' : 'var(--epi-red-bg)',
                      color: e.type === 'positive' ? 'var(--epi-green)' : 'var(--epi-red)',
                    }}
                  >
                    {e.type === 'positive' ? <Check size={13} /> : <AlertTriangle size={13} />}
                  </span>
                  {/* Four lines per event became two. The "Positive
                      Contribution" / "Goofup" line is dropped outright — the
                      coloured icon beside it already says which it is. */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '13.5px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.employeeRef?.full_name}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: '13px',
                          color: 'var(--epi-fg-2)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.title}
                      </span>
                      <span
                        className="epi-num"
                        style={{ fontSize: '11.5px', color: 'var(--epi-fg-3)', whiteSpace: 'nowrap' }}
                      >
                        {ago(daysAgo(e.event_date))}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '4px' }}>
                      {/* The impact dot only means something on a goofup. */}
                      {hasImpact(e.type) ? (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '999px',
                            background: DASH.impact[e.severity],
                          }}
                        />
                      ) : null}
                      <span style={{ fontSize: '11.5px', color: 'var(--epi-fg-3)' }}>
                        {hasImpact(e.type) ? `${impactLabel(e.type, e.severity)} · ` : ''}
                        {e.recordedBy}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <IssueHeat rows={heatRows} monthLabels={months.map((m) => m.label)} />
      </div>

      {/* Closing rule, as in the approved design — the dashboard reads as a
          document with a beginning and an end rather than an endless scroll. */}
      <div
        className="epi-dash-foot"
        style={{
          marginTop: '4px',
          paddingTop: '14px',
          borderTop: '1px solid var(--epi-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          fontSize: '11.5px',
          color: 'var(--epi-fg-3)',
        }}
      >
        <span style={{ fontWeight: 700, letterSpacing: '0.14em' }}>EMPLOYEE TRACKING</span>
        <span style={{ color: 'var(--epi-border-3)' }}>|</span>
        <span>Performance overview</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={11} />
          Last updated {fmtFull(new Date())}
        </span>
      </div>
    </div>
  )
}

function Meter({ value, max, colour }: { value: number; max: number; colour: string }) {
  return (
    <span style={{ display: 'flex', gap: '9px', alignItems: 'center', minWidth: 0 }}>
      <span className="epi-num" style={{ fontSize: '14px', fontWeight: 700, width: '20px' }}>
        {value}
      </span>
      <span style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--epi-track)', minWidth: '32px' }}>
        <span
          style={{ display: 'block', height: '100%', width: `${(value / max) * 100}%`, borderRadius: '999px', background: colour }}
        />
      </span>
    </span>
  )
}
