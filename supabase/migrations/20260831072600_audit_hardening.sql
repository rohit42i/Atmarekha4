-- Atma Rekha audit hardening applied to production on 2026-08-31.
-- Keeps public badge access safe while reducing RLS work and duplicate policies.

create index if not exists moderation_reports_user_id_idx on public.moderation_reports(user_id);

alter policy "Readers can read free or member chapters" on public.chapter_pages
  using (exists (
    select 1 from public.chapters c
    where c.id = chapter_pages.chapter_id
      and (
        c.chapter_number <= 5
        or exists (
          select 1 from public.user_subscriptions us
          where us.user_id = (select auth.uid())
            and us.plan_id <> 'free'
            and us.status = any (array['active','cancelled'])
            and us.current_period_end is not null
            and us.current_period_end > now()
        )
      )
  ));

alter policy "Users can insert their own reactions" on public.community_post_reactions
  with check ((select auth.uid()) = user_id);

alter policy "current members read published member content" on public.member_content
  using (
    is_published = true
    and exists (
      select 1 from public.user_subscriptions us
      where us.user_id = (select auth.uid())
        and us.plan_id <> 'free'
        and us.status = any (array['active','cancelled'])
        and (us.current_period_end is null or us.current_period_end > now())
    )
  );

alter policy "current members send private messages" on public.member_messages
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_subscriptions us
      where us.user_id = (select auth.uid())
        and us.plan_id <> 'free'
        and us.status = any (array['active','cancelled'])
        and (us.current_period_end is null or us.current_period_end > now())
    )
  );

alter policy "current members read own messages" on public.member_messages
  using (user_id = (select auth.uid()));

drop policy if exists "Public can read ratings with viewer key" on public.chapter_ratings;
drop policy if exists "Users can create own comments" on public.comments;
drop policy if exists "Public can read comments" on public.comments;
drop policy if exists "Users can insert their own reactions" on public.community_post_reactions;

alter policy "admins can manage member content" on public.member_content
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter policy "admins manage member messages" on public.member_messages
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.get_current_memberships(target_user_ids uuid[])
returns table(user_id uuid, plan_id text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (us.user_id) us.user_id, us.plan_id
  from public.user_subscriptions us
  where us.user_id = any(target_user_ids)
    and (us.user_id = (select auth.uid()) or exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
    and us.status in ('active', 'cancelled')
    and (us.current_period_end is null or us.current_period_end > now())
  order by us.user_id,
    case us.plan_id when 'premium' then 3 when 'supporter' then 2 when 'mini_member' then 1 else 0 end desc,
    us.current_period_end desc nulls first;
$$;

create or replace function public.get_currently_subscribed_user_ids(target_user_ids uuid[])
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select us.user_id
  from public.user_subscriptions us
  where us.user_id = any(target_user_ids)
    and (us.user_id = (select auth.uid()) or exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
    and us.status = 'active'
    and (us.current_period_end is null or us.current_period_end > now())
  group by us.user_id;
$$;
