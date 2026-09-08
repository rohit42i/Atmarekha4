-- Progressive feature unlocks: count unique users who have successfully logged in.
create table if not exists public.feature_unlock_config (
  id boolean primary key default true check (id = true),
  login_user_count bigint not null default 0 check (login_user_count >= 0),
  membership_unlocked boolean not null default false,
  group_chat_unlocked boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.feature_unlock_config enable row level security;

create policy "feature unlock flags are readable"
  on public.feature_unlock_config
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.feature_unlock_config from anon, authenticated;

insert into public.feature_unlock_config (id, login_user_count, membership_unlocked, group_chat_unlocked)
select true,
       count(*)::bigint,
       count(*) >= 200,
       count(*) >= 500
from auth.users
where last_sign_in_at is not null
on conflict (id) do update
set login_user_count = excluded.login_user_count,
    membership_unlocked = excluded.membership_unlocked,
    group_chat_unlocked = excluded.group_chat_unlocked,
    updated_at = now();

create table if not exists public.feature_login_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now()
);

alter table public.feature_login_users enable row level security;
revoke all on public.feature_login_users from anon, authenticated;

insert into public.feature_login_users (user_id)
select id from auth.users where last_sign_in_at is not null
on conflict (user_id) do nothing;

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
