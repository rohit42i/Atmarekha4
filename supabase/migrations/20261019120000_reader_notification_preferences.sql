-- Per-reader push notification preferences. Missing rows intentionally mean all categories enabled.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{"new_chapters":true,"comments_replies":true,"group_chat":true,"community_posts":true,"announcements":true,"membership_account":true,"other_updates":true}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint notification_preferences_object check (jsonb_typeof(preferences) = 'object')
);

alter table public.notification_preferences enable row level security;
drop policy if exists "Readers can view own notification preferences" on public.notification_preferences;
drop policy if exists "Readers can insert own notification preferences" on public.notification_preferences;
drop policy if exists "Readers can update own notification preferences" on public.notification_preferences;
create policy "Readers can view own notification preferences" on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
create policy "Readers can insert own notification preferences" on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy "Readers can update own notification preferences" on public.notification_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notification_preferences from anon;
grant select, insert, update on public.notification_preferences to authenticated;

create or replace function public.set_notification_preferences_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_notification_preferences_updated_at();
