-- =====================================================================
-- 006: close the one advisory the Supabase security linter raised
-- against this schema.
-- =====================================================================

-- touch_updated_at was the only function left without a pinned
-- search_path, so a role with a mutable search_path could shadow what it
-- resolves. Every other function in 002 was already pinned.
create or replace function employee_tracking.touch_updated_at()
returns trigger
language plpgsql
set search_path = employee_tracking, pg_temp
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

-- The linter also flags event_ref_counters as "RLS enabled, no policies".
-- That is deliberate: no policy means no direct access for anyone, leaving
-- the SECURITY DEFINER trigger as the only writer.
comment on table employee_tracking.event_ref_counters is
  'Internal PE-ref sequence. RLS is enabled with no policy on purpose: that denies all direct access, leaving the SECURITY DEFINER trigger as the only writer.';
