create or replace function public.get_admin_membership_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
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
          (select count(*) from public.user_subscriptions us where us.plan_id = sp.id and us.status = 'active' and (us.current_period_end is null or us.current_period_end > v_now)) as active_billable,
          (select count(*) from public.user_subscriptions us where us.plan_id = sp.id and us.status in ('active','cancelled') and (us.current_period_end is null or us.current_period_end > v_now)) as access_members,
          (select count(*) from public.user_subscriptions us where us.plan_id = sp.id and us.status = 'active' and us.cancel_at_period_end = true and (us.current_period_end is null or us.current_period_end > v_now)) as cancelling,
          (select count(*) from public.user_subscriptions us where us.plan_id = sp.id and us.status = 'pending') as pending
        from public.subscription_plans sp
      ) x
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'active_billable_members', coalesce((select count(*) from public.user_subscriptions us join public.subscription_plans sp on sp.id = us.plan_id where sp.amount_inr > 0 and us.status = 'active' and (us.current_period_end is null or us.current_period_end > v_now)), 0),
      'access_members', coalesce((select count(*) from public.user_subscriptions us join public.subscription_plans sp on sp.id = us.plan_id where sp.amount_inr > 0 and us.status in ('active','cancelled') and (us.current_period_end is null or us.current_period_end > v_now)), 0),
      'cancelling_members', coalesce((select count(*) from public.user_subscriptions us join public.subscription_plans sp on sp.id = us.plan_id where sp.amount_inr > 0 and us.status = 'active' and us.cancel_at_period_end = true and (us.current_period_end is null or us.current_period_end > v_now)), 0),
      'pending_subscriptions', coalesce((select count(*) from public.user_subscriptions where status = 'pending'), 0),
      'cancelled_records', coalesce((select count(*) from public.user_subscriptions where status = 'cancelled'), 0),
      'failed_subscriptions', coalesce((select count(*) from public.user_subscriptions where status = 'failed'), 0),
      'mrr_estimate_inr', coalesce((select sum(sp.amount_inr) from public.user_subscriptions us join public.subscription_plans sp on sp.id = us.plan_id where sp.amount_inr > 0 and us.status = 'active' and (us.current_period_end is null or us.current_period_end > v_now)), 0),
      'at_risk_mrr_inr', coalesce((select sum(sp.amount_inr) from public.user_subscriptions us join public.subscription_plans sp on sp.id = us.plan_id where sp.amount_inr > 0 and us.status = 'active' and us.cancel_at_period_end = true and (us.current_period_end is null or us.current_period_end > v_now)), 0),
      'renewals_next_30d', coalesce((select count(*) from public.user_subscriptions us join public.subscription_plans sp on sp.id = us.plan_id where sp.amount_inr > 0 and us.status = 'active' and us.cancel_at_period_end = false and us.current_period_end > v_now and us.current_period_end <= v_now + interval '30 days'), 0),
      'next_renewal_at', (select min(us.current_period_end) from public.user_subscriptions us join public.subscription_plans sp on sp.id = us.plan_id where sp.amount_inr > 0 and us.status = 'active' and us.cancel_at_period_end = false and us.current_period_end > v_now)
    ),
    'revenue', jsonb_build_object(
      'processed_gross_all_time_inr', coalesce((select sum((payload #>> '{payload,payment,entity,amount}')::numeric / 100) from public.payment_events where provider = 'razorpay' and event_type = 'subscription.charged' and nullif(payload #>> '{payload,payment,entity,amount}', '') is not null), 0),
      'processed_gross_30d_inr', coalesce((select sum((payload #>> '{payload,payment,entity,amount}')::numeric / 100) from public.payment_events where provider = 'razorpay' and event_type = 'subscription.charged' and received_at >= v_now - interval '30 days' and received_at <= v_now and nullif(payload #>> '{payload,payment,entity,amount}', '') is not null), 0),
      'processed_charge_count', coalesce((select count(*) from public.payment_events where provider = 'razorpay' and event_type = 'subscription.charged'), 0),
      'last_charge_at', (select max(received_at) from public.payment_events where provider = 'razorpay' and event_type = 'subscription.charged')
    ),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', to_char(bucket, 'Mon YY'),
        'month_start', bucket,
        'new_subscriptions', (select count(*) from public.user_subscriptions us where us.created_at >= bucket and us.created_at < bucket + interval '1 month'),
        'cancellations', (select count(*) from public.user_subscriptions us where us.status = 'cancelled' and us.updated_at >= bucket and us.updated_at < bucket + interval '1 month'),
        'charges_inr', coalesce((select sum((pe.payload #>> '{payload,payment,entity,amount}')::numeric / 100) from public.payment_events pe where pe.provider = 'razorpay' and pe.event_type = 'subscription.charged' and pe.received_at >= bucket and pe.received_at < bucket + interval '1 month' and nullif(pe.payload #>> '{payload,payment,entity,amount}', '') is not null), 0)
      ) order by bucket)
      from generate_series(date_trunc('month', v_now) - interval '5 months', date_trunc('month', v_now), interval '1 month') bucket
    ), '[]'::jsonb),
    'recent_activity', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.changed_at desc)
      from (
        select us.id, us.plan_id, sp.name as plan_name, sp.amount_inr, us.status, us.cancel_at_period_end, coalesce(us.updated_at, us.created_at) as changed_at
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

revoke execute on function public.get_admin_membership_analytics() from public, anon;
grant execute on function public.get_admin_membership_analytics() to authenticated;
