import { useState } from 'react';
import { supabase } from './supabase';

export default function AdminPanel({ onBack }) {
    const [chapterNumber, setChapterNumber] = useState('');
    const [title, setTitle] = useState('');
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!chapterNumber || !title || files.length === 0) {
            setMessage('Please fill in all fields and select at least one image.');
            return;
        }

        setUploading(true);
        setMessage('Creating chapter...');

        try {
            // 1. Insert chapter details into 'chapters' table
            const { data: chapterData, error: chapterError } = await supabase
                .from('chapters')
                .insert([{ chapter_number: parseInt(chapterNumber), title }])
                .select()
                .single();

            if (chapterError) throw chapterError;
            const chapterId = chapterData.id;

            // 2. Upload each page to Supabase Storage and record in 'chapter_pages' table
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${chapterId}_page_${i + 1}_${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                setMessage(`Uploading page ${i + 1} of ${files.length}...`);

                // Upload to 'chapter-pages' bucket
                const { error: uploadError } = await supabase.storage
                    .from('chapter-pages')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('chapter-pages')
                    .getPublicUrl(filePath);

                // Insert page record into database
                const { error: pageError } = await supabase
                    .from('chapter_pages')
                    .insert([{
                        chapter_id: chapterId,
                        page_number: i + 1,
                        image_url: publicUrl
                    }]);

                if (pageError) throw pageError;
            }

            setMessage('Chapter uploaded successfully!');
            setChapterNumber('');
            setTitle('');
            setFiles([]);
        } catch (err) {
            console.error('Upload error:', err);
            setMessage(`Error: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-6">
            <div className="max-w-xl mx-auto bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                <button
                    onClick={onBack}
                    className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition text-sm"
                >
                    <i className="fa-solid fa-arrow-left"></i> Back
                </button>

                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Admin: Upload Chapter</h1>

                <form onSubmit={handleUpload} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chapter Number</label>
                        <input
                            type="number"
                            value={chapterNumber}
                            onChange={(e) => setChapterNumber(e.target.value)}
                            placeholder="e.g. 1"
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chapter Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. The Awakening"
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chapter Pages (Select multiple images)</label>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => setFiles(e.target.files)}
                            className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300 hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-zinc-400 mt-1">{files.length} file(s) selected</p>
                    </div>

                    {message && (
                        <p className={`text-sm font-medium ${message.includes('success') ? 'text-green-500' : 'text-blue-500'}`}>
                            {message}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={uploading}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        {uploading ? 'Uploading...' : 'Upload Chapter'}
                    </button>
                </form>
            </div>
        </div>
    );
}

