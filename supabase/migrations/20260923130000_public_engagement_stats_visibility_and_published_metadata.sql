-- Public-safe engagement statistics: expose aggregates, not raw viewer identifiers.
create or replace function public.get_public_chapter_stats(p_chapter_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '2000ms'
as $function$
  with requested as (
    select distinct id
    from unnest(coalesce(p_chapter_ids, '{}'::uuid[])) as x(id)
    where id is not null
    limit 100
  ),
  ratings as (
    select cr.chapter_id, count(*)::int as cnt, coalesce(avg(cr.rating), 0)::numeric as avg
    from public.chapter_ratings cr
    join requested rq on rq.id = cr.chapter_id
    group by cr.chapter_id
  ),
  views as (
    select cv.chapter_id, count(*)::int as cnt
    from public.chapter_views cv
    join requested rq on rq.id = cv.chapter_id
    group by cv.chapter_id
  ),
  likes as (
    select cl.chapter_id, count(*)::int as cnt
    from public.chapter_likes cl
    join requested rq on rq.id = cl.chapter_id
    group by cl.chapter_id
  ),
  comments as (
    select cm.chapter_id, count(*)::int as cnt
    from public.comments cm
    join requested rq on rq.id = cm.chapter_id
    group by cm.chapter_id
  ),
  pages as (
    select cp.chapter_id, count(*)::int as cnt
    from public.chapter_pages cp
    join requested rq on rq.id = cp.chapter_id
    group by cp.chapter_id
  )
  select coalesce(
    jsonb_object_agg(
      r.id::text,
      jsonb_build_object(
        'rating', jsonb_build_object('average', coalesce(rt.avg, 0), 'count', coalesce(rt.cnt, 0)),
        'views', coalesce(v.cnt, 0),
        'likes', coalesce(l.cnt, 0),
        'comments', coalesce(c.cnt, 0),
        'pages', coalesce(pg.cnt, 0)
      )
    ),
    '{}'::jsonb
  )
  from requested r
  left join ratings rt on rt.chapter_id = r.id
  left join views v on v.chapter_id = r.id
  left join likes l on l.chapter_id = r.id
  left join comments c on c.chapter_id = r.id
  left join pages pg on pg.chapter_id = r.id;
$function$;

revoke all on function public.get_public_chapter_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.get_public_chapter_stats(uuid[]) to anon, authenticated;

create or replace function public.get_public_comment_like_summary(p_comment_ids uuid[], p_viewer_key text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '2000ms'
as $function$
  with requested as (
    select distinct id
    from unnest(coalesce(p_comment_ids, '{}'::uuid[])) as x(id)
    where id is not null
    limit 150
  ),
  counts as (
    select cl.comment_id, count(*)::int as cnt
    from public.comment_likes cl
    join requested rq on rq.id = cl.comment_id
    group by cl.comment_id
  )
  select coalesce(
    jsonb_object_agg(
      r.id::text,
      jsonb_build_object(
        'count', coalesce(c.cnt, 0),
        'liked', case
          when char_length(coalesce(p_viewer_key, '')) between 16 and 128
          then exists (
            select 1
            from public.comment_likes own_like
            where own_like.comment_id = r.id
              and own_like.viewer_key = p_viewer_key
          )
          else false
        end
      )
    ),
    '{}'::jsonb
  )
  from requested r
  left join counts c on c.comment_id = r.id;
$function$;

revoke all on function public.get_public_comment_like_summary(uuid[], text) from public, anon, authenticated;
grant execute on function public.get_public_comment_like_summary(uuid[], text) to anon, authenticated;

drop policy if exists "Public can read chapter views" on public.chapter_views;
drop policy if exists "Public can read chapter likes" on public.chapter_likes;
drop policy if exists "Public can read comment likes" on public.comment_likes;
drop policy if exists "Public can read chapter ratings" on public.chapter_ratings;

drop policy if exists "Authenticated users can read own chapter ratings" on public.chapter_ratings;
create policy "Authenticated users can read own chapter ratings"
on public.chapter_ratings
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Public can remove own viewer comment like" on public.comment_likes;
create policy "Public can remove own viewer comment like"
on public.comment_likes
for delete to anon, authenticated
using (char_length(viewer_key) between 16 and 128);

drop policy if exists "Public can read published chapters" on public.chapters;
drop policy if exists "Anyone can read chapters" on public.chapters;
create policy "Public can read published chapters"
on public.chapters
for select to anon, authenticated
using (lower(coalesce(status, '')) = 'published' or private.is_admin());

drop policy if exists "Anyone can read announcements" on public.announcements;
create policy "Public can read published announcements"
on public.announcements
for select to anon, authenticated
using ((published_at is not null and published_at <= now()) or private.is_admin());
