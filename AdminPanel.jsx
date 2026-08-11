import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const CHAPTERS = 'chapters';
const PAGES = 'chapter_pages';
const STORAGE = 'chapter-pages';
const CN = 'Chapter Number';
const TITLE = 'Title';
const DESC = 'Description';
const COVER = 'Cover url';
const PAGE_CHAPTER = 'Chapter id';
const PAGE_NUMBER = 'Page number';
const PAGE_IMAGE = 'Image url';

const tabs = [
  ['dashboard', 'Dashboard'],
  ['chapters', 'Chapters'],
  ['upload', 'Upload Chapter'],
  ['announcements', 'Announcements'],
  ['media', 'Media'],
];

const emptyForm = { number: '', title: '', description: '', cover: '' };

export default function AdminPanel({ onBack }) {
  const [tab, setTab] = useState('dashboard');
  const [chapters, setChapters] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    setNotice('');

    const [chaptersResult, announcementsResult, mediaResult] = await Promise.all([
      supabase.from(CHAPTERS).select('*'),
      supabase.from('announcements').select('*').limit(100),
      supabase.from('media').select('*').limit(100),
    ]);

    if (chaptersResult.error) {
      setNotice(`Chapters error: ${chaptersResult.error.message}`);
    }
    if (announcementsResult.error) {
      setNotice((current) => current || `Announcements error: ${announcementsResult.error.message}`);
    }
    if (mediaResult.error) {
      setNotice((current) => current || `Media error: ${mediaResult.error.message}`);
    }

    setChapters((chaptersResult.data || []).sort((a, b) => Number(a[CN] || 0) - Number(b[CN] || 0)));
    setAnnouncements(announcementsResult.error ? [] : (announcementsResult.data || []));
    setMedia(mediaResult.error ? [] : (mediaResult.data || []));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setFiles([]);
    setCoverFile(null);
  };

  const uploadPublicFile = async (file, folder, label) => {
    if (!file) return null;
    if (!file.type.startsWith('image/')) throw new Error(`${label} must be an image.`);
    if (file.size > 20 * 1024 * 1024) throw new Error(`${label} is larger than 20 MB.`);

    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExtension = extension || 'jpg';
    const safeName = `${folder}/${crypto.randomUUID()}.${safeExtension}`;
    const result = await supabase.storage.from(STORAGE).upload(safeName, file, { upsert: false });
    if (result.error) throw result.error;

    const { data } = supabase.storage.from(STORAGE).getPublicUrl(safeName);
    return { path: safeName, url: data.publicUrl };
  };

  const saveChapter = async () => {
    if (!form.number || !form.title.trim()) {
      setNotice('Chapter number and title are required.');
      return;
    }

    setUploading(true);
    const uploadedPaths = [];

    try {
      let coverUrl = form.cover.trim() || null;
      if (coverFile) {
        const uploaded = await uploadPublicFile(coverFile, 'covers', 'Cover');
        coverUrl = uploaded.url;
        uploadedPaths.push(uploaded.path);
      }

      const values = {
        [CN]: Number(form.number),
        [TITLE]: form.title.trim(),
        [DESC]: form.description.trim() || null,
        [COVER]: coverUrl,
      };

      const result = editing
        ? await supabase.from(CHAPTERS).update(values).eq(CN, editing)
        : await supabase.from(CHAPTERS).insert([values]);

      if (result.error) throw result.error;
      setNotice(editing ? 'Chapter updated successfully.' : 'Chapter created successfully.');
      resetForm();
      await load();
      setTab('chapters');
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from(STORAGE).remove(uploadedPaths);
      }
      setNotice(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const uploadChapter = async () => {
    if (!form.number || !form.title.trim() || files.length === 0) {
      setNotice('Chapter number, title and at least one page are required.');
      return;
    }

    if (new Set(files.map((file) => file.name)).size !== files.length) {
      setNotice('Please select each page only once.');
      return;
    }

    setUploading(true);
    let chapter = null;
    const uploadedPaths = [];

    try {
      let coverUrl = form.cover.trim() || null;
      if (coverFile) {
        const uploadedCover = await uploadPublicFile(coverFile, 'covers', 'Cover');
        coverUrl = uploadedCover.url;
        uploadedPaths.push(uploadedCover.path);
      }

      const chapterResult = await supabase
        .from(CHAPTERS)
        .insert([{
          [CN]: Number(form.number),
          [TITLE]: form.title.trim(),
          [DESC]: form.description.trim() || null,
          [COVER]: coverUrl,
        }])
        .select('*')
        .single();

      if (chapterResult.error) throw chapterResult.error;
      chapter = chapterResult.data;

      if (!chapter?.id) throw new Error('Chapter was created without a database UUID. Upload cancelled.');

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setNotice(`Uploading page ${index + 1} of ${files.length}...`);
        const uploaded = await uploadPublicFile(file, `chapters/${chapter.id}`, `Page ${index + 1}`);
        uploadedPaths.push(uploaded.path);

        const pageResult = await supabase.from(PAGES).insert([{
          [PAGE_CHAPTER]: chapter.id,
          [PAGE_NUMBER]: index + 1,
          [PAGE_IMAGE]: uploaded.url,
        }]);

        if (pageResult.error) throw pageResult.error;
      }

      setNotice(`Chapter ${form.number} uploaded successfully.`);
      resetForm();
      await load();
      setTab('chapters');
    } catch (error) {
      if (chapter?.id) {
        await supabase.from(PAGES).delete().eq(PAGE_CHAPTER, chapter.id);
        await supabase.from(CHAPTERS).delete().eq('id', chapter.id);
      }
      if (uploadedPaths.length) {
        await supabase.storage.from(STORAGE).remove(uploadedPaths);
      }
      setNotice(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const deleteChapter = async (chapter) => {
    const number = chapter[CN];
    if (!window.confirm(`Delete Chapter ${number} and all its pages? This cannot be undone.`)) return;

    setNotice('Deleting chapter...');
    try {
      const pagesResult = await supabase.from(PAGES).select(PAGE_IMAGE).eq(PAGE_CHAPTER, chapter.id);
      if (pagesResult.error) throw pagesResult.error;

      const paths = [];
      for (const page of pagesResult.data || []) {
        const url = page[PAGE_IMAGE];
        if (!url) continue;
        const marker = `/storage/v1/object/public/${STORAGE}/`;
        const index = url.indexOf(marker);
        if (index !== -1) paths.push(decodeURIComponent(url.slice(index + marker.length)));
      }

      const pageDelete = await supabase.from(PAGES).delete().eq(PAGE_CHAPTER, chapter.id);
      if (pageDelete.error) throw pageDelete.error;

      const chapterDelete = await supabase.from(CHAPTERS).delete().eq('id', chapter.id);
      if (chapterDelete.error) throw chapterDelete.error;

      if (paths.length) await supabase.storage.from(STORAGE).remove(paths);
      setNotice(`Chapter ${number} deleted.`);
      await load();
    } catch (error) {
      setNotice(`Delete failed: ${error.message}`);
    }
  };

  const editChapter = (chapter) => {
    setEditing(chapter[CN]);
    setForm({
      number: chapter[CN] ?? '',
      title: chapter[TITLE] || '',
      description: chapter[DESC] || '',
      cover: chapter[COVER] || '',
    });
    setCoverFile(null);
    setFiles([]);
    setTab('upload');
  };

  const summary = useMemo(() => ({
    chapters: chapters.length,
    announcements: announcements.length,
    media: media.length,
  }), [chapters, announcements, media]);

  const Card = ({ title, value, onClick }) => (
    <button onClick={onClick} className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <header className="sticky top-0 z-20 border-b bg-white/95 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">← Back to site</button>
            <h1 className="text-xl font-bold">Atma Rekha Admin</h1>
          </div>
          <button onClick={load} disabled={loading} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50">{loading ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${tab === id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'border bg-white dark:border-zinc-800 dark:bg-zinc-900'}`}>
              {label}
            </button>
          ))}
        </div>

        {notice && <div className="mb-5 rounded-xl border bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">{notice}</div>}
        {loading ? <div className="py-10 text-center text-zinc-500">Loading admin data...</div> : (
          <>
            {tab === 'dashboard' && (
              <section>
                <h2 className="mb-5 text-2xl font-bold">Dashboard</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Card title="Chapters" value={summary.chapters} onClick={() => setTab('chapters')} />
                  <Card title="Announcements" value={summary.announcements} onClick={() => setTab('announcements')} />
                  <Card title="Media" value={summary.media} onClick={() => setTab('media')} />
                </div>
              </section>
            )}

            {tab === 'chapters' && (
              <section>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold">Manage Chapters</h2>
                  <button onClick={() => { resetForm(); setTab('upload'); }} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">+ New Chapter</button>
                </div>
                {chapters.length === 0 ? <div className="rounded-2xl border bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">No chapters in Supabase yet.</div> : <div className="grid gap-4">{chapters.map((chapter) => (
                  <article key={chapter.id || chapter[CN]} className="rounded-2xl border bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500">Chapter {chapter[CN]}</p>
                        <h3 className="text-lg font-bold">{chapter[TITLE]}</h3>
                        <p className="mt-1 text-sm text-zinc-500">{chapter[DESC] || 'No description'}</p>
                        {chapter[COVER] && <img src={chapter[COVER]} alt="Chapter cover" className="mt-3 h-24 w-16 rounded object-cover" loading="lazy" />}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => editChapter(chapter)} className="rounded-lg border px-3 py-2 text-sm">Edit</button>
                        <button onClick={() => deleteChapter(chapter)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">Delete</button>
                      </div>
                    </div>
                  </article>
                ))}</div>}
              </section>
            )}

            {tab === 'upload' && (
              <section className="max-w-2xl">
                <h2 className="mb-5 text-2xl font-bold">{editing ? `Edit Chapter ${editing}` : 'Upload Chapter'}</h2>
                <div className="space-y-4 rounded-2xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <input type="number" min="1" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="Chapter number" className="w-full rounded-xl border p-3 dark:border-zinc-700 dark:bg-zinc-950" disabled={!!editing} />
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Chapter title" className="w-full rounded-xl border p-3 dark:border-zinc-700 dark:bg-zinc-950" />
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="4" className="w-full rounded-xl border p-3 dark:border-zinc-700 dark:bg-zinc-950" />
                  <input value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} placeholder="Cover image URL (optional)" className="w-full rounded-xl border p-3 dark:border-zinc-700 dark:bg-zinc-950" />
                  <label className="block rounded-xl border p-3 text-sm dark:border-zinc-700">Cover file (optional)<input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} className="mt-2 block w-full" /></label>
                  {!editing && <label className="block rounded-xl border p-3 text-sm dark:border-zinc-700">Chapter pages<input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} className="mt-2 block w-full" /></label>}
                  {!editing && files.length > 0 && <p className="text-sm text-zinc-500">{files.length} page(s) selected. Maximum 20 MB per image.</p>}
                  <button onClick={editing ? saveChapter : uploadChapter} disabled={uploading} className="w-full rounded-xl bg-zinc-900 py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">{uploading ? 'Working...' : editing ? 'Save Changes' : 'Upload Chapter'}</button>
                  {editing && <button onClick={resetForm} disabled={uploading} className="w-full rounded-xl border py-3 text-sm">Cancel</button>}
                </div>
              </section>
            )}

            {tab === 'announcements' && <section><h2 className="mb-5 text-2xl font-bold">Announcements</h2><div className="space-y-3">{announcements.length ? announcements.map((item, index) => <article key={item.id || index} className="rounded-2xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><pre className="whitespace-pre-wrap break-words text-sm">{JSON.stringify(item, null, 2)}</pre></article>) : <p className="text-zinc-500">No announcements found.</p>}</div></section>}
            {tab === 'media' && <section><h2 className="mb-5 text-2xl font-bold">Media</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{media.length ? media.map((item, index) => <article key={item.id || index} className="rounded-2xl border bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"><pre className="whitespace-pre-wrap break-words text-xs text-zinc-500">{JSON.stringify(item, null, 2)}</pre></article>) : <p className="text-zinc-500">No media found.</p>}</div></section>}
          </>
        )}
      </main>
    </div>
  );
}
