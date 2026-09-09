'use client'

import { useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cardStyle, pill } from '@/lib/design'
import { AuditTimeline, type AuditEntry } from './AuditTimeline'

export interface AuditGroup {
  key: string
  entityType: string
  entityId: string
  /** Resolved name of the record, or its reference if it has since been deleted. */
  title: string
  subtitle: string | null
  /** The record as it stands now — what the log itself never captured on
      create. Absent for a record that has since been deleted. */
  details?: { label: string; value: string }[]
  entries: AuditEntry[]
}

const ENTITY_LABELS: Record<string, string> = {
  performance_events: 'Performance event',
  employees: 'Employee',
  categories: 'Category',
  app_users: 'User',
  departments: 'Department',
  designations: 'Designation',
  observers: 'Observer',
  management_notes: 'Management note',
}

/**
 * The audit log, grouped by the record it happened to.
 *
 * A flat list answered "what happened, in order", which meant one event's
 * creation and its three later corrections sat in four places, interleaved
 * with everything else that happened that morning. The question people
 * actually bring to this screen is about a record — "what has been done to
 * this event" — so the record is the row, and its history is inside it.
 */
export function AuditLogGroups({ groups }: { groups: AuditGroup[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const needle = q.trim().toLowerCase()
  const visible = needle
    ? groups.filter(
        (g) =>
          g.title.toLowerCase().includes(needle) ||
          (g.subtitle ?? '').toLowerCase().includes(needle) ||
          (ENTITY_LABELS[g.entityType] ?? g.entityType).toLowerCase().includes(needle) ||
          g.entries.some((e) => (e.actor_email ?? '').toLowerCase().includes(needle)),
      )
    : groups

  return (
    <>
      <div style={{ position: 'relative', maxWidth: '420px' }}>
        <Search
          size={15}
          style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--epi-fg-3)', pointerEvents: 'none' }}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by record, person or type…"
          aria-label="Search the audit log"
          style={{
            width: '100%',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--epi-input)',
            border: '1px solid var(--epi-border-2)',
            color: 'var(--epi-fg)',
            fontSize: '14px',
            padding: '0 12px 0 36px',
            outline: 'none',
          }}
        />
      </div>

      {visible.length === 0 ? (
        <div style={{ ...cardStyle, padding: '30px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>
            {groups.length === 0 ? 'No changes recorded yet' : 'No records match that search'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--epi-fg-2)', marginTop: '5px' }}>
            {groups.length === 0
              ? 'Edits, archives and new records will appear here as your team uses the system.'
              : 'Try a reference, an employee name or the email of whoever made the change.'}
          </div>
        </div>
      ) : (
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          {visible.map((g, i) => {
            const open = openKey === g.key
            const latest = g.entries[0]
            const created = g.entries[g.entries.length - 1]
            return (
              <div key={g.key} style={{ borderTop: i === 0 ? 0 : '1px solid var(--epi-border)' }}>
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : g.key)}
                  aria-expanded={open}
                  className="epi-row"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '13px 16px',
                    background: open ? 'var(--epi-hover)' : 'transparent',
                    border: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--epi-fg)',
                  }}
                >
                  <ChevronDown
                    size={15}
                    style={{
                      flex: '0 0 15px',
                      color: 'var(--epi-fg-3)',
                      transform: open ? 'none' : 'rotate(-90deg)',
                      transition: 'transform 150ms ease',
                    }}
                  />

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '14.5px',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {g.title}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '12.5px',
                        color: 'var(--epi-fg-3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ENTITY_LABELS[g.entityType] ?? g.entityType}
                      {g.subtitle ? ` · ${g.subtitle}` : ''}
                    </span>
                  </span>

                  <span className="epi-hide-mobile" style={{ fontSize: '12.5px', color: 'var(--epi-fg-3)', textAlign: 'right' }}>
                    <span style={{ display: 'block' }}>{latest?.actor_email ?? 'System'}</span>
                    <span style={{ display: 'block' }}>
                      {latest
                        ? new Date(latest.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </span>

                  {/* Counts the changes, not the creation — "3 changes" on a
                      record nobody has touched since recording it would be a
                      lie the first time somebody checked. */}
                  <span
                    style={{
                      ...pill(g.entries.length > 1 ? 'blue' : 'muted'),
                      fontSize: '10px',
                      flex: '0 0 auto',
                    }}
                  >
                    {created && created.action === 'create' ? g.entries.length - 1 : g.entries.length}{' '}
                    {(created && created.action === 'create' ? g.entries.length - 1 : g.entries.length) === 1
                      ? 'change'
                      : 'changes'}
                  </span>
                </button>

                {open ? (
                  <div style={{ padding: '2px 16px 14px 42px', background: 'var(--epi-hover)' }}>
                    {/* The record first, then what has been done to it. A
                        history is unreadable without knowing what it is a
                        history of. */}
                    {g.details?.length ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                          gap: '10px 18px',
                          padding: '13px 15px',
                          marginBottom: '14px',
                          borderRadius: '11px',
                          border: '1px solid var(--epi-border)',
                          background: 'var(--epi-surface)',
                        }}
                      >
                        {g.details.map((d) => (
                          <div key={d.label} style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--epi-fg-3)',
                              }}
                            >
                              {d.label}
                            </div>
                            <div
                              style={{
                                fontSize: '13px',
                                color: 'var(--epi-fg)',
                                marginTop: '3px',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {d.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <AuditTimeline entries={g.entries} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
