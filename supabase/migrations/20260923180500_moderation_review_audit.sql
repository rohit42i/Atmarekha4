-- Give automatic moderation reports the same review history as reader reports.
alter table public.moderation_reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id);

alter table public.moderation_reports
  drop constraint if exists moderation_reports_status_check;

alter table public.moderation_reports
  add constraint moderation_reports_status_check
  check (status in ('open','reviewed','resolved'));

create index if not exists moderation_reports_status_created_idx
  on public.moderation_reports (status, created_at desc);

create index if not exists moderation_reports_reviewed_by_idx
  on public.moderation_reports (reviewed_by);

drop policy if exists moderation_reports_admin_update on public.moderation_reports;
create policy moderation_reports_admin_update
on public.moderation_reports
for update to authenticated
using (private.is_admin())
with check (private.is_admin());
