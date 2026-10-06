-- PDPKL Chapter 1+ is membership-only, and only Supporter/Premium plans include PDPKL.
-- Keep admin access intact while requiring the chapter itself to be published for members.
drop policy if exists pdlpl_member_read_pages on public.pal_do_pal_ke_lamhe_chapter_pages;

create policy pdlpl_member_read_pages
on public.pal_do_pal_ke_lamhe_chapter_pages
for select
to authenticated
using (
  private.is_admin()
  or (
    exists (
      select 1
      from public.pal_do_pal_ke_lamhe_chapters chapter
      where chapter.id = pal_do_pal_ke_lamhe_chapter_pages.chapter_id
        and lower(coalesce(chapter.status, '')) = 'published'
    )
    and exists (
      select 1
      from public.user_subscriptions us
      where us.user_id = (select auth.uid())
        and us.plan_id in ('supporter', 'premium')
        and (
          (us.status = 'active' and (us.current_period_end is null or us.current_period_end > now()))
          or
          (us.status = 'cancelled' and us.current_period_end is not null and us.current_period_end > now())
        )
    )
  )
);