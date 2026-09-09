'use client'

import { useEffect, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuditTimeline, type AuditEntry as Entry } from './AuditTimeline'

/**
 * This record's own history, read from the audit log.
 *
 * The Settings audit screen answers "what happened across the system"; this
 * answers "what happened to this record", which is the question anyone
 * actually asks — normally while looking at an entry they think is wrong.
 * Same rows, scoped by entity_id.
 *
 * Fetched on the client rather than passed down, because the panel is only
 * opened for one record at a time and pre-loading history for every row in
 * the ledger would be hundreds of rows nobody reads.
 */
export function EventHistory({ eventId }: { eventId: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, actor_email, action, field_changed, old_value, new_value, created_at')
        .eq('entity_type', 'performance_events')
        .eq('entity_id', eventId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!live) return
      // RLS returns an empty set rather than an error when a row is out of
      // reach, so an error here is a real failure worth distinguishing.
      if (error) setDenied(true)
      setEntries((data ?? []) as Entry[])
    })()
    return () => {
      live = false
    }
  }, [eventId])

  return (
    <div style={{ borderTop: '1px solid var(--epi-border)', paddingTop: '15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '11px' }}>
        <History size={15} style={{ color: 'var(--epi-fg-3)' }} />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--epi-fg-3)',
          }}
        >
          History
        </span>
        {entries ? (
          <span style={{ fontSize: '12px', color: 'var(--epi-fg-3)' }}>
            {entries.length} {entries.length === 1 ? 'change' : 'changes'}
          </span>
        ) : null}
      </div>

      {entries === null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--epi-fg-3)' }}>
          <Loader2 size={14} className="epi-spin" /> Loading…
        </div>
      ) : denied ? (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--epi-fg-3)' }}>
          History is not available for your role.
        </p>
      ) : entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--epi-fg-3)' }}>
          Nothing has changed since this was recorded.
        </p>
      ) : (
        <AuditTimeline entries={entries} />
      )}
    </div>
  )
}
