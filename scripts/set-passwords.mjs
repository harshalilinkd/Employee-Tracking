/**
 * Give every active app user an email + password login.
 *
 * Password = their first name + 123 (e.g. "Harshali Bhopale" -> "Harshali123").
 *
 * Run once:
 *
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/set-passwords.mjs          # preview
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/set-passwords.mjs --apply  # do it
 *
 * On Windows PowerShell:
 *
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/set-passwords.mjs --apply
 *
 * The key is Supabase -> Settings -> API -> service_role. It bypasses RLS, so
 * do not commit it, do not paste it into a chat, and unset it afterwards.
 *
 * Why the Admin API rather than SQL: setting auth.users.encrypted_password by
 * hand also requires an auth.identities row for the email provider, and that
 * table's shape differs between GoTrue versions. createUser/updateUserById do
 * both correctly on whatever version this project is running.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')

// .env.local holds the project URL; the service key never goes in a file.
function envLocal(key) {
  try {
    const line = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith(`${key}=`))
    return line ? line.slice(key.length + 1).trim() : undefined
  } catch {
    return undefined
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? envLocal('NEXT_PUBLIC_SUPABASE_URL')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  console.error('No Supabase URL. Expected NEXT_PUBLIC_SUPABASE_URL in the environment or .env.local.')
  process.exit(1)
}
if (!serviceKey) {
  console.error('No SUPABASE_SERVICE_ROLE_KEY in the environment.')
  console.error('Supabase -> Settings -> API -> service_role, then re-run.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const db = createClient(url, serviceKey, {
  db: { schema: 'employee_tracking' },
  auth: { autoRefreshToken: false, persistSession: false },
})

/** First name, capitalised as stored, plus 123. */
function passwordFor(fullName) {
  return `${String(fullName).trim().split(/\s+/)[0]}123`
}

const { data: users, error } = await db
  .from('app_users')
  .select('full_name, email, role, is_active')
  .eq('is_active', true)
  .order('full_name')

if (error) {
  console.error('Could not read app_users:', error.message)
  process.exit(1)
}
if (!users?.length) {
  console.error('No active app users found.')
  process.exit(1)
}

// One page of auth users is plenty for this project; raise perPage if it grows.
const { data: authList, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listErr) {
  console.error('Could not list auth users:', listErr.message)
  process.exit(1)
}
const byEmail = new Map(authList.users.map((u) => [u.email?.toLowerCase(), u]))

console.log(APPLY ? 'Setting passwords…\n' : 'PREVIEW — nothing is changed. Re-run with --apply.\n')

const rows = []
for (const u of users) {
  const password = passwordFor(u.full_name)
  const existing = byEmail.get(u.email.toLowerCase())
  let action = existing ? 'password set' : 'account created'
  let note = ''

  // Supabase rejects anything under 6 characters; a very short first name
  // would fail silently at sign-in time rather than here.
  if (password.length < 6) {
    rows.push({ email: u.email, password, action: 'SKIPPED', note: 'under 6 characters' })
    continue
  }

  if (APPLY) {
    const res = existing
      ? await admin.auth.admin.updateUserById(existing.id, { password })
      : await admin.auth.admin.createUser({
          email: u.email,
          password,
          email_confirm: true, // no confirmation mail; they sign in immediately
          user_metadata: { full_name: u.full_name },
        })
    if (res.error) {
      action = 'FAILED'
      note = res.error.message
    }
  } else {
    action = existing ? 'would set password' : 'would create account'
  }

  rows.push({ email: u.email, password, action, note })
}

console.table(rows)

if (!APPLY) {
  console.log('\nRe-run with --apply to make these changes.')
} else {
  console.log('\nDone. Google sign-in keeps working for everyone; this only adds the password route.')
  console.log('Ask each person to change their password after first sign-in.')
}
