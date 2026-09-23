-- Restore admin dashboard data access without changing public reader access.
alter function public.get_admin_analytics(integer)
  security definer
  set search_path = public;

drop policy if exists "Admins can read all chapter pages" on public.chapter_pages;
create policy "Admins can read all chapter pages"
on public.chapter_pages
for select
to authenticated
using (private.is_admin());

revoke execute on function public.get_admin_analytics(integer) from public, anon;
grant execute on function public.get_admin_analytics(integer) to authenticated;
