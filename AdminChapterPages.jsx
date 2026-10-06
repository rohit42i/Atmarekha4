import { useEffect, useMemo, useState } from 'react';
import { supabase, cloudflareR2 } from './supabase';
import { getAdminRole } from './adminAuth';
import { chapterLanguageLabel, normalizeChapterLanguage } from './chapters';
import { buildPdlplChapters, PDLPL_PAGES } from './palDoPalKeLamhe';
import { fetchPdlplMedia, removePdlplFiles, uploadPdlplFile } from './pdlplR2';
import { AdminIcon } from './admin-redesign-ui.jsx';

const ATMA_PAGES = 'chapter_pages';
const ATMA_BUCKET = 'chapter-pages';
const ATMA_MAX = 20 * 1024 * 1024;
const PDPKL_MAX = 95 * 1024 * 1024;

const safeExt = file => String(file?.name || '').split('.').pop()?.toLowerCase() || 'jpg';
const isImage = file => file instanceof File && (String(file.type || '').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|avif)$/i.test(file.name || ''));
const projectName = project => project === 'pdpkl' ? 'Pal Do Pal Ke Lamhe' : 'Atma Rekha';
const publicAtmaUrl = path => cloudflareR2.from(ATMA_BUCKET).getPublicUrl(path).data.publicUrl;
const atmaPath = url => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${ATMA_BUCKET}/`;
  const i = String(url).indexOf(marker);
  return i < 0 ? null : decodeURIComponent(String(url).slice(i + marker.length));
};

async function adminUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await getAdminRole(user.id))) throw new Error('Admin access required.');
  return user;
}

async function audit(user, action, type, id, details = {}) {
  try { await supabase.from('admin_activity_log').insert({ admin_user_id: user?.id, action, entity_type: type, entity_id: id, details }); } catch (_) {}
}

function Artwork({ project, page, className = '', alt = '' }) {
  const [src, setSrc] = useState(project === 'atma' ? page.image_url : '');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    setError('');
    if (project === 'atma') { setSrc(page.image_url || ''); return undefined; }
    setSrc('');
    fetchPdlplMedia(page.image_path)
      .then(url => { objectUrl = url; if (alive) setSrc(url); else URL.revokeObjectURL(url); })
      .catch(err => { if (alive) setError(err?.message || 'Preview unavailable'); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [project, page.id, page.image_url, page.image_path]);
  return src ? <img className={className} src={src} alt={alt} /> : <div className={className + ' studio-art-placeholder'}>{error || 'Loading artwork…'}</div>;
}

export default function AdminChapterPages({ chapters = [] }) {
  const [project, setProject] = useState('atma');
  const [language, setLanguage] = useState('all');
  const [pdpklChapters, setPdpklChapters] = useState([]);
  const [chapterId, setChapterId] = useState('');
  const [pages, setPages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [retryFiles, setRetryFiles] = useState({});

  const source = project === 'pdpkl' ? pdpklChapters : chapters;
  const visibleChapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...source].filter(ch => {
      const langOk = language === 'all' || normalizeChapterLanguage(ch.language) === language;
      const qOk = !q || `${ch.chapterNumber ?? ''} ${ch.title || ''} ${ch.status || ''}`.toLowerCase().includes(q);
      return langOk && qOk;
    }).sort((a,b) => (Number(a.chapterNumber) || 99999) - (Number(b.chapterNumber) || 99999));
  }, [source, language, search]);

  const chapter = source.find(ch => ch.id === chapterId) || visibleChapters[0];
  const selected = pages.find(p => p.id === selectedId) || pages[0] || null;

  useEffect(() => {
    if (project !== 'pdpkl') return;
    let alive = true;
    buildPdlplChapters().then(rows => { if (alive) setPdpklChapters(rows); }).catch(err => setNotice(err?.message || 'PDPKL chapters could not be loaded.'));
    return () => { alive = false; };
  }, [project]);

  useEffect(() => {
    const next = visibleChapters.find(ch => ch.id === chapterId)?.id || visibleChapters[0]?.id || '';
    if (next !== chapterId) setChapterId(next);
  }, [visibleChapters, chapterId]);

  const loadPages = async () => {
    if (!chapterId) { setPages([]); return; }
    setBusy('load');
    try {
      await adminUser();
      const table = project === 'pdpkl' ? PDLKL_PAGES : ATMA_PAGES;
      const fields = project === 'pdpkl' ? 'id,chapter_id,page_number,image_path' : 'id,chapter_id,page_number,image_url';
      const { data, error } = await supabase.from(table).select(fields).eq('chapter_id', chapterId).order('page_number', { ascending: true });
      if (error) throw error;
      setPages(data || []);
      setSelectedId(data?.[0]?.id || null);
      setDiagnostic('');
    } catch (err) { setDiagnostic(err?.message || 'Unable to load pages.'); }
    finally { setBusy(''); }
  };

  useEffect(() => { loadPages(); }, [project, chapterId]);

  const replacePage = async (page, file) => {
    if (!file || busy || !isImage(file)) return;
    if (file.size > (project === 'pdpkl' ? PDPKL_MAX : ATMA_MAX)) {
      setNotice(file.name + ' exceeds the upload limit.');
      return;
    }
    setBusy(page.id);
    setNotice('');
    setDiagnostic('');
    let uploadedPath = null;
    let committed = false;
    try {
      const user = await adminUser();
      uploadedPath = page.chapter_id + '/replacements/' + page.id + '-' + Date.now() + '.' + safeExt(file);
      if (project === 'pdpkl') {
        await uploadPdlplFile(file, uploadedPath);
        const { error } = await supabase.rpc('pdlpl_replace_chapter_page', { p_page_id: page.id, p_image_path: uploadedPath });
        if (error) throw error;
        committed = true;
        if (page.image_path) { try { await removePdlplFiles([page.image_path]); } catch (err) { await audit(user, 'r2_cleanup_failed', 'pdlpl_page', page.id, { path: page.image_path, error: err.message }); } }
        setPages(rows => rows.map(row => row.id === page.id ? { ...row, image_path: uploadedPath } : row));
      } else {
        const { error } = await cloudflareR2.from(ATMA_BUCKET).upload(uploadedPath, file, { upsert: false, contentType: file.type || undefined, cacheControl: '31536000' });
        if (error) throw error;
        const nextUrl = publicAtmaUrl(uploadedPath);
        const { error: updateError } = await supabase.from(ATMA_PAGES).update({ image_url: nextUrl }).eq('id', page.id);
        if (updateError) throw updateError;
        committed = true;
        const old = atmaPath(page.image_url);
        if (old) { try { await cloudflareR2.from(ATMA_BUCKET).remove([old]); } catch (err) { await audit(user, 'r2_cleanup_failed', 'chapter_page', page.id, { path: old, error: err.message }); } }
        setPages(rows => rows.map(row => row.id === page.id ? { ...row, image_url: nextUrl } : row));
      }
      setRetryFiles(rows => { const next = { ...rows }; delete next[page.id]; return next; });
      await audit(user, project === 'pdpkl' ? 'replace_pdlpl_page' : 'replace_chapter_page', project === 'pdpkl' ? 'pdlpl_page' : 'chapter_page', page.id, { chapter_id: page.chapter_id, page_number: page.page_number, file_name: file.name });
      setNotice(projectName(project) + ' · Page ' + page.page_number + ' replaced.');
    } catch (err) {
      if (uploadedPath && !committed) {
        try {
          if (project === 'pdpkl') await removePdlplFiles([uploadedPath]);
          else await cloudflareR2.from(ATMA_BUCKET).remove([uploadedPath]);
        } catch (_) {}
      }
      setRetryFiles(rows => ({ ...rows, [page.id]: file }));
      setDiagnostic(err?.message || 'Page replacement failed.');
      setNotice('Replacement failed. The original page is still active.');
    } finally { setBusy(''); }
  };

  const movePage = async (page, direction) => {
    if (!page || busy) return;
    const index = pages.findIndex(p => p.id === page.id);
    const target = pages[index + direction];
    if (!target) return;
    setBusy('move');
    try {
      await adminUser();
      const rpc = project === 'pdpkl' ? 'pdlpl_reorder_chapter_page' : 'reorder_chapter_page';
      const { error } = await supabase.rpc(rpc, { p_page_id: page.id, p_direction: direction });
      if (error) throw error;
      await loadPages();
    } catch (err) { setDiagnostic(err?.message || 'Could not reorder page.'); }
    finally { setBusy(''); }
  };

  const deletePage = async page => {
    if (!page || busy || !window.confirm(`Delete ${projectName(project)} · Page ${page.page_number}? This cannot be undone.`)) return;
    setBusy(page.id);
    try {
      const user = await adminUser();
      const rpc = project === 'pdpkl' ? 'pdlpl_delete_chapter_page' : 'delete_chapter_page';
      const { error } = await supabase.rpc(rpc, { p_page_id: page.id });
      if (error) throw error;
      if (project === 'pdpkl' && page.image_path) { try { await removePdlplFiles([page.image_path]); } catch (err) { await audit(user, 'r2_cleanup_failed', 'pdlpl_page', page.id, { path: page.image_path, error: err.message }); } }
      if (project === 'atma') { const old = atmaPath(page.image_url); if (old) { try { await cloudflareR2.from(ATMA_BUCKET).remove([old]); } catch (err) { await audit(user, 'r2_cleanup_failed', 'chapter_page', page.id, { path: old, error: err.message }); } } }
      await audit(user, 'delete_page', project === 'pdpkl' ? 'pdlpl_page' : 'chapter_page', page.id, { chapter_id: page.chapter_id, page_number: page.page_number, project });
      await loadPages();
      setNotice('Page deleted.');
    } catch (err) { setDiagnostic(err?.message || 'Page deletion failed.'); }
    finally { setBusy(''); }
  };

  return (
    <section className="admin-stack studio-page-workspace">
      <div className="studio-page-hero">
        <div>
          <span className="studio-eyebrow">CREATIVE DESK</span>
          <h2>Page editor</h2>
          <p>Pick a project, language and chapter. Then edit the exact artwork readers receive.</p>
        </div>
        <div className="studio-project-switch" role="tablist" aria-label="Project switch">
          {['atma','pdpkl'].map(key => (
            <button key={key} type="button" className={project === key ? 'is-active' : ''} onClick={() => { setProject(key); setLanguage('all'); setChapterId(''); setPages([]); }}>
              <span className="studio-project-mark">{key === 'atma' ? 'AR' : 'PP'}</span>
              <span><b>{key === 'atma' ? 'Atma Rekha' : 'Pal Do Pal Ke Lamhe'}</b><small>{key === 'atma' ? 'Main manga' : 'Side story'}</small></span>
            </button>
          ))}
        </div>
      </div>

      <div className="studio-page-controls">
        <label><span>Language</span><select value={language} onChange={e => setLanguage(e.target.value)}><option value="all">All languages</option><option value="hi">Hindi</option><option value="en">English</option></select></label>
        <label className="studio-search-field"><span>Chapter</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or number…" /></label>
        <div className="studio-page-meta"><strong>{visibleChapters.length}</strong><span>chapters in view</span></div>
      </div>

      <div className="studio-chapter-strip">
        {visibleChapters.map(ch => (
          <button type="button" key={ch.id} className={ch.id === chapterId ? 'is-active' : ''} onClick={() => { setChapterId(ch.id); setSelectedId(null); }}>
            <span className="studio-chapter-number">{ch.chapterNumber ?? 'S'}</span>
            <span><b>{ch.title || (ch.chapterNumber ? 'Chapter ' + ch.chapterNumber : 'Special')}</b><small>{chapterLanguageLabel(ch.language)} · {ch.status || 'Draft'}</small></span>
          </button>
        ))}
        {!visibleChapters.length ? <div className="studio-no-results">No chapters match this project/language/search.</div> : null}
      </div>

      <div className="studio-page-main">
        <section className="studio-page-grid-card">
          <header className="studio-panel-head">
            <div><span>{projectName(project)} · {chapter ? chapterLanguageLabel(chapter.language) : 'Language'}</span><h3>{chapter ? ((chapter.chapterNumber ? 'Chapter ' + chapter.chapterNumber : 'Special') + ' · ' + (chapter.title || 'Untitled')) : 'Select a chapter'}</h3><p>{pages.length} pages · click to inspect · drag support can be added later without changing storage.</p></div>
            <button type="button" onClick={loadPages} disabled={Boolean(busy)}><AdminIcon name="refresh" size={15}/>Refresh</button>
          </header>

          {diagnostic ? <div className="studio-diagnostic" role="alert"><AdminIcon name="flag" size={14}/><span>{diagnostic}</span></div> : null}

          {busy === 'load' ? <div className="studio-page-loading"><span/><b>Opening page desk…</b></div> :
            !pages.length ? <div className="studio-page-zero"><AdminIcon name="image" size={24}/><strong>No pages here yet</strong><p>Use Chapter Manager to create the chapter/page set first. This editor is for precise page-level maintenance.</p></div> :
            <div className="studio-page-grid">{pages.map(page => (
              <button type="button" key={page.id} className={`studio-page-grid-item ${selected?.id === page.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(page.id)}>
                <span className="studio-grid-number">{String(page.page_number).padStart(2,'0')}</span>
                <Artwork project={project} page={page} className="studio-grid-art" />
                <span className="studio-grid-footer"><b>Page {page.page_number}</b>{retryFiles[page.id] ? <i>Retry</i> : null}</span>
              </button>
            ))}</div>}
        </section>

        <aside className="studio-page-inspector">
          <header className="studio-panel-head"><div><span>INSPECTOR</span><h3>{selected ? 'Page ' + selected.page_number : 'Select artwork'}</h3><p>{selected ? projectName(project) + ' · ' + chapterLanguageLabel(chapter?.language) : 'Choose a thumbnail to edit it.'}</p></div></header>
          {selected ? <>
            <div className="studio-inspector-art"><Artwork project={project} page={selected} className="studio-large-art" /></div>
            <div className="studio-inspector-info"><div><span>Position</span><strong>{selected.page_number}</strong><small>of {pages.length}</small></div><div><span>Language</span><strong>{chapterLanguageLabel(chapter?.language)}</strong><small>{project === 'pdpkl' ? 'PDPKL' : 'ATMA'}</small></div><div><span>Status</span><strong>{busy === selected.id ? 'Saving…' : 'Ready'}</strong><small>Protected</small></div></div>
            <div className="studio-inspector-actions">
              <label className="studio-replace"><AdminIcon name="image" size={16}/><b>Replace artwork</b><small>JPG / PNG / WEBP · max {project === 'pdpkl' ? '95 MB' : '20 MB'}</small><input type="file" accept="image/*" disabled={Boolean(busy)} onChange={e => { const f=e.target.files?.[0]; e.target.value=''; replacePage(selected,f); }}/></label>
              {retryFiles[selected.id] ? <button type="button" className="studio-retry" disabled={Boolean(busy)} onClick={() => replacePage(selected,retryFiles[selected.id])}>Retry replacement</button> : null}
              <div className="studio-two-actions"><button type="button" disabled={Boolean(busy) || selected.page_number <= 1} onClick={() => movePage(selected,-1)}>← Move back</button><button type="button" disabled={Boolean(busy) || selected.page_number >= pages.length} onClick={() => movePage(selected,1)}>Move forward →</button></div>
              <button type="button" className="studio-delete-action" disabled={Boolean(busy)} onClick={() => deletePage(selected)}>Delete page</button>
            </div>
          </> : <div className="studio-inspector-empty"><AdminIcon name="image" size={25}/><strong>Nothing selected</strong><span>Click any page thumbnail to open the editor.</span></div>}
        </aside>
      </div>
      {notice ? <div className="studio-toast" role="status">{notice}</div> : null}
    </section>
  );
}
