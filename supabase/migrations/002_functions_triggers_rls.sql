-- =====================================================================
-- 002: identity helpers, integrity triggers, audit triggers, RLS
--
-- Access is enforced here, in Postgres — not in React. A Department
-- Manager holding a valid JWT and hand-writing a query still cannot read
-- another department's events, employees or aggregates.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Identity helpers
--
-- All SECURITY DEFINER with a pinned search_path: they read app_users,
-- which is itself RLS-protected, and policies that called an RLS-checked
-- read would recurse. Pinning search_path stops the classic mutable-path
-- hijack on a SECURITY DEFINER function.
-- ---------------------------------------------------------------------

create or replace function employee_tracking.current_app_user_id()
returns uuid
language sql stable security definer set search_path = employee_tracking, pg_temp
as $$
  select id from employee_tracking.app_users
  where auth_user_id = auth.uid() and is_active
  limit 1
$$;

create or replace function employee_tracking.current_role()
returns employee_tracking.app_role
language sql stable security definer set search_path = employee_tracking, pg_temp
as $$
  select role from employee_tracking.app_users
  where auth_user_id = auth.uid() and is_active
  limit 1
$$;

create or replace function employee_tracking.current_employee_id()
returns uuid
language sql stable security definer set search_path = employee_tracking, pg_temp
as $$
  select employee_id from employee_tracking.app_users
  where auth_user_id = auth.uid() and is_active
  limit 1
$$;

-- Super Admin and MD. Full reach, including Management Notes and audit.
create or replace function employee_tracking.is_admin()
returns boolean
language sql stable security definer set search_path = employee_tracking, pg_temp
as $$ select employee_tracking.current_role() in ('super_admin','md') $$;

-- Who may create a performance event.
-- LAUNCH DECISION (SPEC §14.3): MD + Executive Assistants only. HODs read,
-- they do not record. Widening this is a one-line change here plus a role
-- grant — no migration, no data change.
create or replace function employee_tracking.can_record()
returns boolean
language sql stable security definer set search_path = employee_tracking, pg_temp
as $$ select employee_tracking.current_role() in ('super_admin','md','executive_assistant') $$;

-- Roles whose reach is the whole organisation.
create or replace function employee_tracking.has_global_scope()
returns boolean
language sql stable security definer set search_path = employee_tracking, pg_temp
as $$ select employee_tracking.current_role() in ('super_admin','md','executive_assistant','hr') $$;

-- The load-bearing one. Department Managers and Viewers see only the
-- departments explicitly assigned to them.
create or replace function employee_tracking.can_view_department(p_department_id uuid)
returns boolean
language sql stable security definer set search_path = employee_tracking, pg_temp
as $$
  select case
    when employee_tracking.current_app_user_id() is null then false
    when employee_tracking.has_global_scope() then true
    else exists (
      select 1 from employee_tracking.user_departments ud
      where ud.app_user_id = employee_tracking.current_app_user_id()
        and ud.department_id = p_department_id
    )
  end
$$;

-- ---------------------------------------------------------------------
-- event_ref — PE-2026-0412, numbered per calendar year
-- ---------------------------------------------------------------------

create or replace function employee_tracking.assign_event_ref()
returns trigger
language plpgsql security definer set search_path = employee_tracking, pg_temp
as $fn$
declare
  v_year int := extract(year from coalesce(new.event_date, current_date))::int;
  v_no   int;
begin
  if new.event_ref is not null and length(btrim(new.event_ref)) > 0 then
    return new;
  end if;

  insert into employee_tracking.event_ref_counters (year, last_no)
  values (v_year, 1)
  on conflict (year) do update set last_no = employee_tracking.event_ref_counters.last_no + 1
  returning last_no into v_no;

  new.event_ref := 'PE-' || v_year::text || '-' || lpad(v_no::text, 4, '0');
  return new;
end;
$fn$;

create trigger trg_pe_event_ref
  before insert on employee_tracking.performance_events
  for each row execute function employee_tracking.assign_event_ref();

-- ---------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------

-- Snapshot the department at creation and freeze it, plus freeze
-- recorded_by. SPEC §4: if an employee transfers, their old events stay
-- attributed to the department the work actually happened in. Doing this
-- in a trigger rather than the form means it holds no matter who writes.
create or replace function employee_tracking.pe_snapshot_and_freeze()
returns trigger
language plpgsql security definer set search_path = employee_tracking, pg_temp
as $fn$
begin
  if TG_OP = 'INSERT' then
    if new.department_id is null then
      select e.department_id into new.department_id
      from employee_tracking.employees e where e.id = new.employee_id;
    end if;
    return new;
  end if;

  if new.recorded_by is distinct from old.recorded_by then
    raise exception 'recorded_by is immutable (event %)', old.event_ref
      using errcode = 'check_violation';
  end if;
  if new.event_ref is distinct from old.event_ref then
    raise exception 'event_ref is immutable (event %)', old.event_ref
      using errcode = 'check_violation';
  end if;
  -- The department snapshot is history. It does not follow transfers.
  if new.department_id is distinct from old.department_id then
    raise exception 'department_id is snapshotted at creation and cannot be changed (event %)', old.event_ref
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger trg_pe_snapshot_and_freeze
  before insert or update on employee_tracking.performance_events
  for each row execute function employee_tracking.pe_snapshot_and_freeze();

-- Nobody records a performance event about themselves. Enforced here as
-- well as in RLS so a service-role script cannot do it by accident either.
create or replace function employee_tracking.pe_no_self_record()
returns trigger
language plpgsql security definer set search_path = employee_tracking, pg_temp
as $fn$
declare v_recorder_employee uuid;
begin
  select employee_id into v_recorder_employee
  from employee_tracking.app_users where id = new.recorded_by;

  if v_recorder_employee is not null and v_recorder_employee = new.employee_id then
    raise exception 'A user cannot record a performance event about themselves'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger trg_pe_no_self_record
  before insert or update on employee_tracking.performance_events
  for each row execute function employee_tracking.pe_no_self_record();

-- ---------------------------------------------------------------------
-- Audit — trigger-driven, never application code
--
-- SPEC §4: "Application-level auditing gets forgotten; triggers don't."
-- One row per changed field, so the log answers "what was it before?".
-- SECURITY DEFINER so it writes even though nobody holds INSERT on audit_log.
-- ---------------------------------------------------------------------

create or replace function employee_tracking.audit_trigger()
returns trigger
language plpgsql security definer set search_path = employee_tracking, pg_temp
as $fn$
declare
  v_actor  uuid := employee_tracking.current_app_user_id();
  v_email  text;
  v_old    jsonb;
  v_new    jsonb;
  v_action employee_tracking.audit_action;
  k        text;
begin
  select email into v_email from employee_tracking.app_users where id = v_actor;

  if TG_OP = 'INSERT' then
    insert into employee_tracking.audit_log
      (actor_id, actor_email, entity_type, entity_id, action, new_value)
    values (v_actor, v_email, TG_TABLE_NAME, new.id, 'create', null);
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);

  -- Archive and restore are their own actions, not generic updates —
  -- the audit screen needs to show them differently.
  v_action := 'update';
  if v_old ? 'status' then
    if (v_old->>'status') = 'active' and (v_new->>'status') = 'archived' then
      v_action := 'archive';
    elsif (v_old->>'status') = 'archived' and (v_new->>'status') = 'active' then
      v_action := 'restore';
    end if;
  end if;

  for k in select jsonb_object_keys(v_new) loop
    if k in ('updated_at') then
      continue;
    end if;
    if (v_old->k) is distinct from (v_new->k) then
      insert into employee_tracking.audit_log
        (actor_id, actor_email, entity_type, entity_id, action, field_changed, old_value, new_value)
      values (v_actor, v_email, TG_TABLE_NAME, new.id, v_action, k, v_old->>k, v_new->>k);
    end if;
  end loop;

  return new;
end;
$fn$;

do $do$
declare t text;
begin
  foreach t in array array[
    'performance_events','employees','categories','app_users',
    'user_departments','departments','designations','management_notes'
  ] loop
    -- user_departments has no id column; audit it via its own trigger below.
    if t = 'user_departments' then continue; end if;
    execute format(
      'create trigger trg_%1$s_audit after insert or update on employee_tracking.%1$s
       for each row execute function employee_tracking.audit_trigger()', t);
  end loop;
end $do$;

-- Permission grants and revocations are audited against the user they
-- affect, since user_departments has a composite key and no id of its own.
create or replace function employee_tracking.audit_user_departments()
returns trigger
language plpgsql security definer set search_path = employee_tracking, pg_temp
as $fn$
declare
  v_actor uuid := employee_tracking.current_app_user_id();
  v_email text;
  v_dept  text;
begin
  select email into v_email from employee_tracking.app_users where id = v_actor;

  if TG_OP = 'INSERT' then
    select name into v_dept from employee_tracking.departments where id = new.department_id;
    insert into employee_tracking.audit_log
      (actor_id, actor_email, entity_type, entity_id, action, field_changed, new_value)
    values (v_actor, v_email, 'user_departments', new.app_user_id, 'update', 'department_access', v_dept);
    return new;
  else
    select name into v_dept from employee_tracking.departments where id = old.department_id;
    insert into employee_tracking.audit_log
      (actor_id, actor_email, entity_type, entity_id, action, field_changed, old_value)
    values (v_actor, v_email, 'user_departments', old.app_user_id, 'update', 'department_access', v_dept);
    return old;
  end if;
end;
$fn$;

create trigger trg_user_departments_audit
  after insert or delete on employee_tracking.user_departments
  for each row execute function employee_tracking.audit_user_departments();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table employee_tracking.departments        enable row level security;
alter table employee_tracking.designations       enable row level security;
alter table employee_tracking.employees          enable row level security;
alter table employee_tracking.app_users          enable row level security;
alter table employee_tracking.user_departments   enable row level security;
alter table employee_tracking.categories         enable row level security;
alter table employee_tracking.performance_events enable row level security;
alter table employee_tracking.attachments        enable row level security;
alter table employee_tracking.management_notes   enable row level security;
alter table employee_tracking.audit_log          enable row level security;
alter table employee_tracking.settings           enable row level security;
alter table employee_tracking.saved_views        enable row level security;
alter table employee_tracking.event_ref_counters enable row level security;

-- app_users: you can always see yourself; admins see and manage everyone.
create policy app_users_self_read on employee_tracking.app_users
  for select to authenticated
  using (auth_user_id = auth.uid() or employee_tracking.is_admin());

create policy app_users_admin_write on employee_tracking.app_users
  for insert to authenticated
  with check (employee_tracking.is_admin());

create policy app_users_admin_update on employee_tracking.app_users
  for update to authenticated
  using (employee_tracking.is_admin())
  with check (employee_tracking.is_admin());

-- user_departments: see your own scope, admins manage all.
create policy user_departments_read on employee_tracking.user_departments
  for select to authenticated
  using (app_user_id = employee_tracking.current_app_user_id() or employee_tracking.is_admin());

create policy user_departments_admin_all on employee_tracking.user_departments
  for all to authenticated
  using (employee_tracking.is_admin())
  with check (employee_tracking.is_admin());

-- departments: global roles see all; scoped roles see only their own.
create policy departments_read on employee_tracking.departments
  for select to authenticated
  using (employee_tracking.can_view_department(id));

create policy departments_admin_insert on employee_tracking.departments
  for insert to authenticated with check (employee_tracking.is_admin());

create policy departments_admin_update on employee_tracking.departments
  for update to authenticated
  using (employee_tracking.is_admin()) with check (employee_tracking.is_admin());

-- designations: reference data, readable by anyone with an app_users row.
create policy designations_read on employee_tracking.designations
  for select to authenticated
  using (employee_tracking.current_app_user_id() is not null);

create policy designations_admin_insert on employee_tracking.designations
  for insert to authenticated
  with check (employee_tracking.is_admin() or employee_tracking.current_role() = 'hr');

create policy designations_admin_update on employee_tracking.designations
  for update to authenticated
  using (employee_tracking.is_admin() or employee_tracking.current_role() = 'hr')
  with check (employee_tracking.is_admin() or employee_tracking.current_role() = 'hr');

-- employees: a Department Manager sees only their own department's people.
create policy employees_read on employee_tracking.employees
  for select to authenticated
  using (employee_tracking.can_view_department(department_id));

-- HR owns the Employee Database (SPEC §2), alongside Super Admin / MD.
create policy employees_manage_insert on employee_tracking.employees
  for insert to authenticated
  with check (employee_tracking.is_admin() or employee_tracking.current_role() = 'hr');

create policy employees_manage_update on employee_tracking.employees
  for update to authenticated
  using (employee_tracking.is_admin() or employee_tracking.current_role() = 'hr')
  with check (employee_tracking.is_admin() or employee_tracking.current_role() = 'hr');

-- categories: everyone reads (forms depend on them), Super Admin edits.
create policy categories_read on employee_tracking.categories
  for select to authenticated
  using (employee_tracking.current_app_user_id() is not null);

create policy categories_admin_insert on employee_tracking.categories
  for insert to authenticated with check (employee_tracking.is_admin());

create policy categories_admin_update on employee_tracking.categories
  for update to authenticated
  using (employee_tracking.is_admin()) with check (employee_tracking.is_admin());

-- performance_events: the centre of the access model.
create policy pe_read on employee_tracking.performance_events
  for select to authenticated
  using (employee_tracking.can_view_department(department_id));

create policy pe_insert on employee_tracking.performance_events
  for insert to authenticated
  with check (
    employee_tracking.can_record()
    and recorded_by = employee_tracking.current_app_user_id()
    and (
      employee_tracking.current_employee_id() is null
      or employee_id <> employee_tracking.current_employee_id()
    )
  );

-- Super Admin and MD may correct any event at any time. Everyone else who
-- can record gets a 48-hour window on their own entries (SPEC §10); after
-- that, corrections are appended as follow-up notes rather than overwritten.
create policy pe_update on employee_tracking.performance_events
  for update to authenticated
  using (
    employee_tracking.is_admin()
    or (
      employee_tracking.can_record()
      and recorded_by = employee_tracking.current_app_user_id()
      and created_at > now() - interval '48 hours'
    )
  )
  with check (
    employee_tracking.is_admin()
    or (
      employee_tracking.can_record()
      and recorded_by = employee_tracking.current_app_user_id()
      and created_at > now() - interval '48 hours'
    )
  );

-- attachments: visibility follows the parent event.
create policy attachments_read on employee_tracking.attachments
  for select to authenticated
  using (exists (
    select 1 from employee_tracking.performance_events e
    where e.id = event_id and employee_tracking.can_view_department(e.department_id)
  ));

create policy attachments_insert on employee_tracking.attachments
  for insert to authenticated
  with check (
    employee_tracking.can_record()
    and uploaded_by = employee_tracking.current_app_user_id()
  );

-- management_notes: MD and Super Admin only. Not "hidden in the UI" — the
-- rows are unreadable to anyone else at the database.
create policy management_notes_admin_all on employee_tracking.management_notes
  for all to authenticated
  using (employee_tracking.is_admin())
  with check (employee_tracking.is_admin() and author_id = employee_tracking.current_app_user_id());

-- audit_log: readable by admins, writable by nobody (triggers only).
create policy audit_log_admin_read on employee_tracking.audit_log
  for select to authenticated
  using (employee_tracking.is_admin());

-- settings: readable by all signed-in users (the client needs signal_config),
-- editable by Super Admin / MD.
create policy settings_read on employee_tracking.settings
  for select to authenticated
  using (employee_tracking.current_app_user_id() is not null);

create policy settings_admin_insert on employee_tracking.settings
  for insert to authenticated with check (employee_tracking.is_admin());

create policy settings_admin_update on employee_tracking.settings
  for update to authenticated
  using (employee_tracking.is_admin()) with check (employee_tracking.is_admin());

-- saved_views: your own, plus any a colleague marked shared.
create policy saved_views_read on employee_tracking.saved_views
  for select to authenticated
  using (owner_id = employee_tracking.current_app_user_id() or is_shared);

create policy saved_views_own_write on employee_tracking.saved_views
  for all to authenticated
  using (owner_id = employee_tracking.current_app_user_id())
  with check (owner_id = employee_tracking.current_app_user_id());

-- event_ref_counters: internal. No policy — the SECURITY DEFINER trigger
-- is the only thing that touches it.

-- ---------------------------------------------------------------------
-- Grants
--
-- No DELETE is granted anywhere. "Never hard-delete performance history"
-- (SPEC §9.7) is therefore a privilege, not a convention someone can
-- forget. Archiving is an UPDATE of status, which is granted.
-- ---------------------------------------------------------------------

grant usage on schema employee_tracking to authenticated;

grant select, insert, update on
  employee_tracking.departments,
  employee_tracking.designations,
  employee_tracking.employees,
  employee_tracking.app_users,
  employee_tracking.categories,
  employee_tracking.performance_events,
  employee_tracking.attachments,
  employee_tracking.management_notes,
  employee_tracking.settings,
  employee_tracking.saved_views
to authenticated;

-- Scope assignment is genuinely add/remove, so it gets DELETE.
grant select, insert, delete on employee_tracking.user_departments to authenticated;
grant select on employee_tracking.audit_log to authenticated;

grant usage, select on all sequences in schema employee_tracking to authenticated;

-- anon gets nothing at all.
revoke all on schema employee_tracking from anon;
