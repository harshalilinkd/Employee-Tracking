import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/app/EmptyState'
import { RecordCta } from '@/components/app/RecordCta'
import { ReportActions } from '@/components/app/ReportActions'
import { ReportDocument, type DocEvent, type DocInsight } from '@/components/app/ReportDocument'
import { initials } from '@/lib/design'
import { ago, fmtFull, fmtShort } from '@/lib/format'
import { hasImpact, impactLabel, type EmployeeSignal, type Severity } from '@/lib/types'

export const dynamic = 'force-dynamic'


export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ emp?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

  // The reporting period is whatever the reader picks; 90 days back is only
  // the default. Everything on the page — figures, timeline, comparisons —
  // is derived from this window, so the report always states one period.
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - 90)

  const toIso = params.to ?? iso(new Date())
  const sinceIso = params.from ?? iso(defaultFrom)
  const spanDays = Math.max(
    1,
    Math.round((new Date(toIso).getTime() - new Date(sinceIso).getTime()) / 86400000),
  )

  // Only offer people who actually have history — a report on an employee
  // with no records is a blank page, not a report.
  const { data: withHistory } = await supabase
    .from('performance_events')
    .select('employee_id, employee:employees(id, full_name)')
    .eq('status', 'active')

  const seen = new Map<string, string>()
  for (const r of (withHistory ?? []) as { employee: unknown }[]) {
    const e = one(r.employee) as { id: string; full_name: string } | null
    if (e) seen.set(e.id, e.full_name)
  }
  const employees = [...seen.entries()]
    .map(([id, full_name]) => ({ id, full_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  if (employees.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Employee performance report
        </h1>
        <EmptyState
          title="No performance records to report on yet"
          body="Reports are generated from real recorded events only — nothing is inferred or fabricated. Record the first event and this page will fill in."
          action={<RecordCta />}
        />
      </div>
    )
  }

  const selectedId = params.emp && seen.has(params.emp) ? params.emp : (employees[0]?.id ?? '')

  // The group-wide comparison sections were dropped from the report, so the
  // two queries that fed them are gone too — they were fetching every event
  // in the window on every report load for nothing.
  const [empRes, sigRes, evRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, employee_code, joining_date, manager:manager_id(full_name), department:departments!employees_department_id_fkey(name), designation:designations(title)')
      .eq('id', selectedId)
      .maybeSingle(),
    supabase.from('v_employee_signal').select('*').eq('employee_id', selectedId).maybeSingle(),
    supabase
      .from('performance_events')
      .select(
        'id, event_ref, type, title, event_date, severity, category:categories(name), recorder:app_users(full_name), observer:observers(name)',
      )
      .eq('employee_id', selectedId)
      .eq('status', 'active')
      .gte('event_date', sinceIso)
      .lte('event_date', toIso)
      .order('event_date', { ascending: false }),
  ])

  const emp = empRes.data as {
    full_name: string
    employee_code: string | null
    joining_date: string | null
    manager: unknown
    department: unknown
    designation: unknown
  } | null
  const signal = sigRes.data as EmployeeSignal | null

  type Ev = {
    id: string
    event_ref: string
    type: 'positive' | 'goofup'
    title: string
    event_date: string
    severity: Severity
    category: unknown
    recorder: unknown
    observer: unknown
  }
  const events = ((evRes.data ?? []) as Ev[]).map((e) => ({
    ...e,
    categoryName: (one(e.category) as { name: string } | null)?.name ?? 'Uncategorised',
    recordedBy: (one(e.recorder) as { full_name: string } | null)?.full_name ?? 'Unknown',
    observedBy: (one(e.observer) as { name: string } | null)?.name ?? null,
  }))

  const positives = events.filter((e) => e.type === 'positive').length
  const goofups = events.filter((e) => e.type === 'goofup').length
  const critical = events.filter((e) => e.type === 'goofup' && e.severity === 'critical').length
  const net = positives - goofups

  const kpis: {
    label: string
    value: string
    note: string
    tone: 'green' | 'amber' | 'red' | 'blue'
    icon: 'user' | 'star' | 'alert' | 'clock'
  }[] = [
    {
      label: 'RECOGNITIONS',
      value: String(positives),
      note: positives === 0 ? 'none recorded' : 'positive contributions',
      tone: 'green',
      icon: 'user',
    },
    {
      label: 'GOOFUPS',
      value: String(goofups),
      note: critical ? `${critical} critical` : goofups ? 'none critical' : 'none recorded',
      tone: 'amber',
      icon: 'star',
    },
    {
      label: 'NET BALANCE',
      value: `${net > 0 ? '+' : ''}${net}`,
      note: net > 0 ? 'recognition ahead' : net < 0 ? 'issues ahead' : 'level',
      tone: net < 0 ? 'red' : net > 0 ? 'green' : 'blue',
      icon: 'alert',
    },
    {
      label: 'LAST ACTIVITY',
      value: ago(signal?.days_since_any ?? null),
      note: signal?.active_weeks
        ? `active in ${signal.active_weeks} week${signal.active_weeks === 1 ? '' : 's'}`
        : 'no activity in window',
      tone: 'blue',
      icon: 'clock',
    },
  ]

  // Monthly buckets across the chosen window, oldest first. Capped at 12 so
  // a long window does not produce columns too thin to read.
  const monthKeys: { key: string; label: string }[] = []
  const cursor = new Date(sinceIso)
  cursor.setDate(1)
  const last = new Date(toIso)
  while (cursor <= last && monthKeys.length < 12) {
    monthKeys.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: cursor.toLocaleDateString('en-IN', {
        month: 'short',
        ...(spanDays > 400 ? { year: '2-digit' as const } : {}),
      }),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const months = monthKeys.map(({ key, label }) => {
    const inMonth = events.filter((e) => e.event_date.slice(0, 7) === key)
    return {
      label,
      pos: inMonth.filter((e) => e.type === 'positive').length,
      goof: inMonth.filter((e) => e.type === 'goofup').length,
    }
  })

  /**
   * The written summary. Every clause is assembled from a counted value —
   * nothing here is a judgement the data does not already support, because
   * this is the paragraph an MD will quote back at someone.
   */
  const summary: string[] = []
  summary.push(
    events.length === 0
      ? `No performance events were recorded for this employee between ${fmtShort(sinceIso)} and ${fmtShort(toIso)}.`
      : `${events.length} performance ${events.length === 1 ? 'event was' : 'events were'} recorded between ${fmtShort(sinceIso)} and ${fmtShort(toIso)} — ${positives} ${positives === 1 ? 'recognition' : 'recognitions'} and ${goofups} ${goofups === 1 ? 'goofup' : 'goofups'}.`,
  )
  if (critical > 0) {
    summary.push(
      `${critical} ${critical === 1 ? 'issue was' : 'issues were'} rated critical impact, which is what places this employee in the ${signal?.band ?? 'Attention'} band.`,
    )
  }
  if (signal?.repeat_category && (signal.repeat_count ?? 0) > 1) {
    summary.push(
      `Issues repeat in one area: ${signal.repeat_category} accounts for ${signal.repeat_count} of them, so the pattern is specific rather than general.`,
    )
  }
  if (signal?.trend_label && signal.trend_label !== 'Not enough data') {
    summary.push(`Direction of travel over the window: ${signal.trend_label.toLowerCase()}.`)
  }
  if (events.length > 0 && signal?.days_since_any !== null && (signal?.days_since_any ?? 0) > 30) {
    summary.push(
      `Nothing has been recorded for ${signal?.days_since_any} days, so this report reflects an older picture rather than current performance.`,
    )
  }

  const bandTone: 'green' | 'amber' | 'red' | 'blue' =
    signal?.band === 'Strong'
      ? 'green'
      : signal?.band === 'Attention'
        ? 'red'
        : signal?.band === 'Watch'
          ? 'amber'
          : 'blue'

  const impactTone = (sev: Severity): 'green' | 'amber' | 'red' | 'blue' =>
    sev === 'critical' ? 'red' : sev === 'high' ? 'amber' : sev === 'medium' ? 'blue' : 'green'

  const docEvents: DocEvent[] = events.map((e) => ({
    id: e.id,
    date: fmtFull(e.event_date),
    type: e.type,
    title: e.title,
    category: e.categoryName,
    impact: impactLabel(e.type, e.severity),
    impactTone: hasImpact(e.type) ? impactTone(e.severity) : null,
    recordedBy: e.recordedBy,
  }))

  /**
   * Insights are assembled from counted values, same rule as the summary —
   * each line states something the data shows and what it implies, never a
   * judgement the records do not support.
   */
  const insights: DocInsight[] = []
  if (critical > 0) {
    insights.push({
      icon: 'alert',
      tone: 'red',
      head: (
        <>
          <strong style={{ color: '#dd5a51' }}>{critical}</strong> critical goofup
          {critical === 1 ? '' : 's'} recorded
        </>
      ),
      sub: 'Needs immediate attention',
    })
  }
  if (signal?.days_since_any !== null && signal?.days_since_any !== undefined) {
    insights.push({
      icon: 'calendar',
      tone: 'blue',
      head: (
        <>
          Last activity <strong style={{ color: '#d99a24' }}>{signal.days_since_any}</strong> day
          {signal.days_since_any === 1 ? '' : 's'} ago
        </>
      ),
      sub: signal.days_since_any > 30 ? 'Record is going stale' : 'Consider engagement check-in',
    })
  }
  insights.push({
    icon: 'trend',
    tone: net < 0 ? 'red' : net > 0 ? 'green' : 'blue',
    head: <>Net balance {net > 0 ? `+${net}` : net}</>,
    sub: net < 0 ? 'Issues ahead – requires focus' : net > 0 ? 'Recognition ahead' : 'Level for the period',
  })
  if (positives === 0) {
    insights.push({
      icon: 'target',
      tone: 'green',
      head: <>No recognitions yet</>,
      sub: 'Encourage and appreciate contributions',
    })
  } else if (signal?.repeat_category) {
    insights.push({
      icon: 'target',
      tone: 'amber',
      head: <>Repeat area: {signal.repeat_category}</>,
      sub: `${signal.repeat_count} issues in the same category`,
    })
  }

  const preparedBy = 'Employee Tracking · LD Silk Mills'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="epi-no-print" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ReportActions
          employees={employees}
          selectedId={selectedId}
          from={sinceIso}
          to={toIso}
          filename={`performance-report-${(emp?.full_name ?? 'employee').replace(/\s+/g, '-').toLowerCase()}.csv`}
          rows={events.map((e) => ({
            Reference: e.event_ref,
            Date: e.event_date,
            Type: e.type === 'positive' ? 'Positive Contribution' : 'Goofup',
            Event: e.title,
            Category: e.categoryName,
            Impact: impactLabel(e.type, e.severity),
            'Observed by': e.observedBy ?? '',
            'Recorded by': e.recordedBy,
          }))}
        />
      </div>

      <ReportDocument
        generated={`${fmtFull(new Date())}`}
        name={emp?.full_name ?? '—'}
        initials={initials(emp?.full_name ?? '—')}
        code={emp?.employee_code ?? '—'}
        designation={(one(emp?.designation ?? null) as { title: string } | null)?.title ?? '—'}
        department={(one(emp?.department ?? null) as { name: string } | null)?.name ?? '—'}
        manager={(one(emp?.manager ?? null) as { full_name: string } | null)?.full_name ?? '—'}
        joined={emp?.joining_date ? fmtFull(emp.joining_date) : '—'}
        band={signal?.band ?? 'No signal'}
        bandTone={bandTone}
        periodLabel={`${spanDays} days (${fmtShort(sinceIso)} – ${fmtShort(toIso)})`}
        kpis={kpis}
        months={months}
        events={docEvents}
        insights={insights}
        summary={summary}
        preparedBy={preparedBy}
      />
    </div>
  )
}
