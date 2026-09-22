import { useEffect, useMemo, useState } from 'react';
import { getCurrentMembership } from './supabase';
import { buildPdlplChapterPages, buildPdlplChapters, getPdlplMemberAccess, PDLPL_ROUTE, published } from './palDoPalKeLamhe';
import './pal-do-pal-ke-lamhe.css';

const label = chapter => `Chapter ${chapter.chapterNumber}`;

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

function Reader({ chapter, chapters, onBack, onLock }) {
  const [pages, setPages] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [memberChecked, setMemberChecked] = useState(false);
  const minSwipeDistance = 50;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const access = await getPdlplMemberAccess();
        if (!active) return;
        if (!access.member && !access.admin) {
          setMemberChecked(true);
          onLock(chapter);
          return;
        }
        const livePages = await buildPdlplChapterPages(chapter.id);
        if (!active) return;
        setPages(livePages);
        const saved = Number(window.localStorage.getItem(`pdlpl-reading:${chapter.id}`));
        setIndex(Number.isInteger(saved) && saved >= 0 && saved < livePages.length ? saved : 0);
        setMemberChecked(true);
      } catch (err) {
        if (active) setError(err?.message || 'Unable to open this chapter.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [chapter.id, onLock]);

  useEffect(() => {
    if (pages.length) window.localStorage.setItem(`pdlpl-reading:${chapter.id}`, String(index));
  }, [chapter.id, index, pages.length]);

  const onTouchStart = event => { setTouchEnd(null); setTouchStart(event.targetTouches[0].clientX); };
  const onTouchMove = event => { setTouchEnd(event.targetTouches[0].clientX); };
  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) >= minSwipeDistance) setIndex(value => distance > 0 ? Math.min(value + 1, pages.length - 1) : Math.max(value - 1, 0));
    setTouchStart(null); setTouchEnd(null);
  };

  const currentIndex = chapters.findIndex(item => item.id === chapter.id);
  const previous = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
  const progress = pages.length ? ((index + 1) / pages.length) * 100 : 0;

  if (!memberChecked || loading) return <main className="pdlpl-reader"><div className="pdlpl-loading">Opening side story…</div></main>;
  if (error) return <main className="pdlpl-reader"><div className="pdlpl-error"><h2>{error}</h2><button type="button" onClick={onBack}>Back to chapters</button></div></main>;
  if (!pages.length) return <main className="pdlpl-reader"><div className="pdlpl-error"><h2>This chapter has no readable pages yet.</h2><button type="button" onClick={onBack}>Back to chapters</button></div></main>;

  return <main className="pdlpl-reader">
    <header className="pdlpl-reader-header">
      <button type="button" onClick={onBack} aria-label="Back">←</button>
      <div><span>PAL DO PAL KE LAMHE</span><h1>{label(chapter)} · {chapter.title}</h1></div>
      <strong>{index + 1}/{pages.length}</strong>
    </header>
    <div className="pdlpl-progress"><span style={{ width: `${progress}%` }} /></div>
    <section className="pdlpl-reader-content">
      <div className="pdlpl-stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <img src={pages[index].url} alt={`${label(chapter)} page ${index + 1}`} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} draggable="false" />
        <button type="button" className="pdlpl-side left" onClick={() => setIndex(value => Math.max(0, value - 1))} disabled={index === 0}>‹</button>
        <button type="button" className="pdlpl-side right" onClick={() => setIndex(value => Math.min(pages.length - 1, value + 1))} disabled={index === pages.length - 1}>›</button>
      </div>
      <div className="pdlpl-reader-controls">
        <button type="button" onClick={() => setIndex(value => Math.max(0, value - 1))} disabled={index === 0}>← Previous</button>
        <span>Page {index + 1} of {pages.length}</span>
        <button type="button" onClick={() => setIndex(value => Math.min(pages.length - 1, value + 1))} disabled={index === pages.length - 1}>Next →</button>
      </div>
      <div className="pdlpl-chapter-nav">
        {previous ? <button type="button" onClick={() => onOpenChapter(previous)}>← {label(previous)}</button> : <span />}
        {next ? <button type="button" onClick={() => onOpenChapter(next)}> {label(next)} →</button> : <span />}
      </div>
    </section>
  </main>;

  function onOpenChapter(nextChapter) {
    onBack(nextChapter.id);
  }
}

export default function PalDoPalKeLamhe() {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lockChapter, setLockChapter] = useState(null);
  const route = window.location.hash.replace(/^#/, '');

  const load = async () => {
    try {
      const [rows, access] = await Promise.all([buildPdlplChapters(), getPdlplMemberAccess()]);
      setChapters(rows.filter(published));
      setMember(access.member);
      setAdmin(access.admin);
    } catch (error) {
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const onAuth = () => load();
    window.addEventListener('hashchange', onAuth);
    return () => window.removeEventListener('hashchange', onAuth);
  }, []);

  useEffect(() => {
    if (!chapters.length) return;
    const match = route.match(new RegExp(`^${PDLPL_ROUTE}/read/(.+)$`));
    if (!match) { setSelected(null); return; }
    const chapter = chapters.find(item => String(item.id) === String(decodeURIComponent(match[1])));
    if (!chapter) { setSelected(null); return; }
    if (!member && !admin) { setLockChapter(chapter); window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${PDLPL_ROUTE}`); return; }
    setSelected(chapter);
  }, [chapters, member, admin, route]);

  useEffect(() => {
    if (!selected) return;
    const onKey = event => {
      if (event.key === 'Escape') setSelected(null);
      if (event.key === 'ArrowRight') window.dispatchEvent(new CustomEvent('pdlpl-next-page'));
      if (event.key === 'ArrowLeft') window.dispatchEvent(new CustomEvent('pdlpl-prev-page'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const openChapter = chapter => {
    if (!member && !admin) { setLockChapter(chapter); return; }
    window.location.hash = `${PDLPL_ROUTE}/read/${encodeURIComponent(chapter.id)}`;
  };

  const exitReader = nextChapterId => {
    window.location.hash = nextChapterId ? `${PDLPL_ROUTE}/read/${encodeURIComponent(nextChapterId)}` : PDLPL_ROUTE;
  };

  if (selected) return <Reader chapter={selected} chapters={chapters} onBack={exitReader} onLock={setLockChapter} />;
  return <main className="pdlpl-page">
    <header className="pdlpl-header">
      <div><button type="button" className="pdlpl-back" onClick={() => { window.location.hash = 'home'; }}>←</button><div><span>SIDE STORY · SCHOOL LIFE</span><h1>Pal Do Pal Ke Lamhe</h1><p>Members-only side story.</p></div></div>
      {admin && <a className="pdlpl-admin-link" href="#pal-do-pal-admin">Side Story Admin →</a>}
    </header>
    {loading ? <div className="pdlpl-loading">Loading chapters…</div> :
      <section className="pdlpl-section">
        <div className="pdlpl-section-head"><div><span>MEMBERS ONLY</span><h2>Chapters</h2></div><p>{chapters.length} published {chapters.length === 1 ? 'chapter' : 'chapters'}</p></div>
        {!chapters.length ? <div className="pdlpl-empty"><h3>No chapters published yet.</h3><p>The side story is still being planned.</p></div> :
          <div className="pdlpl-chapters">{chapters.map(chapter => <ChapterRow key={chapter.id} chapter={chapter} member={member || admin} onOpen={openChapter} />)}</div>}
      </section>}
    {lockChapter && <LockedModal chapter={lockChapter} onClose={() => setLockChapter(null)} />}
  </main>;
}
