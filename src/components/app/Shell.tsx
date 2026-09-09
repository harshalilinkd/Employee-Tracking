'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
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
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AlertsPanel, type Alert } from './AlertsPanel'
import { initials, primaryButton } from '@/lib/design'
import { ROLE_LABELS, canRecord, type AppRole } from '@/lib/types'

/**
 * The theme lives in localStorage, which is an external store — so it is read
 * through useSyncExternalStore rather than copied into state by an effect.
 * The inline script in the root layout has already stamped the attribute
 * before paint, so there is no flash and no hydration mismatch.
 */
const THEME_EVENT = 'epi-theme-change'

function subscribeToTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(THEME_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readTheme(): 'dark' | 'light' {
  return localStorage.getItem('epi-theme') === 'dark' ? 'dark' : 'light'
}

/**
 * The sidebar can be narrowed to a rail of icons.
 *
 * On a laptop the 236px sidebar is the single largest fixed cost on the
 * screen, and the tables that had to stack for want of width get 168px of it
 * back when it is a rail — enough that the charts pair again at 1244 instead
 * of 1412, and the employee matrix at 1350 instead of 1518.
 *
 * The attribute on <html> is the source of truth, not React state: it is set
 * by the bootstrap script before first paint, so the rail is never briefly
 * the wrong width. React reads it only to draw the toggle.
 */
const RAIL_EVENT = 'epi-rail-change'

function subscribeToRail(onChange: () => void) {
  window.addEventListener(RAIL_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(RAIL_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readRail(): boolean {
  return document.documentElement.getAttribute('data-epi-rail') === '1'
}

function toggleRail() {
  const next = !readRail()
  const root = document.documentElement
  if (next) root.setAttribute('data-epi-rail', '1')
  else root.removeAttribute('data-epi-rail')
  try {
    localStorage.setItem('epi-sidebar', next ? 'rail' : 'full')
  } catch {
    // A browser refusing storage still gets the rail for this session.
  }
  window.dispatchEvent(new Event(RAIL_EVENT))
}

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

/**
 * The wordmark, used in the sidebar and again in the mobile header.
 *
 * The mark is the same diverging bar chart as the favicon (src/app/icon.svg),
 * so the browser tab and the app carry one identity: recognition rises above
 * the balance line, issues fall below it. Drawn as shapes rather than
 * lettering so it survives being scaled down to the collapsed rail, where
 * the wordmark text is hidden and only this tile remains.
 */
function BrandMark({ size }: { size: number }) {
  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        flex: `0 0 ${size}px`,
        borderRadius: `${Math.round(size * 0.29)}px`,
        background: 'linear-gradient(135deg,#17a186 0%,#0e7c6b 55%,#0a5f52 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 18px rgba(23,161,134,0.28)',
      }}
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 64 64" aria-hidden="true">
        <rect x="9" y="34" width="46" height="2.2" rx="1.1" fill="#ffffff" opacity="0.45" />
        <rect x="12" y="19" width="10" height="15" rx="2.5" fill="#ffffff" />
        <rect x="27" y="36.2" width="10" height="15" rx="2.5" fill="#f3b155" />
        <rect x="42" y="12" width="10" height="22" rx="2.5" fill="#ffffff" />
      </svg>
    </span>
  )
}

/**
 * Both words are set identically — same size, weight and colour. The earlier
 * two-tone treatment made "Tracking" read as a subtitle rather than half of
 * the name.
 *
 * In the sidebar the name stacks. Between the 30px mark and the 28px collapse
 * toggle only about 112px of the 236px column is left, and "Employee
 * Tracking" on one line needs closer to 145px — which is why it was running
 * under the toggle. Stacked, the longest word is ~66px and it fits with room
 * to spare. The mobile header has the width for a single line, so it keeps
 * one.
 */
function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: compact ? '9px' : '10px', minWidth: 0 }}>
      <BrandMark size={compact ? 28 : 30} />
      <span
        className="epi-rail-hide"
        style={{
          fontSize: compact ? '15px' : '14.5px',
          fontWeight: 800,
          letterSpacing: '-0.005em',
          lineHeight: compact ? 1.15 : 1.22,
          color: '#fff',
          whiteSpace: compact ? 'nowrap' : 'normal',
          minWidth: 0,
        }}
      >
        Employee{compact ? ' ' : <br />}Tracking
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
  alerts,
  alertTotal,
  alertCritical,
}: {
  user: ShellUser
  children: ReactNode
  drawer: (args: { open: boolean; intent: RecordIntent; close: () => void }) => ReactNode
  alerts: Alert[]
  alertTotal: number
  alertCritical: number
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => 'light' as const)
  // Only for the toggle's own icon — the width itself comes from CSS reading
  // the attribute the bootstrap script already set.
  const railed = useSyncExternalStore(subscribeToRail, readRail, () => false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [intent, setIntent] = useState<RecordIntent>({})
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)

  const toggleTheme = useCallback(() => {
    const next = readTheme() === 'dark' ? 'light' : 'dark'
    localStorage.setItem('epi-theme', next)
    document.documentElement.setAttribute('data-epi-theme', next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [])

  // Every link in the drawer closes it on click, so the only way it can
  // outlive a navigation is browser back/forward. Subscribing to that is what
  // effects are for; running setState on every pathname change was not.
  useEffect(() => {
    const onPop = () => setMenuOpen(false)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

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

  // Clicking outside the alert panel, or pressing Escape, closes it.
  useEffect(() => {
    if (!alertsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAlertsOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('[data-alerts]')) setAlertsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick)
    }
  }, [alertsOpen])

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
          <div
            className="epi-rail-head"
            style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <Wordmark />
            <button
              onClick={toggleRail}
              title={railed ? 'Expand the sidebar' : 'Collapse the sidebar'}
              aria-label={railed ? 'Expand the sidebar' : 'Collapse the sidebar'}
              aria-expanded={!railed}
              className="epi-rail-toggle"
              style={{
                marginLeft: 'auto',
                width: '28px',
                height: '28px',
                flex: '0 0 28px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.16)',
                color: 'rgba(255,255,255,0.78)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {railed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div
              className="epi-rail-hide"
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
                  title={n.label}
                  className="epi-rail-item"
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
                  <n.Icon size={17} style={{ flex: '0 0 17px' }} />
                  <span className="epi-rail-hide">{n.label}</span>
                </Link>
              )
            })}
          </nav>

          <div
            className="epi-rail-user"
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
            <div className="epi-rail-hide" style={{ minWidth: 0, flex: 1 }}>
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

              <div data-alerts style={{ marginLeft: 'auto', position: 'relative', flex: '0 0 auto' }}>
                <button
                  onClick={() => setAlertsOpen((o) => !o)}
                  aria-expanded={alertsOpen}
                  aria-label={
                    alertTotal ? `${alertTotal} needing attention` : 'Nobody needs attention'
                  }
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '9px',
                    border: 0,
                    background: alertTotal ? 'rgba(255,255,255,0.16)' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <AlertTriangle size={17} />
                  {alertTotal > 0 ? (
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
                      {alertTotal > 9 ? '9+' : alertTotal}
                    </span>
                  ) : null}
                </button>

                {alertsOpen ? <AlertsPanel alerts={alerts} total={alertTotal} critical={alertCritical} onGo={() => setAlertsOpen(false)} /> : null}
              </div>
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

            <div data-alerts style={{ position: 'relative', flex: '0 0 auto' }}>
              <button
                onClick={() => setAlertsOpen((o) => !o)}
                aria-expanded={alertsOpen}
                aria-label={
                  alertTotal
                    ? `${alertTotal} ${alertTotal === 1 ? 'person needs' : 'people need'} attention`
                    : 'Nobody needs attention'
                }
                title={
                  alertTotal
                    ? `${alertTotal} ${alertTotal === 1 ? 'person needs' : 'people need'} attention`
                    : 'Nobody needs attention right now'
                }
                className="epi-alerts-btn"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: alertTotal ? 'var(--epi-red-bg)' : 'var(--epi-input)',
                  border: `1px solid ${alertTotal ? 'var(--epi-red-bd)' : 'var(--epi-border)'}`,
                  color: alertTotal ? 'var(--epi-red)' : 'var(--epi-fg-2)',
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={15} />
                {alertTotal > 0 ? (
                  <span
                    className="epi-num"
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      minWidth: '17px',
                      height: '17px',
                      padding: '0 4px',
                      borderRadius: '999px',
                      background: 'var(--epi-red)',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--epi-surface)',
                    }}
                  >
                    {alertTotal > 9 ? '9+' : alertTotal}
                  </span>
                ) : null}
              </button>

              {alertsOpen ? <AlertsPanel alerts={alerts} total={alertTotal} critical={alertCritical} onGo={() => setAlertsOpen(false)} /> : null}
            </div>

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

        {/* Mounted only while open, so each session starts clean without an
            effect resetting fields after the first render. */}
        {recordOpen ? drawer({ open: recordOpen, intent, close: () => setRecordOpen(false) }) : null}
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
