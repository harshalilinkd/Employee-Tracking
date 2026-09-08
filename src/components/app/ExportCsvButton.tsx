'use client'

import type { CSSProperties } from 'react'
import { Download } from 'lucide-react'
import { toCsv } from '@/lib/format'

/**
 * One CSV download path for the ledger, because the button now appears in
 * two places: the filter bar on desktop, and the page header (icon-only) on
 * phones where the filter bar has no room for it.
 */
export function downloadCsv(rows: Record<string, unknown>[]) {
  const csv = toCsv(rows)
  // The BOM keeps Excel from mangling non-ASCII names.
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `performance-records-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportCsvButton({
  rows,
  iconOnly,
  className,
  style,
}: {
  rows: Record<string, unknown>[]
  iconOnly?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <button
      onClick={() => downloadCsv(rows)}
      className={className}
      aria-label="Export CSV"
      title="Export CSV"
      style={
        iconOnly
          ? {
              width: '34px',
              height: '34px',
              minWidth: '34px',
              borderRadius: '8px',
              background: 'var(--epi-input)',
              border: '1px solid var(--epi-border-2)',
              color: 'var(--epi-fg)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 auto',
              padding: 0,
              ...style,
            }
          : {
              height: '34px',
              borderRadius: '8px',
              background: 'var(--epi-input)',
              border: '1px solid var(--epi-border)',
              color: 'var(--epi-fg)',
              fontSize: '13px',
              padding: '0 8px',
              cursor: 'pointer',
              fontWeight: 600,
              ...style,
            }
      }
    >
      {iconOnly ? <Download size={16} /> : 'Export CSV'}
    </button>
  )
}
