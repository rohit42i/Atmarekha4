-- Fix row-count variable type used by the feature login counter.
create or replace function public.record_feature_login()
returns public.feature_unlock_config
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
  v_config public.feature_unlock_config;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.feature_login_users (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.feature_unlock_config
    set login_user_count = login_user_count + 1,
        membership_unlocked = membership_unlocked or login_user_count + 1 >= 200,
        group_chat_unlocked = group_chat_unlocked or login_user_count + 1 >= 500,
        updated_at = now()
    where id = true;
  end if;

  select * into v_config
  from public.feature_unlock_config
  where id = true;

  return v_config;
end;
$$;

grant execute on function public.record_feature_login() to authenticated;
