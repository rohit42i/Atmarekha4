import { useEffect, useRef, useState } from 'react';

export function requestAdminConfirmation(request) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('atma-admin-confirm-request', { detail: request }));
}

export default function AdminConfirmDialog() {
  const [request, setRequest] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef(null);

  useEffect(() => {
    const open = event => {
      setError('');
      setRunning(false);
      setRequest(event.detail || null);
    };
    window.addEventListener('atma-admin-confirm-request', open);
    return () => window.removeEventListener('atma-admin-confirm-request', open);
  }, []);

  useEffect(() => {
    if (!request) return undefined;
    cancelRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape' && !running) {
        event.preventDefault();
        setRequest(null);
        setError('');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [request, running]);

  const confirm = async () => {
    if (!request?.onConfirm || running) return;
    setRunning(true);
    setError('');
    try {
      await request.onConfirm();
      setRequest(null);
    } catch (cause) {
      setError(cause?.message || 'The action could not be completed.');
    } finally {
      setRunning(false);
    }
  };

  if (!request) return null;
  return (
    <div
      className="ar-admin-confirm-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !running) setRequest(null);
      }}
    >
      <section
        className="ar-admin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ar-admin-confirm-title"
        aria-describedby="ar-admin-confirm-description"
        tabIndex={-1}
      >
        <h2 id="ar-admin-confirm-title">{request.title || 'Confirm action'}</h2>
        <p id="ar-admin-confirm-description">{request.message || 'This action may change saved data.'}</p>
        {error && <p className="ar-admin-confirm-error" role="alert">{error}</p>}
        <div className="ar-admin-confirm-actions">
          <button ref={cancelRef} type="button" onClick={() => { setRequest(null); setError(''); }} disabled={running}>Cancel</button>
          <button type="button" className={request.tone === 'danger' ? 'is-danger' : 'is-confirm'} onClick={confirm} disabled={running}>
            {running ? 'Working…' : request.confirmLabel || 'Confirm'}
          </button>
        </div>
      </section>
    </div>
  );
}
