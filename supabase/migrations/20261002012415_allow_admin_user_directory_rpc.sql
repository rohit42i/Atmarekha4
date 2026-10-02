-- Allow authenticated admins to call the server-side user directory.
-- The function itself enforces the caller's admin membership before returning data.
revoke all on function public.get_admin_user_directory() from anon;
grant execute on function public.get_admin_user_directory() to authenticated;
