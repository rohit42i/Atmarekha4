import { useEffect, useMemo, useRef, useState } from 'react';
import { getAdminRole } from './adminAuth';
import { supabase } from './supabase';
import { normalizeChapterLanguage, chapterLanguageLabel } from './chapters';
import { buildPdlplChapters, PDLPL_CHAPTERS, PDLPL_PAGES, PDLPL_ROUTE } from './palDoPalKeLamhe';
import { fetchPdlplMedia, removePdlplFiles, uploadPdlplFile } from './pdlplR2';
import './pal-do-pal-ke-lamhe.css';

const MAX_PAGE_SIZE = 95 * 1024 * 1024;

const emptyForm = () => ({
  number: '',
  language: 'hi',
  title: '',
  description: '',
  status: 'Published',
  releaseDate: '',
  cover: null,
  pages: [],
});

const label = chapter => chapter?.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'Special';
const PDLPL_STATUS_RPC = 'pdlpl_set_chapter_status';
// Publish through the guarded RPC, then verify the exact persisted row before refreshing the admin list.

function safeExt(file, fallback = 'webp') {
  const ext = String(file?.name || '').split('.').pop()?.toLowerCase() || fallback;
  return /^[a-z0-9]+$/.test(ext) ? ext : fallback;
}

const IMAGE_MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif',
};

function isImageFile(file) {
  if (!(file instanceof File)) return false;
  if (String(file.type || '').toLowerCase().startsWith('image/')) return true;
  return Boolean(IMAGE_MIME_BY_EXT[safeExt(file, '').toLowerCase()]);
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

function diagnosticFromError(stage, error, extra = {}) {
  const source = error || {};
  return {
    stage,
    code: source.code || source.status || '',
    message: source.message || String(source),
    details: source.details || '',
    hint: source.hint || '',
    name: source.name || '',
    statusText: source.statusText || '',
    path: source.path || '',
    url: source.url || '',
    responseBody: source.responseBody || '',
    ...extra,
  };
}

function diagnosticText(diagnostic) {
  if (!diagnostic) return '';
  return [
    `Stage: ${diagnostic.stage}`,
    diagnostic.code ? `Code/HTTP: ${diagnostic.code}` : '',
    diagnostic.message ? `Message: ${diagnostic.message}` : '',
    diagnostic.details ? `Details: ${diagnostic.details}` : '',
    diagnostic.hint ? `Hint: ${diagnostic.hint}` : '',
    diagnostic.name ? `Name: ${diagnostic.name}` : '',
    diagnostic.statusText ? `HTTP status: ${diagnostic.statusText}` : '',
    diagnostic.path ? `Path: ${diagnostic.path}` : '',
    diagnostic.url ? `URL: ${diagnostic.url}` : '',
    diagnostic.responseBody ? `Response body: ${diagnostic.responseBody}` : '',
    diagnostic.chapterId ? `Chapter ID: ${diagnostic.chapterId}` : '',
    diagnostic.mode ? `Mode: ${diagnostic.mode}` : '',
    diagnostic.status ? `Status: ${diagnostic.status}` : '',
    diagnostic.language ? `Language: ${diagnostic.language}` : '',
    diagnostic.pageCount != null ? `Pages: ${diagnostic.pageCount}` : '',
    diagnostic.selectedFiles?.length ? `Selected files: ${diagnostic.selectedFiles.join(', ')}` : '',
    diagnostic.uploadedPaths?.length ? `Uploaded paths: ${diagnostic.uploadedPaths.join(' | ')}` : '',
    diagnostic.cleanup ? `Cleanup: ${diagnostic.cleanup}` : '',
  ].filter(Boolean).join('\n');
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
  const [retryFiles, setRetryFiles] = useState({});
  const [diagnostic, setDiagnostic] = useState(null);

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
      setDiagnostic(null);
      setChapters(rows);
      setPageCounts(counts);
      const nextSelectedId = selectedId && rows.some(row => row.id === selectedId)
        ? selectedId
        : (rows[0]?.id || '');
      setSelectedId(nextSelectedId);
      if (!nextSelectedId) setSelectedPages([]);
    } catch (error) {
      setRole(null);
      setDiagnostic(diagnosticFromError('Loading PDPKL admin data', error));
      setNotice('PDPKL admin load failed. See the exact diagnostic below.');
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

    if (error) {
      setDiagnostic(diagnosticFromError('Loading chapter pages from Supabase', error, { chapterId: id }));
      setNotice('PDPKL page load failed. See the exact diagnostic below.');
    } else {
      setDiagnostic(null);
      setSelectedPages(data || []);
    }
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
    const files = Array.from(filesInput || []).filter(isImageFile);
    if (!files.length || !selectedChapter || busy) return;
    const tooLarge = files.find(file => file.size > MAX_PAGE_SIZE);
    if (tooLarge) {
      setDiagnostic(diagnosticFromError('Validating selected pages', new Error(tooLarge.name + ' is larger than 95 MB.'), { file: tooLarge.name }));
      setNotice('PDPKL page operation failed. See the Upload diagnostic panel for the exact error.');
      return;
    }

    setBusy(true);
    setNotice('');
    setDiagnostic(null);
    const uploaded = [];
    let databaseCommitted = false;
    let stage = 'Preparing page upload';

    try {
      const revision = Date.now();
      for (let i = 0; i < files.length; i += 1) {
        stage = 'Uploading page ' + (i + 1) + ' of ' + files.length + ' to Cloudflare R2';
        const path = pagePath(selectedChapter.id, revision, files[i], i);
        await uploadPdlplFile(files[i], path);
        uploaded.push(path);
        setProgress({ current: i + 1, total: files.length, text: 'Adding page ' + (i + 1) + ' of ' + files.length + '…' });
      }

      stage = 'Saving page records to Supabase';
      const { error } = await supabase.rpc('pdlpl_append_chapter_pages', {
        p_chapter_id: selectedChapter.id,
        p_pages: uploaded.map(image_path => ({ image_path })),
      });
      if (error) throw error;
      databaseCommitted = true;

      stage = 'Verifying saved pages';
      await Promise.all([loadPages(selectedChapter.id), load()]);
      const { data: { user } } = await supabase.auth.getUser();
      await logAdminAction(user, 'append_pdlpl_pages', 'pdlpl_chapter', selectedChapter.id, { count: files.length });
      setNotice(files.length + ' page' + (files.length === 1 ? '' : 's') + ' added to ' + label(selectedChapter) + '.');
    } catch (error) {
      const cleanupErrors = [];
      setDiagnostic(diagnosticFromError(stage, error, {
        chapterId: selectedChapter?.id,
        mode: 'Add pages',
        pageCount: files.length,
        uploadedPaths: uploaded,
      }));
      if (!databaseCommitted) {
        for (const uploadedPath of uploaded) {
          try { await removePdlplFiles([uploadedPath]); }
          catch (cleanupError) { cleanupErrors.push('R2 cleanup ' + uploadedPath + ': ' + (cleanupError?.message || cleanupError)); }
        }
      }
      setDiagnostic(diagnosticFromError(stage, error, {
        chapterId: selectedChapter?.id,
        pageCount: files.length,
        uploadedPaths: uploaded,
        cleanup: cleanupErrors.join(' | '),
      }));
      setNotice('PDPKL page operation failed at ' + stage + '. See the Upload diagnostic panel for the exact error.');    } finally {
      setBusy(false);
      setProgress({ current: 0, total: 0, text: '' });
    }
  };

  const setChapterStatus = async (chapter, status) => {
    if (!chapter || busy || savingStatus) return;
    setSavingStatus(chapter.id);
    setNotice('');
    setDiagnostic(null);
    let adminUser = null;
    let currentStage = 'Checking admin session';
    try {
      setDiagnostic(null);
      setProgress({ current: 0, total: 0, text: 'Checking admin session…' });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !await getAdminRole(user.id)) throw new Error('Admin access required.');
      adminUser = user;

      const requestedStatus = String(status || '').trim();
      const releaseDate = String(requestedStatus).toLowerCase() === 'published'
        ? (chapter.releaseDate || null)
        : null;

      currentStage = 'Saving chapter status in Supabase';
      const { data, error } = await supabase.rpc(PDLPL_STATUS_RPC, {
        p_chapter_id: chapter.id,
        p_status: requestedStatus,
        p_release_date: releaseDate ? new Date(releaseDate).toISOString() : null,
      });
      if (error) throw error;

      const saved = Array.isArray(data) ? data[0] : data;
      if (!saved || String(saved.status || '').toLowerCase() !== requestedStatus.toLowerCase()) {
        throw new Error('PDPKL status verification failed. The chapter was not saved.');
      }

      currentStage = 'Refreshing and verifying chapter status';
      await logAdminAction(user, 'change_pdlpl_status', 'pdlpl_chapter', chapter.id, {
        from: chapter.status,
        to: saved.status,
        release_date: saved.release_date,
      });
      await load();
      setDiagnostic(null);
      setNotice(label(chapter) + ' is now ' + String(saved.status).toLowerCase() + '.');
    } catch (error) {
      setDiagnostic(diagnosticFromError(currentStage, error, { chapterId: chapter.id, requestedStatus: status }));
      console.error('[PDPKL status]', { currentStage, chapterId: chapter.id, requestedStatus: status }, error);
      await logAdminAction(adminUser, 'change_pdlpl_status_failed', 'pdlpl_chapter', chapter.id, { status, error: error.message });
      setNotice('PDPKL status update failed at ' + currentStage + '. See the Upload diagnostic panel for the exact error.');
    } finally {
      setSavingStatus(null);
    }
  };



  const choosePages = event => {
    setDiagnostic(null);
    const files = Array.from(event.target.files || []).filter(isImageFile);
    const tooLarge = files.find(file => file.size > MAX_PAGE_SIZE);
    if (tooLarge) {
      event.target.value = '';
      setNotice(`${tooLarge.name} is larger than 95 MB.`);
      return;
    }
    setForm(value => ({ ...value, pages: files }));
  };

  const reset = () => {
    setDiagnostic(null);
    setEditing(null);
    setForm(emptyForm());
    setProgress({ current: 0, total: 0, text: '' });
  };

  const saveChapter = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice('');
    setDiagnostic(null);

    let chapterId = editing?.id || null;
    const uploaded = [];
    let oldPagePaths = [];
    const oldCoverPath = editing?.coverPath || null;
    let pendingCoverPath = null;
    let coverCommitted = false;
    let pagesCommitted = false;
    const wasEditing = Boolean(editing);
    let adminUser = null;
    let currentStage = 'Starting upload';
    let requestedStatus = String(form.status || '').trim();

    try {
      currentStage = 'Checking admin session';
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !await getAdminRole(user.id)) throw new Error('Admin access required.');
      adminUser = user;

      currentStage = 'Validating chapter form';
      currentStage = 'Validating chapter form';
      const rawNumber = String(form.number || '').trim();
      const number = rawNumber === '' ? null : Number(rawNumber);
      if (number !== null && (!Number.isInteger(number) || number < 1)) throw new Error('Enter a valid chapter number.');
      if (!form.title.trim()) throw new Error('Chapter title is required.');
      if (!wasEditing && !form.pages.length) throw new Error('Select at least one page for a new chapter.');
      if (String(form.status).trim().toLowerCase() === 'scheduled' && !form.releaseDate) {
        throw new Error('Scheduled chapters need a release date.');
      }

      const language = normalizeChapterLanguage(form.language);
      const duplicate = chapters.find(chapter => chapter.id !== editing?.id && normalizeChapterLanguage(chapter.language) === language && ((chapter.chapterNumber == null && number == null) || Number(chapter.chapterNumber) === number));
      if (duplicate) throw new Error((number == null ? 'Special / unnumbered entry' : 'Chapter ' + number) + ' already exists in ' + chapterLanguageLabel(language) + '. Edit that variant instead.');

      requestedStatus = String(form.status || '').trim();
      const isPublishing = requestedStatus.toLowerCase() === 'published';
      const currentStatus = wasEditing ? String(editing.status || 'Draft').trim() : 'Draft';
      const initialStatus = isPublishing && currentStatus.toLowerCase() !== 'published'
        ? (wasEditing ? currentStatus : 'Draft')
        : requestedStatus;
      const requestedReleaseDate = form.releaseDate
        ? new Date(form.releaseDate).toISOString()
        : null;

      currentStage = 'Generating chapter ID';
      currentStage = 'Generating chapter ID';
      chapterId = chapterId || window.crypto?.randomUUID?.();
      if (!chapterId) throw new Error('Could not generate a chapter ID. Please reload the page.');

      currentStage = 'Saving chapter metadata to Supabase';
      currentStage = 'Saving chapter metadata to Supabase';
      setProgress({ current: 0, total: 0, text: 'Saving chapter metadata…' });
      const { data: savedRows, error: metadataError } = await supabase.rpc('pdlpl_upsert_chapter', {
        p_chapter_id: chapterId,
        p_chapter_number: number,
        p_language: language,
        p_title: form.title.trim(),
        p_description: form.description.trim(),
        p_status: initialStatus,
        p_release_date: requestedReleaseDate,
      });
      if (metadataError) throw metadataError;

      const savedMetadata = Array.isArray(savedRows) ? savedRows[0] : savedRows;
      if (!savedMetadata?.id || savedMetadata.id !== chapterId) {
        throw new Error('PDPKL chapter metadata could not be verified.');
      }

      setSelectedId(chapterId);
      if (form.cover) {
        currentStage = 'Uploading cover to Cloudflare R2';
        currentStage = 'Uploading cover to Cloudflare R2';
        setProgress({ current: 0, total: 0, text: 'Uploading cover to Cloudflare R2…' });
        pendingCoverPath = coverPath(chapterId, form.cover);
        await uploadPdlplFile(form.cover, pendingCoverPath);
        uploaded.push(pendingCoverPath);
      }

      if (form.pages.length) {
        currentStage = 'Uploading manga pages to Cloudflare R2';
        const revision = Date.now();
        const rows = [];
        setProgress({ current: 0, total: form.pages.length, text: 'Uploading manga pages…' });

        for (let i = 0; i < form.pages.length; i += 1) {
          const file = form.pages[i];
          const path = 'chapters/' + chapterId + '/pages/' + language + '-' + revision + '/' + String(i + 1).padStart(4, '0') + '.' + safeExt(file);
          await uploadPdlplFile(file, path);
          uploaded.push(path);
          rows.push({ page_number: i + 1, image_path: path });
          setProgress({
            current: i + 1,
            total: form.pages.length,
            text: `Uploaded page ${i + 1} of ${form.pages.length}`,
          });
        }

        currentStage = 'Saving page records to Supabase';
        setProgress({ current: form.pages.length, total: form.pages.length, text: 'Saving manga page records…' });
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
        currentStage = 'Saving cover path in Supabase';
        setProgress({ current: 0, total: 0, text: 'Saving cover path in Supabase…' });
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

      if (isPublishing) {
        currentStage = 'Publishing chapter with Supabase';
        setProgress({ current: 0, total: 0, text: 'Publishing chapter…' });
        const { data, error } = await supabase.rpc(PDLPL_STATUS_RPC, {
          p_chapter_id: chapterId,
          p_status: 'Published',
          p_release_date: requestedReleaseDate,
        });
        if (error) throw error;

        const publishedRow = Array.isArray(data) ? data[0] : data;
        if (!publishedRow?.id || String(publishedRow.status || '').toLowerCase() !== 'published') {
          throw new Error('PDPKL publish verification failed. The chapter was not published.');
        }
      }

      currentStage = 'Verifying final chapter state in Supabase';
      setProgress({ current: 0, total: 0, text: 'Verifying saved chapter…' });
      const { data: verifiedChapter, error: verifyError } = await supabase
        .from(PDLPL_CHAPTERS)
        .select('id,status,release_date')
        .eq('id', chapterId)
        .single();
      if (verifyError) throw new Error('PDPKL publish verification failed: ' + verifyError.message);
      if (!verifiedChapter?.id || String(verifiedChapter.status || '').toLowerCase() !== requestedStatus.toLowerCase()) {
        throw new Error('PDPKL publish verification failed. Saved status does not match the selected status.');
      }

      reset();
      await load();
      setNotice(`${label({ chapterNumber: number })} ${wasEditing ? 'updated' : 'created'} and ${requestedStatus.toLowerCase()} successfully.`);
    } catch (error) {
      const cleanupErrors = [];
      if (!wasEditing && chapterId) {
        try { await supabase.from(PDLPL_CHAPTERS).delete().eq('id', chapterId); }
        catch (cleanupError) { cleanupErrors.push('Chapter rollback: ' + (cleanupError?.message || cleanupError)); }
      }
      for (const path of uploaded) {
        const shouldKeep = wasEditing && ((pagesCommitted && path.includes('/pages/')) || (coverCommitted && path === pendingCoverPath));
        if (shouldKeep) continue;
        try { await removePdlplFiles([path]); }
        catch (cleanupError) { cleanupErrors.push('R2 cleanup ' + path + ': ' + (cleanupError?.message || cleanupError)); }
      }
      if (wasEditing && pendingCoverPath && !coverCommitted) {
        try { await supabase.from(PDLPL_CHAPTERS).update({ cover_path: oldCoverPath }).eq('id', chapterId); }
        catch (cleanupError) { cleanupErrors.push('Cover rollback: ' + (cleanupError?.message || cleanupError)); }
      }
      setDiagnostic(diagnosticFromError(currentStage, error, {
        chapterId,
        mode: wasEditing ? 'Edit existing chapter' : 'Create new chapter',
        status: requestedStatus,
        language: form.language,
        pageCount: form.pages.length,
        selectedFiles: form.pages.map(file => file.name),
        uploadedPaths: uploaded,
        cleanup: cleanupErrors.join(' | '),
      }));
      setNotice('PDPKL upload failed at ' + currentStage + '. See the Upload diagnostic panel for the exact error.');
      setProgress({ current: 0, total: 0, text: '' });    } finally {
      setBusy(false);
    }
  };

  const edit = chapter => {
    setEditing(chapter);
    setForm({
      number: chapter.chapterNumber ?? '',
      language: normalizeChapterLanguage(chapter.language),
      title: chapter.title,
      description: chapter.description,
      status: chapter.status || 'Published',
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
    let stage = 'Checking admin session';

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
    if (!isImageFile(file)) { setNotice('Please select a JPG, PNG, WEBP, GIF, BMP, or AVIF image.'); return; }
    if (file.size > MAX_PAGE_SIZE) { setNotice(file.name + ' is larger than 95 MB.'); return; }

    setBusy(true);
    setNotice('');
    const path = `chapters/${page.chapter_id}/replacements/${page.id}-${Date.now()}.${safeExt(file)}`;
    let adminUser = null;
    let databaseCommitted = false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !await getAdminRole(user.id)) throw new Error('Admin access required.');
      adminUser = user;

      await uploadPdlplFile(file, path);

      const { error } = await supabase.rpc('pdlpl_replace_chapter_page', {
        p_page_id: page.id,
        p_image_path: path,
      });
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

      await loadPages(page.chapter_id);
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
      setRetryFiles(current => ({ ...current, [page.id]: file }));
      setNotice(error?.message || 'Page replacement failed. The original page remains active. You can retry the same file.');
    } finally {
      setBusy(false);
    }
  };


  const reorder = async (index, direction) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= selectedPages.length || busy) return;

    const page = selectedPages[index];
    setBusy(true);
    setNotice('');
    let adminUser = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !await getAdminRole(user.id)) throw new Error('Admin access required.');
      adminUser = user;

      const { error } = await supabase.rpc('pdlpl_reorder_chapter_page', {
        p_page_id: page.id,
        p_direction: direction,
      });
      if (error) throw error;

      await loadPages(selectedId);
      await logAdminAction(adminUser, 'reorder_pdlpl_page', 'pdlpl_page', page.id, {
        chapter_id: page.chapter_id,
        from: page.page_number,
        direction,
      });
      setNotice(`Page ${page.page_number} moved ${direction < 0 ? 'up' : 'down'}.`);
    } catch (error) {
      await logAdminAction(adminUser, 'reorder_pdlpl_page_failed', 'pdlpl_page', page.id, {
        chapter_id: page.chapter_id,
        page_number: page.page_number,
        direction,
        error: error.message,
      });
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
    let databaseCommitted = false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !await getAdminRole(user.id)) throw new Error('Admin access required.');
      adminUser = user;

      const { error } = await supabase.rpc('pdlpl_delete_chapter_page', {
        p_page_id: page.id,
      });
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

      await Promise.all([loadPages(selectedId), load()]);
      await logAdminAction(adminUser, 'delete_pdlpl_page', 'pdlpl_page', page.id, {
        chapter_id: page.chapter_id,
        page_number: page.page_number,
        cleanup_pending: cleanupPending,
      });
      setNotice(cleanupPending
        ? 'Page ' + page.page_number + ' deleted. R2 cleanup is pending in Operations.'
        : 'Page ' + page.page_number + ' deleted.');
    } catch (error) {
      await logAdminAction(adminUser, 'delete_pdlpl_page_failed', 'pdlpl_page', page.id, {
        chapter_id: page.chapter_id,
        page_number: page.page_number,
        error: error.message,
      });
      setNotice(error?.message || 'Delete page failed.');
      if (databaseCommitted) await loadPages(selectedId);
    } finally {
      setBusy(false);
    }
  };


  const Root = embedded ? 'section' : 'main';
  const rootClass = embedded ? 'pdlpl-admin-embedded' : 'pdlpl-admin';

  if (loading) return <Root className={rootClass}><div className="pdlpl-loading">Checking side story admin…</div></Root>;
  if (!role) return <Root className={rootClass}>
    <div className="pdlpl-error">
      <h2>Access denied</h2>
      <p>{notice || 'Admin access required.'}</p>
      {diagnostic && <section className="pdlpl-diagnostic" role="alert">
        <div className="pdlpl-diagnostic-head"><strong>Exact diagnostic</strong><button type="button" onClick={async () => { try { await navigator.clipboard?.writeText(diagnosticText(diagnostic)); setNotice('Diagnostic copied.'); } catch (_) {} }}>Copy</button></div>
        <pre className="pdlpl-diagnostic-pre">{diagnosticText(diagnostic)}</pre>
      </section>}
      <button type="button" onClick={() => { window.location.hash = 'admin'; }}>Back to Admin</button>
    </div>
  </Root>;

  const selectedChapter = chapters.find(item => item.id === selectedId) || null;

  const pageManager = <section className="admin-stack">
    <section className="admin-card">
      <div className="admin-card-title">
        <div>
          <span>PAGE MANAGER</span>
          <h2>Manage individual pages</h2>
          <p>Replace, retry, reorder, or delete a single page without re-uploading the chapter. A failed replacement keeps the old page intact and keeps the selected file ready for retry.</p>
        </div>
      </div>
      <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">
        {!chapters.length && <option value="">No chapters available</option>}
        {chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'Unnumbered'} — {chapter.title || 'Untitled'}</option>)}
      </select>
      {selectedChapter && <p className="mt-3 text-sm text-zinc-500">{selectedPages.length} page{selectedPages.length === 1 ? '' : 's'} · changes apply directly to the selected chapter.</p>}
    </section>
    {notice && <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-sm">{notice}</div>}
    {loading ? <div className="admin-loading">Loading pages…</div> : !selectedPages.length ? <section className="admin-card"><p className="muted center">This chapter has no readable pages yet.</p></section> : <section className="admin-card">
      <div className="admin-page-manager-grid">
        {selectedPages.map((page, index) => <article key={page.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="mb-3 flex items-center justify-between"><strong>Page {page.page_number}</strong><span className="text-xs text-zinc-500">{index + 1}/{selectedPages.length}</span></div>
          <PagePreview path={page.image_path} />
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold">Replace<input type="file" accept="image/*" className="hidden" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; replacePage(page, file); }}/></label>
            <button type="button" onClick={() => reorder(index, -1)} disabled={busy || index === 0} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold">↑</button>
            <button type="button" onClick={() => reorder(index, 1)} disabled={busy || index === selectedPages.length - 1} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold">↓</button>
            <button type="button" onClick={() => deletePage(page)} disabled={busy} className="rounded-xl border border-rose-900 px-3 py-2 text-sm font-bold text-rose-300">Delete</button>
          </div>
          {busy && <p className="mt-2 text-xs text-zinc-500">Working…</p>}
        </article>)}
      </div>
    </section>}
  </section>;

  return <Root className={rootClass}>
    {!embedded && <header className="pdlpl-admin-header">
      <div>
        <button type="button" onClick={() => { window.location.hash = 'admin'; }}>←</button>
        <div><span>SIDE STORY ADMIN</span><h1>Pal Do Pal Ke Lamhe</h1><p>Cloudflare R2 media · separate PDPL metadata.</p></div>
      </div>
      <div className="pdlpl-admin-header-actions"><button type="button" onClick={() => { window.location.hash = 'admin'; }}>Admin Dashboard</button><button type="button" className="pdlpl-admin-home" onClick={() => { window.location.hash = PDLPL_ROUTE; }}>View Side Story</button></div>
    </header>}

    {embedded && <div className="pdlpl-embedded-heading"><div><span>PAL DO PAL KE LAMHE</span><h2>Side Story Upload & Management</h2><p>Separate chapters, pages, and Cloudflare R2 media.</p></div><div className="pdlpl-admin-header-actions"><button type="button" onClick={load} disabled={loading || busy}>Refresh</button><button type="button" onClick={() => { window.location.hash = PDLPL_ROUTE; }}>View public side story</button></div></div>}

    <section className="pdlpl-admin-layout">
      <form id="pdlpl-upload-chapter" className="pdlpl-admin-card pdlpl-form" onSubmit={saveChapter}>
        <div className="pdlpl-admin-card-head">
          <div><span>CHAPTER SETUP</span><h2>{editing ? 'Edit chapter' : 'Create chapter'}</h2></div>
          {editing && <button type="button" onClick={reset}>New chapter</button>}
        </div>

        <div className="pdlpl-form-grid">
          <label>
            Chapter number
            <input type="number" min="1" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="Chapter number (optional)" />
          </label>
          <label>
            Language
            <select value={form.language} disabled={Boolean(editing)} onChange={e => setForm({ ...form, language: e.target.value })}>
              <option value="hi">Hindi</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>Published</option>
              <option>Scheduled</option>
              <option>Pre-uploaded</option>
              <option>Draft</option>
            </select>
          </label>
          <label>
            Title
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Chapter title" required />
          </label>
          <label className="pdlpl-field-wide">
            Description
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="3" />
          </label>
          <label>
            Release date
            <input type="datetime-local" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} />
          </label>
          <label className="pdlpl-file-input">
            Cover image
            <input type="file" accept="image/*" onChange={e => setForm({ ...form, cover: e.target.files?.[0] || null })} />
            {form.cover && <span>{form.cover.name}</span>}
          </label>
        </div>

        <label className="pdlpl-dropzone">
          <strong>Manga pages</strong>
          <span>Select pages in the exact order you want them published. Filename sorting is disabled.</span>
          <input type="file" multiple accept="image/*" onChange={choosePages} />
          {form.pages.length > 0 && <em>{form.pages.length} page{form.pages.length === 1 ? '' : 's'} selected · not uploaded yet · selected order preserved</em>}
        </label>

        {progress.total > 0 && <>
          <div className="pdlpl-upload-progress"><div style={{ width: `${Math.round(progress.current / progress.total * 100)}%` }} /></div>
          <p className="pdlpl-muted">{progress.text}</p>
        </>}

        <p className="pdlpl-muted">Images are stored in Cloudflare R2. Published chapters are available according to the side-story access rules.</p>

        {diagnostic && (
          <section className="pdlpl-diagnostic" role="alert" aria-live="polite">
            <div className="pdlpl-diagnostic-head">
              <strong>Upload diagnostic</strong>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(diagnosticText(diagnostic));
                    setNotice('Diagnostic copied.');
                  } catch (_) {
                    setNotice('Diagnostic copy failed. The details are shown below.');
                  }
                }}
              >
                Copy
              </button>
            </div>
            <div className="pdlpl-diagnostic-grid">
              <div><span>Stage</span><strong>{diagnostic.stage}</strong></div>
              {diagnostic.code && <div><span>Code / HTTP</span><strong>{diagnostic.code}</strong></div>}
              <div className="wide"><span>Message</span><strong>{diagnostic.message}</strong></div>
              {diagnostic.details && <div className="wide"><span>Details</span><strong>{diagnostic.details}</strong></div>}
              {diagnostic.hint && <div className="wide"><span>Hint</span><strong>{diagnostic.hint}</strong></div>}
              {diagnostic.name && <div><span>Error type</span><strong>{diagnostic.name}</strong></div>}
              {diagnostic.statusText && <div><span>HTTP status</span><strong>{diagnostic.statusText}</strong></div>}
              {diagnostic.path && <div className="wide"><span>Media path</span><strong>{diagnostic.path}</strong></div>}
              {diagnostic.url && <div className="wide"><span>Request URL</span><strong>{diagnostic.url}</strong></div>}
              {diagnostic.responseBody && <div className="wide"><span>Server response</span><strong>{diagnostic.responseBody}</strong></div>}
              {diagnostic.chapterId && <div className="wide"><span>Chapter ID</span><strong>{diagnostic.chapterId}</strong></div>}
              {diagnostic.path && <div className="wide"><span>Path</span><strong>{diagnostic.path}</strong></div>}
              {diagnostic.url && <div className="wide"><span>URL</span><strong>{diagnostic.url}</strong></div>}
              {diagnostic.responseBody && <div className="wide"><span>Raw response</span><strong>{diagnostic.responseBody}</strong></div>}
              {diagnostic.uploadedPaths?.length > 0 && <div className="wide"><span>Uploaded paths before failure</span><strong>{diagnostic.uploadedPaths.join(' | ')}</strong></div>}
            </div>
          </section>
        )}
        <button className="pdlpl-primary" disabled={busy}>{busy ? 'Working…' : editing ? 'Save chapter changes' : 'Upload chapter'}</button>
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
              <button type="button" onClick={() => {
                setSelectedId(chapter.id);
                window.setTimeout(() => document.getElementById('pdlpl-page-manager')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
              }}>Manage pages</button>
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

    {selectedChapter && <section id="pdlpl-page-manager" className="pdlpl-admin-card pdlpl-page-manager">
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
              <label>Replace<input type="file" accept="image/*" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; replacePage(page, file); }} /></label>{retryFiles[page.id] && <button type="button" onClick={() => replacePage(page, retryFiles[page.id])} disabled={busy}>Retry</button>}
              <button type="button" disabled={busy || index === 0} onClick={() => reorder(index, -1)}>↑</button>
              <button type="button" disabled={busy || index === selectedPages.length - 1} onClick={() => reorder(index, 1)}>↓</button>
              <button type="button" className="danger" disabled={busy} onClick={() => deletePage(page)}>Delete</button>
            </div>
          </article>)}
        </div>}
    </section>}

    {notice && <div className="pdlpl-notice" role="alert"><strong>PDPKL issue</strong><pre>{notice}</pre></div>}
  </Root>;
}
