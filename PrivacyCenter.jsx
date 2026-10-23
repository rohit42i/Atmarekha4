import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import PrivacyPolicySections from './PrivacyPolicySections.jsx';

const CONTACT_EMAIL = 'atmarekhasupport@gmail.com';

function backHome() {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function openProfile() {
  window.location.hash = 'profile';
}

async function privacyErrorMessage(error, fallback) {
  const context = error?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
    } catch {}
  }
  return error?.message || fallback;
}

function requestByEmail(subject, body = '') {
  const url = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + (body ? '&body=' + encodeURIComponent(body) : '');
  window.location.href = url;
}

export default function PrivacyCenter() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(null);
  const [deletion, setDeletion] = useState(null);
  const [deletionDialog, setDeletionDialog] = useState('');
  const [deletionPeriod, setDeletionPeriod] = useState('30_days');
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletionOtp, setDeletionOtp] = useState('');
  const [deletionStep, setDeletionStep] = useState('password');

  const load = async currentUser => {
    setError('');
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
        supabase.from('dpdp_deletion_requests').select('id,status,requested_at,resolved_at,resolution_note,requested_period,scheduled_delete_at,recovery_until,confirmed_at,cancelled_at').eq('user_id', currentUser.id).order('requested_at', { ascending: false }).limit(1),
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
      setError(await privacyErrorMessage(err, 'Unable to complete the privacy request.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const refreshStatus = async () => {
    if (!user || refreshing || busy) return;
    setRefreshing(true);
    setError('');
    setMessage('');
    try {
      const [
        { data: consentRows, error: consentError },
        { data: deletionRows, error: deletionError },
      ] = await Promise.all([
        supabase.from('dpdp_consent_records').select('policy_version,purposes,consented_at,withdrawn_at,source').eq('user_id', user.id).order('consented_at', { ascending: false }).limit(5),
        supabase.from('dpdp_deletion_requests').select('id,status,requested_at,resolved_at,resolution_note').eq('user_id', user.id).order('requested_at', { ascending: false }).limit(1),
      ]);
      if (consentError) throw new Error('Unable to refresh consent records: ' + consentError.message);
      if (deletionError) throw new Error('Unable to refresh deletion request status: ' + deletionError.message);
      setConsent(consentRows?.find(row => !row.withdrawn_at) || consentRows?.[0] || null);
      setDeletion(deletionRows?.[0] || null);
      setMessage('Privacy request status is up to date.');
    } catch (err) {
      setError(err?.message || 'Unable to refresh privacy status.');
    } finally {
      setRefreshing(false);
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
    if (busy || consent?.withdrawn_at) return;
    if (!consent) {
      requestByEmail(
        'Consent record review',
        'Please review my Atma Rekha account and confirm whether any consent record is associated with it. If consent-based processing applies, please help me withdraw it.\n\nAccount email: ' + (user?.email || 'Please add your account email'),
      );
      setMessage('No active consent record is available to withdraw. A review request has been prepared for support.');
      return;
    }
    if (!window.confirm('Withdraw this consent record? Processing that depends on consent will stop where applicable; processing based on another lawful basis may continue.')) return;
    const data = await runAction('withdraw-consent', 'Consent withdrawal recorded.', { policy_version: consent.policy_version });
    if (data?.consent) setConsent(data.consent);
  };

  const requestDeletion = () => {
    if (busy || deletion?.status === 'pending' || deletion?.status === 'processing') return;
    setDeletionPassword('');
    setDeletionOtp('');
    setDeletionStep('password');
    setDeletionDialog('delete');
    setError('');
    setMessage('');
  };

  const startDeletionOtp = async event => {
    event?.preventDefault();
    if (!user?.email || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: deletionPassword });
      if (authError) throw new Error('Password confirmation failed. Check your password and try again.');
      const { data, error: fnError } = await supabase.functions.invoke('account-deletion-workflow', {
        body: { action: 'send-delete-otp', period: deletionPeriod },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setDeletionStep('otp');
      setMessage(data?.message || 'A verification code has been sent to your email.');
    } catch (err) {
      setError(await privacyErrorMessage(err, 'Unable to send the verification code.'));
    } finally { setBusy(false); }
  };

  const confirmDeletionOtp = async event => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('account-deletion-workflow', {
        body: { action: 'confirm-delete-otp', otp: deletionOtp },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setDeletion(data?.request || null);
      setDeletionDialog('');
      setDeletionOtp('');
      setMessage(data?.message || 'Your deletion request is confirmed. A 14-day recovery window has started.');
    } catch (err) {
      setError(await privacyErrorMessage(err, 'Unable to confirm the verification code.'));
    } finally { setBusy(false); }
  };

  const startReactivationOtp = async () => {
    if (busy || !deletion?.recovery_until || new Date(deletion.recovery_until).getTime() < Date.now()) return;
    setDeletionOtp('');
    setDeletionStep('otp');
    setDeletionDialog('reactivate');
    setError(''); setMessage('');
    setBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('account-deletion-workflow', {
        body: { action: 'send-reactivate-otp' },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setMessage(data?.message || 'A recovery code has been sent to your email.');
    } catch (err) {
      setError(await privacyErrorMessage(err, 'Unable to send a recovery code.'));
    } finally { setBusy(false); }
  };

  const confirmReactivationOtp = async event => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('account-deletion-workflow', {
        body: { action: 'confirm-reactivate-otp', otp: deletionOtp },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setDeletion(data?.request || null);
      setDeletionDialog('');
      setDeletionOtp('');
      setMessage(data?.message || 'Your deletion request has been cancelled.');
    } catch (err) {
      setError(await privacyErrorMessage(err, 'Unable to cancel the deletion request.'));
    } finally { setBusy(false); }
  };

  if (loading) {
    return <main className="privacy-center"><div className="privacy-center-card"><p>Loading privacy controls…</p></div></main>;
  }

  return <main className="privacy-center">
    <section className="privacy-hero">
      <h1>Privacy</h1>
      <p>This page explains what information Atma Rekha uses, why it is needed, and the choices you have.</p>
      <p className="privacy-version">Last updated: 20 October 2026</p>
    </section>

    <section className="privacy-policy-card">
      <PrivacyPolicySections />
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
        <button type="button" className="privacy-control-button" onClick={withdrawConsent} disabled={busy || Boolean(consent?.withdrawn_at)}>
          <strong>{consent?.withdrawn_at ? 'Consent withdrawn' : consent ? 'Withdraw consent' : 'Request consent review'}</strong>
          <span>{consent ? (consent.withdrawn_at ? 'This consent record is already withdrawn' : 'Withdraw recorded consent where it is the basis for processing') : 'No active record found. Ask support to check your account.'}</span>
        </button>
        <button type="button" className="privacy-control-button privacy-control-destructive" onClick={requestDeletion} disabled={busy || deletion?.status === 'pending' || deletion?.status === 'processing'}>
          <strong>{deletion?.status === 'pending' || deletion?.status === 'processing' ? 'Deletion request in progress' : 'Request deletion'}</strong><span>{deletion?.status === 'pending' || deletion?.status === 'processing' ? 'A request is already being reviewed' : 'Request erasure of eligible personal data'}</span>
        </button>
      </div>
      <p className="privacy-small-note">Your password and email code confirm the request. A 14-day recovery window starts after email verification. The selected period controls the earliest scheduled deletion, and permanent deletion cannot be undone after processing. Records required by law or necessary for security, accounting or disputes may be retained.</p>
      {consent && <div className="privacy-control-status">Consent record: <strong>{consent.withdrawn_at ? 'withdrawn' : 'recorded'}</strong>{consent.consented_at ? <> · {new Date(consent.consented_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}</div>}
      {deletion?.status === 'pending' && deletion?.recovery_until && new Date(deletion.recovery_until).getTime() > Date.now() && <div className="privacy-email-actions">
        <button type="button" className="secondary-button" onClick={startReactivationOtp} disabled={busy}>Cancel deletion and recover account</button>
      </div>}
      <div className="privacy-email-actions">
        <button type="button" className="secondary-button" onClick={() => requestByEmail('Atma Rekha Privacy Request')}>Email a privacy request</button>
      </div>
    </section>}


    {user && deletionDialog && <div className="privacy-modal-backdrop" role="presentation">
      <section className="privacy-center-card" role="dialog" aria-modal="true" aria-labelledby="deletion-dialog-title">
        <h2 id="deletion-dialog-title">{deletionDialog === 'reactivate' ? 'Recover your account' : 'Confirm account deletion'}</h2>
        {deletionDialog === 'delete' && deletionStep === 'password' && <form onSubmit={startDeletionOtp}>
          <p>Confirm your password first. We will then email a one-time code to {user.email}.</p>
          <label htmlFor="deletion-period">Deletion period</label>
          <select id="deletion-period" value={deletionPeriod} onChange={event => setDeletionPeriod(event.target.value)} disabled={busy}>
            <option value="7_days">7 days, with a minimum 14-day recovery window</option>
            <option value="30_days">30 days</option>
            <option value="90_days">90 days</option>
            <option value="permanent">Permanent deletion after recovery window</option>
          </select>
          <label htmlFor="deletion-password">Current password</label>
          <input id="deletion-password" type="password" autoComplete="current-password" value={deletionPassword} onChange={event => setDeletionPassword(event.target.value)} required disabled={busy}/>
          <div className="button-row"><button className="primary-button" type="submit" disabled={busy || !deletionPassword}>{busy ? 'Verifying…' : 'Verify password and send code'}</button><button className="secondary-button" type="button" onClick={() => setDeletionDialog('')} disabled={busy}>Cancel</button></div>
        </form>}
        {deletionStep === 'otp' && <form onSubmit={deletionDialog === 'reactivate' ? confirmReactivationOtp : confirmDeletionOtp}>
          <p>Enter the 6-digit code sent to {user.email}. The code expires in 10 minutes.</p>
          <label htmlFor="deletion-otp">Email verification code</label>
          <input id="deletion-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={deletionOtp} onChange={event => setDeletionOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required disabled={busy}/>
          <div className="button-row"><button className="primary-button" type="submit" disabled={busy || deletionOtp.length !== 6}>{busy ? 'Confirming…' : deletionDialog === 'reactivate' ? 'Confirm recovery' : 'Confirm deletion request'}</button><button className="secondary-button" type="button" onClick={() => setDeletionDialog('')} disabled={busy}>Cancel</button></div>
        </form>}
      </section>
    </div>}

    {(message || error) && <div className={`privacy-status ${error ? 'privacy-status-error' : 'privacy-status-success'}`} role={error ? 'alert' : 'status'} aria-live="polite">{error || message}</div>}

    {user && <section className="privacy-policy-card">
      <header className="privacy-section-heading privacy-request-status-heading">
        <div><p className="section-eyebrow">REQUEST STATUS</p><h2>Your recent privacy request</h2></div>
        <button type="button" className="secondary-button" onClick={refreshStatus} disabled={refreshing || busy}>{refreshing ? 'Refreshing…' : 'Refresh status'}</button>
      </header>
      <div className="privacy-status">
        {deletion ? <>Deletion request · <strong>{String(deletion.status || 'submitted').replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())}</strong>{deletion.requested_at ? <> · submitted {new Date(deletion.requested_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}{deletion.resolved_at ? <> · resolved {new Date(deletion.resolved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}{deletion.id ? <><br/>Reference: <code>{deletion.id}</code></> : null}{deletion.resolution_note ? <><br/>Update: {deletion.resolution_note}</> : null}</> : 'No account deletion request is currently recorded.'}
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
