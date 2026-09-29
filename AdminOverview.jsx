import { useEffect, useMemo, useState } from 'react';
import { getPublicReaderTiers, supabase } from './supabase';
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

function LibraryChart({ chapters }) {
  const rows = [...chapters].sort((a, b) => Number(a.chapterNumber || 0) - Number(b.chapterNumber || 0)).slice(-10);
  if (!rows.length) return <div className="ar-empty-chart"><AdminIcon name="chart" size={28}/><strong>Not enough chapter data yet</strong><span>Publish chapters to unlock the reach view.</span></div>;

  const maxViews = Math.max(...rows.map(row => row.views), 1);
  const maxEngagement = Math.max(...rows.map(row => row.likes + row.shares + row.ratingCount), 1);
  return <div className="ar-chart-wrap">
    <div className="ar-chart-legend">
      <span><i className="dot violet"/>Views</span>
      <span><i className="dot pink"/>Engagement</span>
      <small>Real chapter totals · last 10 published</small>
    </div>
    <div className="ar-chart-bars" role="img" aria-label="Chapter views and engagement">
      {rows.map(row => {
        const viewH = Math.max(8, row.views / maxViews * 100);
        const engagementH = Math.max(5, (row.likes + row.shares + row.ratingCount) / maxEngagement * 100);
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

export default function AdminOverview({ chapters = [], comments = [], reports = [], ratings = [], views = [], likes = [], pageCounts = {}, onTab, chapterName }) {
  const [windowKey, setWindowKey] = useState('month');
  const [membershipPlans, setMembershipPlans] = useState(new Map());
  const [userStats, setUserStats] = useState({ logged_in_users: 0, notification_subscriptions: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [last24, setLast24] = useState({ views: 0, ratings: 0, comments: 0, loading: true });

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
        const { data, error } = await supabase.rpc('get_admin_analytics', { p_days: 1 });
        if (error) throw error;
        if (active) setLast24({
          views: Number(data?.current_views || 0),
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
    const loadAnalytics = async () => {
      try {
        const { data, error } = await supabase.rpc('get_admin_analytics', { p_days: days });
        if (error) throw error;
        if (active) setAnalytics(data || null);
      } catch (error) {
        console.warn('Admin analytics lookup failed:', error);
        if (active) setAnalytics(null);
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
      ratingAverage: Number(chapter.rating_average || 0),
      pages: Number(chapter.pages || pageCounts[chapter.id] || 0),
    }));
    const published = chapters.filter(chapter => String(chapter.status || '').toLowerCase() === 'published');
    const withPages = published.filter(chapter => Number(pageCounts[chapter.id] || 0) > 0);
    const upcoming = chapters.filter(chapter => {
      const date = safeDate(chapter.releaseDate);
      return date && date.getTime() > Date.now();
    }).sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate)).slice(0, 4);
    const top = [...chapterStats].sort((a, b) => b.views - a.views).slice(0, 5);
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
  const maxTop = Math.max(...metrics.top.map(chapter => chapter.views), 1);

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
    ['Active · 30d', metrics.activeReaders],
    ['Returning · 30d', metrics.returningReaders],
  ];
  const lifecycleMax = Math.max(lifecycle[0][1], 1);

  return <section className="ar-overview">
    <div className="ar-overview-hero">
      <div>
        <span className="ar-kicker">ATMA REKHA · CONTROL CENTER</span>
        <h2>Welcome back, Admin <span>👋</span></h2>
        <p>Monitor your manga library, readership and community from one place.</p>
      </div>
      <div className="ar-period-switch" role="tablist" aria-label="Analytics period">
        {Object.entries(WINDOW_LABELS).map(([key, label]) => <button type="button" key={key} className={windowKey === key ? 'active' : ''} onClick={() => setWindowKey(key)}>{label}</button>)}
      </div>
    </div>

    {analytics === null ? <SkeletonGrid/> : <div className="ar-overview-kpis">
      <StatCard label="Published Chapters" value={formatNumber(metrics.publishedCount)} note={metrics.released + ' released in period'} icon="book" accent="violet"/>
      <StatCard label="Total Views" value={compactNumber(metrics.totalViews)} delta={deltaViews} icon="chart" accent="violet"/>
      <StatCard label="Active Readers" value={compactNumber(metrics.activeReaders)} note="Unique readers · last 30d" icon="pulse" accent="blue"/>
      <StatCard label="Registered Users" value={compactNumber(userStats.logged_in_users)} note="Protected accounts" icon="user" accent="pink"/>
      <StatCard label="Avg Rating" value={metrics.average ? metrics.average.toFixed(2) + ' / 10' : '—'} note={formatNumber(metrics.totalRatings) + ' ratings · all time'} icon="sparkle" accent="gold"/>
      <StatCard label="Total Comments" value={compactNumber(metrics.totalComments)} delta={deltaComments} icon="message" accent="violet"/>
      <StatCard label="Returning Readers" value={compactNumber(metrics.returningReaders)} note="Seen on 2+ days · 30d" icon="pulse" accent="pink"/>
      <StatCard label="Bookmarks" value={compactNumber(metrics.bookmarks)} note="Saved chapter bookmarks" icon="bookmark" accent="blue"/>
      <StatCard label="Total Shares" value={compactNumber(metrics.totalShares)} delta={deltaShares} icon="chart" accent="violet"/>
      <StatCard label="Notifications On" value={compactNumber(userStats.notification_subscriptions)} note="Push subscriptions" icon="bell" accent="blue"/>
    </div>}

    <div className="ar-overview-main-grid">
      <GlassCard className="ar-chart-card">
        <SectionHeader eyebrow="REACH & ENGAGEMENT" title="Library performance" description="Views and interactions across the latest published chapters."/>
        <LibraryChart chapters={metrics.chapterStats}/>
      </GlassCard>
      <GlassCard className="ar-activity-card">
        <SectionHeader eyebrow="LIVE" title="Last 24 hours" description="Auto-refreshes every minute."/>
        <div className="ar-live-grid">
          <div><span>Views</span><strong>{last24.loading ? '—' : formatNumber(last24.views)}</strong><small>chapter reads</small></div>
          <div><span>Ratings</span><strong>{last24.loading ? '—' : formatNumber(last24.ratings)}</strong><small>submitted</small></div>
          <div><span>Comments</span><strong>{last24.loading ? '—' : formatNumber(last24.comments)}</strong><small>posted</small></div>
        </div>
        <div className="ar-live-foot"><AdminIcon name="pulse" size={15}/><span>Live counts use the existing admin analytics RPC.</span></div>
      </GlassCard>
    </div>

    <div className="ar-overview-secondary">
      <GlassCard>
        <SectionHeader eyebrow="CONTENT" title="Top performing chapters" action={<button className="ar-text-action" type="button" onClick={() => onTab('Chapters')}>View all <span>→</span></button>}/>
        <div className="ar-top-list">
          {metrics.top.map((chapter, index) => <button type="button" key={chapter.id} onClick={() => onTab('Chapters')}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <div className="ar-top-copy"><strong>{chapterLabel(chapter)}</strong><span>{chapter.title || 'Untitled'}</span><i><em style={{ width: Math.max(6, chapter.views / maxTop * 100) + '%' }}/></i></div>
            <strong className="ar-top-value">{formatNumber(chapter.views)}</strong>
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
        <p className="ar-note">Uses real registered, active and returning-reader metrics. Membership conversion is not exposed by the current backend.</p>
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

    <GlassCard className="ar-data-note">
      <div><AdminIcon name="settings" size={16}/><div><strong>Data coverage</strong><p>Revenue, age demographics and membership conversion are not currently available from the existing Supabase admin contract, so this dashboard does not invent them.</p></div></div>
      <div className="ar-data-tags"><span>Supabase RPC</span><span>Live refresh</span><span>R2-aware</span></div>
    </GlassCard>
  </section>;
}