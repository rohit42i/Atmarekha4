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
import { fetchPdlplMedia } from './pdlplR2';
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

function openMembership() {
  window.location.hash = 'membership';
}

function LockedModal({ chapter, onClose }) {
  return (
    <div className="pdlpl-lock-backdrop" role="dialog" aria-modal="true" aria-label="Membership required">
      <button className="pdlpl-lock-bg" type="button" aria-label="Close" onClick={onClose} />
      <section className="pdlpl-lock-modal">
        <button className="pdlpl-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <span className="pdlpl-lock-icon" aria-hidden="true">🔒</span>
        <p className="pdlpl-kicker">PAL DO PAL KE LAMHE · MEMBERS ONLY</p>
        <h2>{formatLabel(chapter)} is for members.</h2>
        <p>Every chapter of this side story is available only with an active membership.</p>
        <button className="pdlpl-primary" type="button" onClick={openMembership}>View Membership <span>→</span></button>
        <button className="pdlpl-secondary" type="button" onClick={onClose}>Maybe later</button>
      </section>
    </div>
  );
}

function PdlplChapterRow({ chapter, member, onOpen, pageCount }) {
  const locked = !member;

  return (
    <article className="chapter-row">
      <button
        type="button"
        className="chapter-row-main pdlpl-chapter-main"
        onClick={() => onOpen(chapter)}
        aria-label={locked ? `${formatLabel(chapter)} — members only` : `Read ${formatLabel(chapter)}`}
      >
        <div className="chapter-row-title">
          <span>{formatLabel(chapter)}</span>
          <h2>{chapter.title || 'Untitled chapter'}</h2>
        </div>
        <div className="chapter-row-meta">
          <span>MEMBERS ONLY</span>
          <span>•</span>
          <span>{formatDate(chapter.releaseDate || chapter.createdAt)}</span>
        </div>
        <div className="chapter-row-details">
          <span>📄 {pageCount || 0} pages</span>
        </div>
      </button>
      <div className="chapter-row-actions">
        <button
          type="button"
          className="pdlpl-chapter-action"
          onClick={() => onOpen(chapter)}
          aria-label={locked ? `${formatLabel(chapter)} is members only` : `Read ${formatLabel(chapter)}`}
          title={locked ? 'Members only' : 'Read chapter'}
        >
          <span>{locked ? '🔒' : '→'}</span>
          <small>{locked ? 'Members' : 'Read'}</small>
        </button>
      </div>
    </article>
  );
}

function ChapterList({ chapters, member, admin, pageCounts, onOpen, onBack }) {
  return (
    <main className="site-shell chapter-list-page">
      <header className="subpage-header">
        <button className="back-button" type="button" onClick={onBack} aria-label="Back to home">←</button>
        <div>
          <p className="header-kicker">PAL DO PAL KE LAMHE</p>
          <h1>Chapter List</h1>
        </div>
      </header>

      <section className="chapter-list-section">
        <div className="chapter-list-heading">
          <p>{chapters.length} published {chapters.length === 1 ? 'chapter' : 'chapters'}</p>
          <span>MEMBERS ONLY · DATE · PAGES</span>
        </div>

        {chapters.length ? (
          <div className="chapter-list">
            {chapters.map(chapter => (
              <PdlplChapterRow
                key={chapter.id}
                chapter={chapter}
                member={member || admin}
                onOpen={onOpen}
                pageCount={pageCounts[chapter.id] || 0}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Nothing published yet</h3>
            <p>This side story is still being prepared.</p>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

function Reader({ chapter, chapters, onBack, onOpenChapter }) {
  const [pages, setPages] = useState([]);
  const [index, setIndex] = useState(0);
  const [urls, setUrls] = useState({});
  const urlsRef = useRef(new Map());
  const abortersRef = useRef(new Map());
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState('');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 50;

  useEffect(() => {
    let active = true;

    (async () => {
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

        setPages(livePages);

        const saved = Number(window.localStorage.getItem(`pdlpl-reading:${chapter.id}`));
        setIndex(Number.isInteger(saved) && saved >= 0 && saved < livePages.length ? saved : 0);
      } catch (err) {
        if (active) setError(err?.message || 'Unable to open this chapter.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      abortersRef.current.forEach(controller => controller.abort());
      abortersRef.current.clear();
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    };
  }, [chapter.id, onBack]);

  const prefetchPage = useCallback(async pageIndex => {
    if (pageIndex < 0 || pageIndex >= pages.length || urlsRef.current.has(pageIndex) || abortersRef.current.has(pageIndex)) return;
    try { await loadPage(pageIndex); } catch (_) {}
  }, [pages.length, loadPage]);

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

  useEffect(() => {
    if (!pages.length) return undefined;

    const needed = new Set(
      [index - 1, index, index + 1].filter(value => value >= 0 && value < pages.length),
    );

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
    if (pages.length) {
      window.localStorage.setItem(`pdlpl-reading:${chapter.id}`, String(index));
    }
  }, [chapter.id, index, pages.length]);

  useEffect(() => {
    const handler = event => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        setIndex(value => Math.min(value + 1, pages.length - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex(value => Math.max(value - 1, 0));
      } else if (event.key === 'Escape') {
        onBack();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pages.length, onBack]);

  const onTouchStart = event => {
    setTouchEnd(null);
    setTouchStart(event.targetTouches[0]?.clientX ?? null);
  };

  const onTouchMove = event => setTouchEnd(event.targetTouches[0]?.clientX ?? null);

  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;

    if (Math.abs(distance) >= minSwipeDistance) {
      setIndex(value => distance > 0
        ? Math.min(value + 1, pages.length - 1)
        : Math.max(value - 1, 0));
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const currentIndex = chapters.findIndex(item => item.id === chapter.id);
  const previous = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < chapters.length - 1
    ? chapters[currentIndex + 1]
    : null;
  const progress = pages.length ? ((index + 1) / pages.length) * 100 : 0;

  if (loading) return <main className="reader-page"><div className="loading-state"><span className="loading-spinner" /><p>Opening chapter…</p></div></main>;
  if (error) {
    return (
      <main className="reader-page">
        <div className="reader-error">
          <div>⌁</div>
          <h2>{error}</h2>
          <button className="primary-button" type="button" onClick={onBack}>Back to chapters</button>
        </div>
      </main>
    );
  }
  if (!pages.length) {
    return (
      <main className="reader-page">
        <div className="reader-error">
          <div>⌁</div>
          <h2>This chapter has no readable pages yet.</h2>
          <button className="primary-button" type="button" onClick={onBack}>Back to chapters</button>
        </div>
      </main>
    );
  }

  return (
    <main className="reader-page">
      <header className="reader-header">
        <div className="reader-header-inner">
          <button className="reader-back" type="button" onClick={onBack} aria-label="Back to chapters">←</button>
          <div className="reader-title">
            <p>PAL DO PAL KE LAMHE · MEMBERS ONLY</p>
            <h1>{formatLabel(chapter)} · {chapter.title || 'Untitled chapter'}</h1>
          </div>
          <div className="reader-engagement">
            <span className="reader-page-pill">MEMBERS</span>
            <span className="reader-page-pill">{index + 1}/{pages.length}</span>
          </div>
        </div>
        <div className="reader-progress"><span style={{ width: `${progress}%` }} /></div>
      </header>

      <section className="reader-content">
        <div
          className="reader-stage"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onDoubleClick={event => {
            if (event.target?.tagName === 'IMG') {
              if (!document.fullscreenElement) event.target.requestFullscreen?.();
              else document.exitFullscreen?.();
            }
          }}
        >
          {urls[index]
            ? <img src={urls[index]} alt={`${formatLabel(chapter)} page ${index + 1}`} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} draggable="false" />
            : <div className="pdlpl-page-loading">{pageLoading ? 'Loading page…' : 'Page unavailable.'}</div>}
          <button className="reader-side-button left" type="button" onClick={() => setIndex(value => Math.max(value - 1, 0))} disabled={index === 0} aria-label="Previous page">‹</button>
          <button className="reader-side-button right" type="button" onClick={() => setIndex(value => Math.min(value + 1, pages.length - 1))} disabled={index === pages.length - 1} aria-label="Next page">›</button>
        </div>

        <div className="reader-info-row">
          <span>Page {index + 1} of {pages.length}</span>
          <span>Members only</span>
        </div>

        <div className="reader-controls">
          <button className="reader-control secondary" type="button" disabled={index === 0} onClick={() => setIndex(value => Math.max(value - 1, 0))}>← <span>Previous</span></button>
          <div className="reader-counter"><strong>{index + 1} / {pages.length}</strong><span>PAGE</span></div>
          <button className="reader-control primary" type="button" disabled={index === pages.length - 1} onClick={() => setIndex(value => Math.min(value + 1, pages.length - 1))}><span>Next</span> →</button>
        </div>

        <div className="reader-chapter-nav">
          {previous ? <a href={`#${PDLPL_ROUTE}/read/${encodeURIComponent(previous.id)}`}>← Chapter {previous.chapterNumber}</a> : <span />}
          {next ? <a href={`#${PDLPL_ROUTE}/read/${encodeURIComponent(next.id)}`}>Chapter {next.chapterNumber} →</a> : <span />}
        </div>
      </section>
    </main>
  );
}

export default function PalDoPalKeLamhe() {
  const [chapters, setChapters] = useState([]);
  const [pageCounts, setPageCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(false);
  const [admin, setAdmin] = useState(false);
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
      const [rows, access] = await Promise.all([
        buildPdlplChapters(),
        getPdlplMemberAccess(),
      ]);

      const publishedChapters = rows.filter(published);
      setChapters(publishedChapters);
      setMember(access.member);
      setAdmin(access.admin);

      try {
        setPageCounts(await buildPdlplPageCounts(publishedChapters.map(chapter => chapter.id)));
      } catch (pageError) {
        console.warn('PDPL page counts:', pageError);
        setPageCounts({});
      }
    } catch (error) {
      console.error('PDPL load:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => load());
    return () => listener.subscription.unsubscribe();
  }, [load]);

  const currentReaderId = useMemo(() => {
    const prefix = `${PDLPL_ROUTE}/read/`;
    if (!route.startsWith(prefix)) return null;
    return decodeURIComponent(route.slice(prefix.length));
  }, [route]);

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
    <ChapterList
      chapters={chapters}
      member={member}
      admin={admin}
      pageCounts={pageCounts}
      onOpen={openChapter}
      onBack={() => { window.location.hash = 'home'; }}
    />
  );
}
