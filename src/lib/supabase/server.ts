import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

function cookieAdapter(store: Awaited<ReturnType<typeof cookies>>) {
  return {
    getAll() {
      return store.getAll()
    },
    setAll(cookiesToSet: CookieToSet[]) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options))
      } catch {
        // Called from a Server Component, where cookies are read-only.
        // Middleware refreshes the session, so this is safe to ignore.
      }
    },
  }
}

/**
 * Pinned to the employee_tracking schema. This Supabase project hosts nine
 * other applications; nothing here should be able to address public or
 * another app's schema even by accident.
 */
export async function createClient() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { db: { schema: 'employee_tracking' }, cookies: cookieAdapter(store) },
  )
}

/** Auth lives in the `auth` schema, which the pinned client cannot reach. */
export async function createAuthClient() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: cookieAdapter(store) },
  )
}
