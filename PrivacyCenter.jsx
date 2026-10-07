import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const PRIVACY_VERSION = '2026-10-07';

function backHome() {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
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
    setNomination(nominationValue || null);
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
      link.href = url;
      link.download = 'atma-rekha-my-data.json';
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Your data export is ready.');
    } catch (err) {
      setError(err?.message || 'Unable to export your data.');
    } finally { setBusy(false); }
  };

  const withdrawConsent = async () => {
    if (!user || busy || !consent || consent.withdrawn_at) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: updateError } = await supabase
        .from('dpdp_consent_records')
        .update({ withdrawn_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('policy_version', consent.policy_version);
      if (updateError) throw updateError;
      setConsent({ ...consent, withdrawn_at: new Date().toISOString() });
      setMessage('Consent withdrawal recorded. Processing that depends on consent will be stopped where applicable.');
    } catch (err) { setError(err?.message || 'Unable to withdraw consent.'); }
    finally { setBusy(false); }
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
    } catch (err) { setError(err?.message || 'Unable to save your nomination.'); }
    finally { setBusy(false); }
  };

  const requestDeletion = async () => {
    if (!user || busy) return;
    if (!window.confirm('Request deletion of your Atma Rekha account data? Active payment/legal records may need to be retained where required by law.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dpdp-data-rights', { body: { action: 'delete-request' } });
      if (fnError) throw fnError;
      setDeletion(data?.request || null);
      setMessage('Your deletion request has been submitted.');
    } catch (err) { setError(err?.message || 'Unable to submit deletion request.'); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="privacy-center"><div className="privacy-center-card"><p>Loading privacy controls…</p></div></main>;
  if (!user) return <main className="privacy-center"><div className="privacy-center-card"><h1>Privacy Center</h1><p>Sign in to access your personal data controls.</p><button className="primary-button" type="button" onClick={()=>window.dispatchEvent(new CustomEvent('atma-open-auth',{detail:{mode:'login'}}))}>Sign in</button><button className="secondary-button" type="button" onClick={backHome}>Back home</button></div></main>;

  return <main className="privacy-center">
    <header className="privacy-center-card">
      <p className="section-eyebrow">LEGAL · DATA RIGHTS</p>
      <h1>Privacy Center</h1>
      <p>Your account controls are designed around the Digital Personal Data Protection Act, 2023 and the notified 2025 Rules. You can request access, correction, deletion, and withdrawal of consent, subject to lawful exceptions.</p>
    </header>
    <div className="privacy-grid">
      <section className="privacy-action">
        <h2>Access & portability</h2>
        <p>Request a copy of the personal data associated with this account, including profile, reading, community, membership and notification records we hold.</p>
        <div className="button-row"><button className="primary-button" type="button" disabled={busy} onClick={exportData}>{busy ? 'Preparing…' : 'Export my data'}</button></div>
      </section>
      <section className="privacy-action">
        <h2>Consent</h2>
        <p>Consent version: <strong>{consent?.policy_version || 'Not recorded'}</strong>. {consent?.withdrawn_at ? 'Withdrawal recorded.' : 'Your signup consent is recorded with its purposes.'}</p>
        <div className="button-row"><button className="secondary-button" type="button" disabled={busy || !consent || Boolean(consent.withdrawn_at)} onClick={withdrawConsent}>Withdraw consent</button></div>
      </section>
      <section className="privacy-action">
        <h2>Correction</h2>
        <p>Update profile information such as your display name, username, bio and avatar from your profile page.</p>
        <div className="button-row"><button className="secondary-button" type="button" onClick={()=>{window.location.hash='profile'}}>Open profile</button></div>
      </section>
      <section className="privacy-action">
        <h2>Nomination</h2>
        <p>Nominate another individual to exercise your Data Principal rights in the event of your death or incapacity, as provided by the applicable DPDP framework.</p>
        <label>Nominee name<input value={nomineeName} onChange={e=>setNomineeName(e.target.value)} maxLength={120} required/></label>
        <label>Nominee email<input type="email" value={nomineeEmail} onChange={e=>setNomineeEmail(e.target.value)} maxLength={254}/></label>
        <label>Nominee phone<input value={nomineePhone} onChange={e=>setNomineePhone(e.target.value)} maxLength={30}/></label>
        <div className="button-row"><button className="secondary-button" type="button" disabled={busy || !nomineeName.trim()} onClick={saveNomination}>{nomination ? 'Update nomination' : 'Save nomination'}</button></div>
      </section>
      <section className="privacy-action">
        <h2>Erasure</h2>
        <p>Submit an account deletion request. We will review it and remove eligible personal data. Records required for legal, security or payment obligations may be retained for the permitted period.</p>
        <div className="button-row"><button className="secondary-button" type="button" disabled={busy || ['pending','processing'].includes(deletion?.status)} onClick={requestDeletion}>{deletion?.status === 'pending' || deletion?.status === 'processing' ? 'Deletion requested' : 'Request deletion'}</button></div>
      </section>
    </div>
    <div className="privacy-note"><strong>Grievance & support:</strong> Email atmarekhasupport@gmail.com with “DPDP Request” in the subject. We will use the request to verify your account, process the request, and respond within the applicable period. Your rights include access, correction, erasure, consent withdrawal where applicable, grievance redressal and nomination.</div>
    {message && <p className="form-field-success" role="status" aria-live="polite">{message}</p>}
    {error && <p className="form-field-error" role="alert">{error}</p>}
    {exported && <section className="data-export"><h2>Export preview</h2><pre>{JSON.stringify(exported, null, 2)}</pre></section>}
  </main>;
}
