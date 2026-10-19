-- Durable privacy controls used by Privacy Center and the data-rights Edge Function.
-- Safe to apply more than once; no existing reader content is modified.
create table if not exists public.dpdp_consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  policy_version text not null,
  purposes text[] not null default '{}',
  consented_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  source text not null default 'signup',
  created_at timestamptz not null default now(),
  unique (user_id, policy_version)
);

create table if not exists public.dpdp_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'resolved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text
);

create unique index if not exists dpdp_one_open_deletion_request_per_user
  on public.dpdp_deletion_requests (user_id)
  where user_id is not null and status in ('pending', 'processing');

create table if not exists public.dpdp_nominations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nominee_name text not null,
  nominee_email text,
  nominee_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dpdp_consent_records enable row level security;
alter table public.dpdp_deletion_requests enable row level security;
alter table public.dpdp_nominations enable row level security;

drop policy if exists "Readers can view own consent records" on public.dpdp_consent_records;
create policy "Readers can view own consent records"
  on public.dpdp_consent_records for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Readers can view own deletion requests" on public.dpdp_deletion_requests;
create policy "Readers can view own deletion requests"
  on public.dpdp_deletion_requests for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Readers can view own nomination" on public.dpdp_nominations;
create policy "Readers can view own nomination"
  on public.dpdp_nominations for select to authenticated
  using (user_id = (select auth.uid()));

-- Consent metadata is captured when Supabase creates the auth user, including
-- signups that require email confirmation and therefore have no active session.
create or replace function public.record_dpdp_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  consent_version text;
  consent_purposes text[];
begin
  consent_version := nullif(trim(coalesce(new.raw_user_meta_data ->> 'dpdp_privacy_consent_version', '')), '');
  if consent_version is null then
    return new;
  end if;

  consent_purposes := string_to_array(
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'dpdp_consent_purposes', '')), ''),
    ','
  );

  insert into public.dpdp_consent_records (user_id, policy_version, purposes, source)
  values (new.id, consent_version, coalesce(consent_purposes, '{}'), 'signup')
  on conflict (user_id, policy_version) do update
    set purposes = excluded.purposes,
        consented_at = now(),
        withdrawn_at = null,
        source = 'signup';

  return new;
end;
$$;

revoke all on function public.record_dpdp_signup_consent() from public, anon, authenticated;
drop trigger if exists auth_user_record_dpdp_signup_consent on auth.users;
create trigger auth_user_record_dpdp_signup_consent
  after insert on auth.users
  for each row execute function public.record_dpdp_signup_consent();
