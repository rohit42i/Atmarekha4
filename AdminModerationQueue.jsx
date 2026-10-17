import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import { notifyAdminToast } from './admin-feedback';
import { AdminButton, AdminCard, AdminEmptyState, AdminModal } from './admin-studio-ui.jsx';

const severityRank = { high: 3, medium: 2, low: 1 };
const normalizeStatus = report => String(report?.status || 'open').toLowerCase();
const classifySeverity = reason => {
  const value = String(reason || '').toLowerCase();
  if (/threat|violence|hate|sexual|self[- ]harm|dox|terror/.test(value)) return 'high';
  if (/harass|abuse|bully|scam|spam|imperson/.test(value)) return 'medium';
  return 'low';
};
const ageLabel = value => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Unknown age';
  const hours = Math.max(0, Math.floor((Date.now() - time) / 3600000));
  if (hours < 1) return 'Under 1h';
  if (hours < 24) return `${hours}h old`;
  return `${Math.floor(hours / 24)}d old`;
};
const localDate = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—';
};
const statusText = value => value === 'reviewed' ? 'Reviewed' : value ? value[0].toUpperCase() + value.slice(1) : 'Open';

export default function AdminModerationQueue({ reports = [], comments = [], onDeleteComment, onSetReportStatus, reportCount = 0 }) {
  const [status, setStatus] = useState('open');
  const [severity, setSeverity] = useState('all');
  const [sort, setSort] = useState('severity');
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [warningProfile, setWarningProfile] = useState(null);
  const [warningLoading, setWarningLoading] = useState(false);

  const commentById = useMemo(() => new Map(comments.map(comment => [String(comment.id), comment])), [comments]);
  const counts = useMemo(() => ({
    open: reports.filter(report => normalizeStatus(report) === 'open').length,
    resolved: reports.filter(report => ['resolved', 'reviewed'].includes(normalizeStatus(report))).length,
    dismissed: reports.filter(report => normalizeStatus(report) === 'dismissed').length,
  }), [reports]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = reports.filter(report => {
      const comment = commentById.get(String(report.comment_id));
      const reportStatus = normalizeStatus(report);
      const bucketMatch = status === 'resolved'
        ? ['resolved', 'reviewed'].includes(reportStatus)
        : status === reportStatus;
      const matchesSeverity = severity === 'all' || classifySeverity(report.reason) === severity;
      const haystack = `${report.reason || ''} ${comment?.author_display_name || comment?.author_name || ''} ${comment?.content || ''}`.toLowerCase();
      return bucketMatch && matchesSeverity && (!query || haystack.includes(query));
    });
    return [...result].sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
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
    const comment = commentById.get(String(selectedReport.comment_id));
    if (!comment?.user_id) {
      setWarningProfile(null);
      return undefined;
    }
    setWarningLoading(true);
    supabase.from('user_moderation')
      .select('user_id,offense_count,recent_offense_count,recent_window_start,flag_color,flagged_until,auto_reported_at,comment_banned_until,group_banned_until,updated_at')
      .eq('user_id', comment.user_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          notifyAdminToast('Could not load the reader moderation profile: ' + error.message, 'warning');
          setWarningProfile(null);
        } else setWarningProfile(data);
      })
      .catch(error => {
        if (alive) notifyAdminToast('Could not load the reader moderation profile: ' + (error?.message || 'unknown error'), 'warning');
      })
      .finally(() => { if (alive) setWarningLoading(false); });
    return () => { alive = false; };
  }, [selectedReport, commentById]);

  const openReport = selectedReport ? {
    ...selectedReport,
    comment: commentById.get(String(selectedReport.comment_id)),
    severity: classifySeverity(selectedReport.reason),
  } : null;

  const setReportStatus = async (report, nextStatus) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !(await getAdminRole(user.id))) throw new Error('Admin access required.');
      await onSetReportStatus?.(report.id, nextStatus);
    } catch (error) {
      notifyAdminToast(error?.message || 'Could not update report status.', 'error');
    }
  };

  return (
    <section className="admin-stack ar-admin-report-queue">
      <AdminCard eyebrow="MODERATION" title="Report queue" description={`${reportCount} open report${reportCount === 1 ? '' : 's'} · reader identity is not stored for anonymous reports.`} actions={<AdminButton type="button" icon="refresh" onClick={() => window.dispatchEvent(new CustomEvent('atma-admin-refresh'))}>Refresh</AdminButton>}>
        <div className="ar-admin-report-tabs" role="tablist" aria-label="Report status">
          {[['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={status === key} className={status === key ? 'active' : ''} onClick={() => setStatus(key)}>{label}<b>{counts[key]}</b></button>)}
        </div>
        <div className="admin-chapter-toolbar admin-moderation-toolbar">
          <div className="admin-filter-control"><label htmlFor="moderation-search">Search reports</label><input id="moderation-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Reason, reader, comment text…" /></div>
          <div className="admin-filter-control"><label htmlFor="moderation-severity">Severity</label><select id="moderation-severity" value={severity} onChange={event => setSeverity(event.target.value)}><option value="all">All severities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
          <div className="admin-filter-control"><label htmlFor="moderation-sort">Sort</label><select id="moderation-sort" value={sort} onChange={event => setSort(event.target.value)}><option value="severity">Severity first</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
        </div>
        {rows.length ? <div className="ar-admin-report-cards">
          {rows.map(report => {
            const comment = commentById.get(String(report.comment_id));
            const level = classifySeverity(report.reason);
            const reportStatus = normalizeStatus(report);
            const author = comment?.author_display_name || comment?.author_name || 'Reader';
            return <article key={report.id} className="ar-admin-report-card">
              <header className="ar-admin-report-card-head">
                <div><span className={`ar-admin-report-severity is-${level}`}>{level} severity</span><span className={`ar-admin-report-status is-${reportStatus}`}>{statusText(reportStatus)}</span></div>
                <time dateTime={report.created_at} title={localDate(report.created_at)}>{ageLabel(report.created_at)}</time>
              </header>
              <div className="ar-admin-report-comment"><small>COMMENT BY</small><strong>{author}</strong><p>{comment?.content || 'Comment unavailable or deleted'}</p></div>
              <div className="ar-admin-report-meta"><div><small>REASON</small><span>{report.reason || 'No reason supplied'}</span></div><div><small>REPORTED BY</small><span>Anonymous reader</span></div><div><small>REPORTED AT</small><span>{localDate(report.created_at)}</span></div></div>
              <footer className="ar-admin-report-actions">
                <AdminButton size="sm" type="button" onClick={() => setSelectedReport(report)}>Context</AdminButton>
                {reportStatus !== 'resolved' && <AdminButton size="sm" type="button" variant="primary" onClick={() => setReportStatus(report, 'resolved')}>Resolve</AdminButton>}
                {reportStatus !== 'dismissed' && <AdminButton size="sm" type="button" onClick={() => setReportStatus(report, 'dismissed')}>Dismiss</AdminButton>}
                {reportStatus !== 'open' && <AdminButton size="sm" type="button" onClick={() => setReportStatus(report, 'open')}>Reopen</AdminButton>}
                {comment && <AdminButton size="sm" variant="danger" type="button" onClick={() => onDeleteComment?.(comment.id)}>Delete comment</AdminButton>}
              </footer>
            </article>;
          })}
        </div> : <AdminEmptyState icon="pulse" title="No reports in this view" description={reports.length ? 'No reports match the selected status and filters.' : 'No reports are currently available.'} action={reports.length && (severity !== 'all' || search) ? <AdminButton size="sm" type="button" onClick={() => { setSeverity('all'); setSearch(''); }}>Clear filters</AdminButton> : null} />}
      </AdminCard>
      <AdminModal open={Boolean(openReport)} onClose={() => setSelectedReport(null)} title="Report context" description={openReport ? `${openReport.severity.toUpperCase()} severity · ${ageLabel(openReport.created_at)} · status ${statusText(normalizeStatus(openReport))}` : ''} footer={openReport ? <>
        <AdminButton type="button" onClick={() => setSelectedReport(null)}>Close</AdminButton>
        {normalizeStatus(openReport) !== 'resolved' && <AdminButton type="button" variant="primary" onClick={() => setReportStatus(openReport, 'resolved')}>Resolve report</AdminButton>}
        {normalizeStatus(openReport) !== 'dismissed' && <AdminButton type="button" onClick={() => setReportStatus(openReport, 'dismissed')}>Dismiss report</AdminButton>}
      </> : null}>
        {openReport ? <div className="admin-context-grid">
          <div className="admin-context-block"><span>Reason</span><strong>{openReport.reason || 'No reason supplied'}</strong></div>
          <div className="admin-context-block"><span>Reported by</span><p>Anonymous reader. The current database record does not store the reporter's account identity.</p></div>
          <div className="admin-context-block"><span>Reader comment</span><p>{openReport.comment?.content || 'Comment unavailable'}</p></div>
          <div className="admin-context-block"><span>Member warning profile</span>{warningLoading ? <p>Loading moderation profile…</p> : warningProfile ? <div className="admin-warning-grid"><div><strong>{warningProfile.offense_count || 0}</strong><span>Total offenses</span></div><div><strong>{warningProfile.recent_offense_count || 0}</strong><span>Recent window</span></div><div><strong>{warningProfile.flag_color || '—'}</strong><span>Flag</span></div></div> : <p>No moderation profile found for this reader.</p>}</div>
        </div> : null}
      </AdminModal>
    </section>
  );
}
