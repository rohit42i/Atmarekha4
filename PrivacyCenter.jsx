import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const PRIVACY_VERSION = '2026-10-07';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

function backHome() {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function requestByEmail(subject, body = '') {
  const url = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + (body ? '&body=' + encodeURIComponent(body) : '');
  window.location.href = url;
}

function PolicySection({ heading, children }) {
  return <article className="privacy-policy-section"><h2>{heading}</h2><p>{children}</p></article>;
}

export default function PrivacyCenter() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exported, setExported] = useState(null);
  const [consent, setConsent] = useState(null);
  const [deletion, setDeletion] = useState(null);

  const load = async currentUser => {
    setUser(currentUser);
    if (!currentUser) { setLoading(false); return; }
    const [{ data: consentRows }, { data: deletionRows }] = await Promise.all([
      supabase.from('dpdp_consent_records').select('policy_version,purposes,consented_at,withdrawn_at,source').eq('user_id', currentUser.id).order('consented_at', { ascending: false }).limit(5),
      supabase.from('dpdp_deletion_requests').select('id,status,requested_at,resolved_at').eq('user_id', currentUser.id).order('requested_at', { ascending: false }).limit(1),
    ]);
    setConsent(consentRows?.[0] || null);
    setDeletion(deletionRows?.[0] || null);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data?.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => load(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const exportData = async () => {
    if (!user || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dpdp-data-rights', { body: { action: 'export' } });
      if (fnError) throw fnError;
      setExported(data);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'atma-rekha-my-data.json'; link.click();
      URL.revokeObjectURL(url);
      setMessage('Your data export is ready.');
    } catch (err) {
      setError(err?.message || 'Unable to export your data.');
    } finally { setBusy(false); }
  };

  const withdrawConsent = async () => {
    if (!user || busy || !consent || consent.withdrawn_at) return;
    if (!window.confirm('Withdraw this consent record? Processing that depends on this consent will stop where applicable; processing based on another lawful ground may continue.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dpdp-data-rights', {
        body: { action: 'withdraw-consent', policy_version: consent.policy_version }
      });
      if (fnError) throw fnError;
      setConsent(data?.consent || { ...consent, withdrawn_at: new Date().toISOString() });
      setMessage('Consent withdrawal recorded.');
    } catch (err) {
      setError(err?.message || 'Unable to withdraw consent.');
    } finally { setBusy(false); }
  };

  const requestDeletion = async () => {
    if (!user || busy) return;
    if (!window.confirm('Request erasure of your Atma Rekha personal data? Data that must be retained by law, for security, fraud prevention, payment records or other lawful obligations may be retained for the permitted period.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dpdp-data-rights', { body: { action: 'delete-request' } });
      if (fnError) throw fnError;
      setDeletion(data?.request || null);
      setMessage('Your erasure request has been submitted.');
    } catch (err) {
      setError(err?.message || 'Unable to submit erasure request.');
    } finally { setBusy(false); }
  };

  if (loading) return <main className="privacy-center"><div className="privacy-center-card"><p>Loading privacy controls…</p></div></main>;
  if (!user) return <main className="privacy-center"><div className="privacy-center-card"><p className="section-eyebrow">LEGAL · PRIVACY</p><h1>Privacy</h1><p>Read how Atma Rekha processes personal data and sign in to use your data rights.</p><div className="button-row"><button className="primary-button" type="button" onClick={()=>window.dispatchEvent(new CustomEvent('atma-open-auth',{detail:{mode:'login',returnTo:'privacy'}}))}>Sign in</button><button className="secondary-button" type="button" onClick={backHome}>Back home</button></div></div><section className="privacy-policy-card"><PolicySection heading="Effective date">7 October 2026. This privacy notice applies to the current Atma Rekha service and is updated when our processing, features or applicable law materially changes.</PolicySection><PolicySection heading="Data fiduciary & contact">Atma Rekha is the Data Fiduciary for personal data processed through this service. For privacy requests and grievances, contact {CONTACT_EMAIL}.</PolicySection><PolicySection heading="What we process">Depending on the feature you use, this can include email, name, username, avatar, bio, account timestamps, reading progress, bookmarks, ratings, comments, community activity, notifications, membership/payment records and technical/security information.</PolicySection><PolicySection heading="Why we process it">We process data to provide accounts and reading features, save progress and favourites, operate community features, provide memberships and payments, maintain security, prevent abuse, provide support and comply with applicable law.</PolicySection><PolicySection heading="Your rights">You can request access to information about your personal data, correction, completion or updating, erasure where permitted, withdrawal of consent where consent is the basis, grievance redressal and nomination, subject to lawful exceptions and retention duties.</PolicySection></section></main>;

  return <main className="privacy-center">
    <section className="privacy-hero">
      <p className="section-eyebrow">LEGAL · PRIVACY</p>
      <h1>Privacy & Data</h1>
      <p>A clear summary of how Atma Rekha handles personal data and the controls available to you.</p>
      <p className="privacy-version">Privacy notice · Version {PRIVACY_VERSION}</p>
    </section>

    <section className="privacy-policy-card">
      <PolicySection heading="What we collect">We may process your email, name, username, avatar, bio, account timestamps, reading history, bookmarks, ratings, comments, community activity, notifications, membership and payment records, and necessary technical/security information.</PolicySection>
      <PolicySection heading="How we use it">We use data to provide and secure accounts, reading and profile features, save progress and favourites, operate community features, process memberships and payments, prevent abuse, provide support and meet legal obligations.</PolicySection>
      <PolicySection heading="Sharing & storage">Atma Rekha may use Supabase for authentication/database services, Cloudflare for storage and delivery, and Razorpay for payments. Only information needed for the relevant service is shared. Public comments and community content may be visible to other readers.</PolicySection>
      <PolicySection heading="Retention & security">Data is kept only as long as needed or required for lawful purposes. We use access controls, database security, protected server functions, HTTPS/security controls and controlled media delivery. Secret server credentials are not placed in browser code.</PolicySection>
      <PolicySection heading="Your rights">You can access/export your data, request correction, withdraw consent where consent is the basis, request erasure where permitted, and raise privacy grievances. We may verify account ownership before acting on a request.</PolicySection>
      <PolicySection heading="Contact & grievances">Email {CONTACT_EMAIL} with “DPDP Request” for privacy requests, corrections or grievances. We will handle requests within the applicable legal period.</PolicySection>
    </section>

    <section className="privacy-controls-card">
      <header className="privacy-section-heading">
        <p className="section-eyebrow">YOUR ACCOUNT</p>
        <h2>Privacy controls</h2>
        <p>Use these tools to manage the data connected to your account.</p>
      </header>
      <div className="privacy-grid">
        <section className="privacy-action"><h3>Export my data</h3><p>Download a machine-readable copy of the personal data available through your account.</p><button className="primary-button" type="button" disabled={busy} onClick={exportData}>{busy ? 'Preparing…' : 'Export data'}</button></section>
        <section className="privacy-action"><h3>Consent</h3><p>{consent?.withdrawn_at ? 'Your latest consent has been withdrawn.' : consent ? 'Your latest signup consent is recorded.' : 'No consent record is currently available.'}</p><button className="secondary-button" type="button" disabled={busy || !consent || Boolean(consent.withdrawn_at)} onClick={withdrawConsent}>Withdraw consent</button></section>
        <section className="privacy-action"><h3>Correction</h3><p>Update profile details from your Profile page or contact privacy support for other corrections.</p><div className="button-row"><button className="secondary-button" type="button" onClick={()=>{window.location.hash='profile'}}>Open profile</button><button className="secondary-button" type="button" onClick={()=>requestByEmail('DPDP Correction Request','Please describe the personal data that is inaccurate and the correction you are requesting.')}>Request correction</button></div></section>
        <section className="privacy-action"><h3>Delete account data</h3><p>Request deletion of eligible personal data. Lawful retention requirements may apply.</p><button className="secondary-button" type="button" disabled={busy || ['pending','processing'].includes(deletion?.status)} onClick={requestDeletion}>{deletion?.status === 'pending' || deletion?.status === 'processing' ? 'Deletion requested' : 'Request deletion'}</button></section>
        <section className="privacy-action"><h3>Privacy support</h3><p>Contact us about privacy requests, grievances or questions about data processing.</p><button className="secondary-button" type="button" onClick={()=>requestByEmail('DPDP Request')}>Email privacy support</button></section>
      </div>
    </section>

    {message && <p className="form-field-success" role="status" aria-live="polite">{message}</p>}
    {error && <p className="form-field-error" role="alert">{error}</p>}
    {exported && <section className="data-export"><h2>Export preview</h2><pre>{JSON.stringify(exported, null, 2)}</pre></section>}
    <div className="privacy-note">Atma Rekha is a small independent service and this implementation is intended to provide the DPDP rights and controls applicable to its processing. It is not a claim that every statutory provision is already in force for every class of Data Fiduciary.</div>
  </main>;
}
