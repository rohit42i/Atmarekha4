import { useEffect, useMemo, useState } from 'react';
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

export default function ChapterDiscovery({ chapters, stats, renderChapter }) {
  const [query, setQuery] = useState('');
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
    const matches = needle
      ? chapters.filter(chapter => {
          const haystack = [
            chapter.title,
            chapter.chapterNumber,
            `chapter ${chapter.chapterNumber ?? ''}`
          ].join(' ').toLowerCase();
          return haystack.includes(needle);
        })
      : [...chapters];

    const getNumber = chapter => {
      const value = Number(chapter.chapterNumber);
      return Number.isFinite(value) ? value : -Infinity;
    };

    matches.sort((a, b) => {
      if (sort === 'newest') return new Date(b.releaseDate || b.createdAt || 0) - new Date(a.releaseDate || a.createdAt || 0);
      if (sort === 'oldest') return new Date(a.releaseDate || a.createdAt || 0) - new Date(b.releaseDate || b.createdAt || 0);
      if (sort === 'rating') return Number(stats?.[b.id]?.rating?.average || 0) - Number(stats?.[a.id]?.rating?.average || 0);
      if (sort === 'views') return Number(stats?.[b.id]?.views || 0) - Number(stats?.[a.id]?.views || 0);
      return getNumber(a) - getNumber(b);
    });

    return matches;
  }, [chapters, query, sort, stats]);

  return (
    <>
      <div className="chapter-discovery" role="search">
        <label>
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search chapters…" aria-label="Search chapters" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear chapter search">×</button>}
        </label>
        <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort chapters">
          <option value="chapter">Chapter order</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="rating">Top rated</option>
          <option value="views">Most viewed</option>
        </select>
      </div>

      {renderChapter(visible, recentChapterIds, navigateToChapter)}

      {!visible.length && (
        <div className="chapter-discovery-empty">
          <strong>No chapters found</strong>
          <span>Try a chapter number or title.</span>
        </div>
      )}

      <button type="button" className="chapter-discovery-reset" onClick={() => { setQuery(''); setSort('chapter'); }} style={{ display: query || sort !== 'chapter' ? 'inline-flex' : 'none' }}>
        Reset filters
      </button>
    </>
  );
}

export function ChapterDiscoveryRender({ visibleChapters, recentChapterIds, stats, openRating, openComments }) {
  return visibleChapters.map(chapter => {
    const item = stats[chapter.id] || { rating: { average: 0, count: 0 }, views: 0, comments: 0 };
    return (
      <article className="chapter-row" key={chapter.id} data-chapter-id={String(chapter.id)}>
        <a className="chapter-row-main" href={chapterPath(chapter)} onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          navigateToChapter(chapter);
        }}>
          <div className="chapter-row-title">
            <span>Chapter {chapter.chapterNumber ?? 'Special'}</span>
            <h2>{chapter.title || 'Untitled chapter'}</h2>
          </div>
          <div className="chapter-row-meta">
            <span>{item.rating.count ? `${item.rating.average.toFixed(1)}/10` : '—'} <b>★</b></span>
            <span>•</span>
            <span>{formatDate(chapter.releaseDate || chapter.createdAt)}</span>
            <span>•</span>
            <span>👁 {new Intl.NumberFormat('en-IN', { notation: Number(item.views) > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(Number(item.views) || 0)}</span>
          </div>
          <div className="chapter-row-details">
            <span>📄 {chapter.pageCount || '—'} pages</span>
            {recentChapterIds[String(chapter.id)] && <span className="chapter-resume-label">Resume · page {recentChapterIds[String(chapter.id)]}</span>}
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
