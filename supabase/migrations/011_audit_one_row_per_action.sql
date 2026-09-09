-- =====================================================================
-- 011 — One audit row per action, not per changed field
--
-- The trigger looped over every changed column and wrote a row each. Edit
-- an event's title, category and impact in one save and the log showed
-- three entries, at the same second, by the same person, for the same
-- action — which is what buried the entries anyone actually reads.
--
-- Now a save is one row:
--
--   field_changed  'title, severity'                       (what changed)
--   old_value      {"title":"Done late","severity":"high"} (before, JSON)
--   new_value      {"title":"Done late - 4 days", ...}     (after, JSON)
--
-- JSON rather than prose because the UI renders each field on its own
-- line, and because a value containing a comma would otherwise be
-- indistinguishable from the separator.
--
-- Nothing is lost: the same before/after pairs are recorded, just grouped
-- by the action that caused them rather than scattered across rows.
-- =====================================================================

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
  v_fields text[] := '{}';
  v_before jsonb  := '{}'::jsonb;
  v_after  jsonb  := '{}'::jsonb;
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

  -- Collect the whole change instead of writing as we go.
  for k in select jsonb_object_keys(v_new) loop
    -- Bookkeeping columns are not changes anybody reads. sort_order moves
    -- whenever a list is reordered and says nothing about the record.
    if k in ('updated_at', 'created_at', 'sort_order') then
      continue;
    end if;
    if (v_old->k) is distinct from (v_new->k) then
      v_fields := v_fields || k;
      v_before := v_before || jsonb_build_object(k, v_old->k);
      v_after  := v_after  || jsonb_build_object(k, v_new->k);
    end if;
  end loop;

  -- A save that changed nothing meaningful writes nothing at all.
  if array_length(v_fields, 1) is null then
    return new;
  end if;

  insert into employee_tracking.audit_log
    (actor_id, actor_email, entity_type, entity_id, action, field_changed, old_value, new_value)
  values (
    v_actor, v_email, TG_TABLE_NAME, new.id, v_action,
    array_to_string(v_fields, ', '),
    v_before::text,
    v_after::text
  );

  return new;
end;
$fn$;

-- ---------------------------------------------------------------------
-- Per-record history needs to be readable by whoever can read the record
--
-- audit_log_admin_read stays as it is — the Settings audit screen is still
-- Super Admin and MD only. This adds a second, narrower policy: you may
-- read the history of a performance event you are already allowed to see.
-- Policies are OR-ed, so admins keep full access and everyone else gets
-- exactly the rows belonging to records already on their screen.
-- ---------------------------------------------------------------------

drop policy if exists audit_log_event_history_read on employee_tracking.audit_log;
create policy audit_log_event_history_read on employee_tracking.audit_log
  for select to authenticated
  using (
    entity_type = 'performance_events'
    and exists (
      select 1
      from employee_tracking.performance_events pe
      where pe.id = employee_tracking.audit_log.entity_id
        and employee_tracking.can_view_department(pe.department_id)
    )
  );
