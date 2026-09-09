/**
 * Reading the audit log.
 *
 * Since migration 011 a save is one row whose old_value / new_value hold a
 * JSON object of only the fields that changed. Rows written before that
 * migration hold a single bare value with the field name in field_changed,
 * so both shapes have to render — an audit trail you have to migrate is an
 * audit trail you have edited.
 */

export interface FieldChange {
  field: string
  label: string
  from: string
  to: string
}

const LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  event_date: 'Date',
  severity: 'Impact',
  category_id: 'Category',
  department_id: 'Department',
  designation_id: 'Designation',
  manager_id: 'Reports to',
  employee_id: 'Employee',
  observed_by: 'Observed by',
  status: 'Status',
  archived_reason: 'Reason',
  full_name: 'Name',
  contact_email: 'Email',
  contact_phone: 'Phone',
  employee_code: 'Code',
  joining_date: 'Joined',
  is_active: 'Active',
  role_note: 'Role / note',
  applies_to: 'Applies to',
  default_severity: 'Default impact',
  name: 'Name',
  role: 'Role',
  record: 'Record',
}

function label(field: string): string {
  if (LABELS[field]) return LABELS[field]
  return field.replace(/_id$/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function display(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  const s = String(v)
  // A raw uuid tells a reader nothing; the field label already says what
  // kind of thing changed, so say that it changed rather than to which id.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return 'set'
  return s.length > 90 ? `${s.slice(0, 90)}…` : s
}

function parse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  const t = raw.trim()
  if (!t.startsWith('{')) return null
  try {
    const v = JSON.parse(t)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function describeChange(
  fieldChanged: string | null,
  oldValue: string | null,
  newValue: string | null,
): FieldChange[] {
  const before = parse(oldValue)
  const after = parse(newValue)

  if (before || after) {
    const keys = [...new Set([...Object.keys(after ?? {}), ...Object.keys(before ?? {})])]
    return keys.map((k) => ({
      field: k,
      label: label(k),
      from: display(before?.[k]),
      to: display(after?.[k]),
    }))
  }

  // Pre-011 row, or a delete row whose old_value is a plain summary.
  if (!fieldChanged) return []
  return [
    {
      field: fieldChanged,
      label: label(fieldChanged),
      from: display(oldValue),
      to: display(newValue),
    },
  ]
}

export const ACTION_TONE: Record<string, 'green' | 'blue' | 'orange' | 'red' | 'muted'> = {
  create: 'green',
  update: 'blue',
  archive: 'orange',
  restore: 'blue',
  delete: 'red',
}
