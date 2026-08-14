import { useMemo, useState } from 'react';

const WINDOWS = { '7': 7, '30': 30, '90': 90, all: null };

function since(days, offset = 0) {
  if (days == null) return null;
  const end = Date.now() - offset * days * 86400000;
  return end - days * 86400000;
}

function inWindow(value, days, offset = 0) {
  if (days == null) return true;
  const time = new Date(value || 0).getTime();
  if (!Number.isFinite(time)) return false;
  const end = Date.now() - offset * days * 86400000;
  const start = end - days * 86400000;
  return time >= start && time < end;
}

function pct(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function Delta({ value, suffix = '' }) {
  if (!Number.isFinite(value)) return null;
  const positive = value >= 0;
  return <span className={`admin-overview-delta ${positive ? 'positive' : 'negative'}`}>{positive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%{suffix}</span>;
}

function StatCard({ label, value, delta, note, accent }) {
  return <article className={`admin-overview-stat ${accent ? 'accent' : ''}`}>
    <span className="admin-overview-stat-label">{label}</span>
    <strong>{value}</strong>
    {delta != null ? <Delta value={delta}/> : <small>{note || 'All time'}</small>}
  </article>;
}

export default function AdminOverview({ chapters, comments, reports, ratings, views, likes, pageCounts, onTab, chapterName }) {
  const [windowKey, setWindowKey] = useState('30');
  const days = WINDOWS[windowKey];

  const metrics = useMemo(() => {
    const current = rows => rows.filter(row => inWindow(row.created_at, days));
    const previous = rows => rows.filter(row => inWindow(row.created_at, days, 1));
    const curViews = current(views), prevViews = previous(views);
    const curLikes = current(likes), prevLikes = previous(likes);
    const curRatings = current(ratings), prevRatings = previous(ratings);
    const curComments = current(comments), prevComments = previous(comments);
    const currentAvg = curRatings.length ? curRatings.reduce((s, r) => s + Number(r.rating || 0), 0) / curRatings.length : 0;
    const previousAvg = prevRatings.length ? prevRatings.reduce((s, r) => s + Number(r.rating || 0), 0) / prevRatings.length : 0;
    const published = chapters.filter(c => String(c.status).toLowerCase() === 'published');
    const released = days == null ? published.length : published.filter(c => inWindow(c.releaseDate, days)).length;
    const ratingCounts = Array.from({ length: 10 }, (_, i) => {
      const rating = 10 - i;
      return { rating, count: curRatings.filter(row => Number(row.rating) === rating).length };
    });
    const chapterStats = published.map(chapter => ({
      ...chapter,
      views: curViews.filter(row => row.chapter_id === chapter.id).length,
      likes: curLikes.filter(row => row.chapter_id === chapter.id).length,
      ratings: curRatings.filter(row => row.chapter_id === chapter.id),
      pages: pageCounts[chapter.id] || 0,
    })).sort((a, b) => b.views - a.views);
    return {
      views: curViews.length, viewsDelta: pct(curViews.length, prevViews.length),
      likes: curLikes.length, likesDelta: pct(curLikes.length, prevLikes.length),
      ratings: curRatings.length, ratingDelta: pct(curRatings.length, prevRatings.length),
      comments: curComments.length, commentsDelta: pct(curComments.length, prevComments.length),
      average: currentAvg, averageDelta: currentAvg && previousAvg ? currentAvg - previousAvg : null,
      released, ratingCounts, chapterStats,
      recentComments: [...comments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    };
  }, [chapters, comments, ratings, views, likes, pageCounts, days]);

  const maxRatingCount = Math.max(...metrics.ratingCounts.map(item => item.count), 1);
  const periodLabel = days == null ? 'All time' : `Last ${days} days`;

  return <section className="admin-overview">
    <div className="admin-overview-toolbar">
      <div><span className="admin-overview-kicker">ATMA REKHA · ANALYTICS</span><h2>Dashboard</h2><p>Welcome back, Admin 👋</p></div>
      <select value={windowKey} onChange={e => setWindowKey(e.target.value)} aria-label="Analytics time range">
        <option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="all">All Time</option>
      </select>
    </div>

    <div className="admin-overview-stats">
      <StatCard label="Total Chapters" value={chapters.length} note={`${metrics.released} released in period`} accent/>
      <StatCard label="Total Views" value={metrics.views.toLocaleString('en-IN')} delta={metrics.viewsDelta}/>
      <StatCard label="Total Likes" value={metrics.likes.toLocaleString('en-IN')} delta={metrics.likesDelta}/>
      <StatCard label="Avg Rating" value={metrics.average ? `${metrics.average.toFixed(2)} / 10` : '—'} note={metrics.averageDelta == null ? 'No comparison yet' : `${metrics.averageDelta >= 0 ? '+' : ''}${metrics.averageDelta.toFixed(2)} vs previous`}/>
      <StatCard label="Total Comments" value={metrics.comments.toLocaleString('en-IN')} delta={metrics.commentsDelta}/>
    </div>

    <div className="admin-overview-grid">
      <section className="admin-overview-card comments-card">
        <div className="admin-overview-card-head"><div><span>COMMUNITY</span><h3>Recent Comments</h3></div><button onClick={() => onTab('Comments')}>View all →</button></div>
        <div className="admin-overview-comments">
          {metrics.recentComments.map(comment => <article key={comment.id}>
            <div className="admin-overview-avatar">{(comment.author_name || 'R').slice(0, 1).toUpperCase()}</div>
            <div><div className="admin-overview-comment-top"><strong>{comment.author_name || 'Reader'}</strong><time>{new Date(comment.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time></div><p>{comment.content}</p><small>{chapterName(comment.chapter_id)}</small><div className="admin-overview-comment-actions"><button onClick={() => onTab('Comments')}>Reply</button><button onClick={() => onTab('Comments')}>Like</button></div></div>
          </article>)}
          {!metrics.recentComments.length && <p className="admin-overview-empty">No comments yet.</p>}
        </div>
      </section>

      <section className="admin-overview-card rating-card">
        <div className="admin-overview-card-head"><div><span>RATING OVERVIEW</span><h3>{metrics.average ? metrics.average.toFixed(2) : '—'} <em>/10</em></h3></div><button onClick={() => onTab('Overview')}>View all →</button></div>
        <div className="admin-overview-stars">★★★★★ <span>Based on {metrics.ratings} ratings · {periodLabel}</span></div>
        <div className="admin-rating-bars">{metrics.ratingCounts.map(item => <div key={item.rating}><b>{item.rating} ★</b><i><span style={{ width: `${(item.count / maxRatingCount) * 100}%` }}/></i><small>{metrics.ratings ? Math.round((item.count / metrics.ratings) * 100) : 0}%</small></div>)}</div>
      </section>

      <section className="admin-overview-card top-chapters-card">
        <div className="admin-overview-card-head"><div><span>TOP CHAPTERS · BY VIEWS</span><h3>Best performing</h3></div><button onClick={() => onTab('Chapters')}>View all →</button></div>
        <div className="admin-top-chapters">{metrics.chapterStats.slice(0, 5).map((chapter, index) => {
          const avg = chapter.ratings.length ? chapter.ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / chapter.ratings.length : 0;
          return <button key={chapter.id} onClick={() => onTab('Chapters')}><b>{index + 1}.</b><div><strong>Chapter {chapter.chapterNumber} — {chapter.title}</strong><span>{chapter.views.toLocaleString('en-IN')} views · ♥ {chapter.likes} · ★ {avg ? avg.toFixed(1) : '—'}</span></div><i>›</i></button>;
        })}{!metrics.chapterStats.length && <p className="admin-overview-empty">No published chapters yet.</p>}</div>
      </section>
    </div>

    <section className="admin-overview-card performance-card">
      <div className="admin-overview-card-head"><div><span>PERFORMANCE</span><h3>Chapter performance</h3></div><span className="admin-overview-period">{periodLabel}</span></div>
      <div className="admin-performance-mobile">{metrics.chapterStats.map(chapter => { const avg = chapter.ratings.length ? chapter.ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / chapter.ratings.length : 0; return <div key={chapter.id}><strong>Chapter {chapter.chapterNumber}</strong><span>{chapter.title}</span><b>★ {avg ? avg.toFixed(1) : '—'} · 👁 {chapter.views} · ♥ {chapter.likes} · 📄 {chapter.pages}</b></div>; })}</div>
    </section>
  </section>;
}
