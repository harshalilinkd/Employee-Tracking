'use client'

import { pill } from '@/lib/design'
import { ACTION_TONE, describeChange } from '@/lib/audit'

export interface AuditEntry {
  id: number
  actor_email: string | null
  action: string
  field_changed: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
}

/**
 * A record's changes, newest first, as a timeline.
 *
 * Shared by the event detail panel and the Settings audit log so the two
 * cannot drift into showing the same history two different ways.
 */
export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {entries.map((h, i) => {
        const changes = describeChange(h.field_changed, h.old_value, h.new_value)
        return (
          <div
            key={h.id}
            style={{
              display: 'flex',
              gap: '11px',
              padding: '11px 0',
              borderTop: i === 0 ? 0 : '1px solid var(--epi-border-soft)',
            }}
          >
            {/* A rail, so several corrections read as a sequence rather than
                as unrelated rows. */}
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 9px' }}>
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '999px',
                  marginTop: '4px',
                  background: `var(--epi-${ACTION_TONE[h.action] ?? 'muted'})`,
                }}
              />
              {i < entries.length - 1 ? (
                <span style={{ flex: 1, width: '1px', background: 'var(--epi-border-2)', marginTop: '3px' }} />
              ) : null}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ ...pill(ACTION_TONE[h.action] ?? 'muted'), fontSize: '9.5px' }}>{h.action}</span>
                <span style={{ fontSize: '12.5px', color: 'var(--epi-fg-2)' }}>{h.actor_email ?? 'System'}</span>
                <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)', marginLeft: 'auto' }}>
                  {new Date(h.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {changes.length ? (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {changes.map((c) => (
                    <div key={c.field} style={{ fontSize: '12.5px', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--epi-fg-3)' }}>{c.label}: </span>
                      <span style={{ color: 'var(--epi-fg-2)' }}>{c.from}</span>
                      <span style={{ color: 'var(--epi-fg-3)' }}> → </span>
                      <span style={{ color: 'var(--epi-fg)', fontWeight: 600 }}>{c.to}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: '5px', fontSize: '12.5px', color: 'var(--epi-fg-3)' }}>Record created</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
