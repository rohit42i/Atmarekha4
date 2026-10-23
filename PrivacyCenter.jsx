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
  const [lifecycleRequests, setLifecycleRequests] = useState([]);
  const [securityMode, setSecurityMode] = useState('');
  const [securityPassword, setSecurityPassword] = useState('');
  const [securityOtp, setSecurityOtp] = useState('');
  const [securityRequest, setSecurityRequest] = useState(null);
  const [deleteWindowDays, setDeleteWindowDays] = useState('permanent');
  const [eraseWindowDays, setEraseWindowDays] = useState('permanent');

  const load = async currentUser => {
    setError('');
    setUser(currentUser);
    if (!currentUser) {
      setConsent(null);
      setDeletion(null);
      setLifecycleRequests([]);
      setSecurityMode('');
      setSecurityRequest(null);
      setLoading(false);
      return;
    }

    try {
      const [
        { data: consentRows, error: consentError },
        { data: deletionRows, error: deletionError },
        lifecycleResult,
      ] = await Promise.all([
        supabase.from('dpdp_consent_records').select('policy_version,purposes,consented_at,withdrawn_at,source').eq('user_id', currentUser.id).order('consented_at', { ascending: false }).limit(5),
        supabase.from('dpdp_deletion_requests').select('id,status,requested_at,resolved_at,resolution_note').eq('user_id', currentUser.id).order('requested_at', { ascending: false }).limit(1),
        supabase.functions.invoke('account-lifecycle', { body: { action: 'status' } }),
      ]);
      if (consentError) throw new Error('Unable to load consent records: ' + consentError.message);
      if (deletionError) throw new Error('Unable to load legacy privacy request status: ' + deletionError.message);
      setConsent(consentRows?.find(row => !row.withdrawn_at) || consentRows?.[0] || null);
      setDeletion(deletionRows?.[0] || null);
      if (!lifecycleResult.error && !lifecycleResult.data?.error) setLifecycleRequests(lifecycleResult.data?.requests || []);
      else setError(await privacyErrorMessage(lifecycleResult.error || new Error(lifecycleResult.data?.error), 'Unable to load account security status.'));
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
        lifecycleResult,
      ] = await Promise.all([
        supabase.from('dpdp_consent_records').select('policy_version,purposes,consented_at,withdrawn_at,source').eq('user_id', user.id).order('consented_at', { ascending: false }).limit(5),
        supabase.from('dpdp_deletion_requests').select('id,status,requested_at,resolved_at,resolution_note').eq('user_id', user.id).order('requested_at', { ascending: false }).limit(1),
        supabase.functions.invoke('account-lifecycle', { body: { action: 'status' } }),
      ]);
      if (consentError) throw new Error('Unable to refresh consent records: ' + consentError.message);
      if (deletionError) throw new Error('Unable to refresh legacy deletion status: ' + deletionError.message);
      if (lifecycleResult.error) throw lifecycleResult.error;
      if (lifecycleResult.data?.error) throw new Error(lifecycleResult.data.error);
      setConsent(consentRows?.find(row => !row.withdrawn_at) || consentRows?.[0] || null);
      setDeletion(deletionRows?.[0] || null);
      setLifecycleRequests(lifecycleResult.data?.requests || []);
      setMessage('Privacy and account security status is up to date.');
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

  const activeDeletion = lifecycleRequests.find(row =>
    row.request_type === 'account_deletion' &&
    ['otp_pending', 'recovery_period', 'reactivation_pending', 'processing', 'failed'].includes(row.status)
  ) || null;

  const lifecycleAction = async (action, body = {}) => {
    if (!user || busy) return null;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('account-lifecycle', { body: { action, ...body } });
      if (invokeError) throw new Error(await privacyErrorMessage(invokeError, 'Unable to complete the account security request.'));
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (err) {
      setError(err?.message || 'Unable to complete the account security request.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const beginDeletion = async event => {
    event?.preventDefault?.();
    if (!securityPassword) { setError('Enter your current password to continue.'); return; }
    if (activeDeletion && ['otp_pending','recovery_period','reactivation_pending','processing'].includes(activeDeletion.status)) {
      setError('An account deletion request is already active. Review its status below.');
      return;
    }
    if (!window.confirm('After you confirm the email code, your account enters a 14-day recovery period. Signing in alone will not cancel deletion. After the deadline, your account is permanently deleted.')) return;
    const days = deleteWindowDays === 'permanent' ? null : Number(deleteWindowDays);
    const data = await lifecycleAction('start-account-deletion', { password: securityPassword, data_window_days: days });
    if (!data?.request) return;
    setSecurityRequest(data.request);
    setSecurityMode('verify-account-deletion');
    setSecurityPassword('');
    setSecurityOtp('');
    setMessage('A verification code was sent to your current email address.');
  };

  const beginDataErasure = async event => {
    event?.preventDefault?.();
    if (!securityPassword) { setError('Enter your current password to continue.'); return; }
    if (!window.confirm('Erasing selected activity data cannot be undone. Your sign-in account, profile and billing records will remain.')) return;
    const days = eraseWindowDays === 'permanent' ? null : Number(eraseWindowDays);
    const data = await lifecycleAction('start-data-erasure', { password: securityPassword, data_window_days: days });
    if (!data?.request) return;
    setSecurityRequest(data.request);
    setSecurityMode('verify-data-erasure');
    setSecurityPassword('');
    setSecurityOtp('');
    setMessage('A verification code was sent to your current email address.');
  };

  const verifyLifecycleOtp = async event => {
    event?.preventDefault?.();
    if (!securityRequest?.id || !/^\\d{6}$/.test(securityOtp.trim())) {
      setError('Enter the six-digit code from your email.');
      return;
    }
    const data = await lifecycleAction('verify-otp', { request_id: securityRequest.id, otp: securityOtp.trim() });
    if (!data?.success) return;
    setMessage(data.message || 'Your request was confirmed.');
    setSecurityMode('');
    setSecurityRequest(null);
    setSecurityOtp('');
    setSecurityPassword('');
    await refreshStatus();
    if (data.request) setLifecycleRequests(previous => [data.request, ...previous.filter(row => row.id !== data.request.id)]);
  };

  const beginReactivation = async () => {
    if (!activeDeletion?.id) return;
    const data = await lifecycleAction('start-reactivation', { request_id: activeDeletion.id });
    if (!data?.request) return;
    setSecurityRequest(data.request);
    setSecurityMode('verify-reactivation');
    setSecurityOtp('');
    setMessage('A fresh reactivation code was sent to your email.');
  };

  const retryVerification = () => {
    setSecurityRequest(null);
    setSecurityOtp('');
    setSecurityPassword('');
    setSecurityMode(securityMode === 'verify-account-deletion' ? 'account_deletion' : securityMode === 'verify-data-erasure' ? 'data_erasure' : '');
    setMessage('');
    setError('The previous code may have expired. Request a new code to continue.');
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
          <strong>Export data</strong><span>Download your available account information</span>
        </button>
        <button type="button" className="privacy-control-button" onClick={openProfile}>
          <strong>Correct profile</strong><span>Review and update profile details</span>
        </button>
        <button type="button" className="privacy-control-button" onClick={withdrawConsent} disabled={busy || Boolean(consent?.withdrawn_at)}>
          <strong>{consent?.withdrawn_at ? 'Consent withdrawn' : consent ? 'Withdraw consent' : 'Request consent review'}</strong>
          <span>{consent ? (consent.withdrawn_at ? 'This consent record is already withdrawn' : 'Withdraw recorded consent where it is the basis for processing') : 'No active record found. Ask support to check your account.'}</span>
        </button>
        <button type="button" className="privacy-control-button privacy-control-destructive" onClick={() => { setError(''); setMessage(''); setSecurityMode('data_erasure'); setSecurityRequest(null); setSecurityPassword(''); setSecurityOtp(''); }} disabled={busy}>
          <strong>Erase activity data</strong><span>Remove selected activity while keeping your account</span>
        </button>
        <button type="button" className="privacy-control-button privacy-control-destructive" onClick={() => { setError(''); setMessage(''); setSecurityMode('account_deletion'); setSecurityRequest(null); setSecurityPassword(''); setSecurityOtp(''); }} disabled={busy || Boolean(activeDeletion && ['otp_pending','recovery_period','reactivation_pending','processing'].includes(activeDeletion.status))}>
          <strong>{activeDeletion ? 'Deletion status below' : 'Delete account'}</strong><span>{activeDeletion ? 'A deletion request is already active' : 'Verify with password and email code; 14-day recovery'}</span>
        </button>
      </div>
      <p className="privacy-small-note">Account deletion requires your current password and an email code. After the code is confirmed, you have 14 days to reactivate using a fresh code. Signing in alone does not cancel deletion. “Permanent” removes eligible user content; 7, 30 or 90-day choices remove recent activity and anonymize older public comments or group messages. Payment records needed for accounting or disputes are retained with account linkage removed where possible. If you cannot sign in, email {CONTACT_EMAIL} from the address you control.</p>
      {securityMode && <form className="privacy-security-form" onSubmit={securityMode.startsWith('verify-') ? verifyLifecycleOtp : securityMode === 'account_deletion' ? beginDeletion : beginDataErasure}>
        <div className="privacy-security-heading"><h3>{securityMode === 'account_deletion' ? 'Delete account' : securityMode === 'data_erasure' ? 'Erase activity data' : securityMode === 'verify-account-deletion' ? 'Confirm account deletion' : securityMode === 'verify-data-erasure' ? 'Confirm data erasure' : 'Reactivate account'}</h3>
          <button type="button" className="secondary-button" onClick={() => { setSecurityMode(''); setSecurityRequest(null); setSecurityPassword(''); setSecurityOtp(''); setError(''); }} aria-label="Close security form">Cancel</button></div>
        {['account_deletion','data_erasure'].includes(securityMode) ? <>
          <p>{securityMode === 'account_deletion' ? 'Your account stays active during the 14-day recovery period. The selected window controls which recent public activity is removed; older public contributions are anonymized. Permanent removes all eligible user content.' : 'This removes activity in the selected period. Your account, profile and payment history remain.'}</p>
          <label>Current password<input type="password" value={securityPassword} onChange={e=>setSecurityPassword(e.target.value)} autoComplete="current-password" required minLength={1}/></label>
          <label>{securityMode === 'account_deletion' ? 'Activity removal option' : 'Activity data to erase'}
            <select value={securityMode === 'account_deletion' ? deleteWindowDays : eraseWindowDays} onChange={e=>securityMode === 'account_deletion' ? setDeleteWindowDays(e.target.value) : setEraseWindowDays(e.target.value)}>
              <option value="7">Last 7 days. Older public comments and group messages will be anonymized.</option>
              <option value="30">Last 30 days. Older public comments and group messages will be anonymized.</option>
              <option value="90">Last 90 days. Older public comments and group messages will be anonymized.</option>
              <option value="permanent">Permanent. Remove all eligible user content.</option>
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Sending code…' : securityMode === 'account_deletion' ? 'Send deletion code' : 'Send erasure code'}</button>
        </> : <>
          <p>Enter the six-digit code sent to your email. It expires in 10 minutes. Five incorrect attempts invalidate the code.</p>
          <label>Email verification code<input type="text" value={securityOtp} onChange={e=>setSecurityOtp(e.target.value.replace(/\\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required/></label>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Verifying…' : securityMode === 'verify-reactivation' ? 'Reactivate account' : securityMode === 'verify-data-erasure' ? 'Erase selected data' : 'Confirm deletion'}</button>
          {securityMode !== 'verify-reactivation' && <button type="button" className="secondary-button" onClick={retryVerification} disabled={busy}>Request a new code</button>}
        </>}
      </form>}
      {consent && <div className="privacy-control-status">Consent record: <strong>{consent.withdrawn_at ? 'withdrawn' : 'recorded'}</strong>{consent.consented_at ? <> · {new Date(consent.consented_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}</div>}
      <div className="privacy-email-actions">
        <button type="button" className="secondary-button" onClick={() => requestByEmail('Atma Rekha Privacy Request')}>Email a privacy request</button>
      </div>
    </section>}

    {(message || error) && <div className={`privacy-status ${error ? 'privacy-status-error' : 'privacy-status-success'}`} role={error ? 'alert' : 'status'} aria-live="polite">{error || message}</div>}

    {user && <section className="privacy-policy-card">
      <header className="privacy-section-heading privacy-request-status-heading">
        <div><p className="section-eyebrow">REQUEST STATUS</p><h2>Your recent privacy request</h2></div>
        <button type="button" className="secondary-button" onClick={refreshStatus} disabled={refreshing || busy}>{refreshing ? 'Refreshing…' : 'Refresh status'}</button>
      </header>
      <div className="privacy-status">
        {activeDeletion ? <>
          Account deletion · <strong>{activeDeletion.status === 'recovery_period' ? 'Recovery period' : activeDeletion.status === 'reactivation_pending' ? 'Reactivation verification' : activeDeletion.status === 'otp_pending' ? 'Waiting for email confirmation' : activeDeletion.status === 'failed' ? 'Needs support review' : 'Processing'}</strong>
          {activeDeletion.recovery_until ? <> · recovery ends {new Date(activeDeletion.recovery_until).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</> : null}
          {activeDeletion.scheduled_delete_at ? <> · scheduled deletion {new Date(activeDeletion.scheduled_delete_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</> : null}
          {activeDeletion.status === 'recovery_period' && <div className="privacy-status-actions"><p>To keep your account, request a fresh code and confirm it before the recovery deadline. Signing in alone will not cancel the request.</p><button type="button" className="primary-button" onClick={beginReactivation} disabled={busy}>Send reactivation code</button></div>}
          {activeDeletion.status === 'reactivation_pending' && <p>Enter the fresh code in the verification form above to reactivate your account.</p>}
          {activeDeletion.status === 'failed' && <p>This request requires support review before the account can be removed. Contact {CONTACT_EMAIL}.</p>}
        </> : deletion ? <>Legacy privacy request · <strong>{String(deletion.status || 'submitted').replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())}</strong>{deletion.requested_at ? <> · submitted {new Date(deletion.requested_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</> : null}{deletion.resolution_note ? <><br/>Update: {deletion.resolution_note}</> : null}</> : 'No account deletion request is currently recorded.'}
        {lifecycleRequests.filter(row => row.request_type === 'data_erasure').slice(0,1).map(row => <p key={row.id}>Latest data erasure · <strong>{String(row.status).replaceAll('_',' ')}</strong>{row.completed_at ? <> · completed {new Date(row.completed_at).toLocaleDateString('en-IN')}</> : null}</p>)}
      </div>
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
