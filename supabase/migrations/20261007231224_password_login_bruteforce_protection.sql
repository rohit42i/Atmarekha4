create table if not exists public.login_password_protection (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_count integer not null default 0 check (failed_count between 0 and 5),
  first_failed_at timestamptz,
  last_failed_at timestamptz,
  locked_until timestamptz,
  last_alerted_at timestamptz
);

alter table public.login_password_protection enable row level security;

revoke all on table public.login_password_protection from anon, authenticated, public;
grant all on table public.login_password_protection to service_role;

create or replace function public.prepare_password_login(p_email text)
returns table (
  user_id uuid,
  email text,
  email_confirmed boolean,
  has_password boolean,
  mfa_enabled boolean,
  failed_count integer,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid;
begin
  select u.id
    into v_user_id
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
     and coalesce(u.is_anonymous, false) = false
     and u.deleted_at is null
   order by u.created_at desc
   limit 1;

  if v_user_id is null then
    return;
  end if;

  update public.login_password_protection
     set failed_count = 0,
         first_failed_at = null,
         last_failed_at = null,
         locked_until = null,
         last_alerted_at = null
   where user_id = v_user_id
     and locked_until is not null
     and locked_until <= now();

  return query
  select
    u.id,
    u.email,
    u.email_confirmed_at is not null,
    u.encrypted_password is not null and length(u.encrypted_password) > 0,
    exists (
      select 1
        from auth.mfa_factors f
       where f.user_id = u.id
         and f.status = 'verified'
    ),
    coalesce(p.failed_count, 0),
    p.locked_until
  from auth.users u
  left join public.login_password_protection p on p.user_id = u.id
  where u.id = v_user_id;
end;
$$;

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
      from auth.mfa_factors f
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

  select failed_count, first_failed_at, last_failed_at, locked_until
    into v_failed_count, v_first_failed_at, v_last_failed_at, v_locked_until
    from public.login_password_protection
   where user_id = p_user_id
   for update;

  if v_locked_until is not null and v_locked_until > v_now then
    return query select v_failed_count, v_locked_until, false, false;
    return;
  end if;

  if v_last_failed_at is not null and v_last_failed_at < v_now - interval '24 hours' then
    v_failed_count := 0;
    v_first_failed_at := null;
    v_last_failed_at := null;
    v_locked_until := null;
    v_previous_count := 0;
  else
    v_previous_count := v_failed_count;
  end if;

  v_new_count := least(v_previous_count + 1, 5);

  update public.login_password_protection
     set failed_count = v_new_count,
         first_failed_at = coalesce(v_first_failed_at, v_now),
         last_failed_at = v_now,
         locked_until = case when v_new_count >= 5 then v_now + interval '24 hours' else null end,
         last_alerted_at = case when v_new_count >= 5 then v_now else last_alerted_at end
   where user_id = p_user_id
  returning failed_count, locked_until into v_failed_count, v_locked_until;

  return query
  select v_failed_count,
         v_locked_until,
         v_new_count = 5 and v_previous_count < 5,
         false;
end;
$$;

create or replace function public.reset_password_login_protection(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  delete from public.login_password_protection
   where user_id = p_user_id;
end;
$$;

revoke all on function public.prepare_password_login(text) from public, anon, authenticated;
revoke all on function public.record_password_login_failure(uuid) from public, anon, authenticated;
revoke all on function public.reset_password_login_protection(uuid) from public, anon, authenticated;

grant execute on function public.prepare_password_login(text) to service_role;
grant execute on function public.record_password_login_failure(uuid) to service_role;
grant execute on function public.reset_password_login_protection(uuid) to service_role;
