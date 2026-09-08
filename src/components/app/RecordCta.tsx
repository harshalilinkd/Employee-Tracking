'use client'

import { Plus } from 'lucide-react'
import { useRecord } from './Shell'

export function RecordCta({
  label = '+ Record Performance',
  type,
  employeeId,
}: {
  label?: string
  type?: 'positive' | 'goofup'
  employeeId?: string
}) {
  const { open } = useRecord()
  return (
    <button
      onClick={() => open({ type, employeeId })}
      style={{
        height: '34px',
        padding: '0 14px',
        borderRadius: '8px',
        border: 0,
        background: 'linear-gradient(135deg,#14907c,#0a5f52)',
        color: '#fff',
        fontWeight: 600,
        fontSize: '14px',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export function RecordTypeButton({
  type,
  employeeId,
  label,
  solid = false,
}: {
  type: 'positive' | 'goofup'
  employeeId: string
  label: string
  /** Filled rather than tinted — recognition is the action to lead with. */
  solid?: boolean
}) {
  const { open } = useRecord()
  const tone = type === 'positive' ? 'pos' : 'neg'
  return (
    <button
      onClick={() => open({ type, employeeId })}
      style={{
        height: '40px',
        padding: '0 16px',
        borderRadius: '10px',
        background: solid
          ? 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)'
          : `var(--epi-${tone}-bg)`,
        border: solid ? 0 : `1px solid var(--epi-${tone}-bd)`,
        color: solid ? '#fff' : `var(--epi-${tone})`,
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        boxShadow: solid ? '0 6px 18px rgba(14,124,107,0.24)' : 'none',
      }}
    >
      <Plus size={15} />
      {label}
    </button>
  )
}
