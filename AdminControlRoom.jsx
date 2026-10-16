import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { fetchCloudflareAdminAnalytics } from './engagement';
import { AdminIcon } from './admin-redesign-ui.jsx';
import './admin-control-room.css';

const WINDOWS = [
  { value: 1, label: '24 hours' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];
const SECTIONS = [
  { id: 'Command Center', label: 'Command Center', icon: 'grid' },
  { id: 'Traffic & Reach', label: 'Traffic & Reach', icon: 'chart' },
  { id: 'Content Intelligence', label: 'Content Intelligence', icon: 'book' },
  { id: 'Audience', label: 'Audience Intelligence', icon: 'user' },
  { id: 'Engagement', label: 'Engagement', icon: 'pulse' },
  { id: 'Ratings', label: 'Ratings & Sentiment', icon: 'sparkle' },
  { id: 'Community', label: 'Community & Safety', icon: 'message' },
  { id: 'Membership & Revenue', label: 'Membership & Revenue', icon: 'chart' },
  { id: 'Notifications', label: 'Notification Center', icon: 'bell' },
  { id: 'Audit & Reliability', label: 'Audit & Reliability', icon: 'settings' },
  { id: 'Metric Explorer', label: 'All Metrics', icon: 'layers' },
];
const NUMBER = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const asNumber = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const fmtNum = value => Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const fmtMoney = value => '₹' + Math.round(Number(value) || 0).toLocaleString('en-IN');
const dateOf = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
const fmtDate = value => {
  const date = dateOf(value);
  return date ? date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
};
const ago = value => {
  const date = dateOf(value);
  if (!date) return null;
  const hours = Math.max(0, (Date.now() - date.getTime()) / 3600000);
  if (hours < 1) return Math.max(1, Math.round(hours * 60)) + ' min';
  if (hours < 48) return Math.round(hours) + ' h';
  return Math.round(hours / 24) + ' d';
};
const percent = (a, b) => Number(b) > 0 ? (Number(a) / Number(b)) * 100 : null;
const deltaPercent = (current, previous) => Number(previous) > 0 ? ((Number(current) - Number(previous)) / Number(previous)) * 100 : Number(current) === 0 && Number(previous) === 0 ? 0 : null;
const median = values => {
  const rows = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
};
const average = values => {
  const rows = values.map(Number).filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
};
const standardDeviation = values => {
  const rows = values.map(Number).filter(Number.isFinite);
  if (!rows.length) return null;
  const mean = average(rows);
  return Math.sqrt(average(rows.map(value => (value - mean) ** 2)));
};
const modeFromCounts = counts => {
  const rows = (counts || []).map(row => ({ rating: Number(row.rating), count: Number(row.count) })).filter(row => row.count > 0);
  if (!rows.length) return null;
  return rows.sort((a, b) => b.count - a.count || b.rating - a.rating)[0].rating;
};
const weightedMedian = counts => {
  const rows = (counts || []).map(row => ({ rating: Number(row.rating), count: Math.max(0, Number(row.count) || 0) })).filter(row => row.count > 0).sort((a, b) => a.rating - b.rating);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return null;
  const positions = total % 2 ? [Math.floor(total / 2)] : [total / 2 - 1, total / 2];
  return positions.reduce((sum, position) => {
    let cumulative = 0;
    for (const row of rows) {
      cumulative += row.count;
      if (position < cumulative) return sum + row.rating / positions.length;
    }
    return sum;
  }, 0);
};
const weightedStdDev = counts => {
  const rows = (counts || []).map(row => ({ rating: Number(row.rating), count: Math.max(0, Number(row.count) || 0) })).filter(row => row.count > 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return null;
  const mean = rows.reduce((sum, row) => sum + row.rating * row.count, 0) / total;
  return Math.sqrt(rows.reduce((sum, row) => sum + row.count * ((row.rating - mean) ** 2), 0) / total);
};
const statusLabel = value => value ? 'Available' : 'Unavailable';

async function task(run) {
  try {
    const result = await run();
    if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'error') && Object.prototype.hasOwnProperty.call(result, 'data')) {
      return { data: result.data ?? null, count: result.count ?? null, error: result.error ? String(result.error.message || result.error) : null };
    }
    return { data: result ?? null, count: result?.count ?? null, error: null };
  } catch (error) {
    return { data: null, count: null, error: error?.message || String(error) };
  }
}

function Metric({ item, compact = false }) {
  const tracked = item.value !== null && item.value !== undefined && !(typeof item.value === 'number' && !Number.isFinite(item.value));
  let value = 'Not tracked';
  if (tracked) {
    if (item.unit === 'money') value = fmtMoney(item.value);
    else if (item.unit === 'percent') value = Number(item.value).toFixed(1) + '%';
    else if (item.unit === 'decimal') value = Number(item.value).toFixed(2);
    else if (item.unit === 'days') value = Number(item.value).toFixed(1) + ' days';
    else if (item.unit === 'date') value = fmtDate(item.value);
    else if (item.unit === 'status') value = String(item.value);
    else if (item.unit === 'text') value = String(item.value);
    else value = fmtNum(item.value);
  }
  return <article className={'ar-cr-metric' + (compact ? ' is-compact' : '') + (!tracked ? ' is-untracked' : '')}>
    <div className="ar-cr-metric-head"><span>{item.label}</span>{!tracked && <span className="ar-cr-untracked-dot" title="The source does not provide this metric">—</span>}</div>
    <strong>{value}</strong>
    <p>{item.description}</p>
    <small>{item.source || 'Derived from available admin data'}</small>
  </article>;
}

function Card({ eyebrow, title, aside, children, className = '' }) {
  return <section className={'ar-cr-card ' + className}>
    <header className="ar-cr-card-head"><div><span>{eyebrow}</span><h3>{title}</h3></div>{aside}</header>
    {children}
  </section>;
}

function MiniBar({ label, current, previous, max }) {
  const currentValue = Math.max(0, NUMBER(current));
  const previousValue = Math.max(0, NUMBER(previous));
  const safeMax = Math.max(1, NUMBER(max));
  return <div className="ar-cr-compare-row">
    <div className="ar-cr-compare-label"><span>{label}</span><strong>{fmtNum(currentValue)}</strong></div>
    <div className="ar-cr-compare-track"><i className="current" style={{ width: Math.max(currentValue ? 2 : 0, currentValue / safeMax * 100) + '%' }}/></div>
    <div className="ar-cr-compare-track previous"><i style={{ width: Math.max(previousValue ? 2 : 0, previousValue / safeMax * 100) + '%' }}/></div>
    <small>Previous: {fmtNum(previousValue)}</small>
  </div>;
}

function DailyTrendChart({ current = [], previous = [] }) {
  if (!current.length) return <Empty>Daily trend data will appear when the updated analytics Worker is available. Totals and chapter comparisons remain available meanwhile.</Empty>;
  const max = Math.max(1, ...current.map(row => NUMBER(row.views)), ...previous.map(row => NUMBER(row.views)));
  return <div className="ar-cr-daily-trend">
    <div className="ar-cr-legend"><span><i className="is-current"/>Selected window</span><span><i/>Previous equal-length window</span><small>UTC day buckets; edges can be partial.</small></div>
    <div className="ar-cr-daily-grid" role="img" aria-label="Daily chapter views compared with the previous equal-length reporting window" style={{ gridTemplateColumns: `repeat(${current.length}, minmax(3px, 1fr))` }}>
      {current.map((row, index) => {
        const prior = previous[index] || null;
        const currentHeight = NUMBER(row.views) / max * 100;
        const previousHeight = NUMBER(prior?.views) / max * 100;
        return <div className="ar-cr-daily-column" key={row.day + ':' + index} title={row.day + ': ' + fmtNum(row.views) + ' views' + (prior ? ' · previous bucket ' + fmtNum(prior.views) : '') + (row.partial ? ' · partial bucket' : '')}>
          <div className="ar-cr-daily-bars"><i className="current" style={{ height: currentHeight + '%' }}/><b style={{ height: previousHeight + '%' }}/></div>
          <span>{current.length <= 14 || index === 0 || index === current.length - 1 || index % Math.ceil(current.length / 8) === 0 ? String(row.day || '').slice(8, 10) : ''}</span>
        </div>;
      })}
    </div>
    <div className="ar-cr-daily-summary"><span><small>Current total</small><strong>{fmtNum(current.reduce((sum, row) => sum + NUMBER(row.views), 0))}</strong></span><span><small>Previous total</small><strong>{fmtNum(previous.reduce((sum, row) => sum + NUMBER(row.views), 0))}</strong></span><span><small>Peak current day</small><strong>{fmtNum(Math.max(0, ...current.map(row => NUMBER(row.views))))}</strong></span></div>
  </div>;
}

function Empty({ children = 'No records are available for this view.' }) {
  return <div className="ar-cr-empty"><span>—</span><p>{children}</p></div>;
}

function downloadFile(filename, type, body) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminControlRoom({ chapters = [], comments = [], reports = [], pageCounts = {}, announcements = [], media = [], onTab }) {
  const [days, setDays] = useState(30);
  const [section, setSection] = useState('Command Center');
  const [search, setSearch] = useState('');
  const [metricFilter, setMetricFilter] = useState('all');
  const [metricSort, setMetricSort] = useState('category');
  const [chapterRank, setChapterRank] = useState('views');
  const [chapterStatus, setChapterStatus] = useState('all');
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loadDuration, setLoadDuration] = useState(null);
  const [collapsedMetrics, setCollapsedMetrics] = useState(false);
  const loadSequence = useRef(0);

  const load = async () => {
    const requestId = ++loadSequence.current;
    const startedAt = Date.now();
    setRefreshing(true);
    const results = await Promise.all([
      task(() => supabase.functions.invoke('get-admin-console-data', { body: { action: 'analytics', days: Number(days) } })),
      task(() => fetchCloudflareAdminAnalytics(Number(days))),
      task(() => supabase.functions.invoke('get-admin-user-stats')),
      task(() => supabase.functions.invoke('get-admin-console-data', { body: { action: 'membership' } })),
      task(() => supabase.from('chapters').select('id,chapter_number,title,description,status,release_date,cover_url,deleted_at,deleted_previous_status,created_at,language').order('chapter_number', { ascending: true, nullsFirst: false }).limit(1500)),
      task(() => supabase.from('comments').select('id,user_id,chapter_id,announcement_id,parent_comment_id,created_at').order('created_at', { ascending: false }).limit(1000)),
      task(() => supabase.from('comment_reports').select('id,reason,status,created_at,reviewed_at').order('created_at', { ascending: false }).limit(1000)),
      task(() => supabase.from('moderation_reports').select('id,source_type,reason,offense_count,status,created_at').order('created_at', { ascending: false }).limit(1000)),
      task(() => supabase.from('admin_activity_log').select('id,admin_user_id,action,entity_type,entity_id,details,created_at').order('created_at', { ascending: false }).limit(250)),
      task(() => supabase.from('admin_notification_log').select('id,title,target,target_count,sent_count,failed_count,removed_count,status,scheduled_for,sent_at,created_at,error').order('created_at', { ascending: false }).limit(250)),
      task(() => supabase.from('profiles').select('id', { count: 'exact', head: true })),
    ]);
    const [analyticsResult, cloudResult, usersResult, membershipResult, chapterResult, commentResult, reportResult, moderationResult, logsResult, notificationsResult, profilesResult] = results;
    const membershipEnvelope = membershipResult.data || {};
    const combined = {
      analytics: analyticsResult.data?.data?.data || analyticsResult.data?.data || null,
      analyticsError: analyticsResult.error || analyticsResult.data?.error?.message || null,
      cloudflare: cloudResult.data || null,
      cloudflareError: cloudResult.error || null,
      users: usersResult.data?.data || usersResult.data || null,
      usersError: usersResult.error || usersResult.data?.error?.message || null,
      membership: membershipEnvelope?.data || null,
      membershipError: membershipResult.error || membershipEnvelope?.error?.message || null,
      registeredUsers: asNumber(membershipEnvelope?.registered_users ?? usersResult.data?.logged_in_users),
      chapters: chapterResult.data || chapters,
      chaptersError: chapterResult.error,
      comments: commentResult.data || comments,
      commentsError: commentResult.error,
      commentReports: reportResult.data || reports,
      commentReportsError: reportResult.error,
      moderationReports: moderationResult.data || [],
      moderationReportsError: moderationResult.error,
      adminLogs: logsResult.data || [],
      adminLogsError: logsResult.error,
      notifications: notificationsResult.data || [],
      notificationsError: notificationsResult.error,
      profilesCount: profilesResult.count,
      profilesError: profilesResult.error,
    };
    // Ignore slower refreshes when a newer period/manual refresh has already started.
    if (requestId !== loadSequence.current) return;
    setBundle(combined);
    setLastRefresh(new Date());
    setLoadDuration(Date.now() - startedAt);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    const run = async () => { await load(); };
    run();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, 60000);
    const onVisibility = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      // Invalidate in-flight work on period changes and unmount.
      loadSequence.current += 1;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [days]);

  const data = bundle || {};
  const analytics = data.analytics || {};
  const cloud = data.cloudflare || {};
  const membership = data.membership || {};
  const totals = membership.totals || {};
  const revenue = membership.revenue || {};
  const plans = Array.isArray(membership.plans) ? membership.plans : [];
  const membershipTrend = Array.isArray(membership.trend) ? membership.trend : [];
  const currentViews = asNumber(cloud.current_views ?? analytics.current_views);
  const previousViews = asNumber(cloud.previous_views ?? analytics.previous_views);
  const totalViews = asNumber(cloud.total_views ?? analytics.total_views);
  const currentLikes = asNumber(analytics.current_likes);
  const previousLikes = asNumber(analytics.previous_likes);
  const currentShares = asNumber(cloud.current_shares ?? analytics.current_shares);
  const previousShares = asNumber(cloud.previous_shares ?? analytics.previous_shares);
  const currentComments = asNumber(analytics.current_comments);
  const previousComments = asNumber(analytics.previous_comments);
  const currentRatings = asNumber(analytics.current_ratings);
  const previousRatings = asNumber(analytics.previous_ratings);
  const activeReaders = asNumber(cloud.active_readers ?? analytics.period_active_readers ?? analytics.active_readers);
  const returningReaders = asNumber(cloud.returning_readers ?? analytics.period_returning_readers ?? analytics.returning_readers);
  const dailyTrendRows = Array.isArray(cloud.daily_trend) ? cloud.daily_trend.map(row => ({ day: String(row.day || ''), views: asNumber(row.views) ?? 0, partial: Boolean(row.partial) })) : [];
  const previousDailyTrendRows = Array.isArray(cloud.previous_daily_trend) ? cloud.previous_daily_trend.map(row => ({ day: String(row.day || ''), views: asNumber(row.views) ?? 0, partial: Boolean(row.partial) })) : [];
  const dailyViewValues = dailyTrendRows.map(row => row.views);
  const previousDailyViewValues = previousDailyTrendRows.map(row => row.views);
  const dailyMean = average(dailyViewValues);
  const dailyStdDev = standardDeviation(dailyViewValues);
  const peakDailyRow = dailyTrendRows.reduce((best, row) => !best || row.views > best.views ? row : best, null);
  const previousPeakDaily = previousDailyTrendRows.reduce((best, row) => !best || row.views > best.views ? row : best, null);
  const activeViewDays = dailyTrendRows.filter(row => row.views > 0).length;
  const previousActiveViewDays = previousDailyTrendRows.filter(row => row.views > 0).length;
  const weekdayTotals = Array.from({ length: 7 }, (_, weekday) => ({ weekday, views: [], label: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday] }));
  for (const row of dailyTrendRows) {
    const date = dateOf(row.day + 'T00:00:00Z');
    if (date) weekdayTotals[date.getUTCDay()].views.push(row.views);
  }
  const weekdayAverages = weekdayTotals.map(row => ({ ...row, average: average(row.views) })).filter(row => row.average != null);
  const busiestWeekday = weekdayAverages.sort((a, b) => b.average - a.average)[0] || null;
  const weekendValues = weekdayTotals.filter(row => row.weekday === 0 || row.weekday === 6).flatMap(row => row.views);
  const weekdayValues = weekdayTotals.filter(row => row.weekday > 0 && row.weekday < 6).flatMap(row => row.views);
  const lastDailyChange = dailyTrendRows.length > 1 ? deltaPercent(dailyTrendRows[dailyTrendRows.length - 1].views, dailyTrendRows[dailyTrendRows.length - 2].views) : null;
  const positiveDailyChanges = dailyTrendRows.slice(1).filter((row, index) => row.views > dailyTrendRows[index].views).length;
  const ratingCounts = (analytics.rating_counts || []).map(row => ({ rating: Number(row.rating), count: Number(row.count) }));
  const allRatings = NUMBER(analytics.total_ratings);
  const ratingSum = NUMBER(analytics.rating_sum);
  const allTimeAverageRating = allRatings ? ratingSum / allRatings : null;
  const totalLikes = asNumber(analytics.total_likes);
  const totalShares = asNumber(cloud.total_shares ?? analytics.total_shares);
  const totalComments = asNumber(analytics.total_comments);
  const totalRatings = asNumber(analytics.total_ratings);
  const totalBookmarks = asNumber(analytics.bookmarks);
  const chapterStats = (analytics.chapter_stats || []).map(row => {
    const cloudStat = (cloud.chapter_stats || []).find(item => String(item.id) === String(row.id));
    return {
      ...row,
      views: NUMBER(cloudStat?.views ?? row.views),
      period_views: NUMBER(cloudStat?.period_views ?? row.period_views),
      likes: NUMBER(cloudStat?.likes ?? row.likes),
      period_likes: NUMBER(cloudStat?.period_likes ?? row.period_likes),
      shares: NUMBER(cloudStat?.shares ?? row.shares),
      period_shares: NUMBER(cloudStat?.period_shares ?? row.period_shares),
      pages: NUMBER(row.pages ?? pageCounts[row.id] ?? 0),
      rating_count: NUMBER(row.rating_count),
      rating_average: NUMBER(row.rating_average),
    };
  });
  const rows = Array.isArray(data.chapters) ? data.chapters : chapters;
  const activeChapters = rows.filter(row => !row.deleted_at);
  const deletedChapters = rows.filter(row => Boolean(row.deleted_at));
  const published = activeChapters.filter(row => String(row.status || '').toLowerCase() === 'published');
  const drafts = activeChapters.filter(row => String(row.status || '').toLowerCase() === 'draft');
  const scheduled = activeChapters.filter(row => String(row.status || '').toLowerCase() === 'scheduled');
  const nextRelease = scheduled.map(row => dateOf(row.release_date || row.releaseDate)).filter(Boolean).sort((a, b) => a - b)[0] || null;
  const upcoming = scheduled.filter(row => { const date = dateOf(row.release_date || row.releaseDate); return date && date >= new Date(); });
  const now = Date.now();
  const daysRelease = value => { const date = dateOf(value); return date ? (date.getTime() - now) / 86400000 : null; };
  const allChapterPageCounts = rows.map(row => {
    const stat = chapterStats.find(item => String(item.id) === String(row.id));
    return Number(pageCounts[row.id] ?? stat?.pages ?? row.pages_count ?? 0);
  });
  const pageSum = allChapterPageCounts.reduce((sum, value) => sum + value, 0);
  const publishedPages = published.map(row => Number(pageCounts[row.id] ?? chapterStats.find(item => String(item.id) === String(row.id))?.pages ?? row.pages_count ?? 0));
  const publishedWithPages = published.filter(row => Number(pageCounts[row.id] ?? chapterStats.find(item => String(item.id) === String(row.id))?.pages ?? row.pages_count ?? 0) > 0);
  const publishedWithoutPages = published.filter(row => Number(pageCounts[row.id] ?? chapterStats.find(item => String(item.id) === String(row.id))?.pages ?? row.pages_count ?? 0) === 0);
  const publishedChapterIds = new Set(published.map(row => String(row.id)));
  const publishedChapterStats = chapterStats.filter(row => publishedChapterIds.has(String(row.id)));
  const chapterViews = chapterStats.map(row => Number(row.views || 0));
  const periodChapterViews = chapterStats.map(row => Number(row.period_views || 0));
  const chaptersWithViews = publishedChapterStats.filter(row => Number(row.views || 0) > 0);
  const viewlessChapters = publishedChapterStats.filter(row => Number(row.views || 0) === 0);
  const topChapter = [...chapterStats].sort((a, b) => b.period_views - a.period_views)[0] || null;
  const top3Views = [...chapterStats].sort((a, b) => b.period_views - a.period_views).slice(0, 3).reduce((sum, row) => sum + row.period_views, 0);
  const maxChapterViews = chapterStats.length ? Math.max(...chapterViews) : null;
  const minChapterViews = chapterStats.length ? Math.min(...chapterViews) : null;
  const averageChapterViews = average(chapterViews);
  const ratingPositive = ratingCounts.filter(row => row.rating >= 8).reduce((sum, row) => sum + row.count, 0);
  const ratingLow = ratingCounts.filter(row => row.rating <= 4).reduce((sum, row) => sum + row.count, 0);
  const ratingMedian = weightedMedian(ratingCounts);
  const ratingMode = modeFromCounts(ratingCounts);
  const ratingDeviation = weightedStdDev(ratingCounts);
  const interactionsAvailable = [currentLikes, currentShares, currentComments, currentRatings].every(value => value != null);
  const currentInteractions = interactionsAvailable ? NUMBER(currentLikes) + NUMBER(currentShares) + NUMBER(currentComments) + NUMBER(currentRatings) : null;
  const rawComments = Array.isArray(data.comments) ? data.comments : comments;
  const recentComments = rawComments;
  const commentReplies = rawComments.filter(row => Boolean(row.parent_comment_id)).length;
  const topLevelComments = rawComments.filter(row => !row.parent_comment_id).length;
  const chapterComments = rawComments.filter(row => Boolean(row.chapter_id)).length;
  const announcementComments = rawComments.filter(row => Boolean(row.announcement_id)).length;
  const commenters = new Set(rawComments.map(row => row.user_id).filter(Boolean)).size;
  const commentReportRows = Array.isArray(data.commentReports) ? data.commentReports : reports;
  const openCommentReports = commentReportRows.filter(row => (row.status || 'open') === 'open').length;
  const resolvedCommentReports = commentReportRows.filter(row => ['resolved', 'reviewed'].includes(String(row.status || '').toLowerCase())).length;
  const oldestOpenCommentReport = commentReportRows.filter(row => (row.status || 'open') === 'open').map(row => dateOf(row.created_at)).filter(Boolean).sort((a, b) => a - b)[0] || null;
  const moderationRows = data.moderationReports || [];
  const openModerationRows = moderationRows.filter(row => String(row.status || 'open').toLowerCase() === 'open');
  const adminLogs = data.adminLogs || [];
  const notificationLogs = data.notifications || [];
  const nowDate = new Date();
  const withinHours = (value, hours) => { const date = dateOf(value); return date ? nowDate - date <= hours * 3600000 : false; };
  const failedAdminLogs = adminLogs.filter(row => /fail|error/i.test(String(row.action || '')) || row.details?.error);
  const recentAdminLogs = adminLogs.filter(row => withinHours(row.created_at, 24));
  const distinctActions = new Set(adminLogs.map(row => String(row.action || '').trim()).filter(Boolean)).size;
  const failedNotifications = notificationLogs.filter(row => String(row.status || '').toLowerCase() === 'failed' || NUMBER(row.failed_count) > 0);
  const sentNotifications = notificationLogs.filter(row => ['sent', 'completed', 'success'].includes(String(row.status || '').toLowerCase()));
  const scheduledNotifications = notificationLogs.filter(row => String(row.status || '').toLowerCase() === 'scheduled');
  const attemptedDeliveries = notificationLogs.reduce((sum, row) => sum + NUMBER(row.target_count || row.sent_count || 0), 0);
  const deliveredNotifications = notificationLogs.reduce((sum, row) => sum + NUMBER(row.sent_count), 0);
  const failedDeliveryCount = notificationLogs.reduce((sum, row) => sum + NUMBER(row.failed_count), 0);
  const notificationSuccessRate = attemptedDeliveries > 0 ? deliveredNotifications / attemptedDeliveries * 100 : null;
  const latestNotification = [...notificationLogs].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
  const userStats = data.users || {};
  const registeredUsers = data.profilesCount != null && !data.profilesError ? asNumber(data.profilesCount) : (!data.usersError ? asNumber(data.registeredUsers ?? userStats.logged_in_users) : null);
  const pushSubscriptions = !data.usersError ? asNumber(userStats.notification_subscriptions ?? userStats.notification_users) : null;
  const hasCommentRows = Array.isArray(data.comments) && !data.commentsError;
  const hasCommentReportRows = Array.isArray(data.commentReports) && !data.commentReportsError;
  const hasModerationRows = Array.isArray(data.moderationReports) && !data.moderationReportsError;
  const hasAuditRows = Array.isArray(data.adminLogs) && !data.adminLogsError;
  const hasNotificationRows = Array.isArray(data.notifications) && !data.notificationsError;
  const mrr = totals.mrr_estimate_inr == null ? null : NUMBER(totals.mrr_estimate_inr);
  const arr = mrr == null ? null : mrr * 12;
  const activeBillable = totals.active_billable_members == null ? null : NUMBER(totals.active_billable_members);
  const accessMembers = totals.access_members == null ? null : NUMBER(totals.access_members);
  const atRiskMrr = totals.at_risk_mrr_inr == null ? null : NUMBER(totals.at_risk_mrr_inr);
  const processedGross = revenue.processed_gross_all_time_inr == null ? null : NUMBER(revenue.processed_gross_all_time_inr);
  const processedGross30 = revenue.processed_gross_30d_inr == null ? null : NUMBER(revenue.processed_gross_30d_inr);
  const chargeCount = revenue.processed_charge_count == null ? null : NUMBER(revenue.processed_charge_count);
  const renewals30 = totals.renewals_next_30d == null ? null : NUMBER(totals.renewals_next_30d);
  const pendingSubs = totals.pending_subscriptions == null ? null : NUMBER(totals.pending_subscriptions);
  const cancelledSubs = totals.cancelled_records == null ? null : NUMBER(totals.cancelled_records);
  const failedSubs = totals.failed_subscriptions == null ? null : NUMBER(totals.failed_subscriptions);
  const conversion = activeBillable != null && Number(registeredUsers) > 0 ? activeBillable / Number(registeredUsers) * 100 : null;
  const mediaRows = Array.isArray(media) ? media : [];
  const announcementRows = Array.isArray(announcements) ? announcements : [];
  const lastRelease = published.map(row => dateOf(row.release_date || row.releaseDate || row.created_at)).filter(Boolean).sort((a, b) => b - a)[0] || null;
  const releaseAges = published.map(row => daysRelease(row.release_date || row.releaseDate || row.created_at)).filter(value => value != null && value >= 0);
  const futureReleases7 = upcoming.filter(row => { const delta = daysRelease(row.release_date || row.releaseDate); return delta != null && delta <= 7; }).length;
  const futureReleases30 = upcoming.filter(row => { const delta = daysRelease(row.release_date || row.releaseDate); return delta != null && delta <= 30; }).length;
  const missingTitle = activeChapters.filter(row => !String(row.title || '').trim()).length;
  const missingDescription = activeChapters.filter(row => !String(row.description || '').trim()).length;
  const missingCover = activeChapters.filter(row => !String(row.cover_url || row.coverUrl || '').trim()).length;
  const unnumbered = activeChapters.filter(row => row.chapter_number == null && row.chapterNumber == null).length;
  const chapterNumberKeys = activeChapters.filter(row => row.chapter_number != null || row.chapterNumber != null).map(row => String(row.language || row.mangaLanguage || 'hi') + ':' + String(row.chapter_number ?? row.chapterNumber));
  const duplicateChapterNumbers = chapterNumberKeys.length - new Set(chapterNumberKeys).size;
  const topRatingChapter = [...publishedChapterStats].filter(row => row.rating_count > 0).sort((a, b) => b.rating_average - a.rating_average)[0] || null;
  const ratedChapters = publishedChapterStats.filter(row => row.rating_count > 0);
  const noRatingChapters = publishedChapterStats.filter(row => row.rating_count === 0);
  const highViewChapters = chapterStats.filter(row => row.views >= 100);
  const activeLanguages = new Set(activeChapters.map(row => String(row.language || row.mangaLanguage || '').trim()).filter(Boolean));
  const notificationErrors = data.notificationsError ? 1 : 0;
  const dataSources = [
    { name: 'Admin analytics function', ok: data.analytics != null && !data.analyticsError, error: data.analyticsError },
    { name: 'Cloudflare analytics', ok: data.cloudflare != null && !data.cloudflareError, error: data.cloudflareError },
    { name: 'User statistics', ok: data.users != null && !data.usersError, error: data.usersError },
    { name: 'Membership analytics', ok: data.membership != null && !data.membershipError, error: data.membershipError },
    { name: 'Chapter inventory', ok: data.chapters != null && !data.chaptersError, error: data.chaptersError },
    { name: 'Comments inventory', ok: data.comments != null && !data.commentsError, error: data.commentsError },
    { name: 'Comment reports', ok: data.commentReports != null && !data.commentReportsError, error: data.commentReportsError },
    { name: 'Moderation reports', ok: data.moderationReports != null && !data.moderationReportsError, error: data.moderationReportsError },
    { name: 'Admin audit log', ok: data.adminLogs != null && !data.adminLogsError, error: data.adminLogsError },
    { name: 'Notification log', ok: data.notifications != null && !data.notificationsError, error: data.notificationsError },
    { name: 'Profiles count', ok: data.profilesCount != null && !data.profilesError, error: data.profilesError },
  ];
  const healthySources = dataSources.filter(row => row.ok).length;
  const sourceErrors = dataSources.filter(row => !row.ok);
  const ratio = (numerator, denominator) => numerator == null || denominator == null || Number(denominator) <= 0 ? null : Number(numerator) / Number(denominator) * 100;
  const selectedDays = Number(days);

  const metricGroups = useMemo(() => {
    const m = (category, label, value, unit = 'count', description = '', source = '') => ({ category, label, value: value == null || (typeof value === 'number' && !Number.isFinite(value)) ? null : value, unit, description, source });
    const make = () => ({
      'Traffic & Reach': [
        m('Traffic & Reach', 'All-time chapter views', totalViews, 'count', 'Lifetime reads reported by the Cloudflare/admin analytics sources.', 'Cloudflare Analytics / admin function'),
        m('Traffic & Reach', 'Views in selected window', currentViews, 'count', 'Reads inside the selected reporting window.', 'Selected-period analytics'),
        m('Traffic & Reach', 'Views in previous window', previousViews, 'count', 'Same-length period immediately before the selected window.', 'Selected-period analytics'),
        m('Traffic & Reach', 'View change versus previous', deltaPercent(currentViews, previousViews), 'percent', 'Percent change; unavailable when the previous baseline is zero and current is non-zero.', 'Current and previous views'),
        m('Traffic & Reach', 'Average views per day', currentViews == null ? null : currentViews / selectedDays, 'decimal', 'Selected-window views divided by its number of days.', 'Derived'),
        m('Traffic & Reach', 'Active readers in window', activeReaders, 'count', 'Distinct readers the analytics source reported for the period.', 'Cloudflare / admin function'),
        m('Traffic & Reach', 'Returning readers in window', returningReaders, 'count', 'Distinct readers counted as returning by the analytics source.', 'Cloudflare / admin function'),
        m('Traffic & Reach', 'Returning reader share', ratio(returningReaders, activeReaders), 'percent', 'Returning readers divided by active readers.', 'Derived'),
        m('Traffic & Reach', 'Views per active reader', activeReaders != null && Number(activeReaders) > 0 ? currentViews / Number(activeReaders) : null, 'decimal', 'Period views divided by active readers.', 'Derived'),
        m('Traffic & Reach', 'Published chapters with reads', chaptersWithViews.length, 'count', 'Published chapters represented in chapter analytics that have at least one lifetime view.', 'Chapter analytics'),
        m('Traffic & Reach', 'Published chapters with zero reads', viewlessChapters.length, 'count', 'Published chapters represented in analytics with zero lifetime views.', 'Chapter analytics'),
        m('Traffic & Reach', 'Median lifetime views per published chapter', median(publishedChapterStats.map(row => Number(row.views || 0))), 'decimal', 'Median lifetime views across published chapters represented in analytics.', 'Chapter analytics'),
        m('Traffic & Reach', 'Daily trend buckets returned', cloud.daily_trend ? dailyTrendRows.length : null, 'count', 'Number of UTC calendar buckets in the selected rolling window; boundary buckets may be partial.', 'Cloudflare Analytics Engine and R2 archive'),
        m('Traffic & Reach', 'Days with at least one view', cloud.daily_trend ? activeViewDays : null, 'count', 'Selected-window date buckets with one or more chapter views.', 'Daily trend'),
        m('Traffic & Reach', 'Days with zero views', cloud.daily_trend ? dailyTrendRows.filter(row => row.views === 0).length : null, 'count', 'Selected-window date buckets with no recorded chapter views.', 'Daily trend'),
        m('Traffic & Reach', 'Average views per daily bucket', cloud.daily_trend ? dailyMean : null, 'decimal', 'Mean views per returned UTC calendar bucket, including zero-view buckets.', 'Daily trend'),
        m('Traffic & Reach', 'Median views per daily bucket', cloud.daily_trend ? median(dailyViewValues) : null, 'decimal', 'Median views across returned UTC calendar buckets.', 'Daily trend'),
        m('Traffic & Reach', 'Peak daily views', cloud.daily_trend ? peakDailyRow?.views ?? null : null, 'count', 'Highest daily total in the selected reporting window.', 'Daily trend'),
        m('Traffic & Reach', 'Date of peak daily views', cloud.daily_trend ? peakDailyRow?.day ?? null : null, 'text', 'UTC date of the highest daily view total.', 'Daily trend'),
        m('Traffic & Reach', 'Previous window peak daily views', cloud.previous_daily_trend ? previousPeakDaily?.views ?? null : null, 'count', 'Highest daily total in the previous equal-length reporting window.', 'Previous daily trend'),
        m('Traffic & Reach', 'Active-day coverage', cloud.daily_trend ? ratio(activeViewDays, dailyTrendRows.length) : null, 'percent', 'Share of returned date buckets with at least one view.', 'Daily trend'),
        m('Traffic & Reach', 'Daily views standard deviation', cloud.daily_trend ? dailyStdDev : null, 'decimal', 'Population standard deviation across daily view totals.', 'Daily trend'),
        m('Traffic & Reach', 'Daily views volatility', cloud.daily_trend && dailyMean > 0 ? dailyStdDev / dailyMean * 100 : null, 'percent', 'Coefficient of variation for daily view totals; higher values indicate more uneven daily reach.', 'Daily trend'),
        m('Traffic & Reach', 'Days with growth versus prior day', cloud.daily_trend ? positiveDailyChanges : null, 'count', 'Adjacent UTC date buckets where views increased.', 'Daily trend'),
        m('Traffic & Reach', 'Most-viewed weekday', cloud.daily_trend ? (busiestWeekday?.label || null) : null, 'text', 'Weekday with the highest average views in this window; partial boundary dates can affect the sample.', 'Daily trend'),
        m('Traffic & Reach', 'Average weekend views', cloud.daily_trend ? average(weekendValues) : null, 'decimal', 'Mean daily views for Saturday and Sunday buckets in the selected window.', 'Daily trend'),
        m('Traffic & Reach', 'Average weekday views', cloud.daily_trend ? average(weekdayValues) : null, 'decimal', 'Mean daily views for Monday through Friday buckets in the selected window.', 'Daily trend'),
        m('Traffic & Reach', 'Last daily bucket change', cloud.daily_trend ? lastDailyChange : null, 'percent', 'Change between the last two returned daily buckets. Boundary buckets may be partial.', 'Daily trend'),
        m('Traffic & Reach', 'Active-day change vs previous period', cloud.daily_trend && cloud.previous_daily_trend ? deltaPercent(activeViewDays, previousActiveViewDays) : null, 'percent', 'Period-over-period change in date buckets with at least one recorded view.', 'Current and previous daily trends'),
      ],
      'Content Intelligence': [
        m('Content Intelligence', 'Published chapters', published.length, 'count', 'Published, non-archived chapter records currently loaded.', 'Chapter inventory'),
        m('Content Intelligence', 'Draft chapters', drafts.length, 'count', 'Draft, non-archived chapter records currently loaded.', 'Chapter inventory'),
        m('Content Intelligence', 'Scheduled chapters', scheduled.length, 'count', 'Scheduled chapter records currently loaded.', 'Chapter inventory'),
        m('Content Intelligence', 'Archived chapters', deletedChapters.length, 'count', 'Soft-deleted chapter records returned by the inventory query.', 'Chapter inventory'),
        m('Content Intelligence', 'Known page count', pageSum, 'count', 'Sum of page counts available from the admin page inventory and analytics.', 'Page inventory'),
        m('Content Intelligence', 'Published chapters with pages', publishedWithPages.length, 'count', 'Published chapters that have at least one page.', 'Page inventory'),
        m('Content Intelligence', 'Published page readiness', ratio(publishedWithPages.length, published.length), 'percent', 'Published chapters with pages divided by published chapters.', 'Derived'),
        m('Content Intelligence', 'Published chapters missing pages', publishedWithoutPages.length, 'count', 'Published chapters with no pages in available page counts.', 'Page inventory'),
        m('Content Intelligence', 'Average pages per published chapter', average(publishedPages), 'decimal', 'Mean page count across published chapters.', 'Page inventory'),
        m('Content Intelligence', 'Chapters without cover URLs', missingCover, 'count', 'Active chapter records without a cover URL in the inventory payload.', 'Chapter inventory'),
        m('Content Intelligence', 'Chapters without descriptions', missingDescription, 'count', 'Active chapter records with an empty description.', 'Chapter inventory'),
        m('Content Intelligence', 'Upcoming releases within 30 days', futureReleases30, 'count', 'Scheduled chapter records dated in the next 30 days.', 'Release schedule'),
      ],
      'Engagement': [
        m('Engagement', 'All-time likes', totalLikes, 'count', 'The analytics function reports chapter and comment likes together.', 'Admin analytics'),
        m('Engagement', 'Likes in selected window', currentLikes, 'count', 'Period likes as reported by the admin analytics function.', 'Admin analytics'),
        m('Engagement', 'Shares in selected window', currentShares, 'count', 'Period chapter shares.', 'Cloudflare / admin analytics'),
        m('Engagement', 'Comments in selected window', currentComments, 'count', 'Period comments, including replies when the function includes them.', 'Admin analytics'),
        m('Engagement', 'Ratings submitted in window', currentRatings, 'count', 'Ratings submitted inside the selected reporting window.', 'Admin analytics'),
        m('Engagement', 'All interactions in window', interactionsAvailable ? currentInteractions : null, 'count', 'Likes + shares + comments + ratings; one person can create several events.', 'Derived'),
        m('Engagement', 'Likes per 100 views', currentLikes == null ? null : ratio(currentLikes, currentViews) == null ? null : ratio(currentLikes, currentViews) * 100, 'decimal', 'Like events per 100 view events; not a person-level conversion rate.', 'Derived'),
        m('Engagement', 'Shares per 100 views', currentShares == null ? null : ratio(currentShares, currentViews) == null ? null : ratio(currentShares, currentViews) * 100, 'decimal', 'Share events per 100 view events.', 'Derived'),
        m('Engagement', 'Comments per 100 views', currentComments == null ? null : ratio(currentComments, currentViews) == null ? null : ratio(currentComments, currentViews) * 100, 'decimal', 'Comment events per 100 view events.', 'Derived'),
        m('Engagement', 'Ratings per 100 views', currentRatings == null ? null : ratio(currentRatings, currentViews) == null ? null : ratio(currentRatings, currentViews) * 100, 'decimal', 'Rating events per 100 view events.', 'Derived'),
        m('Engagement', 'Interactions per active reader', activeReaders && activeReaders > 0 && currentInteractions != null ? currentInteractions / Number(activeReaders) : null, 'decimal', 'Events per distinct active reader; not deduplicated across event types.', 'Derived'),
        m('Engagement', 'Like change versus previous', deltaPercent(currentLikes, previousLikes), 'percent', 'Period-over-period change when a valid prior baseline exists.', 'Current and previous likes'),
      ],
      'Audience': [
        m('Audience', 'Registered accounts', registeredUsers, 'count', 'Count returned by profiles or the existing user-statistics endpoint.', 'Profiles / admin user stats'),
        m('Audience', 'Active readers', activeReaders, 'count', 'Distinct active readers as reported by the analytics API.', 'Cloudflare / admin function'),
        m('Audience', 'Returning readers', returningReaders, 'count', 'Readers identified as returning by the existing analytics API.', 'Cloudflare / admin function'),
        m('Audience', 'Active readers as share of accounts', ratio(activeReaders, registeredUsers), 'percent', 'Active readers divided by registered accounts; anonymous readers can also be counted by view analytics.', 'Derived; populations may differ'),
        m('Audience', 'Returning readers as share of active', ratio(returningReaders, activeReaders), 'percent', 'Returning reader count divided by active reader count.', 'Derived'),
        m('Audience', 'Saved bookmarks', totalBookmarks, 'count', 'All bookmarks reported by the admin analytics function.', 'Admin analytics'),
        m('Audience', 'Bookmarks per active reader', activeReaders && activeReaders > 0 && totalBookmarks != null ? Number(totalBookmarks) / Number(activeReaders) : null, 'decimal', 'Lifetime bookmarks divided by selected-window active readers; mixed time windows.', 'Derived'),
        m('Audience', 'Unique commenters in loaded records', hasCommentRows ? commenters : null, 'count', 'Unique user IDs found in up to 1,000 most recent comments.', 'Recent comment records'),
        m('Audience', 'Commenting users as share of accounts', hasCommentRows && registeredUsers > 0 ? ratio(commenters, registeredUsers) : null, 'percent', 'Based on the fetched comment window and registered account count.', 'Derived; limited comment window'),
        m('Audience', 'Push notification subscriptions', pushSubscriptions, 'count', 'Subscriptions reported by the existing user-statistics function.', 'Admin user stats'),
        m('Audience', 'Accounts with push subscription', pushSubscriptions != null && registeredUsers > 0 ? ratio(pushSubscriptions, registeredUsers) : null, 'percent', 'Push subscription count divided by registered accounts.', 'Derived'),
        m('Audience', 'Audience age or gender breakdown', null, 'text', 'Not shown because the existing admin data does not provide these demographics.', 'Not collected'),
      ],
      'Ratings': [
        m('Ratings', 'All-time rating count', totalRatings, 'count', 'Lifetime chapter rating count.', 'Admin analytics'),
        m('Ratings', 'All-time average rating', allTimeAverageRating, 'decimal', 'Total rating sum divided by number of ratings.', 'Admin analytics'),
        m('Ratings', 'High ratings (8–10)', ratingCounts.length ? ratingPositive : null, 'count', 'Count of ratings of 8, 9 or 10.', 'Rating histogram'),
        m('Ratings', 'High rating share (8–10)', totalRatings > 0 ? ratio(ratingPositive, totalRatings) : null, 'percent', 'Ratings of 8–10 as a share of all ratings.', 'Rating histogram'),
        m('Ratings', 'Low ratings (1–4)', ratingCounts.length ? ratingLow : null, 'count', 'Count of ratings of 1, 2, 3 or 4.', 'Rating histogram'),
        m('Ratings', 'Low rating share (1–4)', totalRatings > 0 ? ratio(ratingLow, totalRatings) : null, 'percent', 'Ratings of 1–4 as a share of all ratings.', 'Rating histogram'),
        m('Ratings', 'Median rating', ratingMedian, 'decimal', 'Calculated from rating bucket counts when rating data is present.', 'Rating histogram'),
        m('Ratings', 'Most common rating', ratingMode, 'decimal', 'Mode of the available rating histogram.', 'Rating histogram'),
        m('Ratings', 'Rating standard deviation', ratingDeviation, 'decimal', 'Population standard deviation reconstructed from rating buckets.', 'Rating histogram'),
        m('Ratings', 'Chapters with at least one rating', ratedChapters.length, 'count', 'Published chapters in analytics with at least one rating.', 'Chapter analytics'),
        m('Ratings', 'Highest-rated chapter average', topRatingChapter?.rating_average ?? null, 'decimal', 'Highest chapter average with at least one rating; sample size is available in the chapter list.', 'Chapter analytics'),
        m('Ratings', 'Published chapters without ratings', noRatingChapters.length, 'count', 'Published chapters in analytics with zero rating events.', 'Chapter analytics'),
      ],
      'Community': [
        m('Community', 'All-time comments', totalComments, 'count', 'Lifetime comment count from analytics.', 'Admin analytics'),
        m('Community', 'Comments in selected window', currentComments, 'count', 'Comments within the selected period.', 'Admin analytics'),
        m('Community', 'Comments in previous window', previousComments, 'count', 'Comments in the immediately prior equal-length period.', 'Admin analytics'),
        m('Community', 'Comment change versus previous', deltaPercent(currentComments, previousComments), 'percent', 'Period-over-period change with a valid previous baseline.', 'Current and previous comments'),
        m('Community', 'Comments per day', currentComments == null ? null : Number(currentComments) / selectedDays, 'decimal', 'Period comments divided by window length.', 'Derived'),
        m('Community', 'Replies in loaded comments', hasCommentRows ? commentReplies : null, 'count', 'Replies among up to 1,000 latest comment records.', 'Recent comment records'),
        m('Community', 'Reply share in loaded comments', hasCommentRows ? ratio(commentReplies, rawComments.length) : null, 'percent', 'Replies as share of the loaded comment sample.', 'Derived; limited comment window'),
        m('Community', 'Chapter-linked comments in sample', hasCommentRows ? chapterComments : null, 'count', 'Loaded comments linked to chapters.', 'Recent comment records'),
        m('Community', 'Announcement-linked comments in sample', hasCommentRows ? announcementComments : null, 'count', 'Loaded comments linked to announcements.', 'Recent comment records'),
        m('Community', 'Open comment reports in loaded records', hasCommentReportRows ? openCommentReports : null, 'count', 'Open reports among up to 1,000 most recent report rows.', 'Comment report records'),
        m('Community', 'Reviewed or resolved comment reports', hasCommentReportRows ? resolvedCommentReports : null, 'count', 'Rows marked reviewed or resolved in the fetched report sample.', 'Comment report records'),
        m('Community', 'Oldest open comment report age', hasCommentReportRows && oldestOpenCommentReport ? Math.max(0, (Date.now() - oldestOpenCommentReport.getTime()) / 86400000) : null, 'days', 'Age of oldest open report within the fetched report sample.', 'Comment report records'),
      ],
      'Membership & Revenue': [
        m('Membership & Revenue', 'Active billable members', activeBillable, 'count', 'Eligible active subscriptions from membership analytics.', 'Membership action'),
        m('Membership & Revenue', 'Members with access', accessMembers, 'count', 'Current membership-access population; may include scheduled cancellation.', 'Membership action'),
        m('Membership & Revenue', 'Estimated monthly recurring revenue', mrr, 'money', 'Backend estimate based on eligible active subscriptions and current plan prices.', 'Membership action'),
        m('Membership & Revenue', 'Annual recurring run-rate', arr, 'money', 'MRR multiplied by 12; not a revenue forecast.', 'Derived from MRR'),
        m('Membership & Revenue', 'Processed gross all time', processedGross, 'money', 'Gross membership charges recorded by the current billing analytics.', 'Membership action / Razorpay events'),
        m('Membership & Revenue', 'Processed gross in 30 days', processedGross30, 'money', 'Processed gross membership charge events in the last 30 days.', 'Membership action / Razorpay events'),
        m('Membership & Revenue', 'Processed membership charges', chargeCount, 'count', 'Charge events recorded in membership analytics.', 'Membership action'),
        m('Membership & Revenue', 'At-risk recurring revenue', atRiskMrr, 'money', 'MRR estimate attributed to active subscriptions already marked to cancel.', 'Membership action'),
        m('Membership & Revenue', 'Renewals in next 30 days', renewals30, 'count', 'Current auto-renewing subscriptions whose end dates fall in the next 30 days.', 'Membership action'),
        m('Membership & Revenue', 'Pending subscriptions', pendingSubs, 'count', 'Pending records reported by membership analytics.', 'Membership action'),
        m('Membership & Revenue', 'Cancelled subscription records', cancelledSubs, 'count', 'Cancelled records reported by membership analytics.', 'Membership action'),
        m('Membership & Revenue', 'Failed subscription records', failedSubs, 'count', 'Failed subscription records reported by membership analytics.', 'Membership action'),
      ],
      'Notifications': [
        m('Notifications', 'Push subscribers', pushSubscriptions, 'count', 'Subscription total from the existing user-statistics endpoint.', 'Admin user stats'),
        m('Notifications', 'Notification log records loaded', hasNotificationRows ? notificationLogs.length : null, 'count', 'Most recent notification-log rows, capped at 250.', 'admin_notification_log'),
        m('Notifications', 'Delivery attempts in loaded records', hasNotificationRows ? attemptedDeliveries : null, 'count', 'Sum of target_count where present; sample limited to 250 log records.', 'admin_notification_log'),
        m('Notifications', 'Successful deliveries in loaded records', hasNotificationRows ? deliveredNotifications : null, 'count', 'Sum of sent_count in loaded notification log rows.', 'admin_notification_log'),
        m('Notifications', 'Failed deliveries in loaded records', hasNotificationRows ? failedDeliveryCount : null, 'count', 'Sum of failed_count in loaded notification log rows.', 'admin_notification_log'),
        m('Notifications', 'Delivery success rate in loaded records', hasNotificationRows ? notificationSuccessRate : null, 'percent', 'Successful deliveries divided by target_count across loaded log rows.', 'Derived; latest 250 records'),
        m('Notifications', 'Scheduled notification records', hasNotificationRows ? scheduledNotifications.length : null, 'count', 'Scheduled rows among the latest 250 notification-log records.', 'admin_notification_log'),
        m('Notifications', 'Failed notification records', hasNotificationRows ? failedNotifications.length : null, 'count', 'Rows marked failed or containing a non-zero failed delivery count.', 'admin_notification_log'),
        m('Notifications', 'Sent notification records', hasNotificationRows ? sentNotifications.length : null, 'count', 'Rows with sent/completed/success status among loaded records.', 'admin_notification_log'),
        m('Notifications', 'Latest notification record', hasNotificationRows ? (latestNotification?.created_at ?? null) : null, 'date', 'Creation time of the most recent loaded notification record.', 'admin_notification_log'),
        m('Notifications', 'Latest notification record age', hasNotificationRows && latestNotification ? Math.max(0, (Date.now() - new Date(latestNotification.created_at).getTime()) / 86400000) : null, 'days', 'Age of newest log row in days.', 'admin_notification_log'),
        m('Notifications', 'Notification error text telemetry', null, 'text', 'Message-level provider diagnostics are not summarized here; inspect Operations & Recovery for individual failures.', 'Not aggregated'),
      ],
      'Audit & Reliability': [
        m('Audit & Reliability', 'Audit records loaded', hasAuditRows ? adminLogs.length : null, 'count', 'Most recent audit-log rows, capped at 250.', 'admin_activity_log'),
        m('Audit & Reliability', 'Admin actions in last 24 hours', hasAuditRows ? recentAdminLogs.length : null, 'count', 'Audit rows with created_at inside the last 24 hours.', 'admin_activity_log'),
        m('Audit & Reliability', 'Failed/error audit records loaded', hasAuditRows ? failedAdminLogs.length : null, 'count', 'Recent audit rows whose action or details suggest failure.', 'admin_activity_log'),
        m('Audit & Reliability', 'Failure share in loaded audit records', hasAuditRows && adminLogs.length ? ratio(failedAdminLogs.length, adminLogs.length) : null, 'percent', 'Failures among loaded audit records; not a site-wide incident rate.', 'Derived; latest 250 records'),
        m('Audit & Reliability', 'Distinct action types in loaded audit', hasAuditRows ? distinctActions : null, 'count', 'Unique action values in the loaded audit sample.', 'admin_activity_log'),
        m('Audit & Reliability', 'Chapter publish actions in sample', hasAuditRows ? adminLogs.filter(row => /publish/i.test(String(row.action || ''))).length : null, 'count', 'Audit actions containing the word publish.', 'admin_activity_log'),
        m('Audit & Reliability', 'Chapter edit/update actions in sample', hasAuditRows ? adminLogs.filter(row => /update|edit/i.test(String(row.action || ''))).length : null, 'count', 'Audit actions whose names suggest updates or edits.', 'admin_activity_log'),
        m('Audit & Reliability', 'Delete actions in sample', hasAuditRows ? adminLogs.filter(row => /delete|remove/i.test(String(row.action || ''))).length : null, 'count', 'Audit actions whose names suggest deletes/removals.', 'admin_activity_log'),
        m('Audit & Reliability', 'Media cleanup failures in sample', hasAuditRows ? adminLogs.filter(row => /cleanup_failed/i.test(String(row.action || ''))).length : null, 'count', 'Cleanup failure actions in the loaded audit sample.', 'admin_activity_log'),
        m('Audit & Reliability', 'Last recorded admin action', hasAuditRows ? (adminLogs[0]?.created_at ?? null) : null, 'date', 'Newest record in the audit log sample.', 'admin_activity_log'),
        m('Audit & Reliability', 'Analytics load duration', loadDuration, 'decimal', 'Duration of the last control-room refresh in milliseconds.', 'Browser measurement'),
        m('Audit & Reliability', 'Connected data sources', healthySources, 'text', 'Successful source reads out of the 11 checks performed by this control room.', 'Control room checks'),
      ],
      'Content Quality': [
        m('Content Quality', 'Active chapter records', activeChapters.length, 'count', 'Non-archived chapter rows in the loaded inventory.', 'Chapter inventory'),
        m('Content Quality', 'Published chapters without ratings', noRatingChapters.length, 'count', 'Published chapter records in analytics with no rating events.', 'Chapter analytics'),
        m('Content Quality', 'Average rating across rated chapters', average(ratedChapters.map(row => row.rating_average)), 'decimal', 'Mean of published chapter average ratings; unweighted by rating count.', 'Chapter analytics'),
        m('Content Quality', 'Chapters with 100+ lifetime views', highViewChapters.length, 'count', 'Published chapters with at least 100 lifetime views.', 'Chapter analytics'),
        m('Content Quality', 'Top three chapters view share', totalViews != null && Number(totalViews) > 0 ? ratio(top3Views, chapterStats.reduce((sum, row) => sum + Number(row.period_views || 0), 0)) : null, 'percent', 'Top three chapter selected-window views divided by all selected-window chapter views. Cloudflare totals may have separate counting rules.', 'Chapter analytics'),
        m('Content Quality', 'Maximum lifetime chapter views', maxChapterViews, 'count', 'Maximum lifetime views among published chapter analytics rows.', 'Chapter analytics'),
        m('Content Quality', 'Minimum lifetime chapter views', minChapterViews, 'count', 'Minimum lifetime views among published chapter analytics rows.', 'Chapter analytics'),
        m('Content Quality', 'Chapters with descriptions', activeChapters.length - missingDescription, 'count', 'Active inventory records with non-empty descriptions.', 'Chapter inventory'),
        m('Content Quality', 'Chapters with missing titles', missingTitle, 'count', 'Active inventory records without a title.', 'Chapter inventory'),
        m('Content Quality', 'Duplicate chapter-number/language keys', duplicateChapterNumbers, 'count', 'Duplicate number/language pairs inside the inventory rows returned.', 'Chapter inventory'),
        m('Content Quality', 'Chapters represented in rating data', ratedChapters.length, 'count', 'Published analytics rows that have at least one rating.', 'Chapter analytics'),
        m('Content Quality', 'Average release age for published chapters', average(releaseAges), 'days', 'Average days since release/creation for published chapters; future dates are excluded.', 'Release schedule'),
      ],
      'Release Schedule': [
        m('Release Schedule', 'Scheduled chapter records', scheduled.length, 'count', 'Active inventory rows with scheduled status.', 'Chapter inventory'),
        m('Release Schedule', 'Releases due in next 7 days', futureReleases7, 'count', 'Scheduled rows whose release date falls in the next 7 days.', 'Release schedule'),
        m('Release Schedule', 'Releases due in next 30 days', futureReleases30, 'count', 'Scheduled rows whose release date falls in the next 30 days.', 'Release schedule'),
        m('Release Schedule', 'Next release date', nextRelease, 'date', 'Earliest scheduled release date, including overdue records.', 'Release schedule'),
        m('Release Schedule', 'Scheduled rows without dates', scheduled.filter(row => !dateOf(row.release_date || row.releaseDate)).length, 'count', 'Scheduled rows whose release date is missing or invalid.', 'Chapter inventory'),
        m('Release Schedule', 'Overdue scheduled records', scheduled.filter(row => { const d = dateOf(row.release_date || row.releaseDate); return d && d < new Date(); }).length, 'count', 'Scheduled rows with a release date in the past.', 'Release schedule'),
        m('Release Schedule', 'Published chapters with a release date', published.filter(row => Boolean(dateOf(row.release_date || row.releaseDate))).length, 'count', 'Published rows with a parseable release date.', 'Chapter inventory'),
        m('Release Schedule', 'Published chapters without a release date', published.filter(row => !dateOf(row.release_date || row.releaseDate)).length, 'count', 'Published rows without a parseable release date.', 'Chapter inventory'),
        m('Release Schedule', 'Newest published release', lastRelease, 'date', 'Newest parseable release/creation date among published chapters.', 'Chapter inventory'),
        m('Release Schedule', 'Days since newest published release', lastRelease ? Math.max(0, (Date.now() - lastRelease.getTime()) / 86400000) : null, 'days', 'Age of the newest published release/creation date.', 'Derived'),
        m('Release Schedule', 'Scheduled releases inside selected window', upcoming.filter(row => { const d = daysRelease(row.release_date || row.releaseDate); return d != null && d <= selectedDays; }).length, 'count', 'Future scheduled releases inside the selected number of days.', 'Release schedule'),
        m('Release Schedule', 'Drafts not yet scheduled', drafts.filter(row => !dateOf(row.release_date || row.releaseDate)).length, 'count', 'Draft records without a release date.', 'Chapter inventory'),
      ],
    });
    return make();
  }, [bundle, chapters, comments, reports, pageCounts, announcements, media, days, loadDuration]);

  const metricCategories = Object.keys(metricGroups);
  const allMetrics = Object.values(metricGroups).flat();
  const categoryForSection = {
    'Traffic & Reach': ['Traffic & Reach'],
    'Content Intelligence': ['Content Intelligence', 'Content Quality', 'Release Schedule'],
    'Audience': ['Audience'],
    'Engagement': ['Engagement'],
    'Ratings': ['Ratings'],
    'Community': ['Community'],
    'Membership & Revenue': ['Membership & Revenue'],
    'Notifications': ['Notifications'],
    'Audit & Reliability': ['Audit & Reliability'],
    'Metric Explorer': metricCategories,
  };
  const scopedMetrics = section === 'Metric Explorer' ? allMetrics : (categoryForSection[section] || []).flatMap(category => metricGroups[category] || []);
  const visibleMetrics = scopedMetrics.filter(item => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || [item.label, item.description, item.source, item.category].some(text => String(text || '').toLowerCase().includes(q));
    const tracked = item.value !== null && item.value !== undefined;
    return matchSearch && (metricFilter === 'all' || (metricFilter === 'tracked' ? tracked : !tracked));
  }).sort((a, b) => {
    if (metricSort === 'largest') {
      const aValue = a.value == null || !Number.isFinite(Number(a.value)) ? null : Number(a.value);
      const bValue = b.value == null || !Number.isFinite(Number(b.value)) ? null : Number(b.value);
      if (aValue == null && bValue != null) return 1;
      if (aValue != null && bValue == null) return -1;
      if (aValue == null && bValue == null) return a.label.localeCompare(b.label);
      return bValue - aValue || a.label.localeCompare(b.label);
    }
    if (metricSort === 'name') return a.label.localeCompare(b.label);
    return a.category.localeCompare(b.category) || a.label.localeCompare(b.label);
  });
  const statusCount = sourceErrors.length;
  const comparison = [
    { label: 'Views', current: currentViews, previous: previousViews },
    { label: 'Likes', current: currentLikes, previous: previousLikes },
    { label: 'Shares', current: currentShares, previous: previousShares },
    { label: 'Comments', current: currentComments, previous: previousComments },
    { label: 'Ratings', current: currentRatings, previous: previousRatings },
  ].filter(row => row.current != null && row.previous != null);
  const comparisonMax = Math.max(1, ...comparison.flatMap(row => [NUMBER(row.current), NUMBER(row.previous)]));
  const chapterRankings = [...chapterStats].sort((a, b) => chapterRank === 'likes' ? b.period_likes - a.period_likes : chapterRank === 'shares' ? b.period_shares - a.period_shares : chapterRank === 'rating' ? b.rating_average - a.rating_average : b.period_views - a.period_views).slice(0, 10);
  const filteredChapters = rows.filter(row => chapterStatus === 'all' || String(row.status || '').toLowerCase() === chapterStatus);
  const recentAudit = hasAuditRows ? adminLogs.slice(0, 8) : [];
  const recentNotificationLogs = hasNotificationRows ? notificationLogs.slice(0, 6) : [];
  const recentReports = (hasCommentReportRows ? [...commentReportRows] : []).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 6);
  const sourceChecks = dataSources;

  const csvCell = value => {
    const textValue = String(value ?? '');
    // Prevent spreadsheet formula execution when exported fields contain user-controlled text.
    const safeValue = /^[=+@\t\r]/.test(textValue) || /^-/.test(textValue) ? "'" + textValue : textValue;
    return '"' + safeValue.replace(/"/g, '""') + '"';
  };
  const exportMetricRows = (items, filename) => {
    const rows = [['category', 'metric', 'value', 'unit', 'description', 'source']];
    for (const item of items) rows.push([
      item.category, item.label,
      item.value == null ? '' : item.value,
      item.unit, item.description, item.source,
    ]);
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    downloadFile(filename, 'text/csv;charset=utf-8', csv);
  };
  const exportMetrics = () => exportMetricRows(allMetrics, 'atma-rekha-control-room-metrics.csv');
  const exportVisibleMetrics = () => exportMetricRows(visibleMetrics, 'atma-rekha-control-room-visible-metrics.csv');
  const exportSnapshot = () => {
    const snapshot = {
      generated_at: new Date().toISOString(),
      period_days: days,
      metric_count: allMetrics.length,
      metrics: allMetrics,
      data_sources: sourceChecks.map(row => ({ name: row.name, available: row.ok, error: row.error || null })),
      summary: { current_views: currentViews, previous_views: previousViews, active_readers: activeReaders, returning_readers: returningReaders, registered_users: registeredUsers, mrr_estimate_inr: mrr },
    };
    downloadFile('atma-rekha-control-room-snapshot.json', 'application/json;charset=utf-8', JSON.stringify(snapshot, null, 2));
  };

  const availableMetricCount = allMetrics.filter(item => item.value !== null && item.value !== undefined).length;
  const periodLabel = WINDOWS.find(row => row.value === days)?.label || (days + ' days');

  return <section className="ar-control-room">
    <header className="ar-cr-hero">
      <div className="ar-cr-hero-copy">
        <span className="ar-cr-kicker">ATMA REKHA / OPERATIONS</span>
        <h2>Control room</h2>
        <p>Analytics, publishing health, audience signals, money movement and operational events in one view.</p>
        <div className="ar-cr-status-line">
          <span className={'ar-cr-status-dot' + (loading || statusCount ? ' is-warning' : ' is-ok')}/>
          <span>{loading ? 'Connecting to data sources…' : statusCount ? statusCount + ' source(s) need attention' : 'All checked sources responded'}</span>
          <i/>
          <span>{lastRefresh ? 'Updated ' + lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Not refreshed yet'}</span>
          <span className="ar-cr-status-detail">{availableMetricCount}/{allMetrics.length} metrics available</span>
        </div>
      </div>
      <div className="ar-cr-hero-actions">
        <label><span>Reporting window</span><select value={days} onChange={event => setDays(Number(event.target.value))}>{WINDOWS.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}</select></label>
        <button type="button" className="ar-cr-btn is-primary" onClick={load} disabled={refreshing}><AdminIcon name="refresh" size={15}/>{refreshing ? 'Refreshing…' : 'Refresh all'}</button>
        <button type="button" className="ar-cr-btn" onClick={exportMetrics}><AdminIcon name="chart" size={15}/>Export CSV</button>
        <button type="button" className="ar-cr-btn" onClick={exportSnapshot}><AdminIcon name="layers" size={15}/>Export JSON</button>
      </div>
    </header>

    <nav className="ar-cr-nav" aria-label="Control room sections">
      {SECTIONS.map(item => <button type="button" key={item.id} className={section === item.id ? 'active' : ''} onClick={() => { setSection(item.id); setSearch(''); }}><AdminIcon name={item.icon} size={16}/><span>{item.label}</span>{item.id === 'Metric Explorer' && <b>{allMetrics.length}</b>}</button>)}
    </nav>

    {sourceErrors.length > 0 && <div className="ar-cr-alert is-warning"><AdminIcon name="flag" size={18}/><div><strong>Partial data coverage</strong><p>{sourceErrors.length} source check(s) failed. Metrics from those sources are marked unavailable; the page did not convert errors into zero counts.</p></div><button type="button" className="ar-cr-link" onClick={() => setSection('Audit & Reliability')}>Review sources</button></div>}
    {!loading && sourceErrors.length === 0 && <div className="ar-cr-alert is-ok"><AdminIcon name="pulse" size={18}/><div><strong>Data connections responding</strong><p>Analytics and operational tables returned results for this refresh. This checks data endpoints, not full public-site uptime.</p></div></div>}

    {section === 'Command Center' && <div className="ar-cr-command">
      <div className="ar-cr-kpis">
        <Metric item={{ label: 'Views · ' + periodLabel, value: currentViews, unit: 'count', description: 'Current selected-period reads.', source: 'Cloudflare / admin analytics' }}/>
        <Metric item={{ label: 'Active readers', value: activeReaders, unit: 'count', description: 'Distinct readers reported by the analytics source.', source: 'Cloudflare / admin analytics' }}/>
        <Metric item={{ label: 'Returning readers', value: returningReaders, unit: 'count', description: 'Readers identified as returning.', source: 'Cloudflare / admin analytics' }}/>
        <Metric item={{ label: 'Open comment reports', value: data.commentReports ? openCommentReports : null, unit: 'count', description: 'Open rows in the loaded moderation-report sample.', source: 'comment_reports' }}/>
        <Metric item={{ label: 'Estimated MRR', value: mrr, unit: 'money', description: 'Current price estimate; not a forecast.', source: 'Membership analytics' }}/>
        <Metric item={{ label: 'Push subscriptions', value: pushSubscriptions, unit: 'count', description: 'Subscriptions reported by the user-stats endpoint.', source: 'Admin user stats' }}/>
        <Metric item={{ label: 'Published chapters', value: published.length, unit: 'count', description: 'Current published, non-archived chapter inventory.', source: 'Chapter inventory' }}/>
        <Metric item={{ label: 'Admin actions · 24h', value: data.adminLogs ? recentAdminLogs.length : null, unit: 'count', description: 'Recent action records in the audit sample.', source: 'admin_activity_log' }}/>
      </div>

      <div className="ar-cr-two-col">
        <Card eyebrow="PERIOD COMPARISON" title="Current vs previous window" aside={<small>{periodLabel} vs previous {periodLabel}</small>}>
          <div className="ar-cr-legend"><span><i className="is-current"/>Current</span><span><i/>Previous</span></div>
          {comparison.length ? comparison.map(row => <MiniBar key={row.label} label={row.label} current={row.current} previous={row.previous} max={comparisonMax}/>) : <Empty>Comparisons are unavailable until the analytics service returns both current and previous values.</Empty>}
        </Card>
        <Card eyebrow="SYSTEM CHECKS" title="Data source health" aside={<button className="ar-cr-text-btn" type="button" onClick={() => setSection('Audit & Reliability')}>Details →</button>}>
          <div className="ar-cr-source-list">{dataSources.map(row => <div key={row.name}><span className={'ar-cr-source-icon ' + (row.ok ? 'ok' : 'bad')}>{row.ok ? '✓' : '!'}</span><div><strong>{row.name}</strong><small>{row.ok ? 'Responded' : row.error || 'No response'}</small></div><b>{row.ok ? 'OK' : 'Issue'}</b></div>)}</div>
        </Card>
      </div>

      <Card eyebrow="TRAFFIC TREND" title="Daily views over time" aside={<small>{periodLabel} vs previous equal-length window · UTC calendar buckets</small>}>
        <DailyTrendChart current={dailyTrendRows} previous={previousDailyTrendRows}/>
      </Card>

      <div className="ar-cr-three-col">
        <Card eyebrow="CONTENT" title="Top chapters" aside={<button className="ar-cr-text-btn" type="button" onClick={() => onTab?.('Chapters')}>Manage →</button>}>
          <div className="ar-cr-field-row"><label>Rank by<select value={chapterRank} onChange={event => setChapterRank(event.target.value)}><option value="views">Period views</option><option value="likes">Period likes</option><option value="shares">Period shares</option><option value="rating">Average rating</option></select></label></div>
          {chapterRankings.length ? <div className="ar-cr-rank-list">{chapterRankings.slice(0, 5).map((row, index) => {
            const metricValue = chapterRank === 'likes' ? row.period_likes : chapterRank === 'shares' ? row.period_shares : chapterRank === 'rating' ? row.rating_average : row.period_views;
            const max = Math.max(1, ...chapterRankings.map(item => chapterRank === 'likes' ? item.period_likes : chapterRank === 'shares' ? item.period_shares : chapterRank === 'rating' ? item.rating_average : item.period_views));
            return <button type="button" key={row.id} onClick={() => onTab?.('Chapters')}><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{row.title || ('Chapter ' + (row.chapter_number ?? '—'))}</strong><i><em style={{ width: Math.max(metricValue ? 3 : 0, NUMBER(metricValue) / max * 100) + '%' }}/></i></span><small>{chapterRank === 'rating' ? (NUMBER(metricValue).toFixed(1) + '/10') : fmtNum(metricValue)}</small></button>;
          })}</div> : <Empty>Chapter analytics are unavailable for this refresh.</Empty>}
        </Card>
        <Card eyebrow="PUBLISHING" title="Content readiness" aside={<button className="ar-cr-text-btn" type="button" onClick={() => onTab?.('Chapters')}>Chapter manager →</button>}>
          <div className="ar-cr-readiness"><strong>{published.length ? Math.round(publishedWithPages.length / published.length * 100) + '%' : '—'}</strong><span>Published chapters with pages</span><i><em style={{ width: (published.length ? publishedWithPages.length / published.length * 100 : 0) + '%' }}/></i></div>
          <div className="ar-cr-breakdown">
            <div><span>Published</span><b>{fmtNum(published.length)}</b></div><div><span>Drafts</span><b>{fmtNum(drafts.length)}</b></div><div><span>Scheduled</span><b>{fmtNum(scheduled.length)}</b></div><div><span>Missing pages</span><b>{fmtNum(publishedWithoutPages.length)}</b></div>
          </div>
          <div className="ar-cr-action-strip"><button type="button" onClick={() => { setSection('Content Intelligence'); setChapterStatus('published'); }}>Published audit</button><button type="button" onClick={() => { setSection('Content Intelligence'); setChapterStatus('scheduled'); }}>Release queue</button></div>
        </Card>
        <Card eyebrow="COMMUNITY" title="Open queues" aside={<button className="ar-cr-text-btn" type="button" onClick={() => onTab?.('Reports')}>Moderate →</button>}>
          <div className="ar-cr-queue-grid"><button onClick={() => onTab?.('Reports')} type="button"><span>Open comment reports</span><strong>{hasCommentReportRows ? fmtNum(openCommentReports) : '—'}</strong></button><button onClick={() => { setSection('Community'); }} type="button"><span>Open moderation reports</span><strong>{hasModerationRows ? fmtNum(openModerationRows.length) : '—'}</strong></button><button onClick={() => setSection('Notifications')} type="button"><span>Failed notification rows</span><strong>{hasNotificationRows ? fmtNum(failedNotifications.length) : '—'}</strong></button><button onClick={() => setSection('Audit & Reliability')} type="button"><span>Failed audit rows</span><strong>{hasAuditRows ? fmtNum(failedAdminLogs.length) : '—'}</strong></button></div>
        </Card>
      </div>

      <div className="ar-cr-two-col">
        <Card eyebrow="RECENT EVENTS" title="Admin audit trail" aside={<button className="ar-cr-text-btn" type="button" onClick={() => setSection('Audit & Reliability')}>Full audit →</button>}>
          {recentAudit.length ? <div className="ar-cr-event-list">{recentAudit.map(row => <article key={row.id}><span className={'ar-cr-event-dot ' + (/fail|error/i.test(row.action || '') ? 'bad' : '')}/><div><strong>{String(row.action || 'Admin action').replace(/[_-]+/g, ' ')}</strong><small>{row.entity_type || 'workspace'}{row.details?.title ? ' · ' + row.details.title : ''}</small></div><time>{fmtDate(row.created_at)}</time></article>)}</div> : <Empty>Audit log is unavailable or has no recent records.</Empty>}
        </Card>
        <Card eyebrow="NOTIFICATIONS" title="Recent delivery records" aside={<button className="ar-cr-text-btn" type="button" onClick={() => setSection('Notifications')}>Delivery health →</button>}>
          {recentNotificationLogs.length ? <div className="ar-cr-event-list">{recentNotificationLogs.map(row => <article key={row.id}><span className={'ar-cr-event-dot ' + (String(row.status).toLowerCase() === 'failed' || NUMBER(row.failed_count) ? 'bad' : '')}/><div><strong>{row.title || 'Notification'}</strong><small>{row.status || 'Unknown status'} · {fmtNum(row.sent_count)} sent · {fmtNum(row.failed_count)} failed</small></div><time>{fmtDate(row.sent_at || row.created_at)}</time></article>)}</div> : <Empty>Notification log is unavailable or empty.</Empty>}
        </Card>
      </div>

      <Card eyebrow="QUICK LAUNCH" title="Go straight to a task">
        <div className="ar-cr-launch-grid">
          {[
            ['Chapters', 'Chapter Manager', 'book'],
            ['Pages', 'Page Editor', 'layers'],
            ['Comments', 'Reader comments', 'message'],
            ['Reports', 'Moderation queue', 'flag'],
            ['Announcements', 'Announcements', 'bell'],
            ['Membership & Earnings', 'Revenue and plans', 'chart'],
            ['Media', 'Media library', 'image'],
          ].map(item => <button type="button" key={item[0]} onClick={() => onTab?.(item[0])}><AdminIcon name={item[2]} size={17}/><span><strong>{item[1]}</strong><small>Open workspace</small></span><AdminIcon name="chevron" size={15}/></button>)}
        </div>
      </Card>
    </div>}

    {section !== 'Command Center' && <div className="ar-cr-explorer">
      <div className="ar-cr-explorer-head"><div><span className="ar-cr-kicker">ANALYTICS WORKSPACE</span><h3>{section}</h3><p>{section === 'Metric Explorer' ? 'Search, filter and export 100+ tracked or explicitly unavailable analytics.' : 'Inspect verified indicators for this operational domain. Click a section in the control-room navigation to switch domains.'}</p></div><div className="ar-cr-explorer-tools"><label><span>Search metrics</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, source or meaning"/></label><label><span>Data coverage</span><select value={metricFilter} onChange={event => setMetricFilter(event.target.value)}><option value="all">All metrics</option><option value="tracked">Tracked only</option><option value="untracked">Not tracked</option></select></label><label><span>Sort</span><select value={metricSort} onChange={event => setMetricSort(event.target.value)}><option value="category">Category</option><option value="name">Name</option><option value="largest">Largest value</option></select></label><button type="button" className="ar-cr-btn" onClick={() => setCollapsedMetrics(value => !value)}>{collapsedMetrics ? 'Expand details' : 'Compact view'}</button></div></div>
      <div className="ar-cr-results-line"><span>{visibleMetrics.length} metrics shown</span><span>{visibleMetrics.filter(item => item.value != null).length} with values · {visibleMetrics.filter(item => item.value == null).length} unavailable/not tracked</span><button type="button" className="ar-cr-text-btn" onClick={exportVisibleMetrics}>Export visible catalogue</button></div>
      {section === 'Metric Explorer' && <div className="ar-cr-category-chips">{metricCategories.map(category => <button key={category} type="button" onClick={() => { setSearch(category); setMetricFilter('all'); }}>{category}<b>{metricGroups[category].length}</b></button>)}</div>}
      <div className={'ar-cr-metric-grid' + (collapsedMetrics ? ' compact' : '')}>
        {visibleMetrics.map((item, index) => <Metric key={item.category + ':' + item.label} item={item} compact={collapsedMetrics}/>)}
      </div>
      {!visibleMetrics.length && <Empty>No metrics match the current search and filters.</Empty>}
      <Card eyebrow="DATA DEFINITIONS" title="How to read these numbers">
        <div className="ar-cr-definition-list">
          <p><strong>Period metrics</strong> use the selected reporting window and the existing analytics function/Cloudflare admin API.</p>
          <p><strong>Derived ratios</strong> are computed only when the denominator is available and non-zero. They are not person-level conversion rates unless explicitly stated.</p>
          <p><strong>Sampled lists</strong> state their row limits. Counts from these lists are not represented as lifetime totals.</p>
          <p><strong>Not tracked</strong> means the current backend does not provide that data. This control room deliberately does not invent device, source, location, age, gender or daily time-series metrics.</p>
        </div>
      </Card>
    </div>}

    {section === 'Content Intelligence' && <Card eyebrow="CHAPTER INVENTORY" title="Inspect chapter records" aside={<button type="button" className="ar-cr-text-btn" onClick={() => onTab?.('Chapters')}>Open manager →</button>}>
      <div className="ar-cr-table-tools"><label>Status<select value={chapterStatus} onChange={event => setChapterStatus(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option></select></label><span>{filteredChapters.length} matching records · loaded inventory</span></div>
      <div className="ar-cr-table-wrap"><table><thead><tr><th>Chapter</th><th>Status</th><th>Language</th><th>Pages</th><th>Lifetime views</th><th>Release</th><th>Content check</th></tr></thead><tbody>{filteredChapters.slice(0, 100).map(row => {
        const stat = chapterStats.find(item => String(item.id) === String(row.id));
        const count = pageCounts[row.id] ?? stat?.pages ?? row.pages_count ?? 0;
        const releaseDate = row.release_date || row.releaseDate;
        const missing = [!String(row.title || '').trim() && 'Title', !String(row.cover_url || row.coverUrl || '').trim() && 'Cover', !String(row.description || '').trim() && 'Description', !Number(count) && 'Pages'].filter(Boolean);
        return <tr key={row.id}><td><strong>{row.title || 'Untitled'}</strong><small>Ch {row.chapter_number ?? row.chapterNumber ?? '—'} · {String(row.id || '').slice(0, 8)}</small></td><td><span className={'ar-cr-pill ' + (String(row.status).toLowerCase() === 'published' ? 'good' : String(row.status).toLowerCase() === 'scheduled' ? 'warn' : '')}>{row.status || 'Unknown'}</span></td><td>{row.language || row.mangaLanguage || '—'}</td><td>{fmtNum(count)}</td><td>{stat ? fmtNum(stat.views) : '—'}</td><td>{fmtDate(releaseDate)}</td><td>{missing.length ? <span className="ar-cr-issue">{missing.join(', ')}</span> : <span className="ar-cr-pill good">Ready</span>}</td></tr>;
      })}</tbody></table></div>
      {filteredChapters.length > 100 && <p className="ar-cr-table-note">Showing first 100 of {filteredChapters.length} matching records. Use Chapter Manager for complete inventory and editing.</p>}
    </Card>}

    {section === 'Community' && <div className="ar-cr-two-col">
      <Card eyebrow="COMMENT MODERATION" title="Recent comment reports">
        {recentReports.length ? <div className="ar-cr-event-list">{recentReports.map(row => <article key={row.id}><span className={'ar-cr-event-dot ' + ((row.status || 'open') === 'open' ? 'warn' : '')}/><div><strong>{row.reason || 'Reported comment'}</strong><small>{row.status || 'open'}</small></div><time>{fmtDate(row.created_at)}</time></article>)}</div> : <Empty>No report rows returned for this sample.</Empty>}
        <button type="button" className="ar-cr-btn" onClick={() => onTab?.('Reports')}>Open moderation queue</button>
      </Card>
      <Card eyebrow="COMMUNITY SAFETY" title="Moderation reports">
        {hasModerationRows && moderationRows.length ? <div className="ar-cr-event-list">{moderationRows.slice(0, 8).map(row => <article key={row.id}><span className={'ar-cr-event-dot ' + (String(row.status).toLowerCase() === 'open' ? 'warn' : '')}/><div><strong>{row.reason || 'Community report'}</strong><small>{row.source_type || 'Community content'} · {row.status || 'open'}{row.offense_count ? ' · ' + row.offense_count + ' offenses' : ''}</small></div><time>{fmtDate(row.created_at)}</time></article>)}</div> : <Empty>Moderation reports were empty or unavailable.</Empty>}
        <button type="button" className="ar-cr-btn" onClick={() => window.dispatchEvent(new CustomEvent('atma-admin-open-moderation'))}>Open community moderation tools</button>
      </Card>
    </div>}

    {section === 'Membership & Revenue' && <div className="ar-cr-revenue-grid">
      <Card eyebrow="REVENUE MODEL" title="Plan performance">
        {plans.length ? <div className="ar-cr-table-wrap"><table><thead><tr><th>Plan</th><th>Price</th><th>Access</th><th>Billable</th><th>Pending</th><th>At risk</th></tr></thead><tbody>{plans.map(plan => <tr key={plan.id || plan.plan_id || plan.name}><td><strong>{plan.name || plan.title || plan.plan_id || 'Plan'}</strong></td><td>{fmtMoney(plan.amount_inr)}</td><td>{fmtNum(plan.access_members)}</td><td>{fmtNum(plan.active_billable)}</td><td>{fmtNum(plan.pending)}</td><td>{fmtNum(plan.cancelling)}</td></tr>)}</tbody></table></div> : <Empty>Plan analytics are unavailable or no plan records were returned.</Empty>}
      </Card>
      <Card eyebrow="BILLING HISTORY" title="Monthly trend as supplied by membership analytics">
        {membershipTrend.length ? <div className="ar-cr-month-bars">{membershipTrend.slice(-12).map(row => {
          const charges = NUMBER(row.charges_inr);
          const subscriptions = NUMBER(row.new_subscriptions);
          const cancellations = NUMBER(row.cancellations);
          const max = Math.max(1, ...membershipTrend.map(item => NUMBER(item.charges_inr)));
          return <div key={row.month_start || row.month}><div className="ar-cr-month-track" title={fmtMoney(charges)}><i style={{ height: Math.max(charges ? 3 : 0, charges / max * 100) + '%' }}/></div><strong>{fmtMoney(charges)}</strong><span>{row.month || row.month_start}</span><small>{subscriptions} new · {cancellations} cancelled</small></div>;
        })}</div> : <Empty>No membership trend series was returned.</Empty>}
        <button type="button" className="ar-cr-btn" onClick={() => onTab?.('Membership & Earnings')}>Open full membership workspace</button>
      </Card>
    </div>}

    {section === 'Notifications' && <Card eyebrow="DELIVERY OPERATIONS" title="Notification delivery records" aside={<button type="button" className="ar-cr-text-btn" onClick={() => window.dispatchEvent(new CustomEvent('atma-admin-open-operations'))}>Open notification tools →</button>}>
      {hasNotificationRows && notificationLogs.length ? <div className="ar-cr-table-wrap"><table><thead><tr><th>Notification</th><th>Target</th><th>Attempts</th><th>Sent</th><th>Failed</th><th>Status</th><th>Timestamp</th></tr></thead><tbody>{notificationLogs.slice(0, 100).map(row => <tr key={row.id}><td><strong>{row.title || 'Untitled notification'}</strong><small>{String(row.id || '').slice(0, 8)}</small></td><td>{row.target || '—'}</td><td>{row.target_count == null ? '—' : fmtNum(row.target_count)}</td><td>{row.sent_count == null ? '—' : fmtNum(row.sent_count)}</td><td>{row.failed_count == null ? '—' : fmtNum(row.failed_count)}</td><td><span className={'ar-cr-pill ' + (String(row.status).toLowerCase() === 'sent' ? 'good' : String(row.status).toLowerCase() === 'failed' ? 'bad' : 'warn')}>{row.status || 'unknown'}</span>{row.error && <small>{String(row.error).slice(0, 110)}</small>}</td><td>{fmtDate(row.sent_at || row.created_at)}</td></tr>)}</tbody></table></div> : <Empty>Notification log was empty or unavailable.</Empty>}
    </Card>}

    {section === 'Audit & Reliability' && <div className="ar-cr-audit">
      <Card eyebrow="SOURCE DIAGNOSTICS" title="Data service checks"><div className="ar-cr-source-list expanded">{sourceChecks.map(row => <div key={row.name}><span className={'ar-cr-source-icon ' + (row.ok ? 'ok' : 'bad')}>{row.ok ? '✓' : '!'}</span><div><strong>{row.name}</strong><small>{row.ok ? 'Returned a response' : row.error || 'Unavailable'}</small></div><b>{statusLabel(row.ok)}</b></div>)}</div></Card>
      <Card eyebrow="AUDIT TRAIL" title="Recent actions"><div className="ar-cr-table-wrap"><table><thead><tr><th>Action</th><th>Entity</th><th>Entity ID</th><th>Timestamp</th><th>Result signal</th></tr></thead><tbody>{(hasAuditRows ? adminLogs : []).slice(0, 100).map(row => <tr key={row.id}><td><strong>{String(row.action || 'Admin action').replace(/[_-]+/g, ' ')}</strong></td><td>{row.entity_type || '—'}</td><td>{String(row.entity_id || '—').slice(0, 10)}</td><td>{fmtDate(row.created_at)}</td><td><span className={'ar-cr-pill ' + (/fail|error/i.test(row.action || '') || row.details?.error ? 'bad' : 'good')}>{/fail|error/i.test(row.action || '') || row.details?.error ? 'Failure signal' : 'Recorded'}</span></td></tr>)}</tbody></table></div></Card>
    </div>}

    {section === 'Metric Explorer' && <Card eyebrow="CATALOGUE" title="Metric coverage by domain">
      <div className="ar-cr-category-summary">{metricCategories.map(category => {
        const items = metricGroups[category] || [];
        const count = items.filter(item => item.value != null).length;
        return <button type="button" key={category} onClick={() => { setSearch(category); setMetricFilter('all'); }}><span>{category}</span><strong>{count}/{items.length}</strong><i><em style={{ width: (items.length ? count / items.length * 100 : 0) + '%' }}/></i></button>;
      })}</div>
    </Card>}
  </section>;
}
