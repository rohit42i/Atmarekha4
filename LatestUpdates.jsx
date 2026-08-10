import { useState, useEffect } from 'react';
import axios from 'axios';
import { gsap } from 'gsap';

export default function LatestUpdates() {
    const [announcements, setAnnouncements] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

    useEffect(() => {
        const fetchUpdates = async () => {
            try {
                const res = await axios.get(`${apiBaseUrl}/api/announcements`);
                if (res.data.success) {
                    setAnnouncements(res.data.data);
                }
            } catch (err) {
                console.error('Failed to load updates', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUpdates();
    }, []);

    useEffect(() => {
        if (!isLoading && announcements.length > 0) {
            gsap.from('.update-card', {
                y: 20,
                opacity: 0,
                duration: 0.8,
                stagger: 0.1,
                ease: 'power2.out'
            });
        }
    }, [isLoading, announcements]);

    return (
        <div className="min-h-screen pt-28 pb-20 px-6">
            <div className="mx-auto max-w-3xl">
                <button
                    onClick={() => window.location.hash = '#index'}
                    className="mb-8 flex items-center gap-2 text-premium-charcoal/70 hover:text-premium-royal dark:text-zinc-500 dark:hover:text-white transition"
                >
                    &larr; Back to Home
                </button>

                <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-2">Latest Updates</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mb-12">
                    Stay tuned with the latest announcements, features, and news from Atma Rekha.
                </p>

                {isLoading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className="h-40 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse"></div>
                        ))}
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-premium-gold/20 dark:border-zinc-800 shadow-sm">
                        <i className="fas fa-bullhorn text-4xl text-premium-gold dark:text-zinc-700 mb-4"></i>
                        <p className="text-premium-charcoal dark:text-zinc-400 text-lg">No updates yet. Check back soon!</p>
                    </div>
                ) : (
                    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-premium-gold before:to-transparent dark:before:via-zinc-700">
                        {announcements.map((item, index) => (
                            <div key={item._id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group update-card">

                                {/* Timeline Dot */}
                                <div className="absolute left-0 md:left-1/2 w-10 h-10 border-4 border-white dark:border-zinc-950 bg-premium-gold dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-lg z-10 transform -translate-x-1/2">
                                    <i className="fas fa-check text-xs text-white dark:text-zinc-400"></i>
                                </div>

                                {/* Content Card */}
                                <div className="ml-12 md:ml-0 md:w-[45%] bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-lg border border-premium-gold/20 dark:border-zinc-800 hover:shadow-xl transition duration-300 hover:border-premium-gold/40 dark:hover:border-zinc-700">
                                    <span className="inline-block px-3 py-1 rounded-full bg-premium-cream dark:bg-zinc-800 text-xs font-semibold text-premium-royal dark:text-zinc-300 mb-3 border border-premium-gold/10 dark:border-zinc-700">
                                        {new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </span>
                                    <h3 className="text-xl font-bold text-premium-royal dark:text-white mb-2 group-hover:text-premium-gold dark:group-hover:text-blue-400 transition">
                                        {item.title}
                                    </h3>
                                    <p className="text-premium-charcoal dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                                        {item.content}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
