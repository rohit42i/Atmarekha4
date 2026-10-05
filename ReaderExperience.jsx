import { useEffect, useState } from 'react';

export default function ReaderExperience({ chapter, pages, index, setIndex }) {
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const total = pages.length;
  const page = Math.min(Math.max(index + 1, 1), Math.max(total, 1));

  useEffect(() => {
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      if (typing) return;

      const key = event.key.toLowerCase();
      if (key === 'f') {
        event.preventDefault();
      } else if (key === 'g') {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (event.key === 'home') {
        event.preventDefault();
      } else if (event.key === 'end') {
        event.preventDefault();
      } else if (event.key === 'escape') {
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
            <button type="button" onClick={toggleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen · G'} aria-label={fullscreen ? 'Exit fullscreen' : 'Open fullscreen'}>
              <span aria-hidden="true">⛶</span>
            </button>
            <button type="button" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts · ?" aria-label="Show keyboard shortcuts">
              <span aria-hidden="true">?</span>
            </button>
          </>
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
