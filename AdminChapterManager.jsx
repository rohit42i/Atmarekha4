import { useEffect, useMemo, useState } from 'react';
import PalDoPalAdmin from './PalDoPalAdmin.jsx';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import { chapterLanguageLabel, normalizeChapterLanguage } from './chapters';
import { AdminIcon } from './admin-redesign-ui.jsx';
import { AdminButton, AdminCard, AdminEmptyState, AdminModal, AdminTable } from './admin-studio-ui.jsx';

const FILTER_KEY = 'atma-admin-studio:chapter-filters';
const COLUMN_KEY = 'atma-admin-studio:chapter-columns';

const DEFAULT_COLUMNS = { chapter: true, status: true, language: true, pages: true, release: true, signal: true, actions: true };

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
    ? date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
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
  onReload,
  onNewChapter,
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [language, setLanguage] = useState('all');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [sortBy, setSortBy] = useState('chapter');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [columns, setColumns] = useState(() => ({ ...DEFAULT_COLUMNS, ...readStored(COLUMN_KEY, {}) }));
  const [savedFilters, setSavedFilters] = useState(() => readStored(FILTER_KEY, []));
  const [filterName, setFilterName] = useState('');
  const [showColumns, setShowColumns] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);
  const [notice, setNotice] = useState('');
  const [focusChapterId, setFocusChapterId] = useState(null);

  useEffect(() => {
    localStorage.setItem(COLUMN_KEY, JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(savedFilters.slice(0, 10))); } catch {}
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
      await supabase.from('admin_activity_log').insert({
        admin_user_id: user.id,
        action: `bulk_${action}_chapters`,
        entity_type: 'chapter',
        entity_id: null,
        details: { ids, count: ids.length, status: bulkAction.status },
      });
      setSelected(new Set());
      setBulkAction(null);
      setNotice(`${ids.length} chapter${ids.length === 1 ? '' : 's'} ${action}ed successfully.`);
      await onReload?.();
    } catch (error) {
      setNotice(error?.message || 'Bulk chapter update failed.');
      setBulkAction(null);
    }
  };

  const clearFilters = () => {
    setSearch(''); setStatus('all'); setLanguage('all'); setOnlyMissing(false);
  };

  const updateForm = (key, value) => setForm(current => ({ ...current, [key]: value }));

  return (
    <section className="admin-stack">
      <AdminCard
        className="admin-studio-publisher-card"
        eyebrow="PUBLISHER"
        title={chapterPublishProject === 'pdpkl' ? 'Publish Pal Do Pal Ke Lamhe' : (editing ? `Edit ${editing.chapterNumber ? `Chapter ${editing.chapterNumber}` : 'Unnumbered Entry'}` : 'Upload a chapter')}
        description="Publishing controls stay on the existing chapters table and R2 paths. This layer adds safer controls and a faster operational view."
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
          actions={editing ? <AdminButton type="button" icon="close" onClick={onReset}>Cancel</AdminButton> : null}
        >
          <form onSubmit={onSubmit} className="admin-form">
            <div className="admin-form-grid">
              <label>
                <span>Chapter number</span>
                <input type="number" min="1" value={form.number} onChange={event => updateForm('number', event.target.value)} placeholder="Optional" />
              </label>
              <label>
                <span>Language</span>
                <select value={form.language} onChange={event => updateForm('language', event.target.value)} disabled={Boolean(editing)}>
                  <option value="hi">Hindi</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={form.status} onChange={event => updateForm('status', event.target.value)}>
                  <option>Published</option>
                  <option>Scheduled</option>
                  <option>Pre-uploaded</option>
                  <option>Draft</option>
                </select>
              </label>
              <label>
                <span>Release date</span>
                <input type="datetime-local" value={form.releaseDate} onChange={event => updateForm('releaseDate', event.target.value)} />
              </label>
              <label className="wide">
                <span>Title</span>
                <input value={form.title} onChange={event => updateForm('title', event.target.value)} placeholder="Chapter title" required />
              </label>
              <label className="wide">
                <span>Description</span>
                <textarea value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Description shown with the chapter" rows="3" />
              </label>
              <label>
                <span>Cover image</span>
                <input type="file" accept="image/*" onChange={event => updateForm('cover', event.target.files?.[0] || null)} />
              </label>
            </div>

            <label className="admin-dropzone">
              <strong>Manga pages</strong>
              <span>Select pages in the exact order you want them published. Existing upload validation and R2 paths are unchanged.</span>
              <input type="file" multiple accept="image/*" onChange={event => {
                const files = Array.from(event.target.files || []);
                updateForm('pages', files);
              }} />
              {form.pages.length > 0 ? <em>{form.pages.length} pages ready · selected order preserved</em> : null}
            </label>

            {progress?.total > 0 ? (
              <div className="admin-progress" aria-live="polite">
                <div><span>{progress.text}</span><b>{progress.current}/{progress.total}</b></div>
                <i><span style={{ width: `${(progress.current / progress.total) * 100}%` }} /></i>
              </div>
            ) : null}

            <div className="admin-form-actions">
              <AdminButton type="submit" variant="primary" size="lg" disabled={busy} icon={busy ? 'refresh' : editing ? 'bookmark' : 'layers'}>
                {busy ? 'Working…' : editing ? 'Save chapter changes' : 'Upload chapter'}
              </AdminButton>
              {!editing ? <AdminButton type="button" onClick={onNewChapter}>Clear</AdminButton> : null}
            </div>
          </form>
        </AdminCard>
      )}

      {notice ? <div className="ar-admin-notice success" role="status">{notice}</div> : null}

      <AdminCard
        eyebrow="LIBRARY"
        title="Chapter manager"
        description={`${filtered.length} shown · ${chapters.length} total · ${missingCount} missing pages. Performance analytics remain in the Overview rather than being fabricated here.`}
        actions={
          <AdminButton type="button" icon="refresh" onClick={onReload} disabled={busy}>Refresh</AdminButton>
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

        <AdminTable>
          <thead>
            <tr>
              <th className="admin-check-cell"><input type="checkbox" checked={allVisibleSelected} onChange={event => selectAllVisible(event.target.checked)} aria-label="Select all visible chapters" /></th>
              {columns.chapter ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('chapter')}>Chapter {sortBy === 'chapter' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
              {columns.status ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('status')}>Status {sortBy === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
              {columns.language ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('language')}>Language {sortBy === 'language' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
              {columns.pages ? <th><button className="admin-th-button" type="button" onClick={() => toggleSort('pages')}>Pages {sortBy === 'pages' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th> : null}
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
                  {columns.pages ? <td className="admin-table-muted">{pageCount.toLocaleString('en-IN')}</td> : null}
                  {columns.release ? <td className="admin-table-muted">{formatDate(chapter.releaseDate)}</td> : null}
                  {columns.signal ? <td><span className={`admin-health-signal ${signal.className}`}><i />{signal.text}</span></td> : null}
                  {columns.actions ? (
                    <td>
                      <div className="admin-row-actions">
                        <AdminButton size="sm" className="admin-table-action" type="button" icon="bookmark" onClick={() => onEdit(chapter)}>Edit</AdminButton>
                        <AdminButton size="sm" className="admin-table-action" type="button" variant="danger" icon="flag" onClick={() => onDelete(chapter)} disabled={busy}>Delete</AdminButton>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </AdminTable>

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
