import { useEffect, useState } from 'react';

export default function ReaderExperience({ chapter, pages, index, setIndex }) {
  const [focusMode, setFocusMode] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const total = pages.length;
  const page = Math.min(Math.max(index + 1, 1), Math.max(total, 1));

  useEffect(() => {
    const reader = document.querySelector('.reader-page');
    reader?.classList.toggle('reader-focus-mode', focusMode);
    return () => reader?.classList.remove('reader-focus-mode');
  }, [focusMode]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      if (typing) return;

      const key = event.key.toLowerCase();
      if (key === 'f') {
        event.preventDefault();
        setFocusMode(value => !value);
      } else if (key === 'g') {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (event.key === 'home') {
        event.preventDefault();
        setIndex(0);
      } else if (event.key === 'end') {
        event.preventDefault();
        setIndex(Math.max(total - 1, 0));
      } else if (event.key === 'escape') {
        setNavigatorOpen(false);
        setShortcutsOpen(false);
        setFocusMode(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setIndex, total]);

  useEffect(() => {
    const remember = () => {
      if (!chapter?.id) return;
      try {
        window.localStorage.setItem('atma-reading-last', JSON.stringify({
          chapterId: String(chapter.id),
          pageNumber: page,
          updatedAt: Date.now()
        }));
      } catch {
        // Storage can be unavailable in private/restricted browsers.
      }
    };
    remember();
  }, [chapter?.id, page]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else {
        await document.querySelector('.reader-stage')?.requestFullscreen?.();
      }
    } catch {
      // Fullscreen can be blocked by the browser or an embedded webview.
    }
  };

  const jump = (next) => {
    if (!total) return;
    const safe = Math.min(Math.max(Number(next) || 1, 1), total);
    setIndex(safe - 1);
  };

  const label = chapter?.chapterNumber != null && String(chapter.chapterNumber).trim()
    ? String(chapter.chapterNumber).trim()
    : '';

  return (
    <>
      <div className="reader-experience-tools" aria-label="Reader tools">
        {!focusMode && (
          <>
            <button type="button" onClick={() => setNavigatorOpen(true)} title="Jump to page" aria-label="Jump to page">
              <span>{page}/{total}</span>
            </button>
            <button type="button" onClick={() => setFocusMode(true)} title="Focus reading · F" aria-label="Enter focus reading">
              <span aria-hidden="true">◉</span>
            </button>
            <button type="button" onClick={toggleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen · G'} aria-label={fullscreen ? 'Exit fullscreen' : 'Open fullscreen'}>
              <span aria-hidden="true">⛶</span>
            </button>
            <button type="button" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts · ?" aria-label="Show keyboard shortcuts">
              <span aria-hidden="true">?</span>
            </button>
          </>
        )}
        {focusMode && (
          <>
            <button type="button" className="reader-experience-focus-exit" onClick={() => setFocusMode(false)} title="Exit focus reading · F" aria-label="Exit focus reading">
              Exit focus
            </button>
            <button type="button" onClick={() => setNavigatorOpen(true)} title="Jump to page" aria-label="Jump to page">
              <span>{page}/{total}</span>
            </button>
          </>
        )}
      </div>

      {focusMode && (
        <div className="reader-focus-badge" aria-live="polite">
          <span>Focus reading</span>
          {label && <strong>{label}</strong>}
        </div>
      )}

      {navigatorOpen && (
        <div className="reader-experience-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setNavigatorOpen(false); }}>
          <section className="reader-experience-sheet" role="dialog" aria-modal="true" aria-label="Page navigator">
            <div className="reader-experience-sheet-head">
              <div>
                <p className="section-eyebrow">{label || 'ATMA REKHA'}</p>
                <h2>Jump to page</h2>
              </div>
              <button type="button" onClick={() => setNavigatorOpen(false)} aria-label="Close page navigator">×</button>
            </div>

            <div className="reader-experience-page-readout">
              <strong>{page}</strong>
              <span>of {total}</span>
            </div>

            <input
              className="reader-experience-slider"
              type="range"
              min="1"
              max={Math.max(total, 1)}
              value={page}
              onChange={event => jump(event.target.value)}
              aria-label="Choose page"
            />

            <div className="reader-experience-jumps">
              <button type="button" onClick={() => jump(1)} disabled={page === 1}>First</button>
              <button type="button" onClick={() => jump(Math.max(1, page - 5))} disabled={page === 1}>−5</button>
              <button type="button" onClick={() => jump(Math.min(total, page + 5))} disabled={page === total}>+5</button>
              <button type="button" onClick={() => jump(total)} disabled={page === total}>Last</button>
            </div>

            <div className="reader-experience-sheet-actions">
              <button type="button" onClick={() => { setFocusMode(true); setNavigatorOpen(false); }}>Focus reading</button>
              <button type="button" className="primary-button" onClick={() => { setNavigatorOpen(false); window.setTimeout(() => document.querySelector('.reader-stage img')?.focus?.(), 0); }}>Done</button>
            </div>
          </section>
        </div>
      )}

      {shortcutsOpen && (
        <div className="reader-experience-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShortcutsOpen(false); }}>
          <section className="reader-experience-sheet reader-shortcuts-sheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
            <div className="reader-experience-sheet-head">
              <div>
                <p className="section-eyebrow">READER</p>
                <h2>Shortcuts</h2>
              </div>
              <button type="button" onClick={() => setShortcutsOpen(false)} aria-label="Close shortcuts">×</button>
            </div>
            <div className="reader-shortcuts-grid">
              <span><kbd>←</kbd><b>Previous page</b></span>
              <span><kbd>→</kbd><b>Next page</b></span>
              <span><kbd>Space</kbd><b>Next page</b></span>
              <span><kbd>Home</kbd><b>First page</b></span>
              <span><kbd>End</kbd><b>Last page</b></span>
              <span><kbd>F</kbd><b>Focus reading</b></span>
              <span><kbd>G</kbd><b>Fullscreen</b></span>
              <span><kbd>?</kbd><b>Show shortcuts</b></span>
              <span><kbd>Esc</kbd><b>Close / exit focus</b></span>
            </div>
            <button type="button" className="primary-button reader-shortcuts-close" onClick={() => setShortcutsOpen(false)}>Got it</button>
          </section>
        </div>
      )}
    </>
  );
}
