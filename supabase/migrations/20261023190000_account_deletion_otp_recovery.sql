-- Account deletion verification and recovery workflow.
-- Pending verification records never delete or disable an account by themselves.
alter table public.dpdp_deletion_requests
  add column if not exists requested_period text,
  add column if not exists scheduled_delete_at timestamptz,
  add column if not exists recovery_until timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.dpdp_deletion_requests
  drop constraint if exists dpdp_deletion_requests_requested_period_check;
alter table public.dpdp_deletion_requests
  add constraint dpdp_deletion_requests_requested_period_check
  check (requested_period is null or requested_period in ('7_days','30_days','90_days','permanent'));

create table if not exists public.account_deletion_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_period text not null check (requested_period in ('7_days','30_days','90_days','permanent')),
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 10),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_deletion_verifications_user_created_idx
  on public.account_deletion_verifications (user_id, created_at desc);

alter table public.account_deletion_verifications enable row level security;
revoke all on public.account_deletion_verifications from anon, authenticated;
grant all on public.account_deletion_verifications to service_role;

revoke insert, update, delete on public.dpdp_deletion_requests from anon, authenticated;
