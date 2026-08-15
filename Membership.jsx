import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';

const LAUNCH_DATE = new Date('2026-09-14T00:00:00+05:30');
const FREE_CHAPTERS = 7;
const PLANS = [
  { id: 'free', icon: '🆓', name: 'Free Member', amount: 0, description: 'Start the Atma Rekha journey with no payment required.', features: ['Chapters 1–7 forever free', 'Bookmarks & reading history', 'Ratings, comments & notifications'] },
  { id: 'mini_member', icon: '🧸', name: 'Mini Member', amount: 29, description: 'A simple way to become part of the Atma Rekha journey.', features: ['All chapters', '🧸 Mini Member badge', 'Support future chapters'] },
  { id: 'supporter', icon: '🌸', name: 'Member', amount: 49, popular: true, description: 'Our most popular way to join and support Atma Rekha.', features: ['All chapters', '🌸 Member badge', 'Member recognition', 'Support future chapters'] },
  { id: 'premium', icon: '🦚', name: 'Premium Member', amount: 99, description: 'Our highest membership tier for the strongest supporters.', features: ['All chapters', '🦚 Premium Member badge', 'Priority comment placement', 'Premium recognition'] },
];
function freePeriodEnds() { const d = new Date(LAUNCH_DATE); d.setMonth(d.getMonth() + 3); return d; }
function isFreePeriod() { return Date.now() < freePeriodEnds().getTime(); }
function routeNow() { return window.location.hash.replace(/^#/, '') || 'home'; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

export default function Membership() {
  const [route, setRoute] = useState(routeNow());
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const freePeriod = isFreePeriod();
  const graceEnd = useMemo(() => freePeriodEnds(), []);

  const loadSubscription = async currentUser => {
    if (!currentUser) { setSubscription(null); return; }
    const { data } = await supabase.from('user_subscriptions').select('plan_id,status,current_period_start,current_period_end,cancel_at_period_end,provider_subscription_id').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    setSubscription(data || null);
  };

  useEffect(() => {
    const onHash = () => setRoute(routeNow()); window.addEventListener('hashchange', onHash);
    const load = async () => { const { data } = await supabase.auth.getSession(); const current = data?.session?.user || null; setUser(current); await loadSubscription(current); };
    load(); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { const current = session?.user || null; setUser(current); loadSubscription(current); });
    return () => { window.removeEventListener('hashchange', onHash); listener.subscription.unsubscribe(); };
  }, []);

  const beginCheckout = async plan => {
    if (!user) { window.location.hash = 'login'; return; }
    const normalizedPhone = (phone.trim() || user.phone || '').replace(/^\+91/, '').slice(-10);
    if (!/^\d{10}$/.test(normalizedPhone)) return;
    setError(''); setMessage(''); setSelected(plan); setLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-cashfree-subscription', { body: { plan_id: plan.id, phone: normalizedPhone } });
      if (invokeError) throw invokeError;
      if (!data?.subscription_session_id || !data?.subscription_id) throw new Error(data?.error || 'Unable to start secure checkout.');
      const { openCashfreeSubscription } = await import('./cashfree-web.js');
      await openCashfreeSubscription({ subscriptionId: data.subscription_id, subscriptionSessionId: data.subscription_session_id, production: data.environment === 'production' });
    } catch (err) { setError(err?.message || 'Unable to start membership checkout.'); } finally { setLoading(false); }
  };

  const choosePaidPlan = plan => {
    setError(''); setMessage(''); setSelected(plan);
    if (!user) { window.location.hash = 'login'; return; }
    const existingPhone = (user.phone || '').replace(/^\+91/, '').slice(-10);
    if (/^\d{10}$/.test(existingPhone)) beginCheckout(plan);
  };

  const cancelMembership = async () => {
    if (!subscription?.provider_subscription_id) { setError('Your subscription reference is unavailable. Please contact Atma Rekha support.'); return; }
    if (!window.confirm('Cancel future renewals? Your current membership remains active until the current period ends.')) return;
    setCancelling(true); setError(''); setMessage('');
    try { const { data, error: invokeError } = await supabase.functions.invoke('cancel-cashfree-subscription-v2', { body: { subscription_id: subscription.provider_subscription_id } }); if (invokeError) throw invokeError; if (!data?.ok) throw new Error(data?.error || 'Unable to cancel the subscription.'); setMessage('Cancellation scheduled. No further renewal will be taken.'); await loadSubscription(user); } catch (err) { setError(err?.message || 'Unable to cancel membership.'); } finally { setCancelling(false); }
  };

  if (!route.startsWith('membership')) return <MembershipLauncher user={user} />;
  const active = subscription?.status === 'active';
  const currentPlan = PLANS.find(plan => plan.id === subscription?.plan_id);
  const enteredPhone = (phone || user?.phone || '').replace(/^\+91/, '').slice(-10);
  const needsPhone = Boolean(selected && user && !/^\d{10}$/.test(enteredPhone));

  return createPortal(<div className="membership-overlay" role="dialog" aria-modal="true" aria-label="Atma Rekha membership">
    <div className="membership-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) window.location.hash = 'profile'; }} />
    <section className="membership-sheet">
      <header className="membership-head"><button type="button" className="membership-close" onClick={() => window.location.hash = 'profile'} aria-label="Close membership">×</button><div><p className="membership-kicker">ATMA REKHA · MEMBERSHIP</p><h1>Choose your place in the journey.</h1><p>{freePeriod ? `Membership is completely optional until ${formatDate(graceEnd)}.` : 'Chapters 1–7 remain free forever. Membership unlocks Chapter 8 onward.'}</p></div></header>
      <div className="membership-trust"><span>🔒 Secure checkout</span><span>↻ UPI AutoPay</span><span>✦ Cancel anytime</span></div>
      {active && <div className="membership-active"><span className="membership-active-icon">✓</span><div><strong>{currentPlan?.icon} {currentPlan?.name || 'Member'}</strong><small>Active · Next renewal {formatDate(subscription.current_period_end)}</small></div>{!subscription.cancel_at_period_end && <button type="button" onClick={cancelMembership} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel renewal'}</button>}{subscription.cancel_at_period_end && <em>Cancellation scheduled</em>}</div>}
      <div className="membership-banners" aria-label="Membership plans">
        {PLANS.map(plan => <PlanCard key={plan.id} plan={plan} current={plan.id === 'free' ? !active : active && subscription.plan_id === plan.id} busy={loading && selected?.id === plan.id} onChoose={() => plan.id === 'free' ? (window.location.hash = 'home') : choosePaidPlan(plan)} />)}
      </div>
      <div className="membership-banner-hint"><span>Swipe to explore</span><span>● ○ ○ ○</span></div>
      <div className="membership-free-note"><strong>🌸 Seven chapters. Completely free.</strong><span>Chapters 1–7 never require a paid membership.</span></div>
      {needsPhone && <div className="membership-phone"><div><strong>One small step before UPI AutoPay</strong><span>Cashfree needs your mobile number to create the subscription mandate.</span></div><input value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile number" aria-label="Mobile number" /><button type="button" disabled={phone.length !== 10 || loading} onClick={() => beginCheckout(selected)}>Continue to payment</button></div>}
      {message && <p className="membership-success">✓ {message}</p>}{error && <p className="membership-error">{error}</p>}
      <p className="membership-legal">Payments are processed securely by Cashfree. UPI AutoPay is activated only after you approve the mandate in your UPI app.</p>
    </section>
  </div>, document.body);
}

function PlanCard({ plan, current, busy, onChoose }) { return <article className={`membership-plan ${plan.popular ? 'is-popular' : ''} ${current ? 'is-current' : ''}`}><div className="membership-plan-icon">{plan.icon}</div><p className="membership-plan-label">{plan.id === 'free' ? 'FREE' : plan.id === 'mini_member' ? 'MINI' : plan.id === 'supporter' ? 'MEMBER' : 'PREMIUM'}</p><h2>{plan.name}</h2><p className="membership-price">₹{plan.amount}<small>{plan.amount ? ' / month' : ''}</small></p><p className="membership-description">{plan.description}</p><ul>{plan.features.map(feature => <li key={feature}>✓ {feature}</li>)}</ul><button type="button" className={`membership-button ${current ? 'current' : ''}`} disabled={current || busy} onClick={onChoose}>{current ? 'Current plan' : busy ? 'Opening checkout…' : plan.amount ? `Subscribe · ₹${plan.amount}/month` : 'Read Chapters 1–7'}</button></article>; }

function MembershipLauncher({ user }) { const [ready, setReady] = useState(false); useEffect(() => { if (!user) return undefined; const mount = () => { const card = document.querySelector('.profile-v2-card'); const community = card?.querySelector('.profile-community-card'); if (!card || !community) return false; let slot = card.querySelector('.profile-membership-slot'); if (!slot) { slot = document.createElement('div'); slot.className = 'profile-membership-slot'; community.insertAdjacentElement('afterend', slot); } setReady(true); return true; }; mount(); const observer = new MutationObserver(mount); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect(); }, [user]); if (!ready) return null; const slot = document.querySelector('.profile-membership-slot'); if (!slot) return null; return createPortal(<button type="button" className="profile-membership-launcher" onClick={() => window.location.hash = 'membership'}><span className="profile-membership-launcher-icon">✦</span><span><strong>Membership</strong><small>Choose your Atma Rekha membership</small></span><b>→</b></button>, slot); }
