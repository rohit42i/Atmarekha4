import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminChapters({ apiBaseUrl, storyId, onBack }) {
    const [chapters, setChapters] = useState([]);
    const [title, setTitle] = useState('');
    const [chapterNumber, setChapterNumber] = useState('');
    const [files, setFiles] = useState(null); // For images
    const [loading, setLoading] = useState(false);
    const [editingChapter, setEditingChapter] = useState(null); // Track chapter being edited

    useEffect(() => {
        fetchChapters();
    }, [storyId]);

    const fetchChapters = async () => {
        try {
            const res = await axios.get(`${apiBaseUrl}/api/chapters/${storyId}`);
            setChapters(res.data);
        } catch (err) {
            console.error('Failed to fetch chapters:', err);
        }
    };

    const handleEditClick = (chapter) => {
        setEditingChapter(chapter);
        setTitle(chapter.title);
        setChapterNumber(chapter.chapterNumber);
        setFiles(null); // Reset files, optional to upload new ones
        document.getElementById('chapterFiles').value = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingChapter(null);
        setTitle('');
        setChapterNumber('');
        setFiles(null);
        document.getElementById('chapterFiles').value = '';
    };

    const [uploadProgress, setUploadProgress] = useState(0);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!editingChapter && (!files || files.length === 0)) {
            return alert('Please upload pages (images or PDF)');
        }

        setLoading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('chapterNumber', chapterNumber);

        if (files) {
            for (let i = 0; i < files.length; i++) {
                formData.append('pages', files[i]);
            }
        }

        const axiosConfig = {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(percentCompleted);
            }
        };

        try {
            if (editingChapter) {
                await axios.put(`${apiBaseUrl}/api/chapters/${editingChapter._id}`, formData, axiosConfig);
                alert('Chapter updated successfully!');
            } else {
                await axios.post(`${apiBaseUrl}/api/chapters/${storyId}`, formData, axiosConfig);
                alert('Chapter added successfully!');
            }

            handleCancelEdit();
            fetchChapters();
        } catch (err) {
            console.error('Upload Error:', err);
            const errMsg = err.response?.data?.message || err.message;
            alert(`Failed to ${editingChapter ? 'update' : 'add'} chapter: ${errMsg}`);
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this chapter?')) return;
        try {
            await axios.delete(`${apiBaseUrl}/api/chapters/${id}`);
            fetchChapters();
        } catch (err) {
            console.error(err);
            alert('Failed to delete chapter');
        }
    };

    return (
        <div className="space-y-8">
            <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                &larr; Back to Stories
            </button>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-bold dark:text-white">
                        {editingChapter ? 'Edit Chapter' : 'Add New Chapter'}
                    </h2>
                    {editingChapter && (
                        <button onClick={handleCancelEdit} className="text-sm text-red-500 hover:text-red-600">
                            Cancel Edit
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <input
                            type="text"
                            placeholder="Chapter Title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                            required
                        />
                        <input
                            type="number"
                            placeholder="Chapter Number"
                            value={chapterNumber}
                            onChange={e => setChapterNumber(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-transparent px-4 py-2 dark:border-zinc-700 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm text-zinc-500">
                            {editingChapter ? 'Replace Pages (Optional)' : 'Pages (Images or PDF)'}
                        </label>
                        <input
                            id="chapterFiles"
                            type="file"
                            multiple
                            accept="image/*,application/pdf"
                            onChange={e => setFiles(e.target.files)}
                            className="w-full text-sm text-zinc-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                            required={!editingChapter}
                        />
                        <p className="mt-1 text-xs text-zinc-400">Select multiple images for pages, or a single PDF.</p>
                    </div>
                    {loading && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-blue-600 font-medium font-semibold">Uploading...</span>
                                <span className="text-blue-600 font-bold">{uploadProgress}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-zinc-800">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                                    style={{ width: `${uploadProgress}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-zinc-400 text-center italic">Please do not refresh the page while uploading.</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Processing Cloud Upload...' : (editingChapter ? 'Update Chapter' : 'Add Chapter')}
                    </button>
                </form>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-6 text-xl font-bold dark:text-white">Chapters</h2>
                <div className="space-y-4">
                    {chapters.map(chapter => (
                        <div key={chapter._id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                            <div>
                                <h3 className="font-medium dark:text-white">Chapter {chapter.chapterNumber}: {chapter.title}</h3>
                                <p className="text-sm text-zinc-500">
                                    {chapter.pdfUrl ? 'PDF Document' : `${chapter.pages.length} pages`}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEditClick(chapter)}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(chapter._id)}
                                    className="text-sm font-medium text-red-600 hover:text-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                    {chapters.length === 0 && (
                        <p className="text-center text-zinc-500">No chapters yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
