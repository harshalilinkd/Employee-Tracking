-- =====================================================================
-- 005: the Performance Signal (SPEC §5)
--
-- Six dimensions over a rolling window. Explicitly NOT positive-minus-
-- goofup: severity is weighted, recency decays, and silence is its own
-- band rather than being folded into "Stable".
--
-- security_invoker = true is load-bearing. Postgres views default to the
-- VIEW OWNER's rights, which would bypass RLS on performance_events and
-- hand a Department Manager the whole company's numbers. With invoker
-- rights the underlying RLS still applies, so the matrix a manager sees
-- is computed only from rows that manager is allowed to read.
-- =====================================================================

create or replace function employee_tracking.signal_config()
returns jsonb
language sql stable security definer set search_path = employee_tracking, pg_temp
as $$
  select coalesce(
    (select value from employee_tracking.settings where key = 'signal_config'),
    '{"window_days":90,"min_events_for_signal":3,
      "severity_weight":{"low":1,"medium":2,"high":3.5,"critical":6},
      "recency_decay_days":45,
      "followup_penalty":{"open":0.5,"overdue":1.5},
      "bands":{"strong":{"min_recognition":6,"max_issue":3},
               "stable":{"max_issue":4},
               "watch":{"min_issue":4,"max_issue":7},
               "attention":{"min_issue":7,"min_overdue_followups":2}}}'::jsonb
  )
$$;

create or replace view employee_tracking.v_employee_signal
with (security_invoker = true) as
with cfg as (
  select
    coalesce((c->>'window_days')::int, 90)                            as window_days,
    coalesce((c->>'min_events_for_signal')::int, 3)                   as min_events,
    coalesce((c->>'recency_decay_days')::numeric, 45)                 as decay,
    coalesce((c->'severity_weight'->>'low')::numeric, 1)              as w_low,
    coalesce((c->'severity_weight'->>'medium')::numeric, 2)           as w_med,
    coalesce((c->'severity_weight'->>'high')::numeric, 3.5)           as w_high,
    coalesce((c->'severity_weight'->>'critical')::numeric, 6)         as w_crit,
    coalesce((c->'followup_penalty'->>'open')::numeric, 0.5)          as p_open,
    coalesce((c->'followup_penalty'->>'overdue')::numeric, 1.5)       as p_overdue,
    coalesce((c->'bands'->'strong'->>'min_recognition')::numeric, 6)  as strong_recognition,
    coalesce((c->'bands'->'strong'->>'max_issue')::numeric, 3)        as strong_max_issue,
    coalesce((c->'bands'->'stable'->>'max_issue')::numeric, 4)        as stable_max_issue,
    coalesce((c->'bands'->'watch'->>'min_issue')::numeric, 4)         as watch_min_issue,
    coalesce((c->'bands'->'attention'->>'min_issue')::numeric, 7)     as attention_min_issue,
    coalesce((c->'bands'->'attention'->>'min_overdue_followups')::int, 2) as attention_min_overdue
  from (select employee_tracking.signal_config() as c) x
),
ev as (
  select
    pe.employee_id, pe.type, pe.severity, pe.event_date, pe.category_id,
    (current_date - pe.event_date)::numeric as days_ago
  from employee_tracking.performance_events pe, cfg
  where pe.status = 'active'
    and pe.event_date >= current_date - cfg.window_days
),
w as (
  -- severity weight x exponential recency decay (half-life ~31 days at 45)
  select
    ev.*,
    (case ev.severity
       when 'low' then cfg.w_low when 'medium' then cfg.w_med
       when 'high' then cfg.w_high else cfg.w_crit end
    ) * exp(-ev.days_ago / cfg.decay) as weight,
    cfg.window_days / 2.0 as half
  from ev cross join cfg
),
agg as (
  select
    employee_id,
    count(*)                                                        as event_count,
    count(*) filter (where type = 'positive')                       as positive_count,
    count(*) filter (where type = 'goofup')                         as goofup_count,
    coalesce(sum(weight) filter (where type = 'positive'), 0)       as recognition_load,
    coalesce(sum(weight) filter (where type = 'goofup'), 0)         as issue_load,
    count(*) filter (where type = 'goofup' and severity = 'critical') as critical_goofups,
    min(days_ago) filter (where type = 'positive')                  as days_since_positive,
    min(days_ago) filter (where type = 'goofup')                    as days_since_goofup,
    min(days_ago)                                                   as days_since_any,
    -- Trend: net position in the recent half against the earlier half.
    (count(*) filter (where type = 'positive' and days_ago <  half)
     - count(*) filter (where type = 'goofup' and days_ago <  half))
    -
    (count(*) filter (where type = 'positive' and days_ago >= half)
     - count(*) filter (where type = 'goofup' and days_ago >= half))  as trend_delta
  from w
  group by employee_id
),
-- Follow-ups are NOT window-limited: an overdue action from four months
-- ago is still overdue, and burying it would defeat the point.
fu as (
  select
    employee_id,
    count(*) filter (where follow_up_status in ('open','in_progress'))            as open_followups,
    count(*) filter (where follow_up_status in ('open','in_progress')
                       and follow_up_date < current_date)                         as overdue_followups,
    max(current_date - follow_up_date) filter (where follow_up_status in ('open','in_progress')
                       and follow_up_date < current_date)                         as max_overdue_days
  from employee_tracking.performance_events
  where status = 'active' and follow_up_required
  group by employee_id
),
-- "Two or more goofups in the same category" — the repeat-pattern rule.
repcat as (
  select distinct on (g.employee_id)
    g.employee_id, c.name as repeat_category, g.cnt as repeat_count
  from (
    select employee_id, category_id, count(*) as cnt
    from w where type = 'goofup' and category_id is not null
    group by 1, 2 having count(*) >= 2
  ) g
  join employee_tracking.categories c on c.id = g.category_id
  order by g.employee_id, g.cnt desc, c.name
),
-- Consistency: how spread out the observations are, rather than clustered.
cons as (
  select employee_id, count(distinct date_trunc('week', event_date)) as active_weeks
  from ev group by 1
),
calc as (
  select
    e.id as employee_id,
    e.full_name,
    e.department_id,
    cfg.window_days,
    cfg.min_events,
    coalesce(a.event_count, 0)      as event_count,
    coalesce(a.positive_count, 0)   as positive_count,
    coalesce(a.goofup_count, 0)     as goofup_count,
    round(coalesce(a.recognition_load, 0), 2) as recognition_load,
    round(coalesce(a.issue_load, 0), 2)       as issue_load,
    coalesce(a.critical_goofups, 0) as critical_goofups,
    a.days_since_positive::int,
    a.days_since_goofup::int,
    a.days_since_any::int,
    coalesce(a.trend_delta, 0)      as trend_delta,
    coalesce(f.open_followups, 0)   as open_followups,
    coalesce(f.overdue_followups,0) as overdue_followups,
    f.max_overdue_days::int,
    round(coalesce(f.open_followups,0) * cfg.p_open
        + coalesce(f.overdue_followups,0) * cfg.p_overdue, 2) as followup_penalty,
    r.repeat_category,
    r.repeat_count,
    coalesce(c.active_weeks, 0)     as active_weeks,
    round(coalesce(c.active_weeks,0)::numeric / greatest(cfg.window_days / 7.0, 1), 2) as consistency,
    cfg.strong_recognition, cfg.strong_max_issue, cfg.stable_max_issue,
    cfg.watch_min_issue, cfg.attention_min_issue, cfg.attention_min_overdue
  from employee_tracking.employees e
  cross join cfg
  left join agg    a on a.employee_id = e.id
  left join fu     f on f.employee_id = e.id
  left join repcat r on r.employee_id = e.id
  left join cons   c on c.employee_id = e.id
),
banded as (
  select
    calc.*,
    case
      -- Mandatory: silence is never "Stable". An employee nobody has
      -- observed is a different problem from one who is doing fine.
      when event_count < min_events then 'No signal'
      when issue_load >= attention_min_issue
        or critical_goofups > 0
        or overdue_followups >= attention_min_overdue then 'Attention'
      when issue_load >= watch_min_issue
        or repeat_category is not null
        or trend_delta <= -2 then 'Watch'
      when recognition_load >= strong_recognition
        and issue_load < strong_max_issue
        and trend_delta > -2 then 'Strong'
      when issue_load < stable_max_issue and overdue_followups = 0 then 'Stable'
      else 'Watch'
    end as band,
    case
      when event_count < min_events then 'Not enough data'
      when trend_delta >= 2  then 'Improving'
      when trend_delta <= -4 then 'Slipping'
      when trend_delta <= -2 then 'Softening'
      else 'Stable'
    end as trend_label
  from calc
)
select
  b.*,
  -- Plain-English reason. SPEC §5: "If the UI cannot explain why an
  -- employee is marked Attention, the badge does not ship."
  case when b.event_count < b.min_events then
    case
      when b.event_count = 0 and b.days_since_any is null
        then 'No performance record in the last ' || b.window_days || ' days.'
      else b.event_count || ' event' || case when b.event_count = 1 then '' else 's' end
           || ' recorded in the last ' || b.window_days || ' days — at least '
           || b.min_events || ' are needed before a signal is shown.'
    end
  else
    btrim(concat_ws(' ',
      case when b.goofup_count > 0
        then b.goofup_count || ' goofup' || case when b.goofup_count = 1 then '' else 's' end
             || ' recorded (weighted load ' || b.issue_load || ')'
             || case when b.repeat_category is not null
                     then ', ' || b.repeat_count || ' of them in ' || b.repeat_category else '' end
             || '.'
      end,
      case when b.positive_count > 0
        then b.positive_count || ' positive contribution' || case when b.positive_count = 1 then '' else 's' end
             || ' (weighted load ' || b.recognition_load || ').'
      end,
      case
        when b.days_since_positive is not null and b.days_since_positive > 21
          then 'Last positive contribution was ' || b.days_since_positive || ' days ago.'
        when b.days_since_positive is null and b.goofup_count > 0
          then 'No positive contribution recorded in this window.'
      end,
      case when b.critical_goofups > 0
        then b.critical_goofups || ' critical issue' || case when b.critical_goofups = 1 then '' else 's' end
             || ' in the window.'
      end,
      case when b.overdue_followups > 0
        then b.overdue_followups || ' follow-up' || case when b.overdue_followups = 1 then '' else 's' end
             || ' overdue' || case when b.max_overdue_days is not null
                                   then ' by up to ' || b.max_overdue_days || ' days' else '' end || '.'
        when b.open_followups > 0
        then b.open_followups || ' open follow-up' || case when b.open_followups = 1 then '' else 's' end || '.'
      end
    ))
  end as explanation
from banded b;

grant select on employee_tracking.v_employee_signal to authenticated;
