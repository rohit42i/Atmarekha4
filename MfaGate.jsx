import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const getVerifiedTotpFactors = async () => {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp || []).filter(factor => factor?.status === 'verified');
};

export async function verifyMfaCode(factorId, code) {
  const cleanCode = String(code || '').replace(/\D/g, '').slice(0, 10);
  if (cleanCode.length < 6) throw new Error('Enter the 6-digit code from your authenticator app.');
  const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeError ? '' : data.id,
    code: cleanCode,
  });
  if (error) throw error;
  await supabase.auth.refreshSession();
}

export default function MfaGate() {
  const [locked, setLocked] = useState(false);
  const [factors, setFactors] = useState([]);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const clearGate = useCallback(() => {
    setLocked(false);
    setFactors([]);
    setFactorId('');
    setCode('');
    setError('');
  }, []);

  const check = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user) {
      clearGate();
      setLoading(false);
      return;
    }

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      setLoading(false);
      return;
    }

    const needsMfa = aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2';
    if (!needsMfa) {
      clearGate();
      setLoading(false);
      return;
    }

    try {
      const available = await getVerifiedTotpFactors();
      setFactors(available);
      setFactorId(current => available.some(item => item.id === current) ? current : available[0]?.id || '');
      setLocked(true);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (factorError) {
      setError(factorError?.message || 'Unable to load your authenticator. Please sign in again.');
      setLocked(true);
      setLoading(false);
    }
  }, [clearGate]);

  useEffect(() => {
    check();
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        clearGate();
        return;
      }
      setTimeout(check, 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [check, clearGate]);

  useEffect(() => {
    if (!locked) return;
    const handleKeyDown = event => {
      if (event.key === 'Escape') event.preventDefault();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.documentElement.setAttribute('data-mfa-locked', 'true');
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.documentElement.removeAttribute('data-mfa-locked');
      document.body.style.overflow = '';
    };
  }, [locked]);

  const submit = async event => {
    event.preventDefault();
    if (verifying || !factorId) return;
    setVerifying(true);
    setError('');
    try {
      await verifyMfaCode(factorId, code);
      setCode('');
      await check();
    } catch (verifyError) {
      setError(verifyError?.message || 'That verification code was not accepted. Try again.');
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  if (!locked || loading) return null;

  const selectedFactor = factors.find(factor => factor.id === factorId);
  const multipleFactors = factors.length > 1;

  return <div className="mfa-gate-root" role="presentation">
    <div className="mfa-gate-backdrop" />
    <section className="mfa-gate" role="dialog" aria-modal="true" aria-labelledby="mfa-gate-title">
      <p className="section-eyebrow">ATMA REKHA SECURITY</p>
      <div className="mfa-gate-icon" aria-hidden="true">2</div>
      <h1 id="mfa-gate-title">Two-step verification</h1>
      <p className="mfa-gate-copy">Enter the code from your authenticator app to continue to your account.</p>

      {multipleFactors && <label className="mfa-gate-label">
        Authenticator
        <select value={factorId} onChange={event => { setFactorId(event.target.value); setError(''); }}>
          {factors.map(factor => <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Authenticator app'}</option>)}
        </select>
      </label>}

      {!factors.length && <p className="mfa-gate-error" role="alert">{error || 'No verified authenticator was found for this account.'}</p>}

      {factors.length > 0 && <form onSubmit={submit}>
        <label className="mfa-gate-label">
          Verification code
          <input
            ref={inputRef}
            value={code}
            onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="123456"
            aria-label="Authenticator verification code"
            required
          />
        </label>
        {error && <p className="mfa-gate-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button" disabled={verifying || code.length < 6}>
          {verifying ? 'Verifying…' : 'Verify and continue'}
        </button>
      </form>}

      {selectedFactor && <p className="mfa-gate-footnote">Using {selectedFactor.friendly_name || 'your authenticator app'}.</p>}
    </section>
  </div>;
}
