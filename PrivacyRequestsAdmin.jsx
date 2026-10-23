import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import './privacy-requests-admin.css';

async function serviceErrorMessage(error, fallback) {
  const context = error?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
    } catch {}
  }
  return error?.message || fallback;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PrivacyRequestsAdmin() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('dpdp-data-rights', {
        body: { action: 'admin-list-deletion-requests' },
      });
      if (invokeError) throw invokeError;
      if (!Array.isArray(data?.requests)) throw new Error('The privacy request service returned an invalid response.');
      setRequests(data.requests);
    } catch (err) {
      setError(await serviceErrorMessage(err, 'Unable to load privacy requests. Check admin access and the deployed privacy function.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (request, status) => {
    if (busyId) return;
    const resolutionNote = String(resolutionNotes[request.id] || '').trim();
    let confirmedErasure = false;

    if (status === 'resolved' || status === 'rejected') {
      if (resolutionNote.length < 10) {
        setError(status === 'resolved'
          ? 'Add at least 10 characters describing completed erasure and any records retained.'
          : 'Add a rejection reason of at least 10 characters.');
        return;
      }
      if (status === 'resolved') {
        confirmedErasure = window.confirm('Have you actually erased eligible data in the relevant systems and checked required legal/accounting retention? This action records completion; it does not delete data automatically.');
        if (!confirmedErasure) return;
      } else if (!window.confirm('Reject this request with the reason you entered?')) {
        return;
      }
    } else if (status === 'processing' && !window.confirm('Start review for this request? This changes the status only; it does not erase data.')) {
      return;
    }

    setBusyId(request.id);
    setError('');
    setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('dpdp-data-rights', {
        body: {
          action: 'admin-update-deletion-request',
          request_id: request.id,
          status,
          resolution_note: status === 'processing' ? undefined : resolutionNote,
          confirmed_erasure: confirmedErasure,
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.request) throw new Error('The privacy request service did not confirm the update.');
      setRequests(current => current.map(item => item.id === request.id ? { ...item, ...data.request, requester_email: item.requester_email } : item));
      if (status !== 'processing') setResolutionNotes(current => ({ ...current, [request.id]: '' }));
      setMessage('Privacy request status updated.');
    } catch (err) {
      setError(await serviceErrorMessage(err, 'Unable to update this privacy request.'));
    } finally {
      setBusyId('');
    }
  };

  const runDueErasures = async () => {
    if (busyId) return;
    if (!window.confirm('Run the scheduled erasure processor? It can permanently erase accounts whose verified deletion date and 14-day recovery window have both passed and whose subscription retention checks are satisfied.')) return;
    setBusyId('__scheduled_processor__');
    setError('');
    setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('process-scheduled-account-deletions', {
        body: { source: 'admin' },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      const processed = Number(data?.processed || 0);
      const finished = Array.isArray(data?.results)
        ? data.results.filter(item => item.status === 'resolved').length
        : 0;
      const deferred = Array.isArray(data?.results)
        ? data.results.filter(item => item.status === 'pending' || item.status === 'retry').length
        : 0;
      setMessage(`Scheduled processor checked ${processed} request(s): ${finished} completed and ${deferred} deferred or needing retry.`);
      await load();
    } catch (err) {
      setError(await serviceErrorMessage(err, 'Unable to run the scheduled deletion processor.'));
    } finally {
      setBusyId('');
    }
  };

  return <section className="admin-card privacy-requests-admin">
    <header className="admin-card-title">
      <div><span>PRIVACY & LEGAL</span><h2>Data deletion requests</h2><p>Verified requests are processed after their scheduled date, recovery window and subscription retention checks. Use the processor action to retry due requests.</p></div>
      <div className="privacy-admin-header-actions"><button type="button" className="secondary-button" onClick={load} disabled={loading || Boolean(busyId)}>{loading ? 'Loading…' : 'Refresh queue'}</button><button type="button" className="primary-button" onClick={runDueErasures} disabled={loading || Boolean(busyId)}>{busyId === '__scheduled_processor__' ? 'Processing…' : 'Run due erasures'}</button></div>
    </header>
    {error && <p className="privacy-admin-alert error" role="alert">{error}</p>}
    {message && <p className="privacy-admin-alert success" role="status">{message}</p>}
    <div className="privacy-admin-legal-note">The processor ignores requests until both the scheduled deletion time and recovery deadline have passed. It pauses if a recurring subscription cannot be safely cancelled or its period end is unknown. Necessary financial records are anonymized rather than deleted.</div>
    {loading ? <p className="muted">Loading privacy requests…</p> : requests.length === 0 ? <div className="privacy-admin-empty"><h3>No privacy deletion requests</h3><p>New reader requests appear here after readers submit them. If one is missing, refresh the queue and check the privacy service deployment.</p></div> : <div className="privacy-admin-list">
      {requests.map(request => <article className="privacy-admin-request" key={request.id}>
        <div className="privacy-admin-request-top">
          <div><strong>{request.requester_email || 'Account no longer available'}</strong><small>Requested {formatDate(request.requested_at)}</small></div>
          <span className={'privacy-admin-status status-' + request.status}>{request.status}</span>
        </div>
        {request.reason && <p>{request.reason}</p>}
        {request.requested_period && <p className="privacy-admin-request-schedule"><strong>Requested option:</strong> {request.requested_period.replaceAll('_', ' ')}{request.scheduled_delete_at ? <> · <strong>Scheduled deletion:</strong> {formatDate(request.scheduled_delete_at)}</> : null}{request.recovery_until ? <> · <strong>Recovery deadline:</strong> {formatDate(request.recovery_until)}</> : null}</p>}
        <p className="privacy-admin-request-id">Request ID: {request.id}</p>
        {request.resolution_note && <p className="privacy-admin-resolution"><strong>Resolution:</strong> {request.resolution_note}</p>}
        {request.status === 'pending' && <div className="privacy-admin-step"><strong>{request.scheduled_delete_at ? 'Scheduled erasure' : 'Manual review needed'}</strong><p>{request.scheduled_delete_at ? (new Date(request.scheduled_delete_at).getTime() > Date.now() ? 'The selected deletion date has not arrived.' : request.recovery_until && new Date(request.recovery_until).getTime() > Date.now() ? 'The 14-day recovery window is still open.' : 'Eligible for processing once billing and retention checks pass. Use “Run due erasures” above.') : 'This is a legacy request without an automated schedule. Verify it manually and document the outcome.'}</p>{!request.scheduled_delete_at && <button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => update(request, 'processing')}>{busyId === request.id ? 'Updating…' : 'Start review'}</button>}</div>}
        {request.status === 'processing' && <div className="privacy-admin-step">
          <strong>Step 2 · Record the outcome</strong>
          <p>Legacy requests require an administrator to verify the request and record the result. New verified requests use the scheduled deletion processor.</p>
          <label className="privacy-admin-resolution-field" htmlFor={`resolution-note-input-${request.id}`}><span>Resolution note or rejection reason</span><textarea id={`resolution-note-input-${request.id}`} value={resolutionNotes[request.id] || ''} onChange={event => setResolutionNotes(current => ({ ...current, [request.id]: event.target.value.slice(0, 1000) }))} rows={3} minLength={10} maxLength={1000} placeholder="Describe the completed erasure and any retained records, or explain why the request must be rejected."/><small>{(resolutionNotes[request.id] || '').trim().length}/1000 characters · at least 10 required</small></label>
          <div className="privacy-admin-actions">
            <button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => update(request, 'rejected')}>Reject with reason</button>
            <button type="button" className="primary-button" disabled={Boolean(busyId)} onClick={() => update(request, 'resolved')}>{busyId === request.id ? 'Updating…' : 'Mark erased & resolved'}</button>
          </div>
        </div>}
        {request.resolved_at && <small>Closed {formatDate(request.resolved_at)}</small>}
      </article>)}
    </div>}
  </section>;
}
