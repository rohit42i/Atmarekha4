import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

export default function ChapterReader({ chapterId, onBack }) {
    const [chapter, setChapter] = useState(null);
    const [loading, setLoading] = useState(true);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

    useEffect(() => {
        let cancelled = false;
        const fetchChapter = async () => {
            try {
                const res = await axios.get(`${apiBaseUrl}/api/chapters/detail/${chapterId}`);
                if (!cancelled) setChapter(res.data);
            } catch (err) {
                console.error('Failed to fetch chapter:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        if (chapterId) fetchChapter();
        return () => { cancelled = true; };
    }, [chapterId, apiBaseUrl]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="relative h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-pink-500 dark:border-zinc-800 dark:border-t-pink-500" />
            </div>
        );
    }

    if (!chapter) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600"><i className="fa-solid fa-book-open text-2xl" /></div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-[var(--text-color)]">Chapter not found</h2>
                <p className="mt-2 text-zinc-500">This chapter may have been removed or doesn't exist.</p>
                <button onClick={onBack} className="mt-6 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-[var(--text-color)] transition hover:bg-blue-700">Go Back</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            <div className="fixed top-0 z-50 w-full border-b border-zinc-200 bg-[var(--card-bg)]/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
                <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
                    <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-[var(--text-color)]" title="Go back"><i className="fa-solid fa-arrow-left" /></button>
                    <div className="flex-1 min-w-0">
                        <h1 className="truncate text-lg font-bold text-zinc-900 dark:text-[var(--text-color)]">Chapter {chapter.chapterNumber}</h1>
                        <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{chapter.title}</p>
                    </div>
                </div>
            </div>

            <div className="pt-20 pb-12">
                {chapter.pdfUrl && (
                    <div className="mx-auto max-w-5xl px-6"><div className="overflow-hidden rounded-2xl border border-zinc-200 bg-[var(--card-bg)] shadow-sm dark:border-zinc-800 dark:bg-zinc-900"><iframe src={`${apiBaseUrl}${chapter.pdfUrl}`} className="h-[85vh] w-full" title="Chapter PDF" /></div></div>
                )}
                {chapter.pages && chapter.pages.length > 0 && <SwipeableReader pages={chapter.pages} apiBaseUrl={apiBaseUrl} />}
                {!chapter.pdfUrl && (!chapter.pages || chapter.pages.length === 0) && (
                    <div className="mx-auto max-w-3xl px-6"><div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-[var(--card-bg)] py-20 dark:border-zinc-800 dark:bg-zinc-900"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600"><i className="fa-solid fa-file-circle-xmark text-2xl" /></div><h3 className="font-semibold text-zinc-900 dark:text-[var(--text-color)]">No content available</h3><p className="mt-1 text-zinc-500">This chapter hasn't been uploaded yet.</p></div></div>
                )}
            </div>
        </div>
    );
}

function SwipeableReader({ pages, apiBaseUrl }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadedPages, setLoadedPages] = useState(() => new Set());
    const [pageLoading, setPageLoading] = useState(true);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const preloaded = useRef(new Map());
    const loading = useRef(new Set());
    const minSwipeDistance = 50;

    const pageUrl = useCallback((index) => `${apiBaseUrl}${pages[index]}`, [apiBaseUrl, pages]);

    // Decode an image before marking it ready. This makes the visible transition much smoother.
    const preloadPage = useCallback((index, priority = false) => {
        if (index < 0 || index >= pages.length || preloaded.current.has(index) || loading.current.has(index)) return;
        loading.current.add(index);
        const img = new Image();
        img.decoding = 'async';
        img.loading = priority ? 'eager' : 'lazy';
        img.fetchPriority = priority ? 'high' : 'low';
        const url = pageUrl(index);
        img.onload = async () => {
            try { if (img.decode) await img.decode(); } catch (_) { /* already loaded */ }
            preloaded.current.set(index, img);
            loading.current.delete(index);
            setLoadedPages(prev => {
                const next = new Set(prev);
                next.add(index);
                return next;
            });
        };
        img.onerror = () => loading.current.delete(index);
        img.src = url;
    }, [pageUrl, pages.length]);

    // Keep a small rolling window: previous page + current page + next 2 pages.
    // On the first page this intentionally downloads 3 images at once.
    const warmWindow = useCallback((index) => {
        const targets = [index - 1, index, index + 1, index + 2];
        targets.forEach((target, offset) => preloadPage(target, offset === 1));
    }, [preloadPage]);

    useEffect(() => {
        setPageLoading(!loadedPages.has(currentIndex));
        warmWindow(currentIndex);
    }, [currentIndex, warmWindow, loadedPages]);

    const nextPage = useCallback(() => {
        if (currentIndex < pages.length - 1) {
            const next = currentIndex + 1;
            preloadPage(next, true);
            warmWindow(next);
            setCurrentIndex(next);
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [currentIndex, pages.length, preloadPage, warmWindow]);

    const prevPage = useCallback(() => {
        if (currentIndex > 0) {
            const prev = currentIndex - 1;
            preloadPage(prev, true);
            warmWindow(prev);
            setCurrentIndex(prev);
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [currentIndex, preloadPage, warmWindow]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextPage(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); prevPage(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nextPage, prevPage]);

    const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
    const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
    const onTouchEnd = () => {
        if (touchStart == null || touchEnd == null) return;
        const distance = touchStart - touchEnd;
        if (distance > minSwipeDistance) nextPage();
        else if (distance < -minSwipeDistance) prevPage();
    };

    const currentImage = preloaded.current.get(currentIndex);

    return (
        <div className="mx-auto max-w-3xl px-4 min-h-[80vh] flex flex-col justify-center select-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="relative mb-6">
                <div className="relative min-h-[240px] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    {pageLoading && (
                        <div className="absolute inset-0 z-10 flex min-h-[240px] flex-col items-center justify-center bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur-[2px]">
                            <div className="relative flex h-14 w-14 items-center justify-center" aria-hidden="true">
                                <div className="absolute inset-0 rounded-full border border-pink-200 dark:border-pink-950/80" />
                                <div className="absolute inset-0 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
                                <svg viewBox="0 0 64 64" className="h-8 w-8 text-pink-500 animate-[spin_1.8s_linear_infinite]" fill="currentColor"><path d="M32 24c-1.9-8.6-7.1-13-12.4-10.7-4.2 1.8-4.4 7.3-.7 11.1-7.5-3.2-13.6-.7-13.6 4.7 0 4.4 4.7 7.1 10.3 6.9-6.2 5.4-5.6 11.9-1.2 14.2 4 2.1 8.7-.8 10.9-5.7 1.1 8.4 6.1 12.3 10.7 10.1 4.1-2 4.2-7.3.9-11.1 7.3 3.2 13.4.9 13.6-4.2.2-4.5-4.4-7.5-10.2-7.3 6.3-5.4 5.8-11.8 1.5-14.1-4.1-2.2-8.8.7-10.9 5.9ZM32 29.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Z" /></svg>
                            </div>
                            <span className="mt-4 text-sm font-medium tracking-wide text-zinc-700 dark:text-zinc-200">Preparing page {currentIndex + 1}</span>
                        </div>
                    )}

                    {currentImage ? (
                        <img key={currentIndex} src={currentImage.src} alt={`Page ${currentIndex + 1}`} className="block w-full h-auto object-contain max-h-[85vh] mx-auto" decoding="async" draggable="false" onLoad={() => setPageLoading(false)} />
                    ) : (
                        <img key={currentIndex} src={pageUrl(currentIndex)} alt={`Page ${currentIndex + 1}`} className="block w-full h-auto object-contain max-h-[85vh] mx-auto" fetchPriority="high" decoding="async" onLoad={() => { preloadPage(currentIndex, true); setPageLoading(false); }} />
                    )}

                    <div className="absolute inset-y-0 left-0 w-1/4 cursor-pointer opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-black/10 to-transparent flex items-center justify-start pl-4" onClick={prevPage} title="Previous Page">
                        {currentIndex > 0 && <i className="fas fa-chevron-left text-3xl text-[var(--text-color)]/70 drop-shadow-md" />}
                    </div>
                    <div className="absolute inset-y-0 right-0 w-1/4 cursor-pointer opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-l from-black/10 to-transparent flex items-center justify-end pr-4" onClick={nextPage} title="Next Page">
                        {currentIndex < pages.length - 1 && <i className="fas fa-chevron-right text-3xl text-[var(--text-color)]/70 drop-shadow-md" />}
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-[var(--card-bg)] dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 p-4 shadow-lg z-40">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <button onClick={prevPage} disabled={currentIndex === 0} className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-[var(--text-color)] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-95"><i className="fas fa-arrow-left mr-2" /> Prev</button>
                    <div className="text-center px-4"><span className="block text-sm font-bold text-zinc-900 dark:text-[var(--text-color)]">Page {currentIndex + 1}</span><span className="text-xs text-zinc-500">of {pages.length}</span></div>
                    <button onClick={nextPage} disabled={currentIndex === pages.length - 1} className="flex-1 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-[var(--text-color)] dark:text-[var(--text-color)] font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 dark:hover:bg-zinc-200 transition active:scale-95">Next <i className="fas fa-arrow-right ml-2" /></button>
                </div>
                <p className="text-center text-[10px] text-zinc-400 mt-2">Tip: Swipe left/right or use arrow keys</p>
            </div>
            <div className="h-24" />
        </div>
    );
}
