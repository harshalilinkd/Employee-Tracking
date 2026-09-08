import { SEVERITY_LABELS, type Severity } from './types'

const IST = 'Asia/Kolkata'

/** "12 Jun" — the compact form used in tables and timelines. */
export function fmtShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseDateOnly(date) : date
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: IST }).format(d)
}

/** "12 Jun 2026" */
export function fmtFull(date: string | Date): string {
  const d = typeof date === 'string' ? parseDateOnly(date) : date
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: IST,
  }).format(d)
}

/** "June 2026" — timeline month grouping. */
export function fmtMonth(date: string | Date): string {
  const d = typeof date === 'string' ? parseDateOnly(date) : date
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: IST }).format(d)
}

/**
 * A date column is a calendar date, not an instant. Parsing "2026-06-12"
 * with `new Date()` yields midnight UTC, which renders as the previous day
 * for anyone west of UTC — so build it as a local date explicitly.
 */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function daysAgo(date: string): number {
  const then = parseDateOnly(date).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - then) / 86400000)
}

/** canvas: ago() — "Today", "3d ago", "2mo ago", "Never" */
export function ago(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'Never'
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.round(days / 30)}mo ago`
  return `${Math.round(days / 365)}y ago`
}

export function severityLabel(s: Severity): string {
  return SEVERITY_LABELS[s]
}

export function greetingFor(name: string, now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: IST }).format(now),
  )
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  return `Good ${part}, ${name.split(' ')[0]}`
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0] as Record<string, unknown>)
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n')
}
