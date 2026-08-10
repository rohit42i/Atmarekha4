import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function AdminChapters({ onBack }) {
    const [chapters, setChapters] = useState([]);
    const [title, setTitle] = useState('');
    const [chapterNumber, setChapterNumber] = useState('');
    const [files, setFiles] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editingChapter, setEditingChapter] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        fetchChapters();
    }, []);

    const fetchChapters = async () => {
        try {
            const { data, error } = await supabase
                .from('chapters')
                .select('*')
                .order('chapter_number', { ascending: true });

            if (error) throw error;
            setChapters(data || []);
        } catch (err) {
            console.error('Failed to fetch chapters:', err);
        }
    };

    const handleEditClick = (chapter) => {
        setEditingChapter(chapter);
        setTitle(chapter.title);
        setChapterNumber(chapter.chapter_number);
        setFiles(null);
        if (document.getElementById('chapterFiles')) {
            document.getElementById('chapterFiles').value = '';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingChapter(null);
        setTitle('');
        setChapterNumber('');
        setFiles(null);
        if (document.getElementById('chapterFiles')) {
            document.getElementById('chapterFiles').value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!editingChapter && (!files || files.length === 0)) {
            return alert('Please upload chapter pages (images)');
        }

        setLoading(true);
        setUploadProgress(20);

        try {
            // 1. Insert or Update Chapter Details in Supabase Table
            let chapterId = editingChapter ? editingChapter.id : null;

            if (editingChapter) {
                const { error: updateError } = await supabase
                    .from('chapters')
                    .update({ title, chapter_number: Number(chapterNumber) })
                    .eq('id', editingChapter.id);

                if (updateError) throw updateError;
            } else {
                const { data: newChapter, error: insertError } = await supabase
                    .from('chapters')
                    .insert([{ title, chapter_number: Number(chapterNumber) }])
                    .select()
                    .single();

                if (insertError) throw insertError;
                chapterId = newChapter.id;
            }

            setUploadProgress(50);

            // 2. If new files are provided, upload them to Supabase Storage and link them
            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const fileName = `${chapterId}/${Date.now()}_${file.name}`;

                    // Upload file to Supabase bucket named 'manga-pages' (make sure this bucket exists in Supabase)
                    const { error: uploadError } = await supabase.storage
                        .from('manga-pages')
                        .upload(fileName, file);

                    if (uploadError) {
                        console.error('Storage upload error:', uploadError);
                        continue;
                    }

                    // Get Public URL for the image
                    const { data: publicUrlData } = supabase.storage
                        .from('manga-pages')
                        .getPublicUrl(fileName);

                    // Save page record into chapter_pages table
                    await supabase
                        .from('chapter_pages')
                        .insert([{
                            chapter_id: chapterId,
                            page_number: i + 1,
                            image_url: publicUrlData.publicUrl
                        }]);
                }
            }

            setUploadProgress(100);
            alert(editingChapter ? 'Chapter updated successfully!' : 'Chapter added successfully!');
            handleCancelEdit();
            fetchChapters();
        } catch (err) {
            console.error('Upload Error:', err);
            alert(`Failed to save chapter: ${err.message}`);
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this chapter?')) return;
        try {
            const { error } = await supabase
                .from('chapters')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchChapters();
        } catch (err) {
            console.error(err);
            alert('Failed to delete chapter');
        }
    };

    return (
        <div className="space-y-8">
            <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                &larr; Back to Dashboard
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
                            {editingChapter ? 'Add/Replace Pages (Optional)' : 'Chapter Pages (Images)'}
                        </label>
                        <input
                            id="chapterFiles"
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={e => setFiles(e.target.files)}
                            className="w-full text-sm text-zinc-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                            required={!editingChapter}
                        />
                        <p className="mt-1 text-xs text-zinc-400">Select multiple manga panel images.</p>
                    </div>

                    {loading && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-blue-600 font-semibold">Saving to Supabase...</span>
                                <span className="text-blue-600 font-bold">{uploadProgress}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-zinc-800">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300 ease-out"
                                    style={{ width: `${uploadProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (editingChapter ? 'Update Chapter' : 'Add Chapter')}
                    </button>
                </form>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-6 text-xl font-bold dark:text-white">Chapters List</h2>
                <div className="space-y-4">
                    {chapters.map(chapter => (
                        <div key={chapter.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                            <div>
                                <h3 className="font-medium dark:text-white">Chapter {chapter.chapter_number}: {chapter.title}</h3>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEditClick(chapter)}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(chapter.id)}
                                    className="text-sm font-medium text-red-600 hover:text-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                    {chapters.length === 0 && (
                        <p className="text-center text-zinc-500">No chapters added yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
