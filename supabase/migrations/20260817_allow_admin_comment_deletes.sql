-- Allow verified admins to delete comments from the admin dashboard.
-- Replies and comment reports are removed automatically by the existing
-- ON DELETE CASCADE foreign keys.

drop policy if exists "Readers cannot delete comments" on public.comments;
drop policy if exists "Users can delete own comments" on public.comments;
drop policy if exists "Admins can delete comments" on public.comments;

create policy "Admins can delete comments" on public.comments
  for delete to authenticated
  using (public.is_admin());
