alter table public.comments
  add column if not exists announcement_id uuid;

alter table public.comments
  drop constraint if exists comments_announcement_id_fkey;

alter table public.comments
  add constraint comments_announcement_id_fkey
  foreign key (announcement_id) references public.announcements(id) on delete cascade;

create index if not exists comments_announcement_id_created_at_idx
  on public.comments (announcement_id, created_at);

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
    if tg_op = 'INSERT' and new.chapter_id is not null then
      insert into public.chapter_engagement_summary(chapter_id, comments_count, updated_at)
      values (new.chapter_id, 1, now())
      on conflict (chapter_id) do update set comments_count = public.chapter_engagement_summary.comments_count + 1, updated_at = now();
    elsif tg_op = 'DELETE' and old.chapter_id is not null then
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
