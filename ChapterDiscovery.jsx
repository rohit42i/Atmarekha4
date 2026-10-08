import { useEffect, useMemo, useRef, useState } from 'react';
import { chapterPath } from './routes';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function navigateToChapter(chapter) {
  if (!chapter?.id) return;
  const path = chapterPath(chapter);
  if (!path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export default function ChapterDiscovery({ chapters, stats, renderChapter, language = 'hi', onLanguageChange }) {
  const [query, setQuery] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('search') || ''; } catch { return ''; }
  });
  const [sort, setSort] = useState('chapter');
  const [recentChapterIds, setRecentChapterIds] = useState({});

  useEffect(() => {
    const next = {};
    chapters.forEach(chapter => {
      try {
        const value = Number(window.localStorage.getItem(`atma-reading:${chapter.id}`));
        if (Number.isInteger(value) && value > 0) next[String(chapter.id)] = value + 1;
      } catch {
        // Ignore storage restrictions.
      }
    });
    setRecentChapterIds(next);
  }, [chapters]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle ? chapters.filter(chapter => [chapter.title, chapter.chapterNumber, `chapter ${chapter.chapterNumber ?? ''}`].join(' ').toLowerCase().includes(needle)) : [...chapters];

    const getNumber = chapter => {
      const value = Number(chapter.chapterNumber);
      return Number.isFinite(value) ? value : -Infinity;
    };

    matches.sort((a, b) => {
      if (sort === 'newest') return new Date(b.releaseDate || b.createdAt || 0) - new Date(a.releaseDate || a.createdAt || 0);
      if (sort === 'oldest') return new Date(a.releaseDate || a.createdAt || 0) - new Date(b.releaseDate || b.createdAt || 0);
      if (sort === 'rating') return Number(stats?.[b.id]?.rating?.average || 0) - Number(stats?.[a.id]?.rating?.average || 0);
      return getNumber(a) - getNumber(b);
    });

    return matches;
  }, [chapters, query, sort, stats]);

  return (
    <>
      <div className="chapter-discovery"><label><span className="chapter-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg></span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search" aria-label="Search" autoComplete="off" spellCheck="false" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear chapter search">×</button>}</label><label className="chapter-language"><span>Language</span><select value={language} onChange={event => onLanguageChange?.(event.target.value)} aria-label="Language"><option value="en">English</option><option value="hi">Hindi</option></select></label><label className="chapter-sort"><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort chapters"><option value="chapter">Chapter</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="rating">Top rated</option></select></label></div>

      {renderChapter(visible, recentChapterIds, navigateToChapter)}

      {!visible.length && (
        <div className="chapter-discovery-empty" role="status" aria-live="polite">
          <strong>No chapters found</strong>
          <span>Try a chapter number or title.</span>
        </div>
      )}

      {visible.length > 0 && visible.length === chapters.length && (
        <div className="chapter-discovery-end" role="status" aria-label="End of chapter list">You’ve reached the end.</div>
      )}
    </>
  );
}

export function ChapterDiscoveryRender({ visibleChapters, recentChapterIds, stats, openRating, openComments }) {
  return visibleChapters.map(chapter => {
    const item = stats[chapter.id] || { rating: { average: 0, count: 0 }, views: 0, comments: 0 };
    const hasListThumbnail = Boolean(chapter.chapterListThumbnailDesktop || chapter.chapterListThumbnailMobile);
    const desktopThumbnail = chapter.chapterListThumbnailDesktop || chapter.cover || '';
    const mobileThumbnail = chapter.chapterListThumbnailMobile || desktopThumbnail;
    return (
      <article className="chapter-row" key={chapter.id} data-chapter-id={String(chapter.id)}>
        <a className="chapter-row-main" href={chapterPath(chapter)} onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          navigateToChapter(chapter);
        }}>
          {hasListThumbnail && (
            <div className="chapter-row-list-thumb" aria-hidden="true">
              <picture>
                <source media="(max-width: 640px)" srcSet={mobileThumbnail} />
                <img src={desktopThumbnail} alt="" loading="lazy" decoding="async" />
              </picture>
            </div>
          )}
          <div className="chapter-row-copy">
            <div className="chapter-row-title">
              <span>Chapter {chapter.chapterNumber ?? 'Special'}</span>
              <h2>{chapter.title || 'Untitled chapter'}</h2>
            </div>
            <div className="chapter-row-meta">
              <span>{item.rating.count ? (item.rating.average.toFixed(1) + '/10') : '—'} <b>★</b></span>
              <span>•</span>
              <span>{formatDate(chapter.releaseDate || chapter.createdAt)}</span>
            </div>
            <div className="chapter-row-details">
              <span>📄 {item.pages || '—'} pages</span>
              {recentChapterIds[String(chapter.id)] && <span className="chapter-resume-label">Resume · page {recentChapterIds[String(chapter.id)]}</span>}
            </div>
          </div>
        </a>
        <div className="chapter-row-actions">
          <button type="button" className="engagement-icon" onClick={() => openRating(chapter)} aria-label={`Rate Chapter ${chapter.chapterNumber ?? ''}`} title={`Rate Chapter ${chapter.chapterNumber ?? ''}`}><span>★</span><small>{item.rating.count ? item.rating.average.toFixed(1) : '—'}</small></button>
          <button type="button" className="engagement-icon" onClick={() => openComments(chapter)} aria-label={`Comments for Chapter ${chapter.chapterNumber ?? ''}`} title={`Comments for Chapter ${chapter.chapterNumber ?? ''}`}><span>💬</span><small>{new Intl.NumberFormat('en-IN', { notation: Number(item.comments) > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(item.comments) || 0)}</small></button>
        </div>
      </article>
    );
  });
}