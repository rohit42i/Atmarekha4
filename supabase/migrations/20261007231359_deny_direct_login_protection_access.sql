drop policy if exists "deny direct access to login protection" on public.login_password_protection;

create policy "deny direct access to login protection"
on public.login_password_protection
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
