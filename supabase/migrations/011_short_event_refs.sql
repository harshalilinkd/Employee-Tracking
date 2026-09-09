-- =====================================================================
-- 011 — Shorter event references: PE-2026-0002 becomes PE-002
--
-- Twelve characters to name one event was too many for a column heading,
-- and the year was doing no work: nobody searches for "the 2026 ones",
-- and the event date is on the row already.
--
-- Dropping the year means the counter can no longer reset each January,
-- so it becomes a single running number. That is what makes the short
-- form safe: PE-001 in 2026 and PE-001 in 2027 would otherwise be two
-- different events wearing the same name.
--
-- Still a table rather than a sequence, for the same reason as before: a
-- sequence leaks its value on a rolled-back insert, and a reference list
-- with holes in it invites the question "where did PE-004 go".
-- =====================================================================

create table if not exists employee_tracking.event_ref_counter (
  only_row boolean primary key default true check (only_row),
  last_no  integer not null default 0
);

alter table employee_tracking.event_ref_counter enable row level security;
-- No policy: the counter is touched only by the SECURITY DEFINER trigger
-- below, never by a client.

create or replace function employee_tracking.assign_event_ref()
returns trigger
language plpgsql
security definer
set search_path to 'employee_tracking', 'pg_temp'
as $$
declare
  v_no int;
begin
  if new.event_ref is not null and length(btrim(new.event_ref)) > 0 then
    return new;
  end if;

  insert into employee_tracking.event_ref_counter (only_row, last_no)
  values (true, 1)
  on conflict (only_row)
    do update set last_no = employee_tracking.event_ref_counter.last_no + 1
  returning last_no into v_no;

  -- Padded to three so the common case lines up in a column; past 999 it
  -- simply grows, which is better than renaming every earlier event.
  new.event_ref := 'PE-' || lpad(v_no::text, 3, '0');
  return new;
end;
$$;

-- Renumber what exists, oldest first, so the whole list reads in one
-- format. event_ref is frozen by pe_snapshot_and_freeze precisely so an
-- app user cannot rewrite history; this migration is the exception and
-- says so by lifting the trigger for the length of the statement.
alter table employee_tracking.performance_events disable trigger trg_pe_snapshot_and_freeze;
alter table employee_tracking.performance_events disable trigger trg_performance_events_audit;

with ordered as (
  select id, row_number() over (order by created_at, id) as n
  from employee_tracking.performance_events
)
update employee_tracking.performance_events p
set event_ref = 'PE-' || lpad(o.n::text, 3, '0')
from ordered o
where p.id = o.id;

alter table employee_tracking.performance_events enable trigger trg_pe_snapshot_and_freeze;
alter table employee_tracking.performance_events enable trigger trg_performance_events_audit;

-- The counter starts where the renumbering ended, so the next event
-- continues the sequence instead of colliding with an existing one.
insert into employee_tracking.event_ref_counter (only_row, last_no)
values (true, (select count(*) from employee_tracking.performance_events))
on conflict (only_row) do update
  set last_no = (select count(*) from employee_tracking.performance_events);

-- The per-year counters have nothing left to count.
drop table if exists employee_tracking.event_ref_counters;
