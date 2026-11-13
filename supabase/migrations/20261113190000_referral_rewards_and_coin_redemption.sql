-- Verified invite rewards and time-limited membership redemption.
-- Coins are ledger-backed. Clients can read their own history but cannot mint,
-- transfer, or spend coins directly.

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  constraint referral_codes_code_format check (code ~ '^[A-F0-9]{10}$')
);

create table if not exists public.referral_signups (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending','qualified','rejected')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  constraint referral_signups_no_self_referral check (referrer_user_id <> referred_user_id)
);
create index if not exists referral_signups_referrer_created_idx
  on public.referral_signups(referrer_user_id, created_at desc);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  coins_spent integer not null check (coins_spent > 0),
  status text not null default 'completed' check (status in ('completed','reversed')),
  created_at timestamptz not null default now()
);
create index if not exists reward_redemptions_user_created_idx
  on public.reward_redemptions(user_id, created_at desc);

create table if not exists public.reward_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  redemption_id uuid not null unique references public.reward_redemptions(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint reward_subscriptions_positive_period check (expires_at > started_at)
);
create index if not exists reward_subscriptions_user_expiry_idx
  on public.reward_subscriptions(user_id, expires_at desc);

create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  transaction_type text not null check (transaction_type in ('referral_reward','subscription_redemption','admin_adjustment')),
  referral_signup_id uuid references public.referral_signups(id) on delete set null,
  redemption_id uuid references public.reward_redemptions(id) on delete cascade,
  description text not null,
  created_at timestamptz not null default now(),
  constraint coin_ledger_reference_check check (
    (transaction_type = 'referral_reward' and amount = 100)
    or (transaction_type = 'subscription_redemption' and redemption_id is not null and amount < 0)
    or (transaction_type = 'admin_adjustment' and referral_signup_id is null and redemption_id is null)
  )
);
create index if not exists coin_ledger_user_created_idx
  on public.coin_ledger(user_id, created_at desc);
create unique index if not exists coin_ledger_one_referral_reward_idx
  on public.coin_ledger(referral_signup_id)
  where transaction_type = 'referral_reward';
create unique index if not exists coin_ledger_one_redemption_idx
  on public.coin_ledger(redemption_id)
  where transaction_type = 'subscription_redemption';

alter table public.referral_codes enable row level security;
alter table public.referral_signups enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.reward_subscriptions enable row level security;
alter table public.coin_ledger enable row level security;

revoke all on public.referral_codes, public.referral_signups, public.reward_redemptions,
  public.reward_subscriptions, public.coin_ledger from anon, authenticated;
grant select on public.referral_codes, public.referral_signups, public.reward_redemptions,
  public.reward_subscriptions, public.coin_ledger to authenticated;

drop policy if exists referral_codes_read_own on public.referral_codes;
create policy referral_codes_read_own on public.referral_codes
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists referral_signups_read_as_referrer on public.referral_signups;
create policy referral_signups_read_as_referrer on public.referral_signups
  for select to authenticated using (referrer_user_id = (select auth.uid()));
drop policy if exists reward_redemptions_read_own on public.reward_redemptions;
create policy reward_redemptions_read_own on public.reward_redemptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists reward_subscriptions_read_own on public.reward_subscriptions;
create policy reward_subscriptions_read_own on public.reward_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists coin_ledger_read_own on public.coin_ledger;
create policy coin_ledger_read_own on public.coin_ledger
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.capture_referral_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_code text;
  v_referrer uuid;
  v_signup_id uuid;
begin
  v_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if v_code = '' or v_code !~ '^[A-F0-9]{10}$' then
    return new;
  end if;

  select rc.user_id into v_referrer
  from public.referral_codes rc
  where rc.code = v_code;

  if v_referrer is null or v_referrer = new.id then
    return new;
  end if;

  begin
    insert into public.referral_signups(referrer_user_id, referred_user_id, referral_code, status, qualified_at)
    values (
      v_referrer,
      new.id,
      v_code,
      case when new.email_confirmed_at is not null then 'qualified' else 'pending' end,
      case when new.email_confirmed_at is not null then now() else null end
    )
    on conflict (referred_user_id) do nothing
    returning id into v_signup_id;
  exception when others then
    raise warning 'Referral attribution could not be recorded for a new account: %', sqlerrm;
    return new;
  end;

  if v_signup_id is not null and new.email_confirmed_at is not null then
    begin
      insert into public.coin_ledger(user_id, amount, transaction_type, referral_signup_id, description)
      values (v_referrer, 100, 'referral_reward', v_signup_id, 'Verified friend referral')
      on conflict do nothing;
    exception when others then
      raise warning 'Referral reward credit is pending recovery: %', sqlerrm;
    end;
  end if;

  return new;
exception when others then
  raise warning 'Referral capture skipped without blocking account creation: %', sqlerrm;
  return new;
end;
$function$;

create or replace function private.qualify_referral_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_signup public.referral_signups%rowtype;
begin
  if old.email_confirmed_at is not null or new.email_confirmed_at is null then
    return new;
  end if;

  update public.referral_signups
  set status = 'qualified', qualified_at = coalesce(qualified_at, now())
  where referred_user_id = new.id and status = 'pending'
  returning * into v_signup;

  if found then
    begin
      insert into public.coin_ledger(user_id, amount, transaction_type, referral_signup_id, description)
      values (v_signup.referrer_user_id, 100, 'referral_reward', v_signup.id, 'Verified friend referral')
      on conflict do nothing;
    exception when others then
      raise warning 'Verified referral reward credit is pending recovery: %', sqlerrm;
    end;
  end if;

  return new;
exception when others then
  raise warning 'Referral qualification skipped without blocking email verification: %', sqlerrm;
  return new;
end;
$function$;

create or replace function private.claim_referral_rewards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_awarded integer := 0;
begin
  if v_uid is null then raise exception 'Sign in to claim referral rewards.'; end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'Verify your email address before claiming rewards.';
  end if;

  update public.referral_signups rs
  set status = 'qualified', qualified_at = coalesce(rs.qualified_at, now())
  from auth.users invitee
  where rs.referrer_user_id = v_uid
    and rs.referred_user_id = invitee.id
    and rs.status = 'pending'
    and invitee.email_confirmed_at is not null;

  -- Recover already-qualified referrals if an automatic ledger insert was interrupted.
  -- The unique partial index on referral_signup_id prevents duplicate credits.
  insert into public.coin_ledger(user_id, amount, transaction_type, referral_signup_id, description)
  select rs.referrer_user_id, 100, 'referral_reward', rs.id, 'Verified friend referral'
  from public.referral_signups rs
  join auth.users invitee on invitee.id = rs.referred_user_id
  where rs.referrer_user_id = v_uid
    and rs.status = 'qualified'
    and invitee.email_confirmed_at is not null
    and not exists (
      select 1 from public.coin_ledger cl
      where cl.referral_signup_id = rs.id
        and cl.transaction_type = 'referral_reward'
    )
  on conflict do nothing;

  get diagnostics v_awarded = row_count;
  return jsonb_build_object(
    'ok', true,
    'referrals_claimed', v_awarded,
    'coins_claimed', v_awarded * 100
  );
end;
$function$;

revoke all on function private.capture_referral_signup() from public, anon, authenticated;
revoke all on function private.qualify_referral_signup() from public, anon, authenticated;
drop trigger if exists atma_capture_referral_signup on auth.users;
create trigger atma_capture_referral_signup
  after insert on auth.users
  for each row execute function private.capture_referral_signup();
drop trigger if exists atma_qualify_referral_signup on auth.users;
create trigger atma_qualify_referral_signup
  after update of email_confirmed_at on auth.users
  for each row execute function private.qualify_referral_signup();

create or replace function public.claim_referral_rewards()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.claim_referral_rewards();
$function$;

create or replace function private.get_referral_rewards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_balance bigint;
  v_earned bigint;
  v_spent bigint;
  v_invited integer;
  v_qualified integer;
  v_pending integer;
  v_referrals jsonb;
  v_transactions jsonb;
  v_redemptions jsonb;
  v_paid_membership jsonb;
  v_paid_membership_pending boolean := false;
  v_active_reward_membership jsonb;
begin
  if v_uid is null then raise exception 'Sign in to view rewards.'; end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'Verify your email address to use referral rewards.';
  end if;

  insert into public.referral_codes(user_id, code)
  values (v_uid, upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  on conflict (user_id) do nothing;

  select rc.code into v_code from public.referral_codes rc where rc.user_id = v_uid;
  select coalesce(sum(cl.amount), 0),
         coalesce(sum(case when cl.amount > 0 then cl.amount else 0 end), 0),
         coalesce(sum(case when cl.amount < 0 then -cl.amount else 0 end), 0)
  into v_balance, v_earned, v_spent
  from public.coin_ledger cl where cl.user_id = v_uid;

  select count(*)::integer,
         count(*) filter (where rs.status = 'qualified')::integer,
         count(*) filter (where rs.status = 'pending')::integer
  into v_invited, v_qualified, v_pending
  from public.referral_signups rs where rs.referrer_user_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'status', x.status,
    'created_at', x.created_at,
    'qualified_at', x.qualified_at,
    'display_name', coalesce(nullif(p.display_name, ''), 'New reader')
  ) order by x.created_at desc), '[]'::jsonb)
  into v_referrals
  from (
    select rs.id, rs.referred_user_id, rs.status, rs.created_at, rs.qualified_at
    from public.referral_signups rs
    where rs.referrer_user_id = v_uid
    order by rs.created_at desc limit 50
  ) x
  left join public.profiles p on p.id = x.referred_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'amount', x.amount, 'transaction_type', x.transaction_type,
    'description', x.description, 'created_at', x.created_at
  ) order by x.created_at desc), '[]'::jsonb)
  into v_transactions
  from (
    select cl.id, cl.amount, cl.transaction_type, cl.description, cl.created_at
    from public.coin_ledger cl where cl.user_id = v_uid
    order by cl.created_at desc limit 30
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'plan_id', x.plan_id, 'coins_spent', x.coins_spent,
    'status', x.status, 'created_at', x.created_at, 'expires_at', rs.expires_at
  ) order by x.created_at desc), '[]'::jsonb)
  into v_redemptions
  from (
    select r.id, r.plan_id, r.coins_spent, r.status, r.created_at
    from public.reward_redemptions r where r.user_id = v_uid
    order by r.created_at desc limit 15
  ) x
  left join public.reward_subscriptions rs on rs.redemption_id = x.id;

  select jsonb_build_object(
    'plan_id', us.plan_id,
    'current_period_end', us.current_period_end
  )
  into v_paid_membership
  from public.user_subscriptions us
  where us.user_id = v_uid
    and (
      (us.status = 'active' and (us.current_period_end is null or us.current_period_end > now()))
      or
      (us.status = 'cancelled' and us.current_period_end is not null and us.current_period_end > now())
    )
  order by us.current_period_end desc nulls first
  limit 1;

  select exists (
    select 1
    from public.user_subscriptions us
    where us.user_id = v_uid
      and us.status = 'pending'
      and us.created_at > now() - interval '30 minutes'
  ) into v_paid_membership_pending;

  select jsonb_build_object(
    'plan_id', rs.plan_id,
    'expires_at', rs.expires_at
  )
  into v_active_reward_membership
  from public.reward_subscriptions rs
  where rs.user_id = v_uid and rs.expires_at > now()
  order by rs.expires_at desc
  limit 1;

  return jsonb_build_object(
    'paid_membership', v_paid_membership,
    'paid_membership_pending', v_paid_membership_pending,
    'active_reward_membership', v_active_reward_membership,
    'referral_code', v_code,
    'referral_link', 'https://www.atmarekha.in/?ref=' || v_code,
    'coin_balance', v_balance,
    'coins_earned', v_earned,
    'coins_spent', v_spent,
    'total_invited', v_invited,
    'verified_referrals', v_qualified,
    'pending_referrals', v_pending,
    'referrals', v_referrals,
    'transactions', v_transactions,
    'redemptions', v_redemptions
  );
end;
$function$;

create or replace function public.get_referral_rewards()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.get_referral_rewards();
$function$;

create or replace function private.redeem_reward_subscription(p_plan_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_cost integer;
  v_days integer;
  v_balance bigint;
  v_active_plan text;
  v_redemption_id uuid;
  v_expires_at timestamptz;
begin
  if v_uid is null then raise exception 'Sign in to redeem a membership.'; end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'Verify your email address before redeeming coins.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select us.plan_id into v_active_plan
  from public.user_subscriptions us
  where us.user_id = v_uid
    and (
      (us.status = 'active' and (us.current_period_end is null or us.current_period_end > now()))
      or
      (us.status = 'cancelled' and us.current_period_end is not null and us.current_period_end > now())
    )
  order by us.current_period_end desc nulls first
  limit 1;

  if v_active_plan is not null then
    raise exception 'Your paid membership is already active. You can redeem coins after it expires.';
  end if;

  if exists (
    select 1
    from public.user_subscriptions us
    where us.user_id = v_uid
      and us.status = 'pending'
      and us.created_at > now() - interval '30 minutes'
  ) then
    raise exception 'A paid membership checkout is already pending. Complete it or wait 30 minutes before redeeming coins.';
  end if;

  if exists (
    select 1 from public.reward_subscriptions rs
    where rs.user_id = v_uid and rs.expires_at > now()
  ) then
    raise exception 'You already have an active rewards membership. You can redeem again after it expires.';
  end if;

  case p_plan_id
    when 'mini_member' then v_cost := 1000; v_days := 30;
    when 'supporter' then v_cost := 2000; v_days := 30;
    when 'premium_yearly' then v_cost := 15000; v_days := 365;
    else raise exception 'This membership cannot be redeemed with coins.';
  end case;

  select coalesce(sum(cl.amount), 0) into v_balance
  from public.coin_ledger cl where cl.user_id = v_uid;
  if v_balance < v_cost then
    raise exception 'You need % more coins for this membership.', v_cost - v_balance;
  end if;

  v_expires_at := now() + make_interval(days => v_days);
  insert into public.reward_redemptions(user_id, plan_id, coins_spent)
  values (v_uid, p_plan_id, v_cost)
  returning id into v_redemption_id;

  insert into public.coin_ledger(user_id, amount, transaction_type, redemption_id, description)
  values (v_uid, -v_cost, 'subscription_redemption', v_redemption_id, 'Redeemed ' || p_plan_id || ' membership');

  insert into public.reward_subscriptions(user_id, redemption_id, plan_id, expires_at)
  values (v_uid, v_redemption_id, p_plan_id, v_expires_at);

  return jsonb_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'plan_id', p_plan_id,
    'coins_spent', v_cost,
    'coin_balance', v_balance - v_cost,
    'expires_at', v_expires_at
  );
end;
$function$;

create or replace function public.redeem_reward_subscription(p_plan_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.redeem_reward_subscription(p_plan_id);
$function$;

create or replace function private.has_current_reward_membership(p_plan_ids text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.reward_subscriptions rs
    where rs.user_id = (select auth.uid())
      and rs.plan_id = any(coalesce(p_plan_ids, array[]::text[]))
      and rs.expires_at > now()
  );
$function$;

-- The exposed public RPCs are invoker wrappers. Privileged implementation
-- stays in the non-exposed private schema and verifies auth.uid() internally.
grant usage on schema private to authenticated;

revoke all on function private.claim_referral_rewards() from public, anon, authenticated;
revoke all on function private.get_referral_rewards() from public, anon, authenticated;
revoke all on function private.redeem_reward_subscription(text) from public, anon, authenticated;
revoke all on function private.has_current_reward_membership(text[]) from public, anon, authenticated;
grant execute on function private.claim_referral_rewards() to authenticated;
grant execute on function private.get_referral_rewards() to authenticated;
grant execute on function private.redeem_reward_subscription(text) to authenticated;
grant execute on function private.has_current_reward_membership(text[]) to authenticated;

revoke all on function public.claim_referral_rewards() from public, anon;
revoke all on function public.get_referral_rewards() from public, anon;
revoke all on function public.redeem_reward_subscription(text) from public, anon;
grant execute on function public.claim_referral_rewards() to authenticated;
grant execute on function public.get_referral_rewards() to authenticated;
grant execute on function public.redeem_reward_subscription(text) to authenticated;

drop policy if exists atma_reward_members_read_paid_chapters on public.chapter_pages;
create policy atma_reward_members_read_paid_chapters
on public.chapter_pages for select to authenticated
using (
  exists (
    select 1 from public.chapters c
    where c.id = chapter_pages.chapter_id
      and c.chapter_number > 8
  )
  and (select private.has_current_reward_membership(array['mini_member','supporter','premium_yearly']::text[]))
);

drop policy if exists pdlpl_reward_members_read_published_chapters on public.pal_do_pal_ke_lamhe_chapter_pages;
create policy pdlpl_reward_members_read_published_chapters
on public.pal_do_pal_ke_lamhe_chapter_pages for select to authenticated
using (
  exists (
    select 1
    from public.pal_do_pal_ke_lamhe_chapters c
    where c.id = pal_do_pal_ke_lamhe_chapter_pages.chapter_id
      and lower(coalesce(c.status, '')) = 'published'
  )
  and (select private.has_current_reward_membership(array['supporter','premium_yearly']::text[]))
);
