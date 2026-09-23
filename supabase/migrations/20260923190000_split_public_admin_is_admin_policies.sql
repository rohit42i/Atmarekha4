-- Prevent anonymous public reads from invoking the private admin helper.
-- Keep admin-only checks available only to authenticated callers.

drop policy if exists "Public can read published chapters" on public.chapters;
create policy "Public can read published chapters"
on public.chapters for select to anon, authenticated
using (lower(coalesce(status,'')) = 'published');
create policy "Admins can read unpublished chapters"
on public.chapters for select to authenticated
using (private.is_admin());

drop policy if exists "Public can read published announcements" on public.announcements;
create policy "Public can read published announcements"
on public.announcements for select to anon, authenticated
using (published_at is not null and published_at <= now());
create policy "Admins can read unpublished announcements"
on public.announcements for select to authenticated
using (private.is_admin());

drop policy if exists "manga_series_public_read" on public.manga_series;
create policy "manga_series_public_read"
on public.manga_series for select to anon, authenticated
using (is_published = true);
create policy "manga_series_admin_read"
on public.manga_series for select to authenticated
using (private.is_admin());

drop policy if exists "pdlpl_member_read_pages" on public.pal_do_pal_ke_lamhe_chapter_pages;
create policy "pdlpl_member_read_pages"
on public.pal_do_pal_ke_lamhe_chapter_pages for select to authenticated
using (
  private.is_admin()
  or exists (
    select 1
    from public.user_subscriptions us
    where us.user_id = (select auth.uid())
      and us.plan_id <> 'free'
      and (
        (us.status = 'active' and (us.current_period_end is null or us.current_period_end > now()))
        or
        (us.status = 'cancelled' and us.current_period_end is not null and us.current_period_end > now())
      )
  )
);

drop policy if exists "pdlpl_public_read_published_chapters" on public.pal_do_pal_ke_lamhe_chapters;
create policy "pdlpl_public_read_published_chapters"
on public.pal_do_pal_ke_lamhe_chapters for select to anon, authenticated
using (lower(coalesce(status,'')) = 'published');
create policy "pdlpl_admin_read_unpublished_chapters"
on public.pal_do_pal_ke_lamhe_chapters for select to authenticated
using (private.is_admin());

revoke execute on function private.is_admin() from anon, public;
grant execute on function private.is_admin() to authenticated, service_role;
