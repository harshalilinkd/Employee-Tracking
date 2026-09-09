import Link from 'next/link'
import { EmployeeAdmin, type EmployeeRow } from '@/components/app/EmployeeAdmin'
import { UserAccessAdmin, type UserRow } from '@/components/app/UserAccessAdmin'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import { CategoryAdmin } from '@/components/app/CategoryAdmin'
import { ObserverAdmin, type ObserverRow } from '@/components/app/ObserverAdmin'
import { GeneralAdmin, ReadOnlyNote } from '@/components/app/GeneralAdmin'
import { Gauge } from 'lucide-react'
import { cardStyle, labelCaps, pill, tableHeadStyle } from '@/lib/design'
import { SEVERITY_LABELS, SEVERITY_ORDER, isAdmin, type Severity } from '@/lib/types'
import { AuditLogGroups, type AuditGroup } from '@/components/app/AuditLogGroups'

export const dynamic = 'force-dynamic'

/** canvas: settingsTabsList */
const TABS = [
  'Employee database',
  'Performance categories',
  'Observers',
  'User access',
  'Audit log',
  'General',
] as const


export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = (TABS as readonly string[]).includes(params.tab ?? '')
    ? (params.tab as (typeof TABS)[number])
    : 'Employee database'

  const session = await getSession()
  const admin = isAdmin(session?.appUser?.role)
  const supabase = await createClient()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 className="epi-h1" style={{ margin: 0, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em' }}>
        Settings
      </h1>

      <div
        className="epi-tabs"
        style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--epi-border)', overflow: 'auto' }}
      >
        {TABS.map((t) => {
          const active = tab === t
          return (
            <Link
              key={t}
              href={`/settings?tab=${encodeURIComponent(t)}`}
              className={`epi-settings-tab${active ? ' epi-tab-active' : ''}`}
              style={{
                padding: '11px 15px',
                fontSize: '15.5px',
                // Weight, not colour, carries the selection. The palette went
                // black across the board, so --epi-fg (#000) and --epi-fg-2
                // (#1a1a1a) are now indistinguishable — the old active tab was
                // relying on a difference that no longer exists.
                fontWeight: active ? 800 : 500,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                color: active ? 'var(--epi-fg)' : 'var(--epi-fg-2)',
                background: active ? 'var(--epi-teal-bg)' : 'transparent',
                borderRadius: '9px 9px 0 0',
                borderBottom: active ? '3px solid var(--epi-teal)' : '3px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t}
            </Link>
          )
        })}
      </div>

      {tab === 'Employee database' ? (
        <EmployeeDatabase supabase={supabase} canEdit={admin || session?.appUser?.role === 'hr'} />
      ) : null}
      {tab === 'Performance categories' ? <Categories supabase={supabase} canEdit={admin} /> : null}
      {tab === 'Observers' ? <Observers supabase={supabase} canEdit={admin} /> : null}
      {tab === 'User access' ? (
        <UserAccess supabase={supabase} canManage={admin} currentUserId={session?.appUser?.id ?? ''} />
      ) : null}
      {tab === 'Audit log' ? <AuditLog supabase={supabase} admin={admin} /> : null}
      {tab === 'General' ? <General supabase={supabase} canEdit={admin} /> : null}
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function EmployeeDatabase({ supabase, canEdit }: { supabase: any; canEdit: boolean }) {
  const [{ data }, { data: depts }, { data: desigs }] = await Promise.all([
    supabase
      .from('employees')
      .select(
        'id, full_name, employee_code, joining_date, status, department_id, designation_id, manager_id, contact_email, contact_phone',
      )
      .order('full_name'),
    supabase.from('departments').select('id, name').eq('is_active', true).order('name'),
    supabase.from('designations').select('id, title').eq('is_active', true).order('title'),
  ])

  const employees = (data ?? []) as any[]
  const departments = (depts ?? []) as { id: string; name: string }[]
  const designations = (desigs ?? []) as { id: string; title: string }[]

  // Manager names resolve from the rows we already have. PostgREST needs an
  // awkward hint for a self-referential embed and silently returns direct
  // reports instead of the manager if you get it wrong — a lookup is safer.
  const nameById = new Map(employees.map((e) => [e.id, e.full_name as string]))
  const deptById = new Map(departments.map((d) => [d.id, d.name]))
  const desigById = new Map(designations.map((d) => [d.id, d.title]))

  const rows: EmployeeRow[] = employees.map((e) => ({
    id: e.id,
    full_name: e.full_name,
    employee_code: e.employee_code,
    joining_date: e.joining_date,
    status: e.status,
    department_id: e.department_id,
    designation_id: e.designation_id,
    manager_id: e.manager_id,
    contact_email: e.contact_email,
    contact_phone: e.contact_phone,
    departmentName: e.department_id ? (deptById.get(e.department_id) ?? '—') : '—',
    designationName: e.designation_id ? (desigById.get(e.designation_id) ?? '—') : '—',
    managerName: e.manager_id ? (nameById.get(e.manager_id) ?? '—') : '—',
  }))

  return (
    <EmployeeAdmin
      rows={rows}
      departments={departments}
      designations={designations}
      deptCount={departments.length}
      canEdit={canEdit}
    />
  )
}

async function Categories({ supabase, canEdit }: { supabase: any; canEdit: boolean }) {
  const { data } = await supabase
    .from('categories')
    .select('id, name, applies_to, default_severity, is_active, sort_order')
    .order('applies_to')
    .order('sort_order')

  return (
    <>
      <CategoryAdmin rows={(data ?? []) as any[]} canEdit={canEdit} />

      <div style={{ ...cardStyle, padding: '18px' }}>
        <div style={{ ...labelCaps, marginBottom: '12px' }}>Impact levels</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {SEVERITY_ORDER.map((s) => (
            <span key={s} style={pill(s === 'critical' ? 'neg' : s === 'high' ? 'warn' : 'muted')}>
              {SEVERITY_LABELS[s as Severity]}
            </span>
          ))}
        </div>
        <p style={{ margin: '12px 0 0', fontSize: '13px', color: 'var(--epi-fg-2)', lineHeight: 1.6 }}>
          Impact levels are fixed — the performance signal is weighted against them, so adding a level would
          change every score already recorded.
        </p>
      </div>
    </>
  )
}

async function Observers({ supabase, canEdit }: { supabase: any; canEdit: boolean }) {
  const [{ data }, { data: used }] = await Promise.all([
    supabase
      .from('observers')
      .select('id, name, role_note, is_active, sort_order')
      .order('is_active', { ascending: false })
      .order('sort_order')
      .order('name'),
    // Usage counts drive the delete guard: the FK is ON DELETE SET NULL, so
    // deleting a named observer would silently blank it on past records.
    supabase.from('performance_events').select('observed_by').not('observed_by', 'is', null),
  ])

  const counts = new Map<string, number>()
  for (const row of (used ?? []) as { observed_by: string }[]) {
    counts.set(row.observed_by, (counts.get(row.observed_by) ?? 0) + 1)
  }

  const rows: ObserverRow[] = ((data ?? []) as any[]).map((o) => ({
    id: o.id,
    name: o.name,
    role_note: o.role_note,
    is_active: o.is_active,
    sort_order: o.sort_order,
    useCount: counts.get(o.id) ?? 0,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <ObserverAdmin rows={rows} canEdit={canEdit} />
      {canEdit ? null : <ReadOnlyNote />}
    </div>
  )
}

async function UserAccess({
  supabase,
  canManage,
  currentUserId,
}: {
  supabase: any
  canManage: boolean
  currentUserId: string
}) {
  const [{ data }, { data: emps }] = await Promise.all([
    supabase
      .from('app_users')
      .select('id, full_name, email, role, is_active, auth_user_id, employee_id')
      .order('role'),
    supabase.from('employees').select('id, full_name').order('full_name'),
  ])

  const rows: UserRow[] = ((data ?? []) as any[]).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    is_active: u.is_active,
    linked: Boolean(u.auth_user_id),
    employee_id: u.employee_id,
  }))

  return (
    <UserAccessAdmin
      rows={rows}
      employees={(emps ?? []) as { id: string; full_name: string }[]}
      canManage={canManage}
      currentUserId={currentUserId}
    />
  )
}

async function AuditLog({ supabase, admin }: { supabase: any; admin: boolean }) {
  if (!admin) {
    return (
      <div style={{ ...cardStyle, padding: '28px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Audit log</h2>
        <p style={{ margin: '10px 0 0', fontSize: '14px', color: 'var(--epi-fg-2)', lineHeight: 1.6 }}>
          The audit log is visible to Super Admin and Management only. This is enforced in the database, not
          just hidden here.
        </p>
      </div>
    )
  }

  const { data } = await supabase
    .from('audit_log')
    .select('id, actor_email, entity_type, entity_id, action, field_changed, old_value, new_value, created_at')
    .order('created_at', { ascending: false })
    .limit(600)

  const all = (data ?? []) as any[]

  // Trigger-written rows with no actor are the database's own work — the
  // one-time import backfill wrote one per department, which is what buried
  // the handful of entries anyone actually cares about. Those are counted
  // and summarised rather than listed.
  const rows = all.filter((r) => r.actor_email)
  const systemCount = all.length - rows.length

  // One group per record, newest activity first. The rows arrive newest
  // first, so each group's entries are already in the right order and the
  // group order follows whichever record was touched most recently.
  const byRecord = new Map<string, AuditGroup>()
  for (const r of rows) {
    const key = `${r.entity_type}:${r.entity_id}`
    const existing = byRecord.get(key)
    const entry = {
      id: r.id,
      actor_email: r.actor_email,
      action: r.action,
      field_changed: r.field_changed,
      old_value: r.old_value,
      new_value: r.new_value,
      created_at: r.created_at,
    }
    if (existing) existing.entries.push(entry)
    else
      byRecord.set(key, {
        key,
        entityType: r.entity_type,
        entityId: r.entity_id,
        title: '',
        subtitle: null,
        entries: [entry],
      })
  }

  const groups = [...byRecord.values()]

  // The log stores ids, not names. Resolve them per entity type in one query
  // each, rather than a lookup per row.
  const idsOf = (t: string) => groups.filter((g) => g.entityType === t).map((g) => g.entityId)
  const nameMap = new Map<string, { title: string; subtitle: string | null }>()

  const resolve = async (
    table: string,
    columns: string,
    build: (row: any) => { title: string; subtitle: string | null },
  ) => {
    const ids = idsOf(table)
    if (ids.length === 0) return
    const { data: found } = await supabase.from(table).select(columns).in('id', ids)
    for (const row of (found ?? []) as any[]) {
      nameMap.set(`${table}:${row.id}`, build(row))
    }
  }

  await Promise.all([
    resolve('performance_events', 'id, event_ref, title', (r) => ({
      title: `${r.event_ref} — ${r.title}`,
      subtitle: null,
    })),
    resolve('employees', 'id, full_name, employee_code', (r) => ({
      title: r.full_name,
      subtitle: r.employee_code ?? null,
    })),
    resolve('categories', 'id, name, applies_to', (r) => ({
      title: r.name,
      subtitle: r.applies_to === 'positive' ? 'Positive contribution' : 'Goofup',
    })),
    resolve('app_users', 'id, full_name, email', (r) => ({ title: r.full_name, subtitle: r.email })),
    resolve('departments', 'id, name', (r) => ({ title: r.name, subtitle: null })),
    resolve('designations', 'id, title', (r) => ({ title: r.title, subtitle: null })),
    resolve('observers', 'id, name, role_note', (r) => ({ title: r.name, subtitle: r.role_note ?? null })),
  ])

  for (const g of groups) {
    const found = nameMap.get(`${g.entityType}:${g.entityId}`)
    if (found) {
      g.title = found.title
      g.subtitle = found.subtitle
    } else {
      // A deleted record has no row left to name it, so the delete entry's
      // own summary is the only thing that still knows what it was.
      const deleted = g.entries.find((e) => e.action === 'delete')
      g.title = deleted?.old_value ?? 'Deleted record'
      g.subtitle = 'no longer exists'
    }
  }

  return (
    <>
      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.018em' }}>Audit log</h2>
      <p style={{ margin: '-8px 0 0', fontSize: '14px', color: 'var(--epi-fg-2)' }}>
        Grouped by record. Open one to see everything that has been done to it, in order. Written by
        database triggers, so it records the change even if it did not go through this app.
      </p>

      {systemCount ? (
        <div
          style={{
            ...cardStyle,
            padding: '12px 16px',
            fontSize: '13px',
            color: 'var(--epi-fg-2)',
            display: 'flex',
            gap: '9px',
            alignItems: 'center',
          }}
        >
          <span style={pill('muted')}>system</span>
          <span>
            {systemCount} automatic {systemCount === 1 ? 'entry' : 'entries'} from the one-time data import are
            hidden — they were written by the database, not by a person.
          </span>
        </div>
      ) : null}

      <AuditLogGroups groups={groups} />
    </>
  )
}

async function General({ supabase, canEdit }: { supabase: any; canEdit: boolean }) {
  const { data } = await supabase.from('settings').select('key, value')
  const settings = Object.fromEntries(((data ?? []) as any[]).map((s) => [s.key, s.value]))
  const signalRaw = (settings.signal_config ?? {}) as Record<string, unknown>
  const generalRaw = (settings.general ?? {}) as Record<string, unknown>
  const weights = (signalRaw.severity_weight ?? {}) as Record<string, number>
  const minEvents = Number(signalRaw.min_events_for_signal ?? 3)

  const BANDS: { band: string; tone: 'green' | 'blue' | 'orange' | 'red' | 'muted'; when: string }[] = [
    { band: 'Strong', tone: 'green', when: 'Recognition clearly outweighs issues, consistently.' },
    { band: 'Stable', tone: 'blue', when: 'Balanced record, no concerning pattern.' },
    { band: 'Watch', tone: 'orange', when: 'Issues building, or a repeat in one category.' },
    { band: 'Attention', tone: 'red', when: 'Any critical goofup, or a heavy weighted issue load.' },
    { band: 'No signal', tone: 'muted', when: `Fewer than ${minEvents} events — nothing is inferred.` },
  ]

  return (
    <>
      <GeneralAdmin
        canEdit={canEdit}
        raw={{ general: generalRaw, signal_config: signalRaw }}
        general={{
          organisation: String(generalRaw.organisation ?? 'LD Silk Mills'),
          timezone: String(generalRaw.timezone ?? 'Asia/Kolkata'),
          date_format: String(generalRaw.date_format ?? 'dd MMM yyyy'),
        }}
        signal={{
          window_days: Number(signalRaw.window_days ?? 90),
          min_events_for_signal: minEvents,
          recency_decay_days: Number(signalRaw.recency_decay_days ?? 45),
          severity_weight: {
            low: Number(weights.low ?? 1),
            medium: Number(weights.medium ?? 2),
            high: Number(weights.high ?? 3.5),
            critical: Number(weights.critical ?? 6),
          },
        }}
      />

      <SettingsCard icon={<Gauge size={15} />} title="What each band means">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: '10px' }}>
          {BANDS.map((b) => (
            <div
              key={b.band}
              style={{
                borderRadius: '10px',
                border: `1px solid var(--epi-${b.tone === 'muted' ? 'border' : `${b.tone}-bd`})`,
                background: b.tone === 'muted' ? 'var(--epi-canvas)' : `var(--epi-${b.tone}-bg)`,
                padding: '11px 13px',
              }}
            >
              <div
                style={{
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: b.tone === 'muted' ? 'var(--epi-fg-3)' : `var(--epi-${b.tone})`,
                }}
              >
                {b.band}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--epi-fg-2)', marginTop: '4px', lineHeight: 1.5 }}>
                {b.when}
              </div>
            </div>
          ))}
        </div>

        <p style={{ margin: '14px 0 0', fontSize: '13px', color: 'var(--epi-fg-2)', lineHeight: 1.65 }}>
          The signal is <strong>not</strong> positive minus goofup. It weights each event by impact, decays it
          by age, and reads trend and consistency across the window. Fewer than {minEvents} events shows
          &ldquo;No signal&rdquo;, never &ldquo;Stable&rdquo; — the system does not guess.
        </p>
      </SettingsCard>

      <ReadOnlyNote />
    </>
  )
}

function SettingsCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{ ...cardStyle, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '13px' }}>
        <span
          style={{
            width: '28px',
            height: '28px',
            flex: '0 0 28px',
            borderRadius: '8px',
            background: 'var(--epi-violet-bg)',
            color: 'var(--epi-violet)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </span>
        <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.012em' }}>{title}</h3>
      </div>
      {children}
    </section>
  )
}
function Cell({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  // Inner span carries the truncation — see EmployeeAdmin's Cell.
  return (
    <span style={{ minWidth: 0, display: 'block' }}>
      <span
        className={mono ? 'epi-mono' : undefined}
        style={{
          display: 'block',
          fontSize: '13px',
          color: 'var(--epi-fg-2)',
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
