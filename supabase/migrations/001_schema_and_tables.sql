-- =====================================================================
-- Employee Performance Intelligence — 001: schema, enums, core tables
-- LD Group / ELDEE GROUP
--
-- ISOLATION CONTRACT
-- This app owns exactly one schema: employee_tracking.
-- It creates nothing outside that schema and, at runtime, reads nothing
-- from any other app schema in this Supabase project. The only one-time
-- exception is the roster import in migration 004, which SELECTs from
-- evaluation.profiles / evaluation.departments and never writes to them.
-- Compensation columns (current_ctc, joining_ctc, salary_history) are
-- deliberately never read — SPEC.md §10 bars compensation from this system.
-- =====================================================================

create schema if not exists employee_tracking;

comment on schema employee_tracking is
  'Employee Performance Intelligence (LD Group). Self-contained: owns all its objects, never writes outside this schema.';

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

create type employee_tracking.event_type          as enum ('positive','goofup');
create type employee_tracking.severity_level      as enum ('low','medium','high','critical');
create type employee_tracking.followup_status     as enum ('open','in_progress','resolved','dropped');
create type employee_tracking.record_status       as enum ('active','archived');
create type employee_tracking.employee_status     as enum ('Active','Inactive','On Hold');
create type employee_tracking.designation_level   as enum ('Staff','Senior','Lead','HOD','Management');
create type employee_tracking.company             as enum ('LD Silk Mills','Linkd Prints','LD Cotton Mills','Vhagar','Group');
create type employee_tracking.app_role            as enum ('super_admin','md','executive_assistant','department_manager','hr','viewer');
create type employee_tracking.audit_action        as enum ('create','update','archive','restore');

-- ---------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------

create table employee_tracking.departments (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  code             text,
  -- Nullable by decision: the imported departments carry no company, and
  -- Raghav assigns them in Settings rather than having them guessed.
  company          employee_tracking.company,
  head_employee_id uuid,
  is_active        boolean not null default true,
  -- Provenance of the one-time import, so a re-sync can match rows.
  source_ref       uuid unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint departments_name_unique unique (name)
);

-- ---------------------------------------------------------------------
-- designations
-- ---------------------------------------------------------------------

create table employee_tracking.designations (
  id         uuid primary key default gen_random_uuid(),
  title      text not null unique,
  level      employee_tracking.designation_level not null default 'Staff',
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------

create table employee_tracking.employees (
  id                uuid primary key default gen_random_uuid(),
  -- Unique where present. Postgres permits repeated NULLs, which is what we
  -- want: a few real staff have no code yet and must still be trackable.
  employee_code     text unique,
  full_name         text not null,
  designation_id    uuid references employee_tracking.designations(id) on delete set null,
  department_id     uuid references employee_tracking.departments(id) on delete set null,
  manager_id        uuid references employee_tracking.employees(id) on delete set null,
  joining_date      date,
  status            employee_tracking.employee_status not null default 'Active',
  photo_url         text,
  contact_phone     text,
  contact_email     text,
  -- Link back to evaluation.profiles for re-sync. Advisory only: no FK, so
  -- this schema stays droppable and independent of the other app.
  source_profile_id uuid unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint employees_not_own_manager check (manager_id is null or manager_id <> id)
);

create index employees_department_idx  on employee_tracking.employees (department_id);
create index employees_status_idx      on employee_tracking.employees (status);
create index employees_full_name_idx   on employee_tracking.employees (lower(full_name));

alter table employee_tracking.departments
  add constraint departments_head_fk
  foreign key (head_employee_id) references employee_tracking.employees(id) on delete set null;

-- ---------------------------------------------------------------------
-- app_users — the access gate
--
-- auth.users is shared with nine other apps in this Supabase project. A
-- login existing there grants nothing here; only a row in this table does.
-- Its own PK (not auth.users.id) means another app deleting a user cannot
-- cascade into our performance history.
-- ---------------------------------------------------------------------

create table employee_tracking.app_users (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  employee_id  uuid references employee_tracking.employees(id) on delete set null,
  full_name    text not null,
  email        text not null,
  role         employee_tracking.app_role not null default 'viewer',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index app_users_auth_idx on employee_tracking.app_users (auth_user_id);

-- Department scope for department_manager and viewer roles.
create table employee_tracking.user_departments (
  app_user_id   uuid not null references employee_tracking.app_users(id) on delete cascade,
  department_id uuid not null references employee_tracking.departments(id) on delete cascade,
  primary key (app_user_id, department_id)
);

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------

create table employee_tracking.categories (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  applies_to       employee_tracking.event_type not null,
  default_severity employee_tracking.severity_level not null default 'medium',
  sort_order       integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint categories_name_per_type_unique unique (name, applies_to)
);

-- ---------------------------------------------------------------------
-- performance_events — the atomic unit
-- ---------------------------------------------------------------------

create table employee_tracking.performance_events (
  id                  uuid primary key default gen_random_uuid(),
  event_ref           text not null unique,
  employee_id         uuid not null references employee_tracking.employees(id) on delete restrict,
  type                employee_tracking.event_type not null,
  title               text not null,
  description         text,
  -- When it happened, as distinct from created_at (when it was typed in).
  -- An MD recording last week's incident must not have it read as today.
  event_date          date not null,
  category_id         uuid references employee_tracking.categories(id) on delete set null,
  severity            employee_tracking.severity_level not null default 'medium',
  recorded_by         uuid not null references employee_tracking.app_users(id) on delete restrict,
  -- Snapshotted at creation, never joined live. If Kavita moves from Design
  -- to Production, her old events stay attributed to Design — otherwise
  -- department reports would silently rewrite history.
  department_id       uuid references employee_tracking.departments(id) on delete set null,
  tags                text[] not null default '{}',
  follow_up_required  boolean not null default false,
  follow_up_date      date,
  follow_up_status    employee_tracking.followup_status,
  follow_up_notes     text,
  status              employee_tracking.record_status not null default 'active',
  archived_reason     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint pe_title_not_blank check (length(btrim(title)) > 0),
  constraint pe_event_date_not_future check (event_date <= (now() at time zone 'Asia/Kolkata')::date),
  -- A follow-up that is required must say when and in what state.
  constraint pe_followup_coherent check (
    (follow_up_required = false and follow_up_date is null and follow_up_status is null)
    or
    (follow_up_required = true and follow_up_date is not null and follow_up_status is not null)
  ),
  constraint pe_archive_has_reason check (
    status = 'active' or (archived_reason is not null and length(btrim(archived_reason)) > 0)
  )
);

create index pe_employee_date_idx  on employee_tracking.performance_events (employee_id, event_date desc);
create index pe_department_idx     on employee_tracking.performance_events (department_id);
create index pe_type_idx           on employee_tracking.performance_events (type);
create index pe_category_idx       on employee_tracking.performance_events (category_id);
create index pe_recorded_by_idx    on employee_tracking.performance_events (recorded_by);
create index pe_event_date_idx     on employee_tracking.performance_events (event_date desc);
create index pe_status_idx         on employee_tracking.performance_events (status);
create index pe_tags_idx           on employee_tracking.performance_events using gin (tags);
-- Drives the "which follow-ups are overdue?" question in SPEC §1.
create index pe_followup_open_idx  on employee_tracking.performance_events (follow_up_date)
  where follow_up_required and follow_up_status in ('open','in_progress');

-- Human-readable reference: PE-2026-0412, numbered per calendar year.
create table employee_tracking.event_ref_counters (
  year    integer primary key,
  last_no integer not null default 0
);

-- ---------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------

create table employee_tracking.attachments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references employee_tracking.performance_events(id) on delete cascade,
  file_url    text not null,
  file_name   text not null,
  file_size   bigint,
  uploaded_by uuid references employee_tracking.app_users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index attachments_event_idx on employee_tracking.attachments (event_id);

-- ---------------------------------------------------------------------
-- management_notes — MD / Super Admin only, enforced by RLS
-- ---------------------------------------------------------------------

create table employee_tracking.management_notes (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employee_tracking.employees(id) on delete cascade,
  author_id   uuid not null references employee_tracking.app_users(id) on delete restrict,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index management_notes_employee_idx on employee_tracking.management_notes (employee_id);

-- ---------------------------------------------------------------------
-- audit_log — written by triggers only, never by application code
-- ---------------------------------------------------------------------

create table employee_tracking.audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid references employee_tracking.app_users(id) on delete set null,
  actor_email   text,
  entity_type   text not null,
  entity_id     uuid not null,
  action        employee_tracking.audit_action not null,
  field_changed text,
  old_value     text,
  new_value     text,
  created_at    timestamptz not null default now()
);

create index audit_entity_idx on employee_tracking.audit_log (entity_type, entity_id, created_at desc);
create index audit_actor_idx  on employee_tracking.audit_log (actor_id, created_at desc);

-- ---------------------------------------------------------------------
-- settings — key/value, holds signal_config
-- ---------------------------------------------------------------------

create table employee_tracking.settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references employee_tracking.app_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- saved_views — named filter combinations (SPEC §6.6)
-- ---------------------------------------------------------------------

create table employee_tracking.saved_views (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references employee_tracking.app_users(id) on delete cascade,
  name       text not null,
  scope      text not null default 'performance',
  filters    jsonb not null default '{}'::jsonb,
  is_shared  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_views_name_per_owner unique (owner_id, scope, name)
);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------

create or replace function employee_tracking.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'departments','designations','employees','app_users','categories',
    'performance_events','management_notes','saved_views'
  ] loop
    execute format(
      'create trigger trg_%1$s_touch before update on employee_tracking.%1$s
       for each row execute function employee_tracking.touch_updated_at()', t);
  end loop;
end $$;
