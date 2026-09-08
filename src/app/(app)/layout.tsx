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

  const [{ data: employees }, { data: categories }] = await Promise.all([
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
  ])

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
    >
      {children}
    </AppFrame>
  )
}
