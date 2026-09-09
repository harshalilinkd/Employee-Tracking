-- =====================================================================
-- 010 — Permanent delete for performance events
--
-- Until now the only way to remove an event was to archive it: the row
-- stayed, the audit log kept every change, and nothing was ever lost.
-- That is still the right default and the UI still leads with it.
--
-- This adds a genuine delete, on request, with three guards so the
-- capability does not quietly become a way to erase inconvenient history:
--
--   1. Super Admin and MD only. Nobody else gets the policy, so nobody
--      else can delete even by calling the API directly.
--   2. The deletion is itself audited. audit_log.entity_id has no foreign
--      key to performance_events, so the trail survives the row it
--      describes — a deleted event leaves a record saying who deleted it
--      and what it was.
--   3. Attachments cascade (already ON DELETE CASCADE), so no orphan rows.
--
-- Note the storage objects behind those attachments are NOT removed by
-- this — the files stay in the bucket until cleaned up separately.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 'delete' as an audit action
--
-- Safe to run inside a transaction: the new label is only ever *used* at
-- trigger execution time, which is a later transaction than this one.
-- ---------------------------------------------------------------------

alter type employee_tracking.audit_action add value if not exists 'delete';

-- ---------------------------------------------------------------------
-- The audit trigger learns to record deletions
--
-- Shared by eight tables, so the existing INSERT and UPDATE behaviour is
-- reproduced exactly; only the DELETE branch is new. NEW is null in an
-- AFTER DELETE trigger, which is why the branch returns early rather than
-- falling through to the field-by-field diff below.
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
  v_label  text;
  k        text;
begin
  select email into v_email from employee_tracking.app_users where id = v_actor;

  if TG_OP = 'INSERT' then
    insert into employee_tracking.audit_log
      (actor_id, actor_email, entity_type, entity_id, action, new_value)
    values (v_actor, v_email, TG_TABLE_NAME, new.id, 'create', null);
    return new;
  end if;

  if TG_OP = 'DELETE' then
    v_old := to_jsonb(old);
    -- Enough of the vanished row to know what was removed, since there is
    -- no longer a record to join back to.
    v_label := coalesce(v_old->>'event_ref', v_old->>'name', v_old->>'full_name', v_old->>'title', old.id::text);
    insert into employee_tracking.audit_log
      (actor_id, actor_email, entity_type, entity_id, action, field_changed, old_value, new_value)
    values (
      v_actor, v_email, TG_TABLE_NAME, old.id, 'delete', 'record',
      v_label || coalesce(' — ' || (v_old->>'title'), ''),
      null
    );
    return old;
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

-- Only performance_events gains a delete trigger; the other seven audited
-- tables keep insert/update, because nothing deletes from them this way.
drop trigger if exists trg_performance_events_audit on employee_tracking.performance_events;
create trigger trg_performance_events_audit
  after insert or update or delete on employee_tracking.performance_events
  for each row execute function employee_tracking.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS: Super Admin and MD only
--
-- Deliberately narrower than pe_update, which also lets a recorder correct
-- their own entry inside 48 hours. Correcting a typo and erasing the
-- evidence are not the same act, so they do not share a permission.
-- ---------------------------------------------------------------------

drop policy if exists pe_delete on employee_tracking.performance_events;
create policy pe_delete on employee_tracking.performance_events
  for delete to authenticated
  using (employee_tracking.is_admin());

grant delete on employee_tracking.performance_events to authenticated;
