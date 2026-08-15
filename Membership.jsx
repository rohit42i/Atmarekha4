import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';

const LAUNCH_DATE = new Date('2026-09-14T00:00:00+05:30');
const PLANS = [
  { id: 'free', icon: '🆓', name: 'Free Member', amount: 0, eyebrow: 'DISCOVER', description: 'Begin the story with nothing between you and Atma Rekha.', features: ['Chapters 1–7 forever free', 'Bookmarks & reading history', 'Ratings, comments & notifications'] },
  { id: 'mini_member', icon: '🧸', name: 'Mini Member', amount: 29, eyebrow: 'A LITTLE MORE', description: 'Keep the journey going and become part of Atma Rekha.', features: ['All chapters', '🧸 Mini Member badge', 'Support future chapters'] },
  { id: 'supporter', icon: '🌸', name: 'Member', amount: 49, eyebrow: 'MOST CHOSEN', popular: true, description: 'The balanced way to experience and help grow the world of Atma Rekha.', features: ['All chapters', '🌸 Member badge', 'Member recognition', 'Support future chapters'] },
  { id: 'premium', icon: '🦚', name: 'Premium Member', amount: 99, eyebrow: 'PREMIUM', description: 'For readers who want to stand closest to the journey.', features: ['All chapters', '🦚 Premium Member badge', 'Priority comment placement', 'Premium recognition'] },
];
function freePeriodEnds() { const d = new Date(LAUNCH_DATE); d.setMonth(d.getMonth() + 3); return d; }
function isFreePeriod() { return Date.now() < freePeriodEnds().getTime(); }
function routeNow() { return window.location.hash.replace(/^#/, '') || 'home'; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function parseRouteQuery(route) { const q = route.indexOf('?'); return q >= 0 ? new URLSearchParams(route.slice(q + 1)) : new URLSearchParams(); }

export default function Membership() {
  const [route, setRoute] = useState(routeNow());
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selected, setSelected] = useState(null);
  const [flowOpen, setFlowOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const freePeriod = isFreePeriod();
  const graceEnd = useMemo(() => freePeriodEnds(), []);

  const loadSubscription = async currentUser => {
    if (!currentUser) { setSubscription(null); return null; }
    const { data } = await supabase.from('user_subscriptions').select('plan_id,status,current_period_start,current_period_end,cancel_at_period_end,provider_subscription_id').eq('user_id', currentUser.id).maybeSingle();
    setSubscription(data || null);
    return data || null;
  };

  const verifyReturnedSubscription = async currentUser => {
    const params = parseRouteQuery(route);
    const returnedId = params.get('subscription_id');
    if (!currentUser || !returnedId) return;
    setLoading(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('verify-cashfree-subscription', { body: { subscription_id: returnedId } });
      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'UPI AutoPay authorization is not active yet.');
      setMessage('Membership activated successfully.');
      await loadSubscription(currentUser);
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
    } catch (err) {
      setError(err?.message || 'We could not verify the Cashfree subscription yet.');
      await loadSubscription(currentUser);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const onHash = () => setRoute(routeNow());
    window.addEventListener('hashchange', onHash);
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const current = data?.session?.user || null;
      setUser(current);
      setPhone(current?.phone || current?.user_metadata?.phone || '');
      await loadSubscription(current);
      await verifyReturnedSubscription(current);
    };
    load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = session?.user || null;
      setUser(current);
      setPhone(current?.phone || current?.user_metadata?.phone || '');
      loadSubscription(current);
    });
    return () => { window.removeEventListener('hashchange', onHash); listener.subscription.unsubscribe(); };
  }, [route]);

  const beginCheckout = async plan => {
    if (!user) { window.location.hash = 'login'; return; }
    const normalizedPhone = phone.replace(/\D/g, '');
    if (!/^\d{10,15}$/.test(normalizedPhone)) { setError('Please enter a valid mobile number before continuing.'); return; }
    setError(''); setMessage(''); setLoading(true); setFlowOpen(false);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-cashfree-subscription', { body: { plan_id: plan.id, phone: normalizedPhone } });
      if (invokeError) throw invokeError;
      if (!data?.subscription_id || !data?.subscription_session_id) throw new Error(data?.error || 'Unable to start UPI AutoPay checkout.');
      if (typeof window.Cashfree !== 'function') throw new Error('Cashfree Checkout could not be loaded. Please refresh and try again.');
      const cashfree = window.Cashfree({ mode: data.environment === 'production' ? 'production' : 'sandbox' });
      const result = await cashfree.subscriptionsCheckout({ subsSessionId: data.subscription_session_id, redirectTarget: '_self' });
      if (result?.error) throw new Error(result.error.message || 'Cashfree checkout failed.');
    } catch (err) {
      setError(err?.message || 'Unable to start UPI AutoPay checkout.');
      setLoading(false);
    }
  };

  const choosePaidPlan = plan => {
    setError(''); setMessage(''); setSelected(plan);
    if (!user) { window.location.hash = 'login'; return; }
    setFlowOpen(true);
  };

  const cancelMembership = async () => {
    if (!subscription?.provider_subscription_id) { setError('Your subscription reference is unavailable. Please contact Atma Rekha support.'); return; }
    if (!window.confirm('Cancel future renewals? Your current membership remains active until the current period ends.')) return;
    setCancelling(true); setError(''); setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('cancel-cashfree-subscription', { body: { subscription_id: subscription.provider_subscription_id } });
      if (invokeError) throw invokeError;
      if (!data?.ok) throw new Error(data?.error || 'Unable to cancel the subscription.');
      setMessage('Cancellation scheduled. No further monthly renewal will be taken.');
      await loadSubscription(user);
    } catch (err) { setError(err?.message || 'Unable to cancel membership.'); }
    finally { setCancelling(false); }
  };

  const active = subscription?.status === 'active' && (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());
  const currentPlan = PLANS.find(plan => plan.id === subscription?.plan_id);
  const membershipPortal = route.startsWith('membership');

  return <>
    <MembershipReaderGate />
    {!membershipPortal ? <MembershipLauncher user={user} /> : createPortal(<>
      <div className="membership-overlay" role="dialog" aria-modal="true" aria-label="Atma Rekha membership">
        <div className="membership-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) window.location.hash = 'profile'; }} />
        <section className="membership-sheet">
          <header className="membership-head">
            <button type="button" className="membership-close" onClick={() => window.location.hash = 'profile'} aria-label="Close membership">×</button>
            <div><p className="membership-kicker">ATMA REKHA</p><h1>Find your way into the story.</h1><p>{freePeriod ? `The first 7 chapters are yours. Membership is optional until ${formatDate(graceEnd)}.` : 'Chapters 1–7 remain free forever. Membership opens Chapter 8 onward.'}</p></div>
          </header>
          {active && <div className="membership-active"><span className="membership-active-icon">✓</span><div><strong>{currentPlan?.icon} {currentPlan?.name || 'Member'}</strong><small>Active · Next renewal {formatDate(subscription.current_period_end)}</small></div>{!subscription.cancel_at_period_end && <button type="button" onClick={cancelMembership} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel renewal'}</button>}{subscription.cancel_at_period_end && <em>Cancellation scheduled</em>}</div>}
          <div className="membership-banners" aria-label="Membership plans">{PLANS.map(plan => <PlanCard key={plan.id} plan={plan} current={plan.id === 'free' ? !active : active && subscription.plan_id === plan.id} busy={loading && selected?.id === plan.id} onChoose={() => plan.id === 'free' ? (window.location.hash = 'home') : choosePaidPlan(plan)} />)}</div>
          <div className="membership-banner-hint"><span>Swipe</span><span>01 / 04</span></div>
          <div className="membership-free-note"><strong>Seven chapters. Always free.</strong><span>Chapters 1–7 never require a paid membership.</span></div>
          {message && <p className="membership-success">✓ {message}</p>}{error && <p className="membership-error">{error}</p>}
          <p className="membership-legal">Choose a membership and approve the UPI AutoPay mandate securely in Cashfree. Future monthly renewals are handled automatically.</p>
        </section>
      </div>
      {flowOpen && selected && <UpiFlowModal plan={selected} phone={phone} setPhone={setPhone} loading={loading} onClose={() => setFlowOpen(false)} onChoose={() => beginCheckout(selected)} />}
    </>, document.body)}
  </>;
}

function PlanCard({ plan, current, busy, onChoose }) { return <article className={`membership-plan ${plan.popular ? 'is-popular' : ''} ${current ? 'is-current' : ''}`}><div className="membership-plan-top"><div className="membership-plan-icon">{plan.icon}</div><p>{plan.eyebrow}</p></div>{plan.popular && <span className="membership-popular">POPULAR</span>}<h2>{plan.name}</h2><p className="membership-price">₹{plan.amount}<small>{plan.amount ? ' / month' : ''}</small></p><p className="membership-description">{plan.description}</p><ul>{plan.features.map(feature => <li key={feature}>✓ {feature}</li>)}</ul><button type="button" className={`membership-button ${current ? 'current' : ''}`} disabled={current || busy} onClick={onChoose}>{current ? 'Current plan' : busy ? 'Opening…' : plan.amount ? `Subscribe · ₹${plan.amount}/month` : 'Read Chapters 1–7'}</button></article>; }

function MembershipLauncher({ user }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!user) return undefined; const mount = () => { const card = document.querySelector('.profile-v2-card'); const community = card?.querySelector('.profile-community-card'); if (!card || !community) return false; let slot = card.querySelector('.profile-membership-slot'); if (!slot) { slot = document.createElement('div'); slot.className = 'profile-membership-slot'; community.insertAdjacentElement('afterend', slot); } setReady(true); return true; }; mount(); const observer = new MutationObserver(mount); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect(); }, [user]);
  if (!ready) return null; const slot = document.querySelector('.profile-membership-slot'); if (!slot) return null;
  return createPortal(<button type="button" className="profile-membership-launcher" onClick={() => window.location.hash = 'membership'}><span className="profile-membership-launcher-icon">✦</span><span><strong>Membership</strong><small>Choose your Atma Rekha membership</small></span><b>→</b></button>, slot);
}

function UpiFlowModal({ plan, phone, setPhone, loading, onClose, onChoose }) { return createPortal(<div className="membership-phone-overlay" role="dialog" aria-modal="true" aria-label="Cashfree UPI AutoPay"><div className="membership-phone-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} /><section className="membership-phone-modal membership-upi-modal"><button className="membership-phone-close" type="button" onClick={onClose} aria-label="Close">×</button><div className="membership-phone-mark">{plan.icon}</div><p className="membership-phone-kicker">{plan.name.toUpperCase()} · ₹{plan.amount}/MONTH</p><h2>Continue with UPI AutoPay.</h2><p>Enter the mobile number you use with your UPI account. Cashfree will open the secure mandate screen next.</p><label className="membership-phone-field"><span>Mobile number</span><input inputMode="numeric" autoComplete="tel" maxLength={15} value={phone} onChange={event => setPhone(event.target.value)} placeholder="10-digit mobile number" /></label><button type="button" className="membership-button" disabled={loading} onClick={onChoose}>{loading ? 'Opening Cashfree…' : 'Continue to Cashfree'}</button><small className="membership-upi-note">Cashfree handles the UPI mandate securely. A ₹1 authorization may appear and is configured for refund by Cashfree.</small></section></div>, document.body); }

function MembershipReaderGate() {
  const [route, setRoute] = useState(routeNow());
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => { const onHash = () => setRoute(routeNow()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setLocked(false);
      if (!route.startsWith('read-chapter/')) return;
      const chapterId = decodeURIComponent(route.split('/')[1]?.split('?')[0] || '');
      if (!chapterId || isFreePeriod()) return;
      setChecking(true);
      try {
        const { data: chapter } = await supabase.from('chapters').select('chapter_number').eq('id', chapterId).maybeSingle();
        if (!chapter || Number(chapter.chapter_number) <= 7) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { if (!cancelled) setLocked(true); return; }
        const { data: sub } = await supabase.from('user_subscriptions').select('status,current_period_end').eq('user_id', session.user.id).maybeSingle();
        const active = sub?.status === 'active' && sub?.current_period_end && new Date(sub.current_period_end).getTime() > Date.now();
        if (!active && !cancelled) setLocked(true);
      } catch { if (!cancelled) setLocked(true); }
      finally { if (!cancelled) setChecking(false); }
    };
    check();
    return () => { cancelled = true; };
  }, [route]);
  if (!locked || checking) return null;
  return createPortal(<div className="membership-reader-lock" role="dialog" aria-modal="true"><div className="membership-reader-lock-card"><div className="membership-phone-mark">🔒</div><p className="membership-phone-kicker">MEMBERSHIP CHAPTER</p><h2>Chapter 8 onward needs membership.</h2><p>Chapters 1–7 are always free. Support Atma Rekha with any monthly membership to continue reading.</p><button type="button" className="membership-button" onClick={() => window.location.hash = 'membership'}>View memberships</button><button type="button" className="membership-reader-back" onClick={() => window.location.hash = 'chapters'}>Back to chapters</button></div></div>, document.body);
}
