import { useEffect, useMemo, useRef, useState } from 'react';
import { buildChapters, buildChapterPages, formatChapterLabel, formatChapterEyebrow } from './chapters';
import AdminLogin from './AdminLogin';
import AdminPanel from './AdminPanel';
import Footer from './Footer';
import InfoPage from './InfoPage';
import HomeAnnouncement from './HomeAnnouncement';
import PalDoPalKeLamhe from './PalDoPalKeLamhe';
import PalDoPalAdmin from './PalDoPalAdmin';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import axios from 'axios';
import { addComment, fetchChapterComments, fetchChapterEngagement, fetchCommentLikes, fetchPublicEngagement, likeComment, recordChapterView, reportComment, submitRating } from './engagement';
import { chapterCanonicalUrl, chapterPath, findChapterForPath, getSiteRoute, isChapterPath, legacyChapterIdFromHash } from './routes';

const STORY = { title: 'Atma Rekha', eyebrow: 'INDIAN MANGA', description: 'Read Atma Rekha, an Indian mythical fantasy manga about ancient traditions, mysterious powers and mythical beings.' };
const SITE_URL = 'https://www.atmarekha.in';
const DEFAULT_SEO_TITLE = 'Atma Rekha | Indian Mythical Fantasy Manga';
const DEFAULT_SEO_DESCRIPTION = 'Read Atma Rekha, an Indian mythical fantasy manga about ancient traditions, mysterious powers and mythical beings.';
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
function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatCount(value) { const n = Number(value) || 0; return new Intl.NumberFormat('en-IN', { notation: n > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n); }
function LoadingState({ label = 'Loading…' }) { return <div className="loading-state"><span className="loading-spinner"/><p>{label}</p></div>; }
function EmptyState({ title, text }) { return <div className="empty-state"><h3>{title}</h3>{text && <p>{text}</p>}</div>; }
function IconButton({ label, children, onClick }) { return <button type="button" className="engagement-icon" onClick={onClick} aria-label={label} title={label}>{children}</button>; }

function RatingSheet({ chapter, summary, open, onClose, onChanged }) { const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); if (!open || !chapter) return null; const rate = async value => { if (busy) return; setBusy(true); setMessage(''); try { const result = await submitRating(chapter.id, value); setMessage(result.alreadyRated ? 'You already rated this chapter on this device.' : `Rated ${value}/10. Thank you.`); if (!result.alreadyRated) onChanged?.(); } catch (error) { setMessage(error?.message || 'Unable to save rating.'); } finally { setBusy(false); } }; return <div className="overlay-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="rating-sheet" role="dialog" aria-modal="true" aria-label="Rate chapter"><div className="sheet-head"><div><p className="section-eyebrow">{formatChapterEyebrow(chapter.chapterNumber, chapter.title)}</p><h2>Rate {chapter.title || 'this chapter'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></div><div className="rating-big"><strong>{summary?.count ? summary.average.toFixed(1) : '—'}</strong><span>/10 · {summary?.count || 0} ratings</span></div><div className="rating-scale" aria-label="Choose rating from 1 to 10">{Array.from({ length: 10 }, (_, index) => { const value = index + 1; return <button key={value} type="button" disabled={busy} onClick={() => rate(value)}><span>★</span><small>{value}</small></button>; })}</div>{message && <p className="sheet-message">{message}</p>}</section></div>; }

function CommentsPanel({ chapter, open, onClose }) { const [comments, setComments] = useState([]); const [likeState, setLikeState] = useState({ counts: {}, liked: {} }); const [reported, setReported] = useState({}); const [name, setName] = useState(() => window.localStorage.getItem('atma-rekha-comment-name') || 'Reader'); const [content, setContent] = useState(''); const [replyTo, setReplyTo] = useState(null); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const load = async () => { if (!chapter?.id) return; setLoading(true); setError(''); try { const rows = await fetchChapterComments(chapter.id); setComments(rows); setLikeState(await fetchCommentLikes(rows.map(row => row.id))); } catch (err) { setError(err?.message || 'Unable to load comments.'); } finally { setLoading(false); } }; useEffect(() => { if (open) load(); }, [open, chapter?.id]); const topLevel = useMemo(() => comments.filter(comment => !comment.parent_comment_id), [comments]); const replies = useMemo(() => comments.filter(comment => comment.parent_comment_id), [comments]); const post = async event => { event.preventDefault(); if (busy || !content.trim()) return; setBusy(true); setError(''); try { const cleanName = name.trim().slice(0, 80) || 'Reader'; window.localStorage.setItem('atma-rekha-comment-name', cleanName); const row = await addComment({ chapterId: chapter.id, content, authorName: cleanName, parentCommentId: replyTo }); setComments(previous => [...previous, row]); setContent(''); setReplyTo(null); } catch (err) { setError(err?.message || 'Unable to post comment.'); } finally { setBusy(false); } }; const like = async id => { if (likeState.liked[id]) return; try { await likeComment(id); setLikeState(previous => ({ counts: { ...previous.counts, [id]: (previous.counts[id] || 0) + 1 }, liked: { ...previous.liked, [id]: true } })); } catch (err) { setError(err?.message || 'Unable to like comment.'); } }; const report = async id => { if (reported[id]) return; try { await reportComment(id); setReported(previous => ({ ...previous, [id]: true })); } catch (err) { setError(err?.message || 'Unable to report comment.'); } }; if (!open) return null; return <div className="comment-sheet-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="comment-sheet" role="dialog" aria-modal="true" aria-label="Chapter comments"><div className="comment-sheet-head"><div><p className="section-eyebrow">{formatChapterEyebrow(chapter.chapterNumber, chapter.title)}</p><h2>Comments <span>{comments.length}</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close comments">×</button></div><div className="comment-list">{loading ? <LoadingState label="Loading comments…"/> : error && !comments.length ? <EmptyState title="Comments unavailable" text={error}/> : !topLevel.length ? <EmptyState title="No comments yet" text="Be the first reader to share a thought."/> : topLevel.map(comment => <Comment key={comment.id} comment={comment} replies={replies.filter(reply => reply.parent_comment_id === comment.id)} likes={likeState} reported={reported} onLike={like} onReply={setReplyTo} onReport={report}/>)}</div>{error && <p className="form-error">{error}</p>}<form className="comment-form" onSubmit={post}><div className="comment-form-title">{replyTo ? <><span>Replying to a reader</span><button type="button" onClick={() => setReplyTo(null)}>Cancel</button></> : <span>Join the conversation</span>}</div><input value={name} onChange={event => setName(event.target.value.slice(0, 80))} placeholder="Your name" aria-label="Your name"/><textarea value={content} onChange={event => setContent(event.target.value.slice(0, 2000))} placeholder={replyTo ? 'Write a reply…' : 'What did you think?'} rows="3" required/><button className="primary-button" disabled={busy}>{busy ? 'Posting…' : replyTo ? 'Post reply' : 'Post comment'}</button></form></section></div>; }
function Comment({ comment, replies, likes, reported, onLike, onReply, onReport }) { return <article className="comment-item"><div className="comment-avatar">{(comment.author_name || 'R').slice(0, 1).toUpperCase()}</div><div className="comment-body"><div className="comment-meta"><strong>{comment.author_name || 'Reader'}</strong><time>{formatDate(comment.created_at)}</time></div><p>{comment.content}</p><div className="comment-actions"><button type="button" onClick={() => onLike(comment.id)} className={likes.liked[comment.id] ? 'is-liked' : ''}>♥ {likes.counts[comment.id] || 0}</button><button type="button" onClick={() => onReply(comment.id)}>Reply</button><button type="button" onClick={() => onReport(comment.id)} disabled={reported[comment.id]}>{reported[comment.id] ? 'Reported' : 'Report'}</button></div>{replies.length > 0 && <div className="comment-replies">{replies.map(reply => <div className="comment-reply" key={reply.id}><div className="comment-avatar small">{(reply.author_name || 'R').slice(0, 1).toUpperCase()}</div><div className="comment-body"><div className="comment-meta"><strong>{reply.author_name || 'Reader'}</strong><time>{formatDate(reply.created_at)}</time></div><p>{reply.content}</p><div className="comment-actions"><button type="button" onClick={() => onLike(reply.id)} className={likes.liked[reply.id] ? 'is-liked' : ''}>♥ {likes.counts[reply.id] || 0}</button><button type="button" onClick={() => onReport(reply.id)} disabled={reported[reply.id]}>{reported[reply.id] ? 'Reported' : 'Report'}</button></div></div></div>)}</div>}</div></article>; }

function ChapterList({ chapters, onBack }) { const [stats, setStats] = useState({}); const [pageCounts, setPageCounts] = useState({}); const [ratingChapter, setRatingChapter] = useState(null); const [commentChapter, setCommentChapter] = useState(null); const [loading, setLoading] = useState(true); const refresh = async () => { if (!chapters.length) { setLoading(false); return; } setLoading(true); try { const ids = chapters.map(chapter => chapter.id); const engagement = await fetchPublicEngagement(ids); const counts = Object.fromEntries(ids.map(id => [id, Number(engagement[id]?.pages) || 0])); setStats(engagement); setPageCounts(counts); } catch (error) { console.error('Chapter list data:', error); } finally { setLoading(false); } }; useEffect(() => { refresh(); }, [chapters]); return <main className="site-shell chapter-list-page"><header className="subpage-header"><button className="back-button" onClick={onBack} aria-label="Back to home">←</button><div><p className="header-kicker">ATMA REKHA</p><h1>Chapter List</h1></div></header><section className="chapter-list-section"><div className="chapter-list-heading"><p>{chapters.length} published {chapters.length === 1 ? 'chapter' : 'chapters'}</p><span>RATING · DATE · VIEWS</span></div>{loading ? <LoadingState/> : <div className="chapter-list">{chapters.map(chapter => { const item = stats[chapter.id] || { rating: { average: 0, count: 0 }, views: 0, comments: 0 }; return <article className="chapter-row" key={chapter.id} data-chapter-id={String(chapter.id)}><a className="chapter-row-main" href={chapterPath(chapter)}><div className="chapter-row-title"><span>{formatChapterLabel(chapter.chapterNumber, { title: chapter.title })}</span><h2>{chapter.title || 'Untitled chapter'}</h2></div><div className="chapter-row-meta"><span>{item.rating.count ? `${item.rating.average.toFixed(1)}/10` : '—'} <b>★</b></span><span>•</span><span>{formatDate(chapter.releaseDate || chapter.createdAt)}</span><span>•</span><span>👁 {formatCount(item.views)}</span></div><div className="chapter-row-details"><span>📄 {pageCounts[chapter.id] || 0} pages</span></div></a><div className="chapter-row-actions"><IconButton label={`Rate ${formatChapterLabel(chapter.chapterNumber, { title: chapter.title })}`} onClick={() => setRatingChapter(chapter)}><span>★</span><small>{item.rating.count ? item.rating.average.toFixed(1) : '—'}</small></IconButton><IconButton label={`Comments for ${formatChapterLabel(chapter.chapterNumber, { title: chapter.title })}`} onClick={() => setCommentChapter(chapter)}><span>💬</span><small>{formatCount(item.comments)}</small></IconButton></div></article>; })}</div>}</section><Footer/>{ratingChapter && <RatingSheet chapter={ratingChapter} summary={stats[ratingChapter.id]?.rating} open onClose={() => setRatingChapter(null)} onChanged={refresh}/>} {commentChapter && <CommentsPanel chapter={commentChapter} open onClose={() => setCommentChapter(null)}/>}</main>; }

function Reader({ chapterId, onBack, chapters }) {
  const [chapter, setChapter] = useState(null); const [pages, setPages] = useState([]); const [index, setIndex] = useState(0); const [stats, setStats] = useState({ rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0 }); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [ratingOpen, setRatingOpen] = useState(false); const [commentsOpen, setCommentsOpen] = useState(false); const [touchStart, setTouchStart] = useState(null); const [touchEnd, setTouchEnd] = useState(null); const [favoriteUser, setFavoriteUser] = useState(null); const [favoriteSaved, setFavoriteSaved] = useState(false); const [favoriteBusy, setFavoriteBusy] = useState(false); const [favoriteError, setFavoriteError] = useState('');
  const minSwipeDistance = 50;
  const onTouchStart = event => { setTouchEnd(null); setTouchStart(event.targetTouches[0].clientX); };
  const onTouchMove = event => { setTouchEnd(event.targetTouches[0].clientX); };
  const onTouchEnd = () => { if (touchStart === null || touchEnd === null) return; const distance = touchStart - touchEnd; if (Math.abs(distance) < minSwipeDistance) return; if (distance > 0) setIndex(value => Math.min(value + 1, pages.length - 1)); else setIndex(value => Math.max(value - 1, 0)); setTouchStart(null); setTouchEnd(null); };
  useEffect(() => { let cancelled = false; const load = async () => { setLoading(true); setError(''); try { const all = chapters?.length ? chapters : await buildChapters(); const found = all.find(item => String(item.id) === String(chapterId)); if (!found || !published(found)) throw new Error('Chapter not found or not published.'); const [livePages] = await Promise.all([buildChapterPages(found.id), recordChapterView(found.id).catch(viewError => { console.warn('View tracking skipped:', viewError); })]); const engagement = await fetchChapterEngagement(found.id); if (cancelled) return; setChapter(found); setPages(livePages); setStats(engagement); const saved = Number(window.localStorage.getItem(`atma-reading:${found.id}`)); setIndex(Number.isInteger(saved) && saved >= 0 && saved < livePages.length ? saved : 0); } catch (err) { if (!cancelled) setError(err?.message || 'Unable to load this chapter.'); } finally { if (!cancelled) setLoading(false); } }; load(); return () => { cancelled = true; }; }, [chapterId, chapters]);
  useEffect(() => { if (chapter && pages.length) window.localStorage.setItem(`atma-reading:${chapter.id}`, String(index)); }, [chapter, pages.length, index]);
  useEffect(() => {
    if (!pages.length) return undefined;
    const urls = [pages[index + 1], pages[index + 2]].filter(Boolean);
    const images = urls.map(url => { const image = new Image(); image.decoding = 'async'; image.src = url; return image; });
    return () => { images.forEach(image => { image.src = ''; }); };
  }, [index, pages]);
  useEffect(() => { if (chapter && pages.length > 0) { window.dispatchEvent(new CustomEvent('atma-reading-progress', { detail: { chapterId: chapter.id, pageNumber: index + 1 } })); } }, [chapter, index, pages.length]);
  useEffect(() => { const keyHandler = event => { if (event.key === 'ArrowRight' || event.key === ' ') setIndex(value => Math.min(value + 1, pages.length - 1)); if (event.key === 'ArrowLeft') setIndex(value => Math.max(value - 1, 0)); if (event.key === 'Escape') { setRatingOpen(false); setCommentsOpen(false); } }; window.addEventListener('keydown', keyHandler); return () => window.removeEventListener('keydown', keyHandler); }, [pages.length]);
  useEffect(() => { let active = true; supabase.auth.getUser().then(({ data }) => { if (active) setFavoriteUser(data?.user || null); }); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setFavoriteUser(session?.user || null); }); return () => { active = false; listener.subscription.unsubscribe(); }; }, []);
  useEffect(() => { let cancelled = false; setFavoriteSaved(false); setFavoriteError(''); if (!favoriteUser || !chapter?.id) return undefined; supabase.from('bookmarks').select('id').eq('user_id', favoriteUser.id).eq('chapter_id', chapter.id).maybeSingle().then(({ data, error: bookmarkError }) => { if (cancelled) return; if (bookmarkError) setFavoriteError(bookmarkError.message || 'Unable to load favourite status.'); else setFavoriteSaved(Boolean(data)); }); return () => { cancelled = true; }; }, [favoriteUser?.id, chapter?.id]);
  const toggleFavorite = async () => { if (favoriteBusy || !chapter?.id) return; if (!favoriteUser) { window.dispatchEvent(new CustomEvent('atma-open-auth', { detail: { mode: 'login' } })); return; } setFavoriteBusy(true); setFavoriteError(''); try { if (favoriteSaved) { const { error: deleteError } = await supabase.from('bookmarks').delete().eq('user_id', favoriteUser.id).eq('chapter_id', chapter.id); if (deleteError) throw deleteError; setFavoriteSaved(false); } else { const { error: insertError } = await supabase.from('bookmarks').insert({ user_id: favoriteUser.id, chapter_id: chapter.id }); if (insertError) throw insertError; setFavoriteSaved(true); } } catch (err) { console.error('Favourite toggle failed:', err); setFavoriteError(err?.message || 'Unable to update favourite.'); } finally { setFavoriteBusy(false); } };
  if (loading) return <main className="reader-page"><LoadingState label="Opening chapter…"/></main>;
  if (error) return <main className="reader-page"><div className="reader-error"><div>⌁</div><h2>{error}</h2><button className="primary-button" onClick={onBack}>Back to chapters</button></div></main>; if (!chapter) return <main className="reader-page"><div className="reader-error"><div>⌁</div><h2>Chapter not found.</h2><button className="primary-button" onClick={onBack}>Back to chapters</button></div></main>; if (!pages.length) return <main className="reader-page"><div className="reader-error"><div>⌁</div><h2>This chapter has no readable pages yet.</h2><button className="primary-button" onClick={onBack}>Back to chapters</button></div></main>;
  const finite = (n) => { if (n === null || n === undefined || n === '') return null; const v = Number(n); return Number.isFinite(v) ? v : null; }; const currentNum = finite(chapter.chapterNumber); const publishedList = chapters.filter(published); let previousChapter = null; let nextChapter = null; if (currentNum !== null) { previousChapter = [...publishedList].reverse().find((item) => { const n = finite(item.chapterNumber); return n !== null && n < currentNum; }); nextChapter = publishedList.find((item) => { const n = finite(item.chapterNumber); return n !== null && n > currentNum; }); } const progress = ((index + 1) / pages.length) * 100;
  return <main className="reader-page" data-chapter-id={String(chapter.id)}><header className="reader-header"><div className="reader-header-inner"><button className="reader-back" onClick={onBack} aria-label="Back to chapters">←</button><div className="reader-title"><p>{formatChapterLabel(chapter.chapterNumber, { title: null })}</p></div><div className="reader-engagement"><button type="button" className={`reader-favorite-button${favoriteSaved ? ' is-saved' : ''}`} onClick={toggleFavorite} disabled={favoriteBusy} aria-label={favoriteSaved ? 'Remove from favourites' : favoriteUser ? 'Add to favourites' : 'Sign in to add to favourites'} title={favoriteSaved ? 'Remove from favourites' : favoriteUser ? 'Add to favourites' : 'Sign in to add to favourites'} aria-busy={favoriteBusy}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg></button><button type="button" className="reader-engagement-button reader-rating-button" onClick={() => setRatingOpen(true)} aria-label="Rate chapter"><span>★</span>{stats.rating.count ? stats.rating.average.toFixed(1) : '—'}</button><button type="button" className="reader-engagement-button reader-comments-button" onClick={() => setCommentsOpen(true)} aria-label="Open comments"><span>💬</span>{formatCount(stats.comments || 0)}</button><span className="reader-page-pill">{index + 1}/{pages.length}</span>{favoriteError && <span className="reader-favorite-status" role="status" aria-live="polite">{favoriteError}</span>}</div></div><div className="reader-progress"><span style={{ width: `${progress}%` }}/></div></header><section className="reader-content"><div className="reader-stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onDoubleClick={event => { if (event.target?.tagName === 'IMG') { if (!document.fullscreenElement) event.target.requestFullscreen?.(); else document.exitFullscreen?.(); } }}><img src={pages[index]} alt={`${formatChapterLabel(chapter.chapterNumber, { title: chapter.title })} page ${index + 1}`} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} draggable="false"/><button className="reader-side-button left" onClick={() => setIndex(value => Math.max(value - 1, 0))} disabled={index === 0} aria-label="Previous page">‹</button><button className="reader-side-button right" onClick={() => setIndex(value => Math.min(value + 1, pages.length - 1))} disabled={index === pages.length - 1} aria-label="Next page">›</button></div><div className="reader-info-row"><span>Page {index + 1} of {pages.length}</span><span>👁 {formatCount(stats.views)}</span></div><div className="reader-controls"><button className="reader-control secondary" disabled={index === 0} onClick={() => setIndex(value => Math.max(value - 1, 0))}>← <span>Previous</span></button><div className="reader-counter"><strong>{index + 1} / {pages.length}</strong><span>PAGE</span></div><button className="reader-control primary" disabled={index === pages.length - 1} onClick={() => setIndex(value => Math.min(value + 1, pages.length - 1))}><span>Next</span> →</button></div><div className="reader-chapter-nav">{previousChapter ? <a href={chapterPath(previousChapter)}>← Chapter {previousChapter.chapterNumber}</a> : <span/>}{nextChapter ? <a href={chapterPath(nextChapter)}>Chapter {nextChapter.chapterNumber} →</a> : <span/>}</div></section>{ratingOpen && <RatingSheet chapter={chapter} summary={stats.rating} open onClose={() => setRatingOpen(false)} onChanged={async () => setStats(await fetchChapterEngagement(chapter.id))}/>} {commentsOpen && <CommentsPanel chapter={chapter} open onClose={() => setCommentsOpen(false)}/>}</main>;
}

function Home({ chapters }) { const [adminRole, setAdminRole] = useState(null); const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'; const featured = [...chapters].reverse().find(chapter => chapter.cover) || chapters[chapters.length - 1]; useEffect(() => { let active = true; supabase.auth.getUser().then(({ data: { user } }) => getAdminRole(user?.id).then(role => { if (active) setAdminRole(role); }).catch(() => { if (active) setAdminRole(null); })); const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { getAdminRole(session?.user?.id).then(role => { if (active) setAdminRole(role); }).catch(() => { if (active) setAdminRole(null); }); }); return () => { active = false; listener.subscription.unsubscribe(); }; }, []); return <main className="home-page"><header className="home-header"><a className="brand-wordmark" href="#home">Atma Rekha</a><div className="flex items-center gap-2">{(adminRole === 'owner' || adminRole === 'admin') && <div className="flex items-center gap-3"><a className="admin-link" href="#admin" aria-label="Admin Panel"><span>Admin Panel</span></a></div>}</div></header><HomeAnnouncement target="atma" variant="pinned"/><section className="hero-card"><div className="hero-art">{featured?.cover ? <img src={featured.cover} alt="Atma Rekha" loading="eager"/> : <span className="hero-fallback">AR</span>}</div><div className="hero-copy"><p className="hero-eyebrow">{STORY.eyebrow}</p><h1>{STORY.title}</h1><p className="hero-description">{STORY.description}</p><a className="hero-button" href="/chapters">View Chapters →</a></div></section><HomeAnnouncement target="pdpkl" variant="pinned"/><section className="hero-card pdlpl-home-card" aria-labelledby="pdlpl-home-title"><div className="hero-art"><span className="hero-fallback pdlpl-home-fallback">PDPL</span></div><div className="hero-copy"><p className="hero-eyebrow">SIDE STORY · SCHOOL LIFE</p><h1 id="pdlpl-home-title">Pal Do Pal Ke Lamhe</h1><p className="hero-description">Thinking About It. Not Today, but Some Day</p><a className="hero-button" href="/pal-do-pal-ke-lamhe">View Chapters →</a></div></section><HomeAnnouncement variant="normal"/><Footer/></main>; }
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
  if (!session || !(role === 'owner' || role === 'admin')) return <AccessDenied onExit={onExit}/>;
  return <AdminPanel onLogout={async () => { await supabase.auth.signOut(); onExit(); }}/>;
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
    const author = { '@type': 'Person', name: 'Arkesh' };

    if (type === 'chapter') {
      chapter = findChapterForPath('/' + route, chapters);
      if (chapter) {
        const label = formatChapterLabel(chapter.chapterNumber, { title: chapter.title });
        title = 'Atma Rekha ' + label + (chapter.title ? ' | ' + chapter.title : '');
        description = shortSeoDescription(chapter.description, 'Read ' + label + ' of Atma Rekha, an Indian mythical fantasy manga about ancient traditions, mysterious powers and mythical beings.');
        image = chapter.cover || DEFAULT_SEO_IMAGE;
      }
    } else if (type === 'read-chapter') {
      const legacyId = legacyChapterIdFromHash('#' + route);
      chapter = chapters.find(item => String(item.id) === String(legacyId)) || null;
      if (chapter) {
        const label = formatChapterLabel(chapter.chapterNumber, { title: chapter.title });
        title = 'Atma Rekha ' + label + (chapter.title ? ' | ' + chapter.title : '');
        description = shortSeoDescription(chapter.description, 'Read ' + label + ' of Atma Rekha, an Indian mythical fantasy manga about ancient traditions, mysterious powers and mythical beings.');
        image = chapter.cover || DEFAULT_SEO_IMAGE;
      }
    } else if (type === 'chapters') {
      title = 'Atma Rekha | Chapters';
      description = 'Read the published chapters of Atma Rekha, an Indian mythical fantasy manga.';
    } else if (type === 'info') {
      const infoType = routeParts[1] || 'about';
      const labels = { about: 'About Atma Rekha', contact: 'Contact Atma Rekha', report: 'Report Atma Rekha Content', privacy: 'Atma Rekha Privacy Policy', terms: 'Atma Rekha Terms and Conditions' };
      title = 'Atma Rekha | ' + (labels[infoType] || 'About Atma Rekha');
      description = infoType === 'about' ? 'Learn about Atma Rekha, its creator Arkesh, its Indian mythical fantasy setting and how to read the manga.' : (labels[infoType] || 'Atma Rekha') + ' information from the official website.';
    } else if (type === 'pal-do-pal-ke-lamhe') {
      title = 'Atma Rekha | Pal Do Pal Ke Lamhe';
      description = 'Pal Do Pal Ke Lamhe is a school life side story from Atma Rekha.';
    }

    const publicRoute = type === 'chapters'
      ? '/chapters'
      : type === 'info' && ['about', 'contact', 'report', 'privacy', 'terms'].includes(routeParts[1])
        ? '/info/' + routeParts[1]
        : type === 'pal-do-pal-ke-lamhe'
          ? '/pal-do-pal-ke-lamhe'
          : '/';
    const canonicalUrl = chapter ? chapterCanonicalUrl(chapter) : SITE_URL + publicRoute;
    const isPrivateRoute = ['admin', 'profile', 'membership', 'group-chat', 'community'].includes(type) || type.endsWith('-admin');
    upsertMeta('name', 'robots', isPrivateRoute ? 'noindex,nofollow,noarchive' : 'index,follow');

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'author', 'Arkesh');
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

    const series = {
      '@type': 'CreativeWorkSeries',
      '@id': SITE_URL + '/#atma-rekha',
      name: 'Atma Rekha',
      genre: ['Mythical Fantasy', 'Adventure'],
      author,
      inLanguage: 'en-IN',
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
        inLanguage: 'en-IN'
      },
      series
    ];
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
        datePublished: chapter.releaseDate || chapter.createdAt || undefined
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
    if (window.location.pathname === nextPath && !window.location.hash) return;
    window.history.replaceState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [route, chapters]); useEffect(() => { let cancelled = false; buildChapters().then(data => { if (!cancelled) setChapters(data.filter(published).sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber))); }).catch(err => { if (!cancelled) setError(err?.message || 'Unable to load chapters.'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []); useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [route]); if (route.startsWith('chapter/')) {
    const chapter = findChapterForPath('/' + route, chapters);
    if (loading) return <main className="reader-page"><LoadingState label="Opening chapter…"/></main>;
    if (!chapter) return <main className="reader-page"><div className="reader-error"><div>⌁</div><h2>Chapter not found.</h2><button className="primary-button" onClick={() => { window.history.pushState({}, '', '/chapters'); window.dispatchEvent(new PopStateEvent('popstate')); }}>Back to chapters</button></div></main>;
    return <Reader chapterId={chapter.id} onBack={() => { window.history.pushState({}, '', '/chapters'); window.dispatchEvent(new PopStateEvent('popstate')); }} chapters={chapters}/>;
  }
  const returnToAdmin = route === 'membership' && window.location.pathname.replace(/\/+$/, '') === '/admin';
  if (returnToAdmin || route === 'admin') return <AdminRoute onExit={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>
  if (route === 'pal-do-pal-admin' || route === 'pdpl-admin' || route === 'pal-do-pal-ke-lamhe-admin') return <PalDoPalAdmin/>;
  if (route === 'pal-do-pal-ke-lamhe' || route.startsWith('pal-do-pal-ke-lamhe/')) return <PalDoPalKeLamhe/>; if (route.startsWith('info/')) return <InfoPage type={route.split('/')[1]} onBack={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>; if (route === 'chapters') return <ChapterList chapters={chapters} onBack={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}/>; if (route.startsWith('read-chapter/')) return <Reader chapterId={decodeURIComponent(route.slice('read-chapter/'.length))} onBack={() => { window.history.pushState({}, '', '/chapters'); window.dispatchEvent(new PopStateEvent('popstate')); }} chapters={chapters}/>; if (loading) return <main className="home-page"><LoadingState label="Loading Atma Rekha…"/></main>; if (error) return <main className="home-page"><div className="reader-error"><h2>{error}</h2><button className="primary-button" onClick={() => window.location.reload()}>Retry</button></div></main>; return <Home chapters={chapters}/>; }
