import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { AppFrame } from '@/components/app/AppFrame'
import { NoAccess } from '@/components/app/NoAccess'
import type { Category } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  // Authenticated against this Supabase project, but not a user of THIS
  // system. auth.users is shared with nine other apps, so this is an
  // expected state, not an error — it gets an explanation, not a crash.
  if (!session.appUser) {
    return <NoAccess email={session.email} />
  }

  const supabase = await createClient()

  const [{ data: employees }, { data: categories }, { data: attentionRows, count: attentionTotal }] =
    await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, status, department:departments!employees_department_id_fkey(name)')
      .eq('status', 'Active')
      .order('full_name'),
    supabase
      .from('categories')
      .select('id, name, applies_to, default_severity, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order'),
    // The header alert names the people, not just a number — a count alone
    // gave no idea who or why. RLS scopes this per role, so a department
    // manager sees their own department only.
    // Only the worst few are listed; the exact count comes back with them so
    // the panel can say "5 of 23" rather than silently truncating.
    supabase
      .from('v_employee_signal')
      .select('employee_id, full_name, issue_load, critical_goofups, repeat_category', {
        count: 'exact',
      })
      .eq('band', 'Attention')
      .order('critical_goofups', { ascending: false })
      .order('issue_load', { ascending: false })
      .limit(5),
  ])

  type AttentionRow = {
    employee_id: string
    full_name: string
    issue_load: number
    critical_goofups: number
    repeat_category: string | null
  }

  type EmployeeRow = {
    id: string
    full_name: string
    department: { name: string } | { name: string }[] | null
  }

  const employeeOptions = ((employees ?? []) as EmployeeRow[]).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    department: Array.isArray(e.department)
      ? (e.department[0]?.name ?? null)
      : (e.department?.name ?? null),
  }))

  return (
    <AppFrame
      fullName={session.appUser.full_name}
      email={session.appUser.email}
      role={session.appUser.role}
      appUserId={session.appUser.id}
      employeeId={session.appUser.employee_id}
      employees={employeeOptions}
      categories={(categories ?? []) as Category[]}
      alerts={(attentionRows ?? []).map((a: AttentionRow) => ({
        id: a.employee_id,
        name: a.full_name,
        load: Number(a.issue_load),
        critical: a.critical_goofups,
        reason:
          a.critical_goofups > 0
            ? `${a.critical_goofups} critical ${a.critical_goofups === 1 ? 'issue' : 'issues'}`
            : a.repeat_category
              ? `Repeated: ${a.repeat_category}`
              : 'Heavy issue load',
      }))}
      alertTotal={attentionTotal ?? 0}
      alertCritical={(attentionRows ?? []).filter((a: AttentionRow) => a.critical_goofups > 0).length}
    >
      {children}
    </AppFrame>
  )
}
