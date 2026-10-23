-- Account deletion verification and recovery workflow.
-- Pending verification records never delete or disable an account by themselves.
alter table public.dpdp_deletion_requests
  add column if not exists requested_period text,
  add column if not exists scheduled_delete_at timestamptz,
  add column if not exists recovery_until timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.dpdp_deletion_requests
  drop constraint if exists dpdp_deletion_requests_status_check;
alter table public.dpdp_deletion_requests
  add constraint dpdp_deletion_requests_status_check
  check (status in ('pending', 'processing', 'resolved', 'completed', 'rejected', 'cancelled'));

alter table public.dpdp_deletion_requests
  drop constraint if exists dpdp_deletion_requests_requested_period_check;
alter table public.dpdp_deletion_requests
  add constraint dpdp_deletion_requests_requested_period_check
  check (requested_period is null or requested_period in ('7_days','30_days','90_days','permanent'));

create table if not exists public.account_deletion_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_period text not null check (requested_period in ('7_days','30_days','90_days','permanent')),
  purpose text not null default 'delete' check (purpose in ('delete','reactivate')),
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

create index if not exists dpdp_deletion_due_schedule_idx
  on public.dpdp_deletion_requests (scheduled_delete_at)
  where status = 'pending' and scheduled_delete_at is not null;

create unique index if not exists account_deletion_one_unused_otp_per_user_purpose
  on public.account_deletion_verifications (user_id, purpose)
  where consumed_at is null;


-- Financial and consent audit rows remain for required retention, but they must not
-- retain a direct link to an erased auth account.
alter table public.payments alter column user_id drop not null;
alter table public.subscriptions alter column user_id drop not null;
alter table public.user_subscriptions alter column user_id drop not null;
alter table public.dpdp_consent_records alter column user_id drop not null;
alter table public.pdlpl_comments alter column user_id drop not null;

-- Transactional database erasure. The Edge Function separately handles provider
-- cancellation and Supabase Auth deletion; this function atomically removes or
-- anonymizes the database records before the auth identity is removed.
create or replace function public.erase_due_account_personal_data(
  p_request_id uuid,
  p_admin_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  request_row public.dpdp_deletion_requests%rowtype;
  target_user_id uuid;
  target_email text;
  auth_user_exists boolean := false;
  later_period_end timestamptz;
begin
  select * into request_row
  from public.dpdp_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Deletion request not found.' using errcode = 'P0002';
  end if;

  if request_row.status not in ('pending', 'processing') then
    raise exception 'This deletion request is no longer eligible for processing.' using errcode = '22023';
  end if;

  if request_row.user_id is null then
    if request_row.status = 'processing' then
      return jsonb_build_object(
        'request_id', request_row.id,
        'already_erased', true,
        'auth_user_exists', false
      );
    end if;
    raise exception 'The deletion request no longer has an account to erase.' using errcode = '22023';
  end if;

  target_user_id := request_row.user_id;

  if request_row.scheduled_delete_at is null
     or request_row.scheduled_delete_at > now()
     or request_row.recovery_until is null
     or request_row.recovery_until > now() then
    raise exception 'The deletion schedule or recovery window has not elapsed.' using errcode = '22023';
  end if;

  if p_admin_id is not null and not exists (
    select 1 from public.admins
    where user_id = p_admin_id and lower(trim(role)) in ('owner', 'admin')
  ) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  if exists (select 1 from public.admins where user_id = target_user_id) then
    raise exception 'Admin accounts must be transferred or deactivated through the admin access process before deletion.' using errcode = '42501';
  end if;

  -- Never erase while a recurring Razorpay subscription can still renew.
  if exists (
    select 1 from public.user_subscriptions
    where user_id = target_user_id
      and lower(coalesce(provider, '')) = 'razorpay'
      and lower(status) in ('active', 'authenticated', 'created', 'pending')
      and cancel_at_period_end = false
  ) then
    raise exception 'A recurring Razorpay subscription is not scheduled to cancel. Retry after cancellation is confirmed.' using errcode = '55000';
  end if;

  select max(current_period_end) into later_period_end
  from public.user_subscriptions
  where user_id = target_user_id
    and current_period_end > now()
    and (
      (lower(coalesce(provider, '')) = 'razorpay'
        and cancel_at_period_end = true
        and lower(status) not in ('failed', 'expired'))
      or
      (lower(coalesce(provider, '')) <> 'razorpay'
        and lower(status) in ('active', 'pending', 'authenticated'))
    );

  if later_period_end is not null then
    update public.dpdp_deletion_requests
    set status = 'pending',
        scheduled_delete_at = greatest(scheduled_delete_at, later_period_end),
        resolution_note = 'Erasure is postponed until the recorded subscription period ends. The recovery window has already expired.'
    where id = request_row.id;

    return jsonb_build_object(
      'request_id', request_row.id,
      'deferred', true,
      'scheduled_delete_at', later_period_end
    );
  end if;

  select email into target_email from auth.users where id = target_user_id;
  auth_user_exists := found;

  update public.dpdp_deletion_requests
  set status = 'processing',
      resolution_note = 'Erasure is processing. Financial records required for accounting are anonymized rather than deleted.'
  where id = request_row.id;

  if target_email is not null then
    update public.email_delivery_events
    set recipient = null,
        subject = null,
        details = '{}'::jsonb
    where lower(recipient) = lower(target_email);
  end if;

  -- Retain discussion threads, but remove the reader's text and identity.
  update public.comments
  set user_id = null,
      author_name = 'Deleted reader',
      content = '[deleted]',
      updated_at = now()
  where user_id = target_user_id;

  update public.pdlpl_comments
  set user_id = null,
      author_name = 'Deleted reader',
      content = '[deleted]',
      updated_at = now()
  where user_id = target_user_id;

  -- Reader activity and private account data.
  delete from public.bookmarks where user_id = target_user_id;
  delete from public.chapter_ratings where user_id = target_user_id;
  delete from public.comment_likes where user_id = target_user_id;
  delete from public.community_members where user_id = target_user_id;
  delete from public.community_post_reactions where user_id = target_user_id;
  delete from public.dpdp_nominations where user_id = target_user_id;
  delete from public.email_marketing_preferences where user_id = target_user_id;
  delete from public.feature_login_users where user_id = target_user_id;
  delete from public.group_chat_likes where user_id = target_user_id;
  delete from public.group_chat_reactions where user_id = target_user_id;
  delete from public.group_chat_reads where user_id = target_user_id;
  delete from public.group_chat_messages where user_id = target_user_id;
  delete from public.member_messages where user_id = target_user_id;
  delete from public.moderation_reports where user_id = target_user_id;
  delete from public.notification_preferences where user_id = target_user_id;
  delete from public.notification_subscriptions where user_id = target_user_id;
  delete from public.pdlpl_bookmarks where user_id = target_user_id;
  delete from public.pdlpl_chapter_ratings where user_id = target_user_id;
  delete from public.pdlpl_comment_likes where user_id = target_user_id;
  delete from public.pdlpl_reading_history where user_id = target_user_id;
  delete from public.push_subscriptions where user_id = target_user_id;
  delete from public.reading_history where user_id = target_user_id;
  delete from public.user_moderation where user_id = target_user_id;

  delete from public.email_change_request_events
  where user_id = target_user_id or actor_user_id = target_user_id;
  delete from public.email_change_requests where user_id = target_user_id;

  delete from public.site_feedback
  where user_id = target_user_id
     or (target_email is not null and lower(coalesce(email, '')) = lower(target_email));

  -- Retain essential accounting/subscription history without linking it to the
  -- erased account or retaining provider identifiers tied to that account.
  update public.payments set user_id = null where user_id = target_user_id;
  update public.subscriptions set user_id = null where user_id = target_user_id;
  update public.user_subscriptions
  set user_id = null,
      provider_subscription_id = null,
      provider_session_id = null,
      preferred_upi_flow = null,
      updated_at = now()
  where user_id = target_user_id;

  -- Preserve consent proof as an anonymized audit record.
  update public.dpdp_consent_records set user_id = null where user_id = target_user_id;

  delete from public.profiles where id = target_user_id;

  return jsonb_build_object(
    'request_id', request_row.id,
    'user_id', target_user_id,
    'account_email', target_email,
    'auth_user_exists', auth_user_exists,
    'data_erased', true
  );
end;
$$;

revoke all on function public.erase_due_account_personal_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erase_due_account_personal_data(uuid, uuid) to service_role;

-- The processor is scheduled only after the verified request, scheduled date and
-- recovery deadline have all elapsed. Extension installation does not create a job.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
