-- =====================================================================
-- 013 — Deleting a department, safely
--
-- Delete was left out on purpose, and this is why: every foreign key
-- pointing at departments clears itself rather than refusing.
--
--   employees.department_id            ON DELETE SET NULL
--   performance_events.department_id   ON DELETE SET NULL
--   user_departments.department_id     ON DELETE CASCADE
--
-- So a plain delete does not fail — it silently blanks the department on
-- staff records, erases the snapshot on events that were recorded under
-- it, and removes a department manager's access. None of that is visible
-- from the screen the delete was clicked on.
--
-- Rather than change three foreign keys, the rule is stated once, in a
-- trigger, where it holds for every caller: a department that nothing
-- references may go; one that is still in use may not.
-- =====================================================================

create or replace function employee_tracking.departments_block_delete_in_use()
returns trigger
language plpgsql
security definer
set search_path to 'employee_tracking', 'pg_temp'
as $$
declare
  v_emp    int;
  v_events int;
  v_scopes int;
begin
  select count(*) into v_emp    from employee_tracking.employees          where department_id = old.id;
  select count(*) into v_events from employee_tracking.performance_events where department_id = old.id;
  select count(*) into v_scopes from employee_tracking.user_departments   where department_id = old.id;

  if v_emp + v_events + v_scopes > 0 then
    raise exception
      '% is still in use: % employee(s), % event(s), % manager scope(s). Deactivate it instead — deleting would blank it on those records.',
      old.name, v_emp, v_events, v_scopes
      using errcode = 'foreign_key_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_departments_block_delete_in_use on employee_tracking.departments;
create trigger trg_departments_block_delete_in_use
  before delete on employee_tracking.departments
  for each row execute function employee_tracking.departments_block_delete_in_use();

-- Admins only, matching the insert and update policies already on the table.
drop policy if exists departments_admin_delete on employee_tracking.departments;
create policy departments_admin_delete on employee_tracking.departments
  for delete to authenticated
  using (employee_tracking.is_admin());

grant delete on employee_tracking.departments to authenticated;

-- One-off cleanup of the departments the import left behind: every
-- inactive one that nothing referenced. Written as a filtered delete
-- rather than a list of names so it is a no-op on a fresh database.
delete from employee_tracking.departments d
where not d.is_active
  and not exists (select 1 from employee_tracking.employees e where e.department_id = d.id)
  and not exists (select 1 from employee_tracking.performance_events p where p.department_id = d.id)
  and not exists (select 1 from employee_tracking.user_departments u where u.department_id = d.id);
