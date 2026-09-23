-- Admin analytics, moderation workflow, and safe reporting metadata.
alter table public.comment_reports
  add column if not exists status text not null default 'open',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id);

update public.comment_reports
set status = 'open'
where status is null or trim(status) = '';

alter table public.comment_reports
  drop constraint if exists comment_reports_status_check;

alter table public.comment_reports
  add constraint comment_reports_status_check
  check (status in ('open','reviewed','resolved'));

create index if not exists comment_reports_status_created_idx
  on public.comment_reports (status, created_at desc);

drop policy if exists "Admins can update comment reports" on public.comment_reports;
create policy "Admins can update comment reports"
on public.comment_reports
for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create or replace function public.get_admin_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_cutoff timestamptz;
  v_previous_start timestamptz;
  v_result jsonb;
begin
  if v_uid is null or not exists (
    select 1 from public.admins where user_id = v_uid
  ) then
    raise exception 'Admin access required';
  end if;

  if p_days is not null and p_days not in (1, 7, 30, 90) then
    raise exception 'Analytics period must be 1, 7, 30, 90, or null';
  end if;

  v_cutoff := case when p_days is null then null else now() - make_interval(days => p_days) end;
  v_previous_start := case when p_days is null then null else v_cutoff - make_interval(days => p_days) end;

  select jsonb_build_object(
    'total_views', (select count(*) from public.chapter_views),
    'total_likes', (select count(*) from public.chapter_likes),
    'total_ratings', (select count(*) from public.chapter_ratings),
    'total_comments', (select count(*) from public.comments),
    'current_views', case when p_days is null then (select count(*) from public.chapter_views) else (select count(*) from public.chapter_views where created_at >= v_cutoff) end,
    'previous_views', case when p_days is null then 0 else (select count(*) from public.chapter_views where created_at >= v_previous_start and created_at < v_cutoff) end,
    'current_likes', case when p_days is null then (select count(*) from public.chapter_likes) else (select count(*) from public.chapter_likes where created_at >= v_cutoff) end,
    'previous_likes', case when p_days is null then 0 else (select count(*) from public.chapter_likes where created_at >= v_previous_start and created_at < v_cutoff) end,
    'current_comments', case when p_days is null then (select count(*) from public.comments) else (select count(*) from public.comments where created_at >= v_cutoff) end,
    'previous_comments', case when p_days is null then 0 else (select count(*) from public.comments where created_at >= v_previous_start and created_at < v_cutoff) end,
    'current_ratings', case when p_days is null then (select count(*) from public.chapter_ratings) else (select count(*) from public.chapter_ratings where created_at >= v_cutoff) end,
    'previous_ratings', case when p_days is null then 0 else (select count(*) from public.chapter_ratings where created_at >= v_previous_start and created_at < v_cutoff) end,
    'rating_sum', coalesce((select sum(rating) from public.chapter_ratings), 0),
    'rating_counts', coalesce((
      select jsonb_agg(jsonb_build_object('rating', x.rating, 'count', x.cnt) order by x.rating desc)
      from (
        select r.rating, count(*) as cnt
        from public.chapter_ratings r
        group by r.rating
      ) x
    ), '[]'::jsonb),
    'released', case when p_days is null
      then (select count(*) from public.chapters where lower(coalesce(status,''))='published')
      else (select count(*) from public.chapters where lower(coalesce(status,''))='published' and release_date >= v_cutoff)
    end,
    'bookmarks', (select count(*) from public.bookmarks),
    'active_readers', (select count(distinct viewer_key) from public.chapter_views where viewer_key is not null and created_at >= now() - interval '30 days'),
    'returning_readers', (select count(*) from (
      select viewer_key
      from public.chapter_views
      where viewer_key is not null
        and created_at >= now() - interval '30 days'
      group by viewer_key
      having count(distinct (created_at at time zone 'UTC')::date) >= 2
    ) returning_users),
    'chapter_stats', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.views desc, x.chapter_number nulls last)
      from (
        select
          c.id,
          c.chapter_number,
          c.title,
          c.status,
          c.release_date as "releaseDate",
          (select count(*) from public.chapter_views v where v.chapter_id=c.id) as views,
          (select count(*) from public.chapter_likes l where l.chapter_id=c.id) as likes,
          (select count(*) from public.chapter_ratings r where r.chapter_id=c.id) as rating_count,
          coalesce((select avg(r.rating)::numeric from public.chapter_ratings r where r.chapter_id=c.id),0) as rating_average,
          case when p_days is null then
            (select count(*) from public.chapter_views v where v.chapter_id=c.id)
          else
            (select count(*) from public.chapter_views v where v.chapter_id=c.id and v.created_at >= v_cutoff)
          end as period_views,
          case when p_days is null then
            (select count(*) from public.chapter_likes l where l.chapter_id=c.id)
          else
            (select count(*) from public.chapter_likes l where l.chapter_id=c.id and l.created_at >= v_cutoff)
          end as period_likes,
          (select count(*) from public.chapter_pages p where p.chapter_id=c.id) as pages
        from public.chapters c
        where lower(coalesce(c.status,''))='published'
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

revoke execute on function public.get_admin_analytics(integer) from public, anon;
grant execute on function public.get_admin_analytics(integer) to authenticated;
