import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { verifyMfaCode } from './MfaGate.jsx';

const routeNow = () => window.location.hash.replace(/^#/, '') || 'home';

export default function SecuritySettings() {
  const [route, setRoute] = useState(routeNow);
  const [user, setUser] = useState(null);
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [removeFactor, setRemoveFactor] = useState(null);
  const [removeCode, setRemoveCode] = useState('');
  const [aal2, setAal2] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async currentUser => {
    setError('');
    if (!currentUser) {
      setUser(null);
      setFactors([]);
      setAal2(false);
      setLoading(false);
      return;
    }

    setUser(currentUser);
    setLoading(true);
    try {
      const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;

      setFactors((factorData?.totp || []).filter(factor => factor?.status === 'verified'));
      setAal2(aal?.currentLevel === 'aal2');
    } catch {
      console.warn('Security settings could not be loaded.');
      setFactors([]);
      setAal2(false);
      setError('Could not load security settings. Refresh the page and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(routeNow());
    window.addEventListener('hashchange', onHash);
    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        return load(data?.session?.user || null);
      })
      .catch(() => {
        setError('Could not confirm your sign-in session. Refresh the page and try again.');
        setLoading(false);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user || null);
    });
    return () => {
      window.removeEventListener('hashchange', onHash);
      listener.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    await load(data?.session?.user || null);
  };

  const startEnrollment = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    setEnrollment(null);
    try {
      const { data: factorData, error: factorError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator app',
      });
      if (factorError) throw factorError;
      setEnrollment(factorData);
      setMessage('Scan this QR code with your authenticator app, then enter the current 6-digit code below.');
    } catch {
      console.warn('Authenticator enrollment could not start.');
      setError('Could not start authenticator setup. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrollment = async event => {
    event.preventDefault();
    if (!enrollment?.id || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const cleanCode = enrollCode.replace(/\D/g, '').slice(0, 6);
      if (cleanCode.length < 6) throw new Error('Enter the 6-digit code from your authenticator app.');
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollment.id });
      if (challenge.error) throw challenge.error;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.id,
        challengeId: challenge.data.id,
        code: cleanCode,
      });
      if (verifyError) throw verifyError;
      await supabase.auth.refreshSession();
      setEnrollment(null);
      setEnrollCode('');
      setMessage('Two-step verification is now enabled on your account.');
      await refresh();
    } catch {
      setError('The code was not accepted, or verification is temporarily unavailable. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const openRemove = async factor => {
    setRemoveFactor(factor);
    setRemoveCode('');
    setError('');
    setAal2(false);
    try {
      const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      setAal2(data?.currentLevel === 'aal2');
    } catch {
      console.warn('Could not confirm the current MFA assurance level.');
      setError('For safety, enter a fresh authenticator code to continue.');
    }
  };

  const confirmRemove = async event => {
    event.preventDefault();
    if (!removeFactor || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal?.currentLevel !== 'aal2') {
        await verifyMfaCode(removeFactor.id, removeCode);
      }
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: removeFactor.id });
      if (unenrollError) throw unenrollError;
      await supabase.auth.refreshSession();
      setRemoveFactor(null);
      setRemoveCode('');
      setMessage('Authenticator removed from your account.');
      await refresh();
    } catch {
      setError('Could not remove the authenticator. Verify your code and try again.');
      try {
        const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        setAal2(!aalError && data?.currentLevel === 'aal2');
      } catch {
        setAal2(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelEnrollment = async () => {
    if (!enrollment?.id || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: enrollment.id });
      if (cleanupError) throw cleanupError;
      setEnrollment(null);
      setEnrollCode('');
      setMessage('Authenticator setup cancelled.');
      await refresh();
    } catch {
      setError('Could not cancel the unfinished authenticator setup. Please retry before leaving this screen.');
    } finally {
      setBusy(false);
    }
  };

  if (route !== 'security') return null;
  if (!user) {
    return <main className="security-page">
      <div className="security-shell">
        <button type="button" className="security-back" onClick={() => { window.location.hash = 'profile'; }}>← Back to profile</button>
        <section className="security-card">
          <p className="section-eyebrow">SECURITY</p>
          <h1>{loading ? 'Checking sign-in status' : 'Sign in to manage security'}</h1>
          <p className="security-intro">{loading ? 'Confirming your account session…' : 'Sign in to review and manage two-step verification for your Atma Rekha account.'}</p>
          {!loading && <button type="button" className="primary-button security-action" onClick={() => window.dispatchEvent(new CustomEvent('atma-open-auth', { detail: { mode: 'login' } }))}>Sign in</button>}
          {error && <p className="security-error" role="alert">{error}</p>}
        </section>
      </div>
    </main>;
  }

  return <main className="security-page">
    <div className="security-shell">
      <button type="button" className="security-back" onClick={() => { window.location.hash = 'profile'; }}>← Back to profile</button>
      <section className="security-card">
        <p className="section-eyebrow">SECURITY</p>
        <h1>Account security</h1>
        <p className="security-intro">Protect your Atma Rekha account with an authenticator app. Your password remains your first step; the 6-digit app code is the second.</p>

        <div className="security-setting">
          <div className="security-setting-head">
            <div>
              <h2>Two-step verification</h2>
              <p>{factors.length ? 'Enabled' : 'Not enabled'}</p>
            </div>
            <span className={'security-status ' + (factors.length ? 'is-enabled' : '')}>{factors.length ? 'ON' : 'OFF'}</span>
          </div>

          {!factors.length && !enrollment && <button type="button" className="primary-button security-action" onClick={startEnrollment} disabled={busy}>
            {busy ? 'Setting up…' : 'Set up authenticator app'}
          </button>}

          {enrollment && <div className="security-enrollment">
            <div className="security-step"><strong>1</strong><div><h3>Scan the QR code</h3><p>Open Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app and add this account.</p></div></div>
            {enrollment.totp?.qr_code && <img className="security-qr" src={enrollment.totp.qr_code} alt="QR code for authenticator app setup" />}
            <div className="security-secret"><span>Can’t scan?</span><code>{enrollment.totp?.secret || 'Secret unavailable'}</code></div>
            <form className="security-verify-form" onSubmit={confirmEnrollment}>
              <label>2. Enter the current 6-digit code<input value={enrollCode} onChange={event => setEnrollCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" required/></label>
              <button type="submit" className="primary-button" disabled={busy || enrollCode.length < 6}>{busy ? 'Verifying…' : 'Enable two-step verification'}</button>
              <button type="button" className="security-secondary-button" onClick={cancelEnrollment} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel setup'}</button>
            </form>
            <p className="security-warning">Keep your authenticator backup safe. Supabase does not provide recovery codes for MFA.</p>
          </div>}

          {factors.length > 0 && <div className="security-factor-list">
            {factors.map(factor => <div className="security-factor" key={factor.id}>
              <div><strong>{factor.friendly_name || 'Authenticator app'}</strong><span>Authenticator app · Verified</span></div>
              <button type="button" className="security-remove-button" onClick={() => openRemove(factor)}>Remove</button>
            </div>)}
            <button type="button" className="security-secondary-button security-add-backup" onClick={startEnrollment} disabled={busy}>Add another authenticator</button>
            <p className="security-note">{aal2 ? 'Your current session has completed two-step verification.' : 'For account safety, removing a verified authenticator requires a valid authenticator code.'}</p>
          </div>}
        </div>

        {removeFactor && <div className="security-modal-backdrop" role="presentation"><section className="security-modal" role="dialog" aria-modal="true" aria-labelledby="security-remove-title">
          <button type="button" className="security-modal-close" onClick={() => setRemoveFactor(null)} aria-label="Close">×</button>
          <p className="section-eyebrow">REMOVE AUTHENTICATOR</p><h2 id="security-remove-title">Remove this authenticator?</h2>
          <p>Your verified authenticator will no longer be available for two-step verification.</p>
          {!aal2 && <label>Authenticator code<input autoFocus value={removeCode} onChange={event => setRemoveCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" required/></label>}
          {error && <p className="security-error" role="alert">{error}</p>}
          <div className="security-modal-actions"><button type="button" className="security-secondary-button" onClick={() => setRemoveFactor(null)}>Cancel</button><button type="button" className="security-danger-button" onClick={confirmRemove} disabled={busy || !aal2 && removeCode.length < 6}>{busy ? 'Removing…' : 'Remove authenticator'}</button></div>
        </section></div>}

        {loading && <p className="security-note">Loading security settings…</p>}
        {error && !removeFactor && <p className="security-error" role="alert">{error}</p>}
        {message && <p className="security-success" role="status">{message}</p>}
      </section>
    </div>
  </main>;
}
