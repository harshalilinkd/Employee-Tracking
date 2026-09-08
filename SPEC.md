# Employee Performance Intelligence — Build Specification

**Owner:** Raghav (LD Group / ELDEE GROUP)
**Status:** v1.0 — build spec for Claude Code
**Replaces:** the `Emp-Name | Designation | Department | Positive Contribution | Goofups` Google Sheet

---

## 0. How to use this document

This is the source of truth for the build. Read it fully before writing code.

If something here is ambiguous, choose the most professional interpretation and note the assumption in `DECISIONS.md`. Do not invent business rules that contradict Section 4 (data model) or Section 5 (performance signal) — those two are load-bearing.

**Build order is Section 13. Follow it.**

---

## 1. What this system is

A management intelligence layer for employee performance at LD Group — a Mumbai textile group of four companies (LD Silk Mills, Linkd Prints, LD Cotton Mills, Vhagar) with roughly 15 tracked staff at launch.

The core loop:

```
EMPLOYEE
   │
   ├──── POSITIVE CONTRIBUTION ────┐
   │                               ├──→ PERFORMANCE EVENT
   └──── GOOFUP ───────────────────┘         │
                                             │
              ┌──────────────┬───────────────┼──────────────┐
              ↓              ↓               ↓              ↓
          Category       Severity      Recorded By      Follow-up
              └──────────────┴───────────────┴──────────────┘
                                   ↓
                          EMPLOYEE TIMELINE
                                   ↓
              ┌────────────────────┼────────────────────┐
              ↓                    ↓                    ↓
          Dashboard            Reports              Insights
```

**The Performance Event is the atomic unit.** The Employee Timeline is the historical memory. The Dashboard is the intelligence layer. Reports and Insights are the decision-support layer. Settings and Access are the governance layer.

### The test this system must pass

It is not a tracker. It is a management intelligence system. It must be able to answer, from real stored data and without a developer:

1. "Show me all goofups related to Data Entry in Production during the last 90 days."
2. "What has Kavita done exceptionally well this quarter?"
3. "Which employees have repeated issues?"
4. "Which departments are improving?"
5. "Who has not been recorded at all in 60 days?" (silence is also a signal)
6. "Which follow-ups are overdue?"

Every one of those must be reachable through filters and saved views in the UI — not only through a chart. If a query in that list cannot be answered by the built UI, the feature is incomplete.

---

## 2. Users and roles

| Role | Scope | Create | Edit | Archive | Reports | Insights | Settings | Audit |
|---|---|---|---|---|---|---|---|---|
| Super Admin | All | ✓ | Any | ✓ | ✓ | ✓ | ✓ | ✓ |
| MD / Management | All | ✓ | Any | ✓ | ✓ | ✓ | ✓ | ✓ |
| Executive Assistant | All | ✓ | Own + 48h window | ✗ | ✓ | ✓ | ✗ | ✗ |
| Department Manager | Own department only | ✓ | Own only | ✗ | Own dept | Own dept | ✗ | ✗ |
| HR | All | ✓ | Own only | ✗ | ✓ | ✓ | Employee DB only | ✗ |
| Viewer | Assigned scope | ✗ | ✗ | ✗ | Read-only | ✗ | ✗ | ✗ |

Rules:
- A Department Manager must never see another department's events, employees, or aggregate numbers. Enforce this in the database (row-level security), not only in the UI.
- A user cannot record a performance event about themselves.
- Nothing is ever hard-deleted. Archive only, with reason captured.
- Management Notes (Section 8) are visible to MD / Super Admin only.

---

## 3. Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui + Lucide icons
- Supabase — Postgres, Auth, Row Level Security, Storage for attachments
- Recharts for charts
- Deployed on Vercel

Non-negotiables: strong typing end to end, Zod validation on every form, loading skeletons, error boundaries, toast feedback, no `any`.

---

## 4. Data model

Do **not** store contributions or goofups as comma-separated text on the employee record. Each observation is its own row. This is the single most important structural rule in the system.

### `departments`
`id` · `name` · `company` (LD Silk Mills | Linkd Prints | LD Cotton Mills | Vhagar | Group) · `head_employee_id` · `is_active`

### `designations`
`id` · `title` · `level` (Staff | Senior | Lead | HOD | Management) · `is_active`

### `employees`
`id` · `employee_code` (unique, e.g. `LD-014`) · `full_name` · `designation_id` · `department_id` · `manager_id` (self-ref) · `joining_date` · `status` (Active | Inactive | On Hold) · `photo_url` · `contact_phone` · `contact_email` · `created_at` · `updated_at`

An employee with any performance history can be set Inactive but never deleted.

### `categories`
`id` · `name` · `applies_to` (positive | goofup) · `default_severity` · `sort_order` · `is_active`

Seed values — Positive: Exceptional Performance, Problem Solving, Initiative, Teamwork, Leadership, Customer Service, Cost Saving, Process Improvement, Quality, Productivity, Reliability, Other. Goofup: Quality Issue, Process Error, Delay, Communication, Data Entry, Customer Issue, Production Error, Negligence, Compliance, Safety, Other.

Categories are editable from Settings. Never hardcode them in components — always read from the table.

### `performance_events` — the core table
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `event_ref` | text | Human-readable, e.g. `PE-2026-0412`. Shown in UI |
| `employee_id` | uuid | FK |
| `type` | enum | `positive` \| `goofup` |
| `title` | text | Required, short summary |
| `description` | text | Optional in Quick Record |
| `event_date` | date | When it happened — required |
| `category_id` | uuid | |
| `severity` | enum | `low` \| `medium` \| `high` \| `critical` |
| `recorded_by` | uuid | FK to users. Never editable after creation |
| `department_id` | uuid | Snapshotted at creation — do not join live |
| `tags` | text[] | |
| `follow_up_required` | bool | |
| `follow_up_date` | date | |
| `follow_up_status` | enum | `open` \| `in_progress` \| `resolved` \| `dropped` |
| `follow_up_notes` | text | |
| `status` | enum | `active` \| `archived` |
| `archived_reason` | text | |
| `created_at` / `updated_at` | timestamptz | |

`event_date` and `created_at` are different fields and both matter. An MD recording something from last week must not have it appear as today.

`department_id` is snapshotted deliberately — if Kavita moves from Designing to Production, her old events stay attributed to Designing. Department reports would otherwise silently rewrite history.

### `attachments`
`id` · `event_id` · `file_url` · `file_name` · `file_size` · `uploaded_by` · `created_at`

### `management_notes`
`id` · `employee_id` · `author_id` · `body` · `created_at`. MD / Super Admin only, enforced by RLS.

### `audit_log`
`id` · `actor_id` · `entity_type` · `entity_id` · `action` (create | update | archive | restore) · `field_changed` · `old_value` · `new_value` · `created_at`

Every write to `performance_events`, `employees`, `categories` and user permissions goes to the audit log via a Postgres trigger, not application code. Application-level auditing gets forgotten; triggers don't.

### `users`, `roles`, `user_permissions`
Supabase Auth user linked to an optional `employee_id`, a role, and a department scope.

---

## 5. The Performance Signal

**Do not build a positive-minus-goofup score.** A count of +1 and −1 is management malpractice: it treats a critical safety violation the same as a late report, and it punishes visible employees whose work generates more observations of both kinds.

Instead compute a **Performance Signal** across six dimensions over a rolling window (default 90 days, configurable).

### Dimensions

| Dimension | What it measures |
|---|---|
| Recognition | Count of positive events, weighted by severity/impact |
| Issue load | Count of goofups, weighted by severity |
| Recency | Time-decay so recent events matter more than old ones |
| Trend | Direction over the last two halves of the window |
| Consistency | Variability of the event pattern — steady vs erratic |
| Follow-up health | Open and overdue follow-ups attached to this employee |

### Weights (store in `settings.signal_config`, editable by Super Admin)

```
severity_weight = { low: 1, medium: 2, high: 3.5, critical: 6 }
recency_decay   = exp(-days_ago / 45)      # half-life ~31 days

recognition_load = Σ (severity_weight × recency_decay)   over positive events
issue_load       = Σ (severity_weight × recency_decay)   over goofup events

trend = (events in recent half) vs (events in earlier half), signed
followup_penalty = (open follow-ups × 0.5) + (overdue follow-ups × 1.5)
```

### Bands

| Band | Condition |
|---|---|
| **Strong** | recognition_load ≥ 6 and issue_load < 3 and trend not negative |
| **Stable** | issue_load < 4 and no overdue follow-ups |
| **Watch** | issue_load 4–7, or two or more goofups in the same category, or trend negative |
| **Attention** | issue_load ≥ 7, or any `critical` goofup in window, or ≥ 2 overdue follow-ups |
| **No signal** | fewer than 3 events in window → display "Not enough data" |

That last band is mandatory. Silence must never render as "Stable" — an employee nobody has observed is a different problem from an employee doing fine, and conflating them is how this kind of system loses management trust.

### Explainability requirement

Every signal badge must be hoverable/tappable and produce the plain-English reason:

> **Attention** — 3 goofups recorded (weighted load 9.8), two of them in Data Entry. Last positive contribution was 41 days ago. 1 follow-up overdue by 6 days.

If the UI cannot explain why an employee is marked Attention, the badge does not ship. An MD who cannot defend the label in a conversation with a manager will stop using the system.

### Trend labels

`Improving` ↗ · `Stable` → · `Softening` ↘ · `Slipping` ↓ — computed from the trend dimension, always paired with the window ("last 90 days") so the label is never floating.

---

## 6. Screens

### 6.1 App shell
Sidebar: Overview · Employees · Performance · Reports · Insights — then a Management group: Employee Database · Categories · Settings. User, role and logout pinned to the bottom. Compact, not wide.

Top bar: breadcrumb · global search · **+ Record Performance** (primary, always visible) · notifications · avatar.

### 6.2 Dashboard
Greeting ("Good morning, Raghav") and "Here's what is happening across your workforce." Date range: This Week / This Month / Last 3 Months / This Year / Custom. Filters: department, employee, designation, event type, category, severity, recorded by. Filter state persists in the URL so views are shareable.

KPI strip — Employees · Positive Contributions (± vs previous period) · Goofups (± vs previous period) · Employees Recognised · Needs Attention · Open Follow-ups. Subtle semantic colour only; no giant coloured boxes.

Main area: **Employee Performance Matrix** (large, left) beside **Needs Attention** (right).

Matrix columns: Employee · Department · Designation · Positive · Goofups · Net Trend · Last Activity · Signal. Rows clickable to profile. Sortable by Most Positive / Most Goofups / Most Improved / Most Active / Needs Attention / Recently Active / Longest Silent.

Second row: Positive vs Goofup trend over time, and Department comparison.
Third row: Recent Performance Activity feed.

Do not force every section into an equal-sized card. Editorial hierarchy — the matrix is the hero.

### 6.3 Employee Profile — the most important screen
Header: name, designation, department, avatar. Top right: **+ Positive Contribution** and **+ Goofup**.

Summary strip: Positive · Goofups · Open Follow-ups · Last Activity — plus the Performance Signal with its explanation.

Tabs: Overview · Timeline · Positive Contributions · Goofups · Reports · Notes (MD only).

The **Performance Timeline** is the signature component. Grouped by month, newest first, each entry showing icon, title, description, category, impact, recorded by, and date. It should read like a journal, not a table.

### 6.4 Record Performance
Opens as a modal on desktop, full-screen sheet on mobile.

Step 1 — "What happened?" Two large choices: ✓ Positive Contribution · ⚠ Goofup.
Step 2 — contextual form: Employee (searchable) · Title · What happened · Date (defaults today) · Category (filtered by type) · Impact · Who observed this (defaults to current user) · Tags · Attachment · Follow-up required → date + action.

Buttons: Cancel · Save Event · Save & Add Another.

Progressive disclosure: title, employee, type and date are visible immediately; everything else sits behind "Add detail". Never lose unsaved input — warn on close.

### 6.5 Quick Record
For MD and EA on mobile. Employee → type → one line of description → Save. Three taps. Everything else editable later. This mode is what determines whether the system is actually used; treat it as a first-class feature, not a shortcut.

### 6.6 Performance (event ledger)
Searchable, filterable table of all events: Date · Employee · Type · Title · Category · Impact · Recorded By · Status · Actions. Dense table on desktop, cards on mobile. This screen is what answers question 1 in Section 1 — make filter combinations saveable as named views.

### 6.7 Reports
Employee-wise · Department-wise · Positive contributions · Goofups · Trend · Category analysis · Severity analysis · Recorded-by analysis.

Employee Performance Report is the core one: summary → signal → timeline → detailed event table → trend chart. Print, PDF export, CSV export.

Recorded-by analysis matters more than it looks: it shows whether one manager records every goofup and never a contribution. That is a management-behaviour signal, not an employee one.

### 6.8 Insights
Generated from real data only. Never fabricate. Examples of the form:
- "Data Entry errors account for 38% of goofups recorded in the last 30 days."
- "Production has the highest goofup rate this quarter, concentrated in two employees."
- "Kavita Rane has shown a consistent positive trend across three months."
- "4 employees have had no performance record in over 60 days."

When data is thin: "Not enough data to identify a reliable trend." Every insight links through to the filtered event list that produced it.

### 6.9 Employee Database, Categories, Settings, User Access, Audit Log
Per Sections 2, 4 and the source PRD. Settings sections: General · Departments · Designations · Categories · Severity Levels · Signal Configuration · User Access · Notifications · Audit Log.

---

## 7. Responsive behaviour

Design for 1440+ / 1280 / tablet / 430 / 390 / 320. Do not shrink the desktop layout.

- Desktop: persistent sidebar, multi-column, dense tables.
- Tablet: collapsible sidebar, adaptive grids.
- Mobile: bottom nav (Home · Employees · Performance · Reports · More), stacked cards, filters in a drawer, tables become cards or timelines, Record Performance is a full-screen sheet, profile becomes a vertical scroll.

---

## 8. Design system

Calm, executive, premium. Reference quality: Linear, Attio, Stripe Dashboard, Ramp — without copying any of them.

- Typography with strong hierarchy, compact labels, highly readable body, tabular numerals for all figures.
- Primary: deep teal / sophisticated blue-green. Positive: muted green. Goofup: muted red. Warning: warm amber. Neutral: slate.
- Colour used sparingly and semantically. Never a rainbow dashboard.
- Cards used selectively with subtle borders; tables and timelines integrated into the page, not boxed.
- Motion: fast and professional. Drawer slide, modal entrance, toast, skeletons, staggered timeline reveal. Nothing gimmicky.

Accessibility: WCAG AA contrast, full keyboard navigation, visible focus rings, 44px minimum touch targets, semantic HTML, screen-reader labels on all icon-only buttons.

---

## 9. UX rules

1. Every important action is obvious.
2. Recording is fast — under 20 seconds for Quick Record.
3. Employee history is one click from anywhere.
4. Filters persist and are shareable via URL.
5. Never silently lose unsaved form data.
6. Confirm destructive actions.
7. Never hard-delete performance history.
8. Always show who recorded an event and when it happened.
9. Human language in the UI, no technical terms.
10. Empty states always carry a next action, never a blank screen.

---

## 10. Privacy and governance

This system holds sensitive judgements about named individuals. Treat it accordingly.

- Enforce access in Postgres RLS, not just in React.
- No employee performance data in shareable/public URLs; no data in query strings beyond IDs behind auth.
- Every edit is audit-logged with old and new values.
- `recorded_by` is immutable.
- Archive with a reason; never delete.
- Consider a short edit window (48h) for non-MD roles, after which corrections are appended rather than overwritten.

Two things stay out of this system entirely, per group policy: succession planning around key operational staff, and any compensation detail. Do not add fields for either.

---

## 11. Seed data

Use real LD Group names and departments so the UI reads true from day one — no lorem ipsum, no generic placeholder names.

| Name | Designation | Department | Company |
|---|---|---|---|
| Kavita Rane | Sr. Designer | Designing | Linkd Prints |
| Aditya Sharma | MIS Executive | MIS & Systems | Group |
| Pankaj Yadav | ERP Operator | Accounts | LD Cotton Mills |
| Suresh Patil | Fusing Operator | Production | Linkd Prints |
| Pawan Rathod | Sales Support | Sales | LD Silk Mills |
| Malika Merchant | Executive Assistant | Administration | Group (Kalbadevi) |
| Anand Gupta | Billing Executive | Accounts | Linkd Prints |
| Nandkishor Desai | Production HOD | Production | Linkd Prints |

Seed roughly 55 events across 90 days, weighted so a few employees land in each signal band and at least one has too little data to score. Event titles must sound like the actual business — fusing rejections, print alignment, dispatch delays, SAB entry errors, urgent design corrections — not generic office scenarios.

---

## 12. Definition of done per feature

A feature is done when: it works on 390px and 1440px, has loading and empty and error states, validates input, writes to the audit log where applicable, respects role permissions when logged in as a Department Manager, and survives a page refresh with filters intact.

---

## 13. Build order

1. Supabase project, schema, RLS policies, audit triggers, seed data
2. Auth and the app shell (sidebar, top bar, role-aware nav)
3. Employee Database — list, add, edit, deactivate
4. Record Performance form + Quick Record
5. Performance ledger with filters and saved views
6. Employee Profile with the Performance Timeline
7. Signal engine as a Postgres view or scheduled function, with explainability payload
8. Dashboard — KPIs, matrix, needs-attention, trend, department comparison
9. Reports and exports
10. Insights
11. Settings, User Access, Audit Log
12. Mobile pass — bottom nav, drawers, sheets, card transforms
13. Polish — motion, skeletons, empty states, accessibility audit

Ship steps 1–6 as the first usable version. A system where events can be recorded and an employee's history read is already more useful than the current spreadsheet; everything after that is intelligence layered on top of data that is by then real.

---

## 14. Open decisions for Raghav

These need a human answer before the relevant step, and are deliberately left unresolved here:

1. **Severity weights** — are the values in Section 5 right for LD? A critical safety goofup at 6× a low one is a judgement call.
2. **Window length** — is 90 days the right default review window, or should it follow the Indian FY quarter?
3. **Who records** — is recording open to all HODs, or restricted to MD and the two EAs (Alisha, Malika) at launch? Open recording produces more data and more disputes.
4. **Employee visibility** — can an employee ever see their own timeline? Recommended: not in v1. Revisit once the recording culture is established.
5. **Positive:goofup ratio expectation** — if managers only ever record goofups, the system becomes a complaint box. Consider a soft nudge in the Insights layer when a recorder's ratio skews hard negative.
