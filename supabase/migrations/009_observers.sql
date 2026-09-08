-- =====================================================================
-- 009 — Observers master + performance_events.observed_by
--
-- Why a new column rather than opening up recorded_by:
--
--   recorded_by is the audit trail. It is pinned by RLS
--   (pe_insert: recorded_by = current_app_user_id()) and frozen by a
--   trigger (pe_snapshot_and_freeze: "recorded_by is immutable"). It
--   answers "who typed this in", and it has to stay unforgeable — an
--   MD reading a disputed record needs to know who entered it.
--
--   "Who observed this?" is a different question: the Executive Assistant
--   types in an incident that a floor supervisor witnessed. That is
--   business data, editable, and often a person with no login and no row
--   in the employee database. Hence its own master list.
--
-- Both are kept. recorded_by remains immutable; observed_by is optional
-- and editable within the normal event-edit rules.
-- =====================================================================

-- ---------------------------------------------------------------------
-- observers — the master list managed in Settings
-- ---------------------------------------------------------------------

create table if not exists employee_tracking.observers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- Free text, deliberately: an observer may be "MD", "Floor Supervisor" or
  -- a vendor contact, none of which maps to a designation row.
  role_note  text,
  -- Deliberately NOT linked to employees. The people who witness events are
  -- typically the MD and senior staff, who are not rows in the employee
  -- database — that table is the staff being assessed, not the people doing
  -- the assessing. A foreign key here would have been null on every row.
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observers_name_unique unique (name)
);

create index if not exists observers_active_idx on employee_tracking.observers (is_active, sort_order, name);

-- Same updated_at trigger every other table in this schema gets (001).
drop trigger if exists trg_observers_touch on employee_tracking.observers;
create trigger trg_observers_touch
  before update on employee_tracking.observers
  for each row execute function employee_tracking.touch_updated_at();

-- ---------------------------------------------------------------------
-- performance_events.observed_by
--
-- Nullable, and ON DELETE SET NULL rather than RESTRICT: retiring an
-- observer from the master list must not be blocked by, or destroy,
-- historical events. Deactivating (is_active = false) is the normal
-- route — it drops the name from the dropdown while leaving every past
-- record still pointing at it.
-- ---------------------------------------------------------------------

alter table employee_tracking.performance_events
  add column if not exists observed_by uuid
    references employee_tracking.observers(id) on delete set null;

create index if not exists pe_observed_by_idx
  on employee_tracking.performance_events (observed_by);

-- ---------------------------------------------------------------------
-- RLS
--
-- Read: anyone signed in, same as categories — the dropdown has to fill
-- for every recorder, and a list of names is not sensitive.
-- Write: admins only (Super Admin / MD), same as categories.
-- ---------------------------------------------------------------------

alter table employee_tracking.observers enable row level security;

drop policy if exists observers_read on employee_tracking.observers;
create policy observers_read on employee_tracking.observers
  for select to authenticated
  using (employee_tracking.current_app_user_id() is not null);

drop policy if exists observers_admin_insert on employee_tracking.observers;
create policy observers_admin_insert on employee_tracking.observers
  for insert to authenticated with check (employee_tracking.is_admin());

drop policy if exists observers_admin_update on employee_tracking.observers;
create policy observers_admin_update on employee_tracking.observers
  for update to authenticated
  using (employee_tracking.is_admin()) with check (employee_tracking.is_admin());

drop policy if exists observers_admin_delete on employee_tracking.observers;
create policy observers_admin_delete on employee_tracking.observers
  for delete to authenticated using (employee_tracking.is_admin());

grant select on employee_tracking.observers to authenticated;
grant insert, update, delete on employee_tracking.observers to authenticated;

-- ---------------------------------------------------------------------
-- Seed: every active app user who can record, so the dropdown is not
-- empty on first open. Idempotent — re-running adds nobody twice.
-- ---------------------------------------------------------------------

insert into employee_tracking.observers (name, sort_order)
select au.full_name, 0
from employee_tracking.app_users au
where au.is_active
  and au.role in ('super_admin', 'md', 'executive_assistant')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Backfill: existing events keep reading the way they always did, by
-- matching the recorder's name onto the seeded master list. Events whose
-- recorder is not in the list simply stay null — observed_by is optional.
-- ---------------------------------------------------------------------

update employee_tracking.performance_events pe
set observed_by = o.id
from employee_tracking.app_users au
join employee_tracking.observers o on o.name = au.full_name
where pe.recorded_by = au.id
  and pe.observed_by is null;
