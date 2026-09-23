-- Avoid overlapping admin/public SELECT policies while preserving access rules.
drop policy if exists manga_series_admin_manage on public.manga_series;
drop policy if exists manga_series_public_read on public.manga_series;

create policy manga_series_public_read
on public.manga_series
for select
to anon, authenticated
using (is_published = true or private.is_admin());

create policy manga_series_admin_insert
on public.manga_series
for insert to authenticated
with check (private.is_admin());

create policy manga_series_admin_update
on public.manga_series
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy manga_series_admin_delete
on public.manga_series
for delete to authenticated
using (private.is_admin());

drop policy if exists pdlpl_admin_manage_pages on public.pal_do_pal_ke_lamhe_chapter_pages;
drop policy if exists pdlpl_member_read_pages on public.pal_do_pal_ke_lamhe_chapter_pages;

create policy pdlpl_member_read_pages
on public.pal_do_pal_ke_lamhe_chapter_pages
for select
to anon, authenticated
using (
  private.is_admin()
  or exists (
    select 1 from public.user_subscriptions us
    where us.user_id = (select auth.uid())
      and us.plan_id <> 'free'
      and (
        (us.status = 'active' and (us.current_period_end is null or us.current_period_end > now()))
        or
        (us.status = 'cancelled' and us.current_period_end is not null and us.current_period_end > now())
      )
  )
);

create policy pdlpl_admin_insert_pages
on public.pal_do_pal_ke_lamhe_chapter_pages
for insert to authenticated
with check (private.is_admin());

create policy pdlpl_admin_update_pages
on public.pal_do_pal_ke_lamhe_chapter_pages
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy pdlpl_admin_delete_pages
on public.pal_do_pal_ke_lamhe_chapter_pages
for delete to authenticated
using (private.is_admin());

drop policy if exists pdlpl_admin_manage_chapters on public.pal_do_pal_ke_lamhe_chapters;
drop policy if exists pdlpl_public_read_published_chapters on public.pal_do_pal_ke_lamhe_chapters;

create policy pdlpl_public_read_published_chapters
on public.pal_do_pal_ke_lamhe_chapters
for select
to anon, authenticated
using (lower(coalesce(status,'')) = 'published' or private.is_admin());

create policy pdlpl_admin_insert_chapters
on public.pal_do_pal_ke_lamhe_chapters
for insert to authenticated
with check (private.is_admin());

create policy pdlpl_admin_update_chapters
on public.pal_do_pal_ke_lamhe_chapters
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy pdlpl_admin_delete_chapters
on public.pal_do_pal_ke_lamhe_chapters
for delete to authenticated
using (private.is_admin());
