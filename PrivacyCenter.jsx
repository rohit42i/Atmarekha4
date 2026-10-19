import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

function backHome() {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function openProfile() {
  window.location.hash = 'profile';
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
  const [consent, setConsent] = useState(null);
  const [deletion, setDeletion] = useState(null);

  const load = async currentUser => {
    setUser(currentUser);
    if (!currentUser) {
      setConsent(null);
      setDeletion(null);
      setLoading(false);
      return;
    }

    try {
      const [
        { data: consentRows, error: consentError },
        { data: deletionRows, error: deletionError },
      ] = await Promise.all([
        supabase.from('dpdp_consent_records').select('policy_version,purposes,consented_at,withdrawn_at,source').eq('user_id', currentUser.id).order('consented_at', { ascending: false }).limit(5),
        supabase.from('dpdp_deletion_requests').select('id,status,requested_at,resolved_at,resolution_note').eq('user_id', currentUser.id).order('requested_at', { ascending: false }).limit(1),
      ]);
      if (consentError) throw new Error('Unable to load consent records: ' + consentError.message);
      if (deletionError) throw new Error('Unable to load deletion request status: ' + deletionError.message);
      setConsent(consentRows?.find(row => !row.withdrawn_at) || consentRows?.[0] || null);
      setDeletion(deletionRows?.[0] || null);
    } catch (err) {
      setError(err?.message || 'Unable to load privacy controls.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) load(data?.session?.user || null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) load(session?.user || null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const runAction = async (action, successText, body = {}) => {
    if (!user || busy) return null;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dpdp-data-rights', {
        body: { action, ...body },
      });
      if (fnError) throw fnError;
      setMessage(successText);
      return data;
    } catch (err) {
      setError(err?.message || 'Unable to complete the privacy request.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    const data = await runAction('export', 'Preparing your available account data export…');
    if (!data) return;
    setMessage(Array.isArray(data.export_warnings) && data.export_warnings.length
      ? 'Your export was downloaded, but some categories may be incomplete or could not be retrieved. Check export_warnings in the file and contact support for a complete review.'
      : 'Your available account data export has been downloaded.');
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'atma-rekha-my-data.json';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err?.message || 'Your data was retrieved, but the download could not be started. Please try again.');
    }
  };

  const withdrawConsent = async () => {
    if (!consent || consent.withdrawn_at || busy) return;
    if (!window.confirm('Withdraw this consent record? Processing that depends on consent will stop where applicable; processing based on another lawful basis may continue.')) return;
    const data = await runAction('withdraw-consent', 'Consent withdrawal recorded.', { policy_version: consent.policy_version });
    if (data?.consent) setConsent(data.consent);
  };

  const requestDeletion = async () => {
    if (busy || deletion?.status === 'pending' || deletion?.status === 'processing') return;
    if (!window.confirm('Submit a request to erase eligible Atma Rekha personal data? This creates a tracked request for review; it does not instantly erase your account. We will verify the request and retain only records required by applicable law or legitimate security/accounting needs.')) return;
    const data = await runAction('delete-request', 'Your deletion request has been submitted.');
    if (data?.request) setDeletion(data.request);
  };

  if (loading) {
    return <main className="privacy-center"><div className="privacy-center-card"><p>Loading privacy controls…</p></div></main>;
  }

  return <main className="privacy-center">
    <section className="privacy-hero">
      
      <h1>Privacy</h1>
      <p>We collect only the information needed to run Atma Rekha, manage reader accounts and memberships, and keep the site working safely.</p>
      <p className="privacy-version">Last updated: 19 October 2026</p>
    </section>

    <section className="privacy-policy-card">
      <PolicySection heading="What we collect and why">Depending on how you use the site, we may process your email address, username, profile details, reading progress, bookmarks, ratings, comments, feedback, notification choices, membership and subscription records, payment references, and technical or security information. We use this data to run accounts and reading features, provide memberships, respond to requests, prevent abuse, and meet legal obligations.</PolicySection>
      <PolicySection heading="Comments and sharing">Comments and profile details you choose to make public can be seen by other readers. We do not sell personal information. We may share the minimum information needed with service providers that support hosting, storage, authentication, security, email or payments, including Supabase, Cloudflare and Razorpay, or disclose information when required by law or necessary to protect users and the service.</PolicySection>
      <PolicySection heading="Payments, cookies and security">Payments are handled through Razorpay or the payment method shown at checkout. Atma Rekha does not ask you to send passwords, OTPs, UPI PINs or full card details by email. The site may use cookies, local storage and similar technologies for sign-in, security, preferences and core functionality. We use reasonable safeguards, but no online service can guarantee absolute security.</PolicySection>
      <PolicySection heading="Retention and transfers">We keep personal data only for as long as reasonably needed for the purposes above, account operation, security, dispute handling and legal, tax or payment obligations. Some service providers may process data on infrastructure located outside your state or country. We apply applicable legal requirements to such processing and retention.</PolicySection>
      <PolicySection heading="Your choices and deletion">You can correct profile details, request an export of available account data, withdraw consent where consent is the basis for processing, or request deletion through the controls below. We verify requests where needed. Deletion is reviewed rather than instant; information may be retained where required by law or needed for security, accounting, payment disputes or legal claims. You may also contact us if you cannot access your account.</PolicySection>
      <PolicySection heading="Children and contact">Account creation is intended for readers aged 15 or older. If you believe a child has provided personal data inappropriately, contact us so we can review it. For privacy questions, correction, access, deletion or complaints, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may ask for information needed to verify your identity. Your rights depend on the laws applicable to your request.</PolicySection>
    </section>

    {user && <section className="privacy-controls-card" aria-labelledby="privacy-controls-title">
      <header className="privacy-section-heading">
        <p className="section-eyebrow">YOUR CONTROLS</p>
        <h2 id="privacy-controls-title">Manage your privacy</h2>
      </header>
      <div className="privacy-controls-grid">
        <button type="button" className="privacy-control-button" onClick={exportData} disabled={busy}>
          <strong>Export data</strong><span>Download available account data</span>
        </button>
        <button type="button" className="privacy-control-button" onClick={openProfile}>
          <strong>Correct profile</strong><span>Review and update profile details</span>
        </button>
        <button type="button" className="privacy-control-button" onClick={withdrawConsent} disabled={busy || !consent || Boolean(consent.withdrawn_at)}>
          <strong>{consent?.withdrawn_at ? 'Consent withdrawn' : 'Withdraw consent'}</strong>
          <span>{consent ? (consent.withdrawn_at ? 'This consent record is already withdrawn' : 'Use where consent is the basis for processing') : 'No consent record is available'}</span>
        </button>
        <button type="button" className="privacy-control-button privacy-control-destructive" onClick={requestDeletion} disabled={busy || deletion?.status === 'pending' || deletion?.status === 'processing'}>
          <strong>{deletion?.status === 'pending' || deletion?.status === 'processing' ? 'Deletion request in progress' : 'Request deletion'}</strong><span>{deletion?.status === 'pending' || deletion?.status === 'processing' ? 'A request is already being reviewed' : 'Request erasure of eligible personal data'}</span>
        </button>
      </div>
      <p className="privacy-small-note">Deletion requests are queued for review, identity verification and erasure by an authorised administrator. They are not completed automatically by pressing the button. We retain only information required by applicable law or necessary for security, accounting or disputes. If you cannot sign in, email {CONTACT_EMAIL} from the account address you control.</p>
      {consent && <div className="privacy-control-status">Consent record: <strong>{consent.withdrawn_at ? 'withdrawn' : 'recorded'}</strong>{consent.consented_at ? <> · {new Date(consent.consented_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}</div>}
      <div className="privacy-email-actions">
        <button type="button" className="secondary-button" onClick={() => requestByEmail('Atma Rekha Privacy Request')}>Email a privacy request</button>
      </div>
    </section>}

    {(message || error) && <div className={`privacy-status ${error ? 'privacy-status-error' : 'privacy-status-success'}`} role={error ? 'alert' : 'status'} aria-live="polite">{error || message}</div>}

    {user && <section className="privacy-policy-card">
      <header className="privacy-section-heading">
        <p className="section-eyebrow">REQUEST STATUS</p>
        <h2>Your recent privacy request</h2>
      </header>
      <div className="privacy-status">
        {deletion ? <>Deletion request · <strong>{deletion.status || 'submitted'}</strong>{deletion.requested_at ? <> · submitted {new Date(deletion.requested_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}{deletion.resolved_at ? <> · resolved {new Date(deletion.resolved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}{deletion.id ? <><br/>Reference: <code>{deletion.id}</code></> : null}{deletion.resolution_note ? <><br/>Update: {deletion.resolution_note}</> : null}</> : 'No account deletion request is currently recorded.'}
      </div>
      <p className="privacy-small-note">Requests sent by email are handled through support and may require additional identity verification before action.</p>
    </section>}


    {!user && <section className="privacy-center-card">
      <h2>Manage your personal data</h2>
      <p>Sign in to access available privacy controls. You can also email us about a privacy request without signing in.</p>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={() => window.dispatchEvent(new CustomEvent('atma-open-auth',{detail:{mode:'login',returnTo:'privacy'}}))}>Sign in</button>
        <button className="secondary-button" type="button" onClick={backHome}>Back home</button>
      </div>
    </section>}
  </main>;
}
