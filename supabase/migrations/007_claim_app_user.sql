-- =====================================================================
-- 007: pre-authorise a user by email, before they have ever signed in
--
-- Without this, granting access needs hand-written SQL: app_users.auth_user_id
-- can only be set once you know the person's auth.users id, which does not
-- exist until their first login.
-- =====================================================================

create or replace function employee_tracking.claim_app_user()
returns uuid
language plpgsql
security definer
set search_path = employee_tracking, pg_temp
as $fn$
declare
  v_email text;
  v_id    uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is null or v_email = '' then
    return null;
  end if;

  -- Narrow on purpose: only fills a NULL auth_user_id, only on a row whose
  -- email matches the caller's own verified auth email, only while active.
  -- It cannot change a role, re-point an existing link, or touch anyone else.
  update employee_tracking.app_users a
     set auth_user_id = auth.uid(),
         updated_at   = now()
   where a.auth_user_id is null
     and a.is_active
     and lower(a.email) = v_email
  returning a.id into v_id;

  return v_id;
end;
$fn$;

revoke all on function employee_tracking.claim_app_user() from public;
grant execute on function employee_tracking.claim_app_user() to authenticated;
