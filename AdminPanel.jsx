import { useEffect, useMemo, useState } from 'react';
import { supabase, cloudflareR2 } from './supabase';
import { buildChapters } from './chapters';
import AdminOverview from './AdminOverview';
import AdminChapterPages from './AdminChapterPages';
import PalDoPalAdmin from './PalDoPalAdmin';
import { getAdminRole } from './adminAuth';

const CHAPTERS = 'chapters';
const PAGES = 'chapter_pages';
const MAX_PAGE_SIZE = 20 * 1024 * 1024;
const PAGE_BUCKET = 'chapter-pages';
const COVER_BUCKET = 'covers';

const publicUrl = (bucket, path) => cloudflareR2.from(bucket).getPublicUrl(path).data.publicUrl;
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
  const { error } = await cloudflareR2.from(bucket).remove(clean);
  if (error) {
    const cleanupError = new Error('Cloudflare R2 cleanup failed: ' + error.message);
    cleanupError.r2Cleanup = { bucket, paths: clean };
    throw cleanupError;
  }
}
async function logAdminAction(user, action, entityType, entityId = null, details = {}) {
  if (!user?.id) return;
  try {
    const { error } = await supabase.from('admin_activity_log').insert({
      admin_user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
    if (error) console.warn('Admin activity log failed:', error);
  } catch (error) {
    console.warn('Admin activity log failed:', error);
  }
}

const emptyForm = () => ({ number: '', title: '', description: '', status: 'Published', releaseDate: '', cover: null, pages: [] });

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
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [mediaForm, setMediaForm] = useState({ title: '', image_url: '', category: '' });
  const [pageEditorProject, setPageEditorProject] = useState('atma');

  const sorted = useMemo(() => [...chapters].sort((a, b) => {
    const an = Number(a.chapterNumber), bn = Number(b.chapterNumber);
    if (!Number.isFinite(an) && !Number.isFinite(bn)) return 0;
    if (!Number.isFinite(an)) return 1;
    if (!Number.isFinite(bn)) return -1;
    return an - bn;
  }), [chapters]);

  const resetForm = () => { setEditing(null); setForm(emptyForm()); setProgress({ current: 0, total: 0, text: '' }); };

  const load = async () => {
    setLoading(true); setNotice({ type: '', text: '' });
    try {
      const user = await requireAdmin();
      setEmail(user.email || '');
      const [chapterData, pageResult, commentResult, reportResult, announcementResult, mediaResult] = await Promise.all([
        buildChapters(),
        supabase.from(PAGES).select('id, chapter_id, page_number, image_url').order('page_number', { ascending: true }),
        supabase.from('comments').select('id, user_id, chapter_id, author_name, content, created_at, parent_comment_id').order('created_at', { ascending: false }).limit(100),
        supabase.from('comment_reports').select('id, comment_id, reason, status, created_at, reviewed_at, reviewed_by').order('created_at', { ascending: false }).limit(100),
        supabase.from('announcements').select('id, title, content, image_url, is_pinned, published_at, created_at').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(10),
        supabase.from('media').select('id, title, image_url, category, created_at').order('created_at', { ascending: false }).limit(200),
      ]);
      for (const result of [pageResult, commentResult, reportResult, announcementResult, mediaResult]) if (result.error) throw result.error;
      const counts = {};
      for (const row of pageResult.data || []) counts[row.chapter_id] = (counts[row.chapter_id] || 0) + 1;
      setChapters(chapterData || []);
      setPageCounts(counts);
      setComments(commentResult.data || []);
      setReports(reportResult.data || []);
      setAnnouncements(announcementResult.data || []);
      setMedia(mediaResult.data || []);
      setRatings([]);
      setViews([]);
      setLikes([]);
    } catch (error) {
      console.error(error); setNotice({ type: 'error', text: error.message || 'Unable to load admin data.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const choosePages = event => {
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'));
    const tooLarge = files.find(file => file.size > MAX_PAGE_SIZE);
    if (tooLarge) { event.target.value = ''; setNotice({ type: 'error', text: `${tooLarge.name} is larger than 20 MB.` }); return; }
    setForm(value => ({ ...value, pages: files }));
  };

  async function upload(bucket, file, path) {
    const { error } = await cloudflareR2.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined, cacheControl: '31536000' });
    if (error) throw new Error(`Upload to ${bucket} failed: ${error.message}`);
    return publicUrl(bucket, path);
  }

  async function saveChapter(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice({ type: '', text: '' });

    let adminUser = null;
    let chapterId = editing?.id || null;
    let pagesCommitted = false;
    let coverCommitted = false;
    let chapterCreated = false;
    const uploadedPaths = [];

    try {
      adminUser = await requireAdmin();
      const rawNumber = String(form.number ?? '').trim();
      const number = rawNumber === '' ? null : Number(rawNumber);
      if (number !== null && (!Number.isInteger(number) || number < 1)) throw new Error('Enter a valid chapter number or leave it blank.');
      if (!form.title.trim()) throw new Error('Chapter title is required.');
      if (!editing && !form.pages.length) throw new Error('Select at least one manga page.');

      const payload = {
        chapter_number: number,
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        release_date: form.releaseDate ? new Date(form.releaseDate).toISOString() : null,
      };

      if (editing) {
        const { error } = await supabase.from(CHAPTERS).update(payload).eq('id', editing.id);
        if (error) throw new Error('Chapter update failed: ' + error.message);
      } else {
        const { data, error } = await supabase.from(CHAPTERS).insert(payload).select('id, chapter_number').single();
        if (error) throw new Error('Chapter creation failed: ' + error.message);
        chapterId = data.id;
        chapterCreated = true;
      }

      let oldCoverPath = null;
      if (form.cover) {
        const ext = form.cover.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = 'chapters/' + chapterId + '/cover-' + Date.now() + '.' + ext;
        await upload(COVER_BUCKET, form.cover, path);
        uploadedPaths.push({ bucket: COVER_BUCKET, path, kind: 'cover' });
        oldCoverPath = pathFromUrl(editing?.cover, COVER_BUCKET);

        const url = publicUrl(COVER_BUCKET, path);
        const { error } = await supabase.from(CHAPTERS).update({ cover_url: url }).eq('id', chapterId);
        if (error) throw new Error('Cover save failed: ' + error.message);
        coverCommitted = true;

        if (oldCoverPath) {
          try { await removeFiles(COVER_BUCKET, [oldCoverPath]); }
          catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', 'chapter_cover', chapterId, { bucket: COVER_BUCKET, paths: [oldCoverPath], error: cleanupError.message });
          }
        }
      }

      if (form.pages.length) {
        setProgress({ current: 0, total: form.pages.length, text: 'Uploading manga pages…' });
        const old = await supabase.from(PAGES).select('id, image_url').eq('chapter_id', chapterId);
        if (old.error) throw new Error('Could not read existing pages: ' + old.error.message);
        const oldPaths = (old.data || []).map(row => pathFromUrl(row.image_url, PAGE_BUCKET)).filter(Boolean);
        const revision = Date.now();
        const rows = [];

        for (let i = 0; i < form.pages.length; i += 1) {
          const file = form.pages[i];
          const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          const pagePath = chapterId + '/' + revision + '/' + String(i + 1).padStart(4, '0') + '.' + ext;
          const url = await upload(PAGE_BUCKET, file, pagePath);
          uploadedPaths.push({ bucket: PAGE_BUCKET, path: pagePath, kind: 'page' });
          rows.push({ chapter_id: chapterId, page_number: i + 1, image_url: url });
          setProgress({ current: i + 1, total: form.pages.length, text: 'Uploaded page ' + (i + 1) + ' of ' + form.pages.length });
        }

        const inserted = await supabase.from(PAGES).insert(rows);
        if (inserted.error) throw new Error('Saving chapter pages failed: ' + inserted.error.message);
        pagesCommitted = true;

        if (oldPaths.length) {
          try { await removeFiles(PAGE_BUCKET, oldPaths); }
          catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', 'chapter_pages', chapterId, { bucket: PAGE_BUCKET, paths: oldPaths, error: cleanupError.message });
          }
        }
      }

      await logAdminAction(adminUser, editing ? 'update_chapter' : 'create_chapter', 'chapter', chapterId, {
        chapter_number: number,
        title: form.title.trim(),
        status: form.status,
        pages: form.pages.length || 0,
        cover_changed: Boolean(form.cover),
      });

      const savedLabel = number === null ? 'Special / unnumbered' : 'Chapter ' + number;
      const wasEditing = Boolean(editing);
      resetForm();
      await load();
      setNotice({ type: 'success', text: savedLabel + ' ' + (wasEditing ? 'updated' : 'uploaded') + ' successfully.' });
    } catch (error) {
      console.error(error);
      for (const item of uploadedPaths) {
        const committed = (item.kind === 'page' && pagesCommitted) || (item.kind === 'cover' && coverCommitted);
        if (!committed) {
          try { await removeFiles(item.bucket, [item.path]); }
          catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', item.kind === 'page' ? 'chapter_pages' : 'chapter_cover', chapterId, { bucket: item.bucket, paths: [item.path], error: cleanupError.message });
          }
        }
      }

      if (chapterCreated && !pagesCommitted && chapterId) {
        try {
          await supabase.from(CHAPTERS).delete().eq('id', chapterId);
          // The new chapter was never valid without its required page set.
          // Mark committed uploads as cleanable so they do not become R2 orphans.
          for (const item of uploadedPaths) {
            try { await removeFiles(item.bucket, [item.path]); } catch (_) {}
          }
        } catch (_) {}
      }

      if (adminUser) await logAdminAction(adminUser, 'chapter_operation_failed', 'chapter', chapterId, {
        error: error.message,
        r2_cleanup: error.r2Cleanup || null,
      });
      setNotice({ type: 'error', text: error.message || 'Chapter upload failed.' });
      setProgress({ current: 0, total: 0, text: '' });
    } finally {
      setBusy(false);
    }
  }

  const editChapter = chapter => {
    setEditing(chapter);
    setForm({ number: chapter.chapterNumber || '', title: chapter.title || '', description: chapter.description || '', status: chapter.status || 'Published', releaseDate: chapter.releaseDate ? new Date(chapter.releaseDate).toISOString().slice(0, 16) : '', cover: null, pages: [] });
    setTab('Chapters'); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function deleteChapter(chapter) {
    if (!window.confirm('Delete ' + (chapter.chapterNumber ? 'Chapter ' + chapter.chapterNumber : 'this unnumbered entry') + ' permanently?')) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const pages = await supabase.from(PAGES).select('image_url').eq('chapter_id', chapter.id);
      if (pages.error) throw new Error('Could not read chapter pages: ' + pages.error.message);
      const pagePaths = (pages.data || []).map(row => pathFromUrl(row.image_url, PAGE_BUCKET)).filter(Boolean);
      const coverPath = pathFromUrl(chapter.cover, COVER_BUCKET);
      const deleted = await supabase.from(CHAPTERS).delete().eq('id', chapter.id);
      if (deleted.error) throw new Error('Chapter delete failed: ' + deleted.error.message);

      const cleanupFailures = [];
      if (pagePaths.length) {
        try { await removeFiles(PAGE_BUCKET, pagePaths); }
        catch (error) { cleanupFailures.push({ bucket: PAGE_BUCKET, paths: pagePaths, error: error.message }); }
      }
      if (coverPath) {
        try { await removeFiles(COVER_BUCKET, [coverPath]); }
        catch (error) { cleanupFailures.push({ bucket: COVER_BUCKET, paths: [coverPath], error: error.message }); }
      }
      for (const failure of cleanupFailures) {
        await logAdminAction(adminUser, 'r2_cleanup_failed', 'chapter', chapter.id, failure);
      }
      await logAdminAction(adminUser, 'delete_chapter', 'chapter', chapter.id, {
        chapter_number: chapter.chapterNumber,
        title: chapter.title,
        cleanup_pending: cleanupFailures.length > 0,
      });

      if (editing?.id === chapter.id) resetForm();
      await load();
      setNotice({
        type: 'success',
        text: cleanupFailures.length
          ? 'Chapter deleted. Some old R2 files need cleanup retry in Operations.'
          : (chapter.chapterNumber ? 'Chapter ' + chapter.chapterNumber : 'Unnumbered entry') + ' deleted.',
      });
    } catch (error) {
      await logAdminAction(adminUser, 'delete_chapter_failed', 'chapter', chapter.id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Delete failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(id) {
    if (!window.confirm('Delete this comment and its replies?')) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (error) throw error;
      await logAdminAction(adminUser, 'delete_comment', 'comment', id);
      await load();
      setNotice({ type: 'success', text: 'Comment deleted.' });
    } catch (error) {
      await logAdminAction(adminUser, 'delete_comment_failed', 'comment', id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Comment deletion failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function setReportStatus(id, status) {
    if (busy) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const patch = {
        status,
        reviewed_at: status === 'open' ? null : new Date().toISOString(),
        reviewed_by: status === 'open' ? null : adminUser.id,
      };
      const { error } = await supabase.from('comment_reports').update(patch).eq('id', id);
      if (error) throw error;
      await logAdminAction(adminUser, 'report_' + status, 'comment_report', id, patch);
      await load();
      setNotice({ type: 'success', text: 'Report marked ' + status + '.' });
    } catch (error) {
      await logAdminAction(adminUser, 'report_status_failed', 'comment_report', id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Report update failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function clearReport(id) {
    await setReportStatus(id, 'resolved');
  }

  function editAnnouncement(item) {
    setEditingAnnouncementId(item.id);
    setAnnouncement({
      title: item.title?.startsWith('__image_only_') ? '' : (item.title || ''),
      content: item.content || '',
      thumbnail: null,
      is_pinned: Boolean(item.is_pinned),
    });
    setTab('Announcements');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelAnnouncementEdit() {
    setEditingAnnouncementId(null);
    setAnnouncement({ title: '', content: '', thumbnail: null, is_pinned: false });
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const uploadedPaths = [];
    let adminUser = null;
    let imageCommitted = false;

    try {
      adminUser = await requireAdmin();
      const title = announcement.title.trim();
      const content = announcement.content.trim();
      if (!title && !content && !announcement.thumbnail) throw new Error('Add a title, text, or thumbnail before publishing.');

      const existing = editingAnnouncementId
        ? announcements.find(item => item.id === editingAnnouncementId)
        : null;

      let imageUrl = existing?.image_url || null;
      const oldImagePath = announcement.thumbnail ? pathFromUrl(existing?.image_url, COVER_BUCKET) : null;

      if (announcement.thumbnail) {
        const ext = announcement.thumbnail.name.split('.').pop()?.toLowerCase() || 'jpg';
        const safeName = announcement.thumbnail.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
        const path = 'announcements/' + Date.now() + '-' + (safeName || ('thumbnail.' + ext));
        imageUrl = await upload(COVER_BUCKET, announcement.thumbnail, path);
        uploadedPaths.push({ bucket: COVER_BUCKET, path });
      }

      const storedTitle = title || (
        existing?.title?.startsWith('__image_only_')
          ? existing.title
          : '__image_only_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
      );

      if (existing) {
        const { error } = await supabase.from('announcements').update({
          title: storedTitle,
          content: content || '',
          image_url: imageUrl,
          is_pinned: announcement.is_pinned,
        }).eq('id', existing.id);
        if (error) throw error;
        imageCommitted = Boolean(announcement.thumbnail);

        if (oldImagePath) {
          try { await removeFiles(COVER_BUCKET, [oldImagePath]); }
          catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', 'announcement', existing.id, {
              bucket: COVER_BUCKET,
              paths: [oldImagePath],
              error: cleanupError.message,
            });
          }
        }

        await logAdminAction(adminUser, 'update_announcement', 'announcement', existing.id, {
          title: storedTitle,
          pinned: announcement.is_pinned,
          image_changed: Boolean(announcement.thumbnail),
        });
      } else {
        const { data, error } = await supabase.from('announcements').insert({
          title: storedTitle,
          content: content || '',
          image_url: imageUrl,
          is_pinned: announcement.is_pinned,
          published_at: new Date().toISOString(),
        }).select('id').single();
        if (error) throw error;
        imageCommitted = Boolean(announcement.thumbnail);
        await logAdminAction(adminUser, 'create_announcement', 'announcement', data?.id || null, {
          title: storedTitle,
          pinned: announcement.is_pinned,
          image_changed: Boolean(announcement.thumbnail),
        });
      }

      cancelAnnouncementEdit();
      await load();
      setNotice({ type: 'success', text: existing ? 'Announcement updated.' : 'Announcement published.' });
    } catch (error) {
      for (const item of uploadedPaths) {
        if (!imageCommitted) {
          try { await removeFiles(item.bucket, [item.path]); } catch (_) {}
        }
      }
      await logAdminAction(adminUser, editingAnnouncementId ? 'update_announcement_failed' : 'create_announcement_failed', 'announcement', editingAnnouncementId || null, {
        error: error.message,
        r2_cleanup: error.r2Cleanup || null,
      });
      setNotice({ type: 'error', text: error.message || 'Announcement save failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function saveMedia(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      if (!mediaForm.title.trim() || !mediaForm.image_url.trim() || !mediaForm.category.trim()) {
        throw new Error('Title, image URL, and category are required.');
      }
      const { data, error } = await supabase.from('media').insert({
        title: mediaForm.title.trim(),
        image_url: mediaForm.image_url.trim(),
        category: mediaForm.category.trim(),
      }).select('id').single();
      if (error) throw error;
      await logAdminAction(adminUser, 'create_media', 'media', data?.id || null, { title: mediaForm.title.trim(), category: mediaForm.category.trim() });
      setMediaForm({ title: '', image_url: '', category: '' });
      await load();
      setNotice({ type: 'success', text: 'Media added.' });
    } catch (error) {
      await logAdminAction(adminUser, 'create_media_failed', 'media', null, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Media save failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAnnouncement(item) {
    if (!window.confirm('Delete this announcement permanently?')) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const { error } = await supabase.from('announcements').delete().eq('id', item.id);
      if (error) throw error;

      const oldImagePath = pathFromUrl(item.image_url, COVER_BUCKET);
      let cleanupPending = false;
      if (oldImagePath) {
        try { await removeFiles(COVER_BUCKET, [oldImagePath]); }
        catch (cleanupError) {
          cleanupPending = true;
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'announcement', item.id, {
            bucket: COVER_BUCKET,
            paths: [oldImagePath],
            error: cleanupError.message,
          });
        }
      }

      await logAdminAction(adminUser, 'delete_announcement', 'announcement', item.id, { cleanup_pending: cleanupPending });
      if (editingAnnouncementId === item.id) cancelAnnouncementEdit();
      await load();
      setNotice({
        type: 'success',
        text: cleanupPending ? 'Announcement deleted. Image cleanup is pending in Operations.' : 'Announcement deleted.',
      });
    } catch (error) {
      await logAdminAction(adminUser, 'delete_announcement_failed', 'announcement', item.id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Announcement delete failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteMedia(id) {
    if (!window.confirm('Delete this media item permanently?')) return;
    setBusy(true);
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const { error } = await supabase.from('media').delete().eq('id', id);
      if (error) throw error;
      await logAdminAction(adminUser, 'delete_media', 'media', id);
      await load();
      setNotice({ type: 'success', text: 'Media deleted.' });
    } catch (error) {
      await logAdminAction(adminUser, 'delete_media_failed', 'media', id, { error: error.message });
      setNotice({ type: 'error', text: error.message || 'Media delete failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function logout() { await supabase.auth.signOut(); onLogout?.(); }

  const tabs = ['Overview', 'Chapters', 'Pal Do Pal Ke Lamhe', 'Pages', 'Comments', 'Reports', 'Announcements', 'Media'];
  const chapterName = id => { const chapter = chapters.find(item => item.id === id); return chapter ? `Chapter ${chapter.chapterNumber} — ${chapter.title}` : 'Unknown chapter'; };
  const commentById = id => comments.find(comment => comment.id === id);
  const reportCount = reports.filter(report => (report.status || 'open') === 'open').length;

  return <main className="admin-page min-h-screen bg-zinc-950 text-[var(--text-color)]" data-admin-root="true"><div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
    <header className="admin-header-card"><div><p className="text-xs font-black tracking-[0.25em] text-blue-400">REKHA · PUBLISHER</p><h1 className="mt-1 text-3xl font-black tracking-tight">Admin Dashboard</h1><p className="mt-1 text-sm text-zinc-500">{email || 'Admin'} · Supabase protected</p></div><div className="flex flex-wrap gap-2"><button onClick={() => { setTab('Chapters'); resetForm(); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black shadow-lg shadow-blue-900/20">+ Atma Rekha chapter</button><button onClick={() => { setTab('Pal Do Pal Ke Lamhe'); window.setTimeout(() => document.getElementById('pdlpl-upload-chapter')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold">+ PDPL chapter</button><button onClick={load} disabled={busy} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold">Refresh</button><button onClick={logout} className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-bold">Sign out</button></div></header>
    {notice.text && <div className={`mb-5 rounded-2xl border p-4 text-sm ${notice.type === 'error' ? 'border-rose-900 bg-rose-950/40 text-rose-300' : 'border-emerald-900 bg-emerald-950/40 text-emerald-300'}`}>{notice.text}</div>}
    <nav className="admin-tabs">{tabs.map(item => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'active' : ''}>{item}{item === 'Reports' && reportCount > 0 ? <b>{reportCount}</b> : null}</button>)}</nav>
    {loading ? <div className="admin-loading">Loading dashboard…</div> : tab === 'Overview' ? <AdminOverview chapters={sorted} comments={comments} reports={reports} ratings={ratings} views={views} likes={likes} pageCounts={pageCounts} onTab={setTab} chapterName={chapterName} /> : tab === 'Pal Do Pal Ke Lamhe' ? <PalDoPalAdmin /> : tab === 'Pages' ? <section className="admin-stack">
      <section className="admin-card">
        <div className="admin-card-title">
          <div>
            <span>PAGE EDITOR</span>
            <h2>Choose project</h2>
            <p>Switch between Atma Rekha and Pal Do Pal Ke Lamhe without leaving the page editor.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Page editor project">
          <button
            type="button"
            role="tab"
            aria-selected={pageEditorProject === 'atma'}
            onClick={() => setPageEditorProject('atma')}
            className={pageEditorProject === 'atma'
              ? 'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black'
              : 'rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold'}
          >
            Atma Rekha
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pageEditorProject === 'pdpkl'}
            onClick={() => setPageEditorProject('pdpkl')}
            className={pageEditorProject === 'pdpkl'
              ? 'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black'
              : 'rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold'}
          >
            Pal Do Pal Ke Lamhe (PDPKL)
          </button>
        </div>
      </section>
      {pageEditorProject === 'atma'
        ? <AdminChapterPages chapters={sorted} />
        : <PalDoPalAdmin embedded />}
    </section> : tab === 'Chapters' ? <section className="admin-stack"><section className="admin-card upload-card"><div className="admin-card-title"><div><span>{editing ? 'EDIT CHAPTER' : 'PUBLISHER'}</span><h2>{editing ? `Edit ${editing.chapterNumber ? `Chapter ${editing.chapterNumber}` : 'Unnumbered Entry'}` : 'Upload a chapter'}</h2><p>Select all manga pages at once. Their selected order will be preserved exactly during upload.</p></div>{editing && <button onClick={resetForm}>Cancel</button>}</div><form onSubmit={saveChapter} className="admin-form"><div className="admin-form-grid"><input type="number" min="1" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="Chapter number (optional)"/><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Published</option><option>Pre-uploaded</option><option>Draft</option></select><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Chapter title" required className="wide"/><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="3" className="wide"/><label>Release date<input type="datetime-local" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })}/></label><label>Cover image<input type="file" accept="image/*" onChange={e => setForm({ ...form, cover: e.target.files?.[0] || null })}/></label></div><label className="admin-dropzone"><strong>Manga pages</strong><span>Select pages in the exact order you want them published. Filename sorting is disabled.</span><input type="file" multiple accept="image/*" onChange={choosePages}/>{form.pages.length > 0 && <em>{form.pages.length} pages ready · selected order preserved</em>}</label>{progress.total > 0 && <div className="admin-progress"><div><span>{progress.text}</span><b>{progress.current}/{progress.total}</b></div><i><span style={{ width: `${(progress.current / progress.total) * 100}%` }}/></i></div>}<button disabled={busy} className="admin-submit">{busy ? 'Working…' : editing ? 'Save chapter changes' : 'Upload chapter'}</button></form></section><section className="admin-card"><div className="admin-card-title"><div><span>LIBRARY</span><h2>All chapters</h2></div><button onClick={resetForm}>+ New chapter</button></div><div className="admin-chapter-list">{sorted.map(chapter => <article key={chapter.id}><div><div className="admin-status-line"><strong>{chapter.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'Unnumbered'}</strong><span>{chapter.status || 'Pre-uploaded'}</span></div><h3>{chapter.title || 'Untitled chapter'}</h3><p>{pageCounts[chapter.id] || 0} pages · {chapter.releaseDate ? new Date(chapter.releaseDate).toLocaleDateString('en-IN') : 'No release date'}</p></div><div className="admin-row-actions"><button onClick={() => editChapter(chapter)}>Edit</button><button className="danger" onClick={() => deleteChapter(chapter)} disabled={busy}>Delete</button></div></article>)}{!sorted.length && <p className="muted center">No chapters yet.</p>}</div></section></section> : tab === 'Comments' ? <section className="admin-card"><div className="admin-card-title"><div><span>MODERATION</span><h2>Comments</h2><p>{comments.length} total comments · replies included</p></div></div><div className="admin-comment-list">{comments.map(comment => <article key={comment.id}><div className="admin-comment-avatar">{(comment.author_name || 'R').slice(0, 1).toUpperCase()}</div><div><div className="admin-comment-meta"><strong>{comment.author_name || 'Reader'}</strong><span>{new Date(comment.created_at).toLocaleString('en-IN')}</span></div><p>{comment.content}</p><small>{chapterName(comment.chapter_id)}{comment.parent_comment_id ? ' · Reply' : ''}</small></div><button className="danger-text" onClick={() => deleteComment(comment.id)} disabled={busy}>Delete</button></article>)}{!comments.length && <p className="muted center">No comments yet.</p>}</div></section> : tab === 'Reports' ? <section className="admin-card">
      <div className="admin-card-title"><div><span>MODERATION</span><h2>Reported comments</h2><p>{reportCount} open report{reportCount === 1 ? '' : 's'} · {reports.length} recent report{reports.length === 1 ? '' : 's'} shown.</p></div></div>
      <div className="admin-report-list">{reports.map(report => {
        const comment = commentById(report.comment_id);
        const status = report.status || 'open';
        return <article key={report.id}>
          <div>
            <span className="report-label">REPORT · {status}</span>
            <strong>{comment?.author_name || 'Reader'}</strong>
            <p>{comment?.content || 'Comment unavailable'}</p>
            <small>{report.reason || 'Reported by reader'} · {new Date(report.created_at).toLocaleString('en-IN')}{report.reviewed_at ? ' · reviewed ' + new Date(report.reviewed_at).toLocaleString('en-IN') : ''}</small>
          </div>
          <div className="admin-row-actions">
            {comment && <button className="danger" onClick={() => deleteComment(comment.id)} disabled={busy}>Delete comment</button>}
            {status === 'open' && <button onClick={() => setReportStatus(report.id, 'reviewed')} disabled={busy}>Review</button>}
            {status !== 'resolved' && <button onClick={() => setReportStatus(report.id, 'resolved')} disabled={busy}>Resolve</button>}
            {status !== 'open' && <button onClick={() => setReportStatus(report.id, 'open')} disabled={busy}>Reopen</button>}
          </div>
        </article>;
      })}{!reports.length && <p className="muted center">No reports. Everything is clean.</p>}</div>
    </section> : tab === 'Announcements' ? <section className="admin-stack">
      <form onSubmit={saveAnnouncement} className="admin-card admin-form">
        <div className="admin-card-title">
          <div><span>CONTENT</span><h2>Announcements</h2><p>{editingAnnouncementId ? 'Edit an existing announcement without losing its record.' : 'Publish up to 10 announcements. The oldest is automatically removed when an 11th is published.'}</p></div>
          {editingAnnouncementId && <button type="button" onClick={cancelAnnouncementEdit}>Cancel edit</button>}
        </div>
        <input value={announcement.title} onChange={e => setAnnouncement({ ...announcement, title: e.target.value })} placeholder="Title (optional for image-only update)"/>
        <textarea value={announcement.content} onChange={e => setAnnouncement({ ...announcement, content: e.target.value })} placeholder="Text (optional for image-only update)" rows="5"/>
        <label className="admin-file-field"><span>Thumbnail / image (optional)</span><input type="file" accept="image/*" onChange={e => setAnnouncement({ ...announcement, thumbnail: e.target.files?.[0] || null })}/>{announcement.thumbnail && <em>{announcement.thumbnail.name}</em>}</label>
        <label className="check-row"><input type="checkbox" checked={announcement.is_pinned} onChange={e => setAnnouncement({ ...announcement, is_pinned: e.target.checked })}/> Pin announcement</label>
        <p className="admin-form-hint">No thumbnail → title/text card. Thumbnail + text → image with title/text. Thumbnail only → image-only card. Editing keeps the existing image unless you choose a replacement.</p>
        <button className="admin-submit" disabled={busy}>{busy ? (editingAnnouncementId ? 'Saving…' : 'Publishing…') : (editingAnnouncementId ? 'Save announcement changes' : 'Publish announcement')}</button>
      </form>
      <div className="admin-card">
        <div className="admin-card-title"><div><span>PUBLISHED</span><h2>Announcements <small>Max 10</small></h2></div></div>
        <div className="admin-mini-list">{announcements.map(item => <div key={item.id}>
          <div className="admin-announcement-admin-row">{item.image_url && <img src={item.image_url} alt="" loading="lazy"/>}<div><strong>{item.title?.startsWith('__image_only_') ? 'Image-only announcement' : item.title || 'Announcement'}</strong><p>{item.content || (item.image_url ? 'Image-only announcement' : '')}</p><small>{new Date(item.published_at || item.created_at).toLocaleString('en-IN')}</small></div></div>
          <div className="admin-row-actions"><button onClick={() => editAnnouncement(item)} disabled={busy}>Edit</button><button className="danger-text" onClick={() => deleteAnnouncement(item)} disabled={busy}>Delete</button></div>
        </div>)}</div>
        {!announcements.length && <p className="muted center">No announcements yet.</p>}
      </div>
    </section> : <section className="admin-stack"><form onSubmit={saveMedia} className="admin-card admin-form"><div className="admin-card-title"><div><span>CONTENT</span><h2>Media library</h2></div></div><div className="admin-form-grid"><input value={mediaForm.title} onChange={e => setMediaForm({ ...mediaForm, title: e.target.value })} placeholder="Title" required/><input value={mediaForm.category} onChange={e => setMediaForm({ ...mediaForm, category: e.target.value })} placeholder="Category" required/><input value={mediaForm.image_url} onChange={e => setMediaForm({ ...mediaForm, image_url: e.target.value })} placeholder="Image URL" required className="wide"/></div><button className="admin-submit" disabled={busy}>Add media</button></form><div className="admin-media-grid">{media.map(item => <article key={item.id}>{item.image_url && <img src={item.image_url} alt="" loading="lazy"/>}<div><strong>{item.title}</strong><span>{item.category}</span><button className="danger-text" onClick={() => deleteMedia(item.id)}>Delete</button></div></article>)}</div></section>}
  </div></main>;
}
