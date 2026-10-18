import { useMemo, useState } from 'react';

const localDate = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '—';
};

export default function AdminComments({
  comments = [],
  reports = [],
  chapters = [],
  pdpklChapters = [],
  busy = false,
  onDeleteComment,
  onReply,
  onReviewReports,
}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [reportedOnly, setReportedOnly] = useState(false);
  const [dateRange, setDateRange] = useState('all');

  const reportIds = useMemo(() => new Set(reports.map(report => String(report.comment_id))), [reports]);
  const getTarget = comment => {
    if (comment.announcement_id) return { label: 'Announcement', kind: 'announcement' };
    const atma = chapters.find(chapter => String(chapter.id) === String(comment.chapter_id));
    if (atma) return { label: `Atma Rekha · ${atma.chapterNumber ? 'Chapter ' + atma.chapterNumber : (atma.title || 'Special')}`, kind: 'atma' };
    const pdpkl = pdpklChapters.find(chapter => String(chapter.id) === String(comment.chapter_id));
    if (pdpkl) return { label: `PDPKL · ${pdpkl.chapterNumber ? 'Chapter ' + pdpkl.chapterNumber : (pdpkl.title || 'Special')}`, kind: 'pdpkl' };
    return { label: 'Unlinked or deleted target', kind: 'unknown' };
  };

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const now = Date.now();
    const cutoff = dateRange === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
      : dateRange === '7days' ? now - 7 * 86400000
      : dateRange === '30days' ? now - 30 * 86400000 : 0;
    return comments.filter(comment => {
      const target = getTarget(comment);
      const matchesScope = scope === 'all' || target.kind === scope;
      const matchesReported = !reportedOnly || reportIds.has(String(comment.id));
      const matchesDate = !cutoff || new Date(comment.created_at).getTime() >= cutoff;
      const haystack = [comment.author_display_name, comment.author_name, comment.content, target.label].join(' ').toLowerCase();
      return matchesScope && matchesReported && matchesDate && (!text || haystack.includes(text));
    });
  }, [comments, chapters, pdpklChapters, reports, reportIds, query, scope, reportedOnly, dateRange]);

  const openReportsFor = commentId => reports.filter(report => String(report.comment_id) === String(commentId) && (report.status || 'open') === 'open');

  return (
    <section className="admin-card ar-admin-comments">
      <div className="admin-card-title">
        <div><span>COMMUNITY</span><h2>Comments</h2><p>{filtered.length} shown · {comments.length} loaded · replies included</p></div>
      </div>
      <div className="ar-admin-comments-filters">
        <label><span>Search comments</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search author, text, or chapter…" /></label>
        <label><span>Content</span><select value={scope} onChange={event => setScope(event.target.value)}><option value="all">All content</option><option value="atma">Atma Rekha</option><option value="pdpkl">PDPKL</option><option value="announcement">Announcements</option></select></label>
        <label><span>Date</span><select value={dateRange} onChange={event => setDateRange(event.target.value)}><option value="all">Any date</option><option value="today">Today</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option></select></label>
        <label className="ar-admin-reported-filter"><input type="checkbox" checked={reportedOnly} onChange={event => setReportedOnly(event.target.checked)} /><span>Reported only</span></label>
      </div>
      {filtered.length ? <div className="admin-table-wrap ar-admin-comments-table-wrap">
        <table className="admin-studio-table ar-admin-comments-table">
          <thead><tr><th scope="col">Reader / comment</th><th scope="col">Target</th><th scope="col">Date</th><th scope="col">Replies / reports</th><th scope="col">Actions</th></tr></thead>
          <tbody>{filtered.map(comment => {
            const target = getTarget(comment);
            const replyCount = comments.filter(row => String(row.parent_comment_id || '') === String(comment.id)).length;
            const openReports = openReportsFor(comment.id);
            return <tr key={comment.id} data-admin-comment-id={comment.id}>
              <td data-label="Reader / comment"><div className="ar-admin-comment-author"><span>{String(comment.author_display_name || comment.author_name || 'Reader').slice(0, 1).toUpperCase()}</span><strong>{comment.author_display_name || comment.author_name || 'Reader'}</strong></div><p className="ar-admin-comment-content">{comment.content}</p>{comment.parent_comment_id && <span className="ar-admin-comment-reply-label">Reply</span>}</td>
              <td data-label="Target"><span className={`ar-admin-comment-target is-${target.kind}`}>{target.label}</span></td>
              <td data-label="Date"><time dateTime={comment.created_at}>{localDate(comment.created_at)}</time></td>
              <td data-label="Replies / reports"><span>{replyCount} repl{replyCount === 1 ? 'y' : 'ies'}</span>{reportIds.has(String(comment.id)) && <span className="ar-admin-comment-reported">Reported</span>}</td>
              <td data-label="Actions"><div className="ar-admin-comment-actions">
                <button type="button" onClick={() => onReply?.(comment)} disabled={busy} title={busy ? 'Wait for the current admin operation to finish.' : 'Write a reply in this thread'}>Reply to thread</button>
                {openReports.length > 0 && <button type="button" onClick={() => onReviewReports?.(comment.id)} disabled={busy} title={busy ? 'Wait for the current admin operation to finish.' : 'Resolve all open reports for this comment'}>Mark reviewed ({openReports.length})</button>}
                <button type="button" className="danger-text" onClick={() => onDeleteComment?.(comment.id)} disabled={busy} title={busy ? 'Wait for the current admin operation to finish.' : 'Delete this comment'}>Delete</button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <div className="admin-empty-state ar-admin-comments-empty"><span aria-hidden="true">◌</span><strong>{comments.length ? 'No comments match these filters.' : 'No comments yet.'}</strong><p>{comments.length ? 'Try clearing the search or adjusting the content/date filters.' : 'Reader discussions will appear here when comments are posted.'}</p>{(query || scope !== 'all' || reportedOnly || dateRange !== 'all') && <button type="button" onClick={() => { setQuery(''); setScope('all'); setReportedOnly(false); setDateRange('all'); }}>Clear filters</button>}</div>}
    </section>
  );
}
