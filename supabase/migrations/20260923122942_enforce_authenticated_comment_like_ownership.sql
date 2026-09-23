-- Make comment likes attributable to authenticated users so delete ownership can be enforced by RLS.
alter table public.comment_likes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "Public can add comment likes" on public.comment_likes;
drop policy if exists "Public can remove own viewer comment like" on public.comment_likes;
create policy "Authenticated users can add own comment likes"
on public.comment_likes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and char_length(viewer_key) between 16 and 128
);

create policy "Authenticated users can remove own comment likes"
on public.comment_likes
for delete to authenticated
using (user_id = (select auth.uid()));
