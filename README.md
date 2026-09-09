# Employee Tracking — LD Silk Mills

Management intelligence layer for employee performance. Built to `SPEC.md`;
judgement calls recorded in `DECISIONS.md`.

---

## ⚠ Migrations that must be applied

`employee_tracking` must be listed under **Supabase → Settings → API → Exposed
schemas**, or every query returns `PGRST106 Invalid schema`. That is done.

Migrations run by pasting the file into **Supabase → SQL Editor → Run**. All of
them are idempotent, so re-running is safe. Current state:

| Migration | What it adds | Applied |
|---|---|---|
| 001–008 | Schema, RLS, audit, seed, signal engine | yes |
| `009_observers.sql` | Observers master + `performance_events.observed_by` | yes |
| `010_event_delete.sql` | Permanent delete for events, admin-only, audited | yes |
| `011_audit_one_row_per_action.sql` | One audit row per save; per-record history policy | **check** |

If a screen errors with *"Could not find the table … in the schema cache"* or
*"column does not exist"*, a migration has not been run. The app is deployed
from `main`; the database is not, so the two can drift.

`docs/go-live-reset.sql` clears trial data (events, attachments, audit log,
reference counter) while keeping employees, departments, categories, observers
and logins. It lives in `docs/` and **not** in `supabase/migrations/`, because a
migration re-runs on every fresh environment and this one would wipe it.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` is already written with the project URL and publishable key.
`.env.example` documents what is needed for another machine.

Sign in with any of the four seeded accounts — email + password, or
**Continue with Google** (already enabled on this Supabase project):

| Email | Role | Can record? |
|---|---|---|
| ai.linkdprints@gmail.com | Super Admin | yes |
| raghavtibrewala96@gmail.com | Super Admin | yes |
| naushi.linkdprints@gmail.com | Management | yes |
| alishakathe99@gmail.com | Executive Assistant | yes |

Anyone else signing in — including users of the nine other apps sharing this
Supabase project — gets an explicit "no access" screen, not a broken app.

---

## What is built

| Build step | Status |
|---|---|
| 1. Schema, RLS, audit triggers, seed data | done |
| 2. Auth and app shell | done |
| 3. Employee Database | done — list, profile, add/edit, bulk email import |
| 4. Record Performance + Quick Record | done |
| 5. Performance ledger with filters | done, incl. saved views |
| 6. Employee Profile with Timeline | done |
| 7. Signal engine | done — pulled forward, step 6 depends on it |
| 8. Dashboard | done |
| 9. Reports | done — on-screen and printed A4, PDF / Print / CSV |
| 10. Insights | done — Quick Insights, Impact Mix, leaderboard, issue heat |
| 11. Settings | done — employees, categories, observers, user access, audit, general |
| 12–13. Mobile pass · polish | done — every screen has a phone layout |

---

## Structure

```
supabase/migrations/    001 schema · 002 RLS+audit · 003 seed+import
                        004 demo events (removable) · 005 signal engine
                        006 search_path · 007 claim_app_user · 008 overrides
                        009 observers · 010 event delete · 011 audit grouping
docs/                   export-queries.sql, go-live-reset.sql — runbooks, not migrations
src/app/(app)/          shell + Dashboard, Performance, Reports, Settings, Profile
src/app/login/          split hero/form login
src/lib/                design tokens, types, formatting, audit reader, Supabase, session
src/components/app/     Shell, RecordDrawer, EventDetail, ledger, dashboard, settings admin
```

Design is ported from the Claude Design canvas in
`Employee performance tracking system/`. Tokens live in `src/app/globals.css`
as the same `--epi-*` variables the canvas used, so the two stay comparable.

---

## Things worth knowing

**Archiving is the default; deleting is possible but narrow.** Archive is an
`UPDATE` that requires a reason and keeps the record. Since `010`, Super Admin
and MD — and nobody else — can also permanently delete a performance event; the
deletion is itself written to the audit log, and `audit_log.entity_id` has no
foreign key to the events table, so the trail outlives the row. Correcting a
typo and erasing evidence deliberately do not share a permission: `pe_update`
also allows a recorder to fix their own entry within 48 hours, `pe_delete` does
not.

**Impact only applies to goofups.** It grades how bad an issue was, which says
nothing about a recognition, so the field is not offered when recording a
positive and reads as an em dash when reading one back. `hasImpact()` in
`src/lib/types.ts` is the single place that rule lives — the ledger, event
detail, profile, report, both CSV exports and both filter bars all ask it.
Positives store the neutral grade, so `recognition_load` is a straight decayed
count rather than something a recorder can inflate.

**"Who observed this" is not "who recorded this".** `recorded_by` is pinned by
RLS to the signed-in user and frozen by a trigger — it is the audit trail.
`observed_by` is separate, optional and editable, drawn from a master list in
Settings → Observers. Observers are deliberately not linked to the employee
database: the people who witness events are the MD and senior staff, who are
not rows in a table that holds the staff being assessed.

**The audit log is grouped by record.** Since `011` a save writes one row, not
one per changed field, with the before/after pairs as JSON in
`old_value` / `new_value`. Settings → Audit log lists records, not events, and
opens each into its full history; the same timeline appears inside an event's
detail panel. `src/lib/audit.ts` renders both the new shape and pre-`011` rows,
because an audit trail you have to migrate is an audit trail you have edited.

**The signal is not positive-minus-goofup.** Severity-weighted with exponential
recency decay over a rolling 90 days, six dimensions, five bands — and fewer
than three events renders "Not enough data", never "Stable".

**Every signal badge explains itself.** Hover or focus any badge for the
plain-English reason, generated in SQL alongside the band.

**Access is enforced in Postgres, not React.** Verified by impersonating real
JWTs: a Design-scoped Department Manager sees 9 employees and 7 events, and the
signal view returns 9 rows rather than 57.

**Demo data is removable.** 55 seeded events carry the `demo-seed` tag; the
purge query is at the top of `supabase/migrations/004_seed_demo_events.sql`.
For a full go-live reset — every event, attachment and audit row, with master
data kept — use `docs/go-live-reset.sql`.

**Text is black, deliberately.** The three light-theme text tokens were a
desaturated teal family from the design canvas; `--epi-fg-3` measured 3.4:1 on
white, under the AA minimum. They are now `#000` / `#1a1a1a` / `#454545`. Dark
mode is untouched — the same change there would make the app unreadable.
