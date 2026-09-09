'use client'

import { useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const FIELD: CSSProperties = {
  height: '46px',
  width: '100%',
  borderRadius: '10px',
  // A faint ground rather than pure white: the field now reads as a field on
  // a white sheet without needing a heavier border to say so.
  background: '#F7FAFA',
  border: '1px solid #dbe6e4',
  color: '#000000',
  fontSize: '14.5px',
  padding: '0 42px 0 40px',
  outline: 'none',
  transition: 'border-color 200ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 200ms cubic-bezier(0.2,0.8,0.2,1), background 200ms',
}

const FIELD_FOCUS: CSSProperties = {
  background: '#FFFFFF',
  borderColor: '#0e7c6b',
  boxShadow: '0 0 0 4px rgba(14,124,107,0.15)',
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [remember, setRemember] = useState(true)
  const [focus, setFocus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (err) {
      // Deliberately not distinguishing "no such user" from "wrong password":
      // this login sits in front of named employee records.
      setError(
        err.message.toLowerCase().includes('invalid')
          ? 'That email and password combination was not recognised.'
          : err.message,
      )
      return
    }

    router.push(next)
    router.refresh()
  }

  async function signInWithGoogle() {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (err) {
      setLoading(false)
      setError(err.message)
    }
  }

  return (
    <form onSubmit={signIn} style={{ width: '100%', color: '#000000' }}>
      <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em' }}>
        Welcome back
      </h2>
      <p style={{ margin: '9px 0 26px', fontSize: '14.5px', color: '#1a1a1a' }}>
        Sign in to continue to your workspace
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#000000' }}>Work email</span>
          <span style={{ position: 'relative', display: 'block' }}>
            <span
              style={{ position: 'absolute', left: '13px', top: '15px', color: '#454545', pointerEvents: 'none' }}
            >
              <Mail size={16} />
            </span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@ldgroup.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus('')}
              style={{ ...FIELD, ...(focus === 'email' ? FIELD_FOCUS : null) }}
            />
          </span>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, flex: 1, color: '#000000' }}>Password</span>
          </span>
          <span style={{ position: 'relative', display: 'block' }}>
            <span
              style={{ position: 'absolute', left: '13px', top: '15px', color: '#454545', pointerEvents: 'none' }}
            >
              <Lock size={16} />
            </span>
            <input
              type={reveal ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocus('pass')}
              onBlur={() => setFocus('')}
              style={{ ...FIELD, ...(focus === 'pass' ? FIELD_FOCUS : null) }}
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '8px',
                top: '8px',
                width: '30px',
                height: '30px',
                borderRadius: '7px',
                background: 'transparent',
                border: 0,
                color: '#1a1a1a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        {error ? (
          <div
            role="alert"
            style={{
              display: 'flex',
              gap: '9px',
              alignItems: 'flex-start',
              border: '1px solid rgba(245,158,11,0.34)',
              background: 'rgba(245,158,11,0.10)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              color: '#92400E',
              animation: 'epiIn 180ms cubic-bezier(0.2,0.8,0.2,1) both',
            }}
          >
            <AlertCircle size={16} style={{ flex: '0 0 16px', marginTop: '1px' }} />
            <span style={{ flex: 1, lineHeight: 1.45 }}>{error}</span>
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#3c534e' }}>
          <button
            type="button"
            role="checkbox"
            aria-checked={remember}
            aria-label="Keep me signed in on this device"
            onClick={() => setRemember((r) => !r)}
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: remember ? 'linear-gradient(135deg,#14907c,#0a5f52)' : '#FFFFFF',
              border: remember ? '1px solid #0e7c6b' : '1px solid rgba(10,10,10,0.20)',
              color: '#fff',
            }}
          >
            {remember ? <Check size={12} /> : null}
          </button>
          <span>Keep me signed in</span>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="epi-login-submit"
          style={{
            height: '48px',
            borderRadius: '10px',
            border: 0,
            background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '0.01em',
            cursor: loading ? 'progress' : 'pointer',
            opacity: loading ? 0.75 : 1,
            boxShadow: '0 8px 20px rgba(14,124,107,0.26)',
            transition: 'transform 160ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 200ms cubic-bezier(0.2,0.8,0.2,1)',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ flex: 1, height: '1px', background: '#e2ebe9' }} />
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#454545',
              whiteSpace: 'nowrap',
            }}
          >
            Or continue with
          </span>
          <span style={{ flex: 1, height: '1px', background: '#e2ebe9' }} />
        </div>

        {/* The canvas labels this "ELDEE GROUP SSO". Google is the provider
            actually enabled on this project and the accounts are gmail.com,
            so the button says what it does. */}
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={loading}
          className="epi-login-google"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '9px',
            height: '46px',
            borderRadius: '10px',
            background: '#FFFFFF',
            border: '1px solid #dbe6e4',
            color: '#000000',
            fontSize: '14.5px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 160ms, border-color 160ms',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.4z" />
            <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          <span>Continue with Google</span>
        </button>

        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#454545', textAlign: 'center' }}>
          Access is granted by the MD&rsquo;s office.
        </p>
      </div>
    </form>
  )
}
