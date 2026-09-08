export type EventType = 'positive' | 'goofup'
export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type FollowUpStatus = 'open' | 'in_progress' | 'resolved' | 'dropped'
export type RecordStatus = 'active' | 'archived'
export type EmployeeStatus = 'Active' | 'Inactive' | 'On Hold'
export type AppRole =
  | 'super_admin'
  | 'md'
  | 'executive_assistant'
  | 'department_manager'
  | 'hr'
  | 'viewer'

/**
 * Labels match the design canvas exactly (its SEVS list is
 * Low / Medium / High / Critical). An earlier build showed Minor /
 * Moderate / Serious; that diverged from the canvas and was wrong.
 * The numeric weights still never appear in the recording flow.
 */
export const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const SEVERITY_HINTS: Record<Severity, string> = {
  low: 'Worth noting, no real consequence',
  medium: 'Caused rework or a delay',
  high: 'Cost money, time or a customer',
  critical: 'Safety, compliance or a lost account',
}

export const SEVERITY_ORDER: Severity[] = ['low', 'medium', 'high', 'critical']

/**
 * Impact grades how bad a goofup was — "cost money, time or a customer".
 * None of that scale means anything about a positive contribution, so the
 * field is not offered when recording one and not shown when reading one
 * back. This predicate is the single place that rule lives; every screen
 * that renders or filters on impact asks it rather than testing the type
 * inline, so the two can never drift apart.
 */
export function hasImpact(type: EventType): boolean {
  return type === 'goofup'
}

/**
 * What a positive contribution is stored with. The column is NOT NULL, and
 * the signal engine multiplies every event by its severity weight — so a
 * positive has to carry *some* grade. Fixing it at the neutral middle means
 * recognition_load stays a straight count of recognitions rather than
 * something a recorder can inflate by grading a compliment "critical".
 */
export const NEUTRAL_SEVERITY: Severity = 'medium'

/** Impact for display: the label for a goofup, an em dash for anything else. */
export function impactLabel(type: EventType, severity: Severity): string {
  return hasImpact(type) ? SEVERITY_LABELS[severity] : '—'
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  md: 'Management',
  executive_assistant: 'Executive Assistant',
  department_manager: 'Department Manager',
  hr: 'HR',
  viewer: 'Viewer',
}

export interface AppUser {
  id: string
  auth_user_id: string | null
  employee_id: string | null
  full_name: string
  email: string
  role: AppRole
  is_active: boolean
}

export interface Department {
  id: string
  name: string
  code: string | null
  company: string | null
  is_active: boolean
}

export interface Designation {
  id: string
  title: string
  level: string
  is_active: boolean
}

export interface Category {
  id: string
  name: string
  applies_to: EventType
  default_severity: Severity
  sort_order: number
  is_active: boolean
}

export interface Employee {
  id: string
  employee_code: string | null
  full_name: string
  designation_id: string | null
  department_id: string | null
  manager_id: string | null
  joining_date: string | null
  status: EmployeeStatus
  photo_url: string | null
  contact_phone: string | null
  contact_email: string | null
}

export interface EmployeeWithRefs extends Employee {
  department: { name: string } | null
  designation: { title: string } | null
  manager: { full_name: string } | null
}

export interface PerformanceEvent {
  id: string
  event_ref: string
  employee_id: string
  type: EventType
  title: string
  description: string | null
  event_date: string
  category_id: string | null
  severity: Severity
  recorded_by: string
  department_id: string | null
  tags: string[]
  follow_up_required: boolean
  follow_up_date: string | null
  follow_up_status: FollowUpStatus | null
  follow_up_notes: string | null
  status: RecordStatus
  archived_reason: string | null
  created_at: string
  updated_at: string
}

export interface EventWithRefs extends PerformanceEvent {
  employee: { id: string; full_name: string } | null
  category: { name: string } | null
  department: { name: string } | null
  recorder: { full_name: string } | null
}

/** Row from employee_tracking.v_employee_signal */
export interface EmployeeSignal {
  employee_id: string
  full_name: string
  department_id: string | null
  window_days: number
  min_events: number
  event_count: number
  positive_count: number
  goofup_count: number
  recognition_load: number
  issue_load: number
  critical_goofups: number
  days_since_positive: number | null
  days_since_goofup: number | null
  days_since_any: number | null
  trend_delta: number
  open_followups: number
  overdue_followups: number
  max_overdue_days: number | null
  followup_penalty: number
  repeat_category: string | null
  repeat_count: number | null
  active_weeks: number
  consistency: number
  band: string
  trend_label: string
  explanation: string
}

/** Roles permitted to create performance events (SPEC §14.3 — MD + EAs). */
export const RECORDING_ROLES: AppRole[] = ['super_admin', 'md', 'executive_assistant']

export function canRecord(role: AppRole | null | undefined): boolean {
  return !!role && RECORDING_ROLES.includes(role)
}

/**
 * Full administrative authority.
 *
 * Must stay in step with employee_tracking.is_admin() in the database — the
 * database is what actually enforces this, and a mismatch would show admin
 * controls that then fail, or hide controls the user is entitled to.
 */
export function isAdmin(role: AppRole | null | undefined): boolean {
  return role === 'super_admin' || role === 'md' || role === 'executive_assistant'
}
