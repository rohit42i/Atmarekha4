create or replace function public.prepare_password_login(p_email text)
returns table (user_id uuid, email text, email_confirmed boolean, has_password boolean, mfa_enabled boolean, failed_count integer, locked_until timestamptz)
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare v_user_id uuid;
begin
  select u.id into v_user_id from auth.users as u
  where lower(u.email)=lower(trim(p_email)) and coalesce(u.is_anonymous,false)=false and u.deleted_at is null
  order by u.created_at desc limit 1;
  if v_user_id is null then return; end if;

  update public.login_password_protection as lp
  set failed_count=0, first_failed_at=null, last_failed_at=null, locked_until=null, last_alerted_at=null
  where lp.user_id=v_user_id and lp.locked_until is not null and lp.locked_until<=now();

  return query
  select u.id, u.email, u.email_confirmed_at is not null,
    u.encrypted_password is not null and length(u.encrypted_password)>0,
    exists(select 1 from auth.mfa_factors as f where f.user_id=u.id and f.status='verified'),
    coalesce(lp.failed_count,0), lp.locked_until
  from auth.users as u
  left join public.login_password_protection as lp on lp.user_id=u.id
  where u.id=v_user_id;
end;
$$;
revoke all on function public.prepare_password_login(text) from public, anon, authenticated;
grant execute on function public.prepare_password_login(text) to service_role;