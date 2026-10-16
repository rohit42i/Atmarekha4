import { useEffect, useMemo, useState } from 'react';
import { supabase, getPublicReaderTiers } from './supabase';
import { fetchCloudflareAdminAnalytics } from './engagement';
import SubscriberBadge from './SubscriberBadge.jsx';
import { AdminIcon, GlassCard, SectionHeader, StatCard } from './admin-redesign-ui.jsx';

const WINDOWS = { today: 1, week: 7, month: 30, quarter: 90 };
const WINDOW_LABELS = { today: 'Today', week: '7 Days', month: '30 Days', quarter: '90 Days' };
const formatNumber = value => Number(value || 0).toLocaleString('en-IN');
const compactNumber = value => {
  const n = Number(value || 0);
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return formatNumber(n);
};
const pct = (current, previous) => !previous ? (current ? 100 : 0) : ((current - previous) / previous) * 100;
const safeDate = value => { const d = new Date(value || 0); return Number.isFinite(d.getTime()) ? d : null; };
const chapterLabel = chapter => chapter.chapterNumber == null ? 'Unnumbered' : 'Chapter ' + chapter.chapterNumber;

const csvCell = value => '"' + String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
const adminAction = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

function LibraryChart({ chapters }) {
  const rows = [...chapters].sort((a, b) => Number(a.chapterNumber || 0) - Number(b.chapterNumber || 0)).slice(-10);
  if (!rows.length) return <div className="ar-empty-chart"><AdminIcon name="chart" size={28}/><strong>Not enough chapter data yet</strong><span>Publish chapters to unlock the reach view.</span></div>;

  const maxViews = Math.max(...rows.map(row => row.periodViews), 1);
  const maxEngagement = Math.max(...rows.map(row => row.periodLikes + row.periodShares + row.periodRatingCount), 1);
  return <div className="ar-chart-wrap">
    <div className="ar-chart-legend">
      <span><i className="dot violet"/>Views</span>
      <span><i className="dot pink"/>Engagement</span>
      <small>Real chapter totals · last 10 published</small>
    </div>
    <div className="ar-chart-bars" role="img" aria-label="Chapter views and engagement">
      {rows.map(row => {
        const viewH = Math.max(8, row.periodViews / maxViews * 100);
        const engagementH = Math.max(5, (row.periodLikes + row.periodShares + row.periodRatingCount) / maxEngagement * 100);
        return <div className="ar-chart-column" key={row.id}>
          <div className="ar-chart-track"><i style={{ height: viewH + '%' }}/><b style={{ height: engagementH + '%' }}/></div>
          <span>{row.chapterNumber == null ? '—' : 'Ch ' + row.chapterNumber}</span>
        </div>;
      })}
    </div>
  </div>;
}

function RatingDonut({ counts, total }) {
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

export default function AdminOverview({ chapters = [], comments = [], reports = [], pageCounts = {}, onTab, chapterName }) {
  const [windowKey, setWindowKey] = useState('month');
  const [membershipPlans, setMembershipPlans] = useState(new Map());
  const [userStats, setUserStats] = useState({ logged_in_users: 0, notification_subscriptions: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [last24, setLast24] = useState({ views: 0, ratings: 0, comments: 0, loading: true });
  const [periodLoading, setPeriodLoading] = useState(false);
  const [chapterSort, setChapterSort] = useState('views');
  const [adminActivity, setAdminActivity] = useState([]);
  const [dashboardSearch, setDashboardSearch] = useState('');

  const days = WINDOWS[windowKey];

  useEffect(() => {
    let active = true;
    const ids = [...new Set(comments.map(comment => comment.user_id).filter(Boolean))];
    if (!ids.length) { setMembershipPlans(new Map()); return () => { active = false; }; }
    getPublicReaderTiers(ids).then(map => { if (active) setMembershipPlans(map); }).catch(error => {
      console.warn('Admin membership badge lookup failed:', error);
      if (active) setMembershipPlans(new Map());
    });
    return () => { active = false; };
  }, [comments]);

  // Read the existing audit log for the dashboard feed; this is display-only and does not alter admin actions.
  useEffect(() => {
    let active = true;
    const loadAdminActivity = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_activity_log')
          .select('id,action,entity_type,entity_id,details,created_at')
          .order('created_at', { ascending: false })
          .limit(6);
        if (error) throw error;
        if (active) setAdminActivity(Array.isArray(data) ? data : []);
      } catch (error) {
        console.warn('Admin activity feed lookup failed:', error);
        if (active) setAdminActivity([]);
      }
    };
    loadAdminActivity();
    return () => { active = false; };
  }, []);

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
          views: Number(cloudflare?.current_views ?? data?.current_views ?? 0),
          ratings: Number(data?.current_ratings || 0),
          comments: Number(data?.current_comments || 0),
          loading: false,
        });
      } catch (error) {
        console.warn('Admin 24-hour activity lookup failed:', error);
        if (active) setLast24(value => ({ ...value, loading: false }));
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
    const loadAnalytics = async () => {
      try {
        const [{ data, error }, cloudflare] = await Promise.all([
          supabase.functions.invoke('get-admin-console-data', { body: { action: 'analytics', days: Number(days) } }).then(result => ({ data: result.data?.data || null, error: result.error })),
          fetchCloudflareAdminAnalytics(Number(days)).catch(() => null),
        ]);
        if (error) throw error;
        if (active) {
          const base = data || {};
          const cloudChapterStats = new Map((cloudflare?.chapter_stats || []).map(row => [String(row.id), row]));
          const chapterStats = (base.chapter_stats || []).map(row => {
            const cloud = cloudChapterStats.get(String(row.id));
            return cloud ? {
              ...row,
              views: Number(cloud.views || 0),
              period_views: Number(cloud.period_views || 0),
              periodViews: Number(cloud.period_views || 0),
            } : row;
          });
          setAnalytics({
            ...base,
            total_views: cloudflare?.total_views ?? base.total_views,
            current_views: cloudflare?.current_views ?? base.current_views,
            previous_views: cloudflare?.previous_views ?? base.previous_views,
            active_readers: cloudflare?.active_readers ?? base.active_readers,
            returning_readers: cloudflare?.returning_readers ?? base.returning_readers,
            chapter_stats: chapterStats,
          });
        }
      } catch (error) {
        console.warn('Admin analytics lookup failed:', error);
        if (active) setAnalytics(null);
      } finally {
        if (active) setPeriodLoading(false);
      }
    };
    loadAnalytics();
    return () => { active = false; };
  }, [days]);

  const metrics = useMemo(() => {
    const data = analytics || {};
    const totalRatings = Number(data.total_ratings || 0);
    const average = totalRatings ? Number(data.rating_sum || 0) / totalRatings : 0;
    const chapterStats = (data.chapter_stats || []).map(chapter => ({
      ...chapter,
      views: Number(chapter.views || 0),
      periodViews: Number(chapter.period_views || 0),
      likes: Number(chapter.likes || 0),
      periodLikes: Number(chapter.period_likes || 0),
      shares: Number(chapter.shares || 0),
      periodShares: Number(chapter.period_shares || 0),
      ratingCount: Number(chapter.rating_count || 0),
      periodRatingCount: Number(chapter.period_rating_count || 0),
      ratingAverage: Number(chapter.rating_average || 0),
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
      totalViews: Number(data.total_views || 0),
      totalLikes: Number(data.total_likes || 0),
      totalShares: Number(data.total_shares || 0),
      totalComments: Number(data.total_comments || 0),
      totalRatings,
      average,
      currentViews: Number(data.current_views || 0),
      previousViews: Number(data.previous_views || 0),
      currentLikes: Number(data.current_likes || 0),
      previousLikes: Number(data.previous_likes || 0),
      currentShares: Number(data.current_shares || 0),
      previousShares: Number(data.previous_shares || 0),
      currentComments: Number(data.current_comments || 0),
      previousComments: Number(data.previous_comments || 0),
      currentRatings: Number(data.current_ratings || 0),
      activeReaders: Number(data.active_readers || 0),
      returningReaders: Number(data.returning_readers || 0),
      periodActiveReaders: Number(data.period_active_readers || data.active_readers || 0),
      periodReturningReaders: Number(data.period_returning_readers || data.returning_readers || 0),
      bookmarks: Number(data.bookmarks || 0),
      released: Number(data.released || 0),
      chapterStats,
      publishedCount: published.length,
      withPagesCount: withPages.length,
      readiness: published.length ? Math.round(withPages.length / published.length * 100) : 0,
      upcoming,
      top,
      recentComments: [...comments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
      ratingCounts: Array.from({ length: 10 }, (_, index) => {
        const rating = 10 - index;
        const row = (data.rating_counts || []).find(item => Number(item.rating) === rating);
        return { rating, count: Number(row?.count || 0) };
      }),
    };
  }, [analytics, chapters, comments, pageCounts]);

  const periodLabel = WINDOW_LABELS[windowKey];
  const reportCount = reports.filter(report => (report.status || 'open') === 'open').length;
  const deltaViews = pct(metrics.currentViews, metrics.previousViews);
  const deltaLikes = pct(metrics.currentLikes, metrics.previousLikes);
  const deltaComments = pct(metrics.currentComments, metrics.previousComments);
  const deltaShares = pct(metrics.currentShares, metrics.previousShares);
  const periodUnit = windowKey === 'today' ? 'today' : windowKey === 'week' ? '7d' : windowKey === 'month' ? '30d' : '90d';
  const maxTop = Math.max(...metrics.top.map(chapter => chapterSort === 'rating' ? chapter.ratingAverage : chapterSort === 'likes' ? chapter.periodLikes : chapter.periodViews), 1);

  const insights = useMemo(() => {
    const values = [];
    if (metrics.previousViews > 0 && metrics.currentViews > metrics.previousViews) values.push('Reach is trending upward versus the previous period.');
    if (metrics.previousLikes > 0 && metrics.currentLikes > metrics.previousLikes) values.push('Likes are rising alongside chapter reach.');
    if (metrics.readiness < 100 && metrics.publishedCount) values.push((metrics.publishedCount - metrics.withPagesCount) + ' published chapter(s) need page review.');
    if (reportCount) values.push(reportCount + ' moderation report(s) are waiting for review.');
    if (!values.length) values.push('Keep publishing consistently to build a stronger reader trend.');
    return values.slice(0, 3);
  }, [metrics, reportCount]);

  const lifecycle = [
    ['Registered', Number(userStats.logged_in_users || 0)],
    ['Active · ' + periodUnit, metrics.periodActiveReaders],
    ['Returning · ' + periodUnit, metrics.periodReturningReaders],
  ];
  const lifecycleMax = Math.max(lifecycle[0][1], 1);
  const releaseQueueCount = chapters.filter(chapter => {
    const date = safeDate(chapter.releaseDate);
    return date && date.getTime() > Date.now();
  }).length;
  const missingPageCount = Math.max(0, metrics.publishedCount - metrics.withPagesCount);

  const dashboardResults = useMemo(() => {
    const query = dashboardSearch.trim().toLocaleLowerCase();
    if (!query) return [];
    const matches = (values) => values.some(value => String(value ?? '').toLocaleLowerCase().includes(query));
    const found = [];
    chapters.forEach(chapter => {
      if (matches([chapter.title, chapter.chapterNumber, chapter.status, chapter.language, chapter.releaseDate])) {
        found.push({
          key: 'chapter:' + chapter.id, type: 'Chapter', title: chapterLabel(chapter),
          detail: [chapter.title || 'Untitled chapter', chapter.status || 'Status unknown', chapterLanguageLabel(chapter.language)].filter(Boolean).join(' · '),
          target: 'Chapters', id: chapter.id,
        });
      }
    });
    comments.forEach(comment => {
      if (matches([comment.author_name, comment.content, chapterName?.(comment.chapter_id), comment.id])) {
        found.push({
          key: 'comment:' + comment.id, type: 'Comment', title: comment.author_name || 'Reader comment',
          detail: String(comment.content || '').replace(/\s+/g, ' ').slice(0, 110),
          target: 'Comments', id: comment.id,
        });
      }
    });
    reports.forEach(report => {
      if (matches([report.title, report.description, report.reason, report.content, report.status, report.id])) {
        found.push({
          key: 'report:' + report.id, type: 'Report', title: report.title || report.reason || ('Report ' + String(report.id || '').slice(0, 8)),
          detail: [report.status || 'Open', report.description || report.content || 'Moderation review'].filter(Boolean).join(' · ').slice(0, 110),
          target: 'Reports', id: report.id,
        });
      }
    });
    return found.slice(0, 10);
  }, [dashboardSearch, chapters, comments, reports, chapterName]);

  const openDashboardResult = item => {
    setDashboardSearch('');
    onTab(item.target);
    if (item.type === 'Chapter' && item.id) {
      window.setTimeout(() => adminAction('atma-admin-focus-chapter', { chapterId: item.id }), 120);
    }
    if (item.type === 'Comment' && item.id) {
      window.setTimeout(() => adminAction('atma-admin-focus-comment', { commentId: item.id }), 120);
    }
  };

  const exportDashboardCsv = () => {
    const rows = [
      ['Atma Rekha admin export', new Date().toISOString()],
      ['Analytics window', periodLabel],
      [],
      ['Summary metric', 'Value'],
      ['Published chapters', metrics.publishedCount],
      ['Published chapters with pages', metrics.withPagesCount],
      ['Published chapters missing pages', missingPageCount],
      ['Upcoming releases', releaseQueueCount],
      ['Open reports', reportCount],
      ['Views in selected window', metrics.currentViews],
      ['Comments in selected window', metrics.currentComments],
      ['Shares in selected window', metrics.currentShares],
      ['Active readers in selected window', metrics.periodActiveReaders],
      ['Returning readers in selected window', metrics.periodReturningReaders],
      ['Registered users', userStats.logged_in_users],
      ['Push notification subscriptions', userStats.notification_subscriptions],
      [],
      ['Chapter', 'Title', 'Views in window', 'Likes in window', 'Shares in window', 'Average rating', 'Page count'],
      ...metrics.chapterStats.map(chapter => [
        chapterLabel(chapter), chapter.title || '', chapter.periodViews, chapter.periodLikes,
        chapter.periodShares, chapter.ratingAverage || '', chapter.pages,
      ]),
      [],
      ['Recent comment author', 'Comment', 'Chapter', 'Created at'],
      ...metrics.recentComments.map(comment => [
        comment.author_name || 'Reader', comment.content || '', chapterName?.(comment.chapter_id) || '', comment.created_at || '',
      ]),
    ];
    const content = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atma-rekha-admin-' + windowKey + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const quickActions = [
    { label: 'Chapter manager', detail: 'Create, edit and publish', icon: 'book', run: () => onTab('Chapters') },
    { label: 'Page editor', detail: 'Review chapter artwork', icon: 'layers', run: () => onTab('Pages') },
    { label: 'Analytics explorer', detail: 'Investigate trends and reach', icon: 'chart', run: () => onTab('Control Room') },
    { label: 'Reader directory', detail: 'Search users and memberships', icon: 'user', run: () => adminAction('atma-admin-open-management', { view: 'users' }) },
    { label: 'Push notifications', detail: 'Compose a reader update', icon: 'bell', run: () => adminAction('atma-admin-open-management', { view: 'notifications' }) },
    { label: 'Asset health', detail: 'Check chapter-page readiness', icon: 'pulse', run: () => adminAction('atma-admin-open-health') },
    { label: 'Community moderation', detail: 'Open safety and report tools', icon: 'flag', run: () => adminAction('atma-admin-open-moderation') },
    { label: 'Group chat tools', detail: 'Manage the reader community', icon: 'message', run: () => adminAction('atma-admin-open-group-chat') },
    { label: 'Operations & recovery', detail: 'Inspect diagnostics and failures', icon: 'settings', run: () => adminAction('atma-admin-open-operations') },
  ];

  return <section className="ar-overview">
    <div className="ar-overview-hero">
      <div>
        <span className="ar-kicker">ATMA REKHA · CONTROL CENTER</span>
        <h2>Admin dashboard</h2>
        <p>See what needs attention, publish updates, and track reader activity.</p>
      </div>
      <div className="ar-period-switch" role="tablist" aria-label="Analytics period">
        <span className="ar-period-status" aria-live="polite">{periodLoading ? 'Updating…' : (windowKey === 'today' ? 'Rolling 24h' : windowKey === 'week' ? '7-day window' : windowKey === 'month' ? '30-day window' : '90-day window')}</span>
        {Object.entries(WINDOW_LABELS).map(([key, label]) => <button type="button" key={key} role="tab" aria-selected={windowKey === key} aria-pressed={windowKey === key} className={windowKey === key ? 'active' : ''} onClick={() => { if (key !== windowKey) setWindowKey(key); }}>{label}</button>)}
      </div>
    </div>

    <div className="ar-ref-discovery">
      <label className="ar-ref-search">
        <AdminIcon name="search" size={17}/>
        <input
          type="search"
          value={dashboardSearch}
          onChange={event => setDashboardSearch(event.target.value)}
          placeholder="Explore chapters, comments and reports…"
          aria-label="Search loaded chapters, comments and reports"
        />
        <kbd>SEARCH WORKSPACE</kbd>
      </label>
      <button type="button" className="ar-ref-export" onClick={exportDashboardCsv}>
        <AdminIcon name="download" size={16}/> Export data
      </button>
    </div>

    {dashboardSearch.trim() && <div className="ar-ref-search-results" role="region" aria-label="Dashboard search results">
      <div className="ar-ref-results-head">
        <strong>Search results</strong><span>{dashboardResults.length} match{dashboardResults.length === 1 ? '' : 'es'} · loaded admin data</span>
        <button type="button" onClick={() => setDashboardSearch('')} aria-label="Clear dashboard search">Clear</button>
      </div>
      {dashboardResults.length ? dashboardResults.map(item => <button type="button" className="ar-ref-result" key={item.key} onClick={() => openDashboardResult(item)}>
        <span className="ar-ref-result-type">{item.type}</span>
        <span className="ar-ref-result-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
        <AdminIcon name="arrow-right" size={15}/>
      </button>) : <div className="ar-ref-no-results">No matches in the loaded chapters, comments or reports.</div>}
    </div>}

    <section className="ar-ref-quick-actions" aria-label="Admin shortcuts">
      <div className="ar-ref-section-title"><div><span>WORKSPACE</span><h3>Quick actions</h3></div><small>One tap to the tools you use most</small></div>
      <div className="ar-ref-action-grid">
        {quickActions.map(action => <button type="button" key={action.label} className="ar-ref-action" onClick={action.run}>
          <span className="ar-ref-action-icon"><AdminIcon name={action.icon} size={18}/></span>
          <span className="ar-ref-action-copy"><strong>{action.label}</strong><small>{action.detail}</small></span>
          <AdminIcon name="arrow-up-right" size={15}/>
        </button>)}
      </div>
    </section>

    {analytics === null ? <SkeletonGrid/> : <div className="ar-overview-kpis">
      <StatCard label="Published Chapters" value={formatNumber(metrics.publishedCount)} note={metrics.released + ' released in period'} icon="book" accent="blue"/>
      <StatCard label={"Views · " + WINDOW_LABELS[windowKey]} value={compactNumber(metrics.currentViews)} delta={deltaViews} icon="chart" accent="blue"/>
      <StatCard label={"Active Readers · " + WINDOW_LABELS[windowKey]} value={compactNumber(metrics.periodActiveReaders)} note="Unique viewers in selected period" icon="pulse" accent="green"/>
      <StatCard label="Registered Users" value={compactNumber(userStats.logged_in_users)} note="Protected accounts" icon="user" accent="blue"/>
      <StatCard label="Avg Rating" value={metrics.average ? metrics.average.toFixed(2) + ' / 10' : '—'} note={formatNumber(metrics.totalRatings) + ' ratings · all time'} icon="sparkle" accent="green"/>
      <StatCard label={"Comments · " + WINDOW_LABELS[windowKey]} value={compactNumber(metrics.currentComments)} delta={deltaComments} icon="message" accent="green"/>
      <StatCard label={"Returning Readers · " + WINDOW_LABELS[windowKey]} value={compactNumber(metrics.periodReturningReaders)} note="Returned on 2+ days in period" icon="pulse" accent="green"/>
      <StatCard label="Bookmarks" value={compactNumber(metrics.bookmarks)} note="Saved chapter bookmarks" icon="bookmark" accent="blue"/>
      <StatCard label={"Shares · " + WINDOW_LABELS[windowKey]} value={compactNumber(metrics.currentShares)} delta={deltaShares} icon="chart" accent="blue"/>
      <StatCard label="Notifications On" value={compactNumber(userStats.notification_subscriptions)} note="Push subscriptions" icon="bell" accent="green"/>
    </div>}

    <section className="ar-ref-pulse" aria-label="Publishing and community status">
      <div className="ar-ref-section-title"><div><span>MONITORING</span><h3>Publishing & community pulse</h3></div><span className="ar-ref-live-label"><i/> Based on loaded admin data</span></div>
      <div className="ar-ref-pulse-grid">
        <button type="button" className={'ar-ref-pulse-card ' + (missingPageCount ? 'is-warning' : 'is-clear')} onClick={() => adminAction('atma-admin-open-health')}>
          <span className="ar-ref-pulse-icon"><AdminIcon name="layers" size={17}/></span>
          <span className="ar-ref-pulse-copy"><small>Published chapters missing pages</small><strong>{formatNumber(missingPageCount)}</strong><em>{missingPageCount ? 'Review page health' : 'No page gaps found'}</em></span>
          <AdminIcon name="arrow-up-right" size={15}/>
        </button>
        <button type="button" className="ar-ref-pulse-card" onClick={() => onTab('Chapters')}>
          <span className="ar-ref-pulse-icon"><AdminIcon name="calendar" size={17}/></span>
          <span className="ar-ref-pulse-copy"><small>Upcoming releases</small><strong>{formatNumber(releaseQueueCount)}</strong><em>{metrics.upcoming[0] ? 'Next: ' + (safeDate(metrics.upcoming[0].releaseDate)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) || 'Scheduled') : 'No future release dates'}</em></span>
          <AdminIcon name="arrow-up-right" size={15}/>
        </button>
        <button type="button" className={'ar-ref-pulse-card ' + (reportCount ? 'is-warning' : 'is-clear')} onClick={() => onTab('Reports')}>
          <span className="ar-ref-pulse-icon"><AdminIcon name="flag" size={17}/></span>
          <span className="ar-ref-pulse-copy"><small>Open moderation reports</small><strong>{formatNumber(reportCount)}</strong><em>{reportCount ? 'Review the queue' : 'Queue is clear'}</em></span>
          <AdminIcon name="arrow-up-right" size={15}/>
        </button>
        <button type="button" className="ar-ref-pulse-card" onClick={() => adminAction('atma-admin-open-management', { view: 'notifications' })}>
          <span className="ar-ref-pulse-icon"><AdminIcon name="bell" size={17}/></span>
          <span className="ar-ref-pulse-copy"><small>Push subscriptions</small><strong>{formatNumber(userStats.notification_subscriptions)}</strong><em>Open notification center</em></span>
          <AdminIcon name="arrow-up-right" size={15}/>
        </button>
      </div>
      <div className="ar-ref-workbench">
        <div className="ar-ref-workbench-heading"><strong>Publishing checklist</strong><span>Operational tasks, not estimated metrics</span></div>
        <button type="button" onClick={() => adminAction('atma-admin-open-health')}>
          <span className="ar-ref-checkmark">{missingPageCount ? <AdminIcon name="alert-circle" size={15}/> : <AdminIcon name="check-circle" size={15}/>}</span>
          <span><strong>Verify published chapter pages</strong><small>{missingPageCount ? missingPageCount + ' published chapter(s) have no recorded pages.' : 'All published chapters have recorded page entries.'}</small></span>
          <b className={missingPageCount ? 'attention' : 'complete'}>{missingPageCount ? 'Review' : 'Clear'}</b>
        </button>
        <button type="button" onClick={() => onTab('Chapters')}>
          <span className="ar-ref-checkmark"><AdminIcon name="calendar" size={15}/></span>
          <span><strong>Check the release schedule</strong><small>{releaseQueueCount ? releaseQueueCount + ' future release date(s) found.' : 'No upcoming release dates are recorded.'}</small></span>
          <b>{releaseQueueCount ? 'Open queue' : 'Schedule'}</b>
        </button>
        <button type="button" onClick={() => onTab('Reports')}>
          <span className="ar-ref-checkmark">{reportCount ? <AdminIcon name="flag" size={15}/> : <AdminIcon name="check-circle" size={15}/>}</span>
          <span><strong>Review the moderation queue</strong><small>{reportCount ? reportCount + ' report(s) remain open.' : 'No open reports are currently listed.'}</small></span>
          <b className={reportCount ? 'attention' : 'complete'}>{reportCount ? 'Review' : 'Clear'}</b>
        </button>
      </div>
    </section>

    <div className="ar-overview-main-grid">
      <GlassCard className="ar-chart-card">
        <SectionHeader eyebrow="REACH & ENGAGEMENT" title="Library performance" description={"Views and engagement · " + WINDOW_LABELS[windowKey]}/>
        <LibraryChart chapters={metrics.chapterStats}/>
      </GlassCard>
      <GlassCard className="ar-activity-card">
        <SectionHeader eyebrow="LIVE" title="Last 24 hours" description="Refreshes automatically while this page is open."/>
        <div className="ar-live-grid">
          <div><span>Views</span><strong>{last24.loading ? '—' : formatNumber(last24.views)}</strong><small>chapter reads</small></div>
          <div><span>Ratings</span><strong>{last24.loading ? '—' : formatNumber(last24.ratings)}</strong><small>submitted</small></div>
          <div><span>Comments</span><strong>{last24.loading ? '—' : formatNumber(last24.comments)}</strong><small>posted</small></div>
        </div>
        <div className="ar-live-foot"><AdminIcon name="pulse" size={15}/><span>Live counts are read from the admin analytics service.</span></div>
      </GlassCard>
    </div>

    <div className="ar-overview-secondary">
      <GlassCard>
        <SectionHeader eyebrow="CONTENT" title="Top performing chapters" action={<div className="ar-overview-chapter-actions"><label className="ar-overview-sort-label"><span className="sr-only">Sort chapters by</span><select value={chapterSort} onChange={event => setChapterSort(event.target.value)} aria-label="Sort top chapters"><option value="views">Views</option><option value="likes">Likes</option><option value="rating">Rating</option></select></label><button className="ar-text-action" type="button" onClick={() => onTab('Chapters')}>View all <span>→</span></button></div>}/>
        <div className="ar-top-list">
          {[...metrics.top].sort((a, b) => chapterSort === 'rating' ? b.ratingAverage - a.ratingAverage : chapterSort === 'likes' ? b.periodLikes - a.periodLikes : b.periodViews - a.periodViews).slice(0, 5).map((chapter, index) => <button type="button" key={chapter.id} onClick={() => { onTab('Chapters'); window.setTimeout(() => window.dispatchEvent(new CustomEvent('atma-admin-focus-chapter', { detail: { chapterId: chapter.id } })), 120); }}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <div className="ar-top-copy"><strong>{chapterLabel(chapter)}</strong><span>{chapter.title || 'Untitled'}</span><i><em style={{ width: Math.max(6, (chapterSort === 'rating' ? chapter.ratingAverage : chapterSort === 'likes' ? chapter.periodLikes : chapter.periodViews) / maxTop * 100) + '%' }}/></i></div>
            <strong className="ar-top-value">{chapterSort === 'rating' ? (chapter.ratingAverage ? chapter.ratingAverage.toFixed(1) + '/10' : '—') : formatNumber(chapterSort === 'likes' ? chapter.periodLikes : chapter.periodViews)}</strong>
            <AdminIcon name="chevron" size={16}/>
          </button>)}
          {!metrics.top.length && <div className="ar-empty-inline">No chapter analytics yet.</div>}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow="RATINGS" title="Reader sentiment"/>
        <RatingDonut counts={metrics.ratingCounts} total={metrics.totalRatings}/>
        <div className="ar-rating-mini">
          {metrics.ratingCounts.slice(0, 3).map(item => <div key={item.rating}><span>{item.rating}/10</span><strong>{formatNumber(item.count)}</strong></div>)}
        </div>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow="READERS" title="Reader lifecycle"/>
        <div className="ar-funnel-list">{lifecycle.map(item => <div key={item[0]}><div><span>{item[0]}</span><strong>{formatNumber(item[1])}</strong></div><i><em style={{ width: (item[1] ? Math.max(9, item[1] / lifecycleMax * 100) : 3) + '%' }}/></i></div>)}</div>
        <p className="ar-note">Uses registered, active and returning-reader data. Membership conversion is not available in the current admin data.</p>
      </GlassCard>
    </div>

    <div className="ar-overview-grid-3">
      <GlassCard>
        <SectionHeader eyebrow="COMMUNITY" title="Recent comments" action={<button className="ar-text-action" type="button" onClick={() => onTab('Comments')}>Open <span>→</span></button>}/>
        <div className="ar-comment-feed">{metrics.recentComments.map(comment => <article key={comment.id}>
          <div className="ar-avatar">{(comment.author_name || 'R').slice(0, 1).toUpperCase()}</div>
          <div><div className="ar-comment-meta"><strong>{comment.author_name || 'Reader'} <SubscriberBadge planId={membershipPlans.get(comment.user_id)}/></strong><time>{safeDate(comment.created_at)?.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</time></div><p>{comment.content}</p><small>{chapterName(comment.chapter_id)}</small></div>
        </article>)}{!metrics.recentComments.length && <div className="ar-empty-inline">No comments yet.</div>}</div>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow="CONTENT HEALTH" title="Publishing readiness"/>
        <div className="ar-health-card"><div><strong>{metrics.readiness}%</strong><span>published with pages</span></div><div className="ar-health-bar"><i style={{ width: metrics.readiness + '%' }}/></div></div>
        <div className="ar-health-stats"><div><span>Published</span><b>{formatNumber(metrics.publishedCount)}</b></div><div><span>With pages</span><b>{formatNumber(metrics.withPagesCount)}</b></div><div><span>Open reports</span><b>{formatNumber(reportCount)}</b></div></div>
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow="SMART INSIGHTS" title="What needs attention"/>
        <div className="ar-insight-list">{insights.map((item, index) => <div key={index}><span>{index + 1}</span><p>{item}</p></div>)}</div>
      </GlassCard>
    </div>

    <div className="ar-overview-grid-2">
      <GlassCard>
        <SectionHeader eyebrow="MODERATION" title="Queue preview" action={<button className="ar-text-action" type="button" onClick={() => onTab('Reports')}>Review <span>→</span></button>}/>
        {reportCount ? <div className="ar-queue"><div className="ar-queue-count"><strong>{reportCount}</strong><span>open report{reportCount === 1 ? '' : 's'}</span></div><div><strong>Moderation needs attention</strong><small>Review open reports and resolve or reopen cases.</small></div></div> : <div className="ar-queue empty"><AdminIcon name="pulse" size={18}/><div><strong>Queue is clear</strong><span>No open comment reports right now.</span></div></div>}
      </GlassCard>

      <GlassCard>
        <SectionHeader eyebrow="UPCOMING" title="Release schedule" action={<button className="ar-text-action" type="button" onClick={() => onTab('Chapters')}>Manage <span>→</span></button>}/>
        <div className="ar-upcoming">{metrics.upcoming.length ? metrics.upcoming.map(chapter => <button type="button" key={chapter.id} onClick={() => onTab('Chapters')}><span>{safeDate(chapter.releaseDate)?.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span><strong>Chapter {chapter.chapterNumber == null ? '—' : chapter.chapterNumber}</strong><small>{chapter.title || 'Untitled'}</small><AdminIcon name="chevron" size={15}/></button>) : <div className="ar-empty-inline">No future release dates are currently scheduled.</div>}</div>
      </GlassCard>
    </div>

    <GlassCard className="ar-admin-activity-feed">
      <SectionHeader eyebrow="AUDIT LOG" title="Recent admin activity" description="Latest recorded actions in the existing admin audit log." />
      <div className="ar-admin-activity-list">
        {adminActivity.map(item => {
          const detail = item.details && typeof item.details === 'object' ? item.details : {};
          const entity = [item.entity_type, detail.title || detail.chapter_title || (detail.chapter_number != null ? 'Chapter ' + detail.chapter_number : '')].filter(Boolean).join(' · ');
          const when = safeDate(item.created_at);
          return <article key={item.id}>
            <span className="ar-admin-activity-mark"><AdminIcon name="pulse" size={15}/></span>
            <div className="ar-admin-activity-copy"><strong>{String(item.action || 'Admin action').replace(/[_-]+/g, ' ')}</strong><span>{entity || 'Workspace action'}</span></div>
            <time dateTime={item.created_at}>{when ? when.toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}</time>
          </article>;
        })}
        {!adminActivity.length && <div className="ar-empty-inline">No recent admin activity has been recorded.</div>}
      </div>
    </GlassCard>

    <GlassCard className="ar-data-note">
      <div><AdminIcon name="settings" size={16}/><div><strong>Data coverage</strong><p>Device/source breakdowns and daily trend series are not returned by the current analytics response, so this dashboard avoids inventing those metrics.</p></div></div>
      <div className="ar-data-tags"><span>Live analytics</span><span>Reader activity</span><span>Content health</span><span>Admin audit log</span></div>
    </GlassCard>
  </section>;
}