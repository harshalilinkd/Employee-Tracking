-- =====================================================================
-- Export queries — employee_tracking
--
-- Run in: Supabase Dashboard → SQL Editor → Run → "Download CSV".
-- The SQL Editor runs as the service role, so RLS does not filter these;
-- you get every row regardless of which app user you are signed in as.
--
-- Note on windows: v_employee_signal is computed over the configured
-- signal window (90 days by default), so its band, loads and trend are
-- "last 90 days". The plain counts below are lifetime, straight off
-- performance_events. Both are included and labelled.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ALL EMPLOYEES — roster + lifetime totals + current signal
--    This is the one you usually want.
-- ---------------------------------------------------------------------

select
  e.employee_code                                        as "Code",
  e.full_name                                            as "Employee",
  des.title                                              as "Designation",
  dept.name                                              as "Department",
  mgr.full_name                                          as "Reports to",
  e.status                                               as "Status",
  e.joining_date                                         as "Joined",
  e.contact_email                                        as "Email",
  e.contact_phone                                        as "Phone",

  coalesce(ev.total_events, 0)                           as "Total events",
  coalesce(ev.recognitions, 0)                           as "Recognitions",
  coalesce(ev.goofups, 0)                                as "Goofups",
  coalesce(ev.recognitions, 0) - coalesce(ev.goofups, 0) as "Net",
  coalesce(ev.critical, 0)                               as "Critical goofups",
  coalesce(ev.open_followups, 0)                         as "Open follow-ups",
  ev.first_event                                         as "First event",
  ev.last_event                                          as "Last event",

  s.band                                                 as "Signal (90d)",
  s.trend_label                                          as "Trend (90d)",
  s.event_count                                          as "Events (90d)",
  s.issue_load                                           as "Issue load (90d)",
  s.recognition_load                                     as "Recognition load (90d)",
  s.days_since_any                                       as "Days since last event",
  s.repeat_category                                      as "Repeat issue area",
  s.explanation                                          as "Why this signal"

from employee_tracking.employees e
left join employee_tracking.designations   des  on des.id  = e.designation_id
left join employee_tracking.departments    dept on dept.id = e.department_id
left join employee_tracking.employees      mgr  on mgr.id  = e.manager_id
left join employee_tracking.v_employee_signal s on s.employee_id = e.id
left join lateral (
  select
    count(*)                                                        as total_events,
    count(*) filter (where pe.type = 'positive')                    as recognitions,
    count(*) filter (where pe.type = 'goofup')                      as goofups,
    count(*) filter (where pe.type = 'goofup'
                       and pe.severity = 'critical')                as critical,
    count(*) filter (where pe.follow_up_required
                       and pe.follow_up_status is distinct from 'done') as open_followups,
    min(pe.event_date)                                              as first_event,
    max(pe.event_date)                                              as last_event
  from employee_tracking.performance_events pe
  where pe.employee_id = e.id
    and pe.status = 'active'          -- archived records excluded
) ev on true

-- Drop this line to include Inactive / Left staff as well.
where e.status = 'Active'
order by e.full_name;


-- ---------------------------------------------------------------------
-- 2. ROSTER ONLY — no performance figures
-- ---------------------------------------------------------------------

select
  e.employee_code  as "Code",
  e.full_name      as "Employee",
  des.title        as "Designation",
  dept.name        as "Department",
  mgr.full_name    as "Reports to",
  e.status         as "Status",
  e.joining_date   as "Joined",
  e.contact_email  as "Email",
  e.contact_phone  as "Phone"
from employee_tracking.employees e
left join employee_tracking.designations des  on des.id  = e.designation_id
left join employee_tracking.departments  dept on dept.id = e.department_id
left join employee_tracking.employees    mgr  on mgr.id  = e.manager_id
order by dept.name nulls last, e.full_name;


-- ---------------------------------------------------------------------
-- 3. EVERY EVENT — one row per performance record, all employees
--    This is what the Export CSV button on /performance produces, but
--    without the page's 300-row limit or its date filter.
-- ---------------------------------------------------------------------

select
  pe.event_ref                                   as "Reference",
  pe.event_date                                  as "Date",
  e.employee_code                                as "Code",
  e.full_name                                    as "Employee",
  dept.name                                      as "Department",
  case pe.type when 'positive' then 'Positive Contribution' else 'Goofup' end as "Type",
  cat.name                                       as "Category",
  -- Impact grades goofups only; positives are stored at the neutral grade
  -- and are exported as a dash, matching what the app shows.
  case when pe.type = 'goofup' then initcap(pe.severity::text) else '—' end as "Impact",
  pe.title                                       as "Title",
  pe.description                                 as "Description",
  obs.name                                       as "Observed by",
  au.full_name                                   as "Recorded by",
  pe.created_at                                  as "Recorded at",
  pe.follow_up_required                          as "Follow-up required",
  pe.follow_up_date                              as "Follow-up due",
  pe.follow_up_status                            as "Follow-up status",
  pe.status                                      as "Record status"
from employee_tracking.performance_events pe
join      employee_tracking.employees   e    on e.id    = pe.employee_id
left join employee_tracking.departments dept on dept.id = pe.department_id
left join employee_tracking.categories  cat  on cat.id  = pe.category_id
left join employee_tracking.app_users   au   on au.id   = pe.recorded_by
left join employee_tracking.observers   obs  on obs.id  = pe.observed_by
where pe.status = 'active'
order by pe.event_date desc, pe.event_ref desc;


-- ---------------------------------------------------------------------
-- 4. DEPARTMENT ROLL-UP
-- ---------------------------------------------------------------------

select
  dept.name                                              as "Department",
  count(distinct e.id)                                   as "People",
  count(pe.id)                                           as "Events",
  count(pe.id) filter (where pe.type = 'positive')       as "Recognitions",
  count(pe.id) filter (where pe.type = 'goofup')         as "Goofups",
  count(pe.id) filter (where pe.type = 'goofup'
                         and pe.severity = 'critical')   as "Critical"
from employee_tracking.departments dept
left join employee_tracking.employees e
       on e.department_id = dept.id and e.status = 'Active'
left join employee_tracking.performance_events pe
       on pe.employee_id = e.id and pe.status = 'active'
where dept.is_active
group by dept.name
order by "Goofups" desc, dept.name;
