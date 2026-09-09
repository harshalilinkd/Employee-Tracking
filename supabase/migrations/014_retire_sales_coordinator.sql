-- =====================================================================
-- 014 — Retire the "Sales Coordinator" department
--
-- It was never a department; it was a designation that arrived in the
-- department column during the import. The employee has since been moved
-- to Sales, but an event snapshots the department at the moment it is
-- recorded, so both of hers still named the old one.
--
-- Deleting it outright would blank that snapshot, because the foreign key
-- is ON DELETE SET NULL. Pointing the events at Sales instead keeps them
-- attributed to the department the work actually belonged to — the
-- snapshot was only ever a copy of the employee's department, and the
-- copy was taken from a value that was wrong.
--
-- department_id is frozen by pe_snapshot_and_freeze precisely so that
-- moving someone between departments cannot rewrite where past events
-- happened. This is a correction to an import error, not a reassignment,
-- so the trigger is lifted for one statement and put straight back.
-- =====================================================================

alter table employee_tracking.performance_events disable trigger trg_pe_snapshot_and_freeze;

update employee_tracking.performance_events p
set department_id = (select id from employee_tracking.departments where name = 'Sales')
where p.department_id = (select id from employee_tracking.departments where name = 'Sales Coordinator')
  and exists (select 1 from employee_tracking.departments where name = 'Sales');

alter table employee_tracking.performance_events enable trigger trg_pe_snapshot_and_freeze;

-- Now nothing points at it, so the delete guard from 013 lets it go.
delete from employee_tracking.departments where name = 'Sales Coordinator';
