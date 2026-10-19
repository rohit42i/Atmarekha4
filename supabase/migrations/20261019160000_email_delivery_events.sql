-- Resend event history for actual email delivery, bounce, complaint and failure tracking.
create table if not exists public.email_delivery_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  email_id text,
  event_type text not null,
  recipient text,
  subject text,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_delivery_events_occurred_at_idx
  on public.email_delivery_events (occurred_at desc);
create index if not exists email_delivery_events_email_id_idx
  on public.email_delivery_events (email_id);

alter table public.email_delivery_events enable row level security;
drop policy if exists "Admins can view email delivery events" on public.email_delivery_events;
create policy "Admins can view email delivery events" on public.email_delivery_events
  for select to authenticated using (
    exists (
      select 1 from public.admins a
      where a.user_id = auth.uid()
        and lower(coalesce(a.role, '')) in ('owner', 'admin')
    )
  );

revoke all on public.email_delivery_events from anon;
revoke insert, update, delete, truncate, references, trigger on public.email_delivery_events from authenticated;
grant select on public.email_delivery_events to authenticated;
grant all on public.email_delivery_events to service_role;
