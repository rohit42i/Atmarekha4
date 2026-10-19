-- Allow the existing comment sheet to support creator community posts.
-- Existing chapter and announcement comments are preserved.
alter table public.comments
  add column if not exists community_post_id uuid;

alter table public.comments
  drop constraint if exists comments_community_post_id_fkey;

alter table public.comments
  add constraint comments_community_post_id_fkey
  foreign key (community_post_id) references public.community_posts(id) on delete cascade;

create index if not exists comments_community_post_id_created_at_idx
  on public.comments (community_post_id, created_at);


-- New comments must target exactly one chapter, announcement, or community post.
-- Use a trigger rather than a table CHECK to leave existing legacy rows untouched.
create or replace function public.validate_comment_destination()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (case when new.chapter_id is not null then 1 else 0 end
    + case when new.announcement_id is not null then 1 else 0 end
    + case when new.community_post_id is not null then 1 else 0 end) <> 1 then
    raise exception 'A comment must belong to exactly one chapter, announcement, or community post.';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_comment_destination() from public, anon, authenticated;
drop trigger if exists comments_validate_destination on public.comments;
create trigger comments_validate_destination
before insert on public.comments
for each row execute function public.validate_comment_destination();
