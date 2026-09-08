import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { EmptyState } from '@/components/app/EmptyState'
import { RecordCta } from '@/components/app/RecordCta'
import { ExportCsvButton } from '@/components/app/ExportCsvButton'
import { LedgerFilters } from '@/components/app/LedgerFilters'
import { LedgerTable } from '@/components/app/LedgerTable'
import { cardStyle, iconStyle, pill, tableHeadStyle } from '@/lib/design'
import { fmtFull, fmtShort } from '@/lib/format'
import { SEVERITY_LABELS, isAdmin, type Category, type Severity } from '@/lib/types'

export const dynamic = 'force-dynamic'


interface Search {
  q?: string
  emp?: string
  dept?: string
  type?: string
  cat?: string
  sev?: string
  range?: string
}

const RANGE_DAYS: Record<string, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const sp = await searchParams
  const session = await getSession()
  const supabase = await createClient()

  const range = sp.range ?? 'quarter'
  const days = RANGE_DAYS[range]
  let since: string | null = null
  if (days) {
    const d = new Date()
    d.setDate(d.getDate() - days)
    since = d.toISOString().slice(0, 10)
  }

  let query = supabase
    .from('performance_events')
    .select(
      'id, event_ref, type, title, description, event_date, severity, status, created_at, recorded_by, employee:employees(id, full_name), category:categories(id, name), department:departments(id, name), recorder:app_users(full_name)',
    )
    .eq('status', 'active')
    .order('event_date', { ascending: false })
    .limit(300)

  if (since) query = query.gte('event_date', since)
  if (sp.emp) query = query.eq('employee_id', sp.emp)
  if (sp.dept) query = query.eq('department_id', sp.dept)
  if (sp.type === 'positive' || sp.type === 'goofup') query = query.eq('type', sp.type)
  if (sp.cat) query = query.eq('category_id', sp.cat)
  if (sp.sev) query = query.eq('severity', sp.sev)

  const [eventsRes, deptRes, catRes, empRes] = await Promise.all([
    query,
    supabase.from('departments').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('categories')
      .select('id, name, applies_to, default_severity, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order'),
    supabase.from('employees').select('id, full_name').eq('status', 'Active').order('full_name'),
  ])

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

  type Row = {
    id: string
    event_ref: string
    type: 'positive' | 'goofup'
    title: string
    description: string | null
    event_date: string
    severity: Severity
    status: string
    created_at: string
    recorded_by: string
    employee: { id: string; full_name: string } | { id: string; full_name: string }[] | null
    category: { id: string; name: string } | { id: string; name: string }[] | null
    department: { id: string; name: string } | { id: string; name: string }[] | null
    recorder: { full_name: string } | { full_name: string }[] | null
  }

  let rows = ((eventsRes.data ?? []) as Row[]).map((e) => ({
    ...e,
    employeeRef: one(e.employee),
    categoryName: one(e.category)?.name ?? 'Uncategorised',
    departmentName: one(e.department)?.name ?? '—',
    recordedBy: one(e.recorder)?.full_name ?? 'Unknown',
  }))

  // Free-text search is applied here rather than in SQL so it can span the
  // employee name, title, description and reference in one pass.
  if (sp.q) {
    const q = sp.q.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.employeeRef?.full_name ?? '').toLowerCase().includes(q) ||
        r.event_ref.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q),
    )
  }

  const hasFilters = Boolean(
    sp.q || sp.emp || sp.dept || sp.type || sp.cat || sp.sev || (sp.range && sp.range !== 'quarter'),
  )

  const csvRows = rows.map((r) => ({
    Reference: r.event_ref,
    Date: r.event_date,
    Employee: r.employeeRef?.full_name ?? '',
    Department: r.departmentName,
    Type: r.type === 'positive' ? 'Positive Contribution' : 'Goofup',
    Title: r.title,
    Description: r.description ?? '',
    Category: r.categoryName,
    Impact: SEVERITY_LABELS[r.severity],
    'Recorded by': r.recordedBy,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        className="epi-ledger-head"
        style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <div className="epi-ledger-title" style={{ flex: '1 1 300px' }}>
          <h1 className="epi-h1" style={{ margin: 0, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Performance activity
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--epi-fg-2)' }}>
            {rows.length} record{rows.length === 1 ? '' : 's'}
          </p>
        </div>
        {/* Phones get the export icon here beside Record; on desktop the CSV
            button stays in the filter bar where there is room for a label. */}
        <div className="epi-ledger-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ExportCsvButton rows={csvRows} iconOnly className="epi-only-mobile" />
          <RecordCta label="+ Record" />
        </div>
      </div>

      <LedgerFilters
        departments={(deptRes.data ?? []) as { id: string; name: string }[]}
        categories={(catRes.data ?? []) as { id: string; name: string; applies_to: string }[]}
        employees={(empRes.data ?? []) as { id: string; full_name: string }[]}
        rows={csvRows}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No records match these filters' : 'No performance records yet'}
          body={
            hasFilters
              ? 'Try widening the date range or clearing the department and category filters.'
              : 'Record the first performance event and it will appear here.'
          }
          action={hasFilters ? <Link href="/performance">Reset filters</Link> : <RecordCta />}
        />
      ) : (
        <LedgerTable
          rows={rows.map((r) => ({
            id: r.id,
            event_ref: r.event_ref,
            type: r.type,
            title: r.title,
            description: r.description,
            event_date: r.event_date,
            severity: r.severity,
            status: r.status,
            created_at: r.created_at,
            recorded_by: r.recorded_by,
            employeeId: r.employeeRef?.id ?? null,
            employeeName: r.employeeRef?.full_name ?? 'Unknown',
            categoryId: one(r.category)?.id ?? null,
            categoryName: r.categoryName,
            departmentName: r.departmentName,
            recordedBy: r.recordedBy,
          }))}
          categories={(catRes.data ?? []) as Category[]}
          currentAppUserId={session?.appUser?.id ?? ''}
          isAdmin={isAdmin(session?.appUser?.role)}
        />
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 767px) {
              .epi-desktop-only { display: none !important; }
              .epi-mobile-only { display: flex !important; }
            }
          `,
        }}
      />
    </div>
  )
}
