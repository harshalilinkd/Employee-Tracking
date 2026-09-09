'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bookmark, Check, Loader2, Trash2, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { describeWriteError } from '@/lib/errors'

/** Every filter the ledger reads from the URL. A view is exactly this set. */
export const FILTER_KEYS = ['q', 'emp', 'dept', 'type', 'cat', 'sev', 'range'] as const

interface View {
  id: string
  name: string
  filters: Record<string, string>
  is_shared: boolean
  owner_id: string
}

/**
 * Named filter sets for the performance ledger.
 *
 * The filters already live in the URL, so a view is just that URL's query
 * under a name — nothing is duplicated, and a view applied today reads the
 * same rows the link would. Kept as a popover on the filter bar rather than
 * a screen of its own: a view has no meaning away from the table it filters.
 *
 * Views load on first open, not on mount. Most visits never touch them, and
 * a request nobody asked for is a request worth not making.
 */
export function SavedViews({ currentAppUserId }: { currentAppUserId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [open, setOpen] = useState(false)
  const [views, setViews] = useState<View[] | null>(null)
  const [name, setName] = useState('')
  const [share, setShare] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const box = useRef<HTMLDivElement>(null)

  const current: Record<string, string> = {}
  for (const k of FILTER_KEYS) {
    const v = params.get(k)
    if (v) current[k] = v
  }
  const activeCount = Object.keys(current).length

  const load = useCallback(async () => {
    const { data, error: err } = await createClient()
      .from('saved_views')
      .select('id, name, filters, is_shared, owner_id')
      .eq('scope', 'performance')
      .order('name')

    if (err) setError(describeWriteError(err.message).message)
    setViews((data ?? []) as View[])
  }, [])

  // Dismiss on an outside click or Escape, the way every other popover in
  // the app behaves — a filter control that traps focus is worse than none.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && views === null) await load()
  }

  function apply(v: View) {
    const next = new URLSearchParams()
    for (const k of FILTER_KEYS) {
      const val = v.filters?.[k]
      if (val) next.set(k, String(val))
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
    setOpen(false)
  }

  async function save() {
    const label = name.trim()
    if (!label) return

    setError('')
    setBusy(true)
    const { error: err } = await createClient().from('saved_views').insert({
      owner_id: currentAppUserId,
      name: label,
      scope: 'performance',
      filters: current,
      is_shared: share,
    })
    setBusy(false)

    if (err) {
      setError(describeWriteError(err.message).message)
      return
    }
    setName('')
    setShare(false)
    await load()
  }

  async function remove(v: View) {
    setError('')
    setBusy(true)
    const { error: err, count } = await createClient()
      .from('saved_views')
      .delete({ count: 'exact' })
      .eq('id', v.id)
    setBusy(false)

    if (err || count === 0) {
      setError(
        err
          ? describeWriteError(err.message).message
          : 'Only the person who saved a view can remove it.',
      )
      return
    }
    await load()
  }

  // A view is "on" when the URL holds exactly its filters — not merely a
  // superset, or the label would claim credit for filters it did not set.
  const isActive = (v: View) => {
    const f = v.filters ?? {}
    const keys = Object.keys(f).filter((k) => f[k])
    return keys.length === activeCount && keys.every((k) => current[k] === String(f[k]))
  }

  const applied = views?.find(isActive)

  return (
    <div ref={box} style={{ position: 'relative', flex: '0 0 auto' }} className="epi-views">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        title="Saved views"
        style={{
          height: '34px',
          padding: '0 12px',
          borderRadius: '8px',
          background: applied ? 'var(--epi-teal-bg)' : 'var(--epi-input)',
          border: `1px solid ${applied ? 'var(--epi-teal-bd)' : 'var(--epi-border-2)'}`,
          color: applied ? 'var(--epi-teal)' : 'var(--epi-fg)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          maxWidth: '190px',
        }}
      >
        <Bookmark size={14} style={{ flex: '0 0 14px' }} />
        <span
          className="epi-views-label"
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {applied ? applied.name : 'Views'}
        </span>
        <span className="epi-views-caret" style={{ fontSize: '11px', opacity: 0.7 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div
          className="epi-views-pop"
          style={{
            position: 'absolute',
            top: 'calc(100% + 7px)',
            left: 0,
            width: 'min(300px, calc(100vw - 32px))',
            background: 'var(--epi-elev)',
            border: '1px solid var(--epi-border-2)',
            borderRadius: '12px',
            boxShadow: 'var(--epi-shadow-lg)',
            zIndex: 60,
            overflow: 'hidden',
            animation: 'epiModalIn 150ms cubic-bezier(0.2,0.8,0.2,1)',
          }}
        >
          {error ? (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--epi-red)',
                background: 'var(--epi-red-bg)',
                padding: '8px 13px',
                borderBottom: '1px solid var(--epi-red-bd)',
              }}
            >
              {error}
            </div>
          ) : null}

          {views === null ? (
            <div style={{ padding: '16px 13px', fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>
              Loading…
            </div>
          ) : views.length === 0 ? (
            <div style={{ padding: '14px 13px', fontSize: '12.5px', color: 'var(--epi-fg-3)', lineHeight: 1.5 }}>
              No saved views yet. Set the filters you use often, then name them below.
            </div>
          ) : (
            <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
              {views.map((v) => {
                const on = isActive(v)
                return (
                  <div
                    key={v.id}
                    className="epi-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      padding: '9px 13px',
                      borderBottom: '1px solid var(--epi-border-soft)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => apply(v)}
                      className="epi-views-apply"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: on ? 'var(--epi-teal)' : 'var(--epi-fg)',
                        fontSize: '13px',
                        fontWeight: on ? 700 : 500,
                      }}
                    >
                      <Check
                        size={13}
                        style={{ flex: '0 0 13px', opacity: on ? 1 : 0, color: 'var(--epi-teal)' }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.name}
                      </span>
                      {v.is_shared ? (
                        <Users
                          size={12}
                          style={{ flex: '0 0 12px', color: 'var(--epi-fg-3)' }}
                          aria-label="Shared with the team"
                        />
                      ) : null}
                    </button>

                    {v.owner_id === currentAppUserId ? (
                      <button
                        type="button"
                        onClick={() => void remove(v)}
                        disabled={busy}
                        aria-label={`Remove ${v.name}`}
                        className="epi-views-icon"
                        style={{
                          width: '24px',
                          height: '24px',
                          flex: '0 0 24px',
                          borderRadius: '6px',
                          border: '1px solid var(--epi-border)',
                          background: 'transparent',
                          color: 'var(--epi-red)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ padding: '11px 13px', background: 'var(--epi-canvas)', borderTop: '1px solid var(--epi-border)' }}>
            {activeCount === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--epi-fg-3)', lineHeight: 1.5 }}>
                Choose some filters first — a view with none saves nothing.
              </div>
            ) : (
              <>
                <div style={{ fontSize: '11.5px', color: 'var(--epi-fg-3)', marginBottom: '7px' }}>
                  Save the {activeCount} filter{activeCount === 1 ? '' : 's'} now applied
                </div>
                <div style={{ display: 'flex', gap: '7px' }}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void save()
                    }}
                    placeholder="Name this view"
                    className="epi-views-name"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '32px',
                      borderRadius: '8px',
                      background: 'var(--epi-input)',
                      border: '1px solid var(--epi-border-2)',
                      color: 'var(--epi-fg)',
                      padding: '0 10px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={busy || !name.trim()}
                    style={{
                      height: '32px',
                      padding: '0 13px',
                      borderRadius: '8px',
                      border: 0,
                      background: name.trim()
                        ? 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)'
                        : 'var(--epi-track)',
                      color: name.trim() ? '#fff' : 'var(--epi-fg-3)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: name.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flex: '0 0 auto',
                    }}
                  >
                    {busy ? <Loader2 size={12} className="epi-spin" /> : null}
                    Save
                  </button>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    marginTop: '9px',
                    fontSize: '12px',
                    color: 'var(--epi-fg-2)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={share}
                    onChange={(e) => setShare(e.target.checked)}
                    className="epi-views-check"
                    style={{ width: '14px', height: '14px', accentColor: 'var(--epi-teal)' }}
                  />
                  Share with the team
                </label>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
