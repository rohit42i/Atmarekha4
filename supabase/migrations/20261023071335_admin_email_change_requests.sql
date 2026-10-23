-- Tracked email-change requests with server-only administrative action history.
create table if not exists public.email_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  current_email text not null,
  requested_email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'superseded', 'cancelled')),
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  closed_at timestamptz,
  last_admin_resend_at timestamptz,
  last_admin_resend_by uuid references auth.users(id) on delete set null,
  resend_count integer not null default 0 check (resend_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists email_change_requests_requested_at_idx
  on public.email_change_requests (requested_at desc);
create index if not exists email_change_requests_user_status_idx
  on public.email_change_requests (user_id, status);

create table if not exists public.email_change_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.email_change_requests(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_change_request_events_request_created_idx
  on public.email_change_request_events (request_id, created_at desc);

alter table public.email_change_requests enable row level security;
alter table public.email_change_request_events enable row level security;

revoke all on public.email_change_requests from anon, authenticated;
grant select on public.email_change_requests to authenticated;
grant insert (user_id, current_email, requested_email) on public.email_change_requests to authenticated;
grant all on public.email_change_requests to service_role;

drop policy if exists "Readers can view own email change requests" on public.email_change_requests;
create policy "Readers can view own email change requests"
  on public.email_change_requests for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Readers can submit own email change requests" on public.email_change_requests;
create policy "Readers can submit own email change requests"
  on public.email_change_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and lower(current_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
    and lower(current_email) <> lower(requested_email)
  );

revoke all on public.email_change_request_events from anon, authenticated;
grant select on public.email_change_request_events to authenticated;
grant all on public.email_change_request_events to service_role;

drop policy if exists "Admins can view email change request history" on public.email_change_request_events;
create policy "Admins can view email change request history"
  on public.email_change_request_events for select to authenticated
  using (
    exists (
      select 1 from public.admins a
      where a.user_id = (select auth.uid())
        and lower(coalesce(a.role, '')) in ('owner', 'admin')
    )
  );

create or replace function public.log_email_change_request_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.email_change_request_events
    (request_id, user_id, actor_user_id, event_type, details)
  values (
    new.id,
    new.user_id,
    new.user_id,
    'requested',
    jsonb_build_object(
      'current_email', new.current_email,
      'requested_email', new.requested_email
    )
  );
  return new;
end;
$$;

revoke all on function public.log_email_change_request_created() from public, anon, authenticated;
drop trigger if exists email_change_request_created_log on public.email_change_requests;
create trigger email_change_request_created_log
  after insert on public.email_change_requests
  for each row execute function public.log_email_change_request_created();
