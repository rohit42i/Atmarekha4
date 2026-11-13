import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import './rewards-page.css';

const REWARD_PLANS = [
  {
    id: 'mini_member',
    name: 'Supporter',
    amount: 19,
    billing: 'month',
    coins: 1000,
    duration: '30 days',
    access: 'Atma Rekha chapters 9 and above',
    detail: 'Continue the main story and support its creation.',
  },
  {
    id: 'supporter',
    name: 'Premium Supporter',
    amount: 29,
    billing: 'month',
    coins: 2000,
    duration: '30 days',
    access: 'Atma Rekha and Pal Do Pal Ke Lamhe',
    detail: 'Read both stories with one membership.',
  },
  {
    id: 'premium_yearly',
    name: 'Super Supporter',
    amount: 299,
    billing: 'year',
    coins: 15000,
    duration: '365 days',
    access: 'Atma Rekha and Pal Do Pal Ke Lamhe',
    detail: 'Full access to both stories for a full year.',
  },
];

const coinText = value => Math.max(0, Number(value) || 0).toLocaleString('en-IN');
const dateText = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};
const timeText = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
};
const planFor = id => REWARD_PLANS.find(plan => plan.id === id);
const planName = id => planFor(id)?.name || (id === 'premium' ? 'Super Supporter' : 'Membership');

async function copyText(text) {
  if (!text) throw new Error('There is nothing to copy.');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {}

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.left = '-9999px';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    field.remove();
  }
  if (!copied) throw new Error('Your browser could not copy the link. Please copy it manually.');
}

export default function RewardsPage() {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [busyPlan, setBusyPlan] = useState('');
  const [confirmPlan, setConfirmPlan] = useState(null);
  const confirmButtonRef = useRef(null);
  const requestId = useRef(0);

  const load = useCallback(async currentUser => {
    const request = ++requestId.current;
    if (!currentUser) {
      setSummary(null);
      setLoadError('');
      setLoading(false);
      return null;
    }

    setLoading(true);
    setLoadError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_referral_rewards');
      if (rpcError) throw rpcError;
      if (!data || typeof data !== 'object') throw new Error('Rewards data could not be read. Please refresh and try again.');
      if (request !== requestId.current) return null;
      setSummary(data);
      return data;
    } catch (loadError) {
      if (request === requestId.current) {
        console.error('Rewards could not be loaded:', loadError);
        setLoadError(loadError?.message || 'Rewards are temporarily unavailable. Please try again.');
      }
      return null;
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        const currentUser = data?.session?.user || null;
        setUser(currentUser);
        await load(currentUser);
      } catch (sessionError) {
        if (active) {
          setLoadError(sessionError?.message || 'Your sign-in session could not be checked. Please refresh and try again.');
          setLoading(false);
        }
      }
    };

    initialize();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) return;
      const currentUser = session?.user || null;
      if (!active) return;
      setUser(currentUser);
      setActionError('');
      setNotice('');
      queueMicrotask(() => {
        if (active) load(currentUser);
      });
    });

    return () => {
      active = false;
      requestId.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [load]);

  useEffect(() => {
    if (!confirmPlan) return undefined;
    confirmButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = event => {
      if (event.key === 'Escape' && !busyPlan) setConfirmPlan(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [confirmPlan, busyPlan]);

  const referralLink = summary?.referral_link || (summary?.referral_code
    ? `https://www.atmarekha.in/?ref=${encodeURIComponent(summary.referral_code)}`
    : '');
  const balance = Number(summary?.coin_balance || 0);
  const activeReward = summary?.active_reward_membership || null;
  const paidMembership = summary?.paid_membership || null;
  const paidMembershipPending = Boolean(summary?.paid_membership_pending);
  const membershipBlocked = Boolean(activeReward || paidMembership || paidMembershipPending);

  const copyLink = useCallback(async () => {
    if (!referralLink) return;
    setActionError('');
    setNotice('');
    try {
      await copyText(referralLink);
      setCopied(true);
      setNotice('Your invite link has been copied. Share it with a friend.');
      window.setTimeout(() => setCopied(false), 2200);
    } catch (copyError) {
      setActionError(copyError?.message || 'Could not copy your invite link.');
    }
  }, [referralLink]);

  const copyCode = useCallback(async () => {
    if (!summary?.referral_code) return;
    setActionError('');
    setNotice('');
    try {
      await copyText(summary.referral_code);
      setNotice('Your invite code has been copied.');
    } catch (copyError) {
      setActionError(copyError?.message || 'Could not copy your invite code.');
    }
  }, [summary?.referral_code]);

  const shareLink = useCallback(async () => {
    if (!referralLink || sharing) return;
    setSharing(true);
    setActionError('');
    setNotice('');
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Read Atma Rekha',
          text: 'Join me on Atma Rekha. Create a new account using my invite link.',
          url: referralLink,
        });
        setNotice('Thanks for sharing Atma Rekha.');
      } else {
        await copyText(referralLink);
        setCopied(true);
        setNotice('Your invite link has been copied. Share it with a friend.');
        window.setTimeout(() => setCopied(false), 2200);
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') {
        try {
          await copyText(referralLink);
          setCopied(true);
          setNotice('Sharing was unavailable, so your invite link has been copied instead.');
          window.setTimeout(() => setCopied(false), 2200);
        } catch (copyError) {
          setActionError(copyError?.message || 'Sharing is unavailable. Please try copying the invite link.');
        }
      }
    } finally {
      setSharing(false);
    }
  }, [referralLink, sharing]);

  const claimRewards = useCallback(async () => {
    if (claiming || !user || loading) return;
    setClaiming(true);
    setActionError('');
    setNotice('');
    try {
      const { data, error: claimError } = await supabase.rpc('claim_referral_rewards');
      if (claimError) throw claimError;
      await load(user);
      const coins = Number(data?.coins_claimed || 0);
      const count = Number(data?.referrals_claimed || 0);
      setNotice(coins > 0
        ? `${coinText(coins)} coins have been added from ${count} verified friend${count === 1 ? '' : 's'}.`
        : 'There are no unclaimed verified referrals. New coins are added automatically after a friend verifies their email.');
    } catch (claimError) {
      setActionError(claimError?.message || 'Could not claim verified rewards. Please try again.');
    } finally {
      setClaiming(false);
    }
  }, [claiming, user, loading, load]);

  const openRedemption = plan => {
    setActionError('');
    setNotice('');
    setConfirmPlan(plan);
  };

  const confirmRedemption = useCallback(async () => {
    if (!confirmPlan || busyPlan || !user) return;
    const plan = confirmPlan;
    setBusyPlan(plan.id);
    setActionError('');
    setNotice('');
    try {
      const { data, error: redeemError } = await supabase.rpc('redeem_reward_subscription', { p_plan_id: plan.id });
      if (redeemError) throw redeemError;
      if (!data?.ok) throw new Error('The redemption could not be confirmed. Refresh your rewards history before trying again.');
      setConfirmPlan(null);
      window.dispatchEvent(new Event('atma:membership-updated'));
      await load(user);
      setNotice(`${plan.name} access is now active until ${dateText(data.expires_at)}. Your coins have been deducted.`);
    } catch (redeemError) {
      setConfirmPlan(null);
      setActionError(redeemError?.message || 'The redemption failed. Your coin balance has not been changed.');
    } finally {
      setBusyPlan('');
    }
  }, [confirmPlan, busyPlan, user, load]);

  const referrals = summary?.referrals || [];
  const transactions = summary?.transactions || [];
  const redemptions = summary?.redemptions || [];
  const totalInvited = Number(summary?.total_invited || 0);
  const verifiedReferrals = Number(summary?.verified_referrals || 0);
  const pendingReferrals = Number(summary?.pending_referrals || 0);
  const coinsEarned = Number(summary?.coins_earned || 0);
  const coinsSpent = Number(summary?.coins_spent || 0);

  const redemptionLabel = item => {
    if (item.status === 'reversed') return 'Reversed';
    if (item.expires_at && new Date(item.expires_at).getTime() > Date.now()) return `Active until ${dateText(item.expires_at)}`;
    return item.status === 'completed' ? 'Expired' : 'Pending';
  };

  const membershipNotice = useMemo(() => {
    if (activeReward?.expires_at) {
      return {
        title: `${planName(activeReward.plan_id)} rewards access is active`,
        detail: `Your membership expires on ${dateText(activeReward.expires_at)}. You can redeem another reward after it expires.`,
      };
    }
    if (paidMembership) {
      return {
        title: 'Your paid membership is active',
        detail: paidMembership.current_period_end
          ? `Your coins are safe. You can redeem a reward after ${dateText(paidMembership.current_period_end)}.`
          : 'Your coins are safe. You can redeem a reward after your current membership ends.',
      };
    }
    if (paidMembershipPending) {
      return {
        title: 'A paid membership checkout is pending',
        detail: 'Finish that checkout or wait for it to expire before redeeming coins. Your balance will remain unchanged.',
      };
    }
    return null;
  }, [activeReward, paidMembership, paidMembershipPending]);

  const txLabel = item => item.transaction_type === 'referral_reward'
    ? 'Verified friend joined'
    : item.transaction_type === 'subscription_redemption'
      ? 'Membership redeemed'
      : item.amount > 0 ? 'Coins adjusted' : 'Coin adjustment';

  if (loading && !user) {
    return <main className="site-shell rewards-page">
      <header className="subpage-header rewards-page-header">
        <button className="back-button" type="button" onClick={() => { window.location.hash = 'more'; }} aria-label="Back to More and Settings">←</button>
        <div><p className="header-kicker">ATMA REKHA</p><h1>Rewards &amp; Referrals</h1></div>
      </header>
      <div className="rewards-page-content">
        <div className="rewards-loading-card" role="status" aria-live="polite">
          <span className="rewards-loading-line rewards-loading-short" />
          <span className="rewards-loading-line rewards-loading-number" />
          <span className="rewards-loading-line" />
          <span className="rewards-loading-caption">Checking your account…</span>
        </div>
      </div>
    </main>;
  }

  if (!user) {
    return <main className="site-shell rewards-page">
      <header className="subpage-header rewards-page-header">
        <button className="back-button" type="button" onClick={() => { window.location.hash = 'more'; }} aria-label="Back to More and Settings">←</button>
        <div><p className="header-kicker">ATMA REKHA</p><h1>Rewards &amp; Referrals</h1></div>
      </header>
      <div className="rewards-page-content">
        <section className="rewards-signin-card">
          <div className="rewards-signin-mark" aria-hidden="true">AR</div>
          <p className="section-eyebrow">READER REWARDS</p>
          <h2>Your invites. Your rewards.</h2>
          <p>Sign in to get your personal invite link, collect coins and redeem membership access.</p>
          <button type="button" className="rewards-primary-button" onClick={() => window.dispatchEvent(new CustomEvent('atma-open-auth', { detail: { mode: 'login', returnTo: 'rewards' } }))}>Sign in to continue</button>
        </section>
        {loadError && <p className="rewards-alert rewards-alert-error" role="alert">{loadError}</p>}
      </div>
    </main>;
  }

  return <main className="site-shell rewards-page">
    <header className="subpage-header rewards-page-header">
      <button className="back-button" type="button" onClick={() => { window.location.hash = 'more'; }} aria-label="Back to More and Settings">←</button>
      <div><p className="header-kicker">ATMA REKHA</p><h1>Rewards &amp; Referrals</h1></div>
    </header>

    <div className="rewards-page-content">
      <section className="rewards-intro-row">
        <div>
          <p className="section-eyebrow">READER REWARDS</p>
          <h2>Invite friends. Earn coins.</h2>
          <p>Invite a friend using your link. You get 100 coins after they create an account and verify their email.</p>
        </div>
        <button type="button" className="rewards-refresh-button" aria-label={loading ? 'Refreshing rewards' : 'Refresh rewards balance'} onClick={() => load(user)} disabled={loading || claiming || Boolean(busyPlan)}>
          <span aria-hidden="true">{loading ? '…' : '↻'}</span>{loading ? 'Refreshing' : 'Refresh'}
        </button>
      </section>

      {loadError && <div className="rewards-alert rewards-alert-error" role="alert">
        <div><strong>Could not load your rewards</strong><span>{loadError}</span></div>
        <button type="button" className="rewards-alert-action" onClick={() => load(user)} disabled={loading}>Try again</button>
      </div>}
      {actionError && <div className="rewards-alert rewards-alert-error" role="alert"><div><strong>Something needs your attention</strong><span>{actionError}</span></div><button type="button" className="rewards-alert-dismiss" aria-label="Dismiss message" onClick={() => setActionError('')}>×</button></div>}
      {notice && <div className="rewards-alert rewards-alert-success" role="status" aria-live="polite"><div><strong>Update</strong><span>{notice}</span></div><button type="button" className="rewards-alert-dismiss" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}

      <section className="rewards-overview" aria-label="Your rewards overview">
        <article className="rewards-balance-card">
          <div className="rewards-balance-copy">
            <p className="section-eyebrow">AVAILABLE BALANCE</p>
            <strong>{loading && !summary ? '—' : coinText(balance)}</strong>
            <span>Coins ready to redeem</span>
          </div>
          <div className="rewards-balance-side">
            <span className="rewards-coin-mark" aria-hidden="true">◎</span>
            <span className="rewards-balance-caption">Earn 100 coins<br />per verified friend</span>
          </div>
        </article>
        <div className="rewards-stats-grid">
          <article className="rewards-stat-card"><strong>{summary ? coinText(verifiedReferrals) : '—'}</strong><span>Verified friends</span></article>
          <article className="rewards-stat-card"><strong>{summary ? coinText(pendingReferrals) : '—'}</strong><span>Friends who still need to verify</span></article>
          <article className="rewards-stat-card"><strong>{summary ? coinText(coinsEarned) : '—'}</strong><span>Total coins earned</span></article>
        </div>
      </section>

      <section className="rewards-invite-card">
        <div className="rewards-invite-copy">
          <p className="section-eyebrow">YOUR PERSONAL INVITE</p>
          <h2>Invite a friend to read with you.</h2>
          <p>Send your invite link to a friend. Once they sign up and verify their email, 100 coins are added to your balance.</p>
        </div>
        <div className="rewards-invite-details">
          <div className="rewards-code-row">
            <div><span>YOUR INVITE CODE</span><strong>{summary?.referral_code || (loading ? 'Preparing…' : 'Unavailable')}</strong></div>
            <button type="button" className="rewards-secondary-button rewards-copy-code" onClick={copyCode} disabled={!summary?.referral_code || loading}>Copy code</button>
          </div>
          <div className="rewards-link-box">
            <span>{referralLink || (loading ? 'Preparing your invite link…' : 'Invite link unavailable')}</span>
          </div>
          <div className="rewards-share-actions">
            <button type="button" className="rewards-primary-button" onClick={shareLink} disabled={!referralLink || loading || sharing}>
              {sharing ? 'Opening share…' : 'Share invite link'}
            </button>
            <button type="button" className="rewards-secondary-button" onClick={copyLink} disabled={!referralLink || loading}>
              {copied ? 'Copied' : 'Copy invite link'}
            </button>
          </div>
        </div>
      </section>

      <section className="rewards-membership-section">
        <div className="rewards-section-heading">
          <div><p className="section-eyebrow">MEMBERSHIP REWARDS</p><h2>Redeem your coins</h2><p>Use your coins to unlock membership. Each option shows the coins needed and how long access lasts.</p></div>
          <span className="rewards-section-side-note">No auto-renewal</span>
        </div>

        {membershipNotice && <div className="rewards-membership-notice" role="status">
          <span className="rewards-membership-notice-mark" aria-hidden="true">i</span>
          <div><strong>{membershipNotice.title}</strong><span>{membershipNotice.detail}</span></div>
        </div>}

        {!summary && loadError ? <div className="rewards-inline-error">Membership options are unavailable until your balance loads. Try refreshing your rewards.</div> : <div className="rewards-plan-grid">
          {REWARD_PLANS.map(plan => {
            const remaining = Math.max(0, plan.coins - balance);
            const progress = Math.min(100, Math.round((balance / plan.coins) * 100));
            const canRedeem = Boolean(summary) && !loading && !membershipBlocked && remaining === 0 && !busyPlan && !loadError;
            let buttonLabel = 'Redeem membership';
            if (busyPlan === plan.id) buttonLabel = 'Redeeming…';
            else if (loading && !summary) buttonLabel = 'Loading balance…';
            else if (activeReward) buttonLabel = 'Current reward active';
            else if (paidMembership) buttonLabel = 'Available after membership';
            else if (paidMembershipPending) buttonLabel = 'Complete paid checkout first';
            else if (loading) buttonLabel = 'Checking balance…';
            else if (loadError) buttonLabel = 'Refresh to check';
            else if (remaining > 0) buttonLabel = `Need ${coinText(remaining)} more coins`;

            return <article className="rewards-plan-card" key={plan.id}>
              <div className="rewards-plan-topline">
                <span className="rewards-plan-category">{plan.billing === 'year' ? 'YEARLY ACCESS' : 'MONTHLY ACCESS'}</span>
                {plan.id === 'supporter' && <span className="rewards-plan-featured">BOTH STORIES</span>}
              </div>
              <h3>{plan.name}</h3>
              <p className="rewards-plan-detail">{plan.detail}</p>
              <div className="rewards-plan-price"><strong>₹{plan.amount}</strong><span>/{plan.billing}</span></div>
              <div className="rewards-plan-access">{plan.access}</div>
              <div className="rewards-plan-cost"><strong>{coinText(plan.coins)}</strong><span>coins required</span></div>
              <div className="rewards-plan-duration">{plan.duration} of access</div>
              <div className="rewards-progress-track" role="progressbar" aria-label={`${plan.name} coin progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="rewards-progress-label">{summary ? remaining === 0 ? 'You have enough coins' : `${coinText(remaining)} more to go` : 'Balance unavailable'}</div>
              <button type="button" className="rewards-redeem-button" disabled={!canRedeem} onClick={() => openRedemption(plan)}>{buttonLabel}</button>
            </article>;
          })}
        </div>}
        <p className="rewards-footnote">Coins are earned through verified new accounts. Membership rewards are activated immediately after redemption and expire after the displayed period. Paid and reward memberships cannot overlap.</p>
      </section>

      <section className="rewards-history-grid">
        <article className="rewards-history-card">
          <div className="rewards-history-heading"><div><p className="section-eyebrow">REFERRALS</p><h2>Friends you invited</h2></div><span>{summary ? coinText(totalInvited) : '—'}</span></div>
          {loading && !summary ? <div className="rewards-history-empty">Loading referrals…</div> : referrals.length === 0
            ? <div className="rewards-history-empty"><strong>No friends have joined yet</strong><p>Send your invite link to a friend. They will appear here after signing up.</p></div>
            : <div className="rewards-history-list">{referrals.map(referral => <div className="rewards-history-row" key={referral.id}>
                <div className="rewards-history-main"><strong>{referral.display_name || 'New reader'}</strong><small>{timeText(referral.created_at)}</small></div>
                <span className={referral.status === 'qualified' ? 'rewards-state-qualified' : 'rewards-state-pending'}>{referral.status === 'qualified' ? '+100 coins' : 'Pending email'}</span>
              </div>)}</div>}
        </article>

        <article className="rewards-history-card">
          <div className="rewards-history-heading"><div><p className="section-eyebrow">COIN LEDGER</p><h2>Recent activity</h2></div><span>{summary ? coinText(coinsSpent) : '—'} spent</span></div>
          {loading && !summary ? <div className="rewards-history-empty">Loading activity…</div> : transactions.length === 0
            ? <div className="rewards-history-empty"><strong>No coin activity yet</strong><p>Your earnings and redemptions will appear here.</p></div>
            : <div className="rewards-history-list">{transactions.map(item => {
                const amount = Number(item.amount || 0);
                return <div className="rewards-history-row" key={item.id}>
                  <div className="rewards-history-main"><strong>{txLabel(item)}</strong><small>{timeText(item.created_at)}</small></div>
                  <span className={amount > 0 ? 'rewards-state-qualified' : 'rewards-state-spent'}>{amount > 0 ? '+' : ''}{coinText(Math.abs(amount))} coins</span>
                </div>;
              })}</div>}
        </article>
      </section>

      <section className="rewards-history-card rewards-membership-history">
        <div className="rewards-history-heading"><div><p className="section-eyebrow">REDEMPTIONS</p><h2>Membership history</h2></div><span>{summary ? coinText(redemptions.length) : '—'} records</span></div>
        {loading && !summary ? <div className="rewards-history-empty">Loading membership history…</div> : redemptions.length === 0
          ? <div className="rewards-history-empty"><strong>No memberships redeemed</strong><p>Your redeemed memberships and expiry dates will appear here.</p></div>
          : <div className="rewards-history-list">{redemptions.map(item => <div className="rewards-history-row" key={item.id}>
              <div className="rewards-history-main"><strong>{planName(item.plan_id)}</strong><small>{coinText(item.coins_spent)} coins · {dateText(item.created_at)}</small></div>
              <span className={item.status === 'completed' && item.expires_at && new Date(item.expires_at).getTime() > Date.now() ? 'rewards-state-qualified' : 'rewards-state-muted'}>{redemptionLabel(item)}</span>
            </div>)}</div>}
      </section>

      <div className="rewards-footer-actions">
        <p>Every verified friend earns you 100 coins. Your rewards remain linked to this account.</p>
        <div>
          <button type="button" className="rewards-secondary-button" onClick={claimRewards} disabled={loading || claiming || Boolean(busyPlan)}>
            {claiming ? 'Checking referrals…' : 'Claim verified rewards'}
          </button>
          <button type="button" className="rewards-secondary-button" onClick={() => load(user)} disabled={loading || claiming || Boolean(busyPlan)}>
            {loading ? 'Refreshing…' : 'Refresh balance'}
          </button>
        </div>
      </div>
    </div>

    {confirmPlan && <div className="rewards-modal-wrap" role="presentation">
      <button type="button" className="rewards-modal-backdrop" aria-label="Close membership redemption" onClick={() => { if (!busyPlan) setConfirmPlan(null); }} />
      <section className="rewards-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="rewards-confirm-title" aria-describedby="rewards-confirm-description">
        <button type="button" className="rewards-modal-close" aria-label="Close" disabled={Boolean(busyPlan)} onClick={() => setConfirmPlan(null)}>×</button>
        <p className="section-eyebrow">CONFIRM REDEMPTION</p>
        <h2 id="rewards-confirm-title">Redeem {confirmPlan.name}?</h2>
        <p id="rewards-confirm-description">This will deduct {coinText(confirmPlan.coins)} coins from your balance and activate {confirmPlan.duration} of membership access.</p>
        <div className="rewards-confirm-summary">
          <div><span>Membership</span><strong>{confirmPlan.name}</strong></div>
          <div><span>Coins to spend</span><strong>{coinText(confirmPlan.coins)}</strong></div>
          <div><span>Access period</span><strong>{confirmPlan.duration}</strong></div>
          <div><span>Auto-renewal</span><strong>No</strong></div>
        </div>
        <p className="rewards-confirm-note">Your access starts as soon as the redemption is confirmed. You cannot redeem another rewards membership while this one is active.</p>
        <div className="rewards-confirm-actions">
          <button type="button" className="rewards-secondary-button" disabled={Boolean(busyPlan)} onClick={() => setConfirmPlan(null)}>Cancel</button>
          <button ref={confirmButtonRef} type="button" className="rewards-primary-button" disabled={Boolean(busyPlan)} onClick={confirmRedemption}>{busyPlan ? 'Redeeming…' : `Confirm redemption`}</button>
        </div>
      </section>
    </div>}
  </main>;
}
