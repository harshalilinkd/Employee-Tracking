'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Ban, Check, Loader2, MailPlus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { avatarStyle, cardStyle, initials, pill, subtleButton, tableHeadStyle } from '@/lib/design'
import { ROLE_LABELS, canRecord, type AppRole } from '@/lib/types'

const COLS = 'minmax(170px,1.4fr) minmax(200px,1.8fr) minmax(180px,1.3fr) 108px 104px 122px 58px'

export interface UserRow {
  id: string
  full_name: string
  email: string
  role: AppRole
  is_active: boolean
  linked: boolean
  employee_id: string | null
}

const ROLES: AppRole[] = ['super_admin', 'md', 'executive_assistant', 'hr', 'department_manager', 'viewer']

const field: CSSProperties = {
  height: '40px',
  width: '100%',
  borderRadius: '10px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border-2)',
  color: 'var(--epi-fg)',
  fontSize: '14px',
  padding: '0 12px',
  outline: 'none',
}
const label: CSSProperties = { fontSize: '13px', fontWeight: 600, color: 'var(--epi-fg-strong)' }

function StatusDot({ on, tone = 'green' }: { on: boolean; tone?: string }) {
  return (
    <span
      style={{
        width: '7px',
        height: '7px',
        flex: '0 0 7px',
        borderRadius: '999px',
        background: on ? `var(--epi-${tone})` : 'var(--epi-fg-3)',
      }}
    />
  )
}

function StateCell({
  on,
  onLabel,
  offLabel,
  offTone,
}: {
  on: boolean
  onLabel: string
  offLabel: string
  offTone: 'muted' | 'warn'
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
      <span
        style={{
          width: '7px',
          height: '7px',
          flex: '0 0 7px',
          borderRadius: '999px',
          background: on ? 'var(--epi-green)' : offTone === 'warn' ? 'var(--epi-orange)' : 'var(--epi-fg-3)',
        }}
      />
      <span style={{ fontSize: '13px', color: 'var(--epi-fg-2)', whiteSpace: 'nowrap' }}>
        {on ? onLabel : offLabel}
      </span>
    </span>
  )
}

export function UserAccessAdmin({
  rows,
  employees,
  canManage,
  currentUserId,
}: {
  rows: UserRow[]
  employees: { id: string; full_name: string }[]
  canManage: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [inviting, setInviting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<UserRow | null>(null)
  const [deleteError, setDeleteError] = useState('')

  async function patch(id: string, changes: Record<string, unknown>) {
    setError('')
    setBusyId(id)
    const supabase = createClient()
    const { error: err } = await supabase.from('app_users').update(changes).eq('id', id)
    setBusyId(null)
    if (err) {
      setError(err.message.includes('row-level security') ? 'Only Super Admin or Management can change access.' : err.message)
      return
    }
    router.refresh()
  }

  /**
   * Permanent deletion of a sign-in account.
   *
   * The database decides whether it is allowed: RLS restricts it to admins
   * and refuses self-deletion, and performance_events.recorded_by is ON
   * DELETE RESTRICT so anyone who has recorded an event is refused outright.
   * Both refusals get a real explanation instead of the raw error.
   */
  async function remove(u: UserRow) {
    setDeleteError('')
    setBusyId(u.id)
    const { error: err, count } = await createClient()
      .from('app_users')
      .delete({ count: 'exact' })
      .eq('id', u.id)
    setBusyId(null)

    if (err) {
      const fk = err.message.includes('foreign key') || err.code === '23503'
      setDeleteError(
        fk
          ? `${u.full_name} has recorded performance events. Deleting the account would leave those records with no author, so the database refuses it. Disable the sign-in instead — it blocks access and keeps the attribution intact.`
          : err.message.includes('row-level security')
            ? 'Your role cannot delete sign-in accounts. Super Admin is required.'
            : err.message,
      )
      return
    }

    // A delete filtered out by RLS succeeds with zero rows; without this it
    // would close the dialog and look like it worked.
    if (count === 0) {
      setDeleteError(
        'Nothing was deleted. You cannot delete your own account, and only Super Admin can delete others.',
      )
      return
    }

    setDeleting(null)
    router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.018em' }}>User access</h2>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--epi-fg-2)' }}>
            {rows.length} people can sign in. Everyone else in the group&rsquo;s shared login pool is refused.
          </p>
        </div>
        {canManage ? (
          <button
            onClick={() => setInviting(true)}
            style={{ ...subtleButton, display: 'flex', alignItems: 'center', gap: '7px' }}
          >
            <MailPlus size={14} />
            Give someone access
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            display: 'flex',
            gap: '9px',
            border: '1px solid var(--epi-neg-bd)',
            background: 'var(--epi-neg-bg)',
            borderRadius: '11px',
            padding: '11px 13px',
            fontSize: '13px',
            color: 'var(--epi-neg-fg)',
          }}
        >
          <AlertTriangle size={15} style={{ flex: '0 0 15px', marginTop: '1px' }} />
          {error}
        </div>
      ) : null}

      <div className="epi-table-desktop" style={{ ...cardStyle, overflow: 'hidden', overflowX: 'auto' }}>
        <div
          className="epi-grid-table epi-grid-table-head"
          style={{
            minWidth: '1020px',
            display: 'grid',
            gridTemplateColumns: COLS,
            gap: '10px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--epi-border)',
            ...tableHeadStyle,
          }}
        >
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Can record</span>
          <span>Sign-in</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {rows.map((u) => {
          const isSelf = u.id === currentUserId
          return (
            <div
              key={u.id}
              className="epi-row epi-grid-table"
              style={{
                minWidth: '1020px',
                display: 'grid',
                gridTemplateColumns: COLS,
                gap: '10px',
                padding: '11px 16px',
                borderBottom: '1px solid var(--epi-border-soft)',
                alignItems: 'center',
                fontSize: '14px',
                opacity: busyId === u.id ? 0.55 : 1,
              }}
            >
              <span style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                <span style={avatarStyle(28)}>{initials(u.full_name)}</span>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.full_name}
                </span>
              </span>
              <span
                className="epi-mono"
                style={{
                  fontSize: '12px',
                  color: 'var(--epi-fg-2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {u.email}
              </span>

              {canManage && !isSelf ? (
                <span className="epi-cell-control">
                  <select
                    aria-label={`Role for ${u.full_name}`}
                    value={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                    style={{
                      borderRadius: '8px',
                      background: 'var(--epi-input)',
                      border: '1px solid var(--epi-border-2)',
                      color: 'var(--epi-fg)',
                      fontSize: '13px',
                      padding: '0 8px',
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--epi-fg-2)' }}>
                  {ROLE_LABELS[u.role]}
                  {isSelf ? <span style={{ color: 'var(--epi-fg-3)' }}> (you)</span> : null}
                </span>
              )}

              {/* Three filled chips on every row was the loudest thing on the
                  page. A dot plus plain text says the same in a glance. */}
              <StateCell
                on={canRecord(u.role)}
                onLabel="Yes"
                offLabel="Read only"
                offTone="muted"
              />
              <StateCell on={u.linked} onLabel="Linked" offLabel="Pending" offTone="warn" />

              {canManage && !isSelf ? (
                <span className="epi-cell-control">
                  <button
                    onClick={() => patch(u.id, { is_active: !u.is_active })}
                    title={u.is_active ? 'Disable this sign-in' : 'Re-enable this sign-in'}
                    style={{
                      padding: '0 10px',
                      borderRadius: '8px',
                      background: 'transparent',
                      border: '1px solid var(--epi-border-2)',
                      color: 'var(--epi-fg-2)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <StatusDot on={u.is_active} />
                    {u.is_active ? 'Active' : 'Disabled'}
                  </button>
                </span>
              ) : (
                <StateCell on={u.is_active} onLabel="Active" offLabel="Disabled" offTone="muted" />
              )}

              {canManage && !isSelf ? (
                <span className="epi-cell-control">
                  <button
                    onClick={() => {
                      setDeleteError('')
                      setDeleting(u)
                    }}
                    aria-label={`Delete ${u.full_name}`}
                    title="Delete this account permanently"
                    style={{
                      width: '30px',
                      borderRadius: '8px',
                      background: 'transparent',
                      border: '1px solid var(--epi-border)',
                      color: 'var(--epi-red)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ) : (
                <span />
              )}
            </div>
          )
        })}
      </div>

      <div className="epi-cards-mobile">
        {rows.map((u) => {
          const isSelf = u.id === currentUserId
          return (
            <div
              key={u.id}
              style={{ ...cardStyle, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={avatarStyle(32)}>{initials(u.full_name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '15px', fontWeight: 600 }}>
                    {u.full_name}
                    {isSelf ? <span style={{ color: 'var(--epi-fg-3)', fontWeight: 400 }}> (you)</span> : null}
                  </span>
                  <span
                    className="epi-mono"
                    style={{ display: 'block', fontSize: '12px', color: 'var(--epi-fg-2)', overflowWrap: 'anywhere' }}
                  >
                    {u.email}
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={pill(canRecord(u.role) ? 'pos' : 'muted')}>
                  {canRecord(u.role) ? 'Can record' : 'Read only'}
                </span>
                <span style={pill(u.linked ? 'accent' : 'warn')}>{u.linked ? 'Linked' : 'Pending'}</span>
                <span style={pill(u.is_active ? 'pos' : 'muted')}>{u.is_active ? 'Active' : 'Disabled'}</span>
              </div>
              {canManage && !isSelf ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    aria-label={`Role for ${u.full_name}`}
                    value={u.role}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                    style={{ flex: '1 1 150px', ...field, height: '44px' }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => patch(u.id, { is_active: !u.is_active })}
                    style={{ ...subtleButton, flex: '1 1 110px', height: '44px' }}
                  >
                    {u.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteError('')
                      setDeleting(u)
                    }}
                    aria-label={`Delete ${u.full_name}`}
                    title="Delete this account permanently"
                    style={{
                      ...subtleButton,
                      flex: '0 0 46px',
                      height: '44px',
                      color: 'var(--epi-red)',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--epi-fg-2)' }}>{ROLE_LABELS[u.role]}</span>
              )}
            </div>
          )
        })}
      </div>

      <p style={{ margin: 0, fontSize: '13px', color: 'var(--epi-fg-3)', lineHeight: 1.6 }}>
        Recording is restricted to Super Admin, Management and Executive Assistants. Department Managers see
        only their own department — enforced in the database, not just hidden here.{' '}
        <strong style={{ color: 'var(--epi-fg-2)' }}>Pending</strong> means access is waiting for that person to
        sign in for the first time.
      </p>

      {deleting ? (
        <ConfirmUserDelete
          user={deleting}
          busy={busyId === deleting.id}
          error={deleteError}
          onCancel={() => {
            setDeleteError('')
            setDeleting(null)
          }}
          onConfirm={() => remove(deleting)}
          onDisable={async () => {
            await patch(deleting.id, { is_active: false })
            setDeleteError('')
            setDeleting(null)
          }}
        />
      ) : null}

      {inviting ? (
        <InviteModal employees={employees} close={() => setInviting(false)} />
      ) : null}
    </>
  )
}

function InviteModal({
  employees,
  close,
}: {
  employees: { id: string; full_name: string }[]
  close: () => void
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<AppRole>('viewer')
  const [employeeId, setEmployeeId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [close])

  async function save() {
    setError('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) return setError('Enter a valid email address.')
    if (!fullName.trim()) return setError('Enter the person’s name.')

    setSaving(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('app_users').insert({
      email: trimmed,
      full_name: fullName.trim(),
      role,
      employee_id: employeeId || null,
      is_active: true,
    })
    setSaving(false)

    if (err) {
      setError(
        err.message.includes('row-level security')
          ? 'Only Super Admin or Management can grant access.'
          : err.message,
      )
      return
    }
    router.refresh()
    close()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Give someone access"
      className="epi-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'var(--epi-scrim)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'epiScrimIn 220ms ease-out',
      }}
    >
      <div
        className="epi-modal"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--epi-elev)',
          border: '1px solid var(--epi-border-2)',
          borderRadius: '20px',
          boxShadow: 'var(--epi-shadow-lg)',
          overflow: 'hidden',
          animation: 'epiModalIn 240ms cubic-bezier(0.2,0.8,0.2,1)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg,#14907c 0%,#0e7c6b 50%,#0a5f52 100%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: '14px',
            alignItems: 'center',
            padding: '20px 22px 16px',
            borderBottom: '1px solid var(--epi-border)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              flex: '0 0 40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 22px rgba(14,124,107,0.28)',
            }}
          >
            <MailPlus size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--epi-fg-3)',
              }}
            >
              User access
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: '21px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Give someone access
            </h2>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'var(--epi-input)',
              border: '1px solid var(--epi-border-2)',
              color: 'var(--epi-fg-2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={label}>
              Email <span style={{ color: 'var(--epi-neg)' }}>*</span>
            </span>
            <input
              className="epi-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              style={field}
            />
            <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)', lineHeight: 1.5 }}>
              They do not need an account yet. Access activates the first time they sign in with this address.
            </span>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={label}>
              Name <span style={{ color: 'var(--epi-neg)' }}>*</span>
            </span>
            <input
              className="epi-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alisha Pandav"
              style={field}
            />
          </label>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={label}>Role</span>
              <select
                className="epi-field"
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                style={{ ...field, padding: '0 10px' }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <span style={label}>Their employee record</span>
              <select
                className="epi-field"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                style={{ ...field, padding: '0 10px' }}
              >
                <option value="">Not linked</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p style={{ margin: 0, fontSize: '12px', color: 'var(--epi-fg-3)', lineHeight: 1.55 }}>
            Linking their employee record is what stops them recording performance events about themselves.
          </p>

          {error ? (
            <div
              role="alert"
              style={{
                display: 'flex',
                gap: '9px',
                border: '1px solid var(--epi-neg-bd)',
                background: 'var(--epi-neg-bg)',
                borderRadius: '11px',
                padding: '11px 13px',
                fontSize: '13px',
                color: 'var(--epi-neg-fg)',
              }}
            >
              <AlertTriangle size={15} style={{ flex: '0 0 15px', marginTop: '1px' }} />
              <span style={{ flex: 1, lineHeight: 1.45 }}>{error}</span>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
            padding: '14px 22px',
            borderTop: '1px solid var(--epi-border)',
            background: 'var(--epi-surface)',
          }}
        >
          <button
            onClick={close}
            style={{
              height: '40px',
              padding: '0 15px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1px solid var(--epi-border-2)',
              color: 'var(--epi-fg-2)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              height: '40px',
              padding: '0 20px',
              borderRadius: '10px',
              border: 0,
              background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'progress' : 'pointer',
              opacity: saving ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: '0 8px 22px rgba(14,124,107,0.28)',
            }}
          >
            {saving ? <Loader2 size={15} className="epi-spin" /> : <Check size={15} />}
            {saving ? 'Saving…' : 'Grant access'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Deleting a sign-in account is irreversible and sits beside a reversible
 * Disable, so it asks first and names the person.
 */
function ConfirmUserDelete({
  user,
  busy,
  error,
  onCancel,
  onConfirm,
  onDisable,
}: {
  user: UserRow
  busy: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
  onDisable: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${user.full_name}`}
      className="epi-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--epi-scrim)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'epiScrimIn 220ms ease-out',
      }}
    >
      <div
        className="epi-modal"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--epi-elev)',
          border: '1px solid var(--epi-border-2)',
          borderRadius: '18px',
          boxShadow: 'var(--epi-shadow-lg)',
          overflow: 'hidden',
          animation: 'epiModalIn 240ms cubic-bezier(0.2,0.8,0.2,1)',
        }}
      >
        <div style={{ padding: '22px 22px 6px', display: 'flex', gap: '13px' }}>
          <span
            style={{
              width: '36px',
              height: '36px',
              flex: '0 0 36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--epi-red-bg)',
              color: 'var(--epi-red)',
              border: '1px solid var(--epi-red-bd)',
            }}
          >
            <AlertTriangle size={17} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700 }}>
              {error ? `Cannot delete ${user.full_name}` : `Delete ${user.full_name}?`}
            </h2>
            <p
              style={{
                margin: '7px 0 0',
                fontSize: '13.5px',
                color: error ? 'var(--epi-red)' : 'var(--epi-fg-2)',
                lineHeight: 1.6,
              }}
            >
              {error ||
                `This permanently removes the sign-in account for ${user.email}. Their saved views and department scoping go with it. Performance events they recorded are kept — and if they recorded any, the database will refuse this and you should disable the account instead.`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '18px 22px 20px' }}>
          <button
            onClick={onCancel}
            style={{
              height: '38px',
              padding: '0 15px',
              borderRadius: '9px',
              background: 'transparent',
              border: '1px solid var(--epi-border-2)',
              color: 'var(--epi-fg-2)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {error ? 'Close' : 'Cancel'}
          </button>

          {/* When the delete is refused, offer the thing that will work. */}
          {error && user.is_active ? (
            <button
              onClick={onDisable}
              disabled={busy}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '9px',
                border: '1px solid var(--epi-border-2)',
                background: 'var(--epi-input)',
                color: 'var(--epi-fg)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <Ban size={14} />
              Disable instead
            </button>
          ) : null}

          {error ? null : (
            <button
              onClick={onConfirm}
              disabled={busy}
              style={{
                height: '38px',
                padding: '0 18px',
                borderRadius: '9px',
                border: '1px solid var(--epi-red-bd)',
                background: 'var(--epi-red)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: busy ? 'progress' : 'pointer',
                opacity: busy ? 0.75 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              {busy ? <Loader2 size={14} className="epi-spin" /> : <Trash2 size={14} />}
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
