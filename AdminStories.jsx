import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminStories({ apiBaseUrl }) {
    const [stories, setStories] = useState([]);
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [description, setDescription] = useState('');
    const [coverImage, setCoverImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [category, setCategory] = useState('Fantasy');
    const categories = ['Fantasy', 'Action', 'Drama', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Mystery'];

    useEffect(() => {
        fetchStories();
    }, []);

    const fetchStories = async () => {
        try {
            const res = await axios.get(`${apiBaseUrl}/api/stories`);
            setStories(res.data);
        } catch (err) {
            console.error('Failed to fetch stories:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!coverImage) return alert('Cover image is required');
        setLoading(true);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('author', author);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('coverImage', coverImage);
        formData.append('status', 'Ongoing');

        try {
            await axios.post(`${apiBaseUrl}/api/stories`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setTitle('');
            setAuthor('');
            setDescription('');
            setCategory('Fantasy');
            setCoverImage(null);
            // Reset file input manually if needed or just let react re-render
            document.getElementById('coverInput').value = '';
            fetchStories();
            alert('Story created successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to create story');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this story?')) return;
        try {
            await axios.delete(`${apiBaseUrl}/api/stories/${id}`);
            fetchStories();
        } catch (err) {
            console.error(err);
            alert('Failed to delete story');
        }
    };

    return (
        <div className="space-y-8">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-6 text-xl font-bold dark:text-white">Create New Story</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <input
                            type="text"
                            placeholder="Title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Author"
                            value={author}
                            onChange={e => setAuthor(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                            required
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat} className="dark:bg-zinc-900">{cat}</option>
                            ))}
                        </select>
                        <div className="hidden md:block"></div>
                    </div>

                    <textarea
                        placeholder="Description"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                        rows="3"
                        required
                    />
                    <div>
                        <label className="mb-2 block text-sm text-zinc-500">Cover Image</label>
                        <input
                            id="coverInput"
                            type="file"
                            accept="image/*"
                            onChange={e => setCoverImage(e.target.files[0])}
                            className="w-full text-sm text-zinc-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : 'Create Story'}
                    </button>
                </form>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-6 text-xl font-bold dark:text-white">Existing Stories</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {stories.map(story => (
                        <div key={story._id} className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <img src={story.coverImage} alt={story.title} className="h-48 w-full object-cover" />
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold dark:text-white">{story.title}</h3>
                                    <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-500">{story.category || 'Fantasy'}</span>
                                </div>
                                <p className="text-sm text-zinc-500">{story.author}</p>
                                <div className="mt-4 flex gap-2">
                                    <button
                                        onClick={() => window.location.hash = `#admin-chapters/${story._id}`}
                                        className="flex-1 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
                                    >
                                        Manage Chapters
                                    </button>
                                    <button
                                        onClick={() => handleDelete(story._id)}
                                        className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-100"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {stories.length === 0 && (
                        <p className="col-span-full text-center text-zinc-500">No stories found.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
