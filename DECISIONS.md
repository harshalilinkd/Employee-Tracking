# Decisions

Assumptions and judgement calls made while building against `SPEC.md`.
Anything in Section 14 of the spec that Raghav answered is recorded here as settled.

---

## Answers to SPEC §14 (open decisions)

| # | Question | Decision |
|---|---|---|
| 1 | Severity weights | **Unchanged** — low 1, medium 2, high 3.5, critical 6. Stored in `settings.signal_config`, retunable in Settings without a deploy. The UI never shows a recorder a number: the form reads Minor / Moderate / Serious / Critical. |
| 2 | Window length | **90-day rolling** for the signal; FY quarter offered as a *report view* only. A quarter-aligned signal would flip an employee's band overnight on 1 April with no new events, which is indefensible in a conversation with a manager. Rolling has no cliff edge. |
| 3 | Who records | **MD + Executive Assistants only.** HODs do not record at launch. Enforced by `employee_tracking.can_record()`; widening it later is a one-line change to that function, no migration. |
| 4 | Employee self-view | **No self-view in v1.** Employees have no login. |
| 5 | Positive:goofup ratio nudge | Deferred to the Insights step (§6.8), not yet built. |

---

## Environment

**Supabase project `mingqlwwbwnrkyhklpyq` (team-apps) is shared with nine other applications** —
`baithak`, `ld_board`, `leadgen`, `scot_ld`, `scot_linkd`, `system_hub`, `df`, `evaluation`,
`delegation_webapp`, plus a populated `public`.

Consequences that shaped the build:

1. **One schema, `employee_tracking`.** Every object this app owns lives there. Nothing is created
   in `public`. No other app's schema is written to, ever.

2. **`auth.users` is shared** — one pool of 100 accounts behind all ten apps. A login existing there
   grants *nothing* here. Access is gated by a row in `employee_tracking.app_users`, which has its own
   primary key rather than reusing `auth.users.id`, so another app deleting a user cannot cascade into
   our performance history (the FK is `on delete set null`).

3. **ACTION REQUIRED — expose the schema.** PostgREST will not serve `employee_tracking` until it is
   added under **Supabase Dashboard → Settings → API → Exposed schemas**. This is additive and does not
   affect the other nine apps. The app cannot read anything until this is done.

---

## Data model

- **`event_date` vs `created_at`** are separate and both retained, per spec. An MD recording last
  week's incident does not have it read as today.

- **`department_id` is snapshotted** onto every event at creation and frozen by a trigger
  (`pe_snapshot_and_freeze`). Attempting to change it raises. If an employee transfers, their old
  events stay attributed to the department the work actually happened in — otherwise department
  reports silently rewrite history.

- **`recorded_by` and `event_ref` are immutable**, enforced by the same trigger rather than by the form,
  so the rule holds regardless of who or what writes.

- **No `DELETE` privilege is granted to `authenticated` on any table** except `user_departments`
  (where add/remove is the actual semantic). "Never hard-delete performance history" is therefore a
  database privilege, not a convention the UI could forget. Archiving is an `UPDATE` of `status`,
  which requires `archived_reason` to be non-empty via a CHECK constraint.

- **`pe_event_date_not_future`** uses `now()`, which is STABLE rather than IMMUTABLE. Postgres permits
  this and it is safe in this direction: the predicate only becomes *more* true as time passes, so a
  dump/restore can never fail validation on existing rows.

- **`employee_code` is UNIQUE but nullable.** Five real staff have no code yet; Postgres allows
  repeated NULLs, so they remain trackable without inventing codes for them.

---

## Roster import (one-time, migration 003)

The spec's §11 seed table describes people who **already exist** in `evaluation.profiles` — Kavita Rane,
Nandkishor Desai, Alisha Pandav, Raghav Tibrewala — but with different employee codes (`KA-02`, not the
spec's `LD-014` format) and different department names (`Design`, not `Designing`). Seeding the spec's
list verbatim would have created a second competing roster of the same humans.

Decision: **import once** from `evaluation.profiles`, keeping existing codes. Result: 57 employees,
20 departments, 23 designations.

- The import **never reads compensation**. `evaluation.employment_records.current_ctc`,
  `joining_ctc` and `evaluation.salary_history` are deliberately untouched — SPEC §10 bars
  compensation from this system entirely.
- `employees.source_profile_id` and `departments.source_ref` record provenance so a re-sync can match
  rows. They are advisory columns with **no foreign key**, so this schema stays independently droppable.
- **Department `company` is left NULL** for Raghav to assign in Settings. The source departments carry
  no company, and guessing which of LD Silk Mills / Linkd Prints / LD Cotton Mills / Vhagar each belongs
  to would have produced confident wrong answers in reports.
- **Case-variant designations were merged**: the source has both `helper` (10) and `Helper` (7), and
  `Designer` (4) and `designer` (1). Grouping on `lower()` and taking `min()` picks the capitalised
  variant, so 17 helpers share one designation row rather than splitting across two.
- **`Electriciation` was imported verbatim** (Janardan Khushawah). It appears to be a typo for
  Electrician, but correcting a real person's record is Raghav's call, not a silent import fix.
  Editable in Settings → Designations.

### Launch users

All four already existed in `auth.users`; **no accounts were created**. Google OAuth is already
enabled on this project, so both email+password and "Continue with Google" work with no extra setup.

| Email | Role | Linked employee |
|---|---|---|
| ai.linkdprints@gmail.com | Super Admin | — (operations account) |
| raghavtibrewala96@gmail.com | Super Admin | Raghav Tibrewala |
| naushi.linkdprints@gmail.com | MD | Naushi Tibrewala |
| alishakathe99@gmail.com | Executive Assistant | Alisha Pandav |

**There is no "Malika" in the roster.** SPEC §14.3 refers to "the two EAs (Alisha, Malika)"; only
Alisha Pandav exists in `evaluation.profiles`. Malika can be added once she has an account.

---

## Demo data (migration 004) — REMOVABLE

55 events across 90 days, on 15 real employees. **These are fabricated.** Every row carries the
`demo-seed` tag. To purge before go-live:

```sql
delete from employee_tracking.audit_log
 where entity_type = 'performance_events'
   and entity_id in (select id from employee_tracking.performance_events where 'demo-seed' = any(tags));
delete from employee_tracking.performance_events where 'demo-seed' = any(tags);
```

Must be run from the SQL editor or a service-role connection — `authenticated` holds no DELETE, so a
normal user of the app cannot destroy history, seeded or real.

Recorder mix was left realistic rather than engineered: the EA logs most operational goofups, the MD
and Super Admin log most recognition. The §6.7 "recorded-by analysis" insight will surface genuine
skew once real recording starts, rather than being staged in demo data.

---

## Signal engine (migration 005)

Built as a Postgres view, `employee_tracking.v_employee_signal`. Pulled forward from build step 7
because step 6 (Employee Profile) cannot meet its spec without it — §6.3 puts the signal and its
explanation in the profile summary strip.

- **`security_invoker = true` is load-bearing.** Postgres views default to the *view owner's* rights,
  which would bypass RLS on `performance_events` and hand a Department Manager the entire company's
  aggregates. With invoker rights the underlying RLS still applies. Verified: a Design-scoped manager
  gets 9 signal rows, not 57.
- **Band precedence is Attention → Watch → Strong → Stable**, not the spec's listing order. An
  employee with strong recognition *and* two goofups in one category resolves to Watch. Safety-first
  ordering; the bands would otherwise overlap ambiguously.
- **Follow-ups are not window-limited.** An overdue action from four months ago is still overdue, and
  ageing it out of the window would defeat the purpose.
- **Trend thresholds**: `delta >= 2` Improving, `<= -2` Softening, `<= -4` Slipping, else Stable,
  where delta is (net recent half) − (net earlier half). The spec defines the dimension but not the
  cut-offs.
- **Consistency** is implemented as distinct active weeks ÷ weeks in window. The spec names the
  dimension ("steady vs erratic") without prescribing a formula; this one is explainable in a sentence,
  which matters more than statistical elegance here.
- **"No signal" takes precedence over everything.** Fewer than 3 events in the window renders
  "Not enough data", never "Stable".

---

## Verified, not assumed

Governance was tested by impersonating real JWTs in rolled-back transactions, rather than trusting
the policies to read correctly:

| Check | Result |
|---|---|
| Login from another app in this project (no `app_users` row) | sees 0 employees, 0 events, 0 signal rows |
| Department Manager scoped to Design | 9 employees, 1 department, 7 events, all Design; `can_record` false; 0 audit rows |
| Executive Assistant | 57 employees, 55 events; 0 audit rows; 0 management notes |
| Recording an event about yourself | blocked — *"A user cannot record a performance event about themselves"* |
| Recording under another user's identity | blocked by RLS |
| Hard-deleting an event | blocked — *permission denied for table performance_events* |

Supabase security advisor: of 403 project-wide lints, 2 touch this schema. One was fixed
(`touch_updated_at` mutable search_path, migration 006); the other is intentional
(`event_ref_counters` has RLS with no policy, which denies all direct access by design).

---

## Design (added after the canvas appeared mid-build)

Raghav added `Employee performance tracking system/` — a Claude Design canvas —
while the database was being built, and asked for the UI to match it exactly.

- **The canvas palette wins over SPEC §8.** The spec asks for deep teal primary,
  muted green positive, muted red goofup. The canvas uses violet
  (`#7C5CFF` / `#5B3BDB`) with **amber for goofups and violet for positives**,
  dark-first with a light theme. Confirmed with Raghav: follow the canvas. It is
  newer, complete, internally coherent, and already avoids the "rainbow
  dashboard" the spec warns against.
- **Tokens ported verbatim** into `src/app/globals.css` as the same `--epi-*`
  variables, so the canvas and the app can be compared directly.
- **Two additions to the token set.** `--epi-accent` existed only inside the
  canvas's `pal()` helper, and the `-bg` / `-bd` pairs replace its runtime
  `tint(hex, alpha)` — CSS variables cannot compute `rgba()` from a hex. Values
  are the canvas's own tints: 0.12 fill, 0.28 border.
- **Inline styles, not Tailwind classes.** The canvas is built from inline
  styles on CSS variables; porting it that way is what "exact" means here and
  keeps the two diffable. Tailwind is installed and available.
- **Focus rings added.** The canvas signals affordance through hover only.
  A visible `:focus-visible` ring was added for WCAG AA keyboard access
  (SPEC §8). This is an addition, not a departure.
- **The SSO button says "Continue with Google".** The canvas labels it
  "ELDEE GROUP SSO". Google is the provider actually enabled on this project and
  the accounts are `@gmail.com`, so a button labelled SSO that opens Google
  would misdescribe itself.
- **Severity shown as words.** Minor / Moderate / Serious / Critical, with a
  one-line hint each. The numeric weights never appear in the recording flow.

## Framework

- **Next.js 16.3.4, not 15.1.3.** The version pinned first carried
  CVE-2025-66478. `npm audit` is clean at 16.3.4.
- **`src/proxy.ts`, not `src/middleware.ts`.** Next 16 deprecated the middleware
  file convention; the official codemod refused to run without a clean git tree,
  so the rename was done by hand (`middleware` → `proxy`).
- **`typedRoutes` is off.** Filter state lives in the URL (SPEC §9.4), so routes
  are dynamic query strings that a literal route union cannot express without a
  cast at every call site.
- **No git repository was created.** `git init` was run once so the Next codemod
  would proceed, then removed — the project was not a repo and that was not asked for.

## Outstanding

1. **`employee_tracking` must be added to Supabase → Settings → API → Exposed
   schemas.** Until then every query returns `PGRST106`. Verified as still
   unexposed at time of writing. This cannot be set through the tools available
   here; it is a dashboard toggle.
2. Department `company` values are unset — assign in Settings once that screen exists.
3. `Electriciation` (Janardan Khushawah) looks like a typo for Electrician; left
   verbatim deliberately.
4. Saved views on the ledger (SPEC §6.6) are not yet built; filters do persist in
   the URL and are shareable.
5. Reports, Insights, Settings, Categories are navigable placeholders (steps 9–11).

---

## Correction: navigation followed the spec, not the canvas

The first UI build took navigation from SPEC §6.1 — "Overview · Employees · Performance · Reports ·
Insights, then a Management group: Employee Database · Categories · Settings" — eight items across two
groups. **The canvas has four**: `navMain = [Dashboard, Performance, Reports, Settings]`.

Rebuilt to match the canvas, which supersedes the spec here:

- **Sidebar is four items**, with the canvas's dot markers rather than icons. `Overview` is now
  `Dashboard`.
- **Employee Database and Categories are Settings tabs**, not top-level screens. The canvas renders
  them under an `h1` of "Settings" with `settingsTabsList = ['Employee database',
  'Performance categories', 'User access', 'Audit log', 'General']`.
- **Routes `/employees` (list), `/insights`, `/categories`, `/database` were deleted.**
  `/employees/[id]` remains, reached from the matrix.
- **Bottom nav is Home · Activity · Reports · Settings**, matching the canvas's `bottomNav`.
- **Breadcrumbs follow the canvas `crumbMap`**: Dashboard / Activity / Reports & insights /
  the active Settings tab.

## Correction: severity labels

Shipped as Minor / Moderate / Serious / Critical, reasoning from "keep it simple and user friendly".
The canvas's `SEVS` list is **Low / Medium / High / Critical**, and the screenshots confirm it.
Reverted. Stored values were never affected — this was display only.

## Built out in this pass

- **Reports** is now real, not a placeholder: employee selector, Print, Export CSV, summary strip with
  signal, Detailed events table, Department comparison, Category analysis.
- **Settings** is real across all five tabs, including a working Audit log (Super Admin / MD only,
  enforced in the database) and Signal configuration under General.
- **Dashboard** gained the canvas's date-range pills, FILTERS row, By employee / By department matrix
  toggle, sort selector and "Show all N employees" expansion. All filter state lives in the URL.

## Demo data removed

The 55 `demo-seed` events were purged on request, along with their audit rows. Employees (57),
users (5), categories (23) and the roster import's own audit trail (182 rows) were kept.
Migration `004_seed_demo_events.sql` can be re-run to repopulate for visual comparison, then purged
again with the query at the top of that file.

---

## Bug: employee lists silently returned zero rows

The Employee Database showed "0 employees" against a table holding 57.

Cause: there are **two** foreign keys between `employees` and `departments` —
`employees.department_id → departments.id`, and `departments.head_employee_id → employees.id`
(added so a department can name its head). PostgREST cannot resolve `department:departments(name)`
against two candidate relationships, returns `PGRST201`, and **fails the whole query** — so
`data` came back null and the UI rendered an empty list rather than an error.

This silently affected the profile page, Reports, and — worst — the Record drawer's employee
picker, meaning nothing could be recorded.

Fixed by naming the relationship: `department:departments!employees_department_id_fkey(name)`.

A second, subtler variant: the manager self-join. `employees!employees_manager_id_fkey(...)` errors
(`PGRST200`), while `employees!manager_id(...)` *succeeds but returns the wrong direction* — an
employee's direct reports instead of their manager. The correct form is `manager:manager_id(...)`.
In the Employee Database the manager name is now resolved from a plain id→name map over rows we
already fetched, avoiding the embed altogether.

**Lesson worth keeping:** a failed PostgREST embed looks exactly like an empty table. Any list that
renders zero where data exists is a query error until proven otherwise.

## Employee database is now editable (was "build step 11")

Add and edit are live for Super Admin, Management and HR — name, code, department, designation,
reporting line, joining date, status, email, phone. Duplicate employee codes report as a readable
message rather than a Postgres constraint dump. Status supports Active / On Hold / Inactive, so
someone can leave the matrix without their history being deleted.

## User access is now manageable (migration 007)

Previously, granting access meant hand-written SQL, because `app_users.auth_user_id` cannot be set
until the person's `auth.users` row exists — which does not happen until their first login.

`employee_tracking.claim_app_user()` resolves this: an admin pre-authorises someone **by email**, and
on that person's first sign-in the function links their auth account to the waiting row. It is
SECURITY DEFINER (the claimer is not yet an admin, so RLS would block the update) and deliberately
narrow — it only fills a NULL `auth_user_id`, only where the row's email matches the caller's own
verified auth email, and only while the row is active. It cannot change a role, re-point an existing
link, or affect anyone else.

The Settings → User access tab now lists everyone, shows **Linked** vs **Pending**, and lets Super
Admin / Management change roles, disable accounts, and grant access by email. Nobody can change
their own role.

---

## Scope narrowed: LD Silk Mills only

Raghav confirmed this system serves **LD Silk Mills alone**, not the four-company group the
spec describes.

- All 20 departments were set to `company = 'LD Silk Mills'`; none are unassigned.
- `settings.general.organisation` is now `LD Silk Mills`.
- Page title, description and the login footer no longer list the sibling companies.
- The `company` enum still carries all five values. It is kept rather than dropped: removing it
  would need a migration, and it costs nothing to leave a column that every row now agrees on.
  If another company is ever brought in, the field is already there.

This closes the previously-flagged blocker "department companies are unset" — company-level
grouping is no longer needed, because there is only one company.

---

## Impact is a goofup scale, not an event scale

Raghav: *"if user selected positive contribution then why we showing impact field."*

Impact reads Low / Medium / High / Critical with hints like "cost money, time or a
customer". None of that describes a recognition. The field is now offered only when
recording a goofup, and renders as an em dash everywhere a positive is read back.

`hasImpact()` and `impactLabel()` in `src/lib/types.ts` are the single source of that
rule; every screen asks them rather than testing `type === 'goofup'` inline, so the
record form and the six read surfaces cannot drift apart.

Two consequences, both deliberate:

- **Positives store `medium`.** The column is `NOT NULL` and the signal engine multiplies
  every event by its severity weight, so a positive must carry some grade. Fixing it at the
  neutral middle makes `recognition_load` a straight decayed count instead of something a
  recorder could inflate by grading a compliment "critical". Existing positives keep whatever
  they were saved with — not backfilled.
- **Impact Mix counts goofups only.** Counting all events would pile every recognition into
  the Medium slice and make the chart meaningless.

The impact *filter* disappears once the type filter excludes goofups, and both server pages
ignore a stale `?sev=` in that case, so a bookmarked URL cannot return an unexplained empty list.

---

## Observed by, separate from recorded by

Raghav: *"create dropdown master for who observed this from settings."*

The field showing the signed-in user read-only was `recorded_by`, which could not become a
dropdown: `pe_insert` pins it to `current_app_user_id()` and `pe_snapshot_and_freeze()` raises
on any change. It answers "who typed this in" and has to stay unforgeable.

"Who witnessed it" is a different fact — the Executive Assistant enters what the MD saw — so
`009` adds `observed_by`, nullable, `ON DELETE SET NULL`, with its own master list.

The master is **not** linked to `employees`. Raghav: *"observers are MD not employee so we will
not get them in our employee database."* That table holds the staff being assessed; the people
doing the assessing are not in it. An `employee_id` foreign key would have been null on every
row, so it was dropped from the migration before it ran.

Deactivating an observer hides it from the dropdown and keeps every past record pointing at it.
Deleting is blocked in the UI while any record names them, because `SET NULL` would silently
blank the observer on those records.

---

## Permanent delete: added, and kept narrow

Raghav: *"its showing only archive option i want delete also."*

Until `010` there was no `DELETE` policy on `performance_events` at all, so deletion was
impossible by design. It now exists, with three guards:

1. **Super Admin and MD only.** Deliberately narrower than `pe_update`, which also lets a
   recorder correct their own entry within 48 hours. Fixing a typo and destroying evidence are
   not the same act and do not share a permission.
2. **The deletion is audited.** The audit trigger only fired on insert and update, so a hard
   delete would have left no trace; `010` adds `delete` to `audit_action` and a DELETE branch
   that records what the row was. `audit_log.entity_id` has no foreign key to the events table,
   so the trail survives the row.
3. **Attachments cascade.** The storage objects behind them are not removed — that is a
   separate cleanup.

Raghav then asked for the confirmation step to go: *"dont ask for confirmation."* The
type-the-reference gate was removed and delete now fires straight from the row menu. The row
dims while the request is in flight and a failure surfaces as a named error, because without
that a refused delete looks identical to a successful one.

---

## The audit log is grouped by record

Raghav: *"dont save unnecessary repeatative entries … all important changes under that one
event will store under that."*

Two separate problems.

**Volume.** The trigger looped over every changed column and wrote a row each, so one save
touching three fields produced three entries at the same second by the same person. `011`
writes one row per action: `field_changed` lists the fields, `old_value` / `new_value` hold
JSON of only the changed keys. JSON rather than prose because a value containing a comma would
otherwise be indistinguishable from the separator. `updated_at`, `created_at` and `sort_order`
are skipped outright, and a save that changed nothing meaningful now writes nothing.

**Shape.** A flat chronological list answered "what happened, in order" — but the question
people bring to this screen is about a record. Settings → Audit log now lists records and opens
each into its history; the same timeline appears inside an event's detail panel. Records are
resolved to names (`PE-2026-0113 — Done late`) in one query per entity type, and a deleted
record falls back to the delete entry's own summary, marked "no longer exists".

`src/lib/audit.ts` renders both the post-`011` JSON shape and pre-`011` single-field rows.
Rewriting the existing trail to match the new format was rejected: an audit log you have edited
is not an audit log.

**One policy widened.** `audit_log_admin_read` restricted the log to Super Admin and MD, which
would have hidden the per-record history from Executive Assistants — the people who record most
events. `011` adds a second, narrower policy: you may read the history of a performance event
you can already see. The Settings screen stays admin-only.

---

## Employee form reduced to what is actually captured

Raghav: *"remove all this unnecessary fields — Employee code, Joining date, Phone."*

The add/edit form now captures name, department, designation, reports-to, status and an optional
email, and the Settings table shows exactly those columns. Code, joining date and phone stay in
the database and keep their values for the 49 employees already imported — the update payload
simply omits those keys, so editing someone through the form does not blank them. New employees
have none, so the profile and the printed report show an em dash where they would have appeared.

---

## Branding: the product, not the company

The sidebar read `LD | SILK MILLS`. Raghav: *"our app name is Employee Tracking."* The wordmark,
the browser title and the dashboard footer now carry the product name, and the sidebar mark is
the same diverging-bar figure as the favicon so the tab and the app share one identity.

The company name is kept where it is the company speaking rather than the software: the printed
report masthead, the `preparedBy` line, and the login page. A report an MD signs and hands to an
employee is company letterhead.
