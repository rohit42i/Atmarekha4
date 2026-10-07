import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const PRIVACY_VERSION = '2026-10-07';
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

const DATA_TABLE = [
  ['Account', 'Email, account ID and account-security timestamps', 'Account access, security and support'],
  ['Profile', 'Username, display name, avatar and bio when provided', 'Your public profile and personalisation'],
  ['Reading', 'Progress, bookmarks, ratings and reading history', 'Save your place and operate reader features'],
  ['Community', 'Comments, reactions, reports and related moderation records', 'Community features, safety and moderation'],
  ['Membership', 'Plan, status and membership period', 'Provide paid chapter access and manage membership'],
  ['Payments', 'Payment/subscription references and transaction status', 'Billing support, reconciliation and refunds'],
  ['Technical', 'Device/browser, network and limited diagnostic information', 'Security, reliability and troubleshooting'],
  ['Privacy requests', 'Consent, access and deletion request records', 'Handle your privacy choices and requests'],
];

const RETENTION_TABLE = [
  ['Account data', 'While your account is active and for a limited period afterward where needed for security, support or legal obligations.'],
  ['Reading and community data', 'While needed to provide the feature, preserve your choices, resolve disputes or meet applicable requirements.'],
  ['Membership and payment records', 'For as long as needed for billing, accounting, fraud prevention, disputes and applicable legal/tax requirements.'],
  ['Privacy requests and consent records', 'For as long as needed to evidence and handle the request, consent or withdrawal and meet applicable requirements.'],
];

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
      const [{ data: consentRows }, { data: deletionRows }] = await Promise.all([
        supabase.from('dpdp_consent_records').select('policy_version,purposes,consented_at,withdrawn_at,source').eq('user_id', currentUser.id).order('consented_at', { ascending: false }).limit(5),
        supabase.from('dpdp_deletion_requests').select('id,status,requested_at,resolved_at').eq('user_id', currentUser.id).order('requested_at', { ascending: false }).limit(1),
      ]);
      setConsent(consentRows?.[0] || null);
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
    const data = await runAction('export', 'Your export has been prepared.');
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atma-rekha-my-data.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const withdrawConsent = async () => {
    if (!consent || consent.withdrawn_at || busy) return;
    if (!window.confirm('Withdraw this consent record? Processing that depends on consent will stop where applicable; processing based on another lawful basis may continue.')) return;
    const data = await runAction('withdraw-consent', 'Consent withdrawal recorded.', { policy_version: consent.policy_version });
    if (data?.consent) setConsent(data.consent);
  };

  const requestDeletion = async () => {
    if (busy) return;
    if (!window.confirm('Request deletion of your eligible Atma Rekha personal data? Some information may be retained where required for security, payment, accounting, dispute or other applicable requirements.')) return;
    const data = await runAction('delete-request', 'Your deletion request has been submitted.');
    if (data?.request) setDeletion(data.request);
  };

  if (loading) {
    return <main className="privacy-center"><div className="privacy-center-card"><p>Loading privacy controls…</p></div></main>;
  }

  return <main className="privacy-center">
    <section className="privacy-hero">
      <p className="section-eyebrow">LEGAL · PRIVACY</p>
      <h1>Privacy</h1>
      <p>Atma Rekha respects the privacy of readers worldwide. This notice explains what personal data we collect, why we use it, how we protect it, when it may be shared, and the controls available to you.</p>
      <p className="privacy-applicability"><strong>Applicable laws:</strong> Depending on where you live and how you interact with Atma Rekha, different privacy laws may apply.</p>
      <p className="privacy-version">Last updated: 7 October 2026 · Privacy notice version {PRIVACY_VERSION}</p>
    </section>

    <section className="privacy-policy-card">
      <PolicySection heading="What we collect">We may collect account and profile information, reading activity, community content, membership information, payment-related details, and limited technical information needed to run and protect the service.</PolicySection>
      <PolicySection heading="How we use it">We use information to provide the website and its features, keep accounts secure, save reading activity, operate community and membership features, provide support, improve the service, and meet applicable requirements.</PolicySection>
      <PolicySection heading="When information is shared">We share information only when needed to provide a feature, process a transaction, protect the service, comply with applicable requirements, or when you choose to share it. We do not sell personal information for money.</PolicySection>
      <PolicySection heading="Public content">Information you choose to post in public areas, such as comments or your public profile, may be visible to other readers. Do not post passwords, payment details or other private information publicly.</PolicySection>
      <PolicySection heading="Cookies and storage">We use necessary browser storage and similar technologies for site preferences and features. We do not currently use advertising cookies.</PolicySection>
      <PolicySection heading="Security and retention">We use reasonable security measures and keep information only for as long as needed for the purposes described here or where retention is otherwise required.</PolicySection>
      <PolicySection heading="Your privacy rights">Depending on where you live, you may have rights to access, correct, delete, receive, restrict or object to certain uses of your information, or withdraw consent where applicable. Contact us if you want to make a request.</PolicySection>
      <PolicySection heading="Contact">For privacy questions or requests, contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may verify your identity before completing a request.</PolicySection>
    </section>

    <section className="privacy-policy-card">
      <header className="privacy-section-heading"><p className="section-eyebrow">DATA GUIDE</p><h2>What data we handle</h2></header>
      <div className="privacy-table-wrap"><table className="privacy-table"><thead><tr><th>Category</th><th>Examples</th><th>Why we use it</th></tr></thead><tbody>{DATA_TABLE.map(([category, examples, purpose]) => <tr key={category}><td><strong>{category}</strong></td><td>{examples}</td><td>{purpose}</td></tr>)}</tbody></table></div>
    </section>

    <section className="privacy-policy-card">
      <header className="privacy-section-heading"><p className="section-eyebrow">RETENTION</p><h2>How long information is kept</h2></header>
      <div className="privacy-table-wrap"><table className="privacy-table"><thead><tr><th>Data</th><th>Retention approach</th></tr></thead><tbody>{RETENTION_TABLE.map(([category, retention]) => <tr key={category}><td><strong>{category}</strong></td><td>{retention}</td></tr>)}</tbody></table></div>
      <p className="privacy-small-note">Exact retention periods may differ by record and applicable legal, security, accounting or dispute requirements.</p>
    </section>
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
        <button type="button" className="privacy-control-button privacy-control-destructive" onClick={requestDeletion} disabled={busy}>
          <strong>Request deletion</strong><span>Submit a request for eligible personal data</span>
        </button>
      </div>
      <p className="privacy-small-note">Some requests may require identity verification and may be subject to applicable retention requirements.</p>
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
        {deletion ? <>Deletion request · <strong>{deletion.status || 'submitted'}</strong>{deletion.requested_at ? <> · submitted {new Date(deletion.requested_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}{deletion.resolved_at ? <> · resolved {new Date(deletion.resolved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}</> : 'No account deletion request is currently recorded.'}
      </div>
      <p className="privacy-small-note">Requests sent by email are handled through support and may require additional identity verification before action.</p>
    </section>}

    <section className="privacy-policy-card">
      <PolicySection heading="Changes to this notice">We may update this notice when Atma Rekha, its data practices or applicable requirements change. The current version and effective date are shown at the top of this page.</PolicySection>
      
    </section>

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
