-- Secure OTP workflows for account deletion, data erasure, and email changes.
-- Account deletion is recoverable for 14 days after OTP verification.
create table if not exists public.account_lifecycle_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in ('account_deletion','data_erasure','email_change')),
  status text not null default 'otp_pending'
    check (status in ('otp_pending','recovery_period','reactivation_pending','processing','completed','cancelled','expired','failed')),
  requested_email text,
  current_email text,
  data_window_days integer check (data_window_days is null or data_window_days in (7,30,90)),
  otp_hash text,
  otp_expires_at timestamptz,
  otp_sent_at timestamptz,
  otp_attempts integer not null default 0 check (otp_attempts >= 0),
  otp_verified_at timestamptz,
  recovery_until timestamptz,
  scheduled_delete_at timestamptz,
  finalization_attempts integer not null default 0 check (finalization_attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists account_lifecycle_requests_user_created_idx
  on public.account_lifecycle_requests (user_id, created_at desc);
create index if not exists account_lifecycle_requests_due_idx
  on public.account_lifecycle_requests (scheduled_delete_at)
  where request_type = 'account_deletion' and status = 'recovery_period';

create unique index if not exists account_lifecycle_one_open_deletion_per_user
  on public.account_lifecycle_requests (user_id)
  where user_id is not null and request_type = 'account_deletion'
    and status in ('otp_pending','recovery_period','reactivation_pending','processing');
create unique index if not exists account_lifecycle_one_open_email_change_per_user
  on public.account_lifecycle_requests (user_id)
  where user_id is not null and request_type = 'email_change'
    and status = 'otp_pending';

alter table public.account_lifecycle_requests enable row level security;
revoke all on public.account_lifecycle_requests from anon, authenticated;
grant all on public.account_lifecycle_requests to service_role;

-- Account deletion must not cascade away financial history. Detach the auth user
-- while preserving transaction/subscription evidence needed for accounting and disputes.
alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.subscriptions alter column user_id drop not null;
alter table public.subscriptions drop constraint if exists subscriptions_user_id_fkey;
alter table public.subscriptions add constraint subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.user_subscriptions alter column user_id drop not null;
alter table public.user_subscriptions drop constraint if exists user_subscriptions_user_id_fkey;
alter table public.user_subscriptions add constraint user_subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- Activity erasure is deliberately explicit. Auth/profile identity and billing are
-- retained for the user unless the separate account-deletion workflow is confirmed.
alter table public.group_chat_messages alter column user_id drop not null;
alter table public.pdlpl_comments alter column user_id drop not null;

create or replace function public.erase_user_activity_window(p_user_id uuid, p_days integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  cutoff timestamptz;
  removed jsonb := '{}'::jsonb;
  n bigint;
begin
  if p_user_id is null or (p_days is not null and p_days not in (7,30,90)) then
    raise exception 'Invalid data-erasure request.';
  end if;
  cutoff := case when p_days is null then '-infinity'::timestamptz else now() - make_interval(days => p_days) end;

  delete from public.bookmarks where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('bookmarks', n);
  delete from public.reading_history where user_id = p_user_id and updated_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('reading_history', n);
  delete from public.chapter_ratings where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('chapter_ratings', n);
  delete from public.comment_likes where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('comment_likes', n);
  delete from public.pdlpl_bookmarks where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('pdlpl_bookmarks', n);
  delete from public.pdlpl_reading_history where user_id = p_user_id and updated_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('pdlpl_reading_history', n);
  delete from public.pdlpl_chapter_ratings where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('pdlpl_chapter_ratings', n);
  delete from public.pdlpl_comment_likes where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('pdlpl_comment_likes', n);
  delete from public.community_post_reactions where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('community_reactions', n);
  delete from public.group_chat_likes where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('group_chat_likes', n);
  delete from public.group_chat_reactions where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('group_chat_reactions', n);
  delete from public.group_chat_reads where user_id = p_user_id and read_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('group_chat_reads', n);

  -- Keep thread structure intact while removing the actual text and account link.
  update public.comments set content = '[comment deleted]', author_name = 'Deleted reader', user_id = null,
    updated_at = now()
    where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('comments_redacted', n);
  update public.pdlpl_comments set content = '[comment deleted]', author_name = 'Deleted reader', user_id = null,
    updated_at = now()
    where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('pdlpl_comments_redacted', n);
  update public.group_chat_messages set content = '[message deleted]', user_id = null
    where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('group_messages_redacted', n);

  delete from public.site_feedback where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('site_feedback', n);
  delete from public.moderation_reports where user_id = p_user_id and created_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('moderation_reports', n);
  delete from public.community_members where user_id = p_user_id and joined_at >= cutoff;
  get diagnostics n = row_count; removed := removed || jsonb_build_object('community_memberships', n);
  delete from public.notification_subscriptions where user_id = p_user_id and created_at >= cutoff;
  delete from public.push_subscriptions where user_id = p_user_id and created_at >= cutoff;
  delete from public.notification_preferences where user_id = p_user_id and updated_at >= cutoff;
  delete from public.email_marketing_preferences where user_id = p_user_id and updated_at >= cutoff;
  delete from public.dpdp_nominations where user_id = p_user_id and created_at >= cutoff;
  delete from public.feature_login_users where user_id = p_user_id and first_seen_at >= cutoff;

  return jsonb_build_object('success', true, 'window_days', p_days, 'removed_or_redacted', removed);
end;
$$;

revoke all on function public.erase_user_activity_window(uuid, integer) from public, anon, authenticated;
grant execute on function public.erase_user_activity_window(uuid, integer) to service_role;

-- Finalize deletion with a scheduled database job so it still runs if the reader
-- never signs in again. Eligible billing records are anonymized, not cascaded away.
create or replace function public.finalize_due_account_deletions()
returns integer
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  r record;
  cutoff timestamptz;
  window_days integer;
  completed_count integer := 0;
begin
  for r in
    select id, user_id
      from public.account_lifecycle_requests
     where request_type = 'account_deletion'
       and status = 'recovery_period'
       and scheduled_delete_at is not null
       and scheduled_delete_at <= now()
     order by scheduled_delete_at
     for update skip locked
  loop
    begin
      if r.user_id is null then
        update public.account_lifecycle_requests set status = 'completed', completed_at = now(),
          otp_hash = null, last_error = null, updated_at = now() where id = r.id;
        completed_count := completed_count + 1;
        continue;
      end if;

      -- Admin/owner identities must be transferred/reviewed instead of accidentally
      -- deleting the site's last administrator or creator access.
      if exists (select 1 from public.admins where user_id = r.user_id) then
        update public.account_lifecycle_requests
           set status = 'failed', scheduled_delete_at = null,
               finalization_attempts = finalization_attempts + 1,
               last_error = 'Administrator account requires manual ownership review.',
               updated_at = now()
         where id = r.id;
        continue;
      end if;

      -- Optional retention: with a 7/30/90-day selection, older public comments and
      -- chat messages survive only as anonymous contributions. Recent contributions
      -- remain linked and are removed by the auth-user cascade. "Permanent" removes all.
      if r.user_id is not null then
        select data_window_days into window_days
          from public.account_lifecycle_requests where id = r.id;
        if window_days is not null then
          cutoff := now() - make_interval(days => window_days);
          update public.comments set user_id = null, author_name = 'Deleted reader'
            where user_id = r.user_id and created_at < cutoff;
          update public.pdlpl_comments set user_id = null, author_name = 'Deleted reader'
            where user_id = r.user_id and created_at < cutoff;
          update public.group_chat_messages set user_id = null
            where user_id = r.user_id and created_at < cutoff;
        end if;
      end if;

      -- Keep auditable financial evidence with personal account linkage removed.
      update public.payments set user_id = null where user_id = r.user_id;
      update public.subscriptions set user_id = null where user_id = r.user_id;
      update public.user_subscriptions set user_id = null where user_id = r.user_id;

      -- Scrub pending email-change records that otherwise retain both addresses.
      update public.email_change_requests
         set current_email = 'removed', requested_email = 'removed',
             status = 'cancelled', closed_at = now()
       where user_id = r.user_id;
      update public.email_change_request_events
         set details = '{}'::jsonb
       where user_id = r.user_id or actor_user_id = r.user_id;
      delete from public.site_feedback where user_id = r.user_id;

      -- Remove the account identity. FK cascades erase profile, comments, likes,
      -- bookmarks, histories, auth identities, notification endpoints and preferences.
      delete from auth.users where id = r.user_id;
      update public.account_lifecycle_requests
         set status = 'completed', completed_at = now(), otp_hash = null, last_error = null,
             updated_at = now()
       where id = r.id;
      completed_count := completed_count + 1;
    exception when others then
      update public.account_lifecycle_requests
         set finalization_attempts = finalization_attempts + 1,
             last_error = 'Final deletion will be retried automatically.',
             scheduled_delete_at = case
               when finalization_attempts >= 4 then now() + interval '1 day'
               else now() + interval '1 hour'
             end,
             status = case when finalization_attempts >= 4 then 'failed' else 'recovery_period' end,
             updated_at = now()
       where id = r.id;
    end;
  end loop;
  return completed_count;
end;
$$;

revoke all on function public.finalize_due_account_deletions() from public, anon, authenticated;
grant execute on function public.finalize_due_account_deletions() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare old_job bigint;
begin
  for old_job in select jobid from cron.job where jobname = 'account-lifecycle-finalizer'
  loop
    perform cron.unschedule(old_job);
  end loop;
  perform cron.schedule(
    'account-lifecycle-finalizer',
    '*/10 * * * *',
    'select public.finalize_due_account_deletions();'
  );
end $$;
