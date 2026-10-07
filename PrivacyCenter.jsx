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
  const [nomination, setNomination] = useState(null);
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeEmail, setNomineeEmail] = useState('');
  const [nomineePhone, setNomineePhone] = useState('');

  const load = async currentUser => {
    setUser(currentUser);
    if (!currentUser) {
      setConsent(null);
      setDeletion(null);
      setNomination(null);
      setLoading(false);
      return;
    }

    try {
      const [{ data: consentRows }, { data: deletionRows }, { data: nominationRow }] = await Promise.all([
        supabase.from('dpdp_consent_records').select('policy_version,purposes,consented_at,withdrawn_at,source').eq('user_id', currentUser.id).order('consented_at', { ascending: false }).limit(5),
        supabase.from('dpdp_deletion_requests').select('id,status,requested_at,resolved_at').eq('user_id', currentUser.id).order('requested_at', { ascending: false }).limit(1),
        supabase.from('dpdp_nominations').select('nominee_name,nominee_email,nominee_phone,created_at,updated_at').eq('user_id', currentUser.id).maybeSingle(),
      ]);
      setConsent(consentRows?.[0] || null);
      setDeletion(deletionRows?.[0] || null);
      setNomination(nominationRow || null);
      setNomineeName(nominationRow?.nominee_name || '');
      setNomineeEmail(nominationRow?.nominee_email || '');
      setNomineePhone(nominationRow?.nominee_phone || '');
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

  const saveNomination = async () => {
    if (!nomineeName.trim() || busy) {
      setError('Enter a nominee name.');
      return;
    }
    const data = await runAction('nomination', 'Your nomination details were saved.', {
      nominee_name: nomineeName.trim(),
      nominee_email: nomineeEmail.trim(),
      nominee_phone: nomineePhone.trim(),
    });
    if (data?.nomination) setNomination(data.nomination);
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
      <PolicySection heading="Who operates the service">Atma Rekha is an independent creator project by Arkesh, operated from India and available to readers in other locations. Privacy questions, requests and grievances can be sent to {CONTACT_EMAIL}.</PolicySection>
      <PolicySection heading="What we collect">We collect only the information needed for the features you use. This may include account details, profile information, reading activity, community activity, membership and payment records, privacy requests, and limited technical or security information.</PolicySection>
      <PolicySection heading="How we use your information">We use information to provide accounts and reader features, remember progress and favourites, run community and membership features, process payments, keep the service secure, prevent abuse, troubleshoot problems, provide support, and meet applicable obligations.</PolicySection>\n      <PolicySection heading="Why a particular use is allowed">Where required, we use an appropriate lawful basis for each processing activity. This can include providing the service you requested, keeping the service secure, meeting legal obligations, pursuing legitimate interests where allowed, or using your consent where consent is required.</PolicySection>
      <PolicySection heading="Public reading and account features">Some reading pages can be available without an account. An account is required for features such as saved progress, bookmarks, community participation and membership access. Account creation currently requires the user to be 18 or older.</PolicySection>
      <PolicySection heading="Public community content">Comments, usernames, reactions and other community contributions may be visible to other readers. Do not publish passwords, payment credentials, private addresses, government identifiers or other sensitive information in public areas.</PolicySection>
      <PolicySection heading="Data minimisation">We aim to collect and use only information reasonably needed for a specific feature or purpose. Optional information is not required unless the feature explains why it is needed.</PolicySection>
      <PolicySection heading="Sharing and service providers">Atma Rekha may use Supabase for authentication and database services, Cloudflare for storage, delivery, Workers and service infrastructure, and Razorpay for payments. Providers receive only the information needed for the service they perform. Payment credentials are handled through the payment provider rather than requested by Atma Rekha.</PolicySection>
      <PolicySection heading="International data transfers">Because the website is available worldwide and relies on cloud infrastructure, personal information may be processed or stored in locations outside your home country. We use appropriate contractual, technical or organisational measures required for the applicable processing and provider arrangements.</PolicySection>
      <PolicySection heading="Cookies, browser storage and similar technologies">Atma Rekha uses browser storage and similar mechanisms for essential preferences and reader features such as theme, language, local progress, offline reading, drafts and pseudonymous chapter-view measurement. We do not currently use advertising cookies or sell personal information for money. Your browser can clear stored site data, but doing so may remove local preferences and offline or locally stored progress.</PolicySection>
      <PolicySection heading="Chapter-view measurement">The reader records chapter views using a randomly generated browser identifier and the chapter being viewed. This is used for aggregate readership measurement and admin reporting; it is not intended to identify you by name.</PolicySection>
      <PolicySection heading="Security">We use access controls, row-level database policies, protected server-side functions for privileged operations, HTTPS and security headers, controlled media delivery, monitoring and backups appropriate to the service. No online system can guarantee absolute security.</PolicySection>
      <PolicySection heading="Retention">We keep personal data only for as long as reasonably necessary for the purposes described here, or for longer where security, payment, accounting, dispute, fraud-prevention or other lawful requirements require it. When the purpose ends, eligible data is deleted, anonymised or de-identified according to our operational procedures.</PolicySection>
      <PolicySection heading="Deletion and account closure">You can request deletion of eligible personal data. Deleting an account can affect access to profile, progress, bookmarks, community and membership features. Some records may remain for lawful retention, security, fraud prevention, accounting, payment, dispute handling or similar purposes.</PolicySection>
      <PolicySection heading="Breaches and security incidents">When Atma Rekha becomes aware of a personal-data security incident, we assess it, contain it, investigate it and make required notifications or other protective responses under applicable law and our incident procedures.</PolicySection>\n      <PolicySection heading="Complaints and verification">You can contact us about a privacy concern or complaint. Where available in your location, you may also contact the relevant privacy or data-protection authority. We may ask for enough information to verify your identity before fulfilling a request.</PolicySection>
      <PolicySection heading="Children and age">The current account product is intended for users aged 18 or older. Public reading availability may differ from account eligibility. We do not knowingly create accounts for users below the current account age requirement.</PolicySection>
    </section>

    <section className="privacy-policy-card">
      <header className="privacy-section-heading">
        <p className="section-eyebrow">YOUR DATA</p>
        <h2>What we collect and why</h2>
        <p>A feature-based summary of the information used by Atma Rekha.</p>
      </header>
      <DataTable rows={DATA_TABLE} headers={['Category', 'Typical data', 'Main purpose']} />
    </section>

    <section className="privacy-policy-card">
      <header className="privacy-section-heading">
        <p className="section-eyebrow">RETENTION</p>
        <h2>How long we keep information</h2>
      </header>
      <DataTable rows={RETENTION_TABLE} headers={['Data type', 'Typical retention approach']} />
    </section>

    <section className="privacy-policy-card">
      <header className="privacy-section-heading">
        <p className="section-eyebrow">YOUR RIGHTS</p>
        <h2>Privacy controls and requests</h2>
        <p>The rights available to you can depend on your location, the type of data involved and applicable exceptions. We may verify account ownership before completing a request.</p>
      </header>

      <div className="privacy-grid">
        <section className="privacy-action">
          <h3>Access / Export</h3>
          <p>Download a machine-readable copy of personal data available through your account.</p>
          <button className="primary-button" type="button" disabled={!user || busy} onClick={exportData}>{busy ? 'Preparing…' : 'Export my data'}</button>
        </section>

        <section className="privacy-action">
          <h3>Correct my data</h3>
          <p>Update supported profile information yourself, or contact us for other corrections.</p>
          <div className="button-row">
            {user && <button className="secondary-button" type="button" onClick={openProfile}>Open profile</button>}
            <button className="secondary-button" type="button" onClick={() => requestByEmail('Privacy correction request', 'Please describe the inaccurate information and the correction you are requesting.')}>Request correction</button>
          </div>
        </section>

        <section className="privacy-action">
          <h3>Delete my data</h3>
          <p>Submit a deletion request for eligible personal data. Some records may need to be retained.</p>
          <button className="secondary-button" type="button" disabled={!user || busy || ['pending','processing'].includes(deletion?.status)} onClick={requestDeletion}>
            {['pending','processing'].includes(deletion?.status) ? 'Deletion request active' : 'Request deletion'}
          </button>
        </section>

        <section className="privacy-action">
          <h3>Withdraw consent</h3>
          <p>Where processing is based on consent, you can withdraw that consent. Withdrawal does not undo earlier lawful processing.</p>
          <button className="secondary-button" type="button" disabled={!user || busy || !consent || Boolean(consent.withdrawn_at)} onClick={withdrawConsent}>
            {consent?.withdrawn_at ? 'Consent withdrawn' : 'Withdraw consent'}
          </button>
        </section>

        <section className="privacy-action">
          <h3>Object / Restrict / Portability</h3>
          <p>For requests that depend on your location or a specific processing situation, contact privacy support and describe the request.</p>
          <button className="secondary-button" type="button" onClick={() => requestByEmail('Privacy rights request', 'Please state whether your request concerns objection, restriction, portability or another privacy right, and describe the relevant processing.')}>Submit request</button>
        </section>

        <section className="privacy-action">
          <h3>Nomination</h3>
          <p>Where this feature is relevant to you, you can save a person to contact or act on your behalf regarding your account after your death or incapacity.</p>
          {!user ? <button className="secondary-button" type="button" onClick={() => window.dispatchEvent(new CustomEvent('atma-open-auth',{detail:{mode:'login',returnTo:'privacy'}}))}>Sign in</button> : <>
            <div className="privacy-form-grid">
              <label>Name<input value={nomineeName} onChange={e=>setNomineeName(e.target.value.slice(0,120))} maxLength={120} autoComplete="name"/></label>
              <label>Email<input type="email" value={nomineeEmail} onChange={e=>setNomineeEmail(e.target.value.slice(0,254))} maxLength={254} autoComplete="email"/></label>
              <label>Phone (optional)<input value={nomineePhone} onChange={e=>setNomineePhone(e.target.value.slice(0,30))} maxLength={30} autoComplete="tel"/></label>
            </div>
            <button className="secondary-button" type="button" disabled={busy} onClick={saveNomination}>{nomination ? 'Update nomination' : 'Save nomination'}</button>
          </>}
        </section>

        <section className="privacy-action">
          <h3>Grievance / privacy support</h3>
          <p>For privacy questions, complaints or requests that need manual review, contact our support address.</p>
          <button className="secondary-button" type="button" onClick={() => requestByEmail('Privacy request')}>Email privacy support</button>
        </section>

        <section className="privacy-action">
          <h3>Other local rights</h3>
          <p>Your location may give you additional privacy or consumer rights. Tell us where you are located and what you are requesting so we can route the request correctly.</p>
          <button className="secondary-button" type="button" onClick={() => requestByEmail('Privacy request — local rights', 'Please include your country/region and the privacy right or request you want to exercise.')}>Start request</button>
        </section>
      </div>
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
