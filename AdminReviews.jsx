import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminReviews({ apiBaseUrl, onBack }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        try {
            const res = await axios.get(`${apiBaseUrl}/api/reviews/all`);
            setReviews(res.data);
        } catch (err) {
            console.error('Failed to fetch reviews:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this review?')) return;
        try {
            await axios.delete(`${apiBaseUrl}/api/reviews/${id}`);
            fetchReviews();
        } catch (err) {
            console.error(err);
            alert('Failed to delete review');
        }
    };

    return (
        <div className="space-y-8">
            <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                &larr; Back to Dashboard
            </button>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-6 text-xl font-bold dark:text-white">All Reviews</h2>

                {loading ? (
                    <div className="flex h-40 items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-blue-600"></div>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {reviews.map(review => (
                            <div key={review._id} className="relative flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                                <div>
                                    <div className="mb-3 flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                                <span className="font-bold">{review.user.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-zinc-900 dark:text-white">{review.user}</h3>
                                                <p className="text-xs text-zinc-500">
                                                    on <span className="font-medium text-zinc-700 dark:text-zinc-300">{review.story?.title || 'Unknown'}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-3 flex text-yellow-400 text-sm">
                                        {[...Array(5)].map((_, i) => (
                                            <i key={i} className={i < review.rating ? "fa-solid fa-star" : "fa-regular fa-star text-zinc-300 dark:text-zinc-700"}></i>
                                        ))}
                                    </div>

                                    <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-4">
                                        "{review.comment}"
                                    </p>
                                </div>

                                <div className="flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                                    <span className="text-xs text-zinc-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                                    <button
                                        onClick={() => handleDelete(review._id)}
                                        className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                                        title="Delete Review"
                                    >
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {reviews.length === 0 && (
                            <p className="col-span-full py-12 text-center text-zinc-500">No reviews submitted yet.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
