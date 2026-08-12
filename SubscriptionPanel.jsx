import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import './subscription.css';

export default function SubscriptionPanel({ onBack }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('subscription_plans').select('id,name,description,amount_inr,interval').eq('active', true).order('sort_order'),
      supabase.auth.getSession(),
    ]).then(([planResult, authResult]) => {
      if (!active) return;
      if (!planResult.error) setPlans(planResult.data || []);
      setSession(authResult.data.session);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const choosePlan = () => {
    if (!session) { window.location.hash = 'account'; return; }
    window.alert('Subscriptions are prepared. Payment will activate after the payment account verification is approved.');
  };

  return <main className="subscription-page"><section className="subscription-shell"><button className="account-back" onClick={onBack}>← Back</button><p className="hero-eyebrow">ATMA REKHA</p><h1>Support the story.</h1><p className="subscription-intro">Atma Rekha remains free to read. Supporter plans help fund future chapters, art and production.</p>{loading ? <div className="loading-state"><span className="loading-spinner"/><p>Loading plans…</p></div> : <div className="plan-grid">{plans.map((plan, index) => <article className={`plan-card${index === plans.length - 1 ? ' featured' : ''}`} key={plan.id}>{index === plans.length - 1 && <span className="plan-badge">BEST SUPPORT</span>}<p className="plan-kicker">{plan.name}</p><h2>₹{plan.amount_inr}<small>/{plan.interval}</small></h2><p>{plan.description}</p><ul><li>Support Atma Rekha directly</li><li>Subscriber recognition</li><li>Future supporter benefits</li></ul><button className="primary-button" onClick={choosePlan}>{session ? 'Choose plan' : 'Sign in to continue'}</button></article>)}</div>}<div className="subscription-note"><strong>Payment connection is intentionally waiting.</strong><span>The subscription database and plan structure are ready. Live recurring payments will be connected only after your payment-account verification is approved.</span></div></section></main>;
}
