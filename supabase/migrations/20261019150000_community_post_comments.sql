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

