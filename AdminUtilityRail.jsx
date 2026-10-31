import React, { useMemo } from 'react';
import { AdminIcon } from './admin-redesign-ui.jsx';

const asText = value => String(value ?? '').trim();
const isPublished = chapter => asText(chapter?.status ?? chapter?.chapterStatus).toLowerCase() === 'published' && !chapter?.deleted_at;

function relativeTime(value) {
  if (!value) return 'Date unavailable';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Date unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function safeExcerpt(value, limit = 88) {
  const clean = asText(value).replace(/\s+/g, ' ');
  if (!clean) return 'No preview available';
  return clean.length > limit ? clean.slice(0, limit - 1).trimEnd() + '…' : clean;
}

function ProgressRing({ label, value, percent, tone = 'primary', note }) {
  const ready = Number.isFinite(percent);
  const normalized = ready ? Math.max(0, Math.min(100, percent)) : 0;
  const circumference = 2 * Math.PI * 31;
  const offset = circumference * (1 - normalized / 100);
  return (
    <article className="ar-utility-ring-card">
      <div className={`ar-utility-ring ar-tone-${tone}`} role="img" aria-label={`${label}: ${ready ? Math.round(normalized) + '%' : 'not available'}`}>
        <svg className="ar-utility-ring-svg" viewBox="0 0 84 84" aria-hidden="true">
          <circle className="ar-utility-ring-track" cx="42" cy="42" r="31" />
          <circle className="ar-utility-ring-progress" cx="42" cy="42" r="31"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="ar-utility-ring-value">{ready ? Math.round(normalized) + '%' : '—'}</span>
      </div>
      <div className="ar-utility-ring-copy">
        <strong>{label}</strong>
        <span>{note}</span>
        {ready && <small>{Math.round(normalized)}% complete</small>}
      </div>
    </article>
  );
}

export default function AdminUtilityRail({
  chapters = [],
  comments = [],
  reports = [],
  pageCounts = {},
  pageCountsAvailable = false,
  commentsAvailable = false,
  reportsAvailable = false,
  announcementsAvailable = false,
  announcements = [],
  refreshedAt = null,
  onTab,
}) {
  const published = useMemo(() => chapters.filter(isPublished), [chapters]);
  const publishedWithPages = useMemo(
    () => published.filter(chapter => Number(pageCounts[chapter.id] || 0) > 0),
    [published, pageCounts],
  );
  const publishedWithCovers = useMemo(
    () => published.filter(chapter => Boolean(chapter.coverUrl || chapter.cover_url || chapter.cover || chapter.coverImage)),
    [published],
  );
  const reviewedReports = useMemo(
    () => reports.filter(row => !['', 'open', 'pending', 'new', 'reported'].includes(asText(row.status).toLowerCase())),
    [reports],
  );

  const activity = useMemo(() => {
    const items = [
      ...(commentsAvailable ? comments.slice(0, 20) : []).map(row => ({
        id: `comment-${row.id}`,
        type: 'comment',
        icon: 'message',
        title: asText(row.author_display_name || row.author_name) || 'Reader comment',
        description: safeExcerpt(row.content, 94),
        at: row.created_at,
        target: 'Comments',
      })),
      ...(announcementsAvailable ? announcements.slice(0, 10) : []).map(row => ({
        id: `announcement-${row.id}`,
        type: 'announcement',
        icon: 'bell',
        title: 'Announcement',
        description: safeExcerpt(row.title || row.content, 94),
        at: row.published_at || row.created_at,
        target: 'Announcements',
      })),
      ...(reportsAvailable ? reports.slice(0, 20) : []).map(row => ({
        id: `report-${row.id}`,
        type: 'report',
        icon: 'flag',
        title: 'Reader report',
        description: safeExcerpt(row.reason || row.status || 'Review requested', 94),
        at: row.created_at,
        target: 'Reports',
      })),
    ];
    return items
      .sort((a, b) => (new Date(b.at || 0).getTime() || 0) - (new Date(a.at || 0).getTime() || 0))
      .slice(0, 5);
  }, [comments, announcements, reports, commentsAvailable, announcementsAvailable, reportsAvailable]);

  const pageCount = Object.values(pageCounts).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
  const reportTotal = reports.length;
  const reportReviewPercent = reportsAvailable && reportTotal > 0 ? reviewedReports.length / reportTotal * 100 : null;
  const pageCoverage = pageCountsAvailable && published.length > 0 ? publishedWithPages.length / published.length * 100 : null;
  const coverCoverage = published.length > 0 ? publishedWithCovers.length / published.length * 100 : null;

  return (
    <aside className="ar-admin-utility-rail" aria-label="Dashboard overview and quick actions">
      <div className="ar-utility-header">
        <div>
          <span className="ar-utility-eyebrow">WORKSPACE PULSE</span>
          <h2>At a glance</h2>
          <p>Live content and community signals</p>
        </div>
      </div>

      <section className="ar-utility-section" aria-labelledby="ar-utility-health-title">
        <div className="ar-utility-section-heading">
          <h3 id="ar-utility-health-title">Content health</h3>
          <button type="button" className="ar-utility-text-action" onClick={() => onTab?.('Chapters')}>Manage</button>
        </div>
        <div className="ar-utility-rings">
          <ProgressRing label="Page coverage" value={publishedWithPages.length} percent={pageCoverage} tone="primary"
            note={pageCountsAvailable ? `${publishedWithPages.length} of ${published.length} published chapters have pages` : 'Page inventory unavailable'}/>
          <ProgressRing label="Cover coverage" value={publishedWithCovers.length} percent={coverCoverage} tone="success"
            note={`${publishedWithCovers.length} of ${published.length} published chapters have covers`}/>
          <ProgressRing label="Report review" value={reviewedReports.length} percent={reportReviewPercent} tone="warning"
            note={!reportsAvailable ? 'Report history unavailable' : reportTotal ? `${reviewedReports.length} of ${reportTotal} loaded reports reviewed` : 'No report history loaded'}/>
        </div>
      </section>

      <section className="ar-utility-section" aria-labelledby="ar-utility-activity-title">
        <div className="ar-utility-section-heading">
          <h3 id="ar-utility-activity-title">Recent updates</h3>
          <button type="button" className="ar-utility-text-action" onClick={() => onTab?.('Comments')}>View all</button>
        </div>
        {activity.length ? (
          <ol className="ar-utility-activity">
            {activity.map(item => (
              <li key={item.id}>
                <button type="button" className="ar-utility-activity-item" onClick={() => onTab?.(item.target)}>
                  <span className={`ar-utility-activity-icon is-${item.type}`}><AdminIcon name={item.icon} size={14}/></span>
                  <span className="ar-utility-activity-copy">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                    <small>{relativeTime(item.at)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="ar-utility-empty"><AdminIcon name="pulse" size={18}/><span>No recent updates in the loaded records.</span></div>
        )}
      </section>

      <footer className="ar-utility-footer">
        <span className="ar-utility-live"><i/>{refreshedAt ? 'Data refreshed' : 'Waiting for first refresh'}</span>
        <small>{refreshedAt ? new Date(refreshedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Refresh to check sources'}</small>
      </footer>
    </aside>
  );
}
