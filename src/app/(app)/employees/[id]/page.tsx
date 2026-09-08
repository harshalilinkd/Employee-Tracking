import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Briefcase, Building2, CalendarDays, Hash, Mail, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { EmptyState } from '@/components/app/EmptyState'
import { RecordCta, RecordTypeButton } from '@/components/app/RecordCta'
import {
  ProfileOverview,
  type HeatCell,
  type InsightRow,
  type OverviewEvent,
  type Tone,
} from '@/components/app/ProfileOverview'
import type { TrendPoint } from '@/components/app/PerformanceTrendCard'
import { cardStyle, labelCaps, pill, signalTone, tableHeadStyle } from '@/lib/design'
import { ago, fmtFull, fmtShort } from '@/lib/format'
import { SEVERITY_LABELS, canRecord, isAdmin, type EmployeeSignal, type Severity } from '@/lib/types'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'positive', label: 'Positive Contributions' },
  { key: 'goofup', label: 'Goofups' },
] as const

/** The same weights the signal engine uses, so heat cannot contradict a band. */
const SEV_W: Record<string, number> = { low: 1, medium: 2, high: 3.5, critical: 6 }

const IMPACT_TONE: Record<Severity, Tone> = {
  low: 'teal',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
}

export default async function EmployeeProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'overview' } = await searchParams
  const session = await getSession()
  const supabase = await createClient()

  const [empRes, sigRes, evRes] = await Promise.all([
    supabase
      .from('employees')
      .select(
        'id, full_name, employee_code, joining_date, status, contact_email, contact_phone, department:departments!employees_department_id_fkey(name), designation:designations(title), manager:manager_id(full_name)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('v_employee_signal').select('*').eq('employee_id', id).maybeSingle(),
    supabase
      .from('performance_events')
      .select(
        'id, event_ref, type, title, description, event_date, severity, tags, category:categories(name), recorder:app_users(full_name)',
      )
      .eq('employee_id', id)
      .eq('status', 'active')
      .order('event_date', { ascending: false }),
  ])

  // Either the employee does not exist, or RLS hides them from this user
  // (a Department Manager viewing someone outside their department). Both
  // resolve to "not found" — we never confirm the existence of a record
  // the viewer is not entitled to see.
  if (!empRes.data) notFound()

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

  type EmpRow = {
    id: string
    full_name: string
    employee_code: string | null
    joining_date: string | null
    status: string
    contact_email: string | null
    contact_phone: string | null
    department: { name: string } | { name: string }[] | null
    designation: { title: string } | { title: string }[] | null
    manager: { full_name: string } | { full_name: string }[] | null
  }
  const emp = empRes.data as EmpRow
  const signal = sigRes.data as EmployeeSignal | null

  type Ev = {
    id: string
    event_ref: string
    type: 'positive' | 'goofup'
    title: string
    description: string | null
    event_date: string
    severity: Severity
    tags: string[]
    category: { name: string } | { name: string }[] | null
    recorder: { full_name: string } | { full_name: string }[] | null
  }
  const allEvents = ((evRes.data ?? []) as Ev[]).map((e) => ({
    ...e,
    categoryName: one(e.category)?.name ?? 'Uncategorised',
    recordedBy: one(e.recorder)?.full_name ?? 'Unknown',
  }))

  const events = allEvents.filter((e) => (tab === 'timeline' ? true : e.type === tab))

  const positives = allEvents.filter((e) => e.type === 'positive').length
  const goofups = allEvents.filter((e) => e.type === 'goofup').length
  const criticalCount = allEvents.filter((e) => e.type === 'goofup' && e.severity === 'critical').length

  // Category pattern across goofups — the repeat-issue view.
  const catCounts = new Map<string, number>()
  for (const e of allEvents.filter((x) => x.type === 'goofup')) {
    catCounts.set(e.categoryName, (catCounts.get(e.categoryName) ?? 0) + 1)
  }
  const cats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const catMax = Math.max(1, ...cats.map((c) => c[1]))

  const mayRecord = canRecord(session?.appUser?.role)
  const isSelf = session?.appUser?.employee_id === emp.id
  const mayNote = isAdmin(session?.appUser?.role) && !!session?.appUser?.id

  const deptName = one(emp.department)?.name ?? '—'
  const desigName = one(emp.designation)?.title ?? '—'

  /* ---------------- Overview data ---------------- */

  // Twelve months of buckets, oldest first. The trend card slices the window
  // it needs; the heat table takes the last six.
  const monthKeys: string[] = []
  const trend: TrendPoint[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    trend.push({ label: d.toLocaleString('en-GB', { month: 'short' }), pos: 0, goof: 0 })
  }
  for (const e of allEvents) {
    const bucket = trend[monthKeys.findIndex((k) => e.event_date.startsWith(k))]
    if (!bucket) continue
    if (e.type === 'positive') bucket.pos += 1
    else bucket.goof += 1
  }

  const heatKeys = monthKeys.slice(-6)
  const heat: HeatCell[] = trend.slice(-6).map((t) => ({ label: t.label.toUpperCase(), load: 0, count: 0 }))
  for (const e of allEvents) {
    if (e.type !== 'goofup') continue
    const cell = heat[heatKeys.findIndex((k) => e.event_date.startsWith(k))]
    if (!cell) continue
    cell.load += SEV_W[e.severity] ?? 1
    cell.count += 1
  }

  const overviewEvents: OverviewEvent[] = allEvents.map((e) => ({
    id: e.id,
    date: fmtFull(e.event_date),
    type: e.type,
    title: e.title,
    category: e.categoryName,
    impact: SEVERITY_LABELS[e.severity],
    impactTone: IMPACT_TONE[e.severity],
    recordedBy: e.recordedBy,
  }))

  const days = signal?.days_since_any ?? null
  const lastActivitySub =
    days === null
      ? 'nothing recorded yet'
      : days <= 7
        ? 'active this week'
        : days <= 30
          ? `${Math.round(days / 7)} weeks ago`
          : 'no recent activity'

  // Every line pairs a counted observation with the action it implies.
  // Nothing here is inferred — each clause is backed by a figure on the page.
  const net = positives - goofups
  const insights: InsightRow[] = []
  if (criticalCount > 0) {
    insights.push({
      icon: 'alert',
      tone: 'red',
      head: `${criticalCount} critical goofup${criticalCount === 1 ? '' : 's'} recorded`,
      sub: 'Needs immediate attention',
      href: `/employees/${emp.id}?tab=goofup`,
    })
  }
  if (days !== null) {
    insights.push({
      icon: 'calendar',
      tone: 'teal',
      head: `Last activity ${ago(days).toLowerCase()}`,
      sub: days > 30 ? 'Consider an engagement check-in' : 'Recently active',
      href: `/employees/${emp.id}?tab=timeline`,
    })
  }
  insights.push({
    icon: 'target',
    tone: net < 0 ? 'red' : net > 0 ? 'green' : 'blue',
    head: `Net balance ${net > 0 ? `+${net}` : net}`,
    sub: net < 0 ? 'Issues ahead — requires focus' : net > 0 ? 'Recognition ahead' : 'Evenly balanced',
    href: `/employees/${emp.id}?tab=timeline`,
  })
  if (positives === 0) {
    insights.push({
      icon: 'trend',
      tone: 'teal',
      head: 'No recognitions yet',
      sub: 'Encourage and appreciate contributions',
      href: `/employees/${emp.id}?tab=positive`,
    })
  }

  /* ---------------- Signal band ---------------- */

  const band = signal?.band ?? 'No signal'
  const bandTone = signalTone(band)
  const muted = bandTone === 'muted'
  const bandColour = muted ? 'var(--epi-fg-3)' : `var(--epi-${bandTone})`
  const bandBg = muted ? 'var(--epi-track)' : `var(--epi-${bandTone}-bg)`
  const bandBd = muted ? 'var(--epi-border)' : `var(--epi-${bandTone}-bd)`

  // The view hands back one paragraph. Broken into its sentences it reads as
  // findings rather than as a wall, and the opening clause — the finding that
  // set the band — carries the weight.
  const sentences = (signal?.explanation ?? 'No performance record in the last 90 days.')
    .split(/(?<=\.)\s+/)
    .filter(Boolean)
  const lead = sentences[0] ?? ''
  const rest = sentences.slice(1)
  const dash = lead.indexOf('—')
  const leadHead = dash > 0 ? lead.slice(0, dash).trim() : lead
  const leadTail = dash > 0 ? lead.slice(dash) : ''

  const stats: { label: string; value: string; tone: Tone }[] = [
    { label: 'Positive', value: String(positives), tone: 'green' },
    { label: 'Goofups', value: String(goofups), tone: 'orange' },
    { label: 'Last activity', value: ago(days), tone: muted ? 'blue' : (bandTone as Tone) },
  ]

  const meta = [
    { icon: <Hash size={14} />, label: 'Employee code', value: emp.employee_code ?? '—', mono: true },
    { icon: <Building2 size={14} />, label: 'Department', value: deptName, mono: false },
    { icon: <Briefcase size={14} />, label: 'Designation', value: desigName, mono: false },
    {
      icon: <CalendarDays size={14} />,
      label: 'Joined',
      value: emp.joining_date ? fmtFull(emp.joining_date) : '—',
      mono: false,
    },
    { icon: <UserRound size={14} />, label: 'Reports to', value: one(emp.manager)?.full_name ?? '—', mono: false },
    { icon: <Mail size={14} />, label: 'Email', value: emp.contact_email ?? '—', mono: true },
  ]

  const TCOLS = '92px 100px minmax(220px,3fr) minmax(130px,1.2fr) 88px minmax(130px,1.1fr) 118px'
  const HEADS = ['Date', 'Type', 'Event', 'Category', 'Impact', 'Recorded by', 'Reference']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Link
        href="/settings?tab=Employee%20database"
        style={{ alignSelf: 'flex-start', color: 'var(--epi-fg-2)', fontSize: '13px', fontWeight: 500 }}
      >
        ← Back to employees
      </Link>

      {/* ---------------- Identity + record ---------------- */}
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', overflow: 'hidden' }}>
        <div
          style={{
            flex: '1 1 380px',
            minWidth: 0,
            padding: '18px 22px',
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              flex: '0 0 56px',
              borderRadius: '999px',
              background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '19px',
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            {emp.full_name
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0] ?? '')
              .join('')
              .toUpperCase()}
          </div>

          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.028em', lineHeight: 1.15 }}>
                {emp.full_name}
              </h1>
              <span style={pill(emp.status === 'Active' ? 'green' : emp.status === 'On Hold' ? 'orange' : 'muted')}>
                {emp.status}
              </span>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--epi-fg-2)', marginTop: '4px' }}>
              {desigName} · {deptName}
            </div>
          </div>

          {mayRecord && !isSelf ? (
            <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap', flex: '0 0 auto' }}>
              <RecordTypeButton type="positive" employeeId={emp.id} label="Positive" solid />
              <RecordTypeButton type="goofup" employeeId={emp.id} label="Goofup" />
            </div>
          ) : null}
        </div>

        {/* The record as a labelled grid — icon, label, value — so every field
            is scannable in one pass and nothing truncates silently. */}
        <div
          className="epi-record-block"
          style={{
            flex: '0 1 560px',
            minWidth: 0,
            borderLeft: '1px solid var(--epi-border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
          }}
        >
          {meta.map((m) => (
            <div
              key={m.label}
              style={{ padding: '13px 16px', minWidth: 0, display: 'flex', gap: '10px', alignItems: 'flex-start' }}
            >
              <span
                style={{
                  width: '28px',
                  height: '28px',
                  flex: '0 0 28px',
                  borderRadius: '8px',
                  background: 'var(--epi-teal-bg)',
                  color: 'var(--epi-teal)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {m.icon}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ ...labelCaps, fontSize: '9.5px', letterSpacing: '0.12em', display: 'block' }}>
                  {m.label}
                </span>
                <span
                  className={m.mono ? 'epi-mono' : undefined}
                  title={m.value}
                  style={{
                    display: 'block',
                    fontSize: m.mono ? '12px' : '13px',
                    marginTop: '3px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: m.value === '—' ? 'var(--epi-fg-3)' : 'var(--epi-fg)',
                  }}
                >
                  {m.value}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {isSelf ? (
        <div
          style={{
            ...cardStyle,
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--epi-orange)',
            borderColor: 'var(--epi-orange-bd)',
            background: 'var(--epi-orange-bg)',
          }}
        >
          This is your own record. Performance events cannot be recorded about yourself.
        </div>
      ) : null}

      {/* ---------------- Signal ---------------- */}
      <div className="epi-signal-band" style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
            padding: '15px 18px',
            borderRadius: '14px',
            background: bandBg,
            border: `1px solid ${bandBd}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '13px', flex: '0 0 auto' }}>
            <span
              aria-hidden
              style={{
                width: '38px',
                height: '38px',
                flex: '0 0 38px',
                borderRadius: '999px',
                background: bandColour,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              !
            </span>
            <span>
              <span style={{ ...labelCaps, fontSize: '10px', display: 'block' }}>Signal</span>
              <span
                style={{
                  display: 'block',
                  fontSize: '19px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: bandColour,
                  marginTop: '1px',
                }}
              >
                {band}
              </span>
            </span>
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 0, fontSize: '13px', lineHeight: 1.55, color: 'var(--epi-fg-2)' }}>
            <div>
              <strong style={{ color: 'var(--epi-fg-strong)' }}>{leadHead}</strong>
              {leadTail}
            </div>
            {rest.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>

        <div className="epi-signal-stats" style={{ display: 'flex', gap: '12px', flex: '0 0 auto' }}>
          {stats.map((st) => (
            <div
              key={st.label}
              style={{
                minWidth: '104px',
                padding: '13px 16px',
                borderRadius: '14px',
                background: `var(--epi-${st.tone}-bg)`,
                border: `1px solid var(--epi-${st.tone}-bd)`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <span
                className="epi-num"
                style={{
                  fontSize: '23px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  color: `var(--epi-${st.tone})`,
                }}
              >
                {st.value}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--epi-fg-2)', marginTop: '2px' }}>{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- Tabs ---------------- */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--epi-border)', overflowX: 'auto' }}>
        {TABS.map((t) => {
          const active = tab === t.key
          const count =
            t.key === 'overview'
              ? null
              : t.key === 'timeline'
                ? allEvents.length
                : allEvents.filter((e) => e.type === t.key).length
          return (
            <Link
              key={t.key}
              href={`/employees/${emp.id}?tab=${t.key}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 15px',
                fontSize: '14px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                color: active ? 'var(--epi-teal)' : 'var(--epi-fg-2)',
                borderBottom: active ? '2px solid var(--epi-teal)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.label}
              {count === null ? null : (
                <span
                  className="epi-num"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    minWidth: '20px',
                    height: '20px',
                    padding: '0 6px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? 'var(--epi-teal-bg)' : 'var(--epi-track)',
                    color: active ? 'var(--epi-teal)' : 'var(--epi-fg-3)',
                  }}
                >
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {tab === 'overview' ? (
        <ProfileOverview
          employeeId={emp.id}
          employeeName={emp.full_name}
          department={deptName}
          designation={desigName}
          positives={positives}
          goofups={goofups}
          lastActivity={ago(days)}
          lastActivitySub={lastActivitySub}
          recognitionSub={positives === 0 ? 'none recorded' : `${positives} recorded`}
          goofupSub={criticalCount ? `${criticalCount} critical` : 'none critical'}
          trend={trend}
          events={overviewEvents}
          heat={heat}
          insights={insights}
          mayNote={mayNote}
          currentAppUserId={session?.appUser?.id ?? ''}
        />
      ) : events.length === 0 ? (
        <EmptyState
          title="No records in this view"
          body={`Change the tab, or record the first performance event for ${emp.full_name}.`}
          action={mayRecord && !isSelf ? <RecordCta employeeId={emp.id} /> : undefined}
        />
      ) : (
        <>
          <div
            className="epi-table-desktop epi-scroll-x"
            style={{ ...cardStyle, overflow: 'hidden', overflowX: 'auto' }}
          >
            <div
              className="epi-xls-head"
              style={{ minWidth: '960px', display: 'grid', gridTemplateColumns: TCOLS }}
            >
              {HEADS.map((h) => (
                <span key={h} style={{ ...tableHeadStyle, padding: '10px 13px' }}>
                  {h}
                </span>
              ))}
            </div>

            {events.map((e) => (
              <div
                key={e.id}
                className="epi-row epi-xls"
                style={{ minWidth: '960px', display: 'grid', gridTemplateColumns: TCOLS, alignItems: 'center' }}
              >
                <Cell mono muted>
                  {fmtShort(e.event_date)}
                </Cell>
                <Cell>
                  <span style={pill(e.type === 'positive' ? 'green' : 'orange')}>
                    {e.type === 'positive' ? 'Positive' : 'Goofup'}
                  </span>
                </Cell>
                <Cell title={e.description ?? e.title} bold>
                  {e.title}
                </Cell>
                <Cell muted>{e.categoryName}</Cell>
                <Cell>{SEVERITY_LABELS[e.severity]}</Cell>
                <Cell muted>{e.recordedBy}</Cell>
                <Cell mono muted>
                  {e.event_ref}
                </Cell>
              </div>
            ))}
          </div>

          <div className="epi-cards-mobile">
            {events.map((e) => (
              <div
                key={e.id}
                style={{
                  ...cardStyle,
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={pill(e.type === 'positive' ? 'green' : 'orange')}>
                    {e.type === 'positive' ? 'Positive' : 'Goofup'}
                  </span>
                  <span className="epi-num" style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
                    {fmtShort(e.event_date)}
                  </span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.35 }}>{e.title}</div>
                {e.description ? (
                  <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)', lineHeight: 1.5 }}>{e.description}</div>
                ) : null}
                <div style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
                  {e.categoryName} · {SEVERITY_LABELS[e.severity]} impact · {e.recordedBy}
                </div>
              </div>
            ))}
          </div>
          <span className="epi-scroll-hint">Swipe sideways to see all columns →</span>
        </>
      )}

      {tab !== 'overview' && cats.length > 0 ? (
        <div style={{ ...cardStyle, padding: '16px 18px', maxWidth: '480px' }}>
          <div style={{ ...labelCaps, marginBottom: '12px' }}>Where issues cluster</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {cats.map(([name, count]) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', fontSize: '13px' }}>
                  <span style={{ flex: 1, color: 'var(--epi-fg-strong)' }}>{name}</span>
                  <span className="epi-num" style={{ color: 'var(--epi-fg-3)', fontWeight: 600 }}>
                    {count}
                  </span>
                </div>
                <div style={{ height: '5px', borderRadius: '999px', background: 'var(--epi-track)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(count / catMax) * 100}%`,
                      borderRadius: '999px',
                      background: 'var(--epi-orange)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Overview: a wide work column and a narrow "so what" column.
               Inside the work column, summary and trend share the first row
               and the two tables span both. */
            .epi-ov {
              display: grid;
              grid-template-columns: minmax(0, 2.3fr) minmax(0, 1fr);
              gap: 14px;
              align-items: start;
            }
            .epi-ov-main {
              display: grid;
              grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
              gap: 14px;
              align-items: start;
            }
            .epi-ov-main > .epi-ov-wide { grid-column: 1 / -1; }
            .epi-ov-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

            @media (max-width: 1340px) {
              .epi-ov { grid-template-columns: minmax(0, 1fr); }
            }
            @media (max-width: 1100px) {
              .epi-ov-main { grid-template-columns: minmax(0, 1fr); }
              .epi-record-block { border-left: 0 !important; border-top: 1px solid var(--epi-border); }
            }
            @media (max-width: 1000px) {
              .epi-signal-band { flex-wrap: wrap; }
              .epi-signal-stats { flex: 1 1 100%; }
              .epi-signal-stats > div { flex: 1; }
            }
            @media (max-width: 640px) {
              .epi-ov-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
              .epi-record-block { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
              .epi-signal-stats { flex-wrap: wrap; }
              .epi-signal-stats > div { min-width: 0; flex: 1 1 30%; }
            }
          `,
        }}
      />
    </div>
  )
}

function Cell({
  children,
  mono,
  muted,
  bold,
  title,
}: {
  children: React.ReactNode
  mono?: boolean
  muted?: boolean
  bold?: boolean
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
          color: muted ? 'var(--epi-fg-2)' : 'var(--epi-fg)',
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
