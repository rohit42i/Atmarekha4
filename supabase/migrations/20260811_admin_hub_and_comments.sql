create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can write announcements" on public.announcements;
drop policy if exists "Admins can update announcements" on public.announcements;
drop policy if exists "Admins can delete announcements" on public.announcements;
create policy "Admins can write announcements" on public.announcements for insert to authenticated with check (public.is_admin());
create policy "Admins can update announcements" on public.announcements for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete announcements" on public.announcements for delete to authenticated using (public.is_admin());

drop policy if exists "Admins can write media" on public.media;
drop policy if exists "Admins can update media" on public.media;
drop policy if exists "Admins can delete media" on public.media;
create policy "Admins can write media" on public.media for insert to authenticated with check (public.is_admin());
create policy "Admins can update media" on public.media for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete media" on public.media for delete to authenticated using (public.is_admin());

drop policy if exists "Admins can upload chapter pages" on storage.objects;
drop policy if exists "Admins can update chapter pages" on storage.objects;
drop policy if exists "Admins can delete chapter pages" on storage.objects;
drop policy if exists "Admins can upload covers" on storage.objects;
drop policy if exists "Admins can update covers" on storage.objects;
drop policy if exists "Admins can delete covers" on storage.objects;
create policy "Admins can upload chapter pages" on storage.objects for insert to authenticated with check (bucket_id = 'chapter-pages' and public.is_admin());
create policy "Admins can update chapter pages" on storage.objects for update to authenticated using (bucket_id = 'chapter-pages' and public.is_admin()) with check (bucket_id = 'chapter-pages' and public.is_admin());
create policy "Admins can delete chapter pages" on storage.objects for delete to authenticated using (bucket_id = 'chapter-pages' and public.is_admin());
create policy "Admins can upload covers" on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.is_admin());
create policy "Admins can update covers" on storage.objects for update to authenticated using (bucket_id = 'covers' and public.is_admin()) with check (bucket_id = 'covers' and public.is_admin());
create policy "Admins can delete covers" on storage.objects for delete to authenticated using (bucket_id = 'covers' and public.is_admin());

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  author_name text not null default 'Reader',
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_chapter_id_idx on public.comments(chapter_id);
create index if not exists comments_created_at_idx on public.comments(created_at desc);

alter table public.comments enable row level security;

drop policy if exists "Anyone can read comments" on public.comments;
drop policy if exists "Users can create own comments" on public.comments;
drop policy if exists "Users can update own comments" on public.comments;
drop policy if exists "Users can delete own comments" on public.comments;
create policy "Anyone can read comments" on public.comments for select to anon, authenticated using (true);
create policy "Users can create own comments" on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own comments" on public.comments for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Users can delete own comments" on public.comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.set_comments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at before update on public.comments for each row execute function public.set_comments_updated_at();
