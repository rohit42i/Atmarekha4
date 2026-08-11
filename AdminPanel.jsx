import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { buildChapters } from './chapters';

const CHAPTERS_TABLE = 'chapters';
const PAGES_TABLE = 'chapter_pages';

function publicStorageUrl(bucket, path) { return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl; }
function storagePathFromPublicUrl(url, bucket) { const marker = `/storage/v1/object/public/${bucket}/`; const index = url?.indexOf(marker); return index === -1 || index == null ? null : decodeURIComponent(url.slice(index + marker.length)); }

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in again.');
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !data) throw new Error('Admin access required.');
  return user;
}

export default function AdminPanel({ onLogout }) {
  const [chapters, setChapters] = useState([]), [sessionEmail, setSessionEmail] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState({ type: '', text: '' }), [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ number: '', title: '', description: '', status: 'Published', releaseDate: '', cover: null, pages: [] });
  const sortedChapters = useMemo(() => [...chapters].sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber)), [chapters]);

  async function refresh() {
    setLoading(true);
    try { const user = await requireAdmin(); setSessionEmail(user.email || ''); setChapters(await buildChapters()); }
    catch (error) { setMessage({ type: 'error', text: error.message || 'Unable to load admin data.' }); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  function resetForm() { setSelected(null); setForm({ number: '', title: '', description: '', status: 'Published', releaseDate: '', cover: null, pages: [] }); }
  async function uploadFile(bucket, file, path) { const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || undefined }); if (error) throw error; return publicStorageUrl(bucket, path); }

  async function handleSubmit(event) {
    event.preventDefault(); setBusy(true); setMessage({ type: '', text: '' });
    try {
      await requireAdmin();
      if (!form.number || !form.title.trim()) throw new Error('Chapter number and title are required.');
      let chapterId = selected?.id; let coverUrl = selected?.cover || null;
      if (!selected) {
        const { data, error } = await supabase.from(CHAPTERS_TABLE).insert({ 'Chapter Number': Number(form.number), Title: form.title.trim(), Description: form.description.trim(), status: form.status, 'Release date': form.releaseDate ? new Date(form.releaseDate).toISOString() : null }).select('id').single();
        if (error) throw error; chapterId = data.id;
      } else {
        const { error } = await supabase.from(CHAPTERS_TABLE).update({ 'Chapter Number': Number(form.number), Title: form.title.trim(), Description: form.description.trim(), status: form.status, 'Release date': form.releaseDate ? new Date(form.releaseDate).toISOString() : null }).eq('id', selected.id); if (error) throw error;
      }
      if (form.cover) { const ext = form.cover.name.split('.').pop() || 'jpg'; coverUrl = await uploadFile('covers', form.cover, `chapters/${chapterId}/cover.${ext}`); const { error } = await supabase.from(CHAPTERS_TABLE).update({ 'Cover url': coverUrl }).eq('id', chapterId); if (error) throw error; }
      if (form.pages.length) {
        const rows = [];
        for (let index = 0; index < form.pages.length; index += 1) { const file = form.pages[index]; const ext = file.name.split('.').pop() || 'jpg'; const path = `${chapterId}/${String(index + 1).padStart(4, '0')}.${ext}`; const url = await uploadFile('chapter-pages', file, path); rows.push({ 'Chapter id': chapterId, 'Page number': index + 1, 'Image url': url }); }
        const { error } = await supabase.from(PAGES_TABLE).upsert(rows, { onConflict: 'Chapter id,Page number' }); if (error) throw error;
      }
      await refresh(); resetForm(); setMessage({ type: 'success', text: selected ? 'Chapter updated.' : 'Chapter published successfully.' });
    } catch (error) { console.error(error); setMessage({ type: 'error', text: error.message || 'Save failed.' }); }
    finally { setBusy(false); }
  }

  async function deleteChapter(chapter) {
    if (!window.confirm(`Delete Chapter ${chapter.chapterNumber} permanently? This also deletes its manga pages.`)) return;
    setBusy(true); setMessage({ type: '', text: '' });
    try {
      await requireAdmin();
      const { data: pages, error: pageError } = await supabase.from(PAGES_TABLE).select('Image url').eq('Chapter id', chapter.id); if (pageError) throw pageError;
      const pagePaths = (pages || []).map(p => storagePathFromPublicUrl(p['Image url'], 'chapter-pages')).filter(Boolean);
      if (pagePaths.length) { const { error } = await supabase.storage.from('chapter-pages').remove(pagePaths); if (error) throw error; }
      const coverPath = storagePathFromPublicUrl(chapter.cover, 'covers'); if (coverPath) { const { error } = await supabase.storage.from('covers').remove([coverPath]); if (error) throw error; }
      const { error } = await supabase.from(CHAPTERS_TABLE).delete().eq('id', chapter.id); if (error) throw error;
      await refresh(); if (selected?.id === chapter.id) resetForm(); setMessage({ type: 'success', text: `Chapter ${chapter.chapterNumber} deleted.` });
    } catch (error) { console.error(error); setMessage({ type: 'error', text: error.message || 'Delete failed.' }); }
    finally { setBusy(false); }
  }

  function editChapter(chapter) { setSelected(chapter); setForm({ number: chapter.chapterNumber || '', title: chapter.title || '', description: chapter.description || '', status: chapter.status || 'Published', releaseDate: chapter.releaseDate ? new Date(chapter.releaseDate).toISOString().slice(0, 16) : '', cover: null, pages: [] }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function logout() { await supabase.auth.signOut(); onLogout?.(); }
  if (loading) return <div className="min-h-screen grid place-items-center bg-zinc-950 text-white">Loading admin dashboard…</div>;

  return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
    <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">Atma Rekha</p><h1 className="mt-1 text-3xl font-black">Publisher Dashboard</h1><p className="mt-1 text-sm text-zinc-400">{sessionEmail}</p></div><button onClick={logout} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800">Sign out</button></header>
    {message.text && <div className={`mb-6 rounded-2xl border p-4 text-sm ${message.type === 'success' ? 'border-emerald-900 bg-emerald-950/50 text-emerald-300' : 'border-rose-900 bg-rose-950/50 text-rose-300'}`}>{message.text}</div>}
    <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={handleSubmit} className="h-fit rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{selected ? 'Edit chapter' : 'Publish chapter'}</h2>{selected && <button type="button" onClick={resetForm} className="text-xs text-zinc-400 hover:text-white">Cancel</button>}</div><div className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><label className="text-sm text-zinc-300">Chapter #<input type="number" min="1" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5" required /></label><label className="text-sm text-zinc-300">Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5"><option>Published</option><option>Draft</option><option>Coming Soon</option></select></label></div>
        <label className="block text-sm text-zinc-300">Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" required /></label><label className="block text-sm text-zinc-300">Description<textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /></label><label className="block text-sm text-zinc-300">Release date<input type="datetime-local" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5" /></label><label className="block text-sm text-zinc-300">Cover image<input type="file" accept="image/*" onChange={e => setForm({ ...form, cover: e.target.files?.[0] || null })} className="mt-2 block w-full text-sm text-zinc-400" /></label><label className="block text-sm text-zinc-300">Manga pages <span className="text-zinc-500">(select all in order)</span><input type="file" accept="image/*" multiple onChange={e => setForm({ ...form, pages: Array.from(e.target.files || []) })} className="mt-2 block w-full text-sm text-zinc-400" /></label>{form.pages.length > 0 && <p className="text-xs text-blue-300">{form.pages.length} page(s) selected</p>}<button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold hover:bg-blue-500 disabled:opacity-50">{busy ? 'Working…' : selected ? 'Save changes' : 'Publish chapter'}</button>
      </div></form>
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">Published chapters</h2><p className="text-sm text-zinc-500">Live data from Supabase</p></div><button onClick={refresh} disabled={busy} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">Refresh</button></div>{sortedChapters.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-700 p-12 text-center text-zinc-500">No chapters in Supabase yet.</div> : <div className="space-y-3">{sortedChapters.map(chapter => <article key={chapter.id} className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center"><div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900">{chapter.cover ? <img src={chapter.cover} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-zinc-600">No cover</div>}</div><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-blue-400">Chapter {chapter.chapterNumber}</p><h3 className="truncate font-bold">{chapter.title || 'Untitled'}</h3><p className="text-xs text-zinc-500">{chapter.status || 'Published'}</p></div><div className="flex gap-2"><button onClick={() => editChapter(chapter)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">Edit</button><button onClick={() => deleteChapter(chapter)} disabled={busy} className="rounded-lg bg-rose-600/10 px-3 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-600 hover:text-white disabled:opacity-50">Delete</button></div></article>)}</div>}</section>
    </section>
  </div></main>;
}
