import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const tabs = [
  ['dashboard', 'Dashboard'],
  ['chapters', 'Chapters'],
  ['upload', 'Upload Chapter'],
  ['comments', 'Comments'],
  ['announcements', 'Announcements'],
  ['media', 'Media'],
];

export default function AdminPanel({ onBack }) {
  const [tab, setTab] = useState('dashboard');
  const [chapters, setChapters] = useState([]);
  const [comments, setComments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ number: '', title: '', description: '', cover: '' });
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true); setNotice('');
    const [{ data: ch, error: ce }, { data: co }, { data: an }, { data: me }] = await Promise.all([
      supabase.from('chapters').select('*').order('Chapter number', { ascending: true }),
      supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('media').select('*').order('id', { ascending: false }).limit(100),
    ]);
    if (ce) setNotice(`Chapters: ${ce.message}`);
    setChapters(ch || []); setComments(co || []); setAnnouncements(an || []); setMedia(me || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveChapter = async () => {
    if (!form.number || !form.title) return setNotice('Chapter number and title are required.');
    const values = { 'Chapter number': Number(form.number), 'Title': form.title, 'Discription': form.description };
    if (form.cover) values.cover_url = form.cover;
    const result = editing
      ? await supabase.from('chapters').update(values).eq('Chapter number', editing)
      : await supabase.from('chapters').insert([values]);
    if (result.error) return setNotice(`Error: ${result.error.message}`);
    setNotice(editing ? 'Chapter updated.' : 'Chapter created.');
    setEditing(null); setForm({ number: '', title: '', description: '', cover: '' }); await load();
  };

  const deleteChapter = async (number) => {
    if (!confirm(`Delete chapter ${number}? This cannot be undone.`)) return;
    const { error } = await supabase.from('chapters').delete().eq('Chapter number', number);
    setNotice(error ? `Error: ${error.message}` : 'Chapter deleted.');
    if (!error) await load();
  };

  const uploadChapter = async () => {
    if (!form.number || !form.title || !files.length) return setNotice('Number, title and at least one page are required.');
    setUploading(true); setNotice('Creating chapter...');
    try {
      const { data: chapter, error } = await supabase.from('chapters').insert([{
        'Chapter number': Number(form.number), 'Title': form.title, 'Discription': form.description,
      }]).select().single();
      if (error) throw error;
      for (let i = 0; i < files.length; i++) {
        const file = files[i]; const ext = file.name.split('.').pop() || 'jpg';
        const name = `${chapter.id || form.number}_page_${i + 1}_${Date.now()}.${ext}`;
        setNotice(`Uploading page ${i + 1} of ${files.length}...`);
        const up = await supabase.storage.from('chapter-pages').upload(name, file);
        if (up.error) throw up.error;
        const { data: url } = supabase.storage.from('chapter-pages').getPublicUrl(name);
        const pg = await supabase.from('chapter_pages').insert([{ chapter_id: chapter.id, page_number: i + 1, image: url.publicUrl }]);
        if (pg.error) throw pg.error;
      }
      setNotice('Chapter uploaded successfully.'); setForm({ number: '', title: '', description: '', cover: '' }); setFiles([]); await load(); setTab('chapters');
    } catch (e) { setNotice(`Error: ${e.message}`); } finally { setUploading(false); }
  };

  const deleteComment = async (id) => {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    setNotice(error ? `Error: ${error.message}` : 'Comment deleted.'); if (!error) await load();
  };

  const replyComment = async (comment) => {
    const text = prompt('Reply to this comment:'); if (!text?.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    const row = { chapter_id: comment.chapter_id, user_id: user?.user?.id, parent_id: comment.id, content: text.trim() };
    const { error } = await supabase.from('comments').insert([row]);
    setNotice(error ? `Reply failed: ${error.message}` : 'Reply posted.'); if (!error) await load();
  };

  const Card = ({ title, value, onClick }) => <button onClick={onClick} className="rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"><p className="text-sm text-zinc-500">{title}</p><p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{value}</p></button>;

  return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div><button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">← Back to site</button><h1 className="text-xl font-bold">Atma Rekha Admin</h1></div>
        <button onClick={load} className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">Refresh</button>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">{tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${tab === id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-white text-zinc-600 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300'}`}>{label}</button>)}</div>
      {notice && <div className="mb-5 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">{notice}</div>}
      {loading ? <div className="rounded-2xl bg-white p-8 dark:bg-zinc-900">Loading admin data...</div> : <>
        {tab === 'dashboard' && <div><h2 className="mb-5 text-2xl font-bold">Dashboard</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card title="Chapters" value={chapters.length} onClick={() => setTab('chapters')} /><Card title="Comments" value={comments.length} onClick={() => setTab('comments')} /><Card title="Announcements" value={announcements.length} onClick={() => setTab('announcements')} /><Card title="Media" value={media.length} onClick={() => setTab('media')} /></div></div>}
        {tab === 'chapters' && <section><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold">Manage Chapters</h2><button onClick={() => { setForm({ number: '', title: '', description: '', cover: '' }); setEditing(null); setTab('upload'); }} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">+ New Chapter</button></div><div className="grid gap-4">{chapters.map(c => <div key={c['Chapter number']} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs text-zinc-500">Chapter {c['Chapter number']}</p><h3 className="text-lg font-bold">{c.Title}</h3><p className="mt-1 text-sm text-zinc-500">{c.Discription || 'No description'}</p>{c.cover_url && <img src={c.cover_url} alt="Cover" className="mt-3 h-20 w-14 rounded object-cover" />}</div><div className="flex gap-2"><button onClick={() => { setEditing(c['Chapter number']); setForm({ number: c['Chapter number'], title: c.Title || '', description: c.Discription || '', cover: c.cover_url || '' }); setTab('upload'); }} className="rounded-lg border px-3 py-2 text-sm">Edit</button><button onClick={() => deleteChapter(c['Chapter number'])} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">Delete</button></div></div></div>)}</div></section>}
        {tab === 'upload' && <section className="max-w-2xl"><h2 className="mb-5 text-2xl font-bold">{editing ? `Edit Chapter ${editing}` : 'Upload Chapter'}</h2><div className="space-y-4 rounded-2xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"><input type="number" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="Chapter number" className="w-full rounded-xl border p-3 dark:border-zinc-700 dark:bg-zinc-950" disabled={!!editing} /><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Chapter title" className="w-full rounded-xl border p-3 dark:border-zinc-700 dark:bg-zinc-950" /><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="4" className="w-full rounded-xl border p-3 dark:border-zinc-700 dark:bg-zinc-950" /><input value={form.cover} onChange={e => setForm({ ...form, cover: e.target.value })} placeholder="Cover image URL (after cover_url column is added)" className="w-full rounded-xl border p-3 dark:border-zinc-700 dark:bg-zinc-950" />{!editing && <input type="file" multiple accept="image/*" onChange={e => setFiles(Array.from(e.target.files || []))} className="w-full rounded-xl border p-3 dark:border-zinc-700" />}{!editing && files.length > 0 && <p className="text-sm text-zinc-500">{files.length} page(s) selected</p>}<button onClick={editing ? saveChapter : uploadChapter} disabled={uploading} className="w-full rounded-xl bg-zinc-900 py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900">{uploading ? 'Uploading...' : editing ? 'Save Changes' : 'Upload Chapter'}</button></div></section>}
        {tab === 'comments' && <section><h2 className="mb-5 text-2xl font-bold">Comments</h2>{comments.length ? <div className="space-y-3">{comments.map(c => <div key={c.id} className="rounded-2xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-sm text-zinc-800 dark:text-zinc-200">{c.content || c.text || '(empty comment)'}</p><p className="mt-2 text-xs text-zinc-500">{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</p><div className="mt-3 flex gap-2"><button onClick={() => replyComment(c)} className="rounded-lg border px-3 py-1.5 text-sm">Reply</button><button onClick={() => deleteComment(c.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600">Delete</button></div></div>)}</div> : <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">No comments table/data is available yet. Run the included admin dashboard SQL migration to enable comments and replies.</div>}</section>}
        {tab === 'announcements' && <section><h2 className="mb-5 text-2xl font-bold">Announcements</h2><div className="space-y-3">{announcements.length ? announcements.map(a => <div key={a.id} className="rounded-2xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><h3 className="font-semibold">{a.title || a.Title || 'Announcement'}</h3><p className="mt-1 text-sm text-zinc-500">{a.content || a.Content || ''}</p></div>) : <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">No announcements yet.</div>}</div></section>}
        {tab === 'media' && <section><h2 className="mb-5 text-2xl font-bold">Media</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{media.map(m => <div key={m.id} className="overflow-hidden rounded-2xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">{m.image_url && <img src={m.image_url} alt={m.title || 'Media'} className="aspect-[3/4] w-full object-cover" />}<div className="p-3"><p className="text-sm font-semibold">{m.title || 'Untitled'}</p></div></div>)}</div></section>}
      </>}
    </main>
  </div>;
}
