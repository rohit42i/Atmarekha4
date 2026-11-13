import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import './rewards-page.css';

const REWARD_PLANS = [
  { id: 'mini_member', name: 'Supporter', detail: 'Atma Rekha chapters 9 and above', coins: 1000, duration: '30 days' },
  { id: 'supporter', name: 'Premium Supporter', detail: 'Atma Rekha and PDPKL chapters', coins: 2000, duration: '30 days' },
  { id: 'premium_yearly', name: 'Super Supporter', detail: 'Atma Rekha and PDPKL chapters', coins: 15000, duration: '365 days' },
];
const coinText = value => Number(value || 0).toLocaleString('en-IN');
const dateText = value => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const timeText = value => value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export default function RewardsPage() {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async currentUser => {
    if (!currentUser) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_referral_rewards');
      if (rpcError) throw rpcError;
      setSummary(data || null);
    } catch (loadError) {
      console.error('Rewards could not be loaded:', loadError);
      setError(loadError?.message || 'Rewards are temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const start = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        if (alive) { setError('Your sign-in session could not be checked. Please refresh and try again.'); setLoading(false); }
        return;
      }
      const currentUser = data?.session?.user || null;
      if (alive) {
        setUser(currentUser);
        await load(currentUser);
      }
    };
    start();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      if (alive) {
        setUser(currentUser);
        queueMicrotask(() => { if (alive) load(currentUser); });
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [load]);

  const referralLink = summary?.referral_link || (summary?.referral_code
    ? `https://www.atmarekha.in/?ref=${encodeURIComponent(summary.referral_code)}`
    : '');

  const copyLink = useCallback(async () => {
    if (!referralLink) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        const field = document.createElement('textarea');
        field.value = referralLink;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const success = document.execCommand('copy');
        field.remove();
        if (!success) throw new Error('Copy is not available in this browser.');
      }
      setCopied(true);
      setNotice('Referral link copied. Share it with a friend.');
    } catch (copyError) {
      setError(copyError?.message || 'Could not copy the referral link.');
    }
  }, [referralLink]);

  const shareLink = useCallback(async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Read Atma Rekha',
          text: 'Join me on Atma Rekha. Create an account using my invite link.',
          url: referralLink,
        });
      } catch (shareError) {
        if (shareError?.name !== 'AbortError') setError('Sharing could not be opened. You can copy your invite link instead.');
      }
    } else {
      await copyLink();
    }
  }, [referralLink, copyLink]);

  const redeem = useCallback(async plan => {
    if (!summary || busyPlan) return;
    if (Number(summary.coin_balance || 0) < plan.coins) return;
    const confirmed = window.confirm(`Redeem ${coinText(plan.coins)} coins for ${plan.name} membership for ${plan.duration}? This membership will not auto-renew.`);
    if (!confirmed) return;
    setBusyPlan(plan.id);
    setError('');
    setNotice('');
    try {
      const { data, error: redeemError } = await supabase.rpc('redeem_reward_subscription', { p_plan_id: plan.id });
      if (redeemError) throw redeemError;
      if (!data?.ok) throw new Error('The redemption could not be confirmed. Refresh and check your rewards history.');
      await load(user);
      setNotice(`${plan.name} membership redeemed successfully. It is active until ${dateText(data.expires_at)}.`);
    } catch (redeemError) {
      setError(redeemError?.message || 'The redemption failed. Your coins were not changed.');
    } finally {
      setBusyPlan('');
    }
  }, [summary, busyPlan, user, load]);

  const activeReward = useMemo(() => (summary?.redemptions || []).find(item =>
    item.status === 'completed' && item.expires_at && new Date(item.expires_at).getTime() > Date.now()
  ), [summary]);

  const txLabel = item => item.transaction_type === 'referral_reward'
    ? 'Verified friend joined'
    : item.transaction_type === 'subscription_redemption'
      ? 'Membership redeemed'
      : 'Coin adjustment';

  if (!user) {
    return <main className="site-shell rewards-page">
      <header className="subpage-header">
        <button className="back-button" type="button" onClick={() => { window.location.hash = 'more'; }} aria-label="Back to More and Settings">←</button>
        <div><p className="header-kicker">ATMA REKHA</p><h1>Rewards &amp; Referrals</h1></div>
      </header>
      <section className="rewards-page-content"><div className="rewards-empty">
        <h2>Sign in to view your rewards</h2>
        <p>Your invite link, coin balance and membership redemptions are available with an Atma Rekha account.</p>
        <button type="button" className="rewards-primary-button" onClick={() => { window.location.hash = 'login'; }}>Sign in</button>
      </div></section>
    </main>;
  }

  return <main className="site-shell rewards-page">
    <header className="subpage-header">
      <button className="back-button" type="button" onClick={() => { window.location.hash = 'more'; }} aria-label="Back to More and Settings">←</button>
      <div><p className="header-kicker">ATMA REKHA</p><h1>Rewards &amp; Referrals</h1></div>
    </header>

    <section className="rewards-page-content">
      <div className="rewards-balance-card">
        <div><p className="section-eyebrow">YOUR COIN BALANCE</p><strong>{loading ? '—' : coinText(summary?.coin_balance)}</strong><span>Coins available to redeem</span></div>
        <div className="rewards-balance-mark" aria-hidden="true">AR</div>
      </div>

      <section className="rewards-invite-card">
        <p className="section-eyebrow">INVITE FRIENDS</p>
        <h2>Share Atma Rekha. Earn 100 coins.</h2>
        <p>Your friend must create a new account and verify their email. A successful verified referral earns you 100 coins once.</p>
        <div className="rewards-link-box"><span>{loading ? 'Preparing your invite link…' : referralLink || 'Invite link unavailable'}</span></div>
        <div className="rewards-share-actions">
          <button type="button" className="rewards-primary-button" onClick={shareLink} disabled={!referralLink}>Share invite link</button>
          <button type="button" className="rewards-secondary-button" onClick={copyLink} disabled={!referralLink}>{copied ? 'Copied' : 'Copy link'}</button>
        </div>
      </section>

      {error && <p className="rewards-error" role="alert">{error}</p>}
      {notice && <p className="rewards-notice" role="status" aria-live="polite">{notice}</p>}

      <section className="rewards-stats-grid" aria-label="Referral statistics">
        <div><strong>{loading ? '—' : coinText(summary?.verified_referrals)}</strong><span>Verified friends</span></div>
        <div><strong>{loading ? '—' : coinText(summary?.pending_referrals)}</strong><span>Pending verification</span></div>
        <div><strong>{loading ? '—' : coinText(summary?.coins_earned)}</strong><span>Coins earned</span></div>
      </section>

      <section className="rewards-section">
        <div className="rewards-section-heading"><div><p className="section-eyebrow">MEMBERSHIP REWARDS</p><h2>Redeem your coins</h2></div><span>One active rewards membership at a time</span></div>
        <div className="rewards-plan-grid">
          {REWARD_PLANS.map(plan => {
            const balance = Number(summary?.coin_balance || 0);
            const canRedeem = balance >= plan.coins && !loading && !activeReward && !busyPlan;
            const progress = Math.min(100, Math.round(balance / plan.coins * 100));
            return <article className="rewards-plan-card" key={plan.id}>
              <p className="rewards-plan-cost">{coinText(plan.coins)} <small>coins</small></p>
              <h3>{plan.name}</h3>
              <p>{plan.detail}</p>
              <div className="rewards-plan-duration">{plan.duration} access · No auto-renewal</div>
              <div className="rewards-progress-track" aria-label={`${progress}% of required coins available`}><span style={{ width: `${progress}%` }}/></div>
              <small className="rewards-progress-label">{balance >= plan.coins ? 'Requirement reached' : `${coinText(plan.coins - balance)} more coins needed`}</small>
              <button type="button" className="rewards-redeem-button" disabled={!canRedeem} onClick={() => redeem(plan)}>
                {busyPlan === plan.id ? 'Redeeming…' : activeReward ? 'Rewards membership active' : canRedeem ? 'Redeem membership' : 'Not enough coins'}
              </button>
            </article>;
          })}
        </div>
        <p className="rewards-footnote">At 15,000 coins, your balance is enough for any of the three options. Each redemption grants a fixed access period and does not renew automatically. Paid memberships must finish before rewards can be redeemed.</p>
      </section>

      <section className="rewards-section">
        <div className="rewards-section-heading"><div><p className="section-eyebrow">REFERRAL ACTIVITY</p><h2>Your invites</h2></div></div>
        {loading ? <p className="rewards-muted">Loading referral history…</p> : !(summary?.referrals || []).length
          ? <div className="rewards-empty"><h3>No referrals yet</h3><p>Share your invite link. Your 100 coins will be added after your friend verifies their new account.</p></div>
          : <div className="rewards-history-list">{summary.referrals.map(referral => <article className="rewards-history-row" key={referral.id}>
            <div><strong>{referral.display_name || 'New reader'}</strong><small>{timeText(referral.created_at)}</small></div>
            <span className={referral.status === 'qualified' ? 'is-qualified' : 'is-pending'}>{referral.status === 'qualified' ? '+100 coins' : 'Pending verification'}</span>
          </article>)}</div>}
      </section>

      <section className="rewards-section">
        <div className="rewards-section-heading"><div><p className="section-eyebrow">COIN HISTORY</p><h2>Recent activity</h2></div></div>
        {loading ? <p className="rewards-muted">Loading coin history…</p> : !(summary?.transactions || []).length
          ? <div className="rewards-empty"><p>Your coin earnings and redemptions will appear here.</p></div>
          : <div className="rewards-history-list">{summary.transactions.map(item => <article className="rewards-history-row" key={item.id}>
            <div><strong>{txLabel(item)}</strong><small>{timeText(item.created_at)}</small></div>
            <span className={Number(item.amount) > 0 ? 'is-qualified' : 'is-spent'}>{Number(item.amount) > 0 ? '+' : ''}{coinText(item.amount)} coins</span>
          </article>)}</div>}
      </section>

      <section className="rewards-section">
        <div className="rewards-section-heading"><div><p className="section-eyebrow">REDEMPTIONS</p><h2>Membership history</h2></div></div>
        {loading ? <p className="rewards-muted">Loading memberships…</p> : !(summary?.redemptions || []).length
          ? <div className="rewards-empty"><p>You have not redeemed a membership yet.</p></div>
          : <div className="rewards-history-list">{summary.redemptions.map(item => <article className="rewards-history-row" key={item.id}>
            <div><strong>{REWARD_PLANS.find(plan => plan.id === item.plan_id)?.name || item.plan_id}</strong><small>{coinText(item.coins_spent)} coins · {dateText(item.created_at)}</small></div>
            <span>{item.status === 'completed' && item.expires_at && new Date(item.expires_at).getTime() > Date.now() ? `Active until ${dateText(item.expires_at)}` : item.status === 'reversed' ? 'Reversed' : 'Expired'}</span>
          </article>)}</div>}
      </section>
      <div className="rewards-bottom-actions"><button type="button" className="rewards-secondary-button" onClick={() => load(user)} disabled={loading}>Refresh rewards</button></div>
    </section>
  </main>;
}
