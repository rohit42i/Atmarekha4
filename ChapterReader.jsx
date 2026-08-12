import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

export default function ChapterReader({ chapterId, onBack }) {
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    let alive = true;
    const fetchChapter = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/api/chapters/detail/${chapterId}`);
        if (alive) setChapter(res.data);
      } catch (err) {
        console.error('Failed to fetch chapter:', err);
      } finally {
        if (alive) setLoading(false);
      }
    };
    if (chapterId) fetchChapter();
    return () => { alive = false; };
  }, [chapterId, apiBaseUrl]);

  if (loading) return <div className="reader-page reader-loading"><div className="loading-spinner" /><span>Opening chapter…</span></div>;
  if (!chapter) return <div className="reader-page reader-loading"><div className="empty-state"><h2>Chapter not found</h2><p>This chapter may have been removed or doesn't exist.</p><button onClick={onBack} className="primary-button reader-back-button">Go Back</button></div></div>;

  return (
    <div className="reader-page">
      <div className="reader-header">
        <div className="reader-header-inner">
          <button onClick={onBack} className="reader-back" title="Go back" aria-label="Go back"><i className="fa-solid fa-arrow-left" /></button>
          <div className="reader-title"><p>ATMA REKHA</p><h1>Chapter {chapter.chapterNumber}{chapter.title ? ` · ${chapter.title}` : ''}</h1></div>
        </div>
      </div>
      {chapter.pdfUrl && <div className="reader-content"><div className="reader-pdf"><iframe src={`${apiBaseUrl}${chapter.pdfUrl}`} title="Chapter PDF" /></div></div>}
      {chapter.pages?.length > 0 && <SwipeableReader pages={chapter.pages} apiBaseUrl={apiBaseUrl} />}
      {!chapter.pdfUrl && !chapter.pages?.length && <div className="reader-content"><div className="empty-state"><h3>No content available</h3><p>This chapter hasn't been uploaded yet.</p></div></div>}
    </div>
  );
}

function SwipeableReader({ pages, apiBaseUrl }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;
  const progress = useMemo(() => ((currentIndex + 1) / pages.length) * 100, [currentIndex, pages.length]);

  const nextPage = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, pages.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pages.length]);
  const prevPage = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handleKeyDown = e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextPage(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevPage(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage]);

  useEffect(() => {
    const next = pages[currentIndex + 1];
    if (next) { const img = new Image(); img.src = `${apiBaseUrl}${next}`; }
  }, [currentIndex, pages, apiBaseUrl]);

  const onTouchStart = e => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = e => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (touchStart == null || touchEnd == null) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) nextPage();
    if (distance < -minSwipeDistance) prevPage();
  };

  return (
    <div className="reader-content" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="reader-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      <div className="reader-stage" key={currentIndex}>
        <img src={`${apiBaseUrl}${pages[currentIndex]}`} alt={`Chapter page ${currentIndex + 1}`} decoding="async" fetchPriority={currentIndex === 0 ? 'high' : 'auto'} draggable="false" />
        {currentIndex > 0 && <button className="reader-side-button left" onClick={prevPage} aria-label="Previous page"><i className="fas fa-chevron-left" /></button>}
        {currentIndex < pages.length - 1 && <button className="reader-side-button right" onClick={nextPage} aria-label="Next page"><i className="fas fa-chevron-right" /></button>}
      </div>
      <div className="reader-info-row"><span>Swipe, tap the arrows, or use ← →</span><span>{Math.round(progress)}%</span></div>
      <div className="reader-controls">
        <button className="reader-control secondary" onClick={prevPage} disabled={currentIndex === 0}><i className="fas fa-arrow-left mr-2" /> Previous</button>
        <div className="reader-counter"><strong>{currentIndex + 1}</strong><span>OF {pages.length}</span></div>
        <button className="reader-control primary" onClick={nextPage} disabled={currentIndex === pages.length - 1}>Next <i className="fas fa-arrow-right ml-2" /></button>
      </div>
      <div className="reader-thumbnails" aria-label="Chapter pages">
        {pages.map((page, index) => <button key={`${page}-${index}`} className={index === currentIndex ? 'is-active' : ''} onClick={() => setCurrentIndex(index)} aria-label={`Go to page ${index + 1}`}><img src={`${apiBaseUrl}${page}`} alt="" loading="lazy" decoding="async" /></button>)}
      </div>
    </div>
  );
}
