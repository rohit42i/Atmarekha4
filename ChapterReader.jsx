import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ChapterReader({ chapterId, onBack }) {
    const [chapter, setChapter] = useState(null);
    const [loading, setLoading] = useState(true);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

    useEffect(() => {
        const fetchChapter = async () => {
            try {
                const res = await axios.get(`${apiBaseUrl}/api/chapters/detail/${chapterId}`);
                setChapter(res.data);
            } catch (err) {
                console.error('Failed to fetch chapter:', err);
            } finally {
                setLoading(false);
            }
        };

        if (chapterId) fetchChapter();
    }, [chapterId]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!chapter) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600">
                    <i className="fa-solid fa-book-open text-2xl"></i>
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Chapter not found</h2>
                <p className="mt-2 text-zinc-500">This chapter may have been removed or doesn't exist.</p>
                <button
                    onClick={onBack}
                    className="mt-6 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* Fixed Header */}
            <div className="fixed top-0 z-50 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
                <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
                    <button
                        onClick={onBack}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                        title="Go back"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="truncate text-lg font-bold text-zinc-900 dark:text-white">
                            Chapter {chapter.chapterNumber}
                        </h1>
                        <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{chapter.title}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="pt-20 pb-12">
                {/* PDF Mode */}
                {chapter.pdfUrl && (
                    <div className="mx-auto max-w-5xl px-6">
                        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <iframe
                                src={`${apiBaseUrl}${chapter.pdfUrl}`}
                                className="h-[85vh] w-full"
                                title="Chapter PDF"
                            />
                        </div>
                    </div>
                )}

                {/* Image Mode (Swipeable) */}
                {chapter.pages && chapter.pages.length > 0 && (
                    <SwipeableReader pages={chapter.pages} apiBaseUrl={apiBaseUrl} />
                )}

                {/* No Content */}
                {!chapter.pdfUrl && (!chapter.pages || chapter.pages.length === 0) && (
                    <div className="mx-auto max-w-3xl px-6">
                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-white py-20 dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600">
                                <i className="fa-solid fa-file-circle-xmark text-2xl"></i>
                            </div>
                            <h3 className="font-semibold text-zinc-900 dark:text-white">No content available</h3>
                            <p className="mt-1 text-zinc-500">This chapter hasn't been uploaded yet.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SwipeableReader({ pages, apiBaseUrl }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    // Minimum swipe distance (in px)
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null); // Reset touch end
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            nextPage();
        } else if (isRightSwipe) {
            prevPage();
        }
    };

    const nextPage = () => {
        if (currentIndex < pages.length - 1) {
            setCurrentIndex(prev => prev + 1);
            window.scrollTo(0, 0);
        }
    };

    const prevPage = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            window.scrollTo(0, 0);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                nextPage();
            } else if (e.key === 'ArrowLeft') {
                prevPage();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex]);

    return (
        <div
            className="mx-auto max-w-3xl px-4 min-h-[80vh] flex flex-col justify-center select-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <div className="relative mb-6">
                {/* Image Container */}
                <div className="relative overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <img
                        src={`${apiBaseUrl}${pages[currentIndex]}`}
                        alt={`Page ${currentIndex + 1}`}
                        className="w-full h-auto object-contain max-h-[85vh] mx-auto"
                        loading="eager"
                    />

                    {/* Turn Hints (Desktop Hover) */}
                    <div
                        className="absolute inset-y-0 left-0 w-1/4 cursor-pointer opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-black/10 to-transparent flex items-center justify-start pl-4"
                        onClick={prevPage}
                        title="Previous Page"
                    >
                        {currentIndex > 0 && <i className="fas fa-chevron-left text-3xl text-white/70 drop-shadow-md"></i>}
                    </div>
                    <div
                        className="absolute inset-y-0 right-0 w-1/4 cursor-pointer opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-l from-black/10 to-transparent flex items-center justify-end pr-4"
                        onClick={nextPage}
                        title="Next Page"
                    >
                        {currentIndex < pages.length - 1 && <i className="fas fa-chevron-right text-3xl text-white/70 drop-shadow-md"></i>}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 p-4 shadow-lg z-40">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <button
                        onClick={prevPage}
                        disabled={currentIndex === 0}
                        className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-95"
                    >
                        <i className="fas fa-arrow-left mr-2"></i> Prev
                    </button>

                    <div className="text-center px-4">
                        <span className="block text-sm font-bold text-zinc-900 dark:text-white">
                            Page {currentIndex + 1}
                        </span>
                        <span className="text-xs text-zinc-500">
                            of {pages.length}
                        </span>
                    </div>

                    <button
                        onClick={nextPage}
                        disabled={currentIndex === pages.length - 1}
                        className="flex-1 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 dark:hover:bg-zinc-200 transition active:scale-95"
                    >
                        Next <i className="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
                <p className="text-center text-[10px] text-zinc-400 mt-2">
                    Tip: Swipe left/right or use arrow keys
                </p>
            </div>

            {/* Bottom spacer for fixed controls */}
            <div className="h-24"></div>
        </div>
    );
}
