begin;

-- Do not make anonymous readers execute a private admin-check function.
-- Keep published content public, and keep the admin-only branch scoped to authenticated sessions.
drop policy if exists "Announcements readable by public or admins" on public.announcements;
create policy "Published announcements are publicly readable"
  on public.announcements
  for select
  to anon
  using (published_at is not null and published_at <= now());
create policy "Published announcements or admins can read"
  on public.announcements
  for select
  to authenticated
  using (
    (published_at is not null and published_at <= now())
    or private.is_admin()
  );

drop policy if exists "Manga series readable by public or admins" on public.manga_series;
create policy "Published manga series are publicly readable"
  on public.manga_series
  for select
  to anon
  using (is_published = true);
create policy "Published manga series or admins can read"
  on public.manga_series
  for select
  to authenticated
  using (is_published = true or private.is_admin());

-- Public profile screens and reader badges intentionally show these basic fields.
-- Grant only the exact columns those public features need, not the entire profiles table.
grant select (id, username, display_name, avatar_url, bio, public_badge, created_at)
  on public.profiles to anon;

-- The function accepts no caller-supplied user ID: it records auth.uid() only.
-- SECURITY DEFINER lets the database perform the insert without granting readers
-- SELECT access to everyone in the feature_login_users table.
create or replace function public.record_feature_login()
returns public.feature_unlock_config
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_config public.feature_unlock_config;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.feature_login_users (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_config
  from public.feature_unlock_config
  where id = true;

  return v_config;
end;
$function$;

grant execute on function public.record_feature_login() to authenticated;
revoke execute on function public.record_feature_login() from anon;

commit;
