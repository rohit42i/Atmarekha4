import { useEffect, useMemo, useState } from 'react';
import PalDoPalAdmin from './PalDoPalAdmin.jsx';
import { supabase, isSupportedImageFile } from './supabase';
import { getAdminRole } from './adminAuth';
import { chapterLanguageLabel, normalizeChapterLanguage } from './chapters';
import { AdminButton, AdminCard, AdminEmptyState, AdminModal, AdminTable } from './admin-studio-ui.jsx';
import { notifyAdminToast } from './admin-feedback';

const FILTER_KEY = 'atma-admin-studio:chapter-filters';
const COLUMN_KEY = 'atma-admin-studio:chapter-columns';
const SUPPORTED_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif';

const DEFAULT_COLUMNS = { chapter: true, status: true, language: true, pages: true, performance: true, release: true, signal: true, actions: true };

function readStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
}

function LocalImagePreview({ file, alt = '' }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!file) { setSrc(''); return undefined; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src ? <img src={src} alt={alt} loading="lazy" /> : null;
}

function normalizedStatus(status) {
  return String(status || 'Draft').trim().toLowerCase();
}

function statusClass(status) {
  const value = normalizedStatus(status);
  if (value === 'published') return 'admin-status-published';
  if (value === 'scheduled') return 'admin-status-scheduled';
  return 'admin-status-draft';
}

function signalFor(chapter, pageCount) {
  if (!Number(pageCount)) return { text: 'Missing pages', className: 'admin-health-missing' };
  if (normalizedStatus(chapter.status) === 'scheduled' && !chapter.releaseDate) return { text: 'Release missing', className: 'admin-health-missing' };
  if (normalizedStatus(chapter.status) === 'published') return { text: 'Ready', className: 'admin-health-ready' };
  return { text: 'Stored', className: 'admin-health-neutral' };
}

export default function AdminChapterManager({
  chapters = [],
  pageCounts = {},
  form,
  setForm,
  editing,
  progress,
  busy,
  chapterPublishProject,
  setChapterPublishProject,
  onSubmit,
  onReset,
  onEdit,
  onDelete,
  onOpenPages,
  onOpenThumbnails,
  onReload,
  chapterPerformance = {},
  onNewChapter,
  editorOpen = false,
  onEditorOpenChange = () => {},
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [language, setLanguage] = useState('all');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [sortBy, setSortBy] = useState('chapter');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [columns, setColumns] = useState(() => ({ ...DEFAULT_COLUMNS, ...readStored(COLUMN_KEY, {}) }));
  const [savedFilters, setSavedFilters] = useState(() => { const value = readStored(FILTER_KEY, []); return Array.isArray(value) ? value : []; });
  const [filterName, setFilterName] = useState('');
  const [showColumns, setShowColumns] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [bulkAction, setBulkAction] = useState(null);
  const [notice, setNotice] = useState('');
  const [focusChapterId, setFocusChapterId] = useState(null);
  const [draggingPageIndex, setDraggingPageIndex] = useState(null);

  useEffect(() => {
    try { localStorage.setItem(COLUMN_KEY, JSON.stringify(columns)); } catch {
      // Keep the chapter manager usable when storage is disabled or full.
    }
  }, [columns]);

  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(savedFilters.slice(0, 10))); } catch {
      // Saved filters are a convenience; storage failure must not break admin work.
    }
  }, [savedFilters]);

  useEffect(() => {
    const onFocus = event => {
      const id = event?.detail?.chapterId;
      if (!id) return;
      setFocusChapterId(id);
      const chapter = document.querySelector(`[data-admin-chapter-id="${id}"]`);
      chapter?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      window.setTimeout(() => setFocusChapterId(null), 1800);
    };
    window.addEventListener('atma-admin-focus-chapter', onFocus);
    return () => window.removeEventListener('atma-admin-focus-chapter', onFocus);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = chapters.filter(chapter => {
      const pageCount = Number(pageCounts[chapter.id] || 0);
      const matchesQuery = !query || `${chapter.chapterNumber ?? ''} ${chapter.title || ''} ${chapter.status || ''} ${chapter.language || ''}`.toLowerCase().includes(query);
      const matchesStatus = status === 'all' || normalizedStatus(chapter.status) === status;
      const matchesLanguage = language === 'all' || normalizeChapterLanguage(chapter.language) === language;
      const matchesMissing = !onlyMissing || pageCount === 0;
      return matchesQuery && matchesStatus && matchesLanguage && matchesMissing;
    });
    return [...rows].sort((a, b) => {
      let av; let bv;
      if (sortBy === 'status') { av = normalizedStatus(a.status); bv = normalizedStatus(b.status); }
      else if (sortBy === 'language') { av = normalizeChapterLanguage(a.language); bv = normalizeChapterLanguage(b.language); }
      else if (sortBy === 'pages') { av = Number(pageCounts[a.id] || 0); bv = Number(pageCounts[b.id] || 0); }
      else if (sortBy === 'performance') { av = Number(chapterPerformance[a.id]?.views || 0); bv = Number(chapterPerformance[b.id]?.views || 0); }
      else if (sortBy === 'release') { av = new Date(a.releaseDate || a.createdAt || 0).getTime(); bv = new Date(b.releaseDate || b.createdAt || 0).getTime(); }
      else { av = Number(a.chapterNumber); bv = Number(b.chapterNumber); }
      const aMissing = Number.isFinite(av) ? false : true;
      const bMissing = Number.isFinite(bv) ? false : true;
      if (aMissing && !bMissing) return 1;
      if (!aMissing && bMissing) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [chapters, pageCounts, search, status, language, onlyMissing, sortBy, sortDir]);

  const visibleIds = useMemo(() => new Set(filtered.map(chapter => chapter.id)), [filtered]);
  const selectedVisibleCount = [...selected].filter(id => visibleIds.has(id)).length;
  const allVisibleSelected = filtered.length > 0 && selectedVisibleCount === filtered.length;
  const missingCount = chapters.filter(chapter => Number(pageCounts[chapter.id] || 0) === 0).length;

  const toggleSort = key => {
    if (sortBy === key) setSortDir(value => value === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir(key === 'chapter' ? 'asc' : 'desc'); }
  };

  const setFilterState = value => {
    setSearch(value.search ?? '');
    setStatus(value.status ?? 'all');
    setLanguage(value.language ?? 'all');
    setOnlyMissing(Boolean(value.onlyMissing));
  };

  const saveFilter = event => {
    event.preventDefault();
    const name = filterName.trim();
    if (!name) return;
    const snapshot = { name, search, status, language, onlyMissing };
    setSavedFilters(current => [...current.filter(item => item.name !== name), snapshot].slice(-10));
    setFilterName('');
    setNotice(`Saved filter “${name}”.`);
  };

  const selectAllVisible = checked => {
    setSelected(current => {
      const next = new Set(current);
      filtered.forEach(row => checked ? next.add(row.id) : next.delete(row.id));
      return next;
    });
  };

  const toggleSelected = id => {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const executeBulk = async () => {
    if (!bulkAction || !selected.size) return;
    const action = bulkAction.status === 'Published' ? 'publish' : 'unpublish';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !(await getAdminRole(user.id))) throw new Error('Admin access required.');
      const ids = [...selected];
      const { error } = await supabase.from('chapters').update({ status: bulkAction.status }).in('id', ids);
      if (error) throw error;
      const { error: auditError } = await supabase.from('admin_activity_log').insert({
        admin_user_id: user.id,
        action: `bulk_${action}_chapters`,
        entity_type: 'chapter',
        entity_id: null,
        details: { ids, count: ids.length, status: bulkAction.status },
      });
      if (auditError) notifyAdminToast('Chapters were updated, but the admin activity log could not be saved: ' + auditError.message, 'warning');
      setSelected(new Set());
      setBulkAction(null);
      setNotice(`${ids.length} chapter${ids.length === 1 ? '' : 's'} ${action}ed successfully.`);
      await onReload?.();
    } catch (error) {
      setNotice(error?.message || 'Bulk chapter update failed.');
      notifyAdminToast(error?.message || 'Bulk chapter update failed.', 'error');
      setBulkAction(null);
    }
  };

  const clearFilters = () => {
    setSearch(''); setStatus('all'); setLanguage('all'); setOnlyMissing(false);
  };

  const updateForm = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const reorderChosenPage = (fromIndex, toIndex) => {
    if (fromIndex === null || fromIndex === toIndex || toIndex < 0 || toIndex >= form.pages.length) return;
    setForm(current => {
      const pages = [...current.pages];
      const [page] = pages.splice(fromIndex, 1);
      pages.splice(toIndex, 0, page);
      return { ...current, pages };
    });
    setDraggingPageIndex(null);
  };
  const removeChosenPage = index => {
    setForm(current => ({ ...current, pages: current.pages.filter((_, pageIndex) => pageIndex !== index) }));
    setDraggingPageIndex(null);
  };
  const choosePages = event => {
    const selectedFiles = Array.from(event.target.files || []);
    const files = selectedFiles.filter(isSupportedImageFile);
    const unsupportedCount = selectedFiles.length - files.length;
    const tooLarge = files.find(file => file.size > 95 * 1024 * 1024);
    event.target.value = '';
    if (tooLarge) {
      const message = tooLarge.name + ' is larger than 95 MB.';
      setNotice(message);
      notifyAdminToast(message, 'error');
      return;
    }
    if (unsupportedCount) {
      const message = 'Skipped ' + unsupportedCount + ' unsupported image(s). Use JPG, PNG, WEBP, GIF, BMP, or AVIF.';
      setNotice(message);
      notifyAdminToast(message, 'warning');
    } else {
      setNotice(files.length ? `${files.length} pages ready · selected order preserved.` : '');
    }
    updateForm('pages', files);
  };

  return (
    <section className="admin-stack">
      {editorOpen && <div className="ar-admin-chapter-drawer-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onEditorOpenChange(false); }}>
        <aside className="ar-admin-chapter-drawer" role="dialog" aria-modal="true" aria-labelledby="ar-admin-chapter-drawer-title">
          <header className="ar-admin-chapter-drawer-head">
            <div><span>CHAPTER WORKSPACE</span><h2 id="ar-admin-chapter-drawer-title">{editing ? `Edit ${editing.chapterNumber ? `Chapter ${editing.chapterNumber}` : 'Special Entry'}` : 'New chapter'}</h2><p>Prepare the cover and page sequence, then review before saving.</p></div>
            <button type="button" className="ar-admin-chapter-drawer-close" aria-label="Close chapter editor" onClick={() => onEditorOpenChange(false)}>×</button>
          </header>
      <AdminCard
        className="admin-studio-publisher-card"
        eyebrow="PUBLISHER"
        title={chapterPublishProject === 'pdpkl' ? 'Publish Pal Do Pal Ke Lamhe' : (editing ? `Edit ${editing.chapterNumber ? `Chapter ${editing.chapterNumber}` : 'Unnumbered Entry'}` : 'Upload a chapter')}
        description="Publishing controls stay on the existing chapters table and R2 paths. This layer adds safer controls and a faster operational view. The 30-day performance column uses the existing admin analytics RPC and is intentionally omitted when that source is unavailable."
      >
        <div className="admin-form-grid">
          <label>
            <span>Story</span>
            <select value={chapterPublishProject} onChange={event => { setChapterPublishProject(event.target.value); onReset?.(); }} aria-label="Story">
              <option value="atma">Atma Rekha</option>
              <option value="pdpkl">Pal Do Pal Ke Lamhe (PDPKL)</option>
            </select>
          </label>
        </div>
      </AdminCard>

      {chapterPublishProject === 'pdpkl' ? <PalDoPalAdmin embedded /> : (
        <AdminCard
          className="admin-studio-form-card"
          eyebrow={editing ? 'EDIT CHAPTER' : 'NEW CHAPTER'}
          title={editing ? `Edit ${editing.chapterNumber ? `Chapter ${editing.chapterNumber}` : 'Unnumbered Entry'}` : 'Chapter details'}
          actions={editing ? <AdminButton type="button" icon="close" onClick={() => { onReset?.(); onEditorOpenChange(false); }}>Cancel</AdminButton> : null}
        >
          <form onSubmit={onSubmit} className="admin-form ar-admin-chapter-form">
            <section className="ar-admin-chapter-form-section">
              <div className="ar-admin-chapter-section-heading"><span>01</span><div><h3>Basics</h3><p>Identify this chapter for readers.</p></div></div>
              <div className="admin-form-grid">
                <label><span>Chapter number</span><input type="number" min="1" value={form.number} onChange={event => updateForm('number', event.target.value)} placeholder="Optional" /></label>
                <label className="wide"><span>Title</span><input value={form.title} onChange={event => updateForm('title', event.target.value)} placeholder="Chapter title" required /></label>
                <label className="wide"><span>Description</span><textarea value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Description shown with the chapter" rows="3" /></label>
              </div>
            </section>

            <section className="ar-admin-chapter-form-section">
              <div className="ar-admin-chapter-section-heading"><span>02</span><div><h3>Language and status</h3><p>Choose where and when this chapter appears.</p></div></div>
              <div className="admin-form-grid">
                <label><span>Language</span><select value={form.language} onChange={event => updateForm('language', event.target.value)} disabled={Boolean(editing)} title={editing ? 'Language is locked after a chapter is created.' : undefined}><option value="hi">Hindi</option><option value="en">English</option></select></label>
                <label><span>Status</span><select value={form.status} onChange={event => updateForm('status', event.target.value)}><option>Published</option><option>Scheduled</option><option>Pre-uploaded</option><option>Draft</option></select></label>
                <label className="wide"><span>Release date and time</span><input type="datetime-local" value={form.releaseDate} onChange={event => updateForm('releaseDate', event.target.value)} /></label>
              </div>
            </section>

            <section className="ar-admin-chapter-form-section">
              <div className="ar-admin-chapter-section-heading"><span>03</span><div><h3>Cover</h3><p>Choose the artwork used as this chapter's fallback thumbnail.</p></div></div>
              <label className="admin-file-field ar-admin-cover-select"><span>Cover image · JPG, PNG, WEBP, GIF, BMP or AVIF</span><input type="file" accept={SUPPORTED_IMAGE_ACCEPT} disabled={busy} onChange={event => {
                const file = event.target.files?.[0] || null;
                event.target.value = '';
                if (file && !isSupportedImageFile(file)) { setNotice('Unsupported cover image. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.'); notifyAdminToast('Unsupported cover image. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.', 'error'); return; }
                updateForm('cover', file);
              }} />{form.cover && <em>{form.cover.name}</em>}</label>
              {form.cover && <div className="ar-admin-cover-preview"><LocalImagePreview file={form.cover} alt="Selected cover preview" /><span>New cover selected</span><button type="button" onClick={() => updateForm('cover', null)} disabled={busy} title={busy ? 'Wait for the current upload to finish.' : 'Remove the selected replacement cover'}>Remove cover</button></div>}
              {editing?.cover && !form.cover && <div className="ar-admin-current-cover"><img src={editing.cover} alt="Current chapter cover" loading="lazy" /><span>Current cover remains in place unless you select a replacement.</span></div>}
            </section>

            <section className="ar-admin-chapter-form-section">
              <div className="ar-admin-chapter-section-heading"><span>04</span><div><h3>Pages</h3><p>Drag thumbnails to reorder, or use the move controls. Removing a file only removes it from this unsaved selection.</p></div></div>
              <label className="admin-dropzone ar-admin-pages-dropzone">
                <strong>Select manga pages</strong>
                <span>Choose JPG, PNG, WEBP, GIF, BMP or AVIF images. The order you set below is the upload order.</span>
                <input type="file" multiple accept={SUPPORTED_IMAGE_ACCEPT} disabled={busy} onChange={choosePages} />
              </label>
              {form.pages.length > 0 ? <div className="ar-admin-selected-pages" aria-label="Selected page images">
                {form.pages.map((file, index) => <article key={file.name + ':' + file.size + ':' + file.lastModified + ':' + index}
                  draggable={!busy} onDragStart={() => setDraggingPageIndex(index)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => { event.preventDefault(); reorderChosenPage(draggingPageIndex, index); }}
                  onDragEnd={() => setDraggingPageIndex(null)}
                  className={draggingPageIndex === index ? 'is-dragging' : ''}>
                  <div className="ar-admin-selected-page-image"><LocalImagePreview file={file} alt={'Selected page ' + (index + 1)} /><span>{index + 1}</span></div>
                  <div className="ar-admin-selected-page-info"><strong>Page {index + 1}</strong><span title={file.name}>{file.name}</span><small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></div>
                  <div className="ar-admin-selected-page-actions">
                    <button type="button" onClick={() => reorderChosenPage(index, index - 1)} disabled={busy || index === 0} aria-label={'Move page ' + (index + 1) + ' earlier'} title="Move earlier">↑</button>
                    <button type="button" onClick={() => reorderChosenPage(index, index + 1)} disabled={busy || index === form.pages.length - 1} aria-label={'Move page ' + (index + 1) + ' later'} title="Move later">↓</button>
                    <button type="button" className="is-danger" onClick={() => removeChosenPage(index)} disabled={busy} aria-label={'Remove selected page ' + (index + 1)} title="Remove from selection">×</button>
                  </div>
                </article>)}
              </div> : <p className="ar-admin-selected-pages-empty">No new page images selected. When editing an existing chapter, the saved pages remain unchanged unless you choose a new page set.</p>}
            </section>

            <section className="ar-admin-chapter-form-section">
              <div className="ar-admin-chapter-section-heading"><span>05</span><div><h3>Review</h3><p>Check the details before saving.</p></div></div>
              <div className="ar-admin-chapter-review">
                <div><span>Title</span><strong>{form.title.trim() || 'Untitled chapter'}</strong></div>
                <div><span>Chapter</span><strong>{form.number ? 'Chapter ' + form.number : 'Special entry'}</strong></div>
                <div><span>Language</span><strong>{chapterLanguageLabel(form.language)}</strong></div>
                <div><span>Status</span><strong>{form.status}</strong></div>
                <div><span>New pages selected</span><strong>{form.pages.length}</strong></div>
                <div><span>Cover</span><strong>{form.cover ? 'Replacement selected' : editing ? 'Keep current' : 'Not selected'}</strong></div>
              </div>
            </section>

            {progress?.total > 0 ? <div className="admin-progress" aria-live="polite">
              <div><span>{progress.text || 'Uploading chapter assets…'}</span><b>{progress.current}/{progress.total}</b></div>
              <i><span style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }} /></i>
            </div> : null}

            <div className="admin-form-actions ar-admin-chapter-form-actions">
              <AdminButton type="submit" variant="primary" size="lg" disabled={busy} title={busy ? (progress?.text || 'Wait for the current upload step to finish.') : undefined} icon={busy ? 'refresh' : editing ? 'bookmark' : 'layers'}>
                {busy ? (progress?.text || 'Working…') : editing ? 'Save chapter changes' : 'Upload chapter'}
              </AdminButton>
              {!editing ? <AdminButton type="button" onClick={onNewChapter} disabled={busy} title={busy ? 'Wait for the current upload step to finish.' : 'Clear the new chapter form'}>Clear</AdminButton> : null}
            </div>
          </form>
        </AdminCard>
      )}

      {notice ? <div className="ar-admin-notice success" role="status">{notice}</div> : null}

          </aside>
      </div>}
      <AdminCard
        eyebrow="LIBRARY"
        title="Chapter manager"
        description={`${filtered.length} shown · ${chapters.length} total · ${missingCount} missing pages. Performance analytics remain in the Overview rather than being fabricated here.`}
        actions={
          <>
            <AdminButton type="button" variant="primary" icon="plus" onClick={() => { onNewChapter?.(); onEditorOpenChange(true); }}>New chapter</AdminButton>
            <AdminButton type="button" icon="refresh" onClick={onReload} disabled={busy} title={busy ? 'Wait for the current admin operation to finish.' : undefined}>Refresh</AdminButton>
          </>
        }
      >
        <div className="admin-chapter-toolbar">
          <div className="admin-filter-control">
            <label htmlFor="chapter-search">Search</label>
            <input id="chapter-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Number, title, status…" />
          </div>
          <div className="admin-filter-control">
            <label htmlFor="chapter-status">Status</label>
            <select id="chapter-status" value={status} onChange={event => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="pre-uploaded">Pre-uploaded</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div className="admin-filter-control">
            <label htmlFor="chapter-language">Language</label>
            <select id="chapter-language" value={language} onChange={event => setLanguage(event.target.value)}>
              <option value="all">All languages</option>
              <option value="hi">Hindi</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="admin-filter-control">
            <label htmlFor="chapter-sort">Sort by</label>
            <select id="chapter-sort" value={sortBy} onChange={event => setSortBy(event.target.value)}>
              <option value="chapter">Chapter</option>
              <option value="status">Status</option>
              <option value="language">Language</option>
              <option value="pages">Pages</option>
              <option value="performance">30d views</option>
              <option value="release">Release</option>
            </select>
          </div>
          <button className="admin-filter-check" type="button" onClick={() => setOnlyMissing(value => !value)} aria-pressed={onlyMissing}>
            <input type="checkbox" readOnly checked={onlyMissing} tabIndex="-1" />
            Missing pages
          </button>
        </div>

        <div className="admin-saved-filter-row">
          {savedFilters.map(item => (
            <span className="admin-saved-filter" key={item.name}>
              <AdminButton type="button" size="sm" onClick={() => setFilterState(item)}>{item.name}</AdminButton>
              <AdminButton type="button" size="sm" variant="ghost" className="delete" onClick={() => setSavedFilters(current => current.filter(saved => saved.name !== item.name))} aria-label={`Delete saved filter ${item.name}`}>×</AdminButton>
            </span>
          ))}
          <form onSubmit={saveFilter} className="admin-saved-filter-row">
            <input value={filterName} onChange={event => setFilterName(event.target.value)} placeholder="Save current filters as…" aria-label="Saved filter name" />
            <AdminButton type="submit" size="sm" disabled={!filterName.trim()}>Save</AdminButton>
            {(search || status !== 'all' || language !== 'all' || onlyMissing) ? <AdminButton type="button" size="sm" variant="ghost" onClick={clearFilters}>Clear filters</AdminButton> : null}
          </form>
        </div>

        <div className="admin-table-toolbar">
          <div className="admin-view-switch" role="group" aria-label="Chapter display mode">
            <button type="button" className={viewMode === 'table' ? 'is-active' : ''} aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')}>List</button>
            <button type="button" className={viewMode === 'cards' ? 'is-active' : ''} aria-pressed={viewMode === 'cards'} onClick={() => setViewMode('cards')}>Cards</button>
          </div>
          <div className="admin-bulkbar" aria-live="polite">
            <span>{selected.size} selected</span>
            <AdminButton type="button" size="sm" onClick={() => setSelected(new Set())} disabled={!selected.size}>Clear</AdminButton>
            <AdminButton type="button" size="sm" variant="primary" onClick={() => setBulkAction({ status: 'Published' })} disabled={!selected.size}>Publish</AdminButton>
            <AdminButton type="button" size="sm" variant="danger" onClick={() => setBulkAction({ status: 'Draft' })} disabled={!selected.size}>Unpublish</AdminButton>
          </div>
          <div className="admin-column-menu">
            <AdminButton type="button" size="sm" onClick={() => setShowColumns(value => !value)} aria-expanded={showColumns}>Columns</AdminButton>
            {showColumns ? (
              <div className="admin-column-popover" role="dialog" aria-label="Column visibility">
                {Object.entries(columns).map(([key, visible]) => (
                  <label key={key}>
                    <input type="checkbox" checked={visible} onChange={() => setColumns(current => ({ ...current, [key]: !current[key] }))} />
                    <span>{key}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {viewMode === 'table' ? <AdminTable>
          <thead>
            <tr>
              <th className="admin-check-cell"><input type="checkbox" checked={allVisibleSelected} onChange={event => selectAllVisible(event.target.checked)} aria-label="Select all visible chapters" /></th>
              {columns.chapter ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('chapter')}>Chapter {sortBy === 'chapter' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
              {columns.status ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('status')}>Status {sortBy === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
              {columns.language ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('language')}>Language {sortBy === 'language' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
              {columns.pages ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('pages')}>Pages {sortBy === 'pages' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
              {columns.performance ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('performance')}>30d views {sortBy === 'performance' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
              {columns.release ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('release')}>Release {sortBy === 'release' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
              {columns.signal ? <th>Signal</th> : null}
              {columns.actions ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map(chapter => {
              const pageCount = Number(pageCounts[chapter.id] || 0);
              const signal = signalFor(chapter, pageCount);
              const selectedRow = selected.has(chapter.id);
              return (
                <tr key={chapter.id} data-admin-chapter-id={chapter.id} className={focusChapterId === chapter.id ? 'is-highlighted' : ''}>
                  <td className="admin-check-cell"><input type="checkbox" checked={selectedRow} onChange={() => toggleSelected(chapter.id)} aria-label={`Select ${chapter.title || 'chapter'}`} /></td>
                  {columns.chapter ? <td className="admin-chapter-cell"><strong>{chapter.chapterNumber == null ? 'Special' : `Chapter ${chapter.chapterNumber}`}</strong><span>{chapter.title || 'Untitled'}</span></td> : null}
                  {columns.status ? <td><span className={`admin-status-badge ${statusClass(chapter.status)}`}>{chapter.status || 'Draft'}</span></td> : null}
                  {columns.language ? <td>{chapterLanguageLabel(chapter.language)}</td> : null}
                  {columns.pages ? <td className="admin-table-muted">{pageCount.toLocaleString(undefined)}</td> : null}
                  {columns.performance ? <td className="admin-table-muted">{Number(chapterPerformance[chapter.id]?.views || 0).toLocaleString(undefined)}</td> : null}
                  {columns.release ? <td className="admin-table-muted">{formatDate(chapter.releaseDate)}</td> : null}
                  {columns.signal ? <td><span className={`admin-health-signal ${signal.className}`}><i />{signal.text}</span></td> : null}
                  {columns.actions ? (
                    <td>
                      <div className="admin-row-actions">
                        <AdminButton size="sm" className="admin-table-action" type="button" icon="bookmark" onClick={() => onEdit(chapter)}>Edit</AdminButton>
                        <AdminButton size="sm" className="admin-table-action" type="button" icon="layers" onClick={() => onOpenPages?.(chapter)} title="Open this chapter in the page editor">Pages</AdminButton>
                        <AdminButton size="sm" className="admin-table-action" type="button" icon="image" onClick={() => onOpenThumbnails?.(chapter)} title="Manage this chapter's card thumbnails">Thumbnails</AdminButton>
                        <AdminButton size="sm" className="admin-table-action" type="button" variant="danger" icon="flag" onClick={() => onDelete(chapter)} disabled={busy} title={busy ? 'Wait for the current admin operation to finish.' : 'Delete this chapter and its associated assets'}>Delete</AdminButton>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </AdminTable> : <div className="admin-chapter-card-grid">
          {filtered.map(chapter => {
            const pageCount = Number(pageCounts[chapter.id] || 0);
            const signal = signalFor(chapter, pageCount);
            const selectedRow = selected.has(chapter.id);
            const cover = chapter.coverUrl || chapter.cover_url || chapter.cover || '';
            return <article key={chapter.id} className={'admin-chapter-card' + (focusChapterId === chapter.id ? ' is-highlighted' : '')} data-admin-chapter-id={chapter.id}>
              <label className="admin-chapter-card-select"><input type="checkbox" checked={selectedRow} onChange={() => toggleSelected(chapter.id)} aria-label={`Select ${chapter.title || 'chapter'}`}/><span>Select</span></label>
              <div className="admin-chapter-card-cover">
                {cover ? <img src={cover} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }}/> : <span aria-hidden="true">AR</span>}
              </div>
              <div className="admin-chapter-card-content">
                <div className="admin-chapter-card-heading"><div><small>{chapter.chapterNumber == null ? 'SPECIAL ENTRY' : 'CHAPTER ' + chapter.chapterNumber}</small><h3>{chapter.title || 'Untitled chapter'}</h3></div><span className={`admin-status-badge ${statusClass(chapter.status)}`}>{chapter.status || 'Draft'}</span></div>
                <div className="admin-chapter-card-meta"><span>{chapterLanguageLabel(chapter.language)}</span><span>{pageCount.toLocaleString(undefined)} pages</span><span>{Number(chapterPerformance[chapter.id]?.views || 0).toLocaleString(undefined)} views / 30d</span></div>
                <div className="admin-chapter-card-health"><span className={`admin-health-signal ${signal.className}`}><i/>{signal.text}</span><span>{formatDate(chapter.releaseDate)}</span></div>
                <div className={`admin-chapter-card-page-state ${pageCount > 0 ? 'has-pages' : 'no-pages'}`}><i aria-hidden="true"/>{pageCount > 0 ? 'Page records detected' : 'No page records'}</div>
                <div className="admin-row-actions">
                  <AdminButton size="sm" className="admin-table-action" type="button" icon="bookmark" onClick={() => onEdit(chapter)}>Edit</AdminButton>
                  <AdminButton size="sm" className="admin-table-action" type="button" icon="layers" onClick={() => onOpenPages?.(chapter)} title="Open this chapter in the page editor">Pages</AdminButton>
                  <AdminButton size="sm" className="admin-table-action" type="button" icon="image" onClick={() => onOpenThumbnails?.(chapter)} title="Manage this chapter's card thumbnails">Thumbnails</AdminButton>
                  <AdminButton size="sm" className="admin-table-action" type="button" variant="danger" icon="flag" onClick={() => onDelete(chapter)} disabled={busy} title={busy ? 'Wait for the current admin operation to finish.' : 'Delete this chapter and its associated assets'}>Delete</AdminButton>
                </div>
              </div>
            </article>;
          })}
        </div>}

        {!filtered.length ? (
          <AdminEmptyState
            icon="search"
            title={chapters.length ? 'No chapters match these filters' : 'No chapters yet'}
            description={chapters.length ? 'Clear the filters or broaden the search. Your chapter records have not been changed.' : 'Create the first chapter from the publisher form above.'}
            action={chapters.length ? <AdminButton type="button" size="sm" onClick={clearFilters}>Clear filters</AdminButton> : <AdminButton type="button" size="sm" variant="primary" onClick={onNewChapter}>New chapter</AdminButton>}
          />
        ) : null}
      </AdminCard>

      <AdminModal
        open={Boolean(bulkAction)}
        onClose={() => setBulkAction(null)}
        title={bulkAction?.status === 'Published' ? 'Publish selected chapters?' : 'Unpublish selected chapters?'}
        description="This uses the existing chapters.status field. No rows are deleted and no R2 files are touched."
        footer={
          <>
            <AdminButton type="button" onClick={() => setBulkAction(null)}>Cancel</AdminButton>
            <AdminButton type="button" variant={bulkAction?.status === 'Published' ? 'primary' : 'danger'} onClick={executeBulk}>
              {bulkAction?.status === 'Published' ? 'Publish chapters' : 'Unpublish chapters'}
            </AdminButton>
          </>
        }
      >
        <p className="admin-confirm-copy">
          <strong>{selected.size} chapter{selected.size === 1 ? '' : 's'}</strong> will change status to <strong>{bulkAction?.status}</strong>. This is reversible.
        </p>
      </AdminModal>

      {onReload && <div className="admin-studio-sr-only" aria-live="polite">{notice}</div>}
    </section>
  );
}
