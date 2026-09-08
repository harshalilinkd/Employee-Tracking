'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cardStyle } from '@/lib/design'

/**
 * auth.users is shared across ten apps in this Supabase project. Signing in
 * successfully therefore proves nothing about access to THIS system — only
 * a row in employee_tracking.app_users does. This is that state, explained.
 *
 * The escape hatch must SIGN OUT, not just link to /login: the proxy sends
 * a signed-in user from /login back to /, so a plain link lands the person
 * right back on this screen and reads as a dead button.
 */
export function NoAccess({ email }: { email: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function signOutAndRetry() {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--epi-canvas)',
      }}
    >
      <div style={{ ...cardStyle, maxWidth: '460px', padding: '28px' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: 'var(--epi-neg-bg)',
            border: '1px solid var(--epi-neg-bd)',
            color: 'var(--epi-neg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '17px',
          }}
        >
          !
        </div>
        <h1 style={{ margin: '18px 0 0', fontSize: '21px', fontWeight: 700, letterSpacing: '-0.02em' }}>
          You do not have access to this system
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: '14px', lineHeight: 1.6, color: 'var(--epi-fg-2)' }}>
          You are signed in as <strong style={{ color: 'var(--epi-fg)' }}>{email}</strong>, but that account has
          not been granted access to Employee Tracking.
        </p>
        <p style={{ margin: '12px 0 0', fontSize: '14px', lineHeight: 1.6, color: 'var(--epi-fg-2)' }}>
          Access is granted by the MD&rsquo;s office. If you believe this is a mistake, ask them to add your
          account.
        </p>
        <button
          onClick={signOutAndRetry}
          disabled={busy}
          style={{
            marginTop: '22px',
            display: 'inline-flex',
            alignItems: 'center',
            height: '38px',
            padding: '0 16px',
            borderRadius: '8px',
            background: 'var(--epi-raised)',
            border: '1px solid var(--epi-border-2)',
            color: 'var(--epi-fg)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: busy ? 'progress' : 'pointer',
          }}
        >
          {busy ? 'Signing out…' : 'Sign out and use a different account'}
        </button>
      </div>
    </div>
  )
}
