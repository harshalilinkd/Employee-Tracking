-- =====================================================================
-- 003: reference data, signal config, one-time roster import, launch users
--
-- The roster import reads evaluation.profiles / evaluation.departments
-- exactly once and never writes to them. Compensation columns in that
-- schema (current_ctc, joining_ctc, salary_history) are not read at all —
-- SPEC.md §10 keeps compensation out of this system entirely.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Categories (SPEC §4). Editable from Settings; never hardcoded in a
-- component. Severity here is only the form's starting suggestion — the
-- recorder can always change it.
-- ---------------------------------------------------------------------

insert into employee_tracking.categories (name, applies_to, default_severity, sort_order) values
  ('Exceptional Performance', 'positive', 'high',     10),
  ('Problem Solving',         'positive', 'medium',   20),
  ('Initiative',              'positive', 'medium',   30),
  ('Teamwork',                'positive', 'low',      40),
  ('Leadership',              'positive', 'high',     50),
  ('Customer Service',        'positive', 'medium',   60),
  ('Cost Saving',             'positive', 'high',     70),
  ('Process Improvement',     'positive', 'high',     80),
  ('Quality',                 'positive', 'medium',   90),
  ('Productivity',            'positive', 'medium',  100),
  ('Reliability',             'positive', 'low',     110),
  ('Other',                   'positive', 'low',     120),

  ('Quality Issue',           'goofup',   'high',     10),
  ('Process Error',           'goofup',   'medium',   20),
  ('Delay',                   'goofup',   'low',      30),
  ('Communication',           'goofup',   'low',      40),
  ('Data Entry',              'goofup',   'medium',   50),
  ('Customer Issue',          'goofup',   'high',     60),
  ('Production Error',        'goofup',   'high',     70),
  ('Negligence',              'goofup',   'high',     80),
  ('Compliance',              'goofup',   'critical', 90),
  ('Safety',                  'goofup',   'critical',100),
  ('Other',                   'goofup',   'low',     110);

-- ---------------------------------------------------------------------
-- Signal configuration (SPEC §5)
--
-- Weights kept at the spec's values. They are stored, not compiled, so
-- Super Admin retunes them in Settings without a deploy. The UI never
-- shows these numbers to a recorder — the form says Minor / Moderate /
-- Serious / Critical.
-- ---------------------------------------------------------------------

insert into employee_tracking.settings (key, value) values
  ('signal_config', jsonb_build_object(
     'window_days',            90,
     'min_events_for_signal',  3,
     'severity_weight',        jsonb_build_object('low',1,'medium',2,'high',3.5,'critical',6),
     'recency_decay_days',     45,
     'followup_penalty',       jsonb_build_object('open',0.5,'overdue',1.5),
     'bands',                  jsonb_build_object(
        'strong',    jsonb_build_object('min_recognition',6,'max_issue',3),
        'stable',    jsonb_build_object('max_issue',4),
        'watch',     jsonb_build_object('min_issue',4,'max_issue',7),
        'attention', jsonb_build_object('min_issue',7,'min_overdue_followups',2)
     )
  )),
  ('general', jsonb_build_object(
     'organisation', 'LD Group',
     'timezone',     'Asia/Kolkata',
     'date_format',  'dd MMM yyyy'
  ));

-- ---------------------------------------------------------------------
-- Departments — imported by name, company deliberately left NULL for
-- Raghav to assign in Settings rather than guessed here.
-- ---------------------------------------------------------------------

insert into employee_tracking.departments (name, code, source_ref, is_active)
select btrim(d.name), d.code, d.id, d.is_active
from evaluation.departments d
where d.is_active
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Designations
--
-- The source has case-variant duplicates ('helper'/'Helper',
-- 'Designer'/'designer'). Grouping on lower() and taking min() picks the
-- capitalised variant, since uppercase sorts first in ASCII — so 17
-- helpers land on one designation row rather than two.
-- ---------------------------------------------------------------------

insert into employee_tracking.designations (title, level, sort_order)
select
  t.title,
  case lower(t.title)
    when 'md'                                    then 'Management'
    when 'hod'                                   then 'HOD'
    when 'team leader'                           then 'Lead'
    when 'design coordinator'                    then 'Lead'
    when 'fabric incharge'                       then 'Lead'
    when 'process coordinator / deo team leader' then 'Lead'
    when 'sr. operator'                          then 'Senior'
    when 'sr. designer'                          then 'Senior'
    when 'executive assistant'                   then 'Senior'
    when 'hr'                                    then 'Senior'
    when 'hr-admin'                              then 'Senior'
    else 'Staff'
  end::employee_tracking.designation_level,
  0
from (
  select min(btrim(p.designation)) as title
  from evaluation.profiles p
  where p.is_active and p.designation is not null and btrim(p.designation) <> ''
  group by lower(btrim(p.designation))
) t
on conflict (title) do nothing;

-- ---------------------------------------------------------------------
-- Employees — all active staff, per the launch decision. Anyone can be
-- recorded against; there is no separate "tracked" flag to maintain.
-- ---------------------------------------------------------------------

insert into employee_tracking.employees (
  employee_code, full_name, designation_id, department_id,
  joining_date, status, contact_email, contact_phone, source_profile_id
)
select
  p.employee_code,
  btrim(p.full_name),
  des.id,
  dep.id,
  p.date_of_joining,
  'Active'::employee_tracking.employee_status,
  coalesce(nullif(btrim(p.work_email), ''), nullif(btrim(p.email), '')),
  coalesce(nullif(btrim(p.work_phone_e164), ''), nullif(btrim(p.phone_e164), '')),
  p.id
from evaluation.profiles p
left join employee_tracking.designations des
       on lower(des.title) = lower(btrim(p.designation))
left join employee_tracking.departments dep
       on dep.source_ref = p.department_id
where p.is_active
on conflict (source_profile_id) do nothing;

-- Second pass: reporting lines, once every employee row exists.
update employee_tracking.employees e
set manager_id = m.id
from evaluation.profiles p
join employee_tracking.employees m on m.source_profile_id = p.reports_to
where e.source_profile_id = p.id
  and p.reports_to is not null
  and m.id <> e.id;

-- ---------------------------------------------------------------------
-- Launch users (SPEC §14.3 — MD + Executive Assistants record; nobody else)
--
-- All four already exist in auth.users, so no accounts are created here.
-- Matching by email rather than hardcoded UUIDs keeps this re-runnable.
-- ---------------------------------------------------------------------

insert into employee_tracking.app_users (auth_user_id, employee_id, full_name, email, role)
select
  u.id,
  e.id,
  coalesce(e.full_name, initcap(replace(split_part(u.email, '@', 1), '.', ' '))),
  u.email,
  r.role::employee_tracking.app_role
from (values
  ('ai.linkdprints@gmail.com',      'super_admin',        null),
  ('raghavtibrewala96@gmail.com',   'super_admin',        'Raghav Tibrewala'),
  ('naushi.linkdprints@gmail.com',  'md',                 'Naushi Tibrewala'),
  ('alishakathe99@gmail.com',       'executive_assistant','Alisha Pandav')
) as r(email, role, employee_name)
join auth.users u on lower(u.email) = r.email
left join employee_tracking.employees e on e.full_name = r.employee_name
on conflict (auth_user_id) do nothing;
