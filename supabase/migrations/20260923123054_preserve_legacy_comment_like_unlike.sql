drop policy if exists "Authenticated users can remove own comment likes" on public.comment_likes;
create policy "Authenticated users can remove own comment likes"
on public.comment_likes
for delete to authenticated
using (
  user_id = (select auth.uid())
  or (user_id is null and char_length(viewer_key) between 16 and 128)
);
