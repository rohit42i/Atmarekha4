import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { buildChapters } from './chapters';
import AdminOverview from './AdminOverview';
import { getAdminRole } from './adminAuth';

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
  const role = await getAdminRole(user.id);
  if (!role) throw new Error('Admin access required.');
  return user;
}

async function removeFiles(bucket, paths) {
  const clean = paths.filter(Boolean);
  if (!clean.length) return;
  const { error } = await supabase.storage.from(bucket).remove(clean);
  if (error) throw new Error(`Storage cleanup failed: ${error.message}`);
}

const emptyForm = () => ({ number: '', title: '', description: '', status: 'Published', releaseDate: '', cover: null, pages: [] });

function Stat({ label, value, accent = false }) {
  return <div className={`admin-stat ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

export default function AdminPanel({ onLogout }) {
  const [tab, setTab] = useState('Overview');
  const [chapters, setChapters] = useState([]);
  const [pageCounts, setPageCounts] = useState({});
  const [comments, setComments] = useState([]);
  const [reports, setReports] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [views, setViews] = useState([]);
  const [likes, setLikes] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [media, setMedia] = useState([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [announcement, setAnnouncement] = useState({ title: '', content: '', thumbnail: null, is_pinned: false });
  const [mediaForm, setMediaForm] = useState({ title: '', image_url: '', category: '' });

  const sorted = useMemo(() => [...chapters].sort((a, b) => {
    const an = Number(a.chapterNumber), bn = Number(b.chapterNumber);
    if (!Number.isFinite(an) && !Number.isFinite(bn)) return 0;
    if (!Number.isFinite(an)) return 1;
    if (!Number.isFinite(bn)) return -1;
    return an - bn;
  }), [chapters]);
  const published = sorted.filter(c => String(c.status).toLowerCase() === 'published');
  const preuploaded = sorted.filter(c => String(c.status).toLowerCase() !== 'published');
  const totalPages = Object.values(pageCounts).reduce((sum, value) => sum + value, 0);
  const averageRating = ratings.length ? ratings.reduce((sum, row) => sum + Number(row.rating || 0), 0) / ratings.length : 0;

  const resetForm = () => { setEditing(null); setForm(emptyForm()); setProgress({ current: 0, total: 0, text: '' }); };

  const load = async () => {
    setLoading(true); setNotice({ type: '', text: '' });
    try {
      const user = await requireAdmin();
      setEmail(user.email || '');
      const [chapterData, pageResult, commentResult, reportResult, ratingResult, viewResult, likeResult, announcementResult, mediaResult] = await Promise.all([
        buildChapters(),
        supabase.from(PAGES).select('id, chapter_id, page_number, image_url'),
        supabase.from('comments').select('id, user_id, chapter_id, author_name, content, created_at, parent_comment_id').order('created_at', { ascending: false }),
        supabase.from('comment_reports').select('id, comment_id, reason, created_at').order('created_at', { ascending: false }),
        supabase.from('chapter_ratings').select('id, chapter_id, rating, created_at').order('created_at', { ascending: false }),
        supabase.from('chapter_views').select('id, chapter_id, created_at'),
        supabase.from('chapter_likes').select('id, chapter_id, created_at'),
        supabase.from('announcements').select('title, content, image_url, is_pinned, published_at, created_at').order('created_at', { ascending: false }),
        supabase.from('media').select('id, title, image_url, category, created_at').order('created_at', { ascending: false }),
      ]);
      for (const result of [pageResult, commentResult, reportResult, ratingResult, viewResult, likeResult, announcementResult, mediaResult]) if (result.error) throw result.error;
      const counts = {};
      for (const row of pageResult.data || []) counts[row.chapter_id] = (counts[row.chapter_id] || 0) + 1;
      setChapters(chapterData || []); setPageCounts(counts); setComments(commentResult.data || []); setReports(reportResult.data || []); setRatings(ratingResult.data || []); setViews(viewResult.data || []); setLikes(likeResult.data || []); setAnnouncements(announcementResult.data || []); setMedia(mediaResult.data || []);
    } catch (error) {
      console.error(error); setNotice({ type: 'error', text: error.message || 'Unable to load admin data.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const choosePages = event => {
    // Preserve the exact FileList order supplied by the picker. Do not sort by filename.
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'));
    const tooLarge = files.find(file => file.size > MAX_PAGE_SIZE);
    if (tooLarge) { event.target.value = ''; setNotice({ type: 'error', text: `${tooLarge.name} is larger than 20 MB.` }); return; }
    setForm(value => ({ ...value, pages: files }));
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
      const rawNumber = String(form.number ?? '').trim();
      const number = rawNumber === '' ? null : Number(rawNumber);
      if (number !== null && (!Number.isInteger(number) || number < 1)) throw new Error('Enter a valid chapter number or leave it blank.');
      if (!form.title.trim()) throw new Error('Chapter title is required.');
      if (!editing && !form.pages.length) throw new Error('Select at least one manga page.');

      // Blank chapter numbers are intentionally stored as NULL. They are not auto-numbered.
      const payload = { chapter_number: number, title: form.title.trim(), description: form.description.trim(), status: form.status, release_date: form.releaseDate ? new Date(form.releaseDate).toISOString() : null };

      if (editing) {
        const { error } = await supabase.from(CHAPTERS).update(payload).eq('id', editing.id);
        if (error) throw new Error(`Chapter update failed: ${error.message}`);
      } else {
        const { data, error } = await supabase.from(CHAPTERS).insert(payload).select('id, chapter_number').single();
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
      const savedLabel = number === null ? 'Special / unnumbered' : `Chapter ${number}`;
      resetForm(); await load(); setNotice({ type: 'success', text: `${savedLabel} ${editing ? 'updated' : 'uploaded'} successfully.` });
    } catch (error) {
      console.error(error);
      for (const item of uploadedPaths) { try { await removeFiles(item.bucket, [item.path]); } catch (_) {} }
      if (!editing && chapterId) { try { await supabase.from(CHAPTERS).delete().eq('id', chapterId); } catch (_) {} }
      setNotice({ type: 'error', text: error.message || 'Chapter upload failed.' });
      setProgress({ current: 0, total: 0, text: '' });
    } finally { setBusy(false); }
  }

  const editChapter = chapter => {
    setEditing(chapter);
    setForm({ number: chapter.chapterNumber || '', title: chapter.title || '', description: chapter.description || '', status: chapter.status || 'Published', releaseDate: chapter.releaseDate ? new Date(chapter.releaseDate).toISOString().slice(0, 16) : '', cover: null, pages: [] });
    setTab('Chapters'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function deleteChapter(chapter) {
    if (!window.confirm(`Delete ${chapter.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'this unnumbered entry'} permanently?`)) return;
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
      if (editing?.id === chapter.id) resetForm(); await load(); setNotice({ type: 'success', text: `${chapter.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'Unnumbered entry'} deleted.` });
    } catch (error) { setNotice({ type: 'error', text: error.message || 'Delete failed.' }); }
    finally { setBusy(false); }
  }

  async function deleteComment(id) {
    if (!window.confirm('Delete this comment and its replies?')) return;
    setBusy(true);
    try { await requireAdmin(); const { error } = await supabase.from('comments').delete().eq('id', id); if (error) throw error; await load(); }
    catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  }

  async function clearReport(id) {
    setBusy(true);
    try { await requireAdmin(); const { error } = await supabase.from('comment_reports').delete().eq('id', id); if (error) throw error; await load(); }
    catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  }

  async function saveAnnouncement(event) {
    event.preventDefault(); setBusy(true); const uploadedPaths = [];
    try {
      await requireAdmin();
      const title = announcement.title.trim(); const content = announcement.content.trim();
      if (!title && !content && !announcement.thumbnail) throw new Error('Add a title, text, or thumbnail before publishing.');
      let imageUrl = null;
      if (announcement.thumbnail) {
        const ext = announcement.thumbnail.name.split('.').pop()?.toLowerCase() || 'jpg';
        const safeName = announcement.thumbnail.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
        const path = `announcements/${Date.now()}-${safeName || `thumbnail.${ext}`}`;
        imageUrl = await upload(COVER_BUCKET, announcement.thumbnail, path); uploadedPaths.push({ bucket: COVER_BUCKET, path });
      }
      const storedTitle = title || `__image_only_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabase.from('announcements').insert({ title: storedTitle, content: content || '', image_url: imageUrl, is_pinned: announcement.is_pinned, published_at: new Date().toISOString() });
      if (error) throw error;
      setAnnouncement({ title: '', content: '', thumbnail: null, is_pinned: false }); await load(); setNotice({ type: 'success', text: 'Announcement published.' });
    } catch (error) { for (const item of uploadedPaths) { try { await removeFiles(item.bucket, [item.path]); } catch (_) {} } setNotice({ type: 'error', text: error.message || 'Announcement publishing failed.' }); }
    finally { setBusy(false); }
  }

  async function saveMedia(event) {
    event.preventDefault(); setBusy(true);
    try { await requireAdmin(); if (!mediaForm.title.trim() || !mediaForm.image_url.trim() || !mediaForm.category.trim()) throw new Error('Title, image URL and category are required.'); const { error } = await supabase.from('media').insert({ title: mediaForm.title.trim(), image_url: mediaForm.image_url.trim(), category: mediaForm.category.trim() }); if (error) throw error; setMediaForm({ title: '', image_url: '', category: '' }); await load(); setNotice({ type: 'success', text: 'Media added.' }); }
    catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); }
  }

  async function logout() { await supabase.auth.signOut(); onLogout?.(); }

  const tabs = ['Overview', 'Chapters', 'Comments', 'Reports', 'Announcements', 'Media'];
  const chapterName = id => { const chapter = chapters.find(item => item.id === id); return chapter ? `Chapter ${chapter.chapterNumber} — ${chapter.title}` : 'Unknown chapter'; };
  const commentById = id => comments.find(comment => comment.id === id);

  return <main className="min-h-screen bg-zinc-950 text-[var(--text-color)]"><div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
    <header className="admin-header-card"><div><p className="text-xs font-black tracking-[0.25em] text-blue-400">REKHA · PUBLISHER</p><h1 className="mt-1 text-3xl font-black tracking-tight">Admin Dashboard</h1><p className="mt-1 text-sm text-zinc-500">{email || 'Admin'} · Supabase protected</p></div><div className="flex flex-wrap gap-2"><button onClick={() => { setTab('Chapters'); resetForm(); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black shadow-lg shadow-blue-900/20">+ Upload chapter</button><button onClick={load} disabled={busy} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold">Refresh</button><button onClick={logout} className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-bold">Sign out</button></div></header>
    {notice.text && <div className={`mb-5 rounded-2xl border p-4 text-sm ${notice.type === 'error' ? 'border-rose-900 bg-rose-950/40 text-rose-300' : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'}`}>{notice.text}</div>}
    <nav className="admin-tabs">{tabs.map(item => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'active' : ''}>{item}{item === 'Reports' && reports.length > 0 ? <b>{reports.length}</b> : null}</button>)}</nav>
    {loading ? <div className="admin-loading">Loading dashboard…</div> : tab === 'Overview' ? <AdminOverview chapters={sorted} comments={comments} reports={reports} ratings={ratings} views={views} likes={likes} pageCounts={pageCounts} onTab={setTab} /> : tab === 'Chapters' ? <section className="admin-stack"><section className="admin-card upload-card"><div className="admin-card-title"><div><span>{editing ? 'EDIT CHAPTER' : 'PUBLISHER'}</span><h2>{editing ? `Edit ${editing.chapterNumber ? `Chapter ${editing.chapterNumber}` : 'Unnumbered Entry'}` : 'Upload a chapter'}</h2><p>Select all manga pages at once. Their selected order will be preserved exactly during upload.</p></div>{editing && <button onClick={resetForm}>Cancel</button>}</div><form onSubmit={saveChapter} className="admin-form"><div className="admin-form-grid"><input type="number" min="1" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="Chapter number (optional)"/><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Published</option><option>Pre-uploaded</option><option>Draft</option></select><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Chapter title" required className="wide"/><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="3" className="wide"/><label>Release date<input type="datetime-local" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })}/></label><label>Cover image<input type="file" accept="image/*" onChange={e => setForm({ ...form, cover: e.target.files?.[0] || null })}/></label></div><label className="admin-dropzone"><strong>Manga pages</strong><span>Select pages in the exact order you want them published. Filename sorting is disabled.</span><input type="file" multiple accept="image/*" onChange={choosePages}/>{form.pages.length > 0 && <em>{form.pages.length} pages ready · selected order preserved</em>}</label>{progress.total > 0 && <div className="admin-progress"><div><span>{progress.text}</span><b>{progress.current}/{progress.total}</b></div><i><span style={{ width: `${(progress.current / progress.total) * 100}%` }}/></i></div>}<button disabled={busy} className="admin-submit">{busy ? 'Working…' : editing ? 'Save chapter changes' : 'Upload chapter'}</button></form></section><section className="admin-card"><div className="admin-card-title"><div><span>LIBRARY</span><h2>All chapters</h2></div><button onClick={resetForm}>+ New chapter</button></div><div className="admin-chapter-list">{sorted.map(chapter => <article key={chapter.id}><div><div className="admin-status-line"><strong>{chapter.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'Unnumbered'}</strong><span>{chapter.status || 'Pre-uploaded'}</span></div><h3>{chapter.title || 'Untitled chapter'}</h3><p>{pageCounts[chapter.id] || 0} pages · {chapter.releaseDate ? new Date(chapter.releaseDate).toLocaleDateString('en-IN') : 'No release date'}</p></div><div className="admin-row-actions"><button onClick={() => editChapter(chapter)}>Edit</button><button className="danger" onClick={() => deleteChapter(chapter)} disabled={busy}>Delete</button></div></article>)}{!sorted.length && <p className="muted center">No chapters yet.</p>}</div></section></section> : tab === 'Comments' ? <section className="admin-card"><div className="admin-card-title"><div><span>MODERATION</span><h2>Comments</h2><p>{comments.length} total comments · replies included</p></div></div><div className="admin-comment-list">{comments.map(comment => <article key={comment.id}><div className="admin-comment-avatar">{(comment.author_name || 'R').slice(0, 1).toUpperCase()}</div><div><div className="admin-comment-meta"><strong>{comment.author_name || 'Reader'}</strong><span>{new Date(comment.created_at).toLocaleString('en-IN')}</span></div><p>{comment.content}</p><small>{chapterName(comment.chapter_id)}{comment.parent_comment_id ? ' · Reply' : ''}</small></div><button className="danger-text" onClick={() => deleteComment(comment.id)} disabled={busy}>Delete</button></article>)}{!comments.length && <p className="muted center">No comments yet.</p>}</div></section> : tab === 'Reports' ? <section className="admin-card"><div className="admin-card-title"><div><span>MODERATION</span><h2>Reported comments</h2><p>Review reports and remove anything that violates your community rules.</p></div></div><div className="admin-report-list">{reports.map(report => { const comment = commentById(report.comment_id); return <article key={report.id}><div><span className="report-label">REPORT</span><strong>{comment?.author_name || 'Reader'}</strong><p>{comment?.content || 'Comment unavailable'}</p><small>{report.reason || 'Reported by reader'} · {new Date(report.created_at).toLocaleString('en-IN')}</small></div><div className="admin-row-actions"><button className="danger" onClick={() => comment && deleteComment(comment.id)} disabled={busy}>Delete comment</button><button onClick={() => clearReport(report.id)} disabled={busy}>Clear</button></div></article>; })}{!reports.length && <p className="muted center">No reports. Everything is clean.</p>}</div></section> : tab === 'Announcements' ? <section className="admin-stack"><form onSubmit={saveAnnouncement} className="admin-card admin-form"><div className="admin-card-title"><div><span>CONTENT</span><h2>Announcements</h2><p>Publish the latest update shown on the home page.</p></div></div><input value={announcement.title} onChange={e => setAnnouncement({ ...announcement, title: e.target.value })} placeholder="Title (optional for image-only update)"/><textarea value={announcement.content} onChange={e => setAnnouncement({ ...announcement, content: e.target.value })} placeholder="Text (optional for image-only update)" rows="5"/><label className="admin-file-field"><span>Thumbnail / image (optional)</span><input type="file" accept="image/*" onChange={e => setAnnouncement({ ...announcement, thumbnail: e.target.files?.[0] || null })}/>{announcement.thumbnail && <em>{announcement.thumbnail.name}</em>}</label><label className="check-row"><input type="checkbox" checked={announcement.is_pinned} onChange={e => setAnnouncement({ ...announcement, is_pinned: e.target.checked })}/> Pin announcement</label><p className="admin-form-hint">No thumbnail → title/text card. Thumbnail + text → image with title/text. Thumbnail only → image-only card.</p><button className="admin-submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish announcement'}</button></form><div className="admin-card"><div className="admin-card-title"><div><span>PUBLISHED</span><h2>Announcements</h2></div></div><div className="admin-mini-list">{announcements.map(item => <div key={item.title}><div className="admin-announcement-admin-row">{item.image_url && <img src={item.image_url} alt="" loading="lazy"/>}<div><strong>{item.title?.startsWith('__image_only_') ? 'Image-only announcement' : item.title || 'Announcement'}</strong><p>{item.content || (item.image_url ? 'Image-only announcement' : '')}</p><small>{new Date(item.published_at || item.created_at).toLocaleString('en-IN')}</small></div></div><button className="danger-text" onClick={() => deleteAnnouncement(item)} disabled={busy}>Delete</button></div>)}</div>{!announcements.length && <p className="muted center">No announcements yet.</p>}</div></section> : <section className="admin-stack"><form onSubmit={saveMedia} className="admin-card admin-form"><div className="admin-card-title"><div><span>CONTENT</span><h2>Media library</h2></div></div><div className="admin-form-grid"><input value={mediaForm.title} onChange={e => setMediaForm({ ...mediaForm, title: e.target.value })} placeholder="Title" required/><input value={mediaForm.category} onChange={e => setMediaForm({ ...mediaForm, category: e.target.value })} placeholder="Category" required/><input value={mediaForm.image_url} onChange={e => setMediaForm({ ...mediaForm, image_url: e.target.value })} placeholder="Image URL" required className="wide"/></div><button className="admin-submit" disabled={busy}>Add media</button></form><div className="admin-media-grid">{media.map(item => <article key={item.id}>{item.image_url && <img src={item.image_url} alt="" loading="lazy"/>}<div><strong>{item.title}</strong><span>{item.category}</span><button className="danger-text" onClick={() => deleteMedia(item.id)}>Delete</button></div></article>)}</div></section>}
  </div></main>;
}