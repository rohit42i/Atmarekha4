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
import { NotFoundPage, ServiceUnavailablePage, MaintenancePage, ForbiddenPage } from './ErrorPages.jsx';
import PrivacyCenter from './PrivacyCenter.jsx';
import { captureMarketingAttribution } from './attribution';
import { saveOfflineChapter, getOfflineChapter, removeOfflineChapter } from './offlineReading';
import { Error430Page } from './ErrorPages.jsx';

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

const STORY = { title: 'Atma Rekha', description: 'ATMA REKHA is an Indian fantasy manga/comic where ancient traditions, spiritual concepts, mysterious powers and mythical beings become part of an unfolding adventure.' };
const SITE_URL = 'https://www.atmarekha.in';
const DEFAULT_SEO_TITLE = 'Atma Rekha | Indian Fantasy Manga & Adventure';
const DEFAULT_SEO_DESCRIPTION = 'Read Atma Rekha, an Indian fantasy manga/comic where ancient traditions, spiritual concepts, mysterious powers and mythical beings shape an unfolding adventure.';
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
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback || DEFAULT_SEO_DESCRIPTION;
  const sentenceMatch = text.match(/^.*?[.!?](?:\s|$)/);
  const sentence = (sentenceMatch ? sentenceMatch[0] : text).trim();
  if (sentence.length <= 160) return sentence;
  const clipped = sentence.slice(0, 157).replace(/\s+\S*$/, '').trim();
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
function LoadingState({ label = 'Loading…' }) { return <div className="loading-state"><span className="loading-spinner"/><p>{label}</p></div>; }
function EmptyState({ title, text }) { return <div className="empty-state"><h3>{title}</h3>{text && <p>{text}</p>}</div>; }
function IconButton({ label, children, onClick }) { return <button type="button" className="engagement-icon" onClick={onClick} aria-label={label} title={label}>{children}</button>; }

function RatingSheet({ chapter, summary, open, onClose, onChanged }) { const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); if (!open || !chapter) return null; const rate = async value => { if (busy) return; setBusy(true); setMessage(''); try { const result = await submitRating(chapter.id, value); setMessage(result.alreadyRated ? 'You already rated this chapter on this device.' : `Rated ${value}/10. Thank you.`); if (!result.alreadyRated) onChanged?.(); } catch (error) { setMessage(error?.message || 'Unable to save rating.'); } finally { setBusy(false); } }; return <div className="overlay-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="rating-sheet" role="dialog" aria-modal="true" aria-label="Rate chapter"><div className="sheet-head"><div><p className="section-eyebrow">{formatChapterEyebrow(chapter.chapterNumber, chapter.title)}</p><h2>Rate {chapter.title || 'this chapter'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div><div className="rating-big"><strong>{summary?.count ? summary.average.toFixed(1) : '—'}</strong><span>/10 · {summary?.count || 0} ratings</span></div><div className="rating-scale" aria-label="Choose rating from 1 to 10">{Array.from({ length: 10 }, (_, index) => { const value = index + 1; return <button key={value} type="button" disabled={busy} onClick={() => rate(value)}><span>★</span><small>{value}</small></button>; })}</div>{message && <p className="sheet-message">{message}</p>}</section></div>; }

function CommentsPanel({ chapter, open, onClose }) { const [comments, setComments] = useState([]); const [likeState, setLikeState] = useState({ counts: {}, liked: {} }); const [reported, setReported] = useState({}); const [name, setName] = useState(() => window.localStorage.getItem('atma-rekha-comment-name') || 'Reader'); const [content, setContent] = useState(''); const [replyTo, setReplyTo] = useState(null); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const load = async () => { if (!chapter?.id) return; setLoading(true); setError(''); try { const rows = await fetchChapterComments(chapter.id); setComments(rows); setLikeState(await fetchCommentLikes(rows.map(row => row.id))); } catch (err) { setError(err?.message || 'Unable to load comments.'); } finally { setLoading(false); } }; useEffect(() => { if (open) load(); }, [open, chapter?.id]); const topLevel = useMemo(() => comments.filter(comment => !comment.parent_comment_id), [comments]); const replies = useMemo(() => comments.filter(comment => comment.parent_comment_id), [comments]); const post = async event => { event.preventDefault(); if (busy || !content.trim()) return; setBusy(true); setError(''); try { const cleanName = name.trim().slice(0, 80) || 'Reader'; window.localStorage.setItem('atma-rekha-comment-name', cleanName); const row = await addComment({ chapterId: chapter.id, content, authorName: cleanName, parentCommentId: replyTo }); setComments(previous => [...previous, row]); setContent(''); setReplyTo(null); } catch (err) { setError(err?.message || 'Unable to post comment.'); } finally { setBusy(false); } }; const like = async id => { if (likeState.liked[id]) return; try { await likeComment(id); setLikeState(previous => ({ counts: { ...previous.counts, [id]: (previous.counts[id] || 0) + 1 }, liked: { ...previous.liked, [id]: true } })); } catch (err) { setError(err?.message || 'Unable to like comment.'); } }; const report = async id => { if (reported[id]) return; try { await reportComment(id); setReported(previous => ({ ...previous, [id]: true })); } catch (err) { setError(err?.message || 'Unable to report comment.'); } }; if (!open) return null; return <div className="comment-sheet-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="comment-sheet" role="dialog" aria-modal="true" aria-label="Chapter comments"><div className="comment-sheet-head"><div><p className="section-eyebrow">{formatChapterEyebrow(chapter.chapterNumber, chapter.title)}</p><h2>Comments <span>{comments.length}</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close comments">×</button></div><div className="comment-list">{loading ? <LoadingState label="Loading comments…"/> : error && !comments.length ? <EmptyState title="Comments unavailable" text={error}/> : !topLevel.length ? <EmptyState title="No comments yet" text="Be the first reader to share a thought."/> : topLevel.map(comment => <Comment key={comment.id} comment={comment} replies={replies.filter(reply => reply.parent_comment_id === comment.id)} likes={likeState} reported={reported} onLike={like} onReply={setReplyTo} onReport={report}/>)}</div>{error && <p className="form-error">{error}</p>}<form className="comment-form" onSubmit={post}><div className="comment-form-title">{replyTo ? <><span>Replying to a reader</span><button type="button" onClick={() => setReplyTo(null)}>Cancel</button></> : <span>Join the conversation</span>}</div><input value={name} onChange={event => setName(event.target.value.slice(0, 80))} placeholder="Your name" aria-label="Your name"/><textarea value={content} onChange={event => setContent(event.target.value.slice(0, 2000))} placeholder={replyTo ? 'Write a reply…' : 'What did you think?'} rows="3" required/><button className="primary-button" disabled={busy}>{busy ? 'Posting…' : replyTo ? 'Post reply' : 'Post comment'}</button></form></section></div>; }
function Comment({ comment, replies, likes, reported, onLike, onReply, onReport }) { return <article className="comment-item"><div className="comment-avatar">{(comment.author_name || 'R').slice(0, 1).toUpperCase()}</div><div className="comment-body"><div className="comment-meta"><strong>{comment.author_name || 'Reader'}</strong><time>{formatDate(comment.created_at)}</time></div><p>{comment.content}</p><div className="comment-actions"><button type="button" onClick={() => onLike(comment.id)} className={likes.liked[comment.id] ? 'is-liked' : ''}>♥ {likes.counts[comment.id] || 0}</button><button type="button" onClick={() => onReply(comment.id)}>Reply</button><button type="button" onClick={() => onReport(comment.id)} disabled={reported[comment.id]}>{reported[comment.id] ? 'Reported' : 'Report'}</button></div>{replies.length > 0 && <div className="comment-replies">{replies.map(reply => <div className="comment-reply" key={reply.id}><div className="comment-avatar small">{(reply.author_name || 'R').slice(0, 1).toUpperCase()}</div><div className="comment-body"><div className="comment-meta"><strong>{reply.author_name || 'Reader'}</strong><time>{formatDate(reply.created_at)}</time></div><p>{reply.content}</p><div className="comment-actions"><button type="button" onClick={() => onLike(reply.id)} className={likes.liked[reply.id] ? 'is-liked' : ''}>♥ {likes.counts[reply.id] || 0}</button><button type="button" onClick={() => onReport(reply.id)} disabled={reported[reply.id]}>{reported[reply.id] ? 'Reported' : 'Report'}</button></div></div></div>)}</div>}</div></article>; }

function ChapterList({ chapters, onBack }) {
  const [stats, setStats] = useState({});
  const [pageCounts, setPageCounts] = useState({});
  const [ratingChapter, setRatingChapter] = useState(null);
  const [commentChapter, setCommentChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(() => {
    try { return normalizeChapterLanguage(window.localStorage.getItem('atma-language')); } catch { return 'hi'; }
  });
  const languageChapters = useMemo(
    () => chapters.filter(chapter => normalizeChapterLanguage(chapter.language) === language),
    [chapters, language],
  );

  const changeLanguage = nextLanguage => {
    const next = normalizeChapterLanguage(nextLanguage);
    setLanguage(next);
    try { window.localStorage.setItem('atma-language', next); } catch {}
  };

  const refresh = async () => {
    if (!languageChapters.length) { setStats({}); setPageCounts({}); setLoading(false); return; }
    setLoading(true);
    try {
      const ids = languageChapters.map(chapter => chapter.id);
      const engagement = await fetchPublicEngagement(ids);
      const counts = Object.fromEntries(ids.map(id => [id, Number(engagement[id]?.pages) || 0]));
      setStats(engagement);
      setPageCounts(counts);
    } catch (error) {
      console.error('Chapter list data:', error);
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
        {loading ? <LoadingState/> : (
          <ChapterDiscovery chapters={languageChapters} stats={stats} renderChapter={renderRows} language={language} onLanguageChange={changeLanguage}/>
        )}
      </section>
      <Footer/>
      {ratingChapter && <RatingSheet chapter={ratingChapter} summary={stats[ratingChapter.id]?.rating} open onClose={() => setRatingChapter(null)} onChanged={refresh}/>}
      {commentChapter && <CommentsPanel chapter={commentChapter} open onClose={() => setCommentChapter(null)}/>}
    </main>
  );
}

function Reader({ chapterId, onBack, chapters }) {
  const [chapter, setChapter] = useState(null); const [pages, setPages] = useState([]); const [offlineSourceSavedAt, setOfflineSourceSavedAt] = useState(null); const [index, setIndex] = useState(0); const [protectedUrls, setProtectedUrls] = useState({}); const protectedUrlsRef = useRef(new Map()); const [stats, setStats] = useState({ rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0 }); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [ratingOpen, setRatingOpen] = useState(false); const [commentsOpen, setCommentsOpen] = useState(false); const [touchStart, setTouchStart] = useState(null); const [touchEnd, setTouchEnd] = useState(null); const [favoriteUser, setFavoriteUser] = useState(null); const [favoriteSaved, setFavoriteSaved] = useState(false); const [favoriteBusy, setFavoriteBusy] = useState(false); const [favoriteError, setFavoriteError] = useState(''); const progressHydratedRef = useRef(false);
  const minSwipeDistance = 80;
  const onTouchStart = event => { if (event.touches.length !== 1) { setTouchStart(null); setTouchEnd(null); return; } setTouchEnd(null); setTouchStart(event.touches[0].clientX); };
  const onTouchMove = event => { if (event.touches.length !== 1) { setTouchStart(null); setTouchEnd(null); return; } setTouchEnd(event.touches[0].clientX); };
  const onTouchEnd = event => { if (event.touches?.length) return; if (touchStart === null || touchEnd === null) return; const distance = touchStart - touchEnd; if (Math.abs(distance) < minSwipeDistance) { setTouchStart(null); setTouchEnd(null); return; } if (distance > 0) setIndex(value => Math.min(value + 1, pages.length - 1)); else setIndex(value => Math.max(value - 1, 0)); setTouchStart(null); setTouchEnd(null); };
  useEffect(() => { let cancelled = false; progressHydratedRef.current = false; const load = async () => { setLoading(true); setError(''); try { const all = chapters?.length ? chapters : await buildChapters(); const found = all.find(item => String(item.id) === String(chapterId)); if (!found || !published(found)) throw new Error('Chapter not found or not published.'); const readable = await canReadAtmaChapter(found);
      if (!readable) {
        window.history.replaceState(null, '', '/#chapters');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.dispatchEvent(new CustomEvent('atma:open-chapter-access', { detail: { chapter: found } }));
        if (!cancelled) {
          setChapter(found);
          setPages([]);
          setLoading(false);
        }
        return;
      }

      let livePages;
      try {
        livePages = await buildChapterPages(found.id);
        setOfflineSourceSavedAt(null);
      } catch (pageError) {
        const offline = await getOfflineChapter(String(found.id));
        if (!offline?.pageUrls?.length) throw pageError;
        livePages = offline.pageUrls;
        setOfflineSourceSavedAt(offline.savedAt || null);
        window.dispatchEvent(new CustomEvent('atma-toast', { detail: { message: 'Using your saved offline copy.' } }));
      }
      if (cancelled) return; let restoredIndex = Number(window.localStorage.getItem(`atma-reading:${found.id}`)); if (!Number.isInteger(restoredIndex) || restoredIndex < 0 || restoredIndex >= livePages.length) restoredIndex = 0; progressHydratedRef.current = true; setChapter(found); setPages(livePages); setIndex(restoredIndex); setLoading(false); if (restoredIndex === 0) { supabase.auth.getSession().then(async ({ data: sessionData }) => { const userId = sessionData?.session?.user?.id; if (!userId || cancelled) return; const { data: history } = await supabase.from('reading_history').select('chapter_id,page_number').eq('user_id', userId).maybeSingle(); const serverIndex = Number(history?.page_number) - 1; if (!cancelled && String(history?.chapter_id) === String(found.id) && Number.isInteger(serverIndex) && serverIndex >= 0 && serverIndex < livePages.length) { progressHydratedRef.current = false; setIndex(serverIndex); progressHydratedRef.current = true; } }).catch(historyError => console.warn('Reading progress restore skipped:', historyError)); } recordChapterView(found.id).catch(viewError => { console.warn('View tracking skipped:', viewError); }); fetchChapterEngagement(found.id).then(engagement => { if (!cancelled) setStats(engagement); }).catch(engagementError => { console.warn('Engagement load skipped:', engagementError); }); } catch (err) { if (!cancelled) setError(err?.message || 'Unable to load this chapter.'); } finally { if (!cancelled) setLoading(false); } }; load(); return () => { cancelled = true; progressHydratedRef.current = false; }; }, [chapterId, chapters]);
  useEffect(() => {
    const protectedChapter = Number(chapter?.chapterNumber) > 8;
    if (!protectedChapter || !pages.length) {
      for (const url of protectedUrlsRef.current.values()) URL.revokeObjectURL(url);
      protectedUrlsRef.current.clear();
      setProtectedUrls({});
      return undefined;
    }

    let cancelled = false;
    const needed = new Set([index - 1, index, index + 1, index + 2].filter(value => value >= 0 && value < pages.length));

    (async () => {
      await Promise.all([...needed].map(async pageIndex => {
        if (protectedUrlsRef.current.has(pageIndex)) return;
        try {
          const objectUrl = await fetchAuthenticatedMediaBlobUrl(pages[pageIndex]);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          protectedUrlsRef.current.set(pageIndex, objectUrl);
          setProtectedUrls(current => ({ ...current, [pageIndex]: objectUrl }));
        } catch (mediaError) {
          if (!cancelled) setError(mediaError?.message || 'Unable to load this page.');
        }
      }));

      for (const [pageIndex, objectUrl] of protectedUrlsRef.current.entries()) {
        if (!needed.has(pageIndex)) {
          URL.revokeObjectURL(objectUrl);
          protectedUrlsRef.current.delete(pageIndex);
          setProtectedUrls(current => {
            const next = { ...current };
            delete next[pageIndex];
            return next;
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [chapter, pages, index]);

  useEffect(() => () => {
    for (const url of protectedUrlsRef.current.values()) URL.revokeObjectURL(url);
    protectedUrlsRef.current.clear();
  }, []);

  useEffect(() => { if (progressHydratedRef.current && chapter && pages.length) { window.localStorage.setItem(`atma-reading:${chapter.id}`, String(index)); window.localStorage.setItem('atma-reading-last', JSON.stringify({ chapterId: chapter.id, pageNumber: index + 1 })); } }, [chapter, pages.length, index]);
  useEffect(() => {
    if (!pages.length || Number(chapter?.chapterNumber) > 8) return undefined;
    const urls = [pages[index], pages[index + 1], pages[index + 2], pages[index - 1]].filter(Boolean);
    urls.forEach(url => { const image = new Image(); image.decoding = 'async'; image.fetchPriority = 'high'; image.src = url; });
    return undefined;
  }, [chapter, index, pages]);
  useEffect(() => { if (chapter && pages.length > 0) { window.dispatchEvent(new CustomEvent('atma-reading-progress', { detail: { chapterId: chapter.id, pageNumber: index + 1 } })); } }, [chapter, index, pages.length]);
  useEffect(() => { let active = true; if (!chapter?.id) return undefined; getOfflineChapter(String(chapter.id)).then(item => { if (active) setOfflineSaved(Boolean(item)); }).catch(()=>{}); return () => { active = false; }; }, [chapter?.id]);

  const toggleOffline = async () => {
    if (!chapter?.id || protectedChapter || offlineBusy) return;
    setOfflineBusy(true);
    try {
      if (offlineSaved) {
        await removeOfflineChapter(String(chapter.id));
        setOfflineSaved(false);
      } else {
        await saveOfflineChapter({ id: String(chapter.id), title: chapter.title || formatChapterLabel(chapter.chapterNumber, { title: chapter.title }), pageUrls: pages });
        setOfflineSaved(true);
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('atma-toast', { detail: { message: err?.message || 'Unable to save this chapter offline.' } }));
    } finally { setOfflineBusy(false); }
  };

  useEffect(() => { const keyHandler = event => { if (!document.querySelector('.reader-page')) return; const tagName = String(event.target?.tagName || '').toLowerCase(); const typing = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || event.target?.isContentEditable; if (typing || event.ctrlKey || event.metaKey || event.altKey) return; if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); setIndex(value => Math.min(value + 1, pages.length - 1)); } if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex(value => Math.max(value - 1, 0)); } if (event.key === 'Escape') { setRatingOpen(false); setCommentsOpen(false); } }; window.addEventListener('keydown', keyHandler); return () => window.removeEventListener('keydown', keyHandler); }, [pages.length]);
  useEffect(() => { let active = true; supabase.auth.getUser().then(({ data }) => { if (active) setFavoriteUser(data?.user || null); }); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setFavoriteUser(session?.user || null); }); return () => { active = false; listener.subscription.unsubscribe(); }; }, []);
  useEffect(() => { let cancelled = false; setFavoriteSaved(false); setFavoriteError(''); if (!favoriteUser || !chapter?.id) return undefined; supabase.from('bookmarks').select('id').eq('user_id', favoriteUser.id).eq('chapter_id', chapter.id).maybeSingle().then(({ data, error: bookmarkError }) => { if (cancelled) return; if (bookmarkError) setFavoriteError(bookmarkError.message || 'Unable to load favourite status.'); else setFavoriteSaved(Boolean(data)); }); return () => { cancelled = true; }; }, [favoriteUser?.id, chapter?.id]);
  const toggleFavorite = async () => { if (favoriteBusy || !chapter?.id) return; if (!favoriteUser) { window.dispatchEvent(new CustomEvent('atma-open-auth', { detail: { mode: 'login' } })); return; } setFavoriteBusy(true); setFavoriteError(''); try { if (favoriteSaved) { const { error: deleteError } = await supabase.from('bookmarks').delete().eq('user_id', favoriteUser.id).eq('chapter_id', chapter.id); if (deleteError) throw deleteError; setFavoriteSaved(false); } else { const { error: insertError } = await supabase.from('bookmarks').insert({ user_id: favoriteUser.id, chapter_id: chapter.id }); if (insertError) throw insertError; setFavoriteSaved(true); } } catch (err) { console.error('Favourite toggle failed:', err); setFavoriteError(err?.message || 'Unable to update favourite.'); } finally { setFavoriteBusy(false); } };
  if (loading) return <main className="reader-page"><LoadingState label="Opening chapter…"/></main>;
  if (error) return <main className="reader-page"><div className="reader-error"><div>⌁</div><h2>{error}</h2><button className="primary-button" onClick={onBack}>Back to chapters</button></div></main>; if (!chapter) return <main className="reader-page"><div className="reader-error"><div>⌁</div><h2>Chapter not found.</h2><button className="primary-button" onClick={onBack}>Back to chapters</button></div></main>; if (!pages.length) return null;
  const progress = ((index + 1) / pages.length) * 100;
  const protectedChapter = Number(chapter?.chapterNumber) > 8;
  const currentPageUrl = protectedChapter ? protectedUrls[index] : pages[index];
  const readerLanguage = normalizeChapterLanguage(chapter.language);
  const languageChapters = (chapters || []).filter(item => normalizeChapterLanguage(item.language) === readerLanguage);
  const chapterIndex = languageChapters.findIndex(item => String(item.id) === String(chapter.id));
  const previousChapter = chapterIndex > 0 ? languageChapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex >= 0 && chapterIndex < languageChapters.length - 1 ? languageChapters[chapterIndex + 1] : null;
  return <main className="reader-page" data-chapter-id={String(chapter.id)}><header className="reader-header"><div className="reader-header-inner"><button className="reader-back" onClick={onBack} aria-label="Back to chapters">←</button><div className="reader-title"><p>{chapter.chapterNumber != null && String(chapter.chapterNumber).trim() !== '' ? String(chapter.chapterNumber).trim() : ''}</p></div><div className="reader-engagement"><button type="button" className={`reader-favorite-button${favoriteSaved ? ' is-saved' : ''}`} onClick={toggleFavorite} disabled={favoriteBusy} aria-label={favoriteSaved ? 'Remove from favourites' : favoriteUser ? 'Add to favourites' : 'Sign in to add to favourites'} title={favoriteSaved ? 'Remove from favourites' : favoriteUser ? 'Add to favourites' : 'Sign in to add to favourites'} aria-busy={favoriteBusy}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg></button><button type="button" className="reader-engagement-button reader-rating-button" onClick={() => setRatingOpen(true)} aria-label="Rate chapter"><span>★</span>{stats.rating.count ? stats.rating.average.toFixed(1) : '—'}</button><button type="button" className="reader-engagement-button reader-comments-button" onClick={() => setCommentsOpen(true)} aria-label="Open comments"><span>💬</span>{formatCount(stats.comments || 0)}</button><button type="button" className="reader-share-button" onClick={async () => { const shareUrl = chapterCanonicalUrl(chapter); const shareNumber = chapter.chapterNumber != null && String(chapter.chapterNumber).trim() !== '' ? String(chapter.chapterNumber).trim() : ''; const shareTitle = shareNumber ? `Atma Rekha ${shareNumber}` : 'Atma Rekha'; const shareText = shareNumber ? `Read Atma Rekha ${shareNumber}.` : 'Read Atma Rekha.'; try { if (navigator.share) { await navigator.share({ title: shareTitle || 'Atma Rekha', text: shareText, url: shareUrl }); await recordChapterShare(chapter.id); } else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(shareUrl); await recordChapterShare(chapter.id); window.dispatchEvent(new CustomEvent('atma-toast', { detail: { message: 'Chapter link copied.' } })); } } catch (shareError) { if (shareError?.name !== 'AbortError') console.warn('Chapter share failed:', shareError); } }} aria-label="Share" title="Share"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m8 11 7.7-4.2M8 13l7.7 4.2"/></svg></button><span className="reader-page-pill">{index + 1}/{pages.length}</span>{favoriteError && <span className="reader-favorite-status" role="status" aria-live="polite">{favoriteError}</span>}</div></div><div className="reader-progress"><span style={{ width: `${progress}%` }}/></div></header><section className="reader-content"><div className="reader-stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onDoubleClick={event => { if (event.target?.tagName === 'IMG') { if (!document.fullscreenElement) event.target.requestFullscreen?.(); else document.exitFullscreen?.(); } }}>{currentPageUrl ? <img src={currentPageUrl} alt={`${formatChapterLabel(chapter.chapterNumber, { title: chapter.title })} page ${index + 1}`} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} draggable="false"/> : <LoadingState label="Loading page…"/>}<button className="reader-side-button left" onClick={() => setIndex(value => Math.max(value - 1, 0))} disabled={index === 0} aria-label="Previous page">‹</button><button className="reader-side-button right" onClick={() => setIndex(value => Math.min(value + 1, pages.length - 1))} disabled={index === pages.length - 1} aria-label="Next page">›</button></div><div className="reader-info-row"><span>Page {index + 1} of {pages.length}</span><span>{offlineSourceSavedAt ? 'Offline copy · ' + new Date(offlineSourceSavedAt).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '👁 ' + formatCount(stats.views)}</span></div><div className="reader-controls"><button className="reader-control secondary" disabled={index === 0} onClick={() => setIndex(value => Math.max(value - 1, 0))}>← <span>Previous</span></button><div className="reader-counter"><strong>{index + 1} / {pages.length}</strong><span>PAGE</span></div><button className="reader-control primary" disabled={index === pages.length - 1} onClick={() => setIndex(value => Math.min(value + 1, pages.length - 1))}><span>Next</span> →</button><button type="button" className="reader-control secondary offline-save-button" disabled={protectedChapter || offlineBusy} onClick={toggleOffline} title={protectedChapter ? 'Offline saving is available for free chapters.' : offlineSaved ? 'Remove offline copy' : 'Save this chapter for offline reading'} aria-label={protectedChapter ? 'Offline saving is unavailable for member chapters' : offlineSaved ? 'Remove chapter from offline reading' : 'Save chapter for offline reading'}>{offlineBusy ? <span className="button-spinner" aria-hidden="true"/> : offlineSaved ? '✓' : '↓'} <span>{offlineSaved ? 'Saved' : protectedChapter ? 'Online only' : 'Offline'}</span></button></div><nav className="reader-chapter-nav" aria-label="Chapter navigation">
  <div className="reader-chapter-nav-item">
    <button type="button" onClick={() => previousChapter && navigateChapter(previousChapter)} disabled={!previousChapter} aria-label={previousChapter ? 'Go to previous chapter' : 'No previous chapter'}>
      <strong>Previous ch</strong>
    </button>
  </div>
  <div className="reader-chapter-nav-item">
    <button type="button" onClick={() => nextChapter && navigateChapter(nextChapter)} disabled={!nextChapter} aria-label={nextChapter ? 'Go to next chapter' : 'No next chapter'}>
      <strong>Next ch</strong>
    </button>
  </div>
</nav></section>{ratingOpen && <RatingSheet chapter={chapter} summary={stats.rating} open onClose={() => setRatingOpen(false)} onChanged={async () => setStats(await fetchChapterEngagement(chapter.id))}/>} {commentsOpen && <CommentsPanel chapter={chapter} open onClose={() => setCommentsOpen(false)}/>}</main>;
}

function Home({ chapters }) { const [adminRole, setAdminRole] = useState(null); const [pdlplFeatured, setPdlplFeatured] = useState(null); const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'; const featured = [...chapters].reverse().find(chapter => chapter.cover && normalizeChapterLanguage(chapter.language) === 'hi')
    || [...chapters].reverse().find(chapter => chapter.cover)
    || chapters[chapters.length - 1];
  useEffect(() => { let active = true; buildPdlplChapters().then(rows => { if (!active) return; const featuredChapter = [...rows].reverse().find(chapter => published(chapter) && chapter.coverPath && String(chapter.language || 'hi').toLowerCase() === 'hi')
        || [...rows].reverse().find(chapter => published(chapter) && chapter.coverPath); setPdlplFeatured(featuredChapter || null); }).catch(() => { if (active) setPdlplFeatured(null); }); return () => { active = false; }; }, []); useEffect(() => { let active = true; supabase.auth.getUser().then(({ data: { user } }) => getAdminRole(user?.id).then(role => { if (active) setAdminRole(role); }).catch(() => { if (active) setAdminRole(null); })); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { getAdminRole(session?.user?.id).then(role => { if (active) setAdminRole(role); }).catch(() => { if (active) setAdminRole(null); }); }); return () => { active = false; listener.subscription.unsubscribe(); }; }, []); return <main className="home-page"><header className="home-header"><a className="brand-wordmark" href="#home">Atma Rekha</a><div className="flex items-center gap-2">{(adminRole === 'owner' || adminRole === 'admin') && <div className="flex items-center gap-3"><a className="admin-link" href="#admin" aria-label="Admin Panel"><span>Admin Panel</span></a></div>}</div></header><HomeAnnouncement target="atma" variant="pinned"/><section className="hero-card"><div className="hero-art">{featured?.cover ? <img src={featured.cover} alt="Atma Rekha" loading="eager"/> : <span className="hero-fallback">AR</span>}</div><div className="hero-copy"><h1>{STORY.title}</h1><p className="hero-description">{STORY.description}</p><a className="hero-button" href="/chapters">View Chapters →</a></div></section><ContinueReading chapters={chapters}/><HomeAnnouncement target="pdpkl" variant="pinned"/><section className="hero-card pdlpl-home-card" aria-labelledby="pdlpl-home-title"><div className="hero-art">{pdlplFeatured?.cover ? <img src={pdlplFeatured.cover} alt="Pal Do Pal Ke Lamhe" loading="eager"/> : <span className="hero-fallback">PDPL</span>}</div><div className="hero-copy"><p className="hero-eyebrow">SIDE STORY · SCHOOL LIFE</p><h1 id="pdlpl-home-title">Pal Do Pal Ke Lamhe</h1><p className="hero-description">Starts April 25, 2027</p><a className="hero-button" href="/pal-do-pal-ke-lamhe">View Chapters →</a></div></section><HomeAnnouncement variant="normal"/><Footer/></main>; }
function AccessDenied({ onExit }) { return <main className="site-shell"><div className="reader-error"><h2>Access Denied</h2><p>You don't have permission to access the Atma Rekha Admin Panel.</p><button className="primary-button" onClick={onExit}>Back to Home</button></div></main>; }
function AdminRoute({ onExit }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);
  const sessionUserIdRef = useRef(null);

  useEffect(() => {
    let active = true;
    let checkId = 0;

    const check = async nextSession => {
      const id = ++checkId;
      try {
        const currentSession = nextSession || (await supabase.auth.getSession()).data.session;
        if (!active || id !== checkId) return;

        if (!currentSession?.user) {
          sessionUserIdRef.current = null;
          setSession(null);
          setRole(null);
          setChecking(false);
          return;
        }

        sessionUserIdRef.current = currentSession.user.id;
        setSession(currentSession);
        setChecking(true);

        const nextRole = await getAdminRole(currentSession.user.id);
        if (!active || id !== checkId) return;

        setRole(nextRole);
        setChecking(false);
      } catch {
        if (!active || id !== checkId) return;
        setRole(null);
        setChecking(false);
      }
    };

    check();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        check(null);
        return;
      }

      // Token refreshes can happen while the admin is viewing another page.
      // Keep the existing admin session/role stable and only re-check when the
      // authenticated user actually changes.
      if (sessionUserIdRef.current === nextSession.user.id) {
        setSession(nextSession);
        return;
      }
      check(nextSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (checking) return <main className="site-shell"><LoadingState label="Checking admin access…"/></main>;
  if (!session) return <Suspense fallback={<main className="site-shell"><LoadingState label="Opening admin sign-in…"/></main>}><AdminLogin /></Suspense>;
  if (!(role === 'owner' || role === 'admin')) return <AccessDenied onExit={onExit}/>;
  return <Suspense fallback={<main className="site-shell"><LoadingState label="Opening admin panel…"/></main>}><AdminPanel onLogout={async () => { await supabase.auth.signOut(); onExit(); }}/></Suspense>;
}
function useHashRoute() { const [route, setRoute] = useState(() => getSiteRoute()); useEffect(() => { const update = () => setRoute(getSiteRoute()); window.addEventListener('hashchange', update); window.addEventListener('popstate', update); return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update); }; }, []); return route; }
export default function App() { const route = useHashRoute(); const [chapters, setChapters] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    const routeParts = route.split('/');
    const type = routeParts[0];
    let title = DEFAULT_SEO_TITLE;
    let description = DEFAULT_SEO_DESCRIPTION;
    let image = DEFAULT_SEO_IMAGE;
    let chapter = null;
    const author = {
      '@type': 'Person',
      name: 'Arkesh',
      url: SITE_URL + '/info/about',
      sameAs: ['https://www.instagram.com/atma.rekha/', 'https://youtube.com/@atmarekha'],
    };

    if (type === 'chapter') {
      chapter = findChapterForPath('/' + route, chapters);
      if (chapter) {
        const label = formatChapterLabel(chapter.chapterNumber, { title: chapter.title });
        title = 'Atma Rekha ' + label + (chapter.title ? ' | ' + chapter.title : '');
        description = shortSeoDescription(chapter.description, 'Read ' + label + ' of Atma Rekha, an Indian fantasy manga/comic exploring ancient traditions, spiritual concepts, mysterious powers and mythical beings.');
        image = chapter.cover || DEFAULT_SEO_IMAGE;
      }
    } else if (type === 'read-chapter') {
      const legacyId = legacyChapterIdFromHash('#' + route);
      chapter = chapters.find(item => String(item.id) === String(legacyId)) || null;
      if (chapter) {
        const label = formatChapterLabel(chapter.chapterNumber, { title: chapter.title });
        title = 'Atma Rekha ' + label + (chapter.title ? ' | ' + chapter.title : '');
        description = shortSeoDescription(chapter.description, 'Read ' + label + ' of Atma Rekha, an Indian fantasy manga/comic exploring ancient traditions, spiritual concepts, mysterious powers and mythical beings.');
        image = chapter.cover || DEFAULT_SEO_IMAGE;
      }
    } else if (type === 'chapters') {
      title = 'Atma Rekha | Chapters';
      description = 'Read the published chapters of Atma Rekha, an Indian fantasy manga/comic.';
    } else if (type === 'info') {
      const infoType = routeParts[1] || 'about';
      const labels = { about: 'About Atma Rekha', contact: 'Contact Atma Rekha', report: 'Report Atma Rekha Content', privacy: 'Atma Rekha Privacy Policy', terms: 'Atma Rekha Terms and Conditions' };
      title = 'Atma Rekha | ' + (labels[infoType] || 'About Atma Rekha');
      description = infoType === 'about' ? 'Learn about Atma Rekha, its creator Arkesh, its Indian fantasy adventure setting and how to read the manga.' : (labels[infoType] || 'Atma Rekha') + ' information from the official website.';
    } else if (type === 'pal-do-pal-ke-lamhe') {
      title = 'Atma Rekha | Pal Do Pal Ke Lamhe';
      description = 'Pal Do Pal Ke Lamhe is a school life side story from Atma Rekha, starting April 25, 2027.';
    } else if (type === '430') {
      title = '430 | Atma Rekha';
      description = 'Atma Rekha site error page.';
    } else if (type === 'not-found') {
      title = 'Page Not Found | Atma Rekha';
      description = 'The Atma Rekha page you requested could not be found.';
    }

    const publicRoute = type === '430'
      ? '/430'
      : type === 'chapters'
      ? '/chapters'
      : type === 'info' && ['about', 'contact', 'report', 'privacy', 'terms'].includes(routeParts[1])
        ? '/info/' + routeParts[1]
        : type === 'pal-do-pal-ke-lamhe'
          ? '/pal-do-pal-ke-lamhe'
          : type === 'privacy-center'
            ? '/privacy-center'
            : type === 'maintenance'
              ? '/maintenance'
              : type === '403'
                ? '/403'
                : type === '503'
                  ? '/503'
                  : '/';
    const canonicalUrl = chapter ? chapterCanonicalUrl(chapter) : SITE_URL + publicRoute;
    const chapterLanguage = chapter ? normalizeChapterLanguage(chapter.language) : 'en';
    const isPrivateRoute = ['admin', 'profile', 'membership', 'group-chat', 'community', 'privacy-center', '403', '503', 'maintenance'].includes(type) || type.endsWith('-admin');
    const isNotFound = type === 'not-found';
    const isErrorRoute = type === '430';
    upsertMeta('name', 'robots', isPrivateRoute || isNotFound || isErrorRoute ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setDocumentLanguage(chapterLanguage);
    clearAlternateLanguages();
    if (chapter && !isPrivateRoute) {
      const sameNumber = chapters.filter(item => {
        const a = item?.chapterNumber;
        const b = chapter?.chapterNumber;
        return a !== null && a !== undefined && a !== '' && b !== null && b !== undefined && b !== ''
          && String(a).trim() === String(b).trim();
      });
      const english = sameNumber.find(item => normalizeChapterLanguage(item.language) === 'en');
      const hindi = sameNumber.find(item => normalizeChapterLanguage(item.language) === 'hi');
      if (english) upsertAlternateLanguage('en-IN', chapterLanguageUrl(english, 'en'));
      if (hindi) upsertAlternateLanguage('hi-Latn-IN', chapterLanguageUrl(hindi, 'hi'));
      const fallback = hindi || english || chapter;
      upsertAlternateLanguage('x-default', chapterLanguageUrl(fallback, normalizeChapterLanguage(fallback.language)));
    }

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'author', 'Arkesh');
    upsertMeta('property', 'og:type', chapter ? 'article' : 'website');
    upsertMeta('property', 'og:locale', chapterLanguage === 'en' ? 'en_IN' : 'hi_IN');
    removeMeta('property', 'og:locale:alternate');
    if (chapter && !isPrivateRoute) upsertMeta('property', 'og:locale:alternate', chapterLanguage === 'en' ? 'hi_IN' : 'en_IN');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:image:alt', title);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image);
    upsertMeta('name', 'twitter:image:alt', title);
    upsertCanonical(canonicalUrl);
    removeMeta('property', 'article:published_time');
    removeMeta('property', 'article:author');
    if (chapter?.releaseDate) upsertMeta('property', 'article:published_time', new Date(chapter.releaseDate).toISOString());
    if (chapter) upsertMeta('property', 'article:author', 'Arkesh');

    const series = {
      '@type': 'CreativeWorkSeries',
      '@id': SITE_URL + '/#atma-rekha',
      name: 'Atma Rekha',
      genre: ['Fantasy', 'Adventure', 'Manga'],
      alternateName: 'Atma Rekha Fantasy Adventure Manga',
      description: DEFAULT_SEO_DESCRIPTION,
      keywords: 'Indian fantasy manga, Indian comic, fantasy adventure manga, spiritual fantasy, mythical beings, ancient traditions, Roman Hindi manga',
      author,
      inLanguage: ['en-IN', 'hi-Latn-IN'],
      url: SITE_URL + '/',
      image: DEFAULT_SEO_IMAGE
    };
    const graph = [
      {
        '@type': 'WebSite',
        '@id': SITE_URL + '/#website',
        sameAs: ['https://www.instagram.com/atma.rekha/', 'https://youtube.com/@atmarekha'],
        name: 'Atma Rekha',
        url: SITE_URL + '/',
        description: DEFAULT_SEO_DESCRIPTION,
        inLanguage: ['en-IN', 'hi-Latn-IN'],
        creator: author,
        about: ['Indian fantasy manga', 'Indian comic', 'ancient traditions', 'spiritual concepts', 'mysterious powers', 'mythical beings']
      },
      series
    ];
    const breadcrumb = buildBreadcrumbList(type, routeParts, chapter, title, canonicalUrl);
    if (breadcrumb) graph.push(breadcrumb);
    if (chapter) {
      graph.push({
        '@type': 'CreativeWork',
        '@id': canonicalUrl,
        name: title,
        headline: title,
        description,
        author,
        image,
        url: canonicalUrl,
        isPartOf: { '@id': series['@id'] },
        datePublished: chapter.releaseDate || chapter.createdAt || undefined,
        inLanguage: normalizeChapterLanguage(chapter.language) === 'en' ? 'en-IN' : 'hi-Latn-IN'
      });
    }
    upsertJsonLd({ '@context': 'https://schema.org', '@graph': graph });
  }, [route, chapters]);
 useEffect(() => {
    const onChapterLinkClick = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !isChapterPath(url.pathname)) return;
      event.preventDefault();
      window.history.pushState({}, '', url.pathname + url.search);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    document.addEventListener('click', onChapterLinkClick);
    return () => document.removeEventListener('click', onChapterLinkClick);
  }, []); useEffect(() => {
    if (!route.startsWith('read-chapter/') || !chapters.length) return;
    const legacyId = legacyChapterIdFromHash('#' + route);
    const chapter = chapters.find(item => String(item.id) === String(legacyId));
    if (!chapter) return;
    const nextPath = chapterPath(chapter);
    const nextUrl = new URL(nextPath, window.location.origin);
    if (window.location.pathname === nextUrl.pathname && window.location.search === nextUrl.search && !window.location.hash) return;
    window.history.replaceState({}, '', nextUrl.pathname + nextUrl.search);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [route, chapters]);
 useEffect(() => {
    captureMarketingAttribution();
  }, [route]);
 useEffect(() => { let cancelled = false; buildChapters().then(data => { if (!cancelled) setChapters(data.filter(published).sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber))); }).catch(err => { if (!cancelled) setError(err?.message || 'Unable to load chapters.'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []); useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [route]); if (route === 'not-found') return <NotFoundPage/>;
  if (route === '430') return <Error430Page/>;
  if (route === 'privacy-center') return <PrivacyCenter/>;
  if (route === '403') return <ForbiddenPage onBack={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>;
  if (route === '503') return <ServiceUnavailablePage/>;
  if (route === 'maintenance') return <MaintenancePage/>;
  if (route.startsWith('chapter/')) {
    const chapter = findChapterForPath('/' + route, chapters);
    if (loading) return <main className="reader-page"><LoadingState label="Opening chapter…"/></main>;
    if (!chapter) return <main className="reader-page"><div className="reader-error"><div>⌁</div><h2>Chapter not found.</h2><button className="primary-button" onClick={() => { window.history.pushState({}, '', '/chapters'); window.dispatchEvent(new PopStateEvent('popstate')); }}>Back to chapters</button></div></main>;
    return <Reader chapterId={chapter.id} onBack={() => { window.history.pushState({}, '', '/chapters'); window.dispatchEvent(new PopStateEvent('popstate')); }} chapters={chapters}/>;
  }
  const returnToAdmin = route === 'membership' && window.location.pathname.replace(/\/+$/, '') === '/admin';
  if (returnToAdmin || route === 'admin') return <AdminRoute onExit={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>
  if (route === 'pal-do-pal-ke-lamhe' || route.startsWith('pal-do-pal-ke-lamhe/')) return <PalDoPalKeLamhe/>; if (route.startsWith('info/')) return <InfoPage type={route.split('/')[1]} onBack={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>; if (route === 'chapters') return <ChapterList chapters={chapters} onBack={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>; if (route.startsWith('read-chapter/')) return <Reader chapterId={decodeURIComponent(route.slice('read-chapter/'.length))} onBack={() => { window.history.pushState({}, '', '/chapters'); window.dispatchEvent(new PopStateEvent('popstate')); }} chapters={chapters}/>; if (loading) return <main className="home-page"><LoadingState label="Loading Atma Rekha…"/></main>; if (error) return <main className="home-page"><div className="reader-error"><h2>{error}</h2><button className="primary-button" onClick={() => window.location.reload()}>Retry</button></div></main>; return <Home chapters={chapters}/>; }
