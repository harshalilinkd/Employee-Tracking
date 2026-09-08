'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { selectStyle, subtleButton } from '@/lib/design'
import { Download } from 'lucide-react'
import { toCsv } from '@/lib/format'

const dateWrap = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  height: '34px',
  padding: '0 9px',
  borderRadius: '8px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border-2)',
} as const

const dateTag = { fontSize: '11px', color: 'var(--epi-fg-3)', whiteSpace: 'nowrap' } as const

const primaryButton = {
  height: '34px',
  padding: '0 15px',
  borderRadius: '8px',
  border: 0,
  background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
  color: '#fff',
  fontSize: '13.5px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  whiteSpace: 'nowrap',
} as const

const dateInput = {
  height: '30px',
  border: 0,
  background: 'transparent',
  color: 'var(--epi-fg)',
  fontSize: '12.5px',
  outline: 'none',
  padding: 0,
} as const

export function ReportActions({
  employees,
  selectedId,
  from,
  to,
  rows,
  filename,
}: {
  employees: { id: string; full_name: string }[]
  selectedId: string
  from: string
  to: string
  rows: Record<string, unknown>[]
  filename: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  function set(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    router.push(`/reports?${next.toString()}`)
  }

  const pick = (id: string) => set({ emp: id })

  function exportCsv() {
    const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Chrome names a "Save as PDF" file after document.title, so setting it
   * first is what turns the print dialog into a proper download with a
   * meaningful filename instead of "localhost".
   */
  function downloadPdf() {
    const previous = document.title
    document.title = filename.replace(/\.csv$/, '')
    window.print()
    // Restore once the dialog has taken its snapshot of the title.
    window.setTimeout(() => {
      document.title = previous
    }, 500)
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} className="epi-no-print epi-report-actions">
      <select
        value={selectedId}
        onChange={(e) => pick(e.target.value)}
        aria-label="Employee"
        style={{ ...selectStyle, border: '1px solid var(--epi-border-2)', fontWeight: 600 }}
      >
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.full_name}
          </option>
        ))}
      </select>
      <label style={dateWrap}>
        <span style={dateTag}>From</span>
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => set({ from: e.target.value })}
          aria-label="Report period start"
          style={dateInput}
        />
      </label>
      <label style={dateWrap}>
        <span style={dateTag}>To</span>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(e) => set({ to: e.target.value })}
          aria-label="Report period end"
          style={dateInput}
        />
      </label>

      {/* The three actions share one row on phones, so the labels shed their
          verbs there — the icon and the format carry the meaning. */}
      <button onClick={downloadPdf} style={primaryButton} title="Opens the print dialog — choose “Save as PDF”">
        <Download size={14} />
        <span className="epi-verb">Download&nbsp;</span>PDF
      </button>
      <button onClick={() => window.print()} style={subtleButton}>
        Print
      </button>
      <button onClick={exportCsv} disabled={rows.length === 0} style={subtleButton}>
        <span className="epi-verb">Export&nbsp;</span>CSV
      </button>
    </div>
  )
}
