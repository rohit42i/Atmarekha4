-- Fix public chapter-page reads without weakening paid-chapter access.
-- Anonymous readers must not evaluate admin-only functions or subscription tables.
drop policy if exists "Chapter pages readable by entitled readers or admins" on public.chapter_pages;
drop policy if exists "Chapters readable by public or admins" on public.chapters;

create policy "Public can read published chapters"
on public.chapters
for select
to anon
using (lower(coalesce(status, '')) = 'published');

create policy "Signed-in readers can read published chapters"
on public.chapters
for select
to authenticated
using (
  lower(coalesce(status, '')) = 'published'
  or private.is_admin()
);

create policy "Public can read free published chapter pages"
on public.chapter_pages
for select
to anon
using (
  exists (
    select 1
    from public.chapters c
    where c.id = chapter_pages.chapter_id
      and lower(coalesce(c.status, '')) = 'published'
      and (c.chapter_number is null or c.chapter_number <= 8)
  )
);

create policy "Signed-in readers can read entitled chapter pages"
on public.chapter_pages
for select
to authenticated
using (
  exists (
    select 1
    from public.chapters c
    where c.id = chapter_pages.chapter_id
      and lower(coalesce(c.status, '')) = 'published'
      and (
        c.chapter_number is null
        or c.chapter_number <= 8
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
      )
  )
  or private.is_admin()
);