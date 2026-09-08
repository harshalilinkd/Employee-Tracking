'use client'

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
}: {
  type: 'positive' | 'goofup'
  employeeId: string
  label: string
}) {
  const { open } = useRecord()
  const tone = type === 'positive' ? 'pos' : 'neg'
  return (
    <button
      onClick={() => open({ type, employeeId })}
      style={{
        height: '36px',
        padding: '0 14px',
        borderRadius: '8px',
        background: `var(--epi-${tone}-bg)`,
        border: `1px solid var(--epi-${tone}-bd)`,
        color: `var(--epi-${tone})`,
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
