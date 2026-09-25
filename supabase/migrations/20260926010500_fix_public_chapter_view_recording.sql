-- Public chapter views must be recordable by both anonymous and authenticated readers.
-- Keep input validation as a table constraint rather than an RLS expression.
drop trigger if exists chapter_views_rate_limit on public.chapter_views;

drop policy if exists "Public can record chapter views" on public.chapter_views;
create policy "Public can record chapter views"
on public.chapter_views
for insert
to anon, authenticated
with check (true);

alter table public.chapter_views
  drop constraint if exists chapter_views_viewer_key_length_check;

alter table public.chapter_views
  add constraint chapter_views_viewer_key_length_check
  check (viewer_key is not null and char_length(viewer_key) between 16 and 128);
