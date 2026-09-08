'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { initials, primaryButton } from '@/lib/design'
import { ROLE_LABELS, canRecord, type AppRole } from '@/lib/types'

interface ShellUser {
  fullName: string
  email: string
  role: AppRole
  employeeId: string | null
}

interface RecordIntent {
  type?: 'positive' | 'goofup'
  employeeId?: string
}
const RecordContext = createContext<{ open: (intent?: RecordIntent) => void }>({
  open: () => {},
})
export const useRecord = () => useContext(RecordContext)

/**
 * Four items, matching the design canvas's navMain exactly. SPEC §6.1 lists
 * eight across two groups; the canvas supersedes it — the Employee Database
 * and Categories live inside Settings as tabs, and Insights sits with Reports.
 */
const NAV = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/performance', label: 'Performance', Icon: BarChart3 },
  { href: '/reports', label: 'Reports', Icon: ClipboardList },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const

const MOBILE_NAV = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/performance', label: 'Performance', Icon: BarChart3 },
  { href: '/reports', label: 'Reports', Icon: ClipboardList },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const

/** The wordmark, used in the sidebar and again in the mobile header. */
function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: compact ? '9px' : '11px', minWidth: 0 }}>
      <span
        style={{
          fontSize: compact ? '19px' : '23px',
          fontWeight: 800,
          letterSpacing: '0.01em',
          lineHeight: 1,
          color: '#fff',
        }}
      >
        LD
      </span>
      <span
        style={{
          width: '1px',
          height: compact ? '17px' : '20px',
          background: 'rgba(255,255,255,0.3)',
        }}
      />
      <span
        style={{
          fontSize: compact ? '14px' : '15px',
          fontWeight: 500,
          letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.94)',
          whiteSpace: 'nowrap',
        }}
      >
        SILK MILLS
      </span>
    </span>
  )
}

/** canvas crumbMap */
function crumbFor(pathname: string, settingsTab: string | null): string {
  if (pathname.startsWith('/performance')) return 'Activity'
  if (pathname.startsWith('/reports')) return 'Reports & insights'
  if (pathname.startsWith('/settings')) return settingsTab ?? 'Employee database'
  if (pathname.startsWith('/employees/')) return 'Profile'
  return 'Dashboard'
}



export function Shell({
  user,
  children,
  drawer,
  attentionCount,
}: {
  user: ShellUser
  children: ReactNode
  drawer: (args: { open: boolean; intent: RecordIntent; close: () => void }) => ReactNode
  attentionCount: number
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [recordOpen, setRecordOpen] = useState(false)
  const [intent, setIntent] = useState<RecordIntent>({})
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('epi-theme') as 'dark' | 'light' | null) ?? 'light'
    setTheme(saved)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const nextTheme = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('epi-theme', nextTheme)
      document.documentElement.setAttribute('data-epi-theme', nextTheme)
      return nextTheme
    })
  }, [])

  // The drawer must not survive a navigation — otherwise tapping a link
  // leaves it open over the page it just went to.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const open = useCallback((next?: RecordIntent) => {
    setIntent(next ?? {})
    setRecordOpen(true)
  }, [])

  const ctx = useMemo(() => ({ open }), [open])
  const mayRecord = canRecord(user.role)
  const crumb = crumbFor(pathname, params.get('tab'))

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) router.push(`/performance?q=${encodeURIComponent(q)}`)
  }

  return (
    <RecordContext.Provider value={ctx}>
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--epi-canvas)',
          color: 'var(--epi-fg)',
          fontSize: '15px',
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        <aside
          className="epi-sidebar"
          style={{
            width: '236px',
            flex: '0 0 236px',
            background: 'linear-gradient(180deg, var(--epi-sidebar) 0%, var(--epi-sidebar-2) 100%)',
            color: '#fff',
            padding: '22px 14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '26px',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '0 8px' }}>
            <Wordmark />
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.42)',
                padding: '0 10px 10px',
              }}
            >
              Workspace
            </div>
            {NAV.map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '11px',
                    height: '42px',
                    padding: '0 12px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: active ? 600 : 500,
                    textDecoration: 'none',
                    color: active ? '#fff' : 'rgba(255,255,255,0.66)',
                    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  }}
                >
                  <n.Icon size={17} />
                  {n.label}
                </Link>
              )
            })}
          </nav>

          <div
            style={{
              marginTop: 'auto',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: '14px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                flex: '0 0 32px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {initials(user.fullName)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.fullName}
              </div>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.55)' }}>{ROLE_LABELS[user.role]}</div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              style={{
                width: '28px',
                height: '28px',
                flex: '0 0 28px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </aside>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <header
            className="epi-header"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 30,
              background: 'var(--epi-header-bg)',
              backdropFilter: 'blur(8px)',
              borderBottom: '1px solid var(--epi-border)',
              padding: '12px 20px',
              display: 'flex',
              gap: '14px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {/* Mobile header band — the wordmark on the brand colour, matching
                the sidebar it replaces on a phone. */}
            <div className="epi-mobile-logo" style={{ display: 'none', alignItems: 'center', gap: '12px', flex: 1 }}>
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                style={{
                  width: '32px',
                  height: '32px',
                  flex: '0 0 32px',
                  border: 0,
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <Menu size={20} />
              </button>

              <Wordmark compact />

              <Link
                href="/#management-attention"
                aria-label={
                  attentionCount
                    ? `${attentionCount} needing attention`
                    : 'Nobody needs attention'
                }
                style={{
                  marginLeft: 'auto',
                  position: 'relative',
                  color: '#fff',
                  /* A 36px box keeps the mark centred against the wordmark and
                     gives the badge room to sit inside the header rather than
                     clipping against its top edge. */
                  width: '36px',
                  height: '36px',
                  flex: '0 0 36px',
                  borderRadius: '9px',
                  background: attentionCount ? 'rgba(255,255,255,0.14)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={17} />
                {attentionCount > 0 ? (
                  <span
                    className="epi-num"
                    style={{
                      position: 'absolute',
                      top: '3px',
                      right: '2px',
                      minWidth: '15px',
                      height: '15px',
                      padding: '0 3px',
                      borderRadius: '999px',
                      background: '#e0525f',
                      color: '#fff',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {attentionCount > 9 ? '9+' : attentionCount}
                  </span>
                ) : null}
              </Link>
            </div>

            <div className="epi-crumb" style={{ minWidth: 0, flex: '0 1 auto' }}>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--epi-fg-3)',
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}
              >
                <span>Performance</span>
                <span>/</span>
                <span style={{ color: 'var(--epi-fg-2)' }}>{crumb}</span>
              </div>
            </div>

            <form
              onSubmit={submitSearch}
              className="epi-search"
              style={{ flex: '1 1 220px', minWidth: '160px', position: 'relative' }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees, events, departments…"
                aria-label="Search"
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--epi-input)',
                  border: '1px solid var(--epi-border)',
                  color: 'var(--epi-fg)',
                  padding: '0 12px 0 32px',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <Search
                size={14}
                style={{ position: 'absolute', left: '11px', top: '11px', color: 'var(--epi-fg-3)' }}
              />
            </form>

            {mayRecord ? (
              <button onClick={() => open()} className="epi-record-btn" style={primaryButton}>
                <span style={{ fontSize: '15px' }}>+</span>
                <span className="epi-record-label">Record Performance</span>
              </button>
            ) : null}

            <button
              onClick={toggleTheme}
              className="epi-theme-btn"
              title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--epi-input)',
                border: '1px solid var(--epi-border)',
                color: 'var(--epi-fg-2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <Link
              href="/#management-attention"
              aria-label={
                attentionCount
                  ? `${attentionCount} ${attentionCount === 1 ? 'employee needs' : 'employees need'} attention`
                  : 'Nobody needs attention'
              }
              title={
                attentionCount
                  ? `${attentionCount} ${attentionCount === 1 ? 'employee needs' : 'employees need'} attention`
                  : 'Nobody needs attention right now'
              }
              className="epi-alerts-btn"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: attentionCount ? 'var(--epi-red-bg)' : 'var(--epi-input)',
                border: `1px solid ${attentionCount ? 'var(--epi-red-bd)' : 'var(--epi-border)'}`,
                color: attentionCount ? 'var(--epi-red)' : 'var(--epi-fg-2)',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={15} />
              {attentionCount > 0 ? (
                <span
                  className="epi-num"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    borderRadius: '999px',
                    background: 'var(--epi-red)',
                    color: '#fff',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--epi-surface)',
                  }}
                >
                  {attentionCount > 9 ? '9+' : attentionCount}
                </span>
              ) : null}
            </Link>
          </header>

          <main
            className="epi-main"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '20px 18px 96px',
              animation: 'epiUp 200ms cubic-bezier(0.2,0.8,0.2,1)',
            }}
          >
            {children}
          </main>
        </div>

        {/* Mobile menu. The bottom bar covers navigation, but the sidebar it
            replaces also held the account and the only way to sign out — on a
            phone there was no route to either. */}
        {menuOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setMenuOpen(false)
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 90,
              background: 'rgba(4, 20, 17, 0.5)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
              display: 'flex',
            }}
          >
            <div
              style={{
                width: 'min(280px, 84vw)',
                height: '100%',
                background: 'linear-gradient(180deg, var(--epi-sidebar) 0%, var(--epi-sidebar-2) 100%)',
                color: '#fff',
                padding: '18px 14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '22px',
                overflowY: 'auto',
                animation: 'epiDrawerIn 220ms cubic-bezier(0.2,0.8,0.2,1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 6px' }}>
                <Wordmark compact />
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  style={{
                    marginLeft: 'auto',
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.8)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.42)',
                    padding: '0 10px 8px',
                  }}
                >
                  Workspace
                </div>
                {NAV.map((n) => {
                  const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '11px',
                        height: '46px',
                        padding: '0 12px',
                        borderRadius: '10px',
                        fontSize: '14.5px',
                        fontWeight: active ? 600 : 500,
                        textDecoration: 'none',
                        color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                      }}
                    >
                      <n.Icon size={17} />
                      {n.label}
                    </Link>
                  )
                })}
              </nav>

              <div
                style={{
                  marginTop: 'auto',
                  borderTop: '1px solid rgba(255,255,255,0.12)',
                  paddingTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span
                    style={{
                      width: '34px',
                      height: '34px',
                      flex: '0 0 34px',
                      borderRadius: '999px',
                      background: 'rgba(255,255,255,0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12.5px',
                      fontWeight: 700,
                    }}
                  >
                    {initials(user.fullName)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.fullName}
                    </span>
                    <span style={{ display: 'block', fontSize: '11.5px', color: 'rgba(255,255,255,0.55)' }}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </span>
                </div>

                <button
                  onClick={signOut}
                  style={{
                    height: '44px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '9px',
                  }}
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <nav
          className="epi-bottom-nav"
          style={{
            display: 'none',
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            background: 'var(--epi-nav-bg)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid var(--epi-border)',
            padding: '8px 6px calc(8px + env(safe-area-inset-bottom))',
          }}
        >
          {MOBILE_NAV.map((n) => {
            const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  flex: 1,
                  minHeight: '48px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: active ? 'var(--epi-teal)' : 'var(--epi-fg-3)',
                  textDecoration: 'none',
                }}
              >
                <n.Icon size={18} />
                <span style={{ fontSize: '10.5px' }}>{n.label}</span>
              </Link>
            )
          })}
          {mayRecord ? (
            <button
              onClick={() => open()}
              aria-label="Record performance"
              style={{
                flex: 1,
                minHeight: '48px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'transparent',
                border: 0,
                color: 'var(--epi-fg-2)',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '7px',
                  background: 'linear-gradient(135deg,#14907c,#0a5f52)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  lineHeight: 1,
                }}
              >
                +
              </span>
              <span>Record</span>
            </button>
          ) : null}
        </nav>

        {drawer({ open: recordOpen, intent, close: () => setRecordOpen(false) })}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1023px) {
              .epi-sidebar { display: none !important; }
              .epi-mobile-logo { display: flex !important; }
              .epi-bottom-nav { display: flex !important; }
              .epi-crumb { display: none !important; }
              .epi-record-label { display: none !important; }
            }
          `,
        }}
      />
    </RecordContext.Provider>
  )
}
