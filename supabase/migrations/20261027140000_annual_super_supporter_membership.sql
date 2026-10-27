-- Introduce annual Super Supporter while retaining legacy monthly subscriptions.
INSERT INTO public.subscription_plans (id, name, description, amount_inr, interval, active, sort_order)
VALUES (
  'premium_yearly',
  'Super Supporter',
  'Full access to Atma Rekha and Pal Do Pal Ke Lamhe, the Super Supporter badge and priority comments. Billed annually.',
  299,
  'year',
  true,
  30
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount_inr = EXCLUDED.amount_inr,
  interval = EXCLUDED.interval,
  active = true,
  sort_order = EXCLUDED.sort_order;

-- Keep the old monthly row and its ID available to existing memberships, badges, and foreign keys.
UPDATE public.subscription_plans
SET description = 'Legacy monthly Super Supporter plan retained for existing subscriptions. No longer offered at checkout.',
    amount_inr = 49,
    interval = 'month',
    active = true,
    sort_order = 31
WHERE id = 'premium';

CREATE OR REPLACE FUNCTION public.get_current_memberships(target_user_ids uuid[])
 RETURNS TABLE(user_id uuid, plan_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (us.user_id) us.user_id, us.plan_id
  from public.user_subscriptions us
  where us.user_id = any(target_user_ids)
    and (us.user_id = (select auth.uid()) or exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
    and us.status in ('active', 'cancelled')
    and (us.current_period_end is null or us.current_period_end > now())
  order by us.user_id,
    case us.plan_id when 'premium_yearly' then 4 when 'premium' then 3 when 'supporter' then 2 when 'mini_member' then 1 else 0 end desc,
    us.current_period_end desc nulls first;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_membership_analytics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_result jsonb;
begin
  if v_uid is null or not exists (select 1 from public.admins where user_id = v_uid) then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'as_of', v_now,
    'currency', 'INR',
    'plans', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.sort_order)
      from (
        select
          sp.id,
          sp.name,
          sp.amount_inr,
          sp.interval,
          sp.active,
          sp.sort_order,
          (select count(*)
             from public.user_subscriptions us
            where us.plan_id = sp.id
              and us.status = 'active'
              and (us.current_period_end is null or us.current_period_end > v_now)) as active_billable,
          (select count(*)
             from public.user_subscriptions us
            where us.plan_id = sp.id
              and us.status in ('active','cancelled')
              and (us.current_period_end is null or us.current_period_end > v_now)) as access_members,
          (select count(*)
             from public.user_subscriptions us
            where us.plan_id = sp.id
              and us.status = 'active'
              and us.cancel_at_period_end = true
              and (us.current_period_end is null or us.current_period_end > v_now)) as cancelling,
          (select count(*)
             from public.user_subscriptions us
            where us.plan_id = sp.id
              and us.status = 'pending') as pending
        from public.subscription_plans sp
      ) x
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'active_billable_members', coalesce((
        select count(*)
        from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where sp.amount_inr > 0
          and us.status = 'active'
          and (us.current_period_end is null or us.current_period_end > v_now)
      ), 0),
      'access_members', coalesce((
        select count(*)
        from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where sp.amount_inr > 0
          and us.status in ('active','cancelled')
          and (us.current_period_end is null or us.current_period_end > v_now)
      ), 0),
      'cancelling_members', coalesce((
        select count(*)
        from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where sp.amount_inr > 0
          and us.status = 'active'
          and us.cancel_at_period_end = true
          and (us.current_period_end is null or us.current_period_end > v_now)
      ), 0),
      'pending_subscriptions', coalesce((select count(*) from public.user_subscriptions where status = 'pending'), 0),
      'cancelled_records', coalesce((select count(*) from public.user_subscriptions where status = 'cancelled'), 0),
      'failed_subscriptions', coalesce((select count(*) from public.user_subscriptions where status = 'failed'), 0),
      'mrr_estimate_inr', coalesce((
        select sum(case when sp.interval = 'year' then sp.amount_inr / 12.0 else sp.amount_inr end)
        from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where sp.amount_inr > 0
          and us.status = 'active'
          and (us.current_period_end is null or us.current_period_end > v_now)
      ), 0),
      'at_risk_mrr_inr', coalesce((
        select sum(case when sp.interval = 'year' then sp.amount_inr / 12.0 else sp.amount_inr end)
        from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where sp.amount_inr > 0
          and us.status = 'active'
          and us.cancel_at_period_end = true
          and (us.current_period_end is null or us.current_period_end > v_now)
      ), 0),
      'renewals_next_30d', coalesce((
        select count(*)
        from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where sp.amount_inr > 0
          and us.status = 'active'
          and us.cancel_at_period_end = false
          and us.current_period_end > v_now
          and us.current_period_end <= v_now + interval '30 days'
      ), 0),
      'next_renewal_at', (
        select min(us.current_period_end)
        from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        where sp.amount_inr > 0
          and us.status = 'active'
          and us.cancel_at_period_end = false
          and us.current_period_end > v_now
      )
    ),
    'revenue', jsonb_build_object(
      'processed_gross_all_time_inr', coalesce((
        select sum((payload #>> '{payload,payment,entity,amount}')::numeric / 100)
        from public.payment_events
        where provider = 'razorpay'
          and event_type = 'subscription.charged'
          and nullif(payload #>> '{payload,payment,entity,amount}', '') is not null
      ), 0),
      'processed_gross_30d_inr', coalesce((
        select sum((payload #>> '{payload,payment,entity,amount}')::numeric / 100)
        from public.payment_events
        where provider = 'razorpay'
          and event_type = 'subscription.charged'
          and received_at >= v_now - interval '30 days'
          and received_at <= v_now
          and nullif(payload #>> '{payload,payment,entity,amount}', '') is not null
      ), 0),
      'processed_charge_count', coalesce((
        select count(*)
        from public.payment_events
        where provider = 'razorpay'
          and event_type = 'subscription.charged'
      ), 0),
      'last_charge_at', (
        select max(received_at)
        from public.payment_events
        where provider = 'razorpay'
          and event_type = 'subscription.charged'
      )
    ),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', to_char(bucket, 'Mon YY'),
        'month_start', bucket,
        'new_subscriptions', (
          select count(*)
          from public.user_subscriptions us
          where us.created_at >= bucket
            and us.created_at < bucket + interval '1 month'
        ),
        'cancellations', (
          select count(*)
          from public.user_subscriptions us
          where us.status = 'cancelled'
            and us.updated_at >= bucket
            and us.updated_at < bucket + interval '1 month'
        ),
        'charges_inr', coalesce((
          select sum((pe.payload #>> '{payload,payment,entity,amount}')::numeric / 100)
          from public.payment_events pe
          where pe.provider = 'razorpay'
            and pe.event_type = 'subscription.charged'
            and pe.received_at >= bucket
            and pe.received_at < bucket + interval '1 month'
            and nullif(pe.payload #>> '{payload,payment,entity,amount}', '') is not null
        ), 0)
      ) order by bucket)
      from generate_series(
        date_trunc('month', v_now) - interval '5 months',
        date_trunc('month', v_now),
        interval '1 month'
      ) bucket
    ), '[]'::jsonb),
    'recent_activity', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.changed_at desc)
      from (
        select
          us.id,
          us.plan_id,
          sp.name as plan_name,
          sp.amount_inr,
          us.status,
          us.cancel_at_period_end,
          coalesce(us.updated_at, us.created_at) as changed_at
        from public.user_subscriptions us
        join public.subscription_plans sp on sp.id = us.plan_id
        order by coalesce(us.updated_at, us.created_at) desc
        limit 8
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

DROP POLICY IF EXISTS pdlpl_member_read_pages ON public.pal_do_pal_ke_lamhe_chapter_pages;
CREATE POLICY pdlpl_member_read_pages
ON public.pal_do_pal_ke_lamhe_chapter_pages
FOR SELECT TO authenticated
USING (
  private.is_admin()
  OR (
    EXISTS (
      SELECT 1
      FROM public.pal_do_pal_ke_lamhe_chapters chapter
      WHERE chapter.id = pal_do_pal_ke_lamhe_chapter_pages.chapter_id
        AND lower(coalesce(chapter.status, '')) = 'published'
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_subscriptions us
      WHERE us.user_id = (SELECT auth.uid())
        AND us.plan_id IN ('supporter', 'premium', 'premium_yearly')
        AND (
          (us.status = 'active' AND (us.current_period_end IS NULL OR us.current_period_end > now()))
          OR
          (us.status = 'cancelled' AND us.current_period_end IS NOT NULL AND us.current_period_end > now())
        )
    )
  )
);
