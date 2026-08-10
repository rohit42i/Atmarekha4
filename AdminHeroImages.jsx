import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminHeroImages({ apiBaseUrl, onBack }) {
    const [images, setImages] = useState([]);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async () => {
        try {
            const res = await axios.get(`${apiBaseUrl}/api/hero-images`);
            setImages(res.data);
        } catch (err) {
            console.error('Failed to fetch images:', err);
            setError('Failed to load images');
        } finally {
            setLoading(false);
        }
    };

    const handleAddImage = async (e) => {
        e.preventDefault();
        if (!newImageUrl.trim()) return;

        setAdding(true);
        try {
            await axios.post(`${apiBaseUrl}/api/hero-images`, { imageUrl: newImageUrl });
            setNewImageUrl('');
            fetchImages();
        } catch (err) {
            console.error('Failed to add image:', err);
            setError('Failed to add image. Please check the URL.');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteImage = async (id) => {
        if (!window.confirm('Are you sure you want to remove this image?')) return;

        try {
            await axios.delete(`${apiBaseUrl}/api/hero-images/${id}`);
            fetchImages();
        } catch (err) {
            console.error('Failed to delete image:', err);
            setError('Failed to delete image');
        }
    };

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <button
                        onClick={onBack}
                        className="mb-2 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    >
                        &larr; Back to Dashboard
                    </button>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Manage Hero Images</h2>
                    <p className="text-zinc-500 text-sm">Add or remove images for the home page slideshow.</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Add Image Form */}
            <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <form onSubmit={handleAddImage} className="flex gap-4">
                    <input
                        type="url"
                        placeholder="Paste image URL (e.g., from Unsplash, Pexels)"
                        className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-4 py-2 text-zinc-900 placeholder-zinc-500 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:text-white"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        required
                    />
                    <button
                        type="submit"
                        disabled={adding}
                        className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                        {adding ? 'Adding...' : 'Add Image'}
                    </button>
                </form>
            </div>

            {/* Image List */}
            {loading ? (
                <div className="text-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {images.map((img) => (
                        <div key={img._id} className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="aspect-video w-full overflow-hidden">
                                <img
                                    src={img.imageUrl}
                                    alt="Hero Background"
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                    onClick={() => handleDeleteImage(img._id)}
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700"
                                    title="Delete Image"
                                >
                                    <i className="fa-solid fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>
                    ))}

                    {images.length === 0 && (
                        <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-300 rounded-xl dark:border-zinc-700">
                            No custom images added. The default set will be used.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
