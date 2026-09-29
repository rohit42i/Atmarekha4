import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { AdminIcon, GlassCard, SectionHeader, StatCard } from './admin-redesign-ui.jsx';

const money = value => '₹' + Math.round(Number(value) || 0).toLocaleString('en-IN');
const number = value => Math.round(Number(value) || 0).toLocaleString('en-IN');
const date = value => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const dateTime = value => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function MembershipTrend({ rows }) {
  if (!rows.length) return <div className="ar-membership-empty"><AdminIcon name="chart" size={24}/><strong>No membership history yet</strong><span>New subscriptions and charges will appear here once membership is used.</span></div>;
  const max = Math.max(...rows.map(row => Math.max(row.newSubscriptions, row.cancellations)), 1);
  return <div className="ar-membership-trend">
    {rows.map(row => <div className="ar-membership-trend-col" key={row.monthStart}>
      <div className="ar-membership-trend-bars" title={row.month + ' · ' + money(row.charges)}>
        <i style={{ height: Math.max(4, row.newSubscriptions / max * 100) + '%' }}/>
        <b style={{ height: Math.max(4, row.cancellations / max * 100) + '%' }}/>
      </div>
      <span>{row.month}</span>
      <small>{money(row.charges)}</small>
    </div>)}
    <div className="ar-membership-trend-legend"><span><i className="dot violet"/>New</span><span><i className="dot pink"/>Cancelled</span><span>Bars = member events · labels = processed charges</span></div>
  </div>;
}

function StatusBadge({ status }) {
  const label = status === 'active' ? 'Active' : status === 'cancelled' ? 'Cancelled' : status === 'pending' ? 'Pending' : status === 'failed' ? 'Failed' : status || 'Unknown';
  return <span className={'ar-membership-status status-' + status}>{label}</span>;
}

export default function AdminMembership() {
  const [analytics, setAnalytics] = useState(null);
  const [registeredUsers, setRegisteredUsers] = useState(0);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [{ data, error: analyticsError }, { data: userData, error: userError }] = await Promise.all([
        supabase.rpc('get_admin_membership_analytics'),
        supabase.functions.invoke('get-admin-user-stats'),
      ]);
      if (analyticsError) throw analyticsError;
      if (userError) throw userError;
      setAnalytics(data || {});
      setRegisteredUsers(Number(userData?.logged_in_users || 0));
      setError('');
    } catch (err) {
      console.warn('Admin membership analytics lookup failed:', err);
      setError(err?.message || 'Unable to load membership analytics.');
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, []);

  const view = useMemo(() => {
    const totals = analytics?.totals || {};
    const revenue = analytics?.revenue || {};
    const plans = (analytics?.plans || []).map(plan => ({
      ...plan,
      amountInr: Number(plan.amount_inr || 0),
      activeBillable: Number(plan.active_billable || 0),
      accessMembers: Number(plan.access_members || 0),
      cancelling: Number(plan.cancelling || 0),
      pending: Number(plan.pending || 0),
    }));
    const trend = (analytics?.trend || []).map(row => ({
      ...row,
      monthStart: row.month_start,
      newSubscriptions: Number(row.new_subscriptions || 0),
      cancellations: Number(row.cancellations || 0),
      charges: Number(row.charges_inr || 0),
    }));
    const active = Number(totals.active_billable_members || 0);
    const mrr = Number(totals.mrr_estimate_inr || 0);
    return {
      plans,
      trend,
      activity: analytics?.recent_activity || [],
      mrr,
      arr: mrr * 12,
      access: Number(totals.access_members || 0),
      cancelling: Number(totals.cancelling_members || 0),
      pending: Number(totals.pending_subscriptions || 0),
      cancelledRecords: Number(totals.cancelled_records || 0),
      failed: Number(totals.failed_subscriptions || 0),
      renewals30d: Number(totals.renewals_next_30d || 0),
      nextRenewal: totals.next_renewal_at,
      atRiskMrr: Number(totals.at_risk_mrr_inr || 0),
      grossAllTime: Number(revenue.processed_gross_all_time_inr || 0),
      gross30d: Number(revenue.processed_gross_30d_inr || 0),
      chargeCount: Number(revenue.processed_charge_count || 0),
      lastCharge: revenue.last_charge_at,
      active,
      conversion: registeredUsers ? active / registeredUsers * 100 : 0,
    };
  }, [analytics, registeredUsers]);

  if (error && !analytics) return <section className="ar-membership"><div className="ar-membership-error"><AdminIcon name="flag" size={20}/><strong>Membership analytics unavailable</strong><span>{error}</span><button type="button" onClick={load}>Retry</button></div></section>;
  if (!analytics) return <section className="ar-membership"><div className="ar-overview-kpis">{Array.from({ length: 4 }, (_, i) => <div className="ar-stat-card" key={i}><div className="ar-skeleton ar-stat-label-skel"/><div className="ar-skeleton ar-stat-number"/><div className="ar-skeleton ar-stat-foot"/></div>)}</div></section>;

  return <section className="ar-membership">
    <div className="ar-membership-hero">
      <div>
        <span className="ar-kicker">MONETIZATION · MEMBERSHIP</span>
        <h2>Membership & Earnings</h2>
        <p>Private admin view of recurring membership revenue, member health and Razorpay billing activity.</p>
      </div>
      <div className="ar-membership-live"><span className="status-dot"/><div><strong>Live data</strong><small>Supabase subscriptions · Razorpay charge events</small></div><button type="button" onClick={load} aria-label="Refresh membership analytics"><AdminIcon name="refresh" size={16}/></button></div>
    </div>

    <div className="ar-membership-kpis">
      <StatCard label="Estimated MRR" value={money(view.mrr)} note="Active subscriptions · current prices" icon="chart" accent="violet"/>
      <StatCard label="Active Paying Members" value={number(view.active)} note={view.conversion.toFixed(1) + '% of registered users'} icon="user" accent="blue"/>
      <StatCard label="Current Access" value={number(view.access)} note={view.cancelling ? number(view.cancelling) + ' cancelling at period end' : 'No scheduled cancellations'} icon="bookmark" accent="pink"/>
      <StatCard label="Processed Gross · 30d" value={money(view.gross30d)} note={number(view.chargeCount) + ' membership charges all time'} icon="sparkle" accent="gold"/>
    </div>

    <div className="ar-membership-main-grid">
      <GlassCard className="ar-membership-revenue-card">
        <SectionHeader eyebrow="REVENUE OUTLOOK" title="What the current membership base is worth" description="MRR is an estimate based on active, still-valid subscriptions at today's plan prices."/>
        <div className="ar-membership-money-row">
          <div><span>Estimated monthly</span><strong>{money(view.mrr)}</strong><small>Recurring revenue if all eligible active subscriptions renew.</small></div>
          <div><span>Annual run-rate</span><strong>{money(view.arr)}</strong><small>MRR × 12 · not a forecast of future signups.</small></div>
        </div>
        <div className="ar-membership-metrics">
          <div><span>At-risk MRR</span><strong>{money(view.atRiskMrr)}</strong><small>Active subscriptions already marked to cancel.</small></div>
          <div><span>Renewals · next 30d</span><strong>{number(view.renewals30d)}</strong><small>Auto-renewing subscriptions with an end date in the next 30 days.</small></div>
          <div><span>Next renewal</span><strong>{view.nextRenewal ? date(view.nextRenewal) : 'None scheduled'}</strong><small>{view.nextRenewal ? 'Earliest current auto-renewal.' : 'No active subscription is scheduled to renew.'}</small></div>
        </div>
      </GlassCard>

      <GlassCard className="ar-membership-processed-card">
        <SectionHeader eyebrow="PROCESSED BILLING" title="Razorpay history" description="Gross membership charges recorded by the Atma Rekha webhook."/>
        <div className="ar-membership-processed-total"><span>All-time processed gross</span><strong>{money(view.grossAllTime)}</strong></div>
        <div className="ar-membership-processed-list">
          <div><span>Last 30 days</span><strong>{money(view.gross30d)}</strong></div>
          <div><span>Successful charge events</span><strong>{number(view.chargeCount)}</strong></div>
          <div><span>Latest charge</span><strong>{dateTime(view.lastCharge)}</strong></div>
          <div><span>Settlement / fees</span><strong>Not included</strong></div>
        </div>
      </GlassCard>
    </div>

    <div className="ar-membership-secondary-grid">
      <GlassCard>
        <SectionHeader eyebrow="PLAN MIX" title="Membership plans" description="Current plan configuration and live subscriber counts."/>
        <div className="ar-membership-plan-grid">
          {view.plans.map(plan => <article className="ar-membership-plan" key={plan.id}>
            <div className="ar-membership-plan-top"><span>{plan.name}</span><b>{money(plan.amountInr)}<small>/mo</small></b></div>
            <div className="ar-membership-plan-bar"><i style={{ width: (view.active ? Math.min(100, plan.activeBillable / view.active * 100) : 0) + '%' }}/></div>
            <div className="ar-membership-plan-stats"><span><strong>{number(plan.activeBillable)}</strong> active</span><span><strong>{number(plan.accessMembers)}</strong> access</span><span><strong>{number(plan.cancelling)}</strong> cancelling</span><span><strong>{number(plan.pending)}</strong> pending</span></div>
          </article>)}
          {!view.plans.length && <div className="ar-membership-empty"><strong>No plans found</strong><span>Membership plans will appear here when configured.</span></div>}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow="HEALTH" title="Membership health" description="Signals worth watching as the program grows."/>
        <div className="ar-membership-health-grid">
          <div><span>Pending checkout records</span><strong>{number(view.pending)}</strong><small>Not counted in MRR</small></div>
          <div><span>Cancelled records</span><strong>{number(view.cancelledRecords)}</strong><small>Historical subscription records</small></div>
          <div><span>Failed subscriptions</span><strong>{number(view.failed)}</strong><small>Needs payment recovery if this rises</small></div>
          <div><span>Paid conversion</span><strong>{view.conversion.toFixed(1)}%</strong><small>Active paying ÷ registered users</small></div>
        </div>
      </GlassCard>
    </div>

    <div className="ar-membership-secondary-grid">
      <GlassCard>
        <SectionHeader eyebrow="TREND · 6 MONTHS" title="Subscription activity" description="New subscriptions and cancellations, with processed gross charges underneath."/>
        <MembershipTrend rows={view.trend}/>
      </GlassCard>
      <GlassCard>
        <SectionHeader eyebrow="RECENT" title="Membership activity" description="Latest subscription state changes. No member identity is shown."/>
        <div className="ar-membership-activity">
          {view.activity.map(item => <div className="ar-membership-activity-row" key={item.id}>
            <span className="ar-membership-activity-icon"><AdminIcon name={item.status === 'cancelled' ? 'flag' : item.status === 'active' ? 'sparkle' : 'pulse'} size={15}/></span>
            <div><strong>{item.plan_name} · {money(item.amount_inr)}/mo</strong><small><StatusBadge status={item.status}/> {item.cancel_at_period_end ? 'Cancels at period end · ' : ''}{dateTime(item.changed_at)}</small></div>
          </div>)}
          {!view.activity.length && <div className="ar-membership-empty"><strong>No membership activity</strong><span>Subscription events will appear here.</span></div>}
        </div>
      </GlassCard>
    </div>

    <div className="ar-membership-note">
      <AdminIcon name="settings" size={18}/>
      <div><strong>How these numbers work</strong><p><b>Estimated MRR</b> = active, still-valid paid subscriptions × their current monthly plan price. Pending and cancelled subscriptions are not counted in MRR. <b>Processed gross</b> comes from Razorpay <code>subscription.charged</code> webhook events; it is not the same as net payout because fees, refunds and settlement timing are not represented here.</p></div>
    </div>
  </section>;
}
