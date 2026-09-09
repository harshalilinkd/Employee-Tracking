-- =====================================================================
-- 012 — Clear the trial run
--
-- The events recorded while the system was being tried out have been
-- deleted, so this clears what they left behind: the reference counter,
-- which would otherwise hand the first real event PE-002, and the audit
-- entries describing records that no longer exist.
--
-- Deliberately a one-off. The counter does not reset itself when the
-- table empties, and it must not: a reference is a name, and reusing
-- PE-001 for a second event would make every earlier mention of it
-- point at the wrong record.
-- =====================================================================

-- Safety rail: only reset while there is genuinely nothing numbered.
-- If real events exist by the time this runs, leave the counter alone
-- rather than setting up a collision with them.
update employee_tracking.event_ref_counter
set last_no = 0
where not exists (select 1 from employee_tracking.performance_events);

delete from employee_tracking.audit_log;
