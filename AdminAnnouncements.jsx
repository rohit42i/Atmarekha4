import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminAnnouncements({ apiBaseUrl, onBack }) {
    const [announcements, setAnnouncements] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState({ type: 'idle', message: '' });

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ title: '', content: '' });

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${apiBaseUrl}/api/announcements`);
            if (res.data.success) {
                setAnnouncements(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch announcements:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: 'loading', message: isEditing ? 'Updating...' : 'Publishing...' });

        try {
            if (isEditing) {
                await axios.put(`${apiBaseUrl}/api/announcements/${editId}`, formData);
                setStatus({ type: 'success', message: 'Update updated successfully!' });
            } else {
                await axios.post(`${apiBaseUrl}/api/announcements`, formData);
                setStatus({ type: 'success', message: 'Update published successfully!' });
            }

            setFormData({ title: '', content: '' });
            setIsEditing(false);
            setEditId(null);
            fetchAnnouncements();
            setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Operation failed' });
        }
    };

    const handleEdit = (announcement) => {
        setFormData({ title: announcement.title, content: announcement.content });
        setEditId(announcement._id);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this update?')) return;

        try {
            await axios.delete(`${apiBaseUrl}/api/announcements/${id}`);
            fetchAnnouncements();
        } catch (err) {
            alert('Failed to delete update');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                    &larr; Back to Dashboard
                </button>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Manage Latest Updates</h2>
            </div>

            {/* Form Section */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-white">
                    {isEditing ? 'Edit Update' : 'Post New Update'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Content</label>
                        <textarea
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white h-32"
                            required
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={status.type === 'loading'}
                            className="bg-zinc-900 dark:bg-white text-white dark:text-black py-2 px-6 rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
                        >
                            {status.type === 'loading' ? 'Processing...' : (isEditing ? 'Update' : 'Publish')}
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                onClick={() => { setIsEditing(false); setFormData({ title: '', content: '' }); }}
                                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
                            >
                                Cancel
                            </button>
                        )}
                        {status.message && (
                            <span className={`text-sm ${status.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {status.message}
                            </span>
                        )}
                    </div>
                </form>
            </div>

            {/* List Section */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Recent Updates</h3>
                {isLoading ? (
                    <p className="text-zinc-500">Loading...</p>
                ) : announcements.length === 0 ? (
                    <p className="text-zinc-500 italic">No updates published yet.</p>
                ) : (
                    <div className="grid gap-4">
                        {announcements.map((item) => (
                            <div key={item._id} className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-zinc-900 dark:text-white text-lg">{item.title}</h4>
                                    <p className="text-zinc-500 text-xs mb-2">{new Date(item.createdAt).toLocaleDateString()}</p>
                                    <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{item.content}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleEdit(item)}
                                        className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                        title="Edit"
                                    >
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item._id)}
                                        className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition"
                                        title="Delete"
                                    >
                                        <i className="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
