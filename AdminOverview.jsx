import { useEffect, useMemo, useState } from 'react';
import { getCurrentlySubscribedUserIds } from './supabase';
import SubscriberBadge from './SubscriberBadge.jsx';

const WINDOWS = { '7': 7, '30': 30, '90': 90, all: null };
const inWindow = (value, days, offset = 0) => {
  if (days == null) return true;
  const time = new Date(value || 0).getTime();
  if (!Number.isFinite(time)) return false;
  const end = Date.now() - offset * days * 86400000;
  return time >= end - days * 86400000 && time < end;
};
const pct = (current, previous) => !previous ? (current ? 100 : 0) : ((current - previous) / previous) * 100;
const formatNumber = value => Number(value || 0).toLocaleString('en-IN');
const compactNumber = value => { const n = Number(value || 0); if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`; if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`; return formatNumber(n); };

function Delta({ value }) { if (!Number.isFinite(value)) return null; const positive = value >= 0; return <span className={`admin-overview-delta ${positive ? 'positive' : 'negative'}`}>{positive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%</span>; }
function StatCard({ label, value, delta, note, accent }) { return <article className={`admin-overview-stat ${accent ? 'accent' : ''}`}><span className="admin-overview-stat-label">{label}</span><strong>{value}</strong>{delta != null ? <Delta value={delta}/> : <small>{note || 'All time'}</small>}</article>; }

export default function AdminOverview({ chapters, comments, ratings, views, likes, pageCounts, onTab, chapterName }) {
  const [windowKey, setWindowKey] = useState('30');
  const [subscribedUserIds, setSubscribedUserIds] = useState(new Set());
  const days = WINDOWS[windowKey];
  useEffect(() => { let active = true; const ids = [...new Set((comments || []).map(comment => comment.user_id).filter(Boolean))]; if (!ids.length) { setSubscribedUserIds(new Set()); return () => { active = false; }; } getCurrentlySubscribedUserIds(ids).then(idsSet => { if (active) setSubscribedUserIds(idsSet); }).catch(error => { console.warn('Admin subscriber status lookup failed:', error); if (active) setSubscribedUserIds(new Set()); }); return () => { active = false; }; }, [comments]);
  const metrics = useMemo(() => {
    const current = rows => rows.filter(row => inWindow(row.created_at, days));
    const previous = rows => rows.filter(row => inWindow(row.created_at, days, 1));
    const curViews = current(views), prevViews = previous(views), curLikes = current(likes), prevLikes = previous(likes), curRatings = current(ratings), prevRatings = previous(ratings), curComments = current(comments), prevComments = previous(comments);
    const totalRatings = ratings.length;
    const totalAverage = totalRatings ? ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / totalRatings : 0;
    const currentAverage = curRatings.length ? curRatings.reduce((s, r) => s + Number(r.rating || 0), 0) / curRatings.length : 0;
    const previousAverage = prevRatings.length ? prevRatings.reduce((s, r) => s + Number(r.rating || 0), 0) / prevRatings.length : 0;
    const published = chapters.filter(c => String(c.status).toLowerCase() === 'published');
    const released = days == null ? published.length : published.filter(c => inWindow(c.releaseDate, days)).length;
    const ratingCounts = Array.from({ length: 10 }, (_, i) => { const rating = 10 - i; return { rating, count: ratings.filter(row => Number(row.rating) === rating).length }; });
    const chapterStats = published.map(chapter => {
      const chapterViews = views.filter(row => row.chapter_id === chapter.id), chapterLikes = likes.filter(row => row.chapter_id === chapter.id), chapterRatings = ratings.filter(row => row.chapter_id === chapter.id);
      return { ...chapter, views: chapterViews.length, periodViews: curViews.filter(row => row.chapter_id === chapter.id).length, likes: chapterLikes.length, periodLikes: curLikes.filter(row => row.chapter_id === chapter.id).length, ratings: chapterRatings, pages: pageCounts[chapter.id] || 0 };
    }).sort((a, b) => b.views - a.views);
    return { totalViews: views.length, totalLikes: likes.length, totalRatings, totalComments: comments.length, totalAverage, viewsDelta: pct(curViews.length, prevViews.length), likesDelta: pct(curLikes.length, prevLikes.length), commentsDelta: pct(curComments.length, prevComments.length), averageDelta: currentAverage && previousAverage ? currentAverage - previousAverage : null, released, ratingCounts, chapterStats, currentViews: curViews.length, currentLikes: curLikes.length, recentComments: [...comments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5) };
  }, [chapters, comments, ratings, views, likes, pageCounts, days]);
  const maxRatingCount = Math.max(...metrics.ratingCounts.map(item => item.count), 1);
  const periodLabel = days == null ? 'All time' : `Last ${days} days`;

  return <section className="admin-overview">
    <div className="admin-overview-toolbar"><div><span className="admin-overview-kicker">ATMA REKHA · ANALYTICS</span><h2>Dashboard</h2><p>Welcome back, Admin 👋</p></div><label className="admin-period-control"><span>ANALYTICS PERIOD</span><select value={windowKey} onChange={e => setWindowKey(e.target.value)} aria-label="Analytics time range"><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="all">All Time</option></select></label></div>
    <div className="admin-overview-stats"><StatCard label="Total Chapters" value={chapters.length} note={`${metrics.released} released in ${periodLabel.toLowerCase()}`} accent/><StatCard label="Total Views" value={compactNumber(metrics.totalViews)} delta={metrics.viewsDelta}/><StatCard label="Total Likes" value={compactNumber(metrics.totalLikes)} delta={metrics.likesDelta}/><StatCard label="Avg Rating" value={metrics.totalAverage ? `${metrics.totalAverage.toFixed(2)} / 10` : '—'} note={metrics.averageDelta == null ? `${formatNumber(metrics.totalRatings)} ratings` : `${metrics.averageDelta >= 0 ? '+' : ''}${metrics.averageDelta.toFixed(2)} vs previous`}/><StatCard label="Total Comments" value={compactNumber(metrics.totalComments)} delta={metrics.commentsDelta}/></div>
    <div className="admin-overview-period-summary"><span><b>{periodLabel}</b> activity</span><span>👁 {formatNumber(metrics.currentViews)} views</span><span>♥ {formatNumber(metrics.currentLikes)} likes</span><span>★ {formatNumber(metrics.totalRatings)} ratings</span><span>💬 {formatNumber(metrics.totalComments)} comments</span></div>
    <div className="admin-overview-grid">
      <section className="admin-overview-card comments-card"><div className="admin-overview-card-head"><div><span>COMMUNITY</span><h3>Recent Comments</h3></div><button type="button" onClick={() => onTab('Comments')}>View all →</button></div><div className="admin-overview-comments">{metrics.recentComments.map(comment => <article key={comment.id}><div className="admin-overview-avatar">{(comment.author_name || 'R').slice(0, 1).toUpperCase()}</div><div><div className="admin-overview-comment-top"><strong>{comment.author_name || 'Reader'}<SubscriberBadge show={subscribedUserIds.has(comment.user_id)}/></strong><time>{new Date(comment.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time></div><p>{comment.content}</p><small>{chapterName(comment.chapter_id)}</small><button type="button" className="admin-comment-open" onClick={() => onTab('Comments')}>Open comment →</button></div></article>)}{!metrics.recentComments.length && <p className="admin-overview-empty">No comments yet.</p>}</div></section>
      <section className="admin-overview-card rating-card"><div className="admin-overview-card-head"><div><span>RATING OVERVIEW</span><h3>{metrics.totalAverage ? metrics.totalAverage.toFixed(2) : '—'} <em>/10</em></h3></div><span className="admin-card-count">{formatNumber(metrics.totalRatings)} ratings</span></div><div className="admin-overview-stars">★★★★★ <span>Overall rating · {periodLabel}</span></div><div className="admin-rating-bars">{metrics.ratingCounts.map(item => <div key={item.rating}><b>{item.rating} ★</b><i><span style={{ width: `${(item.count / maxRatingCount) * 100}%` }}/></i><small>{metrics.totalRatings ? Math.round((item.count / metrics.totalRatings) * 100) : 0}%</small></div>)}</div></section>
      <section className="admin-overview-card top-chapters-card"><div className="admin-overview-card-head"><div><span>TOP CHAPTERS · BY VIEWS</span><h3>Best performing</h3></div><button type="button" onClick={() => onTab('Chapters')}>View all →</button></div><div className="admin-top-chapters">{metrics.chapterStats.slice(0, 5).map((chapter, index) => { const avg = chapter.ratings.length ? chapter.ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / chapter.ratings.length : 0; return <button type="button" key={chapter.id} onClick={() => onTab('Chapters')}><b>{index + 1}.</b><div><strong>Chapter {chapter.chapterNumber} — {chapter.title}</strong><span>{formatNumber(chapter.views)} views · ♥ {formatNumber(chapter.likes)} · ★ {avg ? avg.toFixed(1) : '—'}</span></div><i>›</i></button>; })}{!metrics.chapterStats.length && <p className="admin-overview-empty">No published chapters yet.</p>}</div></section>
    </div>
    <section className="admin-overview-card performance-card"><div className="admin-overview-card-head"><div><span>PERFORMANCE</span><h3>Chapter performance</h3></div><span className="admin-overview-period">{periodLabel}</span></div><div className="admin-performance-mobile">{metrics.chapterStats.map(chapter => { const avg = chapter.ratings.length ? chapter.ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / chapter.ratings.length : 0; return <button type="button" key={chapter.id} onClick={() => onTab('Chapters')}><strong>Chapter {chapter.chapterNumber}</strong><span>{chapter.title}</span><b>★ {avg ? avg.toFixed(1) : '—'} · 👁 {formatNumber(chapter.views)} · ♥ {formatNumber(chapter.likes)} · 📄 {formatNumber(chapter.pages)}</b>{days != null && <small>{formatNumber(chapter.periodViews)} views · {formatNumber(chapter.periodLikes)} likes in period</small>}</button>; })}{!metrics.chapterStats.length && <p className="admin-overview-empty">No published chapters yet.</p>}</div></section>
  </section>;
}
