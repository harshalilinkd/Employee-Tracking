import { cache } from 'react'
import { createAuthClient, createClient } from './supabase/server'
import type { AppUser } from './types'

export interface Session {
  authUserId: string
  email: string
  appUser: AppUser | null
}

/**
 * Resolves the signed-in person to their row in employee_tracking.app_users.
 *
 * auth.users is shared with nine other applications in this Supabase
 * project, so a valid login proves nothing on its own. `appUser === null`
 * means "authenticated somewhere in this project, but not a user of this
 * system" and must be treated as no access.
 *
 * Wrapped in React cache() so a request that renders several server
 * components resolves the user once.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const auth = await createAuthClient()
  const {
    data: { user },
  } = await auth.auth.getUser()

  if (!user) return null

  const supabase = await createClient()
  const columns = 'id, auth_user_id, employee_id, full_name, email, role, is_active'

  const { data } = await supabase
    .from('app_users')
    .select(columns)
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  let appUser = (data as AppUser | null) ?? null

  // No linked row yet — an admin may have pre-authorised this person by email
  // before they had an account. Claim it, then re-read.
  if (!appUser) {
    const { data: claimedId } = await supabase.rpc('claim_app_user')
    if (claimedId) {
      const { data: claimed } = await supabase
        .from('app_users')
        .select(columns)
        .eq('id', claimedId as string)
        .maybeSingle()
      appUser = (claimed as AppUser | null) ?? null
    }
  }

  return {
    authUserId: user.id,
    email: user.email ?? '',
    appUser,
  }
})
