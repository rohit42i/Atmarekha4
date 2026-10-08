import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Footer from './Footer';
import {
  buildPdlplChapterPages,
  buildPdlplChapters,
  buildPdlplPageCounts,
  getPdlplMemberAccess,
  PDLPL_ROUTE,
  published,
} from './palDoPalKeLamhe';
import { fetchPdlplMedia, getPdlplMediaUrl } from './pdlplR2';
import { fetchPdlplPublicEngagement, fetchPdlplChapterEngagement, getPdlplBookmark, togglePdlplBookmark, recordPdlplChapterView, recordPdlplChapterShare, submitPdlplRating, getPdlplReadingProgress, savePdlplReadingProgress } from './pdlplEngagement';
import { supabase } from './supabase';
import './pal-do-pal-ke-lamhe.css';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatLabel(chapter) {
  return chapter?.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'Special';
}

const PDPKL_MEMBERSHIP_CONTEXT_KEY = 'pdlpl-membership-context';

function openPdlplMembership(chapter) {
  try {
    window.sessionStorage.setItem(PDPKL_MEMBERSHIP_CONTEXT_KEY, JSON.stringify({
      source: 'pdpkl',
      chapterNumber: chapter?.chapterNumber ?? null,
      title: chapter?.title || '',
    }));
  } catch {}
  window.location.hash = 'membership';
}

function LockedModal({ chapter, onClose, user, planId }) {
  const hasUser = Boolean(user);
  const isAtmaOnlyPlan = String(planId || '').trim().toLowerCase() === 'mini_member';
  const title = isAtmaOnlyPlan
    ? 'Upgrade to unlock this chapter.'
    : hasUser
      ? 'Unlock this chapter with membership.'
      : 'PDPKL is for members.';
  const copy = isAtmaOnlyPlan
    ? 'Your current ₹19 Supporter plan is for Atma Rekha only. Upgrade to ₹29 Premium Supporter or ₹49 Super Supporter to access all of Pal Do Pal Ke Lamhe from Chapter 1 onward.'
    : hasUser
      ? 'All of Pal Do Pal Ke Lamhe is members-only from Chapter 1 onward. Choose ₹29 Premium Supporter or ₹49 Super Supporter to access the story.'
      : 'All of Pal Do Pal Ke Lamhe is members-only from Chapter 1 onward. Sign in, then choose ₹29 Premium Supporter or ₹49 Super Supporter to access the story.';
  const cta = isAtmaOnlyPlan ? 'Upgrade membership' : hasUser ? 'Choose membership' : 'Sign in & choose membership';

  return (
    <div className="chapter-access-overlay" role="dialog" aria-modal="true" aria-label="PDPKL membership required">
      <button className="chapter-access-backdrop" aria-label="Close" onClick={onClose} />
      <section className="chapter-access-modal">
        <button className="chapter-access-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <div className="chapter-access-icon" aria-hidden="true">🦚</div>
        <p className="chapter-access-eyebrow">PAL DO PAL KE LAMHE · CHAPTER {chapter?.chapterNumber || 1}</p>
        <h2>{isAtmaOnlyPlan ? 'Your membership does not include PDPKL.' : title}</h2>
        <p className="chapter-access-copy">{copy}</p>
        <div className="chapter-access-perks">
          <span>✦ Chapter 1 onward · Members only</span>
          <span>✦ ₹29 Premium Supporter</span>
          <span>✦ ₹49 Super Supporter</span>
        </div>
        <button className="chapter-access-cta" type="button" onClick={() => openPdlplMembership(chapter)}>{cta} <span>→</span></button>
        <button className="chapter-access-secondary" type="button" onClick={onClose}>Maybe later</button>
        <p className="chapter-access-note">₹19 Supporter does not include Pal Do Pal Ke Lamhe.</p>
      </section>
    </div>
  );
}

const PDPKL_FREE_CHAPTER_LIMIT = 0;

function isPdlplChapterLocked(chapter, member, admin) {
  if (!chapter || member || admin) return false;
  const raw = chapter.chapterNumber;
  if (raw === null || raw === undefined || raw === '') return false;
  const number = Number(raw);
  return Number.isFinite(number) && number > PDPKL_FREE_CHAPTER_LIMIT;
}

function PdlplChapterRow({ chapter, member, admin, onOpen, pageCount, stats, onRating, onComments }) {
  const item = stats?.[chapter.id] || { rating: { average: 0, count: 0 }, views: 0, comments: 0 };
  const locked = isPdlplChapterLocked(chapter, member, admin);

  return <article className={`chapter-row${locked ? ' chapter-row-locked' : ''}`} data-chapter-id={String(chapter.id)} data-engagement-source="pdlpl">
    <a className="chapter-row-main" href={`#${PDLPL_ROUTE}/read/${encodeURIComponent(chapter.id)}`} onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onOpen(chapter);
    }} aria-label={locked ? `${formatLabel(chapter)} — members only` : `Read ${formatLabel(chapter)}`}>
      <div className="chapter-row-cover" aria-hidden="true">
        {chapter.cover || chapter.chapterListThumbnailDesktopPath || chapter.chapterListThumbnailMobilePath ? (
          <picture>
            {chapter.chapterListThumbnailMobilePath && <source media="(max-width: 640px)" srcSet={getPdlplMediaUrl(chapter.chapterListThumbnailMobilePath)} />}
            <img
              src={chapter.chapterListThumbnailDesktopPath ? getPdlplMediaUrl(chapter.chapterListThumbnailDesktopPath) : chapter.cover}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </picture>
        ) : <span>PDPKL</span>}
        {locked && <span className="chapter-row-cover-lock">🔒</span>}
      </div>
      <div className="chapter-row-title">
        <span>{formatLabel(chapter)}</span>
        <h2>{chapter.title || 'Untitled chapter'}{locked && <span className="chapter-lock-badge"><span className="chapter-lock-badge-icon" aria-hidden="true">🔒</span><span>Members</span></span>}</h2>
      </div>
      <div className="chapter-row-meta">
        <span>{item.rating.count ? `${item.rating.average.toFixed(1)}/10` : '—'} <b>★</b></span>
        <span>•</span>
        <span>{formatDate(chapter.releaseDate || chapter.createdAt)}</span>
        <span>•</span>
        
      </div>
      <div className="chapter-row-details">
        <span>📄 {pageCount || '—'} pages</span>
      </div>
    </a>
    <div className="chapter-row-actions">
      <button type="button" className="engagement-icon" onClick={() => onRating(chapter)} aria-label={`Rate ${formatLabel(chapter)}`} title={`Rate ${formatLabel(chapter)}`}>
        <span>★</span><small>{item.rating.count ? item.rating.average.toFixed(1) : '—'}</small>
      </button>
      <button type="button" className="engagement-icon" onClick={() => window.dispatchEvent(new CustomEvent('atma-open-pdlpl-comments',{detail:{chapterId:chapter.id}}))} aria-label={`Comments for ${formatLabel(chapter)}`} title={`Comments for ${formatLabel(chapter)}`}>
        <span>💬</span><small>{new Intl.NumberFormat('en-IN', { notation: Number(item.comments) > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(item.comments) || 0)}</small>
      </button>
    </div>
  </article>;
}
function ChapterList({ chapters, member, admin, pageCounts, stats, onOpen, onBack, onRating, language, onLanguageChange, query, onQueryChange, sort, onSortChange }) { return <main className="site-shell chapter-list-page pdlpl-page-list">
    <header className="subpage-header"><button className="back-button" type="button" onClick={onBack} aria-label="Back to home">←</button><div><p className="header-kicker">PAL DO PAL KE LAMHE</p><h1>Chapter List</h1></div></header>
    <section className="chapter-list-section">
      <div className="chapter-discovery">
        <label>
          <span className="chapter-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg></span>
          <input type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search chapters…" aria-label="Search chapters" autoComplete="off" spellCheck="false" />
          {query && <button type="button" onClick={() => onQueryChange('')} aria-label="Clear chapter search">×</button>}
        </label>
        <label className="chapter-language">
          <span>Language</span>
          <select value={language} onChange={event => onLanguageChange(event.target.value)} aria-label="Language"><option value="en">English</option><option value="hi">Hindi</option></select>
        </label>
        <label className="chapter-sort"><span>Sort</span><select value={sort} onChange={event => onSortChange(event.target.value)} aria-label="Sort chapters"><option value="chapter">Chapter</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="rating">Top rated</option></select></label></div>
      {chapters.length ? <><div className="chapter-list">{chapters.map(chapter => <PdlplChapterRow key={chapter.id} chapter={chapter} member={member} admin={admin} onOpen={onOpen} pageCount={pageCounts[chapter.id] || 0} stats={stats} onRating={onRating} />)}</div><div className="chapter-discovery-end" role="status" aria-label="End of chapter list">You’ve reached the end.</div></> : <div className="empty-state" role="status" aria-live="polite"><span className="empty-state-mark" aria-hidden="true">—</span><h3>No chapters found</h3><p>Try another search, language, or sort option.</p></div>}
    </section>
    <Footer />
  </main>;
}
function formatCount(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', { notation: n > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
}

function PdlplRatingSheet({ chapter, summary, open, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!open || !chapter) return null;

  const rate = async value => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await submitPdlplRating(chapter.id, value);
      setMessage(result.alreadyRated ? 'You already rated this chapter on this account.' : `Rated ${value}/10. Thank you.`);
      if (!result.alreadyRated) onChanged?.();
      else onChanged?.();
    } catch (error) {
      setMessage(error?.message || 'Unable to save rating.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="overlay-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="rating-sheet" role="dialog" aria-modal="true" aria-label="Rate chapter">
      <div className="sheet-head">
        <div><p className="section-eyebrow">{formatLabel(chapter)}</p><h2>Rate {chapter.title || 'this chapter'}</h2></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="rating-big"><strong>{summary?.count ? summary.average.toFixed(1) : '—'}</strong><span>/10</span></div>
      <div className="rating-scale" aria-label="Choose rating from 1 to 10">
        {Array.from({ length: 10 }, (_, index) => {
          const value = index + 1;
          return <button key={value} type="button" disabled={busy} onClick={() => rate(value)}><span>★</span><small>{value}</small></button>;
        })}
      </div>
      {message && <p className="sheet-message">{message}</p>}
    </section>
  </div>;
}

function Reader({ chapter, chapters, onBack, onOpenChapter }) {
  const [pages, setPages] = useState([]);
  const [index, setIndex] = useState(0);
  const [urls, setUrls] = useState({});
  const urlsRef = useRef(new Map());
  const abortersRef = useRef(new Map());
  const [stats, setStats] = useState({ rating: { average: 0, count: 0 }, views: 0, likes: 0, comments: 0, pages: 0, shares: 0 });
  const [favoriteUser, setFavoriteUser] = useState(null);
  const [favoriteSaved, setFavoriteSaved] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState('');
  const [ratingOpen, setRatingOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState('');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const progressHydratedRef = useRef(false);

  const minSwipeDistance = 80;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const access = await getPdlplMemberAccess();
        if (!access.member && !access.admin) {
          if (active) onBack();
          return;
        }

        const livePages = await buildPdlplChapterPages(chapter.id);
        if (!active) return;
        if (!livePages.length) throw new Error('This chapter has no readable pages yet.');

        setPages(livePages);

        let saved = Number(window.localStorage.getItem(`pdlpl-reading:${chapter.id}`));
        if (!Number.isInteger(saved) || saved < 0 || saved >= livePages.length) saved = 0;
        setIndex(saved);

        const [serverProgress, engagement] = await Promise.all([
          getPdlplReadingProgress(chapter.id).catch(() => null),
          fetchPdlplChapterEngagement(chapter.id).catch(() => null),
        ]);
        if (!active) return;
        if (Number.isInteger(serverProgress) && serverProgress >= 1 && serverProgress <= livePages.length) {
          setIndex(serverProgress - 1);
        }
        if (engagement) setStats(engagement);

        recordPdlplChapterView(chapter.id).catch(viewError => console.warn('PDPKL view tracking skipped:', viewError));
      } catch (err) {
        if (active) setError(err?.message || 'Unable to open this chapter.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
      abortersRef.current.forEach(controller => controller.abort());
      abortersRef.current.clear();
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    };
  }, [chapter.id, onBack]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data?.session?.user || null;
      if (!active) return;
      setFavoriteUser(user);
      if (!user) return;
      try {
        setFavoriteSaved(await getPdlplBookmark(chapter.id));
      } catch (bookmarkError) {
        if (active) setFavoriteError(bookmarkError?.message || 'Unable to load favourite status.');
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      if (!active) return;
      setFavoriteUser(user);
      if (!user) {
        setFavoriteSaved(false);
        return;
      }
      getPdlplBookmark(chapter.id).then(saved => { if (active) setFavoriteSaved(saved); }).catch(() => {});
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [chapter.id]);

  const toggleFavorite = async () => {
    if (favoriteBusy) return;
    if (!favoriteUser) {
      window.dispatchEvent(new CustomEvent('atma-open-auth', { detail: { mode: 'login' } }));
      return;
    }
    setFavoriteBusy(true);
    setFavoriteError('');
    try {
      await togglePdlplBookmark(chapter.id, favoriteSaved);
      setFavoriteSaved(value => !value);
    } catch (bookmarkError) {
      setFavoriteError(bookmarkError?.message || 'Unable to update favourite.');
    } finally {
      setFavoriteBusy(false);
    }
  };

  const loadPage = useCallback(async pageIndex => {
    const page = pages[pageIndex];
    if (!page || urlsRef.current.has(pageIndex)) return;

    const controller = new AbortController();
    abortersRef.current.set(pageIndex, controller);
    try {
      const url = await fetchPdlplMedia(page.image_path, { signal: controller.signal });
      urlsRef.current.set(pageIndex, url);
      setUrls(current => ({ ...current, [pageIndex]: url }));
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err?.message || 'Unable to load this page.');
    } finally {
      abortersRef.current.delete(pageIndex);
    }
  }, [pages]);

  const prefetchPage = useCallback(async pageIndex => {
    if (pageIndex < 0 || pageIndex >= pages.length || urlsRef.current.has(pageIndex) || abortersRef.current.has(pageIndex)) return;
    try { await loadPage(pageIndex); } catch (_) {}
  }, [pages.length, loadPage]);

  useEffect(() => {
    if (!pages.length) return undefined;

    const needed = new Set([index - 1, index, index + 1].filter(value => value >= 0 && value < pages.length));
    setPageLoading(!urlsRef.current.has(index));
    needed.forEach(value => loadPage(value));

    const farther = index + 2 < pages.length ? index + 2 : index - 2;
    if (farther >= 0 && farther < pages.length) window.setTimeout(() => prefetchPage(farther), 0);

    for (const [cachedIndex, url] of urlsRef.current.entries()) {
      if (!needed.has(cachedIndex)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(cachedIndex);
        setUrls(current => {
          const next = { ...current };
          delete next[cachedIndex];
          return next;
        });
      }
    }

    return () => setPageLoading(false);
  }, [index, pages, loadPage, prefetchPage]);

  useEffect(() => {
    if (!pages.length || !progressHydratedRef.current) return;
    try { window.localStorage.setItem(`pdlpl-reading:${chapter.id}`, String(index)); } catch {}
    savePdlplReadingProgress(chapter.id, index + 1).catch(progressError => console.warn('PDPKL progress save skipped:', progressError));
  }, [chapter.id, index, pages.length]);

  useEffect(() => {
    progressHydratedRef.current = pages.length > 0;
    return () => { progressHydratedRef.current = false; };
  }, [pages.length]);

  useEffect(() => {
    const handler = event => {
      if (!document.querySelector('.pdlpl-reader')) return;
      const tagName = String(event.target?.tagName || '').toLowerCase();
      const typing = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || event.target?.isContentEditable;
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        setIndex(value => Math.min(value + 1, pages.length - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex(value => Math.max(value - 1, 0));
      } else if (event.key === 'Escape') {
        setRatingOpen(false);
        onBack();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pages.length, onBack]);

  const onTouchStart = event => {
    if (event.touches.length !== 1) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    setTouchEnd(null);
    setTouchStart(event.touches[0].clientX);
  };
  const onTouchMove = event => {
    if (event.touches.length !== 1) return;
    setTouchEnd(event.touches[0].clientX);
  };
  const onTouchEnd = event => {
    if (event.touches?.length) return;
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) >= minSwipeDistance) {
      setIndex(value => distance > 0 ? Math.min(value + 1, pages.length - 1) : Math.max(value - 1, 0));
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const currentIndex = chapters.findIndex(item => String(item.id) === String(chapter.id));
  const previous = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
  const progress = pages.length ? ((index + 1) / pages.length) * 100 : 0;

  const refreshStats = async () => {
    try { setStats(await fetchPdlplChapterEngagement(chapter.id)); } catch (statsError) { console.warn('PDPKL engagement refresh skipped:', statsError); }
  };

  if (loading) return <main className="reader-page"><div className="loading-state"><span className="loading-spinner" /><p>Opening chapter…</p></div></main>;
  if (error) return <main className="reader-page pdlpl-reader"><div className="reader-error"><div>⌁</div><h2>{error}</h2><button className="primary-button" type="button" onClick={onBack}>Back to chapters</button></div></main>;
  if (!pages.length) return null;

  return (
    <main className="reader-page pdlpl-reader" data-chapter-id={String(chapter.id)} data-engagement-source="pdlpl">
      <header className="reader-header">
        <div className="reader-header-inner">
          <button className="reader-back" type="button" onClick={onBack} aria-label="Back to chapters">←</button>
          <div className="reader-title"><p>{chapter.chapterNumber != null && String(chapter.chapterNumber).trim() !== '' ? String(chapter.chapterNumber).trim() : ''}</p></div>
          <div className="reader-engagement">
            <button type="button" className={`reader-favorite-button${favoriteSaved ? ' is-saved' : ''}`} onClick={toggleFavorite} disabled={favoriteBusy} aria-label={favoriteSaved ? 'Remove from favourites' : favoriteUser ? 'Add to favourites' : 'Sign in to add to favourites'} title={favoriteSaved ? 'Remove from favourites' : favoriteUser ? 'Add to favourites' : 'Sign in to add to favourites'}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
            </button>
            <button type="button" className="reader-engagement-button reader-rating-button" onClick={() => setRatingOpen(true)} aria-label="Rate chapter"><span>★</span>{stats.rating.count ? stats.rating.average.toFixed(1) : '—'}</button>
            <button type="button" className="reader-engagement-button reader-comments-button" onClick={() => window.dispatchEvent(new CustomEvent('atma-open-pdlpl-comments',{detail:{chapterId:chapter.id}}))} aria-label="Open comments"><span>💬</span>{formatCount(stats.comments || 0)}</button>
            <button type="button" className="reader-share-button" onClick={async () => {
              const shareUrl = `${window.location.origin}/pal-do-pal-ke-lamhe#${PDLPL_ROUTE}/read/${encodeURIComponent(chapter.id)}`;
              const shareText = chapter.chapterNumber ? `Read Pal Do Pal Ke Lamhe Chapter ${chapter.chapterNumber}.` : 'Read Pal Do Pal Ke Lamhe.';
              try {
                if (navigator.share) {
                  await navigator.share({ title: 'Pal Do Pal Ke Lamhe', text: shareText, url: shareUrl });
                  await recordPdlplChapterShare(chapter.id);
                } else if (navigator.clipboard?.writeText) {
                  await navigator.clipboard.writeText(shareUrl);
                  await recordPdlplChapterShare(chapter.id);
                  window.dispatchEvent(new CustomEvent('atma-toast', { detail: { message: 'Chapter link copied.' } }));
                }
              } catch (shareError) {
                if (shareError?.name !== 'AbortError') console.warn('PDPKL chapter share failed:', shareError);
              }
            }} aria-label="Share" title="Share">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m8 11 7.7-4.2M8 13l7.7 4.2"/></svg>
            </button>
            <span className="reader-page-pill">{index + 1}/{pages.length}</span>
            {favoriteError && <span className="reader-favorite-status" role="status" aria-live="polite">{favoriteError}</span>}
          </div>
        </div>
        <div className="reader-progress"><span style={{ width: `${progress}%` }} /></div>
      </header>

      <section className="reader-content">
        <div className="reader-stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onDoubleClick={event => {
          if (event.target?.tagName === 'IMG') {
            if (!document.fullscreenElement) event.target.requestFullscreen?.();
            else document.exitFullscreen?.();
          }
        }}>
          {urls[index]
            ? <img src={urls[index]} alt={`${formatLabel(chapter)} page ${index + 1}`} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} draggable="false" />
            : <div className="pdlpl-page-loading">{pageLoading ? 'Loading page…' : 'Page unavailable.'}</div>}
          <button className="reader-side-button left" type="button" onClick={() => setIndex(value => Math.max(value - 1, 0))} disabled={index === 0} aria-label="Previous page">‹</button>
          <button className="reader-side-button right" type="button" onClick={() => setIndex(value => Math.min(value + 1, pages.length - 1))} disabled={index === pages.length - 1} aria-label="Next page">›</button>
        </div>

        <div className="reader-info-row"><span>Page {index + 1} of {pages.length}</span></div>

        <div className="reader-controls">
          <button className="reader-control secondary" type="button" disabled={index === 0} onClick={() => setIndex(value => Math.max(value - 1, 0))} aria-label="Previous page">←</button>
          <div className="reader-counter"><strong>{index + 1} / {pages.length}</strong><span>PAGE</span></div>
          <button className="reader-control primary" type="button" disabled={index === pages.length - 1} onClick={() => setIndex(value => Math.min(value + 1, pages.length - 1))} aria-label="Next page">→</button>
        </div>

        <nav className="reader-chapter-nav" aria-label="Chapter navigation">
          <div className="reader-chapter-nav-item"><button type="button" onClick={() => previous && onOpenChapter(previous)} disabled={!previous} aria-label={previous ? 'Go to previous chapter' : 'No previous chapter'}><strong>Previous ch</strong></button></div>
          <div className="reader-chapter-nav-item"><button type="button" onClick={() => next && onOpenChapter(next)} disabled={!next} aria-label={next ? 'Go to next chapter' : 'No next chapter'}><strong>Next ch</strong></button></div>
        </nav>
      </section>

      {ratingOpen && <PdlplRatingSheet chapter={chapter} summary={stats.rating} open onClose={() => setRatingOpen(false)} onChanged={refreshStats} />}
    </main>
  );
}

export default function PalDoPalKeLamhe() {
  const [chapters, setChapters] = useState([]);
  const [pageCounts, setPageCounts] = useState({});
  const [stats, setStats] = useState({});
  const [ratingChapter, setRatingChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [memberUser, setMemberUser] = useState(null);
  const [memberPlanId, setMemberPlanId] = useState(null);
  const [language, setLanguage] = useState(() => window.localStorage.getItem('pdlpl-language') === 'en' ? 'en' : 'hi');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('chapter');
  const [lockChapter, setLockChapter] = useState(null);
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, ''));

  useEffect(() => {
    const update = () => setRoute(window.location.hash.replace(/^#/, ''));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const rows = await buildPdlplChapters();
      const publishedRows = rows.filter(chapter => published(chapter));
      const publishedChapters = publishedRows.filter(chapter => String(chapter.language || 'hi') === language);

      setChapters(publishedChapters);

      try {
        const access = await getPdlplMemberAccess();
        setMember(access.member);
        setAdmin(access.admin);
        setMemberUser(access.user || null);
        setMemberPlanId(access.planId || null);
      } catch (accessError) {
        console.warn('PDPL membership lookup:', accessError);
        setMember(false);
        setAdmin(false);
        setMemberUser(null);
        setMemberPlanId(null);
      }

      const ids = publishedChapters.map(chapter => chapter.id);
      try {
        const [counts, engagement] = await Promise.all([
          buildPdlplPageCounts(ids),
          fetchPdlplPublicEngagement(ids),
        ]);
        setPageCounts(counts);
        setStats(engagement);
      } catch (dataError) {
        console.warn('PDPL chapter metadata:', dataError);
        setPageCounts({});
        setStats({});
      }
    } catch (error) {
      console.error('PDPL load:', error);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => load());
    return () => listener.subscription.unsubscribe();
  }, [load]);

  const currentReaderId = useMemo(() => {
    const prefix = `${PDLPL_ROUTE}/read/`;
    if (!route.startsWith(prefix)) return null;
    return decodeURIComponent(route.slice(prefix.length));
  }, [route, language]);

  const readerChapter = currentReaderId
    ? chapters.find(item => item.id === currentReaderId) || null
    : null;

  useEffect(() => {
    if (!loading && currentReaderId && readerChapter && !member && !admin) {
      setLockChapter(readerChapter);
    }
  }, [loading, currentReaderId, readerChapter, member, admin]);

  const openChapter = useCallback(chapter => {
    if (!member && !admin) {
      setLockChapter(chapter);
      return;
    }
    window.location.hash = `${PDLPL_ROUTE}/read/${encodeURIComponent(chapter.id)}`;
  }, [member, admin]);

  const closeReader = useCallback(() => {
    window.location.hash = PDLPL_ROUTE;
  }, []);

  const visibleChapters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = chapters.filter(chapter => !needle || [chapter.title, chapter.description, chapter.chapterNumber].some(value => String(value ?? '').toLowerCase().includes(needle)));
    const getNumber = chapter => {
      const value = Number(chapter.chapterNumber);
      return Number.isFinite(value) ? value : -Infinity;
    };
    return [...filtered].sort((a, b) => {
      if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' });
      if (sort === 'rating') return Number(stats?.[b.id]?.rating?.average || 0) - Number(stats?.[a.id]?.rating?.average || 0);
      if (sort === 'views') return Number(stats?.[b.id]?.views || 0) - Number(stats?.[a.id]?.views || 0);
      if (sort === 'oldest') return getNumber(a) - getNumber(b);
      return getNumber(a) - getNumber(b);
    });
  }, [chapters, query, sort, stats]);

  if (currentReaderId && readerChapter && (member || admin)) {
    return (
      <Reader
        chapter={readerChapter}
        chapters={chapters}
        onBack={closeReader}
        onOpenChapter={openChapter}
      />
    );
  }

  if (loading) {
    return (
      <main className="home-page">
        <div className="loading-state"><span className="loading-spinner" /><p>Loading Pal Do Pal Ke Lamhe…</p></div>
      </main>
    );
  }

  return (
    <>
      <ChapterList
        chapters={visibleChapters}
        member={member}
        admin={admin}
        pageCounts={pageCounts}
        stats={stats}
        onOpen={openChapter}
        onRating={setRatingChapter}
        onBack={() => { window.location.hash = 'home'; }}
        language={language}
        onLanguageChange={value => { setLanguage(value); window.localStorage.setItem('pdlpl-language', value); }}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
      />
      {ratingChapter && <PdlplRatingSheet chapter={ratingChapter} summary={stats[ratingChapter.id]?.rating} open onClose={() => setRatingChapter(null)} onChanged={load} />}
      {lockChapter && <LockedModal chapter={lockChapter} user={memberUser} planId={memberPlanId} onClose={() => setLockChapter(null)} />}
    </>
  );
}
