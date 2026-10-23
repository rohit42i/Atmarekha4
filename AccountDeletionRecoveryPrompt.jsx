import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';

function safeMessage(error, fallback) {
  return error?.message || fallback;
}

/**
 * If a reader signs in during the 14-day recovery window, require a fresh email
 * OTP before cancellation. Failing to load this optional prompt must never block
 * authentication or normal reading.
 */
export default function AccountDeletionRecoveryPrompt() {
  const [request, setRequest] = useState(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState('choice');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const checkedUserId = useRef('');
  const requestSequence = useRef(0);

  const inspectPendingRequest = useCallback(async user => {
    if (!user?.id || checkedUserId.current === user.id) return;
    checkedUserId.current = user.id;
    const sequence = ++requestSequence.current;
    try {
      const { data, error: queryError } = await supabase
        .from('dpdp_deletion_requests')
        .select('id,status,requested_period,scheduled_delete_at,recovery_until')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (queryError || sequence !== requestSequence.current) return;
      if (!data?.recovery_until || new Date(data.recovery_until).getTime() <= Date.now()) return;
      setRequest(data);
      setStep('choice');
      setOtp('');
      setNotice('');
      setError('');
      setVisible(true);
    } catch {
      // Recovery prompt is non-blocking; Privacy Center remains available.
    }
  }, []);

  useEffect(() => {
    let active = true;
    const inspectSafely = user => {
      if (!active || !user) return;
      window.setTimeout(() => { if (active) void inspectPendingRequest(user); }, 0);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (active) inspectSafely(data?.session?.user || null);
    }).catch(() => {});
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        inspectSafely(session?.user || null);
      } else if (event === 'SIGNED_OUT') {
        requestSequence.current += 1;
        checkedUserId.current = '';
        setRequest(null);
        setVisible(false);
        setOtp('');
        setNotice('');
        setError('');
      }
    });
    return () => {
      active = false;
      requestSequence.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [inspectPendingRequest]);

  const sendRecoveryCode = async () => {
    if (!request || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('account-deletion-workflow', {
        body: { action: 'send-reactivate-otp' },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setStep('otp');
      setNotice(data?.message || 'A recovery code was sent to your account email.');
    } catch (err) {
      setError(safeMessage(err, 'Could not send the recovery code. Open Privacy Center and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmRecovery = async event => {
    event?.preventDefault();
    if (!request || busy || !/^\d{6}$/.test(otp)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('account-deletion-workflow', {
        body: { action: 'confirm-reactivate-otp', otp },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setRequest({ ...request, ...(data?.request || {}), status: 'cancelled' });
      setStep('done');
      setOtp('');
      setNotice(data?.message || 'Your deletion request has been cancelled. Your account remains active.');
    } catch (err) {
      setError(safeMessage(err, 'The recovery code could not be confirmed. Request a new code and try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !request || typeof document === 'undefined') return null;

  return createPortal(
    <div className="ar-deletion-recovery-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) setVisible(false);
    }}>
      <section className="ar-deletion-recovery-card" role="dialog" aria-modal="true" aria-labelledby="ar-deletion-recovery-title">
        <p className="ar-deletion-recovery-eyebrow">ACCOUNT RECOVERY</p>
        <h2 id="ar-deletion-recovery-title">{step === 'done' ? 'Account recovered' : 'Your account is scheduled for deletion'}</h2>
        {step !== 'done' && <p>You signed in while a deletion request was still recoverable. Your account has not been erased. Confirm with a new code sent to your account email to cancel the request.</p>}
        {step === 'choice' && <>
          <p className="ar-deletion-recovery-detail">Recovery closes on {new Date(request.recovery_until).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.</p>
          <button type="button" className="ar-deletion-recovery-primary" disabled={busy} onClick={sendRecoveryCode}>{busy ? 'Sending…' : 'Send recovery code'}</button>
          <button type="button" className="ar-deletion-recovery-secondary" disabled={busy} onClick={() => setVisible(false)}>Not now</button>
        </>}
        {step === 'otp' && <form onSubmit={confirmRecovery}>
          <label htmlFor="ar-deletion-recovery-otp">6-digit email code</label>
          <input id="ar-deletion-recovery-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} required disabled={busy}/>
          <button type="submit" className="ar-deletion-recovery-primary" disabled={busy || otp.length !== 6}>{busy ? 'Confirming…' : 'Confirm and cancel deletion'}</button>
          <button type="button" className="ar-deletion-recovery-secondary" disabled={busy} onClick={() => { setStep('choice'); setOtp(''); setError(''); }}>Back</button>
        </form>}
        {step === 'done' && <button type="button" className="ar-deletion-recovery-primary" onClick={() => setVisible(false)}>Continue</button>}
        {(notice || error) && <p className={error ? 'ar-deletion-recovery-error' : 'ar-deletion-recovery-notice'} role={error ? 'alert' : 'status'}>{error || notice}</p>}
      </section>
      <style>{`
        .ar-deletion-recovery-backdrop{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:18px;background:rgb(0 0 0 / .72);overflow:auto}
        .ar-deletion-recovery-card{box-sizing:border-box;width:min(100%,480px);max-height:calc(100dvh - 36px);overflow:auto;padding:24px;border:1px solid var(--border-color,#333);border-radius:14px;background:var(--card-bg,#fff);color:var(--text-color,#111);box-shadow:0 16px 50px rgb(0 0 0 / .25)}
        .ar-deletion-recovery-card h2{margin:0 0 10px;font-size:22px;line-height:1.25}
        .ar-deletion-recovery-card p{line-height:1.55}
        .ar-deletion-recovery-eyebrow{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.08em}
        .ar-deletion-recovery-detail{font-size:13px;opacity:.8}
        .ar-deletion-recovery-card form{display:grid;gap:12px}
        .ar-deletion-recovery-card label{font-weight:600}
        .ar-deletion-recovery-card input{box-sizing:border-box;width:100%;min-height:46px;padding:10px 12px;border:1px solid var(--border-color,#bbb);border-radius:8px;background:var(--input-bg,#fff);color:inherit;font-size:18px;letter-spacing:.2em}
        .ar-deletion-recovery-primary,.ar-deletion-recovery-secondary{display:block;width:100%;min-height:44px;margin-top:10px;padding:11px 14px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}
        .ar-deletion-recovery-primary{background:var(--text-color,#111);color:var(--card-bg,#fff);border-color:var(--text-color,#111)}
        .ar-deletion-recovery-card button:disabled{opacity:.55;cursor:not-allowed}
        .ar-deletion-recovery-error{padding:10px;border:1px solid #bd3030;color:#b51f1f;overflow-wrap:anywhere}
        .ar-deletion-recovery-notice{padding:10px;border:1px solid var(--border-color,#777);overflow-wrap:anywhere}
        @media(prefers-color-scheme:dark){.ar-deletion-recovery-card{background:#050505;color:#fff;border-color:#333}.ar-deletion-recovery-card input{background:#050505;color:#fff;border-color:#444}.ar-deletion-recovery-primary{background:#fff;color:#000;border-color:#fff}.ar-deletion-recovery-error{color:#ffb7b7}}
      `}</style>
    </div>,
    document.body,
  );
}
