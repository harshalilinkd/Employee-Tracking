import type { ReactNode } from 'react'

/** SPEC §9.10 — an empty state always carries a next action. */
export function EmptyState({
  title,
  body,
  action,
  dashed = true,
}: {
  title: string
  body: string
  action?: ReactNode
  dashed?: boolean
}) {
  return (
    <div
      style={{
        border: dashed ? '1px dashed var(--epi-border-2)' : '1px solid var(--epi-border)',
        borderRadius: '14px',
        padding: '48px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: '16px', fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: '14px', color: 'var(--epi-fg-2)', maxWidth: '400px', lineHeight: 1.55 }}>{body}</div>
      {action ? <div style={{ marginTop: '6px' }}>{action}</div> : null}
    </div>
  )
}
