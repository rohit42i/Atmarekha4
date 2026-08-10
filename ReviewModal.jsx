import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ReviewModal({ isOpen, onClose, storyId, storyTitle }) {
    const [name, setName] = useState('');
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [reviews, setReviews] = useState([]);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

    useEffect(() => {
        if (isOpen && storyId) {
            fetchReviews();
        }
    }, [isOpen, storyId]);

    const fetchReviews = async () => {
        try {
            const res = await axios.get(`${apiBaseUrl}/api/reviews/story/${storyId}`);
            setReviews(res.data);
        } catch (err) {
            console.error('Failed to fetch reviews:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await axios.post(`${apiBaseUrl}/api/reviews`, {
                storyId,
                user: name,
                rating,
                comment
            });
            alert('Review submitted successfully!');
            setName('');
            setRating(5);
            setComment('');
            fetchReviews(); // Refresh list
        } catch (err) {
            console.error(err);
            alert('Failed to submit review');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900 md:flex-row">
                {/* Form Section */}
                <div className="w-full overflow-y-auto p-6 md:w-1/2 md:border-r border-zinc-200 dark:border-zinc-800">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-bold dark:text-white">Review: {storyTitle}</h2>
                        <button onClick={onClose} className="md:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Your Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                                placeholder="Enter your name"
                                required
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Rating</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`text-2xl transition hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-700'}`}
                                    >
                                        <i className="fa-solid fa-star"></i>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Comment</label>
                            <textarea
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                                rows="4"
                                placeholder="What did you think about this story?"
                                required
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Submitting...' : 'Submit Review'}
                        </button>
                    </form>
                </div>

                {/* Reviews List Section */}
                <div className="flex w-full flex-col bg-zinc-50 dark:bg-zinc-950 md:w-1/2">
                    <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
                        <h3 className="font-semibold text-zinc-900 dark:text-white">Community Reviews ({reviews.length})</h3>
                        <button onClick={onClose} className="hidden md:block text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto p-6">
                        {reviews.length === 0 ? (
                            <p className="text-center text-sm text-zinc-500">No reviews yet. Be the first to review!</p>
                        ) : (
                            reviews.map(review => (
                                <div key={review._id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                                {review.user.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-zinc-900 dark:text-white">{review.user}</span>
                                        </div>
                                        <span className="text-xs text-zinc-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="mb-2 flex text-xs text-yellow-400">
                                        {[...Array(5)].map((_, i) => (
                                            <i key={i} className={i < review.rating ? "fa-solid fa-star" : "fa-regular fa-star text-zinc-300 dark:text-zinc-700"}></i>
                                        ))}
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{review.comment}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
