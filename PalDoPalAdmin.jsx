import { useEffect, useMemo, useRef, useState } from 'react';
import { getAdminRole } from './adminAuth';
import { supabase } from './supabase';
import { buildPdlplChapters, PDLPL_CHAPTERS, PDLPL_PAGES } from './palDoPalKeLamhe';
import { fetchPdlplMedia, removePdlplFiles, uploadPdlplFile } from './pdlplR2';
import './pal-do-pal-ke-lamhe.css';

const MAX_PAGE_SIZE = 20 * 1024 * 1024;

const emptyForm = () => ({
  number: '',
  title: '',
  description: '',
  status: 'Draft',
  releaseDate: '',
  cover: null,
  pages: [],
});

const label = chapter => chapter?.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'Special';

function safeExt(file, fallback = 'webp') {
  const ext = String(file?.name || '').split('.').pop()?.toLowerCase() || fallback;
  return /^[a-z0-9]+$/.test(ext) ? ext : fallback;
}

function pagePath(chapterId, revision, file, index) {
  return `chapters/${chapterId}/pages/${revision}/${String(index + 1).padStart(4, '0')}.${safeExt(file)}`;
}

function coverPath(chapterId, file) {
  return `covers/chapters/${chapterId}/cover-${Date.now()}.${safeExt(file)}`;
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


function PagePreview({ path }) {
  const holder = useRef(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    let observer;

    const load = async () => {
      try {
        objectUrl = await fetchPdlplMedia(path);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch (err) {
        if (active) setError(err?.message || 'Preview unavailable.');
      }
    };

    if (typeof IntersectionObserver === 'undefined') {
      load();
    } else {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      }, { rootMargin: '300px' });
      if (holder.current) observer.observe(holder.current);
    }

    return () => {
      active = false;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return <div ref={holder} className="pdlpl-page-preview">
    {url ? <img src={url} alt="" loading="lazy" /> : error ? <span>{error}</span> : <span>Loading preview…</span>}
  </div>;
}

export default function PalDoPalAdmin({ embedded = false }) {
  const [role, setRole] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [pageCounts, setPageCounts] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [selectedPages, setSelectedPages] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [query, setQuery] = useState('');
  const [savingStatus, setSavingStatus] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in required.');
      const adminRole = await getAdminRole(user.id);
      if (!adminRole) throw new Error('Admin access required.');

      const [rows, pagesResult] = await Promise.all([
        buildPdlplChapters(),
        supabase.from(PDLPL_PAGES).select('id,chapter_id,page_number,image_path').order('page_number', { ascending: true }),
      ]);
      if (pagesResult.error) throw pagesResult.error;

      const counts = {};
      for (const row of pagesResult.data || []) counts[row.chapter_id] = (counts[row.chapter_id] || 0) + 1;

      setRole(adminRole);
      setChapters(rows);
      setPageCounts(counts);
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } catch (error) {
      setRole(null);
      setNotice(error?.message || 'Unable to load side story admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadPages = async id => {
    if (!id) {
      setSelectedPages([]);
      return;
    }
    const { data, error } = await supabase
      .from(PDLPL_PAGES)
      .select('id,chapter_id,page_number,image_path')
      .eq('chapter_id', id)
      .order('page_number', { ascending: true });

    if (error) setNotice(error.message);
    else setSelectedPages(data || []);
  };

  useEffect(() => { loadPages(selectedId); }, [selectedId]);

  const sorted = useMemo(
    () => [...chapters]
      .filter(chapter => {
        const needle = query.trim().toLowerCase();
        if (!needle) return true;
        return [chapter.title, chapter.description, chapter.status, chapter.chapterNumber]
          .some(value => String(value ?? '').toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        const an = Number(a.chapterNumber); const bn = Number(b.chapterNumber);
        if (!Number.isFinite(an) && !Number.isFinite(bn)) return 0;
        if (!Number.isFinite(an)) return 1;
        if (!Number.isFinite(bn)) return -1;
        return an - bn;
      }),
    [chapters, query],
  );

  const appendPages = async filesInput => {
    const files = Array.from(filesInput || []).filter(file => file.type.startsWith('image/'));
    if (!files.length || !selectedChapter || busy) return;
    const tooLarge = files.find(file => file.size > MAX_PAGE_SIZE);
    if (tooLarge) { setNotice(`${tooLarge.name} is larger than 20 MB.`); return; }
    setBusy(true); setNotice('');
    const uploaded = [];
    try {
      const revision = Date.now();
      const rows = selectedPages.map(page => ({ page_number: page.page_number, image_path: page.image_path }));
      for (let i = 0; i < files.length; i += 1) {
        const path = pagePath(selectedChapter.id, revision, files[i], rows.length);
        await uploadPdlplFile(files[i], path);
        uploaded.push(path);
        rows.push({ page_number: rows.length + 1, image_path: path });
        setProgress({ current: i + 1, total: files.length, text: `Adding page ${i + 1} of ${files.length}…` });
      }
      const { error } = await supabase.rpc('pdlpl_replace_chapter_pages', { p_chapter_id: selectedChapter.id, p_pages: rows });
      if (error) throw error;
      await loadPages(selectedChapter.id);
      await load();
      setNotice(`${files.length} page${files.length === 1 ? '' : 's'} added to ${label(selectedChapter)}.`);
    } catch (error) {
      for (const path of uploaded) { try { await removePdlplFiles([path]); } catch (_) {} }
      setNotice(error?.message || 'Adding pages failed.');
    } finally {
      setBusy(false); setProgress({ current: 0, total: 0, text: '' });
    }
  };

  const setChapterStatus = async (chapter, status) => {
    if (!chapter || busy || savingStatus) return;
    setSavingStatus(chapter.id); setNotice('');
    try {
      const { error } = await supabase.from(PDLPL_CHAPTERS).update({ status }).eq('id', chapter.id);
      if (error) throw error;
      await load();
      setNotice(`${label(chapter)} is now ${status.toLowerCase()}.`);
    } catch (error) {
      setNotice(error?.message || 'Status update failed.');
    } finally { setSavingStatus(null); }
  };

  const choosePages = event => {
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'));
    const tooLarge = files.find(file => file.size > MAX_PAGE_SIZE);
    if (tooLarge) {
      event.target.value = '';
      setNotice(`${tooLarge.name} is larger than 20 MB.`);
      return;
    }
    setForm(value => ({ ...value, pages: files }));
  };

  const reset = () => {
    setEditing(null);
    setForm(emptyForm());
    setProgress({ current: 0, total: 0, text: '' });
  };

  const saveChapter = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice('');

    let chapterId = editing?.id || null;
    const uploaded = [];
    let oldPagePaths = [];
    const oldCoverPath = editing?.coverPath || null;
    let pendingCoverPath = null;
    let coverCommitted = false;
    let pagesCommitted = false;
    const wasEditing = Boolean(editing);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !await getAdminRole(user.id)) throw new Error('Admin access required.');

      const rawNumber = String(form.number || '').trim();
      const number = rawNumber === '' ? null : Number(rawNumber);
      if (number !== null && (!Number.isInteger(number) || number < 1)) throw new Error('Enter a valid chapter number.');
      if (!form.title.trim()) throw new Error('Chapter title is required.');
      if (!wasEditing && !form.pages.length) throw new Error('Select at least one page for a new chapter.');

      const payload = {
        chapter_number: number,
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        release_date: form.releaseDate ? new Date(form.releaseDate).toISOString() : null,
      };

      if (wasEditing) {
        const { error } = await supabase.from(PDLPL_CHAPTERS).update(payload).eq('id', editing.id);
        if (error) throw error;

        const oldPagesResult = await supabase
          .from(PDLPL_PAGES)
          .select('image_path')
          .eq('chapter_id', editing.id);
        if (oldPagesResult.error) throw oldPagesResult.error;
        oldPagePaths = (oldPagesResult.data || []).map(row => row.image_path).filter(Boolean);
      } else {
        const { data, error } = await supabase
          .from(PDLPL_CHAPTERS)
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        chapterId = data.id;
      }

      if (form.cover) {
        pendingCoverPath = coverPath(chapterId, form.cover);
        await uploadPdlplFile(form.cover, pendingCoverPath);
        uploaded.push(pendingCoverPath);
      }

      if (form.pages.length) {
        const revision = Date.now();
        const rows = [];
        setProgress({ current: 0, total: form.pages.length, text: 'Uploading manga pages…' });

        for (let i = 0; i < form.pages.length; i += 1) {
          const file = form.pages[i];
          const path = pagePath(chapterId, revision, file, i);
          await uploadPdlplFile(file, path);
          uploaded.push(path);
          rows.push({ page_number: i + 1, image_path: path });
          setProgress({
            current: i + 1,
            total: form.pages.length,
            text: `Uploaded page ${i + 1} of ${form.pages.length}`,
          });
        }

        const { error: pageSaveError } = await supabase.rpc('pdlpl_replace_chapter_pages', {
          p_chapter_id: chapterId,
          p_pages: rows,
        });
        if (pageSaveError) throw pageSaveError;
        pagesCommitted = true;

        setSelectedPages(rows.map((row, index) => ({
          id: `pending-${index}`,
          chapter_id: chapterId,
          page_number: row.page_number,
          image_path: row.image_path,
        })));

        if (oldPagePaths.length) {
          try {
            await removePdlplFiles(oldPagePaths);
          } catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', 'pdlpl_chapter_pages', chapterId, {
              provider: 'pdpl',
              paths: oldPagePaths,
              error: cleanupError.message,
            });
          }
        }
      }

      if (pendingCoverPath) {
        const { error: coverSaveError } = await supabase
          .from(PDLPL_CHAPTERS)
          .update({ cover_path: pendingCoverPath })
          .eq('id', chapterId);
        if (coverSaveError) throw coverSaveError;
        coverCommitted = true;

        if (oldCoverPath) {
          try {
            await removePdlplFiles([oldCoverPath]);
          } catch (cleanupError) {
            await logAdminAction(adminUser, 'r2_cleanup_failed', 'pdlpl_cover', chapterId, {
              provider: 'pdpl',
              paths: [oldCoverPath],
              error: cleanupError.message,
            });
          }
        }
      }

      reset();
      await load();
      setNotice(`${label({ chapterNumber: number })} ${wasEditing ? 'updated' : 'created'}.`);
    } catch (error) {
      if (!wasEditing && chapterId) {
        try {
          await supabase.from(PDLPL_CHAPTERS).delete().eq('id', chapterId);
        } catch (_) {}
      }

      for (const path of uploaded) {
        const shouldKeep = wasEditing && (
          (pagesCommitted && path.includes(`/pages/`)) ||
          (coverCommitted && path === pendingCoverPath)
        );
        if (shouldKeep) continue;
        try { await removePdlplFiles([path]); } catch (_) {}
      }

      setNotice(error?.message || 'Chapter save failed. Uploaded files that were not committed were cleaned up.');
      setProgress({ current: 0, total: 0, text: '' });

      if (wasEditing && pendingCoverPath && !coverCommitted) {
        // Keep the previous cover reference untouched if switching to the new cover failed.
        try {
          await supabase.from(PDLPL_CHAPTERS).update({ cover_path: oldCoverPath }).eq('id', chapterId);
        } catch (_) {}
      }
    } finally {
      setBusy(false);
    }
  };

  const edit = chapter => {
    setEditing(chapter);
    setForm({
      number: chapter.chapterNumber ?? '',
      title: chapter.title,
      description: chapter.description,
      status: chapter.status || 'Draft',
      releaseDate: chapter.releaseDate ? new Date(chapter.releaseDate).toISOString().slice(0, 16) : '',
      cover: null,
      pages: [],
    });
    setSelectedId(chapter.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteChapter = async chapter => {
    if (busy || !window.confirm('Delete ' + label(chapter) + ' and all its pages and cover?')) return;
    setBusy(true);
    setNotice('');
    let adminUser = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !await getAdminRole(user.id)) throw new Error('Admin access required.');
      adminUser = user;

      const pagesResult = await supabase
        .from(PDLPL_PAGES)
        .select('image_path')
        .eq('chapter_id', chapter.id);
      if (pagesResult.error) throw pagesResult.error;

      const { error } = await supabase.from(PDLPL_CHAPTERS).delete().eq('id', chapter.id);
      if (error) throw error;

      const paths = (pagesResult.data || []).map(row => row.image_path).filter(Boolean);
      if (chapter.coverPath) paths.push(chapter.coverPath);

      let cleanupPending = false;
      if (paths.length) {
        try {
          await removePdlplFiles(paths);
        } catch (cleanupError) {
          cleanupPending = true;
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'pdlpl_chapter', chapter.id, {
            provider: 'pdpl',
            paths,
            error: cleanupError.message,
          });
        }
      }

      await logAdminAction(adminUser, 'delete_pdlpl_chapter', 'pdlpl_chapter', chapter.id, {
        chapter_number: chapter.chapterNumber,
        title: chapter.title,
        cleanup_pending: cleanupPending,
      });

      if (selectedId === chapter.id) {
        setSelectedId('');
        setSelectedPages([]);
      }
      await load();
      setNotice(cleanupPending
        ? label(chapter) + ' deleted. Some R2 files need cleanup retry in Operations.'
        : label(chapter) + ' deleted.');
    } catch (error) {
      await logAdminAction(adminUser, 'delete_pdlpl_chapter_failed', 'pdlpl_chapter', chapter.id, { error: error.message });
      setNotice(error?.message || 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };


  const replacePage = async (page, file) => {
    if (!file || busy) return;
    if (!file.type.startsWith('image/')) { setNotice('Please select an image.'); return; }
    if (file.size > MAX_PAGE_SIZE) { setNotice(file.name + ' is larger than 20 MB.'); return; }

    setBusy(true);
    setNotice('');
    const path = 'chapters/' + page.chapter_id + '/replacements/' + page.id + '-' + Date.now() + '.' + safeExt(file);
    let adminUser = null;
    let databaseCommitted = false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !await getAdminRole(user.id)) throw new Error('Admin access required.');
      adminUser = user;

      await uploadPdlplFile(file, path);
      const { error } = await supabase
        .from(PDLPL_PAGES)
        .update({ image_path: path })
        .eq('id', page.id);
      if (error) throw error;
      databaseCommitted = true;

      let cleanupPending = false;
      if (page.image_path) {
        try {
          await removePdlplFiles([page.image_path]);
        } catch (cleanupError) {
          cleanupPending = true;
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'pdlpl_page', page.id, {
            provider: 'pdpl',
            paths: [page.image_path],
            error: cleanupError.message,
          });
        }
      }

      setSelectedPages(current => current.map(item => item.id === page.id ? { ...item, image_path: path } : item));
      await logAdminAction(adminUser, 'replace_pdlpl_page', 'pdlpl_page', page.id, {
        chapter_id: page.chapter_id,
        page_number: page.page_number,
        file_name: file.name,
        cleanup_pending: cleanupPending,
      });
      setNotice(cleanupPending
        ? 'Page ' + page.page_number + ' replaced. Old R2 cleanup is pending in Operations.'
        : 'Page ' + page.page_number + ' replaced successfully.');
    } catch (error) {
      if (path && !databaseCommitted) {
        try { await removePdlplFiles([path]); } catch (cleanupError) {
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'pdlpl_page', page.id, {
            provider: 'pdpl',
            paths: [path],
            error: cleanupError.message,
          });
        }
      }
      await logAdminAction(adminUser, 'replace_pdlpl_page_failed', 'pdlpl_page', page.id, {
        chapter_id: page.chapter_id,
        page_number: page.page_number,
        file_name: file.name,
        error: error.message,
      });
      setNotice(error?.message || 'Page replacement failed. The original page remains active.');
    } finally {
      setBusy(false);
    }
  };


  const reorder = async (index, direction) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= selectedPages.length || busy) return;

    const a = selectedPages[index];
    const b = selectedPages[otherIndex];
    setBusy(true);
    setNotice('');

    try {
      let result = await supabase.from(PDLPL_PAGES).update({ page_number: 0 }).eq('id', a.id);
      if (result.error) throw result.error;
      result = await supabase.from(PDLPL_PAGES).update({ page_number: a.page_number }).eq('id', b.id);
      if (result.error) throw result.error;
      result = await supabase.from(PDLPL_PAGES).update({ page_number: b.page_number }).eq('id', a.id);
      if (result.error) throw result.error;
      await loadPages(selectedId);
    } catch (error) {
      setNotice(error?.message || 'Reorder failed.');
      await loadPages(selectedId);
    } finally {
      setBusy(false);
    }
  };

  const deletePage = async page => {
    if (busy || !window.confirm('Delete page ' + page.page_number + '?')) return;
    setBusy(true);
    setNotice('');
    let adminUser = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !await getAdminRole(user.id)) throw new Error('Admin access required.');
      adminUser = user;

      const { error } = await supabase.from(PDLPL_PAGES).delete().eq('id', page.id);
      if (error) throw error;

      let cleanupPending = false;
      if (page.image_path) {
        try { await removePdlplFiles([page.image_path]); }
        catch (cleanupError) {
          cleanupPending = true;
          await logAdminAction(adminUser, 'r2_cleanup_failed', 'pdlpl_page', page.id, {
            provider: 'pdpl',
            paths: [page.image_path],
            error: cleanupError.message,
          });
        }
      }

      const remaining = selectedPages.filter(item => item.id !== page.id);
      for (let i = 0; i < remaining.length; i += 1) {
        if (remaining[i].page_number !== i + 1) {
          const result = await supabase.from(PDLPL_PAGES).update({ page_number: i + 1 }).eq('id', remaining[i].id);
          if (result.error) throw result.error;
        }
      }

      await logAdminAction(adminUser, 'delete_pdlpl_page', 'pdlpl_page', page.id, {
        chapter_id: page.chapter_id,
        page_number: page.page_number,
        cleanup_pending: cleanupPending,
      });
      await loadPages(selectedId);
      setPageCounts(current => ({ ...current, [page.chapter_id]: Math.max(0, (current[page.chapter_id] || 1) - 1) }));
      setNotice(cleanupPending
        ? 'Page ' + page.page_number + ' deleted. R2 cleanup is pending in Operations.'
        : 'Page ' + page.page_number + ' deleted.');
    } catch (error) {
      await logAdminAction(adminUser, 'delete_pdlpl_page_failed', 'pdlpl_page', page.id, { error: error.message });
      setNotice(error?.message || 'Delete page failed.');
      await loadPages(selectedId);
    } finally {
      setBusy(false);
    }
  };



  const Root = embedded ? 'section' : 'main';
  const rootClass = embedded ? 'pdlpl-admin-embedded' : 'pdlpl-admin';

  if (loading) return <Root className={rootClass}><div className="pdlpl-loading">Checking side story admin…</div></Root>;
  if (!role) return <Root className={rootClass}><div className="pdlpl-error"><h2>Access denied</h2><p>{notice || 'Admin access required.'}</p><button type="button" onClick={() => { window.location.hash = 'admin'; }}>Back to Admin</button></div></Root>;

  const selectedChapter = chapters.find(item => item.id === selectedId) || null;

  return <Root className={rootClass}>
    {!embedded && <header className="pdlpl-admin-header">
      <div>
        <button type="button" onClick={() => { window.location.hash = 'admin'; }}>←</button>
        <div><span>SIDE STORY ADMIN</span><h1>Pal Do Pal Ke Lamhe</h1><p>Cloudflare R2 media · separate PDPL metadata.</p></div>
      </div>
      <div className="pdlpl-admin-header-actions"><button type="button" onClick={() => { window.location.hash = 'admin'; }}>Admin Dashboard</button><button type="button" className="pdlpl-admin-home" onClick={() => { window.location.hash = PDLPL_ROUTE; }}>View Side Story</button></div>
    </header>}

    {embedded && <div className="pdlpl-embedded-heading"><div><span>PAL DO PAL KE LAMHE</span><h2>Side Story Upload & Management</h2><p>Separate chapters, pages, and Cloudflare R2 media.</p></div><div className="pdlpl-admin-header-actions"><button type="button" onClick={load} disabled={loading || busy}>Refresh</button><button type="button" onClick={() => { window.location.hash = 'pal-do-pal-admin'; }}>Open full manager</button><button type="button" onClick={() => { window.location.hash = PDLPL_ROUTE; }}>View public side story</button></div></div>}

    <section className="pdlpl-admin-layout">
      <form id="pdlpl-upload-chapter" className="pdlpl-admin-card pdlpl-form" onSubmit={saveChapter}>
        <div className="pdlpl-admin-card-head">
          <div><span>CHAPTER SETUP</span><h2>{editing ? 'Edit chapter' : 'Create chapter'}</h2></div>
          {editing && <button type="button" onClick={reset}>New chapter</button>}
        </div>

        <div className="pdlpl-form-grid">
          <label>Chapter number<input type="number" min="1" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} required /></label>
          <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Draft</option><option>Published</option><option>Archived</option></select></label>
        </div>

        <label>Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
        <label>Description<textarea rows="4" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <label>Release date<input type="datetime-local" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} /></label>

        <label className="pdlpl-file-input">
          Chapter cover
          <input type="file" accept="image/*" onChange={e => setForm({ ...form, cover: e.target.files?.[0] || null })} />
          {form.cover && <span>{form.cover.name}</span>}
        </label>

        <label className="pdlpl-file-input">
          Manga pages
          <input type="file" accept="image/*" multiple onChange={choosePages} />
          {form.pages.length > 0 && <span>{form.pages.length} page(s) selected · selected order preserved</span>}
        </label>

        {progress.total > 0 && <>
          <div className="pdlpl-upload-progress"><div style={{ width: `${Math.round(progress.current / progress.total * 100)}%` }} /></div>
          <p className="pdlpl-muted">{progress.text}</p>
        </>}

        <p className="pdlpl-muted">All published chapters are members-only. Images never use Supabase Storage.</p>
        <button className="pdlpl-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save chapter' : 'Create chapter'}</button>
      </form>

      <section className="pdlpl-admin-card">
        <div className="pdlpl-admin-card-head"><div><span>CHAPTERS</span><h2>{chapters.length} total</h2><p>{chapters.filter(chapter => String(chapter.status).toLowerCase() === 'published').length} published · {chapters.filter(chapter => String(chapter.status).toLowerCase() === 'draft').length} drafts · {chapters.filter(chapter => String(chapter.status).toLowerCase() === 'archived').length} archived</p></div><div className="pdlpl-admin-list-tools"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search chapters…" aria-label="Search PDPL chapters"/><button type="button" onClick={load} disabled={loading || busy}>Refresh</button></div></div>
        <div className="pdlpl-admin-list">
          {sorted.map(chapter => <article key={chapter.id} className={chapter.id === selectedId ? 'active' : ''}>
            <button type="button" onClick={() => setSelectedId(chapter.id)}>
              <strong>{label(chapter)}</strong>
              <span>{chapter.title || 'Untitled chapter'}</span>
              <small>{chapter.status} · {pageCounts[chapter.id] || 0} pages</small>
            </button>
            <div>
              <button type="button" onClick={() => edit(chapter)}>Edit</button>
              {String(chapter.status).toLowerCase() !== 'published' && <button type="button" onClick={() => setChapterStatus(chapter, 'Published')} disabled={busy || savingStatus === chapter.id}>Publish</button>}
              {String(chapter.status).toLowerCase() === 'published' && <button type="button" onClick={() => setChapterStatus(chapter, 'Draft')} disabled={busy || savingStatus === chapter.id}>Unpublish</button>}
              <button type="button" onClick={() => { window.location.hash = `${PDLPL_ROUTE}/read/${encodeURIComponent(chapter.id)}`; }}>View</button>
              <button type="button" onClick={() => deleteChapter(chapter)} disabled={busy}>Delete</button>
            </div>
          </article>)}
          {!sorted.length && <p className="pdlpl-muted">No chapters yet.</p>}
        </div>
      </section>
    </section>

    {selectedChapter && <section className="pdlpl-admin-card pdlpl-page-manager">
      <div className="pdlpl-admin-card-head">
        <div><span>PAGE MANAGER · INDIVIDUAL PAGES</span><h2>{label(selectedChapter)} · {selectedChapter.title}</h2><p>Manage individual pages: preview, replace, add, reorder, or delete one page without re-uploading the whole chapter.</p></div><div className="pdlpl-admin-header-actions"><label className="pdlpl-inline-file">Add pages<input type="file" accept="image/*" multiple disabled={busy} onChange={e => { const files = e.target.files; e.target.value = ''; appendPages(files); }} /></label><button type="button" onClick={() => loadPages(selectedId)} disabled={busy}>Refresh pages</button><button type="button" onClick={() => { window.location.hash = `${PDLPL_ROUTE}/read/${encodeURIComponent(selectedChapter.id)}`; }}>Preview chapter</button></div>
      </div>

      {!selectedPages.length
        ? <p className="pdlpl-muted">No pages uploaded.</p>
        : <div className="pdlpl-admin-pages">
          {selectedPages.map((page, index) => <article key={page.id}>
            <PagePreview path={page.image_path} />
            <div className="pdlpl-page-head"><strong>Page {page.page_number}</strong><span>{index + 1}/{selectedPages.length}</span></div>
            <p className="pdlpl-page-path">{page.image_path}</p>
            <div className="pdlpl-page-actions">
              <label>Replace<input type="file" accept="image/*" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; replacePage(page, file); }} /></label>
              <button type="button" disabled={busy || index === 0} onClick={() => reorder(index, -1)}>↑</button>
              <button type="button" disabled={busy || index === selectedPages.length - 1} onClick={() => reorder(index, 1)}>↓</button>
              <button type="button" className="danger" disabled={busy} onClick={() => deletePage(page)}>Delete</button>
            </div>
          </article>)}
        </div>}
    </section>}

    {notice && <div className="pdlpl-notice">{notice}</div>}
  </Root>;
}
