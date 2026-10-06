import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';
import './membership.css';

const PLANS = [
  {
    id: 'free',
    label: 'FREE',
    name: 'Reader',
    amount: 0,
    description: 'Start reading and experience Atma Rekha at no cost.',
    bestFor: 'For every reader',
    features: ['Chapters 1–8', 'Bookmarks & reading history', 'Ratings & comments', 'Reading progress', 'Notifications'],
  },
  {
    id: 'mini_member',
    label: 'SUPPORT',
    name: 'Supporter',
    amount: 19,
    description: 'The simplest way to support the manga and keep reading.',
    bestFor: 'For readers who want to support the story',
    features: ['All released chapters', 'Supporter badge', 'Member updates', 'Reading progress'],
  },
  {
    id: 'supporter',
    label: 'MOST POPULAR',
    name: 'Premium Supporter',
    amount: 29,
    popular: true,
    description: 'More support, more recognition, same full reading access.',
    bestFor: 'The best balance of reading + support',
    features: ['All released chapters', 'Premium Supporter badge', 'Member recognition', 'Member updates', 'Reading progress'],
  },
  {
    id: 'premium',
    label: 'TOP SUPPORTER',
    name: 'Super Supporter',
    amount: 49,
    description: 'For readers who want to support Atma Rekha a little more.',
    bestFor: 'For readers who want to give the most support',
    features: ['All released chapters', 'Super Supporter badge', 'Super Supporter recognition', 'Member updates', 'Reading progress'],
  },
];

const formatDate = value =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

async function getFunctionError(error, fallback) {
  if (!error) return fallback;
  try {
    const response = error.context;
    if (response && typeof response.json === 'function') {
      const body = await response.clone().json();
      if (body?.error) return [body.error, body.reason].filter(Boolean).join(' · ') || fallback;
    }
  } catch {}
  return error.message || fallback;
}

async function authHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error('Please sign in again.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

const openMembershipRoute = () => {
  const url = `${window.location.pathname}${window.location.search}#membership`;
  if (window.location.hash !== '#membership') window.history.pushState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  window.dispatchEvent(new CustomEvent('atma:open-membership'));
};

export default function Membership() {
  const [open, setOpen] = useState(() => window.location.hash.replace(/^#/, '') === 'membership');
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSubscription = async currentUser => {
    if (!currentUser) {
      setSubscription(null);
      return;
    }

    const { data, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('plan_id,status,current_period_end,cancel_at_period_end,provider_subscription_id')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (subscriptionError) {
      setSubscription(null);
      return;
    }

    const rows = data || [];
    const now = Date.now();
    setSubscription(
      rows.find(
        row =>
          row.status === 'active' ||
          (row.status === 'cancelled' && row.current_period_end && new Date(row.current_period_end).getTime() > now)
      ) || rows.find(row => row.status === 'pending') || null
    );
  };

  useEffect(() => {
    const openPage = () => {
      setError('');
      setMessage('');
      setOpen(true);
    };

    const closePage = () => setOpen(false);

    window.addEventListener('atma:open-membership', openPage);
    window.addEventListener('atma:close-membership', closePage);

    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const current = data?.session?.user || null;
      setUser(current);
      await loadSubscription(current);
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = session?.user || null;
      setUser(current);
      // Supabase advises avoiding async Supabase calls directly inside the auth callback.
      window.setTimeout(() => loadSubscription(current), 0);
    });

    return () => {
      window.removeEventListener('atma:open-membership', openPage);
      window.removeEventListener('atma:close-membership', closePage);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const sync = () => setOpen(window.location.hash.replace(/^#/, '') === 'membership');
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    if (window.location.hash === '#membership') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const beginCheckout = async plan => {
    if (!user) {
      openMembershipRoute();
      window.setTimeout(
        () =>
          window.dispatchEvent(
            new CustomEvent('atma-open-auth', {
              detail: { mode: 'login', returnTo: 'membership', selectedPlan: plan.id },
            })
          ),
        0
      );
      return;
    }

    setError('');
    setMessage('');
    setSelected(plan);
    setLoading(true);

    try {
      const headers = await authHeaders();
      const { data, error: invokeError } = await supabase.functions.invoke('create-razorpay-subscription', {
        body: { plan_id: plan.id },
        headers,
      });

      if (invokeError) throw new Error(await getFunctionError(invokeError, 'Unable to start membership.'));
      if (!data?.subscription_id || !data?.key_id) {
        throw new Error(data?.error || 'Unable to start membership.');
      }
      if (!window.Razorpay) throw new Error('Payment checkout is unavailable. Please refresh.');

      const checkout = new window.Razorpay({
        key: data.key_id,
        subscription_id: data.subscription_id,
        name: 'Atma Rekha',
        description: `${plan.name} · ₹${plan.amount}/month`,
        image: `${window.location.origin}/ishani.png`,
        prefill: { email: user.email || '' },
        notes: { plan_id: plan.id },
        theme: { color: '#111111' },
        modal: {
          confirm_close: true,
          escape: true,
          backdropclose: false,
          ondismiss: () => setLoading(false),
        },
        handler: async response => {
          try {
            const verifyHeaders = await authHeaders();
            const { data: verification, error: verificationError } = await supabase.functions.invoke(
              'verify-razorpay-subscription',
              {
                body: {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                },
                headers: verifyHeaders,
              }
            );

            if (verificationError) {
              throw new Error(await getFunctionError(verificationError, 'Unable to verify membership.'));
            }
            if (!verification?.success) throw new Error(verification?.error || 'Verification failed.');

            setMessage('Membership activated successfully.');
            await loadSubscription(user);
          } catch (verificationError) {
            setError(verificationError?.message || 'Unable to verify membership.');
          } finally {
            setLoading(false);
          }
        },
      });

      checkout.on('payment.failed', response => {
        setError(response?.error?.description || 'Membership authorization failed.');
        setLoading(false);
      });

      checkout.open();
    } catch (checkoutError) {
      setError(checkoutError?.message || 'Unable to start membership.');
      setLoading(false);
    }
  };

  const choosePlan = plan => {
    setError('');
    setMessage('');
    if (plan.id === 'free') {
      close();
      return;
    }
    beginCheckout(plan);
  };

  useEffect(() => {
    const onPlanReady = event => {
      const plan = PLANS.find(item => item.id === event?.detail?.planId);
      if (plan && user) beginCheckout(plan);
    };

    window.addEventListener('atma-membership-plan-ready', onPlanReady);
    return () => window.removeEventListener('atma-membership-plan-ready', onPlanReady);
  }, [user]);

  const active = Boolean(subscription) && (
    subscription.status === 'active' ||
    (subscription.status === 'cancelled' &&
      subscription.current_period_end &&
      new Date(subscription.current_period_end).getTime() > Date.now())
  );
  const currentPlan = PLANS.find(plan => plan.id === subscription?.plan_id);

  if (!open) return <MembershipLauncher user={user} />;

  return createPortal(
    <main className="membership-page" aria-label="Atma Rekha membership">
      <div className="membership-shell">
        <header className="membership-header">
          <div className="membership-brand">ATMA REKHA</div>
          <div className="membership-header-row">
            <div>
              <p className="membership-eyebrow">SUPPORT THE STORY</p>
              <h1>Membership</h1>
              <p className="membership-lead">
                Keep reading. Support the manga. Become part of Atma Rekha.
              </p>
            </div>
            <button type="button" className="membership-close" onClick={close} aria-label="Close membership">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <section className="membership-access-bar" aria-label="Chapter access">
          <div className="membership-access-main">
            <span className="membership-access-icon" aria-hidden="true">01</span>
            <div>
              <strong>Chapters 1–8 are free</strong>
              <span>Membership unlocks Chapter 9 and onward.</span>
            </div>
          </div>
          <div className="membership-billing">
            <strong>Monthly</strong>
            <span>UPI AutoPay</span>
          </div>
        </section>

        {active && (
          <section className="membership-current" aria-label="Current membership">
            <div className="membership-current-mark" aria-hidden="true">✓</div>
            <div>
              <p className="membership-current-label">YOUR MEMBERSHIP</p>
              <strong>{currentPlan?.name || 'Member'}</strong>
              <span>
                {subscription.cancel_at_period_end
                  ? `Access until ${formatDate(subscription.current_period_end)}`
                  : subscription.current_period_end
                    ? `Renews ${formatDate(subscription.current_period_end)}`
                    : 'Active membership'}
              </span>
            </div>
            <span className="membership-current-status">ACTIVE</span>
          </section>
        )}

        <section className="membership-plans" aria-label="Membership plans">
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={plan.id === 'free' ? !active : active && subscription.plan_id === plan.id}
              busy={loading && selected?.id === plan.id}
              onChoose={() => choosePlan(plan)}
            />
          ))}
        </section>

        <section className="membership-support">
          <div>
            <p className="membership-eyebrow">WHY MEMBERSHIP?</p>
            <h2>Read more. Support more.</h2>
            <p>
              Chapters 1–8 stay free. From Chapter 9 onward, membership keeps the story going while giving you full access to every released chapter.
            </p>
          </div>
          <div className="membership-support-points">
            <div><strong>01</strong><span>Chapter 9+ access while your membership is active</span></div>
            <div><strong>02</strong><span>Supporter badge and recognition</span></div>
            <div><strong>03</strong><span>Directly support the time behind future chapters</span></div>
          </div>
        </section>

        <section className="membership-faq" aria-label="Membership questions">
          <details>
            <summary>What happens after I join?</summary>
            <p>Your membership is activated after Razorpay verifies the subscription. Chapters 9+ become available to your account while the membership is active.</p>
          </details>
          <details>
            <summary>How does payment work?</summary>
            <p>Paid plans are monthly UPI AutoPay subscriptions processed through Razorpay. The checkout screen will show the mandate before you approve it.</p>
          </details>
          <details>
            <summary>Can I stop later?</summary>
            <p>Yes. Cancellation keeps your access through the paid period already covered by the subscription.</p>
          </details>
          <details>
            <summary>Can I read the first chapters for free?</summary>
            <p>Yes. Chapters 1–8 remain free. Membership starts from Chapter 9.</p>
          </details>
        </section>

        {message && <p className="membership-feedback membership-success" role="status">✓ {message}</p>}
        {error && <p className="membership-feedback membership-error" role="alert">{error}</p>}

        <footer className="membership-footer">
          <span>ATMA REKHA</span>
          <span>Monthly membership · UPI AutoPay · Secure checkout by Razorpay</span>
        </footer>
      </div>
    </main>,
    document.body
  );
}

function PlanCard({ plan, current, busy, onChoose }) {
  return (
    <article
      className={`membership-plan ${plan.popular ? 'is-popular' : ''} ${current ? 'is-current' : ''}`}
      aria-label={`${plan.name} membership`}
    >
      <div className="membership-plan-head">
        <div>
          <p className="membership-plan-label">{plan.label}</p>
          <h2>{plan.name}</h2>
        </div>
        {plan.popular && <span className="membership-popular">MOST CHOSEN</span>}
      </div>

      <p className="membership-plan-description">{plan.description}</p>
      <p className="membership-plan-best">{plan.bestFor}</p>

      <div className="membership-price-row">
        <strong>₹{plan.amount}</strong>
        {plan.amount > 0 && <span>/ month</span>}
      </div>

      <div className="membership-plan-divider" />

      <ul>
        {plan.features.map(feature => (
          <li key={feature}>
            <span aria-hidden="true">✓</span>
            {feature}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className={`membership-button ${current ? 'current' : ''}`}
        disabled={current || busy}
        onClick={onChoose}
      >
        {current ? 'Current plan' : busy ? 'Opening checkout…' : plan.amount ? 'Join membership' : 'Read free chapters'}
      </button>
    </article>
  );
}

function MembershipLauncher({ user }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return undefined;

    const mount = () => {
      const card = document.querySelector('.profile-v2-card');
      const community = card?.querySelector('.profile-community-card');
      if (!card || !community) return false;

      let slot = card.querySelector('.profile-membership-slot');
      if (!slot) {
        slot = document.createElement('div');
        slot.className = 'profile-membership-slot';
        community.insertAdjacentElement('afterend', slot);
      }

      setReady(true);
      return true;
    };

    mount();
    const observer = new MutationObserver(mount);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [user]);

  if (!ready) return null;
  const slot = document.querySelector('.profile-membership-slot');
  if (!slot) return null;

  return createPortal(
    <button type="button" className="profile-membership-launcher" onClick={openMembershipRoute}>
      <span className="profile-membership-launcher-icon" aria-hidden="true">+</span>
      <span>
        <strong>Membership</strong>
        <small>Support Atma Rekha & unlock Chapter 9+</small>
      </span>
      <b aria-hidden="true">→</b>
    </button>,
    slot
  );
}
