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

  return coalesce(new, old);
end;
$function$;