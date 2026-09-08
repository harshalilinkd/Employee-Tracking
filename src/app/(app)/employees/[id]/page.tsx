import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { SignalBadge } from '@/components/app/SignalBadge'
import { EmptyState } from '@/components/app/EmptyState'
import { RecordCta, RecordTypeButton } from '@/components/app/RecordCta'
import { cardStyle, initials, labelCaps, pill, tableHeadStyle } from '@/lib/design'
import { ago, fmtFull, fmtMonth, fmtShort } from '@/lib/format'
import { ManagementNotes } from '@/components/app/ManagementNotes'
import { SEVERITY_LABELS, canRecord, isAdmin, type EmployeeSignal, type Severity } from '@/lib/types'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'positive', label: 'Positive Contributions' },
  { key: 'goofup', label: 'Goofups' },
] as const

export default async function EmployeeProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = 'timeline' } = await searchParams
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

  // Timeline grouped by month, newest first — a journal, not a table.
  const groups: { label: string; events: typeof events }[] = []
  for (const e of events) {
    const label = fmtMonth(e.event_date)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.events.push(e)
    else groups.push({ label, events: [e] })
  }

  const positives = allEvents.filter((e) => e.type === 'positive').length
  const goofups = allEvents.filter((e) => e.type === 'goofup').length

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

  const stats = [
    { label: 'Positive', value: positives, color: 'var(--epi-pos)' },
    { label: 'Goofups', value: goofups, color: goofups ? 'var(--epi-neg)' : 'var(--epi-fg)' },
    { label: 'Last activity', value: ago(signal?.days_since_any ?? null), color: 'var(--epi-fg)' },
  ]

  const meta = [
    ['Employee code', emp.employee_code ?? '—', true],
    ['Department', one(emp.department)?.name ?? '—', false],
    ['Designation', one(emp.designation)?.title ?? '—', false],
    ['Joined', emp.joining_date ? fmtFull(emp.joining_date) : '—', false],
    ['Reports to', one(emp.manager)?.full_name ?? '—', false],
    ['Email', emp.contact_email ?? '—', true],
  ] as const

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
            flex: '1 1 340px',
            minWidth: 0,
            padding: '16px 20px',
            display: 'flex',
            gap: '14px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              flex: '0 0 48px',
              borderRadius: '13px',
              background: 'linear-gradient(135deg, var(--epi-violet-bg), var(--epi-track))',
              border: '1px solid var(--epi-border-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17px',
              fontWeight: 700,
            }}
          >
            {initials(emp.full_name)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '21px', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                {emp.full_name}
              </h1>
              <span style={pill(emp.status === 'Active' ? 'green' : emp.status === 'On Hold' ? 'orange' : 'muted')}>
                {emp.status}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)', marginTop: '3px' }}>
              {one(emp.designation)?.title ?? '—'} · {one(emp.department)?.name ?? '—'}
            </div>
          </div>

          {mayRecord && !isSelf ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: '0 0 auto' }}>
              <RecordTypeButton type="positive" employeeId={emp.id} label="+ Positive" />
              <RecordTypeButton type="goofup" employeeId={emp.id} label="+ Goofup" />
            </div>
          ) : null}
        </div>

        {/* Record as a gridded mini-table — label above value so nothing truncates */}
        <div
          className="epi-record-block"
          style={{
            flex: '0 1 540px',
            minWidth: 0,
            borderLeft: '1px solid var(--epi-border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
          }}
        >
          {meta.map(([k, v, mono], i) => (
            <div
              key={k}
              style={{
                padding: '10px 14px',
                minWidth: 0,
                borderRight: (i + 1) % 3 === 0 ? 'none' : '1px solid var(--epi-border-soft)',
                borderBottom: i < 3 ? '1px solid var(--epi-border-soft)' : 'none',
              }}
            >
              <div style={{ ...labelCaps, fontSize: '10px', letterSpacing: '0.12em' }}>{k}</div>
              <div
                className={mono ? 'epi-mono' : undefined}
                title={v}
                style={{
                  fontSize: mono ? '12px' : '13px',
                  marginTop: '3px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: v === '—' ? 'var(--epi-fg-3)' : 'var(--epi-fg)',
                }}
              >
                {v}
              </div>
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

      {/* ---------------- Signal, one compact band ---------------- */}
      <div
        style={{
          ...cardStyle,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: '1 1 420px',
            minWidth: 0,
            padding: '12px 20px',
            display: 'flex',
            gap: '14px',
            alignItems: 'center',
          }}
        >
          <span style={{ ...labelCaps, fontSize: '10px', flex: '0 0 auto' }}>Signal</span>
          <SignalBadge band={signal?.band ?? 'No signal'} explanation={signal?.explanation} />
          <span style={{ fontSize: '13px', color: 'var(--epi-fg-2)', lineHeight: 1.45, minWidth: 0 }}>
            {signal?.explanation ?? 'No performance record in the last 90 days.'}
          </span>
        </div>

        <div
          className="epi-profile-stats"
          style={{
            flex: '0 1 360px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            borderLeft: '1px solid var(--epi-border)',
          }}
        >
          {stats.map((st, i) => (
            <div
              key={st.label}
              style={{
                padding: '12px 16px',
                borderLeft: i === 0 ? 'none' : '1px solid var(--epi-border-soft)',
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
              }}
            >
              <span
                className="epi-num"
                style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', color: st.color }}
              >
                {st.value}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- Tabs ---------------- */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--epi-border)', overflowX: 'auto' }}>
        {TABS.map((t) => {
          const active = tab === t.key
          const count = t.key === 'timeline' ? allEvents.length : allEvents.filter((e) => e.type === t.key).length
          return (
            <Link
              key={t.key}
              href={`/employees/${emp.id}?tab=${t.key}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 14px',
                fontSize: '14px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                color: active ? 'var(--epi-fg)' : 'var(--epi-fg-2)',
                borderBottom: active ? '2px solid var(--epi-violet)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.label}
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
                  background: active ? 'var(--epi-violet-bg)' : 'var(--epi-track)',
                  color: active ? 'var(--epi-violet)' : 'var(--epi-fg-3)',
                }}
              >
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* ---------------- Events, full gridlines ---------------- */}
      {events.length === 0 ? (
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
                  <span style={pill(e.type === 'positive' ? 'violet' : 'orange')}>
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
                style={{ ...cardStyle, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={pill(e.type === 'positive' ? 'violet' : 'orange')}>
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

      {cats.length > 0 ? (
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

      {/* Private context, kept off the report by design — see the component.
          Placed last so the record itself reads first; a note is background,
          not evidence. */}
      {mayNote ? (
        <ManagementNotes
          employeeId={emp.id}
          employeeName={emp.full_name}
          currentAppUserId={session!.appUser!.id}
        />
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1100px) {
              .epi-record-block { border-left: 0 !important; border-top: 1px solid var(--epi-border); }
            }
            @media (max-width: 900px) {
              .epi-profile-stats { border-left: 0 !important; border-top: 1px solid var(--epi-border); }
            }
            @media (max-width: 620px) {
              .epi-record-block { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
              .epi-profile-stats { grid-template-columns: repeat(3, 1fr) !important; }
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
