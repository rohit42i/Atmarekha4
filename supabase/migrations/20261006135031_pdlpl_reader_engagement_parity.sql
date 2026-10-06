-- PDPKL reader parity: public aggregates plus account-scoped engagement, comments and progress.
create table if not exists public.pdlpl_chapter_engagement_summary (
  chapter_id uuid primary key references public.pal_do_pal_ke_lamhe_chapters(id) on delete cascade,
  views_count integer not null default 0 check (views_count >= 0),
  likes_count integer not null default 0 check (likes_count >= 0),
  ratings_count integer not null default 0 check (ratings_count >= 0),
  ratings_sum integer not null default 0 check (ratings_sum >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  pages_count integer not null default 0 check (pages_count >= 0),
  shares_count integer not null default 0 check (shares_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.pdlpl_comments (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.pal_do_pal_ke_lamhe_chapters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Reader',
  content text not null check (char_length(trim(content)) between 1 and 2000),
  parent_comment_id uuid references public.pdlpl_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pdlpl_comments_chapter_created_idx on public.pdlpl_comments(chapter_id, created_at);

create table if not exists public.pdlpl_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.pdlpl_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) between 16 and 128),
  created_at timestamptz not null default now(),
  unique(comment_id, user_id)
);

create table if not exists public.pdlpl_comment_like_counts (
  comment_id uuid primary key references public.pdlpl_comments(id) on delete cascade,
  like_count integer not null default 0 check (like_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.pdlpl_comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.pdlpl_comments(id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) between 16 and 128),
  reason text,
  status text not null default 'open' check (status in ('open','reviewed','resolved')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  unique(comment_id, viewer_key)
);

create table if not exists public.pdlpl_chapter_ratings (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.pal_do_pal_ke_lamhe_chapters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  unique(user_id, chapter_id)
);

create table if not exists public.pdlpl_chapter_views (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.pal_do_pal_ke_lamhe_chapters(id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) between 16 and 128),
  created_at timestamptz not null default now(),
  unique(chapter_id, viewer_key)
);

create table if not exists public.pdlpl_chapter_likes (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.pal_do_pal_ke_lamhe_chapters(id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) between 16 and 128),
  created_at timestamptz not null default now(),
  unique(chapter_id, viewer_key)
);

create table if not exists public.pdlpl_chapter_shares (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.pal_do_pal_ke_lamhe_chapters(id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) between 16 and 128),
  created_at timestamptz not null default now(),
  unique(chapter_id, viewer_key)
);

create table if not exists public.pdlpl_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.pal_do_pal_ke_lamhe_chapters(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, chapter_id)
);

create table if not exists public.pdlpl_reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.pal_do_pal_ke_lamhe_chapters(id) on delete cascade,
  page_number integer not null default 1 check (page_number >= 1),
  updated_at timestamptz not null default now(),
  unique(user_id, chapter_id)
);
create index if not exists pdlpl_reading_history_user_updated_idx on public.pdlpl_reading_history(user_id, updated_at desc);

alter table public.pdlpl_chapter_engagement_summary enable row level security;
alter table public.pdlpl_comments enable row level security;
alter table public.pdlpl_comment_likes enable row level security;
alter table public.pdlpl_comment_like_counts enable row level security;
alter table public.pdlpl_comment_reports enable row level security;
alter table public.pdlpl_chapter_ratings enable row level security;
alter table public.pdlpl_chapter_views enable row level security;
alter table public.pdlpl_chapter_likes enable row level security;
alter table public.pdlpl_chapter_shares enable row level security;
alter table public.pdlpl_bookmarks enable row level security;
alter table public.pdlpl_reading_history enable row level security;

revoke all on table public.pdlpl_chapter_engagement_summary from anon, authenticated;
grant select on table public.pdlpl_chapter_engagement_summary to anon, authenticated;
drop policy if exists pdlpl_public_read_engagement on public.pdlpl_chapter_engagement_summary;
create policy pdlpl_public_read_engagement on public.pdlpl_chapter_engagement_summary for select to anon, authenticated using (true);

revoke all on table public.pdlpl_comments from anon, authenticated;
grant select, insert, update, delete on table public.pdlpl_comments to authenticated;
drop policy if exists pdlpl_public_read_comments on public.pdlpl_comments;
create policy pdlpl_public_read_comments on public.pdlpl_comments for select to anon, authenticated using (true);
drop policy if exists pdlpl_users_insert_comments on public.pdlpl_comments;
create policy pdlpl_users_insert_comments on public.pdlpl_comments for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists pdlpl_users_update_comments on public.pdlpl_comments;
create policy pdlpl_users_update_comments on public.pdlpl_comments for update to authenticated using ((select auth.uid()) = user_id or private.is_admin()) with check ((select auth.uid()) = user_id or private.is_admin());
drop policy if exists pdlpl_users_delete_comments on public.pdlpl_comments;
create policy pdlpl_users_delete_comments on public.pdlpl_comments for delete to authenticated using ((select auth.uid()) = user_id or private.is_admin());

revoke all on table public.pdlpl_comment_likes from anon, authenticated;
grant select, insert, delete on table public.pdlpl_comment_likes to authenticated;
drop policy if exists pdlpl_users_read_comment_likes on public.pdlpl_comment_likes;
create policy pdlpl_users_read_comment_likes on public.pdlpl_comment_likes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists pdlpl_users_insert_comment_likes on public.pdlpl_comment_likes;
create policy pdlpl_users_insert_comment_likes on public.pdlpl_comment_likes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists pdlpl_users_delete_comment_likes on public.pdlpl_comment_likes;
create policy pdlpl_users_delete_comment_likes on public.pdlpl_comment_likes for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.pdlpl_comment_like_counts from anon, authenticated;
grant select on table public.pdlpl_comment_like_counts to anon, authenticated;
drop policy if exists pdlpl_public_read_comment_like_counts on public.pdlpl_comment_like_counts;
create policy pdlpl_public_read_comment_like_counts on public.pdlpl_comment_like_counts for select to anon, authenticated using (true);

revoke all on table public.pdlpl_comment_reports from anon, authenticated;
grant insert on table public.pdlpl_comment_reports to anon, authenticated;
drop policy if exists pdlpl_anyone_report_comments on public.pdlpl_comment_reports;
create policy pdlpl_anyone_report_comments on public.pdlpl_comment_reports for insert to anon, authenticated with check (char_length(viewer_key) between 16 and 128);

revoke all on table public.pdlpl_chapter_ratings from anon, authenticated;
grant select, insert, update on table public.pdlpl_chapter_ratings to authenticated;
drop policy if exists pdlpl_users_read_ratings on public.pdlpl_chapter_ratings;
create policy pdlpl_users_read_ratings on public.pdlpl_chapter_ratings for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists pdlpl_users_write_ratings on public.pdlpl_chapter_ratings;
create policy pdlpl_users_write_ratings on public.pdlpl_chapter_ratings for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists pdlpl_users_update_ratings on public.pdlpl_chapter_ratings;
create policy pdlpl_users_update_ratings on public.pdlpl_chapter_ratings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.pdlpl_chapter_views from public, anon, authenticated;
grant insert on public.pdlpl_chapter_views to anon, authenticated;
drop policy if exists pdlpl_public_insert_views on public.pdlpl_chapter_views;
create policy pdlpl_public_insert_views on public.pdlpl_chapter_views for insert to anon, authenticated with check (char_length(viewer_key) between 16 and 128);

revoke all on table public.pdlpl_chapter_likes from public, anon, authenticated;
grant insert, delete on public.pdlpl_chapter_likes to anon, authenticated;
drop policy if exists pdlpl_public_insert_likes on public.pdlpl_chapter_likes;
create policy pdlpl_public_insert_likes on public.pdlpl_chapter_likes for insert to anon, authenticated with check (char_length(viewer_key) between 16 and 128);
drop policy if exists pdlpl_public_delete_likes on public.pdlpl_chapter_likes;
create policy pdlpl_public_delete_likes on public.pdlpl_chapter_likes for delete to anon, authenticated using (char_length(viewer_key) between 16 and 128);

revoke all on table public.pdlpl_chapter_shares from public, anon, authenticated;
grant insert on public.pdlpl_chapter_shares to anon, authenticated;
drop policy if exists pdlpl_public_insert_shares on public.pdlpl_chapter_shares;
create policy pdlpl_public_insert_shares on public.pdlpl_chapter_shares for insert to anon, authenticated with check (char_length(viewer_key) between 16 and 128);

revoke all on table public.pdlpl_bookmarks from anon, authenticated;
grant select, insert, delete on public.pdlpl_bookmarks to authenticated;
drop policy if exists pdlpl_users_read_bookmarks on public.pdlpl_bookmarks;
create policy pdlpl_users_read_bookmarks on public.pdlpl_bookmarks for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists pdlpl_users_insert_bookmarks on public.pdlpl_bookmarks;
create policy pdlpl_users_insert_bookmarks on public.pdlpl_bookmarks for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists pdlpl_users_delete_bookmarks on public.pdlpl_bookmarks;
create policy pdlpl_users_delete_bookmarks on public.pdlpl_bookmarks for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.pdlpl_reading_history from anon, authenticated;
grant select, insert, update on public.pdlpl_reading_history to authenticated;
drop policy if exists pdlpl_users_read_history on public.pdlpl_reading_history;
create policy pdlpl_users_read_history on public.pdlpl_reading_history for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists pdlpl_users_write_history on public.pdlpl_reading_history;
create policy pdlpl_users_write_history on public.pdlpl_reading_history for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists pdlpl_users_update_history on public.pdlpl_reading_history;
create policy pdlpl_users_update_history on public.pdlpl_reading_history for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function private.sync_pdlpl_engagement_summary()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $function$
begin
  if tg_table_name='pdlpl_chapter_views' then
    if tg_op='INSERT' then
      insert into public.pdlpl_chapter_engagement_summary(chapter_id,views_count,updated_at) values(new.chapter_id,1,now())
      on conflict(chapter_id) do update set views_count=public.pdlpl_chapter_engagement_summary.views_count+1,updated_at=now();
    end if;
    return coalesce(new,old);
  end if;
  if tg_table_name='pdlpl_chapter_likes' then
    if tg_op='INSERT' then
      insert into public.pdlpl_chapter_engagement_summary(chapter_id,likes_count,updated_at) values(new.chapter_id,1,now())
      on conflict(chapter_id) do update set likes_count=public.pdlpl_chapter_engagement_summary.likes_count+1,updated_at=now();
    elsif tg_op='DELETE' then
      update public.pdlpl_chapter_engagement_summary set likes_count=greatest(likes_count-1,0),updated_at=now() where chapter_id=old.chapter_id;
    end if;
    return coalesce(new,old);
  end if;
  if tg_table_name='pdlpl_chapter_shares' then
    if tg_op='INSERT' then
      insert into public.pdlpl_chapter_engagement_summary(chapter_id,shares_count,updated_at) values(new.chapter_id,1,now())
      on conflict(chapter_id) do update set shares_count=public.pdlpl_chapter_engagement_summary.shares_count+1,updated_at=now();
    end if;
    return coalesce(new,old);
  end if;
  if tg_table_name='pdlpl_chapter_ratings' then
    if tg_op='INSERT' then
      insert into public.pdlpl_chapter_engagement_summary(chapter_id,ratings_count,ratings_sum,updated_at) values(new.chapter_id,1,new.rating,now())
      on conflict(chapter_id) do update set ratings_count=public.pdlpl_chapter_engagement_summary.ratings_count+1,ratings_sum=public.pdlpl_chapter_engagement_summary.ratings_sum+new.rating,updated_at=now();
    elsif tg_op='DELETE' then
      update public.pdlpl_chapter_engagement_summary set ratings_count=greatest(ratings_count-1,0),ratings_sum=greatest(ratings_sum-old.rating,0),updated_at=now() where chapter_id=old.chapter_id;
    elsif tg_op='UPDATE' and old.rating is distinct from new.rating then
      update public.pdlpl_chapter_engagement_summary set ratings_sum=greatest(ratings_sum+new.rating-old.rating,0),updated_at=now() where chapter_id=new.chapter_id;
    end if;
    return coalesce(new,old);
  end if;
  if tg_table_name='pdlpl_comments' then
    if tg_op='INSERT' then
      insert into public.pdlpl_chapter_engagement_summary(chapter_id,comments_count,updated_at) values(new.chapter_id,1,now())
      on conflict(chapter_id) do update set comments_count=public.pdlpl_chapter_engagement_summary.comments_count+1,updated_at=now();
    elsif tg_op='DELETE' then
      update public.pdlpl_chapter_engagement_summary set comments_count=greatest(comments_count-1,0),updated_at=now() where chapter_id=old.chapter_id;
    end if;
    return coalesce(new,old);
  end if;
  if tg_table_name='pal_do_pal_ke_lamhe_chapter_pages' then
    if tg_op='INSERT' then
      insert into public.pdlpl_chapter_engagement_summary(chapter_id,pages_count,updated_at) values(new.chapter_id,1,now())
      on conflict(chapter_id) do update set pages_count=public.pdlpl_chapter_engagement_summary.pages_count+1,updated_at=now();
    elsif tg_op='DELETE' then
      update public.pdlpl_chapter_engagement_summary set pages_count=greatest(pages_count-1,0),updated_at=now() where chapter_id=old.chapter_id;
    end if;
    return coalesce(new,old);
  end if;
  return coalesce(new,old);
end;
$function$;

create or replace function private.sync_pdlpl_comment_like_count()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $function$
begin
  if tg_op='INSERT' then
    insert into public.pdlpl_comment_like_counts(comment_id,like_count,updated_at) values(new.comment_id,1,now())
    on conflict(comment_id) do update set like_count=public.pdlpl_comment_like_counts.like_count+1,updated_at=now();
  elsif tg_op='DELETE' then
    update public.pdlpl_comment_like_counts set like_count=greatest(like_count-1,0),updated_at=now() where comment_id=old.comment_id;
  end if;
  return coalesce(new,old);
end;
$function$;

revoke all on function private.sync_pdlpl_engagement_summary() from public,anon,authenticated;
revoke all on function private.sync_pdlpl_comment_like_count() from public,anon,authenticated;

drop trigger if exists pdlpl_views_engagement_summary on public.pdlpl_chapter_views;
create trigger pdlpl_views_engagement_summary after insert or delete on public.pdlpl_chapter_views for each row execute function private.sync_pdlpl_engagement_summary();
drop trigger if exists pdlpl_likes_engagement_summary on public.pdlpl_chapter_likes;
create trigger pdlpl_likes_engagement_summary after insert or delete on public.pdlpl_chapter_likes for each row execute function private.sync_pdlpl_engagement_summary();
drop trigger if exists pdlpl_shares_engagement_summary on public.pdlpl_chapter_shares;
create trigger pdlpl_shares_engagement_summary after insert or delete on public.pdlpl_chapter_shares for each row execute function private.sync_pdlpl_engagement_summary();
drop trigger if exists pdlpl_ratings_engagement_summary on public.pdlpl_chapter_ratings;
create trigger pdlpl_ratings_engagement_summary after insert or update or delete on public.pdlpl_chapter_ratings for each row execute function private.sync_pdlpl_engagement_summary();
drop trigger if exists pdlpl_comments_engagement_summary on public.pdlpl_comments;
create trigger pdlpl_comments_engagement_summary after insert or delete on public.pdlpl_comments for each row execute function private.sync_pdlpl_engagement_summary();
drop trigger if exists pdlpl_pages_engagement_summary on public.pal_do_pal_ke_lamhe_chapter_pages;
create trigger pdlpl_pages_engagement_summary after insert or delete on public.pal_do_pal_ke_lamhe_chapter_pages for each row execute function private.sync_pdlpl_engagement_summary();
drop trigger if exists pdlpl_comment_likes_count on public.pdlpl_comment_likes;
create trigger pdlpl_comment_likes_count after insert or delete on public.pdlpl_comment_likes for each row execute function private.sync_pdlpl_comment_like_count();

create or replace function private.cleanup_pdlpl_engagement_summary()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $function$
begin delete from public.pdlpl_chapter_engagement_summary where chapter_id=old.id; return old; end;
$function$;
revoke all on function private.cleanup_pdlpl_engagement_summary() from public,anon,authenticated;
drop trigger if exists pdlpl_chapter_cleanup_summary on public.pal_do_pal_ke_lamhe_chapters;
create trigger pdlpl_chapter_cleanup_summary after delete on public.pal_do_pal_ke_lamhe_chapters for each row execute function private.cleanup_pdlpl_engagement_summary();

insert into public.pdlpl_chapter_engagement_summary(chapter_id,pages_count)
select c.id,count(p.id)::int from public.pal_do_pal_ke_lamhe_chapters c left join public.pal_do_pal_ke_lamhe_chapter_pages p on p.chapter_id=c.id
group by c.id on conflict(chapter_id) do update set pages_count=excluded.pages_count,updated_at=now();

insert into public.pdlpl_comment_like_counts(comment_id,like_count)
select comment_id,count(*)::int from public.pdlpl_comment_likes group by comment_id
on conflict(comment_id) do update set like_count=excluded.like_count,updated_at=now();

create or replace function public.set_pdlpl_comment_updated_at()
returns trigger language plpgsql as $function$ begin new.updated_at=now(); return new; end; $function$;
drop trigger if exists pdlpl_comments_updated_at on public.pdlpl_comments;
create trigger pdlpl_comments_updated_at before update on public.pdlpl_comments for each row execute function public.set_pdlpl_comment_updated_at();

create or replace function public.set_pdlpl_reading_history_updated_at()
returns trigger language plpgsql as $function$ begin new.updated_at=now(); return new; end; $function$;
drop trigger if exists pdlpl_history_updated_at on public.pdlpl_reading_history;
create trigger pdlpl_history_updated_at before update on public.pdlpl_reading_history for each row execute function public.set_pdlpl_reading_history_updated_at();
