import { useEffect, useState } from 'react';
import { supabase, cloudflareR2 } from './supabase';
import { getAdminRole } from './adminAuth';

const PAGES = 'chapter_pages';
const BUCKET = 'chapter-pages';
const MAX_PAGE_SIZE = 20 * 1024 * 1024;

const publicUrl = path => cloudflareR2.from(BUCKET).getPublicUrl(path).data.publicUrl;
const pathFromUrl = url => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index < 0 ? null : decodeURIComponent(url.slice(index + marker.length));
};

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Your Supabase session has expired.');
  const role = await getAdminRole(user.id);
  if (!role) throw new Error('Admin access required.');
  return user;
}

export default function AdminChapterPages({ chapters }) {
  const [chapterId, setChapterId] = useState(chapters?.[0]?.id || '');
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [retryFiles, setRetryFiles] = useState({});
  const [notice, setNotice] = useState('');

  const selectedChapter = chapters.find(chapter => chapter.id === chapterId);
  useEffect(() => { if (!chapterId && chapters?.[0]?.id) setChapterId(chapters[0].id); }, [chapters, chapterId]);

  const loadPages = async () => {
    if (!chapterId) return;
    setLoading(true); setNotice('');
    try { await requireAdmin(); const { data, error } = await supabase.from(PAGES).select('id, chapter_id, page_number, image_url').eq('chapter_id', chapterId).order('page_number', { ascending: true }); if (error) throw error; setPages(data || []); }
    catch (error) { setNotice(error.message || 'Unable to load pages.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadPages(); }, [chapterId]);

  const replacePage = async (page, file) => {
    if (!file || busyId) return;
    if (!file.type.startsWith('image/')) { setNotice('Please select an image.'); return; }
    if (file.size > MAX_PAGE_SIZE) { setNotice(`${file.name} is larger than 20 MB.`); return; }
    setBusyId(page.id); setNotice(''); let newPath = null;
    let adminUser = null;
    try {
      adminUser = await requireAdmin();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      newPath = `${page.chapter_id}/replacements/${page.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await cloudflareR2.from(BUCKET).upload(newPath, file, { upsert: false, contentType: file.type || undefined, cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const nextUrl = publicUrl(newPath);
      const { error: updateError } = await supabase.from(PAGES).update({ image_url: nextUrl }).eq('id', page.id);
      if (updateError) throw updateError;
      const oldPath = pathFromUrl(page.image_url); if (oldPath) await cloudflareR2.from(BUCKET).remove([oldPath]);
      setPages(current => current.map(item => item.id === page.id ? { ...item, image_url: nextUrl } : item));
      setRetryFiles(current => { const next = { ...current }; delete next[page.id]; return next; });
      await supabase.from('admin_activity_log').insert({ admin_user_id: adminUser.id, action: 'replace_chapter_page', entity_type: 'chapter_page', entity_id: page.id, details: { chapter_id: page.chapter_id, page_number: page.page_number, file_name: file.name } });
      setNotice(`Page ${page.page_number} replaced successfully.`);
    } catch (error) {
      if (newPath) await cloudflareR2.from(BUCKET).remove([newPath]);
      setRetryFiles(current => ({ ...current, [page.id]: file }));
      if (adminUser) await supabase.from('admin_activity_log').insert({ admin_user_id: adminUser.id, action: 'replace_chapter_page_failed', entity_type: 'chapter_page', entity_id: page.id, details: { chapter_id: page.chapter_id, page_number: page.page_number, file_name: file.name, error: error.message } });
      setNotice(error.message || 'Page replacement failed. The old page was kept. You can retry the same file.');
    } finally { setBusyId(null); }
  };

  const movePage = async (index, direction) => {
    const otherIndex = index + direction; if (otherIndex < 0 || otherIndex >= pages.length || busyId) return;
    const a = pages[index], b = pages[otherIndex]; setBusyId(`move-${a.id}`); setNotice('');
    try { const user = await requireAdmin(); const first = await supabase.from(PAGES).update({ page_number: 0 }).eq('id', a.id); if (first.error) throw first.error; const second = await supabase.from(PAGES).update({ page_number: a.page_number }).eq('id', b.id); if (second.error) throw second.error; const third = await supabase.from(PAGES).update({ page_number: b.page_number }).eq('id', a.id); if (third.error) throw third.error; await supabase.from('admin_activity_log').insert({ admin_user_id: user.id, action: 'reorder_chapter_page', entity_type: 'chapter_page', entity_id: a.id, details: { chapter_id: a.chapter_id, from: a.page_number, to: b.page_number } }); await loadPages(); }
    catch (error) { setNotice(error.message || 'Could not reorder pages.'); await loadPages(); }
    finally { setBusyId(null); }
  };

  const deletePage = async page => {
    if (busyId || !window.confirm(`Delete page ${page.page_number}? This cannot be undone.`)) return;
    setBusyId(page.id); setNotice('');
    try { const user = await requireAdmin(); const { error } = await supabase.from(PAGES).delete().eq('id', page.id); if (error) throw error; const path = pathFromUrl(page.image_url); if (path) await cloudflareR2.from(BUCKET).remove([path]); const remaining = pages.filter(item => item.id !== page.id); for (let i = 0; i < remaining.length; i += 1) if (remaining[i].page_number !== i + 1) { const { error: reorderError } = await supabase.from(PAGES).update({ page_number: i + 1 }).eq('id', remaining[i].id); if (reorderError) throw reorderError; } await supabase.from('admin_activity_log').insert({ admin_user_id: user.id, action: 'delete_chapter_page', entity_type: 'chapter_page', entity_id: page.id, details: { chapter_id: page.chapter_id, page_number: page.page_number } }); await loadPages(); setNotice(`Page ${page.page_number} deleted.`); }
    catch (error) { setNotice(error.message || 'Page deletion failed.'); await loadPages(); }
    finally { setBusyId(null); }
  };

  return <section className="admin-stack">
    <section className="admin-card"><div className="admin-card-title"><div><span>PAGE MANAGER</span><h2>Manage individual pages</h2><p>Replace, retry, reorder, or delete a single page without re-uploading the chapter. A failed replacement keeps the old page intact and keeps the selected file ready for retry.</p></div></div><select value={chapterId} onChange={event => setChapterId(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">{!chapters.length && <option value="">No chapters available</option>}{chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.chapterNumber ? `Chapter ${chapter.chapterNumber}` : 'Unnumbered'} — {chapter.title || 'Untitled'}</option>)}</select>{selectedChapter && <p className="mt-3 text-sm text-zinc-500">{pages.length} page{pages.length === 1 ? '' : 's'} · changes apply directly to the selected chapter.</p>}</section>
    {notice && <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-sm">{notice}</div>}
    {loading ? <div className="admin-loading">Loading pages…</div> : !pages.length ? <section className="admin-card"><p className="muted center">This chapter has no readable pages yet.</p></section> : <section className="admin-card"><div className="admin-page-manager-grid">{pages.map((page, index) => <article key={page.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3"><div className="mb-3 flex items-center justify-between"><strong>Page {page.page_number}</strong><span className="text-xs text-zinc-500">{index + 1}/{pages.length}</span></div><img src={page.image_url} alt={`Page ${page.page_number}`} loading="lazy" className="mb-3 max-h-96 w-full rounded-xl object-contain bg-black"/><div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold">Replace<input type="file" accept="image/*" className="hidden" disabled={!!busyId} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; replacePage(page, file); }}/></label>{retryFiles[page.id] && <button type="button" onClick={() => replacePage(page, retryFiles[page.id])} disabled={!!busyId} className="rounded-xl border border-amber-700 px-3 py-2 text-sm font-bold text-amber-300">Retry</button>}<button type="button" onClick={() => movePage(index, -1)} disabled={!!busyId || index === 0} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold">↑</button><button type="button" onClick={() => movePage(index, 1)} disabled={!!busyId || index === pages.length - 1} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold">↓</button><button type="button" onClick={() => deletePage(page)} disabled={!!busyId} className="rounded-xl border border-rose-900 px-3 py-2 text-sm font-bold text-rose-300">Delete</button></div>{retryFiles[page.id] && <p className="mt-2 text-xs text-amber-300">Replacement failed. The original page is still active; retry the same file.</p>}{busyId === page.id && <p className="mt-2 text-xs text-zinc-500">Working…</p>}</article>)}</div></section>}
  </section>;
}
