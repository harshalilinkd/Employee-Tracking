'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Loader2, Mails, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { subtleButton } from '@/lib/design'

export interface ImportTarget {
  id: string
  full_name: string
  employee_code: string | null
  contact_email: string | null
}

interface Parsed {
  line: number
  key: string
  email: string
  target: ImportTarget | null
  problem: string | null
}

const VALID = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Excel copies as tabs; a CSV export as commas; a typed list often as spaces. */
function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t')
  if (line.includes(',')) return line.split(',')
  return line.split(/\s{2,}|\s+/)
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Bulk email correction from a spreadsheet.
 *
 * This data started life in a Google Sheet and the corrections still live
 * there, so the fastest path is the one the user already has: select two
 * columns, copy, paste. Anything that made them retype fifty addresses into
 * a grid would be a slower way to arrive at the same place.
 *
 * Nothing is written until the change list has been read. A paste is easy to
 * get wrong — a shifted column, yesterday's export — and a silent bulk write
 * over real records is not recoverable from the screen it happened on.
 */
export function EmailImport({
  employees,
  onClose,
  onDone,
}: {
  employees: ImportTarget[]
  onClose: () => void
  onDone: () => void
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const byCode = useMemo(() => {
    const m = new Map<string, ImportTarget>()
    for (const e of employees) if (e.employee_code) m.set(norm(e.employee_code), e)
    return m
  }, [employees])

  const byName = useMemo(() => {
    const m = new Map<string, ImportTarget>()
    for (const e of employees) m.set(norm(e.full_name), e)
    return m
  }, [employees])

  const parsed = useMemo<Parsed[]>(() => {
    const out: Parsed[] = []
    const lines = text.split(/\r?\n/)

    lines.forEach((raw, i) => {
      if (!raw.trim()) return

      const cells = splitCells(raw).map((c) => c.trim()).filter(Boolean)
      if (cells.length === 0) return

      // The email is whichever cell has an @ in it, so a pasted block that
      // carries extra columns between code and email still works.
      const emailIdx = cells.findIndex((c) => c.includes('@'))
      const email = emailIdx >= 0 ? (cells[emailIdx] ?? '') : ''
      const key = (emailIdx === 0 ? cells[1] : cells[0]) ?? ''

      // A header row pasted along with the data — skipped, not reported as
      // an error, because copying the header is the normal thing to do.
      if (!email && /^(employee\s*)?(code|name|email)$/i.test(key)) return

      const target = byCode.get(norm(key)) ?? byName.get(norm(key)) ?? null

      let problem: string | null = null
      if (!key) problem = 'No employee code or name on this line'
      else if (!email) problem = 'No email address on this line'
      else if (!VALID.test(email)) problem = `"${email}" is not a valid email address`
      else if (!target) problem = `No employee matches "${key}"`

      out.push({ line: i + 1, key, email, target, problem })
    })

    return out
  }, [text, byCode, byName])

  const good = parsed.filter((p) => !p.problem && p.target)
  const bad = parsed.filter((p) => p.problem)
  const changes = good.filter((p) => (p.target!.contact_email ?? '') !== p.email)
  const unchanged = good.length - changes.length

  // The same address on two people is almost always a copy-paste slip, and
  // it is far easier to catch here than in the grid afterwards.
  const duplicates = useMemo(() => {
    const seen = new Map<string, string[]>()
    for (const c of changes) {
      const list = seen.get(c.email.toLowerCase()) ?? []
      list.push(c.target!.full_name)
      seen.set(c.email.toLowerCase(), list)
    }
    return [...seen.entries()].filter(([, names]) => names.length > 1)
  }, [changes])

  async function apply() {
    setError('')
    setSaving(true)

    const { data, error: err } = await createClient().rpc('set_employee_emails', {
      payload: changes.map((c) => ({ id: c.target!.id, email: c.email })),
    })

    setSaving(false)

    if (err) {
      setError(
        err.message.toLowerCase().includes('permission') ||
          err.message.toLowerCase().includes('row-level security')
          ? 'Your role cannot change employee records.'
          : err.message,
      )
      return
    }
    if (data === 0) {
      setError('Nothing was updated. Your role may not be allowed to change employee records.')
      return
    }
    onDone()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Update employee emails"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
      className="epi-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'var(--epi-scrim)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="epi-modal"
        style={{
          width: '100%',
          maxWidth: '660px',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--epi-elev)',
          border: '1px solid var(--epi-border-2)',
          borderRadius: '18px',
          boxShadow: 'var(--epi-shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--epi-border)',
          }}
        >
          <span
            style={{
              width: '30px',
              height: '30px',
              flex: '0 0 30px',
              borderRadius: '9px',
              background: 'var(--epi-teal-bg)',
              color: 'var(--epi-teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mails size={16} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, letterSpacing: '-0.015em' }}>
              Update emails
            </span>
            <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>
              Paste employee code (or name) and email from your sheet
            </span>
          </span>
          <button onClick={onClose} disabled={saving} aria-label="Close" style={{ ...subtleButton, width: '34px', padding: 0 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            spellCheck={false}
            placeholder={'AD-07\taditya.lohar@example.com\nAM-11\taman.ahmad@example.com\nKavita Rane\tkavita.rane@example.com'}
            className="epi-mono"
            style={{
              width: '100%',
              minWidth: 0,
              borderRadius: '11px',
              background: 'var(--epi-input)',
              border: '1px solid var(--epi-border-2)',
              color: 'var(--epi-fg)',
              fontSize: '12.5px',
              lineHeight: 1.6,
              padding: '11px 13px',
              outline: 'none',
              resize: 'vertical',
            }}
          />

          <p style={{ margin: 0, fontSize: '12px', color: 'var(--epi-fg-3)', lineHeight: 1.55 }}>
            Two columns from Excel or Google Sheets — the header row is fine to include. Employees not
            in your paste are left alone, and a line with no email is skipped rather than clearing one.
          </p>

          {parsed.length > 0 ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12.5px' }}>
              <Chip tone="teal" label={`${parsed.length} rows read`} />
              <Chip tone="green" label={`${changes.length} to change`} />
              {unchanged > 0 ? <Chip tone="blue" label={`${unchanged} already correct`} /> : null}
              {bad.length > 0 ? <Chip tone="red" label={`${bad.length} with a problem`} /> : null}
            </div>
          ) : null}

          {duplicates.length > 0 ? (
            <Notice tone="orange">
              The same address is going to more than one person:{' '}
              {duplicates.map(([email, names]) => `${email} → ${names.join(' and ')}`).join('; ')}. Check
              the paste before applying.
            </Notice>
          ) : null}

          {bad.length > 0 ? (
            <Notice tone="red">
              <strong>These lines will be skipped.</strong>
              <span style={{ display: 'block', marginTop: '6px' }}>
                {bad.slice(0, 6).map((b) => (
                  <span key={b.line} style={{ display: 'block' }}>
                    Line {b.line}: {b.problem}
                  </span>
                ))}
                {bad.length > 6 ? <span style={{ display: 'block' }}>…and {bad.length - 6} more</span> : null}
              </span>
            </Notice>
          ) : null}

          {error ? <Notice tone="red">{error}</Notice> : null}

          {changes.length > 0 ? (
            <div
              style={{
                border: '1px solid var(--epi-border)',
                borderRadius: '11px',
                overflow: 'hidden',
              }}
            >
              {changes.map((c) => (
                <div
                  key={c.target!.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(110px,1fr) minmax(0,1.4fr) 16px minmax(0,1.4fr)',
                    gap: '10px',
                    alignItems: 'center',
                    padding: '9px 12px',
                    borderBottom: '1px solid var(--epi-border-soft)',
                    fontSize: '12.5px',
                  }}
                >
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.target!.full_name}
                  </span>
                  <span
                    className="epi-mono"
                    title={c.target!.contact_email ?? ''}
                    style={{
                      color: 'var(--epi-fg-3)',
                      textDecoration: c.target!.contact_email ? 'line-through' : 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.target!.contact_email ?? 'blank'}
                  </span>
                  <ArrowRight size={13} style={{ color: 'var(--epi-fg-3)' }} />
                  <span
                    className="epi-mono"
                    title={c.email}
                    style={{
                      color: 'var(--epi-teal)',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.email}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            padding: '14px 20px',
            borderTop: '1px solid var(--epi-border)',
            background: 'var(--epi-surface)',
          }}
        >
          <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>
            {changes.length === 0 ? 'Nothing to apply yet' : `${changes.length} will be written`}
          </span>
          <button type="button" style={subtleButton} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={saving || changes.length === 0}
            style={{
              height: '38px',
              padding: '0 18px',
              borderRadius: '10px',
              border: 0,
              background:
                changes.length === 0
                  ? 'var(--epi-track)'
                  : 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
              color: changes.length === 0 ? 'var(--epi-fg-3)' : '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'progress' : changes.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
            }}
          >
            {saving ? <Loader2 size={15} className="epi-spin" /> : <Check size={15} />}
            {saving ? 'Updating…' : `Update ${changes.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  )
}

function Chip({ tone, label }: { tone: string; label: string }) {
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: '999px',
        background: `var(--epi-${tone}-bg)`,
        border: `1px solid var(--epi-${tone}-bd)`,
        color: `var(--epi-${tone})`,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  )
}

function Notice({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '9px',
        alignItems: 'flex-start',
        borderRadius: '10px',
        border: `1px solid var(--epi-${tone}-bd)`,
        background: `var(--epi-${tone}-bg)`,
        color: `var(--epi-${tone})`,
        padding: '10px 12px',
        fontSize: '12.5px',
        lineHeight: 1.5,
      }}
    >
      <AlertTriangle size={14} style={{ flex: '0 0 14px', marginTop: '1px' }} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  )
}
