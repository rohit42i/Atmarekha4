create or replace function public.get_admin_user_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.admins where user_id = auth.uid()
  ) then
    raise exception 'Admin access required.';
  end if;

  select jsonb_build_object(
    'logged_in_users', (select count(*) from public.profiles),
    'notification_users', (select count(distinct user_id) from public.push_subscriptions where user_id is not null)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_user_stats() from public;
grant execute on function public.get_admin_user_stats() to authenticated;
