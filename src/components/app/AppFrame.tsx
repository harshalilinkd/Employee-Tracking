'use client'

import type { ReactNode } from 'react'
import { Shell } from './Shell'
import { RecordDrawer } from './RecordDrawer'
import { canRecord, type AppRole, type Category } from '@/lib/types'

interface EmployeeOption {
  id: string
  full_name: string
  department: string | null
}

export function AppFrame({
  children,
  fullName,
  email,
  role,
  appUserId,
  employeeId,
  employees,
  categories,
  alerts,
}: {
  children: ReactNode
  fullName: string
  email: string
  role: AppRole
  appUserId: string
  employeeId: string | null
  employees: EmployeeOption[]
  categories: Category[]
  alerts: { id: string; name: string; reason: string }[]
}) {
  return (
    <Shell
      user={{ fullName, email, role, employeeId }}
      alerts={alerts}
      drawer={({ open, intent, close }) =>
        canRecord(role) ? (
          <RecordDrawer
            open={open}
            intent={intent}
            close={close}
            employees={employees}
            categories={categories}
            appUserId={appUserId}
            currentUserName={fullName}
            selfEmployeeId={employeeId}
          />
        ) : null
      }
    >
      {children}
    </Shell>
  )
}
