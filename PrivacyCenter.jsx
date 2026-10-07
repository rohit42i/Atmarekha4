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
  return <article className="info-section"><h3>{heading}</h3><p>{children}</p></article>;
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
    if (!currentUser) { setLoading(false); return; }
    const [{ data: consentRows }, { data: deletionRows }, { data: nominationRow }] = await Promise.all([
      supabase.from('dpdp_consent_records').select('policy_version,purposes,consented_at,withdrawn_at,source').eq('user_id', currentUser.id).order('consented_at', { ascending: false }).limit(5),
      supabase.from('dpdp_deletion_requests').select('id,status,requested_at,resolved_at').eq('user_id', currentUser.id).order('requested_at', { ascending: false }).limit(1),
      supabase.from('dpdp_nominations').select('nominee_name,nominee_email,nominee_phone,created_at,updated_at').eq('user_id', currentUser.id).maybeSingle(),
    ]);
    const nominationValue = nominationRow || null;
    setConsent(consentRows?.[0] || null);
    setDeletion(deletionRows?.[0] || null);
    setNomination(nominationValue);
    setNomineeName(nominationValue?.nominee_name || '');
    setNomineeEmail(nominationValue?.nominee_email || '');
    setNomineePhone(nominationValue?.nominee_phone || '');
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
      const withdrawnAt = new Date().toISOString();
      const { error: updateError } = await supabase.from('dpdp_consent_records')
        .update({ withdrawn_at: withdrawnAt })
        .eq('user_id', user.id)
        .eq('policy_version', consent.policy_version);
      if (updateError) throw updateError;
      setConsent({ ...consent, withdrawn_at: withdrawnAt });
      setMessage('Consent withdrawal recorded.');
    } catch (err) {
      setError(err?.message || 'Unable to withdraw consent.');
    } finally { setBusy(false); }
  };

  const saveNomination = async () => {
    if (!user || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dpdp-data-rights', {
        body: { action: 'nomination', nominee_name: nomineeName, nominee_email: nomineeEmail, nominee_phone: nomineePhone }
      });
      if (fnError) throw fnError;
      setNomination(data?.nomination || null);
      setMessage('Your nomination details were saved.');
    } catch (err) {
      setError(err?.message || 'Unable to save your nomination.');
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
    <header className="privacy-center-card">
      <p className="section-eyebrow">LEGAL · PRIVACY</p>
      <h1>Privacy</h1>
      <p>This page combines the Privacy Policy with your personal-data controls. It is designed around the Digital Personal Data Protection Act, 2023 and the notified Digital Personal Data Protection Rules, 2025. It does not remove lawful processing or retention obligations.</p>
    </header>

    <section className="privacy-policy-card">
      <PolicySection heading="Effective date">7 October 2026. This notice is version {PRIVACY_VERSION} and will be updated when our processing, features or applicable law materially changes.</PolicySection>
      <PolicySection heading="Data fiduciary & contact">Atma Rekha is the Data Fiduciary for personal data processed through this service. Privacy requests and grievances can be sent to {CONTACT_EMAIL}.</PolicySection>
      <PolicySection heading="Personal data we process">Depending on the feature you use, we may process your email, name, username, avatar, bio, account timestamps, reading history, bookmarks, ratings, comments, community activity, notification subscriptions, membership and payment records, and technical/security information.</PolicySection>
      <PolicySection heading="Purposes & lawful processing">We use personal data to create and secure accounts, provide reading and profile features, save progress and favourites, operate community features, provide memberships and payments, prevent abuse, communicate important service information, provide support and meet legal obligations. Consent is used where consent is the applicable basis; other processing may rely on a lawful use or legal obligation where permitted.</PolicySection>
      <PolicySection heading="Notice & consent">Before account creation, the signup notice identifies the data and purposes involved and links to this full notice. Consent is recorded with the notice version and purposes. Where consent is the basis, it can be withdrawn with a comparable level of ease through this page.</PolicySection>
      <PolicySection heading="Sharing & processors">Service infrastructure may use Supabase for authentication/database services, Cloudflare for storage, delivery and Workers, and Razorpay for payments. Only data needed for the relevant service is shared with processors or other parties where permitted. Public comments/community content can be visible to other readers.</PolicySection>
      <PolicySection heading="Retention">Personal data is retained only while needed for the stated purpose or where retention is required or permitted for legal, accounting, payment, security, fraud-prevention or dispute purposes. Eligible data is deleted or de-identified when the purpose is no longer served, subject to lawful exceptions.</PolicySection>
      <PolicySection heading="Security">We use access controls, row-level database security, protected server-side functions for privileged operations, HTTPS/security controls, controlled media delivery, logging and backups appropriate to the service. Secret server credentials are not placed in browser code.</PolicySection>
      <PolicySection heading="Children">Account creation is restricted to readers aged 18 or older. We do not intentionally create accounts for children. Public reading may be available without an account where permitted by the service.</PolicySection>
      <PolicySection heading="Personal data breaches">If a qualifying personal data breach occurs, we will assess and contain it, investigate and document it, and make notifications required by applicable law and the notified Rules.</PolicySection>
      <PolicySection heading="Your rights">Your controls below provide access/export, consent withdrawal, nomination and erasure. Profile information can be corrected from Profile. For any other correction or request, contact {CONTACT_EMAIL}; we may verify account ownership before changing or disclosing personal data.</PolicySection>
      <PolicySection heading="Grievance redressal">Email {CONTACT_EMAIL} with “DPDP Request” in the subject. This is a readily available grievance/request channel. We will acknowledge and handle the request within the applicable legal and operational period; the notified Rules provide a grievance-response period of up to 90 days.</PolicySection>
    </section>

    <section className="privacy-controls-card">
      <div className="privacy-center-card"><p className="section-eyebrow">YOUR DATA</p><h2>Data rights & controls</h2><p>These controls let you exercise the principal rights available under the DPDP framework. Lawful exceptions and required retention can apply.</p></div>
      <div className="privacy-grid">
        <section className="privacy-action"><h2>Access & portability</h2><p>Download a machine-readable copy of personal data associated with your account, including the records we hold in the listed service tables and your consent/deletion records.</p><div className="button-row"><button className="primary-button" type="button" disabled={busy} onClick={exportData}>{busy ? 'Preparing…' : 'Export my data'}</button></div></section>
        <section className="privacy-action"><h2>Consent</h2><p>Notice version: <strong>{consent?.policy_version || 'Not recorded'}</strong>. {consent?.withdrawn_at ? 'Withdrawal recorded.' : 'Your signup consent is recorded with its purposes.'}</p><div className="button-row"><button className="secondary-button" type="button" disabled={busy || !consent || Boolean(consent.withdrawn_at)} onClick={withdrawConsent}>Withdraw consent</button></div></section>
        <section className="privacy-action"><h2>Correction</h2><p>Update your display name, username, bio, avatar and email from Profile. For any other inaccurate personal data, send a correction request to support.</p><div className="button-row"><button className="secondary-button" type="button" onClick={()=>{window.location.hash='profile'}}>Open profile</button><button className="secondary-button" type="button" onClick={()=>requestByEmail('DPDP Correction Request','Please describe the personal data that is inaccurate and the correction you are requesting.')}>Request correction</button></div></section>
        <section className="privacy-action"><h2>Nomination</h2><p>Nominate another individual to exercise your Data Principal rights in the event of your death or incapacity, as provided by the applicable framework.</p><label>Nominee name<input value={nomineeName} onChange={e=>setNomineeName(e.target.value)} maxLength={120} required/></label><label>Nominee email<input type="email" value={nomineeEmail} onChange={e=>setNomineeEmail(e.target.value)} maxLength={254}/></label><label>Nominee phone<input value={nomineePhone} onChange={e=>setNomineePhone(e.target.value)} maxLength={30}/></label><div className="button-row"><button className="secondary-button" type="button" disabled={busy || !nomineeName.trim()} onClick={saveNomination}>{nomination ? 'Update nomination' : 'Save nomination'}</button></div></section>
        <section className="privacy-action"><h2>Erasure</h2><p>Submit an account deletion request. Eligible personal data will be removed through the deletion workflow; data required by law or for other lawful retention purposes may remain for the permitted period.</p><div className="button-row"><button className="secondary-button" type="button" disabled={busy || ['pending','processing'].includes(deletion?.status)} onClick={requestDeletion}>{deletion?.status === 'pending' || deletion?.status === 'processing' ? 'Erasure requested' : 'Request erasure'}</button></div></section>
        <section className="privacy-action"><h2>Grievance & support</h2><p>For privacy requests, grievances, correction issues or questions about processing, contact {CONTACT_EMAIL}. We may verify your identity/account before acting.</p><div className="button-row"><button className="secondary-button" type="button" onClick={()=>requestByEmail('DPDP Request')}>Email privacy support</button></div></section>
      </div>
    </section>

    {message && <p className="form-field-success" role="status" aria-live="polite">{message}</p>}
    {error && <p className="form-field-error" role="alert">{error}</p>}
    {exported && <section className="data-export"><h2>Export preview</h2><pre>{JSON.stringify(exported, null, 2)}</pre></section>}
    <div className="privacy-note">Atma Rekha is a small independent service and this implementation is intended to provide the DPDP rights and controls applicable to its processing. It is not a claim that every statutory provision is already in force for every class of Data Fiduciary.</div>
  </main>;
}
