import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function UserProfile({ onSelectChapter, onBack }) {
    const [bookmarks, setBookmarks] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // 1. Fetch Bookmarks with chapter details
            const { data: bookmarkData } = await supabase
                .from('bookmarks')
                .select('chapter_id, chapters(*)')
                .eq('user_id', user.id);

            if (bookmarkData) setBookmarks(bookmarkData.map(b => b.chapters));

            // 2. Fetch Reading History with chapter details
            const { data: historyData } = await supabase
                .from('reading_history')
                .select('chapter_id, page_number, updated_at, chapters(*)')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (historyData) setHistory(historyData);

            setLoading(false);
        };

        fetchUserData();
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-6">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={onBack}
                    className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                >
                    <i className="fa-solid fa-arrow-left"></i> Back to Home
                </button>

                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-8">My Reading Profile</h1>

                {/* Continue Reading Section */}
                <section className="mb-10">
                    <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Continue Reading</h2>
                    {history.length > 0 ? (
                        <div className="space-y-3">
                            {history.map((item) => (
                                item.chapters && (
                                    <div 
                                        key={item.id || item.chapter_id}
                                        onClick={() => onSelectChapter(item.chapters.id)}
                                        className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-blue-500 transition shadow-sm"
                                    >
                                        <div>
                                            <h3 className="font-bold text-zinc-900 dark:text-white">Chapter {item.chapters.chapter_number}: {item.chapters.title}</h3>
                                            <p className="text-xs text-zinc-500">Last read on page {item.page_number}</p>
                                        </div>
                                        <i className="fa-solid fa-chevron-right text-zinc-400"></i>
                                    </div>
                                )
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-zinc-500">No reading history yet. Start reading a chapter to track your progress!</p>
                    )}
                </section>

                {/* Bookmarks Section */}
                <section>
                    <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Bookmarked Chapters</h2>
                    {bookmarks.length > 0 ? (
                        <div className="space-y-3">
                            {bookmarks.map((chap) => (
                                chap && (
                                    <div 
                                        key={chap.id}
                                        onClick={() => onSelectChapter(chap.id)}
                                        className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-red-500 transition shadow-sm"
                                    >
                                        <div>
                                            <h3 className="font-bold text-zinc-900 dark:text-white">Chapter {chap.chapter_number}: {chap.title}</h3>
                                        </div>
                                        <i className="fa-solid fa-bookmark text-red-500"></i>
                                    </div>
                                )
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-zinc-500">No bookmarked chapters yet.</p>
                    )}
                </section>
            </div>
        </div>
    );
}

