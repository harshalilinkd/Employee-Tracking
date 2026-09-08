# Employee Performance Intelligence — LD Group

Management intelligence layer for employee performance. Built to `SPEC.md`;
judgement calls recorded in `DECISIONS.md`.

---

## ⚠ One action is required before the app can read anything

The database is live and populated, but **PostgREST does not yet serve this
schema**, so every query returns `PGRST106 Invalid schema`.

**Supabase Dashboard → Settings → API → Exposed schemas → add `employee_tracking` → Save.**

This is additive. The nine other applications in this project
(`public`, `scot_ld`, `scot_linkd`, `leadgen`, `df`, `system_hub`, `evaluation`, …)
are unaffected.

Verify it worked:

```bash
curl -s "https://mingqlwwbwnrkyhklpyq.supabase.co/rest/v1/categories?select=name&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: employee_tracking"
```

Before: `{"code":"PGRST106", ... "Invalid schema"}` · After: `[]` (empty because
RLS correctly denies an unauthenticated caller) — either way, no `PGRST106`.

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
| 3. Employee Database | done (list + profile; add/edit is step 11) |
| 4. Record Performance + Quick Record | done |
| 5. Performance ledger with filters | done (saved views pending) |
| 6. Employee Profile with Timeline | done |
| 7. Signal engine | done — pulled forward, step 6 depends on it |
| 8. Dashboard | done |
| 9–11. Reports · Insights · Settings | navigable placeholders |
| 12–13. Mobile pass · polish | partial — responsive throughout, full audit pending |

---

## Structure

```
supabase/migrations/    001 schema · 002 RLS+audit · 003 seed+import
                        004 demo events (removable) · 005 signal engine · 006 fix
src/app/(app)/          shell + Overview, Employees, Profile, Performance, Database
src/app/login/          split hero/form login
src/lib/                design tokens, types, formatting, Supabase clients, session
src/components/app/     Shell, RecordDrawer, SignalBadge, filters
```

Design is ported from the Claude Design canvas in
`Employee performance tracking system/`. Tokens live in `src/app/globals.css`
as the same `--epi-*` variables the canvas used, so the two stay comparable.

---

## Things worth knowing

**Nothing can be hard-deleted.** `DELETE` is not granted to `authenticated` on
any table holding history. Archiving is an `UPDATE` that requires a reason.

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
