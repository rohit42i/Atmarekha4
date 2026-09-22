import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Footer from './Footer';
import { buildPdlplChapterPages, buildPdlplChapters, getPdlplMemberAccess, PDLPL_ROUTE, published } from './palDoPalKeLamhe';
import { fetchPdlplMedia } from './pdlplR2';
import { supabase } from './supabase';
import './pal-do-pal-ke-lamhe.css';

const label = chapter => chapter?.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'Special';

function openMembership() {
  window.location.hash = 'membership';
}

function LockedModal({ chapter, onClose }) {
  return <div className="pdlpl-lock-backdrop" role="dialog" aria-modal="true" aria-label="Membership required">
    <button className="pdlpl-lock-bg" aria-label="Close" onClick={onClose} />
    <section className="pdlpl-lock-modal">
      <button className="pdlpl-close" type="button" onClick={onClose} aria-label="Close">×</button>
      <span className="pdlpl-lock-icon" aria-hidden="true">🔒</span>
      <p className="pdlpl-kicker">PAL DO PAL KE LAMHE · MEMBERS ONLY</p>
      <h2>{label(chapter)} is for members.</h2>
      <p>Every chapter of this side story is available only with an active membership.</p>
      <button className="pdlpl-primary" type="button" onClick={openMembership}>View Membership <span>→</span></button>
      <button className="pdlpl-secondary" type="button" onClick={onClose}>Maybe later</button>
    </section>
  </div>;
}

function ChapterRow({ chapter, member, onOpen }) {
  return <article className={`pdlpl-chapter-row ${member ? '' : 'is-locked'}`}>
    <button type="button" onClick={() => onOpen(chapter)} className="pdlpl-chapter-main">
      <div className="pdlpl-chapter-number">{label(chapter)}</div>
      <h2>{chapter.title || 'Untitled chapter'}</h2>
      {chapter.description && <p>{chapter.description}</p>}
      <div className="pdlpl-chapter-meta">
        <span>{chapter.releaseDate ? new Date(chapter.releaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not dated'}</span>
        <span>·</span>
        <span>{member ? 'Read chapter' : 'Members only 🔒'}</span>
      </div>
    </button>
    <span className="pdlpl-row-arrow" aria-hidden="true">→</span>
  </article>;
}

function Reader({ chapter, chapters, onBack, onOpenChapter }) {
  const [pages, setPages] = useState([]);
  const [index, setIndex] = useState(0);
  const [urls, setUrls] = useState({});
  const urlsRef = useRef(new Map());
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState('');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const abortersRef = useRef(new Map());
  const minSwipeDistance = 80;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    (async () => {
      try {
        const access = await getPdlplMemberAccess();
        if (!active) return;
        if (!access.member && !access.admin) {
          onBack();
          return;
        }

        const livePages = await buildPdlplChapterPages(chapter.id);
        if (!active) return;
        if (!livePages.length) {
          setPages([]);
          setLoading(false);
          return;
        }

        setPages(livePages);
        const saved = Number(window.localStorage.getItem(`pdlpl-reading:${chapter.id}`));
        setIndex(Number.isInteger(saved) && saved >= 0 && saved < livePages.length ? saved : 0);
      } catch (err) {
        if (active && err?.name !== 'AbortError') setError(err?.message || 'Unable to open this chapter.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
      abortersRef.current.forEach(item => item.abort());
      abortersRef.current.clear();
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    };
  }, [chapter.id, onBack]);

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
    if (!pages.length) return;
    setPageLoading(!urlsRef.current.has(index));
    const needed = new Set([index - 1, index, index + 1].filter(value => value >= 0 && value < pages.length));

    needed.forEach(value => loadPage(value));

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
  }, [index, pages, loadPage]);

  useEffect(() => {
    if (pages.length) window.localStorage.setItem(`pdlpl-reading:${chapter.id}`, String(index));
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
      setIndex(value => distance > 0 ? Math.min(value + 1, pages.length - 1) : Math.max(value - 1, 0));
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const currentIndex = chapters.findIndex(item => item.id === chapter.id);
  const previous = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
  const progress = pages.length ? ((index + 1) / pages.length) * 100 : 0;

  if (loading) return <main className="pdlpl-reader"><div className="pdlpl-loading">Opening side story…</div></main>;
  if (error) return <main className="pdlpl-reader"><div className="pdlpl-error"><h2>{error}</h2><button type="button" onClick={onBack}>Back to chapters</button></div></main>;
  if (!pages.length) return <main className="pdlpl-reader"><div className="pdlpl-error"><h2>This chapter has no readable pages yet.</h2><button type="button" onClick={onBack}>Back to chapters</button></div></main>;

  return <main className="pdlpl-reader">
    <header className="pdlpl-reader-header">
      <div>
        <button type="button" onClick={onBack} aria-label="Back to chapters">←</button>
        <div>
          <span>PAL DO PAL KE LAMHE</span>
          <h1>{label(chapter)} · {chapter.title}</h1>
        </div>
      </div>
      <strong>{index + 1}/{pages.length}</strong>
    </header>
    <div className="pdlpl-progress"><span style={{ width: `${progress}%` }} /></div>

    <section className="pdlpl-reader-content">
      <div className="pdlpl-stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onDoubleClick={event => {
        if (event.target?.tagName === 'IMG') {
          if (!document.fullscreenElement) event.target.requestFullscreen?.();
          else document.exitFullscreen?.();
        }
      }}>
        {urls[index] ? <img src={urls[index]} alt={`${label(chapter)} page ${index + 1}`} decoding="async" draggable="false" /> : <div className="pdlpl-page-loading">{pageLoading ? 'Loading page…' : 'Page unavailable.'}</div>}
        <button type="button" className="pdlpl-side left" onClick={() => setIndex(value => Math.max(value - 1, 0))} disabled={index === 0}>‹</button>
        <button type="button" className="pdlpl-side right" onClick={() => setIndex(value => Math.min(pages.length - 1, value + 1))} disabled={index === pages.length - 1}>›</button>
      </div>

      <div className="pdlpl-reader-controls">
        <button type="button" onClick={() => setIndex(value => Math.max(value - 1, 0))} disabled={index === 0}>← Previous</button>
        <span>Page {index + 1} of {pages.length}</span>
        <button type="button" onClick={() => setIndex(value => Math.min(pages.length - 1, value + 1))} disabled={index === pages.length - 1}>Next →</button>
      </div>

      <div className="pdlpl-chapter-nav">
        {previous ? <button type="button" onClick={() => onOpenChapter(previous)}>← {label(previous)}</button> : <span />}
        {next ? <button type="button" onClick={() => onOpenChapter(next)}>{label(next)} →</button> : <span />}
      </div>
    </section>
  </main>;
}

export default function PalDoPalKeLamhe() {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lockChapter, setLockChapter] = useState(null);
  const route = window.location.hash.replace(/^#/, '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, access] = await Promise.all([buildPdlplChapters(), getPdlplMemberAccess()]);
      setChapters(rows.filter(published));
      setMember(access.member);
      setAdmin(access.admin);
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

  useEffect(() => {
    if (!route.startsWith(`${PDPL_ROUTE}/read/`)) setSelected(null);
  }, [route]);

  const currentReaderId = useMemo(() => {
    if (!route.startsWith(`${PDPL_ROUTE}/read/`)) return null;
    return decodeURIComponent(route.slice(`${PDPL_ROUTE}/read/`.length));
  }, [route]);

  const readerChapter = currentReaderId ? chapters.find(item => item.id === currentReaderId) : null;

  const openChapter = chapter => {
    if (!member && !admin) {
      setLockChapter(chapter);
      return;
    }
    window.location.hash = `${PDPL_ROUTE}/read/${encodeURIComponent(chapter.id)}`;
  };

  const openReaderChapter = chapter => {
    if (!chapter) return;
    if (!member && !admin) {
      setLockChapter(chapter);
      return;
    }
    window.location.hash = `${PDPL_ROUTE}/read/${encodeURIComponent(chapter.id)}`;
  };

  if (currentReaderId && readerChapter && (member || admin)) {
    return <Reader
      chapter={readerChapter}
      chapters={chapters}
      onBack={() => { window.location.hash = PDPL_ROUTE; }}
      onOpenChapter={openReaderChapter}
    />;
  }

  if (loading) return <main className="pdlpl-page"><div className="pdlpl-loading">Loading side story…</div></main>;

  return <main className="pdlpl-page">
    <header className="pdlpl-header">
      <div>
        <button type="button" className="pdlpl-back" onClick={() => { window.location.hash = 'home'; }} aria-label="Back to home">←</button>
        <div>
          <span>SIDE STORY · SCHOOL LIFE</span>
          <h1>Pal Do Pal Ke Lamhe</h1>
          <p>Every chapter is available to members.</p>
        </div>
      </div>
      {admin && <a className="pdlpl-admin-link" href="#pal-do-pal-admin">Side Story Admin</a>}
    </header>

    <section className="pdlpl-section">
      <div className="pdlpl-section-head">
        <div><span>MEMBER STORY</span><h2>Chapters</h2></div>
        <p>{chapters.length} published {chapters.length === 1 ? 'chapter' : 'chapters'}</p>
      </div>

      {!chapters.length
        ? <div className="pdlpl-empty"><h2>Nothing published yet.</h2><p>This side story is still being prepared.</p></div>
        : <div className="pdlpl-chapters">{chapters.map(chapter =>
          <ChapterRow key={chapter.id} chapter={chapter} member={member || admin} onOpen={openChapter} />
        )}</div>}
    </section>

    <Footer />
    {lockChapter && <LockedModal chapter={lockChapter} onClose={() => setLockChapter(null)} />}
  </main>;
}
