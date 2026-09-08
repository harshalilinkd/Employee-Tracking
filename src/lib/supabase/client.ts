'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Every client is pinned to the employee_tracking schema. This Supabase
 * project hosts nine other applications; nothing here should be able to
 * address public or another app's schema even by accident.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { db: { schema: 'employee_tracking' } },
  )
}
