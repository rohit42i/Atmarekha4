import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { buildChapters, buildChapterPages, formatChapterLabel, formatChapterEyebrow, normalizeChapterLanguage } from './chapters';
const AdminLogin = lazy(() => import('./AdminLogin.jsx'));
const AdminPanel = lazy(() => import('./AdminPanel.jsx'));
import Footer from './Footer';
import InfoPage from './InfoPage';
import HomeAnnouncement from './HomeAnnouncement';
import PalDoPalKeLamhe from './PalDoPalKeLamhe';
import { buildPdlplChapters } from './palDoPalKeLamhe';
import { fetchAuthenticatedMediaBlobUrl, getCurrentMembership, supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import axios from 'axios';
import { addComment, fetchChapterComments, fetchChapterEngagement, fetchCommentLikes, fetchPublicEngagement, likeComment, recordChapterShare, recordChapterView, reportComment, submitRating } from './engagement';
import { chapterCanonicalUrl, chapterLanguageUrl, chapterPath, findChapterForPath, getSiteRoute, isChapterPath, legacyChapterIdFromHash } from './routes';
import ChapterDiscovery, { ChapterDiscoveryRender } from './ChapterDiscovery.jsx';
import ContinueReading from './ContinueReading.jsx';
import PrivacyCenter from './PrivacyCenter.jsx';
import { captureMarketingAttribution } from './attribution';
import MorePage from './MorePage.jsx';

const MEMBER_PLAN_IDS = new Set(['mini_member', 'supporter', 'premium']);

async function canReadAtmaChapter(chapter) {
  const raw = chapter?.chapterNumber ?? chapter?.chapter_number;
  const number = raw === null || raw === undefined || raw === '' ? null : Number(raw);
  if (number === null || !Number.isFinite(number) || number <= 8) return true;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return false;
    const [planId, role] = await Promise.all([
      getCurrentMembership(user.id),
      getAdminRole(user.id),
    ]);
    return MEMBER_PLAN_IDS.has(String(planId || '').trim().toLowerCase()) || role === 'owner' || role === 'admin';
  } catch {
    return false;
  }
}

const STORY = { title: 'Atma Rekha', description: 'Is An Adventure Manga/comic Where Traditions And Powers Become A Part Of An Unfolding Story' };
const SITE_URL = 'https://www.atmarekha.in';
const DEFAULT_SEO_TITLE = 'Atma Rekha | Indian Fantasy Manga & Adventure';
const DEFAULT_SEO_DESCRIPTION = 'Read Atma Rekha, an original Indian fantasy manga adventure by Arkesh. Explore its story, characters, ancient traditions, and mysterious powers.';
const DEFAULT_SEO_IMAGE = SITE_URL + '/ishani.png';

function upsertMeta(attribute, key, content) {
  if (typeof document === 'undefined') return;
  let tag = document.head.querySelector('meta[' + attribute + '="' + key + '"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(href) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function clearAlternateLanguages() {
  if (typeof document === 'undefined') return;
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => link.remove());
}

function upsertAlternateLanguage(hreflang, href) {
  if (typeof document === 'undefined' || !href) return;
  const link = document.createElement('link');
  link.rel = 'alternate';
  link.hreflang = hreflang;
  link.href = href;
  document.head.appendChild(link);
}

function setDocumentLanguage(language) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language === 'en' ? 'en-IN' : 'hi-Latn-IN';
}

function removeMeta(attribute, key) {
  if (typeof document === 'undefined') return;
  document.head.querySelectorAll('meta[' + attribute + '="' + key + '"]').forEach(tag => tag.remove());
}

function upsertJsonLd(data) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('atma-rekha-site-schema');
  if (!script) {
    script = document.createElement('script');
    script.id = 'atma-rekha-site-schema';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function buildBreadcrumbList(type, routeParts, chapter, title, canonicalUrl) {
  const items = [{ name: 'Atma Rekha', item: SITE_URL + '/' }];
  if (type === 'chapters' || chapter) items.push({ name: 'Chapters', item: SITE_URL + '/chapters' });
  if (type === 'info') {
    const info = routeParts[1] || 'about';
    const labels = { about: 'About', contact: 'Contact', report: 'Report', privacy: 'Privacy', terms: 'Terms' };
    items.push({ name: labels[info] || 'About', item: SITE_URL + '/info/' + info });
  }
  if (type === 'pal-do-pal-ke-lamhe') items.push({ name: 'Pal Do Pal Ke Lamhe', item: SITE_URL + '/pal-do-pal-ke-lamhe' });
  if (chapter) items.push({ name: title, item: canonicalUrl });
  if (items.length < 2) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

function shortSeoDescription(value, fallback) {
  const text = String(value || '').replace(/\\s+/g, ' ').trim();
  if (!text) return fallback || DEFAULT_SEO_DESCRIPTION;
  const sentenceMatch = text.match(/^.*?[.!?](?:\\s|$)/);
  const sentence = (sentenceMatch ? sentenceMatch[0] : text).trim();
  if (sentence.length <= 160) return sentence;
  const clipped = sentence.slice(0, 157).replace(/\\s+\\S*$/, '').trim();
  return clipped + '...';
}

const published = chapter => String(chapter?.status || '').trim().toLowerCase() === 'published';
function navigateChapter(chapter) {
  const path = chapterPath(chapter);
  if (!path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatCount(value) { const n = Number(value) || 0; return new Intl.NumberFormat('en-IN', { notation: n > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n); }
function LoadingState({ label = 'Loading…' }) {
  return <div className="loading-state" role="status" aria-busy="true" aria-live="polite">
    <div className="loading-skeleton" aria-hidden="true"><i/><i/><i/></div>
    <span className="loading-spinner" aria-hidden="true"/>
    <p>{label}</p>
  </div>;
}
function EmptyState({ title, text }) {
  return <div className="empty-state" role="status" aria-live="polite">
    <span className="empty-state-mark" aria-hidden="true">—</span>
    <h3>{title}</h3>
    {text && <p>{text}</p>}
  </div>;
}
function IconButton({ label, children, onClick }) { return <button type="button" className="engagement-icon" onClick={onClick} aria-label={label} title={label}>{children}</button>; }

function RatingSheet({ chapter, summary, open, onClose, onChanged }) { const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); if (!open || !chapter) return null; const rate = async value => { if (busy) return; setBusy(true); setMessage(''); try { const result = await submitRating(chapter.id, value); setMessage(result.alreadyRated ? 'You already rated this chapter on this device.' : `Rated ${value}/10. Thank you.`); if (!result.alreadyRated) onChanged?.(); } catch (error) { setMessage(error?.message || 'Unable to save rating.'); } finally { setBusy(false); } }; return <div className="overlay-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="rating-sheet" role="dialog" aria-modal="true" aria-label="Rate chapter"><div className="sheet-head"><div><p className="section-eyebrow">{formatChapterEyebrow(chapter.chapterNumber, chapter.title)}</p><h2>Rate {chapter.title || 'this chapter'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div><div className="rating-big"><strong>{summary?.count ? summary.average.toFixed(1) : '—'}</strong><span>/10</span></div><div className="rating-scale" aria-label="Choose rating from 1 to 10">{Array.from({ length: 10 }, (_, index) => { const value = index + 1; return <button key={value} type="button" disabled={busy} onClick={() => rate(value)}><span>★</span><small>{value}</small></button>; })}</div>{message && <p className="sheet-message">{message}</p>}</section></div>; }

function CommentsPanel({ chapter, open, onClose }) { const [comments, setComments] = useState([]); const [likeState, setLikeState] = useState({ counts: {}, liked: {} }); const [reported, setReported] = useState({}); const [name, setName] = useState(() => window.localStorage.getItem('atma-rekha-comment-name') || 'Reader'); const [content, setContent] = useState(''); const [replyTo, setReplyTo] = useState(null); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const load = async () => { if (!chapter?.id) return; setLoading(true); setError(''); try { const rows = await fetchChapterComments(chapter.id); setComments(rows); setLikeState(await fetchCommentLikes(rows.map(row => row.id))); } catch (err) { setError(err?.message || 'Unable to load comments.'); } finally { setLoading(false); } }; useEffect(() => { if (open) load(); }, [open, chapter?.id]); const topLevel = useMemo(() => comments.filter(comment => !comment.parent_comment_id), [comments]); const replies = useMemo(() => comments.filter(comment => comment.parent_comment_id), [comments]); const post = async event => { event.preventDefault(); if (busy || !content.trim()) return; setBusy(true); setError(''); try { const cleanName = name.trim().slice(0, 80) || 'Reader'; window.localStorage.setItem('atma-rekha-comment-name', cleanName); const row = await addComment({ chapterId: chapter.id, content, authorName: cleanName, parentCommentId: replyTo }); setComments(previous => [...previous, row]); setContent(''); setReplyTo(null); } catch (err) { setError(err?.message || 'Unable to post comment.'); } finally { setBusy(false); } }; const like = async id => { if (likeState.liked[id]) return; try { await likeComment(id); setLikeState(previous => ({ counts: { ...previous.counts, [id]: (previous.counts[id] || 0) + 1 }, liked: { ...previous.liked, [id]: true } })); } catch (err) { setError(err?.message || 'Unable to like comment.'); } }; const report = async id => { if (reported[id]) return; try { await reportComment(id); setReported(previous => ({ ...previous, [id]: true })); } catch (err) { setError(err?.message || 'Unable to report comment.'); } }; if (!open) return null; return <div className="comment-sheet-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="comment-sheet" role="dialog" aria-modal="true" aria-label="Chapter comments"><div className="comment-sheet-head"><div><p className="section-eyebrow">{formatChapterEyebrow(chapter.chapterNumber, chapter.title)}</p><h2>Comments <span>{comments.length}</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close comments">×</button></div><div className="comment-list">{loading ? <LoadingState label="Loading comments…"/> : error && !comments.length ? <EmptyState title="Comments unavailable" text={error}/> : !topLevel.length ? <EmptyState title="No comments yet" text="Be the first reader to share a thought."/> : topLevel.map(comment => <Comment key={comment.id} comment={comment} replies={replies.filter(reply => reply.parent_comment_id === comment.id)} likes={likeState} reported={reported} onLike={like} onReply={setReplyTo} onReport={report}/>)}</div>{error && <p className="form-error">{error}</p>}<form className="comment-form" onSubmit={post}><div className="comment-form-title">{replyTo ? <><span>Replying to a reader</span><button type="button" onClick={() => setReplyTo(null)}>Cancel</button></> : <span>Join the conversation</span>}</div><input value={name} onChange={event => setName(event.target.value.slice(0, 80))} placeholder="Your name" aria-label="Your name"/><textarea value={content} onChange={event => setContent(event.target.value.slice(0, 2000))} placeholder={replyTo ? 'Write a reply…' : 'What did you think?'} rows="3" required/><button className="primary-button" disabled={busy}>{busy ? 'Posting…' : replyTo ? 'Post reply' : 'Post comment'}</button></form></section></div>; }
function Comment({ comment, replies, likes, reported, onLike, onReply, onReport }) { return <article className="comment-item"><div className="comment-avatar">{(comment.author_name || 'R').slice(0, 1).toUpperCase()}</div><div className="comment-body"><div className="comment-meta"><strong>{comment.author_name || 'Reader'}</strong><time>{formatDate(comment.created_at)}</time></div><p>{comment.content}</p><div className="comment-actions"><button type="button" onClick={() => onLike(comment.id)} className={likes.liked[comment.id] ? 'is-liked' : ''}>♥ {likes.counts[comment.id] || 0}</button><button type="button" onClick={() => onReply(comment.id)}>Reply</button><button type="button" onClick={() => onReport(comment.id)} disabled={reported[comment.id]}>{reported[comment.id] ? 'Reported' : 'Report'}</button></div>{replies.length > 0 && <div className="comment-replies">{replies.map(reply => <div className="comment-reply" key={reply.id}><div className="comment-avatar small">{(reply.author_name || 'R').slice(0, 1).toUpperCase()}</div><div className="comment-body"><div className="comment-meta"><strong>{reply.author_name || 'Reader'}</strong><time>{formatDate(reply.created_at)}</time></div><p>{reply.content}</p><div className="comment-actions"><button type="button" onClick={() => onLike(reply.id)} className={likes.liked[reply.id] ? 'is-liked' : ''}>♥ {likes.counts[reply.id] || 0}</button><button type="button" onClick={() => onReport(reply.id)} disabled={reported[reply.id]}>{reported[reply.id] ? 'Reported' : 'Report'}</button></div></div></div>)}</div>}</div></article>; }

function ChapterList({ chapters, onBack }) {
  const [stats, setStats] = useState({});
  const [pageCounts, setPageCounts] = useState({});
  const [ratingChapter, setRatingChapter] = useState(null);
  const [commentChapter, setCommentChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [language, setLanguage] = useState(() => {
    try {
      const urlLanguage = new URLSearchParams(window.location.search).get('lang');
      if (urlLanguage === 'en' || urlLanguage === 'hi') return normalizeChapterLanguage(urlLanguage);
      return normalizeChapterLanguage(window.localStorage.getItem('atma-language'));
    } catch { return 'hi'; }
  });
  const languageChapters = useMemo(
    () => chapters.filter(chapter => normalizeChapterLanguage(chapter.language) === language),
    [chapters, language],
  );

  const changeLanguage = nextLanguage => {
    const next = normalizeChapterLanguage(nextLanguage);
    setLanguage(next);
    try { window.localStorage.setItem('atma-language', next); } catch {}
    const nextUrl = next === 'en' ? '/chapters?lang=en' : '/chapters';
    window.history.replaceState({}, '', nextUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const refresh = async () => {
    if (!languageChapters.length) { setStats({}); setPageCounts({}); setDataError(''); setLoading(false); return; }
    setLoading(true);
    setDataError('');
    try {
      const ids = languageChapters.map(chapter => chapter.id);
      const engagement = await fetchPublicEngagement(ids);
      const counts = Object.fromEntries(ids.map(id => [id, Number(engagement[id]?.pages) || 0]));
      setStats(engagement);
      setPageCounts(counts);
    } catch (error) {
      console.error('Chapter list data:', error);
      setDataError(error?.message || 'Unable to load chapter details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [languageChapters]);

  const renderRows = (visibleChapters, recentChapterIds) => (
    <ChapterDiscoveryRender
      visibleChapters={visibleChapters}
      recentChapterIds={recentChapterIds}
      stats={stats}
      openRating={setRatingChapter}
      openComments={setCommentChapter}
    />
  );

  return (
    <main className="site-shell chapter-list-page">
      <header className="subpage-header">
        <button className="back-button" onClick={onBack} aria-label="Back to home">←</button>
        <div><p className="header-kicker">ATMA REKHA</p><h1>Chapter List</h1></div>
      </header>
      <section className="chapter-list-section">
        {loading ? <LoadingState/> : dataError ? (
          <div className="data-error-state" role="alert">
            <h2>Chapter details unavailable</h2>
            <p>{dataError}</p>
            <button type="button" className="primary-button" onClick={refresh}>Retry</button>
          </div>
        ) : (
          <ChapterDiscovery chapters={languageChapters} stats={stats} renderChapter={renderRows} language={language} onLanguageChange={changeLanguage}/>
        )}
      </section>
      <Footer/>
      {ratingChapter && <RatingSheet chapter={ratingChapter} summary={stats[ratingChapter.id]?.rating} open onClose={() => setRatingChapter(null)} onChanged={refresh}/>}
      {commentChapter && <CommentsPanel chapter={commentChapter} open onClose={() => setCommentChapter(null)}/>}
    </main>
  );
}

function Reader({ chapterId, onBack, chapters }) { const [chapter, setChapter] = useState(null); const [pages, setPages] = useState([]); const [pageImageLoading, setPageImageLoading] = useState(true); const [index, setIndex] = useState(0); const [protectedUrls, setProtectedUrls] = useState({}); const protectedUrlsRef = useRef(new Map()); const [stats, setStats] = useState({ rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0 }); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [ratingOpen, setRatingOpen] = useState(false); const [commentsOpen, setCommentsOpen] = useState(false); const [touchStart, setTouchStart] = useState(null); const [touchEnd, setTouchEnd] = useState(null); const [favoriteUser, setFavoriteUser] = useState(null); const [favoriteSaved, setFavoriteSaved] = useState(false); const [favoriteBusy, setFavoriteBusy] = useState(false); const [favoriteError, setFavoriteError] = useState(''); const specialPageFallbackRef = useRef(new Set()); const progressHydratedRef = useRef(false); const minSwipeDistance = 50; const onTouchStart = event => { setTouchEnd(null); setTouchStart(event.targetTouches[0].clientX); }; const onTouchMove = event => { setTouchEnd(event.targetTouches[0].clientX); }; const onTouchEnd = () => { if (touchStart === null || touchEnd === null) return; const distance = touchStart - touchEnd; if (Math.abs(distance) < minSwipeDistance) return; setIndex(current => Math.max(0, Math.min(pages.length - 1, current + (distance > 0 ? 1 : -1)))); };
  useEffect(() => { const protectedPage = Number(chapter?.chapterNumber) > 8; const url = protectedPage ? protectedUrls[index] : pages[index]; setPageImageLoading(Boolean(url)); }, [chapter, pages, index, protectedUrls]);
  useEffect(() => { let active = true; setLoading(true); setError(''); Promise.all([buildChapters(), buildChapterPages(chapterId)]).then(([chapterRows, pageRows]) => { if (!active) return; const nextChapter = chapterRows.find(item => String(item.id) === String(chapterId)); setChapter(nextChapter || null); setPages(pageRows || []); }).catch(err => { if (active) setError(err?.message || 'Unable to load this chapter.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [chapterId]);
  useEffect(() => { if (!chapter?.id) return; fetchChapterEngagement(chapter.id).then(setStats).catch(() => {}); }, [chapter?.id]);
  useEffect(() => { if (!chapter?.id) return; recordChapterView(chapter.id).catch(() => {}); }, [chapter?.id]);
  useEffect(() => { const onKey = event => { if (event.key === 'ArrowRight') setIndex(current => Math.min(pages.length - 1, current + 1)); if (event.key === 'ArrowLeft') setIndex(current => Math.max(0, current - 1)); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [pages.length]);
  if (loading) return <main className="reader-page"><LoadingState label="Opening chapter…"/></main>;
  if (error || !chapter) return <main className="reader-page"><div className="reader-error"><h2>{error || 'Chapter not found.'}</h2><button className="primary-button" onClick={onBack}>Back to chapters</button></div></main>;
  const imageUrl = Number(chapter.chapterNumber) > 8 ? protectedUrls[index] : pages[index];
  return <main className="reader-page"><header className="subpage-header"><button className="back-button" onClick={onBack} aria-label="Back to chapters">←</button><div><p className="header-kicker">{formatChapterEyebrow(chapter.chapterNumber, chapter.title)}</p><h1>{chapter.title || 'Chapter'}</h1></div></header><section className="reader-stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>{imageUrl ? <img src={imageUrl} alt={chapter.title || 'Atma Rekha chapter page'} onLoad={() => setPageImageLoading(false)} onError={() => setPageImageLoading(false)}/> : <EmptyState title="Unable to load this page" text="Please retry or return to chapters."/>}{pageImageLoading && imageUrl && <LoadingState label="Loading page…"/>}</section><div className="reader-controls"><button className="primary-button" disabled={index <= 0} onClick={() => setIndex(current => Math.max(0, current - 1))}>Previous</button><span>Page {Math.min(index + 1, pages.length)} / {pages.length}</span><button className="primary-button" disabled={index >= pages.length - 1} onClick={() => setIndex(current => Math.min(pages.length - 1, current + 1))}>Next</button></div><Footer/></main>; }

function Home({ chapters }) { return <main className="home-page"><section className="hero-section"><div className="hero-copy"><p className="hero-eyebrow">INDIAN FANTASY · ADVENTURE</p><h1>{STORY.title}</h1><p className="hero-description">{STORY.description}</p><a className="hero-button" href="/chapters">View Chapters →</a></div></section><section className="home-chapters"><ChapterDiscovery chapters={chapters} stats={{}}/><ContinueReading chapters={chapters}/></section><HomeAnnouncement variant="normal"/><Footer/></main>; }
function AccessDenied({ onExit }) { return <main className="site-shell"><div className="reader-error"><h2>Access Denied</h2><p>You don't have permission to access the Atma Rekha Admin Panel.</p><button className="primary-button" onClick={onExit}>Back to Home</button></div></main>; }
function AdminRoute({ onExit }) { const [session, setSession] = useState(null); const [role, setRole] = useState(null); const [checking, setChecking] = useState(true); const sessionUserIdRef = useRef(null); useEffect(() => { let active = true; let checkId = 0; const check = async nextSession => { const id = ++checkId; try { const currentSession = nextSession || (await supabase.auth.getSession()).data.session; if (!active || id !== checkId) return; if (!currentSession?.user) { sessionUserIdRef.current = null; setSession(null); setRole(null); setChecking(false); return; } sessionUserIdRef.current = currentSession.user.id; setSession(currentSession); setChecking(true); const nextRole = await getAdminRole(currentSession.user.id); if (!active || id !== checkId) return; setRole(nextRole); setChecking(false); } catch { if (!active || id !== checkId) return; setRole(null); setChecking(false); } }; check(); const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => { if (event === 'SIGNED_OUT' || !nextSession?.user) { check(null); return; } if (sessionUserIdRef.current === nextSession.user.id) { setSession(nextSession); return; } check(nextSession); }); return () => { active = false; listener.subscription.unsubscribe(); }; }, []); if (checking) return <main className="site-shell"><LoadingState label="Checking admin access…"/></main>; if (!session) return <Suspense fallback={<main className="site-shell"><LoadingState label="Opening admin sign-in…"/></main>}><AdminLogin /></Suspense>; if (!(role === 'owner' || role === 'admin')) return <AccessDenied onExit={onExit}/>; return <Suspense fallback={<main className="site-shell"><LoadingState label="Opening admin panel…"/></main>}><AdminPanel onLogout={async () => { await supabase.auth.signOut(); onExit(); }}/></Suspense>; }
function useHashRoute() { const [route, setRoute] = useState(() => getSiteRoute()); useEffect(() => { const update = () => setRoute(getSiteRoute()); window.addEventListener('hashchange', update); window.addEventListener('popstate', update); return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update); }; }, []); return route; }
export default function App() { const route = useHashRoute(); const [chapters, setChapters] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); useEffect(() => { captureMarketingAttribution(); }, [route]); useEffect(() => { let cancelled = false; buildChapters().then(data => { if (!cancelled) setChapters(data.filter(published).sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber))); }).catch(err => { if (!cancelled) setError(err?.message || 'Unable to load chapters.'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []); useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [route]); if (route === 'info/privacy' || route === 'privacy-center') return <PrivacyCenter/>; if (route === 'more') return <MorePage/>; if (route.startsWith('chapter/')) { const chapter = findChapterForPath('/' + route, chapters); if (loading) return <main className="reader-page"><LoadingState label="Opening chapter…"/></main>; if (!chapter) return <main className="reader-page"><div className="reader-error"><div>⌁</div><h2>Chapter not found.</h2><button className="primary-button" onClick={() => { window.history.pushState({}, '', '/chapters'); window.dispatchEvent(new PopStateEvent('popstate')); }}>Back to chapters</button></div></main>; return <Reader chapterId={chapter.id} onBack={() => { window.history.pushState({}, '', '/chapters'); window.dispatchEvent(new PopStateEvent('popstate')); }} chapters={chapters}/>; } const returnToAdmin = route === 'membership' && window.location.pathname.replace(/\\/+$/, '') === '/admin'; if (returnToAdmin || route === 'admin') return <AdminRoute onExit={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>; if (route === 'pal-do-pal-ke-lamhe' || route.startsWith('pal-do-pal-ke-lamhe/')) return <PalDoPalKeLamhe/>; if (route.startsWith('info/')) return <InfoPage type={route.split('/')[1]} onBack={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>; if (route === 'chapters' || route.startsWith('chapters?')) return <ChapterList chapters={chapters} onBack={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>; if (route.startsWith('read-chapter/')) return <Reader chapterId={decodeURIComponent(route.slice('read-chapter/'.length))} onBack={() => { window.history.pushState({}, '', '/chapters'); window.dispatchEvent(new PopStateEvent('popstate')); }} chapters={chapters}/>; if (loading) return <main className="home-page"><LoadingState label="Loading Atma Rekha…"/></main>; if (error) return <main className="home-page"><div className="reader-error"><h2>{error}</h2><button className="primary-button" onClick={() => window.location.reload()}>Retry</button></div></main>; return <Home chapters={chapters}/>; }
