import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { fetchCloudflareAdminAnalytics } from './engagement';
import { AdminIcon, GlassCard, SectionHeader, StatCard } from './admin-redesign-ui.jsx';

const WINDOWS = { today: 1, week: 7, month: 30, quarter: 90 };
const WINDOW_LABELS = { today: '24 Hours', week: '7 Days', month: '30 Days', quarter: '90 Days' };
const formatNumber = value => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('en-IN');
const compactNumber = value => {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return formatNumber(n);
};
const pct = (current, previous) => current == null || previous == null
  ? null
  : Number(previous) > 0
    ? ((Number(current) - Number(previous)) / Number(previous)) * 100
    : Number(current) === 0 ? 0 : null;
const safeDate = value => { const d = new Date(value || 0); return Number.isFinite(d.getTime()) ? d : null; };
const chapterLabel = chapter => chapter.chapterNumber == null ? 'Unnumbered' : 'Chapter ' + chapter.chapterNumber;

const adminAction = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

function LibraryChart({ chapters, viewsAvailable = true, engagementAvailable = true }) {
  const rows = [...chapters].sort((a, b) => Number(a.chapterNumber || 0) - Number(b.chapterNumber || 0)).slice(-10);
  if (!viewsAvailable) return <div className="ar-empty-chart"><AdminIcon name="chart" size={28}/><strong>View analytics unavailable</strong><span>Cloudflare Analytics did not return trusted view counts. Check Control Room → Audit & Reliability.</span></div>;
  if (!rows.length) return <div className="ar-empty-chart"><AdminIcon name="chart" size={28}/><strong>Not enough chapter data yet</strong><span>Publish chapters to unlock the reach view.</span></div>;

  const maxViews = Math.max(...rows.map(row => Number(row.periodViews || 0)), 1);
  const maxEngagement = Math.max(...rows.map(row => Number(row.periodLikes || 0) + Number(row.periodShares || 0) + Number(row.periodRatingCount || 0)), 1);
  return <div className="ar-chart-wrap">
    <div className="ar-chart-legend">
      <span><i className="dot violet"/>Views</span>
      {engagementAvailable && <span><i className="dot pink"/>Engagement</span>}
      <small>Real chapter totals · last 10 published</small>
    </div>
    <div className="ar-chart-bars" role="img" aria-label="Chapter views and engagement">
      {rows.map(row => {
        const viewValue = Number(row.periodViews || 0);
        const engagementValue = engagementAvailable ? Number(row.periodLikes || 0) + Number(row.periodShares || 0) + Number(row.periodRatingCount || 0) : 0;
        const viewH = viewValue > 0 ? Math.max(2, viewValue / maxViews * 100) : 0;
        const engagementH = engagementValue > 0 ? Math.max(2, engagementValue / maxEngagement * 100) : 0;
        return <div className="ar-chart-column" key={row.id}>
          <div className="ar-chart-track"><i style={{ height: viewH + '%' }}/><b style={{ height: engagementH + '%' }}/></div>
          <span>{row.chapterNumber == null ? '—' : 'Ch ' + row.chapterNumber}</span>
        </div>;
      })}
    </div>
  </div>;
}

function RatingDonut({ counts, total }) {
  if (total == null) return <div className="ar-empty-chart"><AdminIcon name="chart" size={24}/><strong>Rating analytics unavailable</strong><span>The admin analytics source did not return a trusted rating count.</span></div>;
  const positive = counts.reduce((sum, row) => sum + (row.rating >= 8 ? row.count : 0), 0);
  const percentage = total ? Math.round(positive / total * 100) : 0;
  return <div className="ar-donut-wrap">
    <div className="ar-donut-ring" style={{ '--donut-pct': percentage }}><strong>{percentage}%</strong><span>8–10</span></div>
    <div><strong>{formatNumber(total)} ratings</strong><span>Positive ratings share</span></div>
  </div>;
}

function SkeletonGrid() {
  return <div className="ar-overview-kpis">{Array.from({ length: 10 }, (_, i) => <div className="ar-stat-card" key={i}><div className="ar-skeleton ar-stat-label-skel"/><div className="ar-skeleton ar-stat-number"/><div className="ar-skeleton ar-stat-foot"/></div>)}</div>;
}

export default function AdminOverview({ chapters = [], reports = [], pageCounts = {}, onTab }) {
  const [windowKey, setWindowKey] = useState('month');
  const [userStats, setUserStats] = useState({ logged_in_users: null, notification_subscriptions: null });
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsRefreshToken, setAnalyticsRefreshToken] = useState(0);
  const [last24, setLast24] = useState({ views: null, ratings: null, comments: null, loading: true });
  const [periodLoading, setPeriodLoading] = useState(false);
  const [chapterSort, setChapterSort] = useState('views');

  const days = WINDOWS[windowKey];

  useEffect(() => {
    let active = true;
    const loadUserStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-admin-user-stats');
        if (error) throw error;
        if (active && data) setUserStats({
          logged_in_users: Number(data.logged_in_users || 0),
          notification_subscriptions: Number(data.notification_subscriptions || 0),
        });
      } catch (error) { console.warn('Admin user stats lookup failed:', error); }
    };
    loadUserStats();
    const timer = setInterval(loadUserStats, 30000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') loadUserStats(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, []);

  useEffect(() => {
    let active = true;
    const loadLast24 = async () => {
      try {
        const [{ data, error }, cloudflare] = await Promise.all([
          supabase.functions.invoke('get-admin-console-data', { body: { action: 'analytics', days: 1 } }).then(result => ({ data: result.data?.data || null, error: result.error })),
          fetchCloudflareAdminAnalytics(1).catch(() => null),
        ]);
        if (error) throw error;
        if (active) setLast24({
          // Cloudflare R2 is the authoritative view source after the migration.
          // Never present legacy database counts as live views when the Worker is unavailable.
          views: cloudflare?.current_views != null && Number.isFinite(Number(cloudflare.current_views))
            ? Number(cloudflare.current_views)
            : null,
          ratings: data?.current_ratings != null && Number.isFinite(Number(data.current_ratings)) ? Number(data.current_ratings) : null,
          comments: data?.current_comments != null && Number.isFinite(Number(data.current_comments)) ? Number(data.current_comments) : null,
          loading: false,
        });
      } catch (error) {
        console.warn('Admin 24-hour activity lookup failed:', error);
        if (active) setLast24({ views: null, ratings: null, comments: null, loading: false, error: true });
      }
    };
    loadLast24();
    const timer = setInterval(loadLast24, 60000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') loadLast24(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, []);

  useEffect(() => {
    let active = true;
    setPeriodLoading(true);
    setAnalytics(null);
    setAnalyticsError('');
    const loadAnalytics = async () => {
      try {
        const [{ data, error }, cloudflare] = await Promise.all([
          supabase.functions.invoke('get-admin-console-data', { body: { action: 'analytics', days: Number(days) } }).then(result => ({ data: result.data?.data || null, error: result.error })),
          fetchCloudflareAdminAnalytics(Number(days)).catch(() => null),
        ]);
        if (error) throw error;
        if (active) {
          const base = data || {};
          const requiredNumericFields = [
            'total_likes', 'total_shares', 'total_comments', 'total_ratings', 'rating_sum',
            'current_likes', 'previous_likes', 'current_shares', 'previous_shares',
            'current_comments', 'previous_comments', 'current_ratings', 'bookmarks', 'released',
          ];
          const missingAnalyticsFields = requiredNumericFields.filter(key => base[key] == null || !Number.isFinite(Number(base[key])));
          const validRatingHistogram = Array.isArray(base.rating_counts) &&
            base.rating_counts.reduce((sum, row) => sum + Math.max(0, Number(row.count) || 0), 0) === Number(base.total_ratings);
          const adminAnalyticsUnavailable = missingAnalyticsFields.length > 0 || !validRatingHistogram || !Array.isArray(base.chapter_stats);
          const adminAnalyticsUnavailableReason = adminAnalyticsUnavailable
            ? 'Admin analytics response is incomplete' + (missingAnalyticsFields.length ? ': missing or invalid ' + missingAnalyticsFields.join(', ') : !validRatingHistogram ? ': rating histogram does not reconcile with the total rating count' : ': chapter statistics are missing')
            : null;
          const hasCloudflareViews = Boolean(cloudflare) &&
            ['total_views', 'current_views', 'previous_views'].every(key =>
              cloudflare[key] != null && Number.isFinite(Number(cloudflare[key]))
            );
          const hasViewCounts = hasCloudflareViews;
          const hasCloudflareReaders = hasCloudflareViews &&
            !cloudflare.reader_metrics_limited &&
            cloudflare.active_readers != null && Number.isFinite(Number(cloudflare.active_readers)) &&
            cloudflare.returning_readers != null && Number.isFinite(Number(cloudflare.returning_readers));
          const baseChapterStats = Array.isArray(base.chapter_stats) ? base.chapter_stats : [];
          const baseChapterStatsById = new Map(baseChapterStats.map(row => [String(row.id), row]));
          const cloudChapterStats = new Map((cloudflare?.chapter_stats || []).map(row => [String(row.id), row]));
          // Reconcile analytics rows with the actual chapter catalogue. A missing stats row
          // must not hide a chapter; only a successful Worker response makes a missing count zero.
          const chapterIds = new Set([
            ...baseChapterStats.map(row => String(row.id)),
            ...chapters.map(chapter => String(chapter.id)),
          ].filter(Boolean));
          const chapterStats = [...chapterIds].map(id => {
            const chapterMeta = chapters.find(chapter => String(chapter.id) === id) || {};
            const row = baseChapterStatsById.get(id) || {};
            const cloud = cloudChapterStats.get(id);
            return {
              ...chapterMeta,
              ...row,
              id,
              chapterNumber: row.chapterNumber ?? chapterMeta.chapterNumber ?? row.chapter_number ?? chapterMeta.chapter_number,
              title: row.title ?? chapterMeta.title ?? 'Untitled chapter',
              views: hasCloudflareViews ? Number(cloud?.views || 0) : null,
              period_views: hasCloudflareViews ? Number(cloud?.period_views || 0) : null,
              periodViews: hasCloudflareViews ? Number(cloud?.period_views || 0) : null,
              likes: Number(row.likes || 0),
              period_likes: Number(row.period_likes || 0),
              periodLikes: Number(row.period_likes || 0),
              shares: Number(row.shares || 0),
              period_shares: Number(row.period_shares || 0),
              rating_count: Number(row.rating_count || 0),
              rating_average: Number(row.rating_average || 0),
              pages: Number(row.pages ?? pageCounts[id] ?? 0),
            };
          });
          setAnalytics({
            ...base,
            total_views: hasCloudflareViews ? Number(cloudflare.total_views) : null,
            current_views: hasCloudflareViews ? Number(cloudflare.current_views) : null,
            previous_views: hasCloudflareViews ? Number(cloudflare.previous_views) : null,
            active_readers: hasCloudflareReaders ? Number(cloudflare.active_readers) : null,
            returning_readers: hasCloudflareReaders ? Number(cloudflare.returning_readers) : null,
            period_active_readers: hasCloudflareReaders ? Number(cloudflare.active_readers) : null,
            period_returning_readers: hasCloudflareReaders ? Number(cloudflare.returning_readers) : null,
            views_unavailable: !hasCloudflareViews,
            reader_metrics_unavailable: !hasCloudflareReaders,
            reader_metrics_unavailable_reason: cloudflare?.reader_metrics_limited_reason || (cloudflare?.reader_metrics_limited ? 'Historical view events lack stable viewer identities; reader counts are incomplete.' : null),
            admin_analytics_unavailable: adminAnalyticsUnavailable,
            admin_analytics_unavailable_reason: adminAnalyticsUnavailableReason,
            chapter_stats: chapterStats,
          });
        }
      } catch (error) {
        console.warn('Admin analytics lookup failed:', error);
        if (active) {
          setAnalytics(null);
          setAnalyticsError(error?.message || 'Unable to load analytics data.');
        }
      } finally {
        if (active) setPeriodLoading(false);
      }
    };
    loadAnalytics();
    return () => { active = false; };
  }, [days, analyticsRefreshToken]);

  const metrics = useMemo(() => {
    const data = analytics || {};
    const adminAnalyticsAvailable = analytics != null && !analyticsError && data.admin_analytics_unavailable !== true;
    const totalRatings = adminAnalyticsAvailable ? Number(data.total_ratings || 0) : null;
    const average = totalRatings != null && totalRatings > 0 ? Number(data.rating_sum || 0) / totalRatings : null;
    const chapterStats = (Array.isArray(data.chapter_stats) ? data.chapter_stats : []).map(chapter => ({
      ...chapter,
      views: chapter.views == null ? null : Number(chapter.views),
      periodViews: chapter.period_views == null ? null : Number(chapter.period_views),
      likes: adminAnalyticsAvailable ? Number(chapter.likes || 0) : null,
      periodLikes: adminAnalyticsAvailable ? Number(chapter.period_likes || 0) : null,
      shares: adminAnalyticsAvailable ? Number(chapter.shares || 0) : null,
      periodShares: adminAnalyticsAvailable ? Number(chapter.period_shares || 0) : null,
      ratingCount: adminAnalyticsAvailable ? Number(chapter.rating_count || 0) : null,
      periodRatingCount: adminAnalyticsAvailable ? Number(chapter.period_rating_count || 0) : null,
      ratingAverage: adminAnalyticsAvailable ? Number(chapter.rating_average || 0) : null,
      pages: Number(chapter.pages || pageCounts[chapter.id] || 0),
    }));
    const published = chapters.filter(chapter => String(chapter.status || '').toLowerCase() === 'published');
    const withPages = published.filter(chapter => Number(pageCounts[chapter.id] || 0) > 0);
    const upcoming = chapters.filter(chapter => {
      const date = safeDate(chapter.releaseDate);
      return date && date.getTime() > Date.now();
    }).sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate)).slice(0, 4);
    const top = chapterStats;
    return {
      totalViews: data.total_views == null ? null : Number(data.total_views),
      totalLikes: adminAnalyticsAvailable ? Number(data.total_likes || 0) : null,
      totalShares: adminAnalyticsAvailable ? Number(data.total_shares || 0) : null,
      totalComments: adminAnalyticsAvailable ? Number(data.total_comments || 0) : null,
      totalRatings,
      average,
      currentViews: data.current_views == null ? null : Number(data.current_views),
      previousViews: data.previous_views == null ? null : Number(data.previous_views),
      currentLikes: adminAnalyticsAvailable ? Number(data.current_likes || 0) : null,
      previousLikes: adminAnalyticsAvailable ? Number(data.previous_likes || 0) : null,
      currentShares: adminAnalyticsAvailable ? Number(data.current_shares || 0) : null,
      previousShares: adminAnalyticsAvailable ? Number(data.previous_shares || 0) : null,
      currentComments: adminAnalyticsAvailable ? Number(data.current_comments || 0) : null,
      previousComments: adminAnalyticsAvailable ? Number(data.previous_comments || 0) : null,
      currentRatings: adminAnalyticsAvailable ? Number(data.current_ratings || 0) : null,
      activeReaders: data.reader_metrics_unavailable ? null : (data.active_readers == null ? null : Number(data.active_readers)),
      returningReaders: data.reader_metrics_unavailable ? null : (data.returning_readers == null ? null : Number(data.returning_readers)),
      periodActiveReaders: data.reader_metrics_unavailable ? null : Number(data.period_active_readers ?? data.active_readers ?? 0),
      periodReturningReaders: data.reader_metrics_unavailable ? null : Number(data.period_returning_readers ?? data.returning_readers ?? 0),
      viewsUnavailable: data.views_unavailable === true,
      readerMetricsUnavailable: data.reader_metrics_unavailable === true,
      readerMetricsUnavailableReason: data.reader_metrics_unavailable_reason || null,
      bookmarks: adminAnalyticsAvailable ? Number(data.bookmarks || 0) : null,
      released: adminAnalyticsAvailable ? Number(data.released || 0) : null,
      adminAnalyticsUnavailable: !adminAnalyticsAvailable,
      adminAnalyticsUnavailableReason: data.admin_analytics_unavailable_reason || (analyticsError || null),
      chapterStats,
      publishedCount: published.length,
      withPagesCount: withPages.length,
      readiness: published.length ? Math.round(withPages.length / published.length * 100) : 0,
      upcoming,
      top,
      ratingCounts: Array.from({ length: 10 }, (_, index) => {
        const rating = 10 - index;
        const row = (Array.isArray(data.rating_counts) ? data.rating_counts : []).find(item => Number(item.rating) === rating);
        return { rating, count: adminAnalyticsAvailable ? Number(row?.count || 0) : null };
      }),
    };
  }, [analytics, analyticsError, chapters, pageCounts]);

  const reportCount = reports.filter(report => (report.status || 'open') === 'open').length;
  const deltaViews = pct(metrics.currentViews, metrics.previousViews);
  const maxTop = Math.max(...metrics.top.map(chapter => chapterSort === 'rating' ? chapter.ratingAverage : chapterSort === 'likes' ? chapter.periodLikes : chapter.periodViews), 1);

  return <section className="ar-overview">
    <div className="ar-overview-hero">
      <div>
        <span className="ar-kicker">ATMA REKHA</span>
        <h2>Overview</h2>
      </div>
      <div className="ar-period-switch" role="tablist" aria-label="Analytics period">
        {Object.entries(WINDOW_LABELS).map(([key, label]) => <button type="button" key={key} role="tab" aria-selected={windowKey === key} aria-pressed={windowKey === key} className={windowKey === key ? 'active' : ''} onClick={() => { if (key !== windowKey) setWindowKey(key); }}>{label}</button>)}
      </div>
    </div>

    {analytics === null && periodLoading ? <SkeletonGrid/> : analytics === null ? <div className="ar-note" role="alert"><strong>Analytics unavailable.</strong> {analyticsError || 'Check the analytics source and retry.'} <button type="button" onClick={() => setAnalyticsRefreshToken(value => value + 1)}>Retry</button></div> : <div className="ar-overview-kpis">
      <StatCard label="Published chapters" value={formatNumber(metrics.publishedCount)} note="Currently published" icon="book" accent="blue"/>
      <StatCard label={"Views · " + WINDOW_LABELS[windowKey]} value={compactNumber(metrics.currentViews)} delta={deltaViews} note={metrics.viewsUnavailable ? 'Views unavailable' : deltaViews == null ? 'No comparison data' : undefined} icon="chart" accent="blue"/>
      <StatCard label="Active readers" value={compactNumber(metrics.periodActiveReaders)} note={metrics.readerMetricsUnavailable ? 'Reader analytics unavailable' : 'Selected period'} icon="pulse" accent="green"/>
      <StatCard label="Registered users" value={compactNumber(userStats.logged_in_users)} note="Protected accounts" icon="user" accent="blue"/>
      <StatCard label="Average rating" value={metrics.average ? metrics.average.toFixed(2) + ' / 10' : '—'} note={formatNumber(metrics.totalRatings) + ' ratings'} icon="sparkle" accent="green"/>
      <StatCard label="Open reports" value={formatNumber(reportCount)} note={reportCount ? 'Needs review' : 'Queue clear'} icon="flag" accent="blue"/>
    </div>}
    {analytics !== null && metrics.adminAnalyticsUnavailable && <div className="ar-note" role="status">{metrics.adminAnalyticsUnavailableReason || 'Engagement analytics are unavailable.'}</div>}

    <div className="ar-overview-main-grid">
      <GlassCard className="ar-chart-card">
        <SectionHeader eyebrow="PERFORMANCE" title="Library performance" description={WINDOW_LABELS[windowKey]}/>
        <LibraryChart chapters={metrics.chapterStats} viewsAvailable={!metrics.viewsUnavailable} engagementAvailable={!metrics.adminAnalyticsUnavailable}/>
      </GlassCard>
      <GlassCard className="ar-activity-card">
        <SectionHeader eyebrow="LIVE" title="Last 24 hours"/>
        <div className="ar-live-grid">
          <div><span>Views</span><strong>{last24.loading ? '—' : formatNumber(last24.views)}</strong><small>{last24.views == null && !last24.loading ? 'Unavailable' : 'Chapter reads'}</small></div>
          <div><span>Ratings</span><strong>{last24.loading ? '—' : formatNumber(last24.ratings)}</strong><small>{last24.ratings == null && !last24.loading ? 'Unavailable' : 'Submitted'}</small></div>
          <div><span>Comments</span><strong>{last24.loading ? '—' : formatNumber(last24.comments)}</strong><small>{last24.comments == null && !last24.loading ? 'Unavailable' : 'Posted'}</small></div>
        </div>
      </GlassCard>
    </div>

    <div className="ar-overview-grid-2">
      <GlassCard>
        <SectionHeader eyebrow="CHAPTERS" title="Top performing chapters" action={<div className="ar-overview-chapter-actions"><label className="ar-overview-sort-label"><span className="sr-only">Sort chapters by</span><select value={chapterSort} onChange={event => setChapterSort(event.target.value)} aria-label="Sort top chapters"><option value="views">Views</option><option value="likes">Likes</option><option value="rating">Rating</option></select></label><button className="ar-text-action" type="button" onClick={() => onTab('Chapters')}>View all</button></div>}/>
        <div className="ar-top-list">
          {(chapterSort === 'views' && metrics.viewsUnavailable) || (chapterSort !== 'views' && metrics.adminAnalyticsUnavailable) ? <div className="ar-empty-inline">Chapter analytics are unavailable. Check Analytics.</div> : [...metrics.top].sort((a, b) => chapterSort === 'rating' ? Number(b.ratingAverage || 0) - Number(a.ratingAverage || 0) : chapterSort === 'likes' ? Number(b.periodLikes || 0) - Number(a.periodLikes || 0) : Number(b.periodViews || 0) - Number(a.periodViews || 0)).slice(0, 5).map((chapter, index) => <button type="button" key={chapter.id} onClick={() => { onTab('Chapters'); window.setTimeout(() => window.dispatchEvent(new CustomEvent('atma-admin-focus-chapter', { detail: { chapterId: chapter.id } })), 120); }}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <div className="ar-top-copy"><strong>{chapterLabel(chapter)}</strong><span>{chapter.title || 'Untitled'}</span><i><em style={{ width: Math.max(6, (chapterSort === 'rating' ? chapter.ratingAverage : chapterSort === 'likes' ? chapter.periodLikes : chapter.periodViews) / maxTop * 100) + '%' }}/></i></div>
            <strong className="ar-top-value">{chapterSort === 'rating' ? (chapter.ratingAverage ? chapter.ratingAverage.toFixed(1) + '/10' : '—') : formatNumber(chapterSort === 'likes' ? chapter.periodLikes : chapter.periodViews)}</strong>
            <AdminIcon name="chevron" size={16}/>
          </button>)}
          {!metrics.top.length && <div className="ar-empty-inline">No chapter analytics yet.</div>}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow="PUBLISHING" title="Publishing readiness"/>
        <div className="ar-health-card"><div><strong>{metrics.readiness}%</strong><span>chapters with pages</span></div><div className="ar-health-bar"><i style={{ width: metrics.readiness + '%' }}/></div></div>
        <div className="ar-health-stats"><div><span>Published</span><b>{formatNumber(metrics.publishedCount)}</b></div><div><span>With pages</span><b>{formatNumber(metrics.withPagesCount)}</b></div></div>
        {metrics.withPagesCount < metrics.publishedCount
          ? <button className="ar-text-action" type="button" onClick={() => adminAction('atma-admin-open-health')}>Review missing pages</button>
          : <p className="ar-note">All published chapters have page records.</p>}
      </GlassCard>
    </div>
  </section>;
}

