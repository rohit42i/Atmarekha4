-- Keep the login-count RPC unavailable to anonymous users while allowing signed-in
-- readers to call the self-scoped SECURITY DEFINER function through supabase.rpc().
begin;

revoke execute on function public.record_feature_login() from public, anon;
grant execute on function public.record_feature_login() to authenticated, service_role;

comment on function public.record_feature_login() is
  'Records the current authenticated user once for progressive feature unlocks. Uses auth.uid() and accepts no caller-supplied user ID.';

commit;
