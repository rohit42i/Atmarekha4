import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import './privacy-requests-admin.css';

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
      setError(err?.message || 'Unable to load privacy requests. Check admin access and the deployed privacy function.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (request, status) => {
    if (busyId) return;
    let resolutionNote = '';
    let confirmedErasure = false;
    if (status === 'resolved') {
      resolutionNote = window.prompt('Record what was erased and which records, if any, were retained for legal/accounting reasons. This must reflect work already completed:');
      if (resolutionNote === null) return;
      if (resolutionNote.trim().length < 10) {
        setError('Resolution note must contain at least 10 characters.');
        return;
      }
      confirmedErasure = window.confirm('Confirm you have completed the erasure work and checked any legally required retention? This only closes the request; it does not delete records for you.');
      if (!confirmedErasure) return;
    } else if (status === 'rejected') {
      resolutionNote = window.prompt('Explain why this request cannot be completed:') || '';
      if (resolutionNote.trim().length < 10) {
        setError('A clear reason of at least 10 characters is required.');
        return;
      }
    } else if (!window.confirm('Move this privacy deletion request to Processing?')) {
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
          resolution_note: resolutionNote.trim() || undefined,
          confirmed_erasure: confirmedErasure,
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.request) throw new Error('The privacy request service did not confirm the update.');
      setRequests(current => current.map(item => item.id === request.id ? { ...item, ...data.request, requester_email: item.requester_email } : item));
      setMessage('Privacy request status updated.');
    } catch (err) {
      setError(err?.message || 'Unable to update this privacy request.');
    } finally {
      setBusyId('');
    }
  };

  return <section className="admin-card privacy-requests-admin">
    <header className="admin-card-title">
      <div><span>PRIVACY & LEGAL</span><h2>Data deletion requests</h2><p>Review reader requests and record the outcome. Closing a request does not itself erase database records.</p></div>
      <button type="button" className="secondary-button" onClick={load} disabled={loading || Boolean(busyId)}>{loading ? 'Loading…' : 'Refresh'}</button>
    </header>
    {error && <p className="privacy-admin-alert error" role="alert">{error}</p>}
    {message && <p className="privacy-admin-alert success" role="status">{message}</p>}
    <div className="privacy-admin-legal-note">Before resolving a request, complete the necessary erasure in the approved data systems, retain only records required by applicable law, and write a truthful resolution note. Verify the requester before disclosing or changing personal data.</div>
    {loading ? <p className="muted">Loading privacy requests…</p> : requests.length === 0 ? <div className="privacy-admin-empty"><h3>No privacy deletion requests</h3><p>New reader requests will appear here after the privacy migration and Edge Function are deployed.</p></div> : <div className="privacy-admin-list">
      {requests.map(request => <article className="privacy-admin-request" key={request.id}>
        <div className="privacy-admin-request-top">
          <div><strong>{request.requester_email || 'Account no longer available'}</strong><small>Requested {formatDate(request.requested_at)}</small></div>
          <span className={'privacy-admin-status status-' + request.status}>{request.status}</span>
        </div>
        {request.reason && <p>{request.reason}</p>}
        <p className="privacy-admin-request-id">Request ID: {request.id}</p>
        {request.resolution_note && <p className="privacy-admin-resolution"><strong>Resolution:</strong> {request.resolution_note}</p>}
        {request.status === 'pending' && <button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => update(request, 'processing')}>{busyId === request.id ? 'Updating…' : 'Start processing'}</button>}
        {request.status === 'processing' && <div className="privacy-admin-actions">
          <button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => update(request, 'rejected')}>Reject with reason</button>
          <button type="button" className="primary-button" disabled={Boolean(busyId)} onClick={() => update(request, 'resolved')}>{busyId === request.id ? 'Updating…' : 'Mark erased & resolved'}</button>
        </div>}
        {request.resolved_at && <small>Closed {formatDate(request.resolved_at)}</small>}
      </article>)}
    </div>}
  </section>;
}
