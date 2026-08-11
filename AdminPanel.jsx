import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { buildChapters } from './chapters';

const CHAPTERS = 'chapters';
const PAGES = 'chapter_pages';
const MAX_PAGE_SIZE = 20 * 1024 * 1024;
const PAGE_BUCKET = 'chapter-pages';
const COVER_BUCKET = 'covers';

const publicUrl = (bucket, path) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
const pathFromUrl = (url, bucket) => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length));
};

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Your Supabase session has expired. Please sign in again.');
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(`Admin verification failed: ${error.message}`);
  if (!data) throw new Error('Admin access required.');
  return user;
}

async function removeFiles(bucket, paths) {
  const clean = paths.filter(Boolean);
  if (!clean.length) return;
  const { error } = await supabase.storage.from(bucket).remove(clean);
  if (error) throw new Error(`Storage cleanup failed: ${error.message}`);
}

const emptyForm = () => ({ number: '', title: '', description: '', status: 'Published', releaseDate: '', cover: null, pages: [] });

function Stat({ label, value }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>;
}

export default function AdminPanel({ onLogout }) {
  const [tab, setTab] = useState('Overview');
  const [chapters, setChapters] = useState([]);
  const [pageCounts, setPageCounts] = useState({});
  const [comments, setComments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [media, setMedia] = useState([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [announcement, setAnnouncement] = useState({ title: '', content: '', image_url: '', is_pinned: false });
  const [mediaForm, setMediaForm] = useState({ title: '', image_url: '', category: '' });

  const sorted = useMemo(() => [...chapters].sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber)), [chapters]);
  const published = sorted.filter(c => String(c.status).toLowerCase() === 'published');
  const preuploaded = sorted.filter(c => String(c.status).toLowerCase() !== 'published');
  const totalPages = Object.values(pageCounts).reduce((a, b) => a + b, 0);

  const resetForm = () => { setEditing(null); setForm(emptyForm()); setProgress({ current: 0, total: 0, text: '' }); };

  const load = async () => {
    setLoading(true);
    try {
      const user = await requireAdmin();
      setEmail(user.email || '');
      const [chapterData, pageResult, commentResult, announcementResult, mediaResult] = await Promise.all([
        buildChapters(),
        supabase.from(PAGES).select('id, chapter_id, page_number, image_url'),
        supabase.from('comments').select('id, user_id, chapter_id, author_name, content, created_at').order('created_at', { ascending: false }),
        supabase.from('announcements').select('title, content, image_url, is_pinned, published_at, created_at').order('created_at', { ascending: false }),
        supabase.from('media').select('id, title, image_url, category, created_at').order('created_at', { ascending: false }),
      ]);
      if (pageResult.error) throw new Error(`Could not read chapter pages: ${pageResult.error.message}`);
      if (commentResult.error) throw new Error(`Could not read comments: ${commentResult.error.message}`);
      if (announcementResult.error) throw new Error(`Could not read announcements: ${announcementResult.error.message}`);
      if (mediaResult.error) throw new Error(`Could not read media: ${mediaResult.error.message}`);
      const counts = {};
      for (const row of pageResult.data || []) counts[row.chapter_id] = (counts[row.chapter_id] || 0) + 1;
      setChapters(chapterData || []); setPageCounts(counts); setComments(commentResult.data || []); setAnnouncements(announcementResult.data || []); setMedia(mediaResult.data || []);
    } catch (error) {
      console.error(error); setNotice({ type: 'error', text: error.message || 'Unable to load admin data.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const choosePages = event => {
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'));
    const tooLarge = files.find(file => file.size > MAX_PAGE_SIZE);
    if (tooLarge) { event.target.value = ''; setNotice({ type: 'error', text: `${tooLarge.name} is larger than 20 MB.` }); return; }
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    setForm(v => ({ ...v, pages: files }));
  };

  async function upload(bucket, file, path) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined, cacheControl: '31536000' });
    if (error) throw new Error(`Upload to ${bucket} failed: ${error.message}`);
    return publicUrl(bucket, path);
  }

  async function saveChapter(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setNotice({ type: '', text: '' });
    let chapterId = editing?.id || null;
    const uploadedPaths = [];
    try {
      await requireAdmin();
      const number = Number(form.number);
      if (!Number.isInteger(number) || number < 1) throw new Error('Enter a valid chapter number.');
      if (!form.title.trim()) throw new Error('Chapter title is required.');
      if (!editing && !form.pages.length) throw new Error('Select at least one manga page.');

      const payload = { chapter_number: number, title: form.title.trim(), description: form.description.trim(), status: form.status, release_date: form.releaseDate ? new Date(form.releaseDate).toISOString() : null };
      if (editing) {
        const { error } = await supabase.from(CHAPTERS).update(payload).eq('id', editing.id);
        if (error) throw new Error(`Chapter update failed: ${error.message}`);
      } else {
        const { data, error } = await supabase.from(CHAPTERS).insert(payload).select('id').single();
        if (error) throw new Error(`Chapter creation failed: ${error.message}`);
        chapterId = data.id;
      }

      let oldCoverPath = null;
      if (form.cover) {
        const ext = form.cover.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `chapters/${chapterId}/cover-${Date.now()}.${ext}`;
        const url = await upload(COVER_BUCKET, form.cover, path);
        uploadedPaths.push({ bucket: COVER_BUCKET, path });
        oldCoverPath = pathFromUrl(editing?.cover, COVER_BUCKET);
        const { error } = await supabase.from(CHAPTERS).update({ cover_url: url }).eq('id', chapterId);
        if (error) throw new Error(`Cover save failed: ${error.message}`);
      }

      if (form.pages.length) {
        setProgress({ current: 0, total: form.pages.length, text: 'Uploading manga pages…' });
        const old = await supabase.from(PAGES).select('id, image_url').eq('chapter_id', chapterId);
        if (old.error) throw new Error(`Could not read existing pages: ${old.error.message}`);
        const oldPaths = (old.data || []).map(row => pathFromUrl(row.image_url, PAGE_BUCKET)).filter(Boolean);
        const revision = Date.now();
        const rows = [];
        for (let i = 0; i < form.pages.length; i += 1) {
          const file = form.pages[i];
          const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          const path = `${chapterId}/${revision}/${String(i + 1).padStart(4, '0')}.${ext}`;
          const url = await upload(PAGE_BUCKET, file, path);
          uploadedPaths.push({ bucket: PAGE_BUCKET, path });
          rows.push({ chapter_id: chapterId, page_number: i + 1, image_url: url });
          setProgress({ current: i + 1, total: form.pages.length, text: `Uploaded page ${i + 1} of ${form.pages.length}` });
        }
        const deleted = await supabase.from(PAGES).delete().eq('chapter_id', chapterId);
        if (deleted.error) throw new Error(`Could not replace old pages: ${deleted.error.message}`);
        const inserted = await supabase.from(PAGES).insert(rows);
        if (inserted.error) throw new Error(`Saving chapter pages failed: ${inserted.error.message}`);
        await removeFiles(PAGE_BUCKET, oldPaths);
      }
      if (oldCoverPath) await removeFiles(COVER_BUCKET, [oldCoverPath]);
      resetForm(); await load(); setNotice({ type: 'success', text: `Chapter ${number} ${editing ? 'updated' : 'uploaded'} successfully.` });
    } catch (error) {
      console.error(error);
      for (const item of uploadedPaths) { try { await removeFiles(item.bucket, [item.path]); } catch (_) {} }
      if (!editing && chapterId) { try { await supabase.from(CHAPTERS).delete().eq('id', chapterId); } catch (_) {} }
      setNotice({ type: 'error', text: error.message || 'Chapter upload failed.' }); setProgress({ current: 0, total: 0, text: '' });
    } finally { setBusy(false); }
  }

  const editChapter = chapter => {
    setEditing(chapter); setForm({ number: chapter.chapterNumber || '', title: chapter.title || '', description: chapter.description || '', status: chapter.status || 'Published', releaseDate: chapter.releaseDate ? new Date(chapter.releaseDate).toISOString().slice(0, 16) : '', cover: null, pages: [] });
    setTab('Chapters'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function deleteChapter(chapter) {
    if (!window.confirm(`Delete Chapter ${chapter.chapterNumber} permanently?`)) return;
    setBusy(true);
    try {
      await requireAdmin();
      const pages = await supabase.from(PAGES).select('image_url').eq('chapter_id', chapter.id);
      if (pages.error) throw new Error(`Could not read chapter pages: ${pages.error.message}`);
      const pagePaths = (pages.data || []).map(row => pathFromUrl(row.image_url, PAGE_BUCKET)).filter(Boolean);
      const coverPath = pathFromUrl(chapter.cover, COVER_BUCKET);
      const deleted = await supabase.from(CHAPTERS).delete().eq('id', chapter.id);
      if (deleted.error) throw new Error(`Chapter delete failed: ${deleted.error.message}`);
      await removeFiles(PAGE_BUCKET, pagePaths); if (coverPath) await removeFiles(COVER_BUCKET, [coverPath]);
      if (editing?.id === chapter.id) resetForm(); await load(); setNotice({ type: 'success', text: `Chapter ${chapter.chapterNumber} deleted.` });
    } catch (error) { setNotice({ type: 'error', text: error.message || 'Delete failed.' }); }
    finally { setBusy(false); }
  }

  async function deleteComment(id) {
    if (!window.confirm('Delete this comment?')) return;
    setBusy(true);
    try { await requireAdmin(); const { error } = await supabase.from('comments').delete().eq('id', id); if (error) throw error; setComments(v => v.filter(x => x.id !== id)); }
    catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  }

  async function saveAnnouncement(event) {
    event.preventDefault(); setBusy(true);
    try {
      await requireAdmin();
      if (!announcement.title.trim() || !announcement.content.trim()) throw new Error('Title and content are required.');
      const { error } = await supabase.from('announcements').insert({ title: announcement.title.trim(), content: announcement.content.trim(), image_url: announcement.image_url.trim() || null, is_pinned: announcement.is_pinned, published_at: new Date().toISOString() });
      if (error) throw error; setAnnouncement({ title: '', content: '', image_url: '', is_pinned: false }); await load(); setNotice({ type: 'success', text: 'Announcement published.' });
    } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  }

  async function deleteAnnouncement(title) {
    if (!window.confirm(`Delete announcement “${title}”?`)) return;
    setBusy(true); try { await requireAdmin(); const { error } = await supabase.from('announcements').delete().eq('title', title); if (error) throw error; await load(); } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  }

  async function saveMedia(event) {
    event.preventDefault(); setBusy(true);
    try { await requireAdmin(); if (!mediaForm.title.trim() || !mediaForm.image_url.trim() || !mediaForm.category.trim()) throw new Error('Title, image URL and category are required.'); const { error } = await supabase.from('media').insert({ title: mediaForm.title.trim(), image_url: mediaForm.image_url.trim(), category: mediaForm.category.trim() }); if (error) throw error; setMediaForm({ title: '', image_url: '', category: '' }); await load(); setNotice({ type: 'success', text: 'Media added.' }); }
    catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  }

  async function deleteMedia(id) {
    if (!window.confirm('Delete this media item?')) return;
    setBusy(true); try { await requireAdmin(); const { error } = await supabase.from('media').delete().eq('id', id); if (error) throw error; await load(); } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  }

  async function logout() { await supabase.auth.signOut(); onLogout?.(); }
  const tabs = ['Overview', 'Chapters', 'Comments', 'Announcements', 'Media'];

  return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6"><header className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black tracking-[0.25em] text-blue-400">REKHA • PUBLISHER</p><h1 className="mt-1 text-3xl font-black">Admin Control Center</h1><p className="mt-1 text-sm text-zinc-500">{email} · Supabase + Cloudflare only</p></div><div className="flex gap-2"><button onClick={load} disabled={busy} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold">Refresh</button><button onClick={logout} className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold">Sign out</button></div></div></header>{notice.text && <div className={`mb-5 rounded-2xl border p-4 text-sm ${notice.type === 'error' ? 'border-rose-900 bg-rose-950/40 text-rose-300' : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'}`}>{notice.text}</div>}<nav className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-2">{tabs.map(t => <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === t ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>{t}</button>)}</nav>{loading ? <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">Loading admin data…</div> : tab === 'Overview' ? <section className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="All chapters" value={sorted.length} /><Stat label="Published" value={published.length} /><Stat label="Pre-uploaded" value={preuploaded.length} /><Stat label="Manga pages" value={totalPages} /></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Stat label="Comments" value={comments.length} /><Stat label="Announcements" value={announcements.length} /><Stat label="Media" value={media.length} /></div></section> : tab === 'Chapters' ? <section className="space-y-5"><div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-black">{editing ? 'Edit chapter' : 'Upload a chapter'}</h2><p className="mt-1 text-sm text-zinc-500">Select all manga images at once. They are uploaded directly to Supabase Storage.</p></div>{editing && <button onClick={resetForm} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm">Cancel</button>}</div><form onSubmit={saveChapter} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><input type="number" min="1" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="Chapter #" required className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3"><option>Published</option><option>Pre-uploaded</option><option>Draft</option></select><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" required className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 md:col-span-2" /><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="3" className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 md:col-span-2" /><label className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm">Release date<input type="datetime-local" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} className="mt-2 block w-full bg-transparent" /></label><label className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm">Cover image<input type="file" accept="image/*" onChange={e => setForm({ ...form, cover: e.target.files?.[0] || null })} className="mt-2 block w-full text-sm" /></label></div><label className="block rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-5"><span className="font-bold">Manga pages · select all</span><input type="file" multiple accept="image/*" onChange={choosePages} className="mt-3 block w-full text-sm" />{form.pages.length > 0 && <p className="mt-2 text-sm text-emerald-300">{form.pages.length} pages ready</p>}</label>{progress.total > 0 && <div className="rounded-xl bg-zinc-950 p-4"><div className="flex justify-between text-sm"><span>{progress.text}</span><span>{progress.current}/{progress.total}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-blue-600" style={{ width: `${(progress.current / progress.total) * 100}%` }} /></div></div>}<button disabled={busy} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-black disabled:opacity-50">{busy ? 'Uploading…' : editing ? 'Save chapter changes' : 'Upload chapter'}</button></form></div><div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">All chapters</h2><p className="text-sm text-zinc-500">{sorted.length} total · {published.length} published · {preuploaded.length} pre-uploaded</p></div><button onClick={resetForm} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold">+ New</button></div><div className="mt-5 space-y-3">{sorted.map(chapter => <article key={chapter.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><b>Chapter {chapter.chapterNumber}</b><span className="rounded-full bg-zinc-800 px-2 py-1 text-[11px]">{chapter.status || 'Pre-uploaded'}</span></div><h3 className="mt-1 font-semibold">{chapter.title || 'Untitled chapter'}</h3><p className="text-xs text-zinc-500">{pageCounts[chapter.id] || 0} pages{chapter.releaseDate ? ` · ${new Date(chapter.releaseDate).toLocaleString()}` : ''}</p></div><div className="flex gap-2"><button onClick={() => editChapter(chapter)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold">Edit</button><button onClick={() => deleteChapter(chapter)} disabled={busy} className="rounded-lg bg-rose-950 px-3 py-2 text-sm font-bold text-rose-300 disabled:opacity-50">Delete</button></div></div></article>)}{!sorted.length && <p className="py-8 text-center text-zinc-500">No chapters yet.</p>}</div></div></section> : tab === 'Comments' ? <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"><h2 className="text-xl font-black">Comments</h2><div className="mt-5 space-y-3">{comments.map(c => <article key={c.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex justify-between gap-4"><div><b>{c.author_name || 'Reader'}</b><p className="mt-2 text-zinc-300">{c.content}</p><p className="mt-2 text-xs text-zinc-500">{new Date(c.created_at).toLocaleString()}</p></div><button onClick={() => deleteComment(c.id)} disabled={busy} className="rounded-lg bg-rose-950 px-3 py-2 text-xs font-bold text-rose-300">Delete</button></div></article>)}{!comments.length && <p className="py-8 text-center text-zinc-500">No comments yet.</p>}</div></section> : tab === 'Announcements' ? <section className="space-y-5"><form onSubmit={saveAnnouncement} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 space-y-4"><h2 className="text-xl font-black">Announcements</h2><input value={announcement.title} onChange={e => setAnnouncement({ ...announcement, title: e.target.value })} placeholder="Title" required className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /><textarea value={announcement.content} onChange={e => setAnnouncement({ ...announcement, content: e.target.value })} placeholder="Content" required rows="4" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /><input value={announcement.image_url} onChange={e => setAnnouncement({ ...announcement, image_url: e.target.value })} placeholder="Image URL (optional)" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /><label className="flex gap-2 text-sm"><input type="checkbox" checked={announcement.is_pinned} onChange={e => setAnnouncement({ ...announcement, is_pinned: e.target.checked })} /> Pin</label><button disabled={busy} className="rounded-xl bg-blue-600 px-5 py-3 font-bold">Publish announcement</button></form><div className="space-y-3">{announcements.map(a => <article key={`${a.title}-${a.created_at}`} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex justify-between gap-4"><div><b>{a.title}</b><p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{a.content}</p></div><button onClick={() => deleteAnnouncement(a.title)} className="text-sm font-bold text-rose-400">Delete</button></div></article>)}</div></section> : <section className="space-y-5"><form onSubmit={saveMedia} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6"><h2 className="text-xl font-black">Media library</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><input value={mediaForm.title} onChange={e => setMediaForm({ ...mediaForm, title: e.target.value })} placeholder="Title" required className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /><input value={mediaForm.image_url} onChange={e => setMediaForm({ ...mediaForm, image_url: e.target.value })} placeholder="Image URL" required className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /><input value={mediaForm.category} onChange={e => setMediaForm({ ...mediaForm, category: e.target.value })} placeholder="Category" required className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3" /></div><button disabled={busy} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 font-bold">Add media</button></form><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{media.map(m => <article key={m.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">{m.image_url && <img src={m.image_url} alt="" className="aspect-video w-full object-cover" loading="lazy" />}<div className="p-4"><b>{m.title}</b><p className="text-xs text-zinc-500">{m.category}</p><button onClick={() => deleteMedia(m.id)} className="mt-3 text-sm font-bold text-rose-400">Delete</button></div></article>)}</div></section>}</div></main>;
}
