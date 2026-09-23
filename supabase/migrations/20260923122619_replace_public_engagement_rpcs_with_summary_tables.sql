-- Replace public SECURITY DEFINER aggregate RPCs with read-only summary tables maintained by private trigger functions.
drop function if exists public.get_public_chapter_stats(uuid[]);
drop function if exists public.get_public_comment_like_summary(uuid[], text);

create table if not exists public.chapter_engagement_summary (
  chapter_id uuid primary key,
  views_count integer not null default 0 check (views_count >= 0),
  likes_count integer not null default 0 check (likes_count >= 0),
  ratings_count integer not null default 0 check (ratings_count >= 0),
  ratings_sum integer not null default 0 check (ratings_sum >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  pages_count integer not null default 0 check (pages_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.chapter_engagement_summary enable row level security;
revoke all on table public.chapter_engagement_summary from anon, authenticated;
grant select on table public.chapter_engagement_summary to anon, authenticated;
drop policy if exists "Public can read chapter engagement summary" on public.chapter_engagement_summary;
create policy "Public can read chapter engagement summary"
on public.chapter_engagement_summary
for select to anon, authenticated
using (true);

create table if not exists public.comment_like_counts (
  comment_id uuid primary key,
  like_count integer not null default 0 check (like_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.comment_like_counts enable row level security;
revoke all on table public.comment_like_counts from anon, authenticated;
grant select on table public.comment_like_counts to anon, authenticated;
drop policy if exists "Public can read comment like counts" on public.comment_like_counts;
create policy "Public can read comment like counts"
on public.comment_like_counts
for select to anon, authenticated
using (true);

create or replace function private.sync_engagement_summary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  if tg_table_name = 'chapter_views' then
    if tg_op = 'INSERT' then
      insert into public.chapter_engagement_summary(chapter_id, views_count, updated_at)
      values (new.chapter_id, 1, now())
      on conflict (chapter_id) do update set views_count = public.chapter_engagement_summary.views_count + 1, updated_at = now();
    elsif tg_op = 'DELETE' then
      update public.chapter_engagement_summary
      set views_count = greatest(views_count - 1, 0), updated_at = now()
      where chapter_id = old.chapter_id;
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'chapter_likes' then
    if tg_op = 'INSERT' then
      insert into public.chapter_engagement_summary(chapter_id, likes_count, updated_at)
      values (new.chapter_id, 1, now())
      on conflict (chapter_id) do update set likes_count = public.chapter_engagement_summary.likes_count + 1, updated_at = now();
    elsif tg_op = 'DELETE' then
      update public.chapter_engagement_summary
      set likes_count = greatest(likes_count - 1, 0), updated_at = now()
      where chapter_id = old.chapter_id;
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'chapter_ratings' then
    if tg_op = 'INSERT' then
      insert into public.chapter_engagement_summary(chapter_id, ratings_count, ratings_sum, updated_at)
      values (new.chapter_id, 1, new.rating, now())
      on conflict (chapter_id) do update set ratings_count = public.chapter_engagement_summary.ratings_count + 1, ratings_sum = public.chapter_engagement_summary.ratings_sum + new.rating, updated_at = now();
    elsif tg_op = 'DELETE' then
      update public.chapter_engagement_summary
      set ratings_count = greatest(ratings_count - 1, 0), ratings_sum = greatest(ratings_sum - old.rating, 0), updated_at = now()
      where chapter_id = old.chapter_id;
    elsif tg_op = 'UPDATE' then
      if old.chapter_id is distinct from new.chapter_id then
        update public.chapter_engagement_summary
        set ratings_count = greatest(ratings_count - 1, 0), ratings_sum = greatest(ratings_sum - old.rating, 0), updated_at = now()
        where chapter_id = old.chapter_id;
        insert into public.chapter_engagement_summary(chapter_id, ratings_count, ratings_sum, updated_at)
        values (new.chapter_id, 1, new.rating, now())
        on conflict (chapter_id) do update set ratings_count = public.chapter_engagement_summary.ratings_count + 1, ratings_sum = public.chapter_engagement_summary.ratings_sum + new.rating, updated_at = now();
      elsif old.rating is distinct from new.rating then
        update public.chapter_engagement_summary
        set ratings_sum = greatest(ratings_sum + new.rating - old.rating, 0), updated_at = now()
        where chapter_id = new.chapter_id;
      end if;
    end if;
    return new;
  end if;

  if tg_table_name = 'comments' then
    if tg_op = 'INSERT' then
      insert into public.chapter_engagement_summary(chapter_id, comments_count, updated_at)
      values (new.chapter_id, 1, now())
      on conflict (chapter_id) do update set comments_count = public.chapter_engagement_summary.comments_count + 1, updated_at = now();
    elsif tg_op = 'DELETE' then
      update public.chapter_engagement_summary
      set comments_count = greatest(comments_count - 1, 0), updated_at = now()
      where chapter_id = old.chapter_id;
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'chapter_pages' then
    if tg_op = 'INSERT' then
      insert into public.chapter_engagement_summary(chapter_id, pages_count, updated_at)
      values (new.chapter_id, 1, now())
      on conflict (chapter_id) do update set pages_count = public.chapter_engagement_summary.pages_count + 1, updated_at = now();
    elsif tg_op = 'DELETE' then
      update public.chapter_engagement_summary
      set pages_count = greatest(pages_count - 1, 0), updated_at = now()
      where chapter_id = old.chapter_id;
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'comment_likes' then
    if tg_op = 'INSERT' then
      insert into public.comment_like_counts(comment_id, like_count, updated_at)
      values (new.comment_id, 1, now())
      on conflict (comment_id) do update set like_count = public.comment_like_counts.like_count + 1, updated_at = now();
    elsif tg_op = 'DELETE' then
      update public.comment_like_counts
      set like_count = greatest(like_count - 1, 0), updated_at = now()
      where comment_id = old.comment_id;
    end if;
    return coalesce(new, old);
  end if;

  return coalesce(new, old);
end;
$function$;

revoke all on function private.sync_engagement_summary() from public, anon, authenticated;

create or replace function private.cleanup_chapter_engagement_summary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  delete from public.chapter_engagement_summary where chapter_id = old.id;
  return old;
end;
$function$;

revoke all on function private.cleanup_chapter_engagement_summary() from public, anon, authenticated;

create or replace function private.cleanup_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  delete from public.comment_like_counts where comment_id = old.id;
  return old;
end;
$function$;

revoke all on function private.cleanup_comment_like_count() from public, anon, authenticated;

drop trigger if exists chapter_views_engagement_summary on public.chapter_views;
create trigger chapter_views_engagement_summary
after insert or delete on public.chapter_views
for each row execute function private.sync_engagement_summary();

drop trigger if exists chapter_likes_engagement_summary on public.chapter_likes;
create trigger chapter_likes_engagement_summary
after insert or delete on public.chapter_likes
for each row execute function private.sync_engagement_summary();

drop trigger if exists chapter_ratings_engagement_summary on public.chapter_ratings;
create trigger chapter_ratings_engagement_summary
after insert or update or delete on public.chapter_ratings
for each row execute function private.sync_engagement_summary();

drop trigger if exists comments_engagement_summary on public.comments;
create trigger comments_engagement_summary
after insert or delete on public.comments
for each row execute function private.sync_engagement_summary();

drop trigger if exists chapter_pages_engagement_summary on public.chapter_pages;
create trigger chapter_pages_engagement_summary
after insert or delete on public.chapter_pages
for each row execute function private.sync_engagement_summary();

drop trigger if exists comment_likes_count_summary on public.comment_likes;
create trigger comment_likes_count_summary
after insert or delete on public.comment_likes
for each row execute function private.sync_engagement_summary();

drop trigger if exists chapters_cleanup_engagement_summary on public.chapters;
create trigger chapters_cleanup_engagement_summary
after delete on public.chapters
for each row execute function private.cleanup_chapter_engagement_summary();

drop trigger if exists comments_cleanup_like_count on public.comments;
create trigger comments_cleanup_like_count
after delete on public.comments
for each row execute function private.cleanup_comment_like_count();

truncate table public.chapter_engagement_summary;
insert into public.chapter_engagement_summary (
  chapter_id, views_count, likes_count, ratings_count, ratings_sum, comments_count, pages_count, updated_at
)
select
  c.id,
  (select count(*) from public.chapter_views v where v.chapter_id = c.id),
  (select count(*) from public.chapter_likes l where l.chapter_id = c.id),
  (select count(*) from public.chapter_ratings r where r.chapter_id = c.id),
  coalesce((select sum(r.rating) from public.chapter_ratings r where r.chapter_id = c.id), 0),
  (select count(*) from public.comments cm where cm.chapter_id = c.id),
  (select count(*) from public.chapter_pages p where p.chapter_id = c.id),
  now()
from public.chapters c;

truncate table public.comment_like_counts;
insert into public.comment_like_counts (comment_id, like_count, updated_at)
select comment_id, count(*)::int, now()
from public.comment_likes
group by comment_id;
