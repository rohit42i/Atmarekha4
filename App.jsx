import { useEffect, useMemo, useState } from 'react';
import { buildChapters, buildChapterPages } from './chapters';
import AdminLogin from './AdminLogin';
import AdminPanel from './AdminPanel';
import Footer from './Footer';
import { supabase } from './supabase';
import {
  addComment,
  buildRatingSummary,
  fetchChapterComments,
  fetchChapterEngagement,
  fetchPublicEngagement,
  getViewerKey,
  likeChapter,
  likeComment,
  recordChapterView,
  reportComment,
  submitRating,
} from './engagement';

const SITE_STORY = {
  title: 'Atma Rekha',
  eyebrow: 'INDIAN MANGA',
  description: 'Atma Rekha is a mythical fantasy manga created within Indian culture and history.',
};

function isPublished(chapter) {
  return String(chapter?.status || '').trim().toLowerCase() === 'published';
}

function LoadingState({ label = 'Loading...' }) {
  return <div className="loading-state"><span className="loading-spinner"/><p>{label}</p></div>;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCount(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', { notation: number > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(number);
}

function StarRating({ value = 0, onRate, disabled = false, compact = false }) {
  const current = Math.round(Number(value) || 0);
  return <div className={`star-rating ${compact ? 'star-rating-compact' : ''}`} aria-label={onRate ? 'Rate from 1 to 10' : `${value ? Number(value).toFixed(1) : '0.0'} out of 10`}>
    {Array.from({ length: 10 }, (_, index) => {
      const rating = index + 1;
      const active = rating <= current;
      return <button
        key={rating}
        type="button"
        disabled={disabled || !onRate}
        onClick={() => onRate?.(rating)}
        className={`star-button ${active ? 'is-active' : ''}`}
        aria-label={`Rate ${rating} out of 10`}
      >★</button>;
    })}
  </div>;
}

function EmptyState({ title, text }) {
  return <div className="empty-state"><h3>{title}</h3>{text && <p>{text}</p>}</div>;
}

function CommentsPanel({ chapterId, open, onClose, initialCount = 0 }) {
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState({});
  const [reports, setReports] = useState({});
  const [name, setName] = useState(() => window.localStorage.getItem('atma-rekha-comment-name') || 'Reader');
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadComments = async () => {
    setLoading(true); setError('');
    try {
      const data = await fetchChapterComments(chapterId);
      setComments(data);
      if (data.length) {
        const result = await supabase.from('comment_likes').select('comment_id, viewer_key').in('comment_id', data.map(item => item.id));
        if (result.error) throw result.error;
        const countMap = {};
        const viewerKey = getViewerKey();
        const likedMap = {};
        for (const row of result.data || []) {
          countMap[row.comment_id] = (countMap[row.comment_id] || 0) + 1;
          if (row.viewer_key === viewerKey) likedMap[row.comment_id] = true;
        }
        setLikes({ ...countMap, ...Object.fromEntries(Object.keys(likedMap).map(id => [`liked:${id}`, true])) });
      }
    } catch (err) { setError(err?.message || 'Unable to load comments.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) loadComments(); }, [open, chapterId]);

  const topLevel = useMemo(() => comments.filter(comment => !comment.parent_comment_id), [comments]);
  const replies = useMemo(() => comments.filter(comment => comment.parent_comment_id), [comments]);

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const cleanName = name.trim() || 'Reader';
      window.localStorage.setItem('atma-rekha-comment-name', cleanName);
      const row = await addComment({ chapterId, content, authorName: cleanName, parentCommentId: replyTo });
      setComments(prev => [...prev, row]);
      setContent(''); setReplyTo(null);
    } catch (err) { setError(err?.message || 'Unable to post comment.'); }
    finally { setBusy(false); }
  };

  const doLike = async id => {
    if (likes[`liked:${id}`]) return;
    try {
      await likeComment(id);
      setLikes(prev => ({ ...prev, [id]: (prev[id] || 0) + 1, [`liked:${id}`]: true }));
    } catch (err) { setError(err?.message || 'Unable to like comment.'); }
  };

  const doReport = async id => {
    if (reports[id]) return;
    try {
      await reportComment(id);
      setReports(prev => ({ ...prev, [id]: true }));
    } catch (err) { setError(err?.message || 'Unable to report comment.'); }
  };

  if (!open) return null;

  return <div className="comment-sheet-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="comment-sheet" role="dialog" aria-modal="true" aria-label="Comments">
      <div className="comment-sheet-head">
        <div><p className="section-eyebrow">CHAPTER COMMENTS</p><h2>Comments <span>{comments.length || initialCount}</span></h2></div>
        <button className="icon-button" onClick={onClose} aria-label="Close comments">×</button>
      </div>

      <div className="comment-list">
        {loading ? <LoadingState label="Loading comments..."/> : error && !comments.length ? <EmptyState title="Comments unavailable" text={error}/> : !topLevel.length ? <EmptyState title="Be the first to comment" text="Share your thoughts about this chapter."/> : topLevel.map(comment => <CommentItem
          key={comment.id}
          comment={comment}
          replies={replies.filter(reply => reply.parent_comment_id === comment.id)}
          likeCount={likes[comment.id] || 0}
          liked={Boolean(likes[`liked:${comment.id}`])}
          reported={Boolean(reports[comment.id])}
          onLike={doLike}
          onReply={setReplyTo}
          onReport={doReport}
          likes={likes}
          reports={reports}
          onReplyLike={doLike}
          onReplyReport={doReport}
        />)}
      </div>

      {error && <p className="form-error">{error}</p>}
      <form className="comment-form" onSubmit={submit}>
        <div className="comment-form-title">{replyTo ? <><span>Replying to a reader</span><button type="button" onClick={() => setReplyTo(null)}>Cancel</button></> : <span>Join the conversation</span>}</div>
        <div className="comment-form-row"><input value={name} onChange={e => setName(e.target.value.slice(0, 80))} placeholder="Your name" aria-label="Your name"/><span className="comment-count">{content.length}/2000</span></div>
        <textarea value={content} onChange={e => setContent(e.target.value.slice(0, 2000))} placeholder={replyTo ? 'Write a reply...' : 'What did you think?'} rows="3" required/>
        <button className="primary-button" disabled={busy}>{busy ? 'Posting…' : replyTo ? 'Post reply' : 'Post comment'}</button>
      </form>
    </section>
  </div>;
}

function CommentItem({ comment, replies, likeCount, liked, reported, onLike, onReply, onReport, likes, reports, onReplyLike, onReplyReport }) {
  return <article className="comment-item">
    <div className="comment-avatar">{(comment.author_name || 'R').slice(0, 1).toUpperCase()}</div>
    <div className="comment-body">
      <div className="comment-meta"><strong>{comment.author_name || 'Reader'}</strong><time>{formatDate(comment.created_at)}</time></div>
      <p>{comment.content}</p>
      <div className="comment-actions">
        <button onClick={() => onLike(comment.id)} className={liked ? 'is-liked' : ''}>♥ {likeCount}</button>
        <button onClick={() => onReply(comment.id)}>Reply</button>
        <button onClick={() => onReport(comment.id)} disabled={reported}>{reported ? 'Reported' : 'Report'}</button>
      </div>
      {replies.length > 0 && <div className="comment-replies">{replies.map(reply => <div className="comment-reply" key={reply.id}>
        <div className="comment-avatar small">{(reply.author_name || 'R').slice(0, 1).toUpperCase()}</div>
        <div className="comment-body"><div className="comment-meta"><strong>{reply.author_name || 'Reader'}</strong><time>{formatDate(reply.created_at)}</time></div><p>{reply.content}</p><div className="comment-actions"><button onClick={() => onReplyLike(reply.id)} className={likes[`liked:${reply.id}`] ? 'is-liked' : ''}>♥ {likes[reply.id] || 0}</button><button onClick={() => onReport(reply.id)} disabled={reports[reply.id]}>{reports[reply.id] ? 'Reported' : 'Report'}</button></div></div>
      </div>)}</div>}
    </div>
  </article>;
}

function RatingBlock({ chapterId, summary, onChanged }) {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const rate = async value => {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const result = await submitRating(chapterId, value);
      setNotice(result.alreadyRated ? 'You already rated this chapter on this device.' : `Thanks — you rated it ${value}/10.`);
      if (!result.alreadyRated) onChanged?.();
    } catch (err) { setNotice(err?.message || 'Unable to save rating.'); }
    finally { setBusy(false); }
  };

  return <div className="rating-block">
    <div className="rating-summary"><div><span className="rating-number">{summary.count ? summary.average.toFixed(1) : '—'}</span><span className="rating-max">/10</span></div><span>{summary.count} {summary.count === 1 ? 'rating' : 'ratings'}</span></div>
    <div className="rating-label">Rate this chapter</div>
    <StarRating value={summary.average} onRate={rate} disabled={busy}/>
    {notice && <p className="rating-notice">{notice}</p>}
  </div>;
}

function EngagementStats({ stats }) {
  return <div className="engagement-stats">
    <span>★ {stats?.rating?.count ? stats.rating.average.toFixed(1) : '—'}/10</span>
    <span>💬 {formatCount(stats?.comments)}</span>
    <span>👁 {formatCount(stats?.views)}</span>
  </div>;
}

function ChapterList({ chapters, onBack }) {
  const [stats, setStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPublicEngagement(chapters.map(chapter => chapter.id)).then(data => { if (!cancelled) setStats(data); }).catch(console.error).finally(() => { if (!cancelled) setLoadingStats(false); });
    return () => { cancelled = true; };
  }, [chapters]);

  return <main className="site-shell">
    <header className="subpage-header">
      <button className="back-button" onClick={onBack} aria-label="Back to home">←</button>
      <div><p className="header-kicker">ATMA REKHA</p><h1>Chapter List</h1></div>
    </header>
    <section className="chapter-list-section">
      <div className="chapter-list-heading"><div><p>{chapters.length} published {chapters.length === 1 ? 'chapter' : 'chapters'}</p></div><span>RATING · DETAILS</span></div>
      <div className="chapter-list">
        {chapters.map(chapter => {
          const item = stats[chapter.id] || { rating: { average: 0, count: 0 }, views: 0, comments: 0 };
          const pages = chapter.pageCount || 0;
          return <article className="chapter-row" key={chapter.id}>
            <a className="chapter-row-main" href={`#read-chapter/${encodeURIComponent(chapter.id)}`}>
              <div className="chapter-row-title"><span>Chapter {chapter.chapterNumber}</span><h2>{chapter.title || 'Untitled chapter'}</h2></div>
              <div className="chapter-row-meta"><span>{item.rating.count ? `${item.rating.average.toFixed(1)}/10` : 'Not rated'} <b>★</b></span><span>•</span><span>{formatDate(chapter.releaseDate || chapter.createdAt)}</span></div>
              <div className="chapter-row-details"><span>📄 {pages || '—'} pages</span><span>💬 {formatCount(item.comments)}</span><span>👁 {formatCount(item.views)}</span></div>
            </a>
            <div className="chapter-row-rate"><StarRating value={item.rating.average} onRate={async value => {
              try { const result = await submitRating(chapter.id, value); if (!result.alreadyRated) { const next = await fetchPublicEngagement(chapters.map(item => item.id)); setStats(next); } }
              catch (err) { console.error(err); }
            }} disabled={loadingStats} compact/></div>
          </article>;
        })}
      </div>
    </section>
    <Footer/>
  </main>;
}

function ChapterReader({ chapterId, onBack }) {
  const [chapter, setChapter] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({ rating: { average: 0, count: 0 }, views: 0, likes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadChapter() {
      setLoading(true); setError(''); setChapter(null); setPages([]);
      try {
        const chapters = await buildChapters();
        const found = chapters.find(item => String(item.id) === String(chapterId));
        if (!found) throw new Error('Chapter not found.');
        if (!isPublished(found)) throw new Error('This chapter is not published yet.');
        const [livePages, engagement] = await Promise.all([buildChapterPages(found.id), fetchChapterEngagement(found.id)]);
        if (!cancelled) {
          setChapter(found); setPages(livePages); setStats(engagement);
          const saved = Number(window.localStorage.getItem(`atma-reading:${found.id}`));
          if (Number.isInteger(saved) && saved >= 0 && saved < livePages.length) setCurrentIndex(saved);
        }
        try { await recordChapterView(found.id); } catch (viewError) { console.warn('View tracking skipped:', viewError); }
      } catch (err) { console.error('Failed to load chapter:', err); if (!cancelled) setError(err?.message || 'Unable to load this chapter right now.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    loadChapter();
    return () => { cancelled = true; };
  }, [chapterId]);

  useEffect(() => {
    if (!chapter) return;
    window.localStorage.setItem(`atma-reading:${chapter.id}`, String(currentIndex));
  }, [chapter, currentIndex]);

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'ArrowLeft') setCurrentIndex(index => Math.max(0, index - 1));
      if (event.key === 'ArrowRight') setCurrentIndex(index => Math.min(Math.max(0, pages.length - 1), index + 1));
      if (event.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length, onBack]);

  if (loading) return <LoadingState label="Loading chapter..."/>;
  if (!chapter) return <main className="reader-page"><div className="reader-error"><div>📖</div><h2>{error || 'Chapter not found'}</h2><button className="primary-button" onClick={onBack}>Back to Chapters</button></div></main>;

  const goPrev = () => setCurrentIndex(index => Math.max(0, index - 1));
  const goNext = () => setCurrentIndex(index => Math.min(pages.length - 1, index + 1));
  const progress = pages.length ? ((currentIndex + 1) / pages.length) * 100 : 0;

  const handleLike = async () => {
    if (liked) return;
    try { await likeChapter(chapter.id); setLiked(true); setStats(prev => ({ ...prev, likes: prev.likes + 1 })); }
    catch (err) { console.error(err); }
  };

  return <main className="reader-page">
    <header className="reader-header">
      <div className="reader-header-inner">
        <button className="reader-back" onClick={onBack} aria-label="Back to chapters">←</button>
        <div className="reader-title"><p>CHAPTER {chapter.chapterNumber}</p><h1>{chapter.title || 'Untitled chapter'}</h1></div>
        <div className="reader-page-pill">{currentIndex + 1}/{pages.length || 0}</div>
      </div>
      <div className="reader-progress"><span style={{ width: `${progress}%` }}/></div>
    </header>

    <div className="reader-content">
      {pages.length ? <>
        <div className="reader-stage">
          <img src={pages[currentIndex]} alt={`Chapter ${chapter.chapterNumber}, page ${currentIndex + 1}`} draggable="false"/>
          {currentIndex > 0 && <button className="reader-side-button left" onClick={goPrev} aria-label="Previous page">‹</button>}
          {currentIndex < pages.length - 1 && <button className="reader-side-button right" onClick={goNext} aria-label="Next page">›</button>}
        </div>

        <div className="reader-info-row">
          <div><span>👁 {formatCount(stats.views)} views</span><span>♥ {formatCount(stats.likes)} likes</span></div>
          <button className={`reader-comment-button ${commentsOpen ? 'active' : ''}`} onClick={() => setCommentsOpen(true)}>💬 Comments</button>
        </div>

        <div className="reader-rating-card">
          <RatingBlock chapterId={chapter.id} summary={stats.rating} onChanged={async () => setStats(await fetchChapterEngagement(chapter.id))}/>
          <button className={`like-button ${liked ? 'liked' : ''}`} onClick={handleLike}>♥ {liked ? 'Liked' : 'Like'} · {formatCount(stats.likes)}</button>
        </div>

        <div className="reader-controls">
          <button className="reader-control secondary" onClick={goPrev} disabled={currentIndex === 0}>← <span>Previous</span></button>
          <div className="reader-counter"><strong>{currentIndex + 1} / {pages.length}</strong><span>PAGE</span></div>
          <button className="reader-control primary" onClick={goNext} disabled={currentIndex === pages.length - 1}><span>Next</span> →</button>
        </div>

        <div className="reader-thumbnails">
          {pages.map((page, index) => <button key={`${page}-${index}`} className={index === currentIndex ? 'active' : ''} onClick={() => setCurrentIndex(index)} aria-label={`Go to page ${index + 1}`}><img src={page} alt="" loading="lazy"/><span>{index + 1}</span></button>)}
        </div>
        <p className="reader-hint">Swipe through the pages on mobile · Use ← → on desktop</p>
      </> : <EmptyState title="Chapter content is not uploaded yet" text="This chapter exists in Supabase, but no manga pages are attached to it."/>}
    </div>

    <CommentsPanel chapterId={chapter.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} initialCount={0}/>
  </main>;
}

function AboutSection() {
  return <section id="about" className="home-section about-section">
    <p className="section-eyebrow">ABOUT ATMA REKHA</p>
    <h2>An original Indian manga story</h2>
    <p>{SITE_STORY.description} The story blends myth, emotion, mystery and an original world while keeping Indian identity at its heart.</p>
  </section>;
}

function HomePage({ chapters, loading, loadError }) {
  const latest = chapters[chapters.length - 1];
  return <main className="home-page">
    <header className="home-header"><a href="#index" className="brand-wordmark">Atma Rekha</a><a href="#admin" className="admin-link">Admin</a></header>
    <section className="hero-card">
      <div className="hero-art"><img src="/favicon.png" alt="Atma Rekha artwork"/></div>
      <div className="hero-copy"><p className="hero-eyebrow">{SITE_STORY.eyebrow}</p><h1>{SITE_STORY.title}</h1><p className="hero-description">A new Indian manga experience built around story, culture and mystery.</p><a className="hero-button" href="#reading">View Chapters <span>→</span></a></div>
    </section>

    <AboutSection/>

    <section className="home-section latest-section" id="reading">
      <div className="section-heading"><div><p className="section-eyebrow">READ NOW</p><h2>Latest chapters</h2></div><a href="#reading" className="section-link">All chapters →</a></div>
      {loading ? <LoadingState label="Loading chapters..."/> : loadError ? <div className="inline-error">{loadError}</div> : !chapters.length ? <EmptyState title="No chapters published yet" text="New chapters will appear here when they are published."/> : <div className="latest-list">{chapters.slice(-3).reverse().map(chapter => <a key={chapter.id} href={`#read-chapter/${encodeURIComponent(chapter.id)}`} className="latest-item"><div><span>Chapter {chapter.chapterNumber}</span><h3>{chapter.title || 'Untitled chapter'}</h3></div><b>→</b></a>)}</div>}
      {latest && <p className="latest-note">Latest release: Chapter {latest.chapterNumber} · {formatDate(latest.releaseDate || latest.createdAt)}</p>}
    </section>

    <section id="contact" className="home-anchor-section"><span>Contact</span><p>For feedback, collaboration or publishing enquiries, use the Gmail icon in the footer.</p></section>
    <section id="report" className="home-anchor-section"><span>Report</span><p>Report a chapter or comment from the reader interface.</p></section>
    <section id="privacy" className="home-anchor-section"><span>Privacy</span><p>Atma Rekha only uses the data required to operate reading, ratings and community features.</p></section>
    <section id="terms" className="home-anchor-section"><span>Terms</span><p>Use the site respectfully and do not upload or post content you do not have permission to share.</p></section>

    <Footer/>
  </main>;
}

export default function App() {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState(() => window.location.hash || '#index');
  const [adminSession, setAdminSession] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '#index');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setLoadError('');
      try {
        const data = await buildChapters();
        const publicChapters = (Array.isArray(data) ? data : []).filter(isPublished);
        const pageResults = await Promise.all(publicChapters.map(chapter => buildChapterPages(chapter.id)));
        const withCounts = publicChapters.map((chapter, index) => ({ ...chapter, pageCount: pageResults[index]?.length || 0 }));
        if (!cancelled) setChapters(withCounts);
      } catch (error) {
        console.error(error);
        if (!cancelled) { setChapters([]); setLoadError(error?.message || 'Unable to load chapters from Supabase.'); }
      } finally { if (!cancelled) setLoading(false); }
    }
    if (!route.startsWith('#read-chapter/') && route !== '#admin') load();
    return () => { cancelled = true; };
  }, [route]);

  useEffect(() => {
    if (route !== '#admin') return;
    supabase.auth.getUser().then(({ data }) => setAdminSession(Boolean(data.user)));
  }, [route]);

  if (route === '#admin') return adminSession ? <AdminPanel onLogout={() => setAdminSession(false)}/> : <AdminLogin onLoginSuccess={() => setAdminSession(true)}/>;
  const readerMatch = route.match(/^#read-chapter\/(.+)$/);
  if (readerMatch) return <ChapterReader chapterId={decodeURIComponent(readerMatch[1])} onBack={() => { window.location.hash = '#reading'; }}/>
  if (route === '#reading') return <ChapterList chapters={chapters} onBack={() => { window.location.hash = '#index'; }}/>
  return <HomePage chapters={chapters} loading={loading} loadError={loadError}/>;
}
