create table if not exists public.notification_event_dispatches (
  id bigint generated always as identity primary key,
  event_type text not null,
  event_id text not null,
  sender_user_id uuid,
  status text not null default 'sending',
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (event_type, event_id)
);
alter table public.notification_event_dispatches enable row level security;
revoke all on public.notification_event_dispatches from anon, authenticated;
grant all on public.notification_event_dispatches to service_role;
