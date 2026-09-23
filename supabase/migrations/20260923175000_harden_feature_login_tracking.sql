-- Keep feature-login accounting protected without exposing a SECURITY DEFINER RPC.
drop policy if exists feature_login_users_self_insert on public.feature_login_users;

create policy feature_login_users_self_insert
on public.feature_login_users
for insert
to authenticated
with check (user_id = (select auth.uid()));

create or replace function private.handle_feature_login_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.feature_unlock_config
  set
    login_user_count = login_user_count + 1,
    membership_unlocked = membership_unlocked or login_user_count + 1 >= 200,
    group_chat_unlocked = group_chat_unlocked or login_user_count + 1 >= 500,
    updated_at = now()
  where id = true;
  return new;
end;
$function$;

revoke all on function private.handle_feature_login_insert() from public, anon, authenticated;

drop trigger if exists feature_login_count_after_insert on public.feature_login_users;
create trigger feature_login_count_after_insert
after insert on public.feature_login_users
for each row
execute function private.handle_feature_login_insert();

revoke execute on function public.record_feature_login() from public, anon, authenticated;
grant execute on function public.record_feature_login() to service_role;
