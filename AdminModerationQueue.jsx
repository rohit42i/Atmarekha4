import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import { AdminButton, AdminCard, AdminEmptyState, AdminModal, AdminTable } from './admin-studio-ui.jsx';

const severityRank = { high: 3, medium: 2, low: 1 };

function classifySeverity(reason) {
  const value = String(reason || '').toLowerCase();
  if (/threat|violence|hate|sexual|self[- ]harm|dox|terror/.test(value)) return 'high';
  if (/harass|abuse|bully|scam|spam|imperson/.test(value)) return 'medium';
  return 'low';
}

function ageLabel(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Unknown age';
  const hours = Math.max(0, Math.floor((Date.now() - time) / 3600000));
  if (hours < 1) return 'Under 1h';
  if (hours < 24) return `${hours}h old`;
  const days = Math.floor(hours / 24);
  return `${days}d old`;
}

export default function AdminModerationQueue({
  reports = [],
  comments = [],
  onDeleteComment,
  onSetReportStatus,
  reportCount = 0,
}) {
  const [status, setStatus] = useState('open');
  const [severity, setSeverity] = useState('all');
  const [sort, setSort] = useState('severity');
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [warningProfile, setWarningProfile] = useState(null);
  const [warningLoading, setWarningLoading] = useState(false);

  const commentById = useMemo(() => new Map(comments.map(comment => [comment.id, comment])), [comments]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = reports.filter(report => {
      const comment = commentById.get(report.comment_id);
      const reportStatus = String(report.status || 'open').toLowerCase();
      const reportSeverity = classifySeverity(report.reason);
      const haystack = `${report.reason || ''} ${comment?.author_name || ''} ${comment?.content || ''}`.toLowerCase();
      return (status === 'all' || reportStatus === status)
        && (severity === 'all' || reportSeverity === severity)
        && (!query || haystack.includes(query));
    });
    return [...result].sort((a, b) => {
      if (sort === 'age') return new Date(a.created_at) - new Date(b.created_at);
      if (sort === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      return severityRank[classifySeverity(b.reason)] - severityRank[classifySeverity(a.reason)]
        || new Date(a.created_at) - new Date(b.created_at);
    });
  }, [reports, commentById, status, severity, sort, search]);

  useEffect(() => {
    let alive = true;
    if (!selectedReport) {
      setWarningProfile(null);
      return undefined;
    }
    const comment = commentById.get(selectedReport.comment_id);
    if (!comment?.user_id) {
      setWarningProfile(null);
      return undefined;
    }
    setWarningLoading(true);
    supabase
      .from('user_moderation')
      .select('user_id,offense_count,recent_offense_count,recent_window_start,flag_color,flagged_until,auto_reported_at,comment_banned_until,group_banned_until,updated_at')
      .eq('user_id', comment.user_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        setWarningProfile(error ? null : data);
      })
      .finally(() => { if (alive) setWarningLoading(false); });
    return () => { alive = false; };
  }, [selectedReport, commentById]);

  const openReport = selectedReport ? {
    ...selectedReport,
    comment: commentById.get(selectedReport.comment_id),
    severity: classifySeverity(selectedReport.reason),
  } : null;

  const setReportStatus = async (report, nextStatus) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !(await getAdminRole(user.id))) throw new Error('Admin access required.');
      await onSetReportStatus?.(report.id, nextStatus);
    } catch (error) {
      // Preserve the parent panel's existing error/notice handling.
      throw error;
    }
  };

  return (
    <section className="admin-stack">
      <AdminCard
        eyebrow="MODERATION"
        title="Report queue"
        description={`${reportCount} open report${reportCount === 1 ? '' : 's'} · severity and age are derived from existing report reason/date data.`}
        actions={<AdminButton type="button" icon="refresh" onClick={() => window.dispatchEvent(new CustomEvent('atma-admin-refresh'))}>Refresh</AdminButton>}
      >
        <div className="admin-chapter-toolbar admin-moderation-toolbar">
          <div className="admin-filter-control">
            <label htmlFor="moderation-search">Search queue</label>
            <input id="moderation-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Reason, reader, comment text…" />
          </div>
          <div className="admin-filter-control">
            <label htmlFor="moderation-status">Status</label>
            <select id="moderation-status" value={status} onChange={event => setStatus(event.target.value)}>
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
              <option value="all">All reports</option>
            </select>
          </div>
          <div className="admin-filter-control">
            <label htmlFor="moderation-severity">Severity</label>
            <select id="moderation-severity" value={severity} onChange={event => setSeverity(event.target.value)}>
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="admin-filter-control">
            <label htmlFor="moderation-sort">Sort</label>
            <select id="moderation-sort" value={sort} onChange={event => setSort(event.target.value)}>
              <option value="severity">Severity first</option>
              <option value="newest">Newest first</option>
              <option value="age">Oldest first</option>
            </select>
          </div>
        </div>

        <AdminTable>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Reader / context</th>
              <th>Reason</th>
              <th>Age</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(report => {
              const comment = commentById.get(report.comment_id);
              const level = classifySeverity(report.reason);
              const reportStatus = report.status || 'open';
              return (
                <tr key={report.id}>
                  <td><span className={`admin-status-badge ${level === 'high' ? 'admin-health-missing' : level === 'medium' ? 'admin-status-scheduled' : 'admin-health-neutral'}`}>{level}</span></td>
                  <td className="admin-chapter-cell">
                    <strong>{comment?.author_name || 'Reader'}</strong>
                    <span>{comment?.content || 'Comment unavailable'}</span>
                  </td>
                  <td className="admin-table-muted">{report.reason || 'No reason supplied'}</td>
                  <td className="admin-table-muted">{ageLabel(report.created_at)}</td>
                  <td><span className="admin-status-badge">{reportStatus}</span></td>
                  <td>
                    <div className="admin-row-actions">
                      <AdminButton size="sm" className="admin-table-action" type="button" onClick={() => setSelectedReport(report)}>Context</AdminButton>
                      {reportStatus === 'open' ? <AdminButton size="sm" className="admin-table-action" type="button" onClick={() => setReportStatus(report, 'reviewed')}>Review</AdminButton> : null}
                      {reportStatus !== 'resolved' ? <AdminButton size="sm" className="admin-table-action" type="button" onClick={() => setReportStatus(report, 'resolved')}>Resolve</AdminButton> : null}
                      {reportStatus !== 'open' ? <AdminButton size="sm" className="admin-table-action" type="button" onClick={() => setReportStatus(report, 'open')}>Reopen</AdminButton> : null}
                      {comment ? <AdminButton size="sm" className="admin-table-action" variant="danger" type="button" onClick={() => onDeleteComment?.(comment.id)}>Delete comment</AdminButton> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AdminTable>

        {!rows.length ? (
          <AdminEmptyState
            icon="pulse"
            title="No reports match this view"
            description={reports.length ? 'The queue may be filtered or already cleared. Change the status/severity filters to widen the view.' : 'No reports are currently available.'}
            action={reports.length ? <AdminButton size="sm" type="button" onClick={() => { setStatus('all'); setSeverity('all'); setSearch(''); }}>Clear filters</AdminButton> : null}
          />
        ) : null}
      </AdminCard>

      <AdminModal
        open={Boolean(openReport)}
        onClose={() => setSelectedReport(null)}
        title="Report context"
        description={openReport ? `${openReport.severity.toUpperCase()} severity · ${ageLabel(openReport.created_at)} · status ${openReport.status || 'open'}` : ''}
        footer={
          openReport ? (
            <>
              <AdminButton type="button" onClick={() => setSelectedReport(null)}>Close</AdminButton>
              {openReport.status === 'open' ? <AdminButton type="button" onClick={() => setReportStatus(openReport, 'reviewed')}>Mark reviewed</AdminButton> : null}
              {openReport.status !== 'resolved' ? <AdminButton type="button" variant="primary" onClick={() => setReportStatus(openReport, 'resolved')}>Resolve report</AdminButton> : null}
            </>
          ) : null
        }
      >
        {openReport ? (
          <div className="admin-context-grid">
            <div className="admin-context-block">
              <span>Reason</span>
              <strong>{openReport.reason || 'No reason supplied'}</strong>
            </div>
            <div className="admin-context-block">
              <span>Reader comment</span>
              <p>{openReport.comment?.content || 'Comment unavailable'}</p>
            </div>
            <div className="admin-context-block">
              <span>Member warning profile</span>
              {warningLoading ? <p>Loading moderation profile…</p> : warningProfile ? (
                <div className="admin-warning-grid">
                  <div><strong>{warningProfile.offense_count || 0}</strong><span>Total offenses</span></div>
                  <div><strong>{warningProfile.recent_offense_count || 0}</strong><span>Recent window</span></div>
                  <div><strong>{warningProfile.flag_color || '—'}</strong><span>Flag</span></div>
                </div>
              ) : <p>No moderation profile found for this reader.</p>}
            </div>
          </div>
        ) : null}
      </AdminModal>
    </section>
  );
}
