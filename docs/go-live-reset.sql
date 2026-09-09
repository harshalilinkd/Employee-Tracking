-- =====================================================================
-- GO-LIVE RESET — clears trial data so real recording starts from zero
--
-- Run once, in: Supabase Dashboard → SQL Editor → Run.
--
-- NOT a migration. It deliberately lives in docs/ rather than
-- supabase/migrations/, because a migration re-runs on every fresh
-- environment — and this one would wipe that environment's data.
--
-- THIS IS PERMANENT. There is no undo. If you want a safety net, take a
-- Supabase backup first (Dashboard → Database → Backups).
--
-- ---------------------------------------------------------------------
-- CLEARED                          KEPT
--   performance_events  all          employees        51
--   attachments         (cascade)    departments      21
--   audit_log           all          designations     all
--   event_ref_counters  reset        categories       all
--                                    observers        4
--                                    app_users        all logins
--
-- Order matters. Since migration 010 the audit trigger fires on DELETE,
-- so step 1 writes one audit row per deleted event. Clearing the audit
-- log first would leave those behind; clearing it second removes them
-- along with everything else.
--
-- Not covered: the files behind any attachments stay in Storage. The
-- rows pointing at them go, so they become unreferenced. Clear the
-- bucket separately if you want the objects gone too.
-- =====================================================================

begin;

-- 1. Every recorded event, including the demo seed from migration 004.
--    Attachments follow automatically (ON DELETE CASCADE).
delete from employee_tracking.performance_events;

-- 2. The whole audit trail, including the delete rows step 1 just wrote.
--    RESTART IDENTITY so the next real entry is id 1.
truncate table employee_tracking.audit_log restart identity;

-- 3. The per-year reference counter, so the first live record is
--    PE-2026-0001 rather than continuing from PE-2026-0113.
delete from employee_tracking.event_ref_counters;

commit;


-- =====================================================================
-- Verify — every count below should read 0, and the master data should
-- still be intact.
-- =====================================================================

select 'performance_events' as table_name, count(*) as rows from employee_tracking.performance_events
union all select 'attachments',        count(*) from employee_tracking.attachments
union all select 'audit_log',          count(*) from employee_tracking.audit_log
union all select 'event_ref_counters', count(*) from employee_tracking.event_ref_counters
union all select '— kept —',           null
union all select 'employees',          count(*) from employee_tracking.employees
union all select 'departments',        count(*) from employee_tracking.departments
union all select 'designations',       count(*) from employee_tracking.designations
union all select 'categories',         count(*) from employee_tracking.categories
union all select 'observers',          count(*) from employee_tracking.observers
union all select 'app_users',          count(*) from employee_tracking.app_users;
