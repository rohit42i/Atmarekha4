create or replace function public.record_password_login_failure(p_user_id uuid)
returns table (
  failed_count integer,
  locked_until timestamptz,
  should_alert boolean,
  mfa_enabled boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_now timestamptz := now();
  v_failed_count integer := 0;
  v_first_failed_at timestamptz;
  v_last_failed_at timestamptz;
  v_locked_until timestamptz;
  v_previous_count integer := 0;
  v_new_count integer;
  v_mfa_enabled boolean;
begin
  select exists (
    select 1
    from auth.mfa_factors as f
    where f.user_id = p_user_id
      and f.status = 'verified'
  )
  into v_mfa_enabled;

  if v_mfa_enabled then
    return query select 0, null::timestamptz, false, true;
    return;
  end if;

  insert into public.login_password_protection (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select
    lp.failed_count,
    lp.first_failed_at,
    lp.last_failed_at,
    lp.locked_until
  into
    v_failed_count,
    v_first_failed_at,
    v_last_failed_at,
    v_locked_until
  from public.login_password_protection as lp
  where lp.user_id = p_user_id
  for update;

  if v_locked_until is not null and v_locked_until > v_now then
    return query select v_failed_count, v_locked_until, false, false;
    return;
  end if;

  if v_last_failed_at is not null
     and v_last_failed_at < v_now - interval '24 hours' then
    v_failed_count := 0;
    v_first_failed_at := null;
    v_last_failed_at := null;
    v_locked_until := null;
    v_previous_count := 0;
  else
    v_previous_count := v_failed_count;
  end if;

  v_new_count := least(v_previous_count + 1, 5);

  update public.login_password_protection as lp
  set failed_count = v_new_count,
      first_failed_at = coalesce(v_first_failed_at, v_now),
      last_failed_at = v_now,
      locked_until = case
        when v_new_count >= 5 then v_now + interval '24 hours'
        else null
      end,
      last_alerted_at = case
        when v_new_count >= 5 then v_now
        else lp.last_alerted_at
      end
  where lp.user_id = p_user_id
  returning lp.failed_count, lp.locked_until
  into v_failed_count, v_locked_until;

  return query
  select
    v_failed_count,
    v_locked_until,
    v_new_count = 5 and v_previous_count < 5,
    false;
end;
$$;

revoke all on function public.record_password_login_failure(uuid) from public, anon, authenticated;
grant execute on function public.record_password_login_failure(uuid) to service_role;