import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const PRIVACY_VERSION = '2026-10-07';
const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

const DATA_TABLE = [
  ['Account', 'Email, account ID, verification and account timestamps', 'Account access, security, support and service delivery'],
  ['Profile', 'Name, username, avatar and bio when provided', 'Your public/private profile features and community identity'],
  ['Reading', 'Reading progress, history and bookmarks', 'Continue reading, favourites and reader features'],
  ['Community', 'Comments, reactions, reports and related activity', 'Community operation, moderation and safety'],
  ['Membership', 'Membership status and related account records', 'Provide membership features and access'],
  ['Payments', 'Payment and billing records supplied through the payment provider', 'Payments, refunds, accounting and support'],
  ['Security', 'Technical information needed to protect the service', 'Fraud prevention, abuse prevention, troubleshooting and security'],
  ['Privacy requests', 'Requests, verification details and response records', 'Handle privacy, deletion, correction and grievance requests'],
];

const RETENTION_TABLE = [
  ['Account data', 'While your account is active, then deleted or de-identified when no longer needed, subject to lawful retention'],
  ['Reading and profile data', 'While needed to provide the feature or until you delete it, subject to lawful exceptions'],
  ['Community content', 'While needed for the service, moderation, safety or dispute handling, subject to removal rules'],
  ['Payment records', 'For as long as needed for payment support, accounting, tax, fraud prevention or other lawful duties'],
  ['Security records', 'For the period reasonably needed for security, abuse prevention, incident investigation and legal protection'],
  ['Privacy requests', 'Long enough to verify, process and document the request and meet applicable obligations'],
];

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

function DataTable({ rows, headers }) {
  return <div className="privacy-table-wrap"><table className="privacy-table"><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
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
    const data = await runAction('export', 'Your data export is ready.');
    if (!data) return;
    setExported(data);
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
    if (!window.confirm('Request deletion of your eligible Atma Rekha personal data? Some information may need to be retained for security, payment, accounting, dispute or other lawful reasons.')) return;
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
      <PolicySection heading="Contact">For privacy questions or requests, contact {CONTACT_EMAIL{'}'}. We may verify your identity before completing a request.</PolicySection>
    </section>

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

    {exported && <section className="privacy-export">
      <h2>Export preview</h2>
      <p className="privacy-small-note">This is the data returned to your signed-in account session. The downloaded JSON file is generated locally in your browser.</p>
      <pre>{JSON.stringify(exported, null, 2)}</pre>
    </section>}

    <section className="privacy-policy-card">
      <PolicySection heading="Changes to this notice">We may update this notice when Atma Rekha, its data practices or applicable requirements change. The current version and effective date are shown at the top of this page.</PolicySection>
      <PolicySection heading="Contact">Privacy contact: {CONTACT_EMAIL}. Nothing in this notice is intended to remove a right that cannot lawfully be waived under applicable law.</PolicySection>
    </section>

    {!user && <section className="privacy-center-card">
      <h2>Manage your personal data</h2>
      <p>Sign in to access export, consent, deletion, nomination and profile controls. You can still email us about a privacy request without signing in.</p>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={() => window.dispatchEvent(new CustomEvent('atma-open-auth',{detail:{mode:'login',returnTo:'privacy'}}))}>Sign in</button>
        <button className="secondary-button" type="button" onClick={backHome}>Back home</button>
      </div>
    </section>}
  </main>;
}
