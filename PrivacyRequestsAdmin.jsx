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
      setError(err?.message || 'Unable to load deletion requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resendVerification = async request => {
    if (!request.user_id || !request.requester_email) {
      setError('This request has no linked email. Verify the requester manually before continuing.');
      return;
    }
    if (busyId) return;
    setBusyId(request.id);
    setError('');
    setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('get-admin-console-data', {
        body: { action: 'send-verification', user_id: request.user_id },
      });
      if (invokeError) throw invokeError;
      if (!data?.ok) throw new Error(data?.error || 'Verification email was not sent.');
      setMessage('Verification email sent. Ask the reader to confirm it, then refresh this queue.');
    } catch (err) {
      setError(err?.message || 'Could not send verification email.');
    } finally {
      setBusyId('');
    }
  };

  const update = async (request, status) => {
    if (busyId) return;
    if (status === 'processing' && !request.requester_email_confirmed_at) {
      setError('Verify the reader email before processing this request.');
      return;
    }
    let resolutionNote = '';
    let confirmedErasure = false;
    if (status === 'resolved') {
      resolutionNote = window.prompt('Record the erasure completed and any records retained by law:') || '';
      if (resolutionNote.trim().length < 10) {
        setError('Add an accurate resolution note of at least 10 characters.');
        return;
      }
      confirmedErasure = window.confirm('Confirm that erasure is complete and legally required records were reviewed. This does not delete an account for you.');
      if (!confirmedErasure) return;
    } else if (status === 'rejected') {
      resolutionNote = window.prompt('Why can this request not be completed?') || '';
      if (resolutionNote.trim().length < 10) {
        setError('Add a clear reason of at least 10 characters.');
        return;
      }
    } else if (!window.confirm('Start reviewing this verified deletion request?')) {
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
      if (!data?.request) throw new Error(data?.error || 'The request update was not confirmed.');
      setRequests(current => current.map(item => item.id === request.id ? { ...item, ...data.request, requester_email: item.requester_email, requester_email_confirmed_at: item.requester_email_confirmed_at } : item));
      setMessage(data.notice_email_sent
        ? 'Request updated. The reader was emailed.'
        : 'Request updated. ' + (data.notice_email_error || 'The reader notice was not sent.'));
    } catch (err) {
      setError(err?.message || 'Unable to update this request.');
    } finally {
      setBusyId('');
    }
  };

  const deleteAccount = async request => {
    if (busyId) return;
    if (!request.user_id || !request.requester_email_confirmed_at || !request.requester_email) {
      setError('A linked account and verified email are required before deleting.');
      return;
    }
    const typedEmail = window.prompt('To confirm permanent deletion, type the reader email exactly:\n' + request.requester_email);
    if (typedEmail === null || typedEmail.trim().toLowerCase() !== request.requester_email.trim().toLowerCase()) {
      setError('Email confirmation did not match. Nothing was deleted.');
      return;
    }
    if (!window.confirm('Permanently delete this reader account and its linked account data? This cannot be undone. Active billing or payment records may block deletion.')) return;
    const resolutionNote = window.prompt('Record the erasure and checks completed:') || '';
    if (resolutionNote.trim().length < 10) {
      setError('Add an accurate erasure note of at least 10 characters.');
      return;
    }
    setBusyId(request.id);
    setError('');
    setMessage('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('dpdp-data-rights', {
        body: {
          action: 'admin-delete-account',
          request_id: request.id,
          confirmation_email: typedEmail.trim(),
          resolution_note: resolutionNote.trim(),
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.deleted || !data?.request) throw new Error(data?.error || 'Account deletion was not confirmed.');
      setRequests(current => current.map(item => item.id === request.id ? { ...item, ...data.request, requester_email: null, requester_email_confirmed_at: null } : item));
      setMessage(data.notice_email_sent
        ? 'Account and linked data deleted. Confirmation email sent.'
        : 'Account and linked data deleted. The confirmation email was not sent; check Resend configuration.');
    } catch (err) {
      setError(err?.message || 'Account deletion failed. Check the request and billing status before retrying.');
    } finally {
      setBusyId('');
    }
  };

  return <section className="admin-card privacy-requests-admin">
    <header className="admin-card-title">
      <div><span>PRIVACY</span><h2>Deletion requests</h2><p>Verify the reader, review the request, then erase or record the outcome.</p></div>
      <button type="button" className="secondary-button" onClick={load} disabled={loading || Boolean(busyId)}>{loading ? 'Loading…' : 'Refresh'}</button>
    </header>
    {error && <p className="privacy-admin-alert error" role="alert">{error}</p>}
    {message && <p className="privacy-admin-alert success" role="status">{message}</p>}
    {loading ? <p className="muted">Loading requests…</p> : requests.length === 0 ? <div className="privacy-admin-empty"><h3>No deletion requests</h3><p>New requests will appear here.</p></div> : <div className="privacy-admin-list">
      {requests.map(request => {
        const verified = Boolean(request.requester_email_confirmed_at);
        const hasAccount = Boolean(request.user_id && request.requester_email);
        return <article className="privacy-admin-request" key={request.id}>
          <div className="privacy-admin-request-top">
            <div>
              <strong>{request.requester_email || 'Account no longer linked'}</strong>
              <small>Requested {formatDate(request.requested_at)}</small>
              <span className={'privacy-admin-identity ' + (verified ? 'is-verified' : 'is-unverified')}>{verified ? 'Email verified' : 'Email not verified'}</span>
            </div>
            <span className={'privacy-admin-status status-' + request.status}>{request.status}</span>
          </div>
          {request.reason && <p>{request.reason}</p>}
          {request.requester_last_sign_in_at && <small>Last sign-in {formatDate(request.requester_last_sign_in_at)}</small>}
          <p className="privacy-admin-request-id">Request {request.id}</p>
          {request.resolution_note && <p className="privacy-admin-resolution"><strong>Outcome:</strong> {request.resolution_note}</p>}
          {request.status === 'pending' && <div className="privacy-admin-actions">
            {!verified && hasAccount && <button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => resendVerification(request)}>{busyId === request.id ? 'Sending…' : 'Send verification'}</button>}
            <button type="button" className="primary-button" disabled={Boolean(busyId) || !verified || !hasAccount} onClick={() => update(request, 'processing')}>{busyId === request.id ? 'Updating…' : 'Start review'}</button>
          </div>}
          {request.status === 'processing' && <div className="privacy-admin-actions">
            <button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => update(request, 'rejected')}>Reject</button>
            {hasAccount && verified && <button type="button" className="privacy-admin-danger-button" disabled={Boolean(busyId)} onClick={() => deleteAccount(request)}>{busyId === request.id ? 'Deleting…' : 'Delete account'}</button>}
            <button type="button" className="secondary-button" disabled={Boolean(busyId)} onClick={() => update(request, 'resolved')}>Record manual erasure</button>
          </div>}
          {request.resolved_at && <small>Closed {formatDate(request.resolved_at)}</small>}
        </article>;
      })}
    </div>}
  </section>;
}
