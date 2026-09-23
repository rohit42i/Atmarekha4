import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { supabase, cloudflareR2 } from './supabase';
import { removePdlplFiles } from './pdlplR2';
import { getAdminRole } from './adminAuth';

const fmt = value => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Admin session required.');
  const role = await getAdminRole(user.id);
  if (!role) throw new Error('Admin access required.');
  return user;
}

function Section({ label, title, text, children }) {
  return <section className="ar-ops-section"><header><div><span>{label}</span><h3>{title}</h3>{text && <p>{text}</p>}</div></header>{children}</section>;
}

export default function AdminOperations() {
  const [isAdmin, setIsAdmin] = useState(false), [nav, setNav] = useState(null), [open, setOpen] = useState(false);
  const [chapters, setChapters] = useState([]), [deleted, setDeleted] = useState([]), [logs, setLogs] = useState([]), [notifications, setNotifications] = useState([]), [failures, setFailures] = useState([]), [users, setUsers] = useState([]);
  const [subscriberCount, setSubscriberCount] = useState(0), [today, setToday] = useState({ views: 0, readers: 0, likes: 0 });
  const [selectedChapter, setSelectedChapter] = useState(null), [previewPages, setPreviewPages] = useState([]), [previewLoading, setPreviewLoading] = useState(false);
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [target, setTarget] = useState('all'), [selectedUser, setSelectedUser] = useState(''), [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');

  const load = async () => {
    try {
      await requireAdmin();
      const [chapterResult, archivedResult, logResult, notificationResult, profileResult, statsResult, viewResult, likeResult] = await Promise.all([
        supabase.from('chapters').select('id,chapter_number,title,description,status,release_date,cover_url,deleted_at,deleted_previous_status,created_at').order('chapter_number', { ascending: true, nullsFirst: false }),
        supabase.from('chapters').select('id,chapter_number,title,status,deleted_at,deleted_previous_status').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('admin_activity_log').select('id,action,entity_type,entity_id,details,created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('admin_notification_log').select('id,title,body,target,target_count,sent_count,failed_count,removed_count,status,scheduled_for,sent_at,created_at,error').order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('id,username,display_name').order('display_name', { ascending: true, nullsFirst: false }).limit(250),
        supabase.functions.invoke('get-admin-user-stats'),
        supabase.from('chapter_views').select('viewer_key,created_at').gte('created_at', todayStart()),
        supabase.from('chapter_likes').select('id,created_at').gte('created_at', todayStart()),
      ]);
      for (const result of [chapterResult, archivedResult, logResult, notificationResult, profileResult, viewResult, likeResult]) if (result.error) throw result.error;
      if (statsResult.error) throw statsResult.error;
      const viewRows = viewResult.data || [];
      setToday({ views: viewRows.length, readers: new Set(viewRows.map(row => row.viewer_key).filter(Boolean)).size, likes: (likeResult.data || []).length });
      setSubscriberCount(Number(statsResult.data?.notification_users || 0));
      setChapters(chapterResult.data || []); setDeleted(archivedResult.data || []); setLogs(logResult.data || []); setNotifications(notificationResult.data || []); setUsers(profileResult.data || []);
      setFailures((logResult.data || []).filter(row => /fail|error/i.test(String(row.action || '')) || row.details?.error));
    } catch (error) { setNotice(error.message || 'Unable to load operations data.'); }
  };

  useEffect(() => {
    let alive = true;
    const check = async () => { try { await requireAdmin(); if (alive) setIsAdmin(true); } catch { if (alive) setIsAdmin(false); } };
    check();
    const { data } = supabase.auth.onAuthStateChange(check);
    return () => { alive = false; data?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => { if (!isAdmin) return; const attach = () => { const el = document.querySelector('.admin-tabs'); if (el) { setNav(el); return true; } return false; }; if (attach()) return; const observer = new MutationObserver(attach); observer.observe(document.body, { childList: true, subtree: true }); return () => observer.disconnect(); }, [isAdmin]);
  useEffect(() => { if (open) load(); }, [open, isAdmin]);
  useEffect(() => { if (!open) return undefined; const id = window.setInterval(load, 30000); return () => window.clearInterval(id); }, [open]);

  const activeChapters = useMemo(() => chapters.filter(chapter => !chapter.deleted_at), [chapters]);
  const selectedProfile = users.find(user => user.id === selectedUser);

  const updateChapter = async (chapter, patch, action, confirmation = null) => {
    if (busy) return;
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true); setNotice('');
    try {
      const user = await requireAdmin();
      const { error } = await supabase.from('chapters').update(patch).eq('id', chapter.id);
      if (error) throw error;
      await supabase.from('admin_activity_log').insert({ admin_user_id: user.id, action, entity_type: 'chapter', entity_id: chapter.id, details: { chapter_number: chapter.chapter_number, title: chapter.title, ...patch } });
      setNotice('Chapter updated successfully.'); await load();
    } catch (error) {
      setNotice(error.message || 'Chapter update failed.');
      try { const user = await requireAdmin(); await supabase.from('admin_activity_log').insert({ admin_user_id: user.id, action: `${action}_failed`, entity_type: 'chapter', entity_id: chapter.id, details: { error: error.message } }); } catch (_) {}
    } finally { setBusy(false); }
  };

  const retryCleanup = async item => {
    if (busy) return;
    const details = item?.details || {};
    const paths = Array.isArray(details.paths) ? details.paths.filter(Boolean) : [];
    const provider = details.provider === 'pdpl' ? 'pdpl' : 'atma';
    const bucket = details.bucket;
    if (!paths.length || (provider === 'atma' && !bucket)) {
      setNotice('This cleanup record does not contain enough media information to retry.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      await requireAdmin();
      if (provider === 'pdpl') {
        await removePdlplFiles(paths);
      } else {
        const { error } = await cloudflareR2.from(bucket).remove(paths);
        if (error) throw error;
      }
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('admin_activity_log').insert({
        admin_user_id: user.id,
        action: 'r2_cleanup_retried',
        entity_type: item.entity_type || 'media',
        entity_id: item.entity_id || null,
        details: { provider, bucket: bucket || null, paths, source_failure_id: item.id },
      });
      setNotice('R2 cleanup completed successfully.');
      await load();
    } catch (error) {
      setNotice(error.message || 'R2 cleanup retry failed. The file remains available for another retry.');
    } finally {
      setBusy(false);
    }
  };

  const preview = async chapter => {
    setSelectedChapter(chapter); setPreviewPages([]); setPreviewLoading(true);
    try {
      const { data, error } = await supabase.from('chapter_pages').select('page_number,image_url').eq('chapter_id', chapter.id).order('page_number', { ascending: true });
      if (error) throw error; setPreviewPages(data || []);
    } catch (error) { setNotice(error.message || 'Preview could not be loaded.'); }
    finally { setPreviewLoading(false); }
  };

  const archive = chapter => updateChapter(chapter, { deleted_at: new Date().toISOString(), deleted_previous_status: chapter.status || 'Draft', status: 'Archived' }, 'archive_chapter', `Archive ${chapter.chapter_number ? `Chapter ${chapter.chapter_number}` : chapter.title || 'this chapter'}? Nothing will be permanently deleted. It will remain in Recovery.`);
  const restore = chapter => updateChapter(chapter, { deleted_at: null, status: chapter.deleted_previous_status || 'Draft' }, 'restore_chapter');
  const unpublish = chapter => updateChapter(chapter, { status: 'Draft' }, 'unpublish_chapter', `Unpublish ${chapter.chapter_number ? `Chapter ${chapter.chapter_number}` : chapter.title || 'this chapter'}? It will remain stored and editable.`);

  const send = async test => {
    if (busy) return;
    if (!title.trim() || !body.trim()) { setNotice('Add a notification title and message.'); return; }
    const actualTarget = test ? `user:${(await supabase.auth.getUser()).data.user?.id}` : target === 'user' ? `user:${selectedUser}` : target;
    if (target === 'user' && !selectedUser && !test) { setNotice('Select a user first.'); return; }
    setBusy(true); setNotice('');
    try {
      const user = await requireAdmin();
      const dedupeKey = `admin:${actualTarget}:${title.trim()}:${body.trim()}:${scheduleAt || 'now'}`;
      if (scheduleAt && new Date(scheduleAt).getTime() > Date.now() + 5000 && !test) {
        const { error } = await supabase.from('admin_notification_log').insert({ admin_user_id: user.id, title: title.trim(), body: body.trim(), target: actualTarget, status: 'scheduled', scheduled_for: new Date(scheduleAt).toISOString(), dedupe_key: dedupeKey });
        if (error) throw error;
        await supabase.from('admin_activity_log').insert({ admin_user_id: user.id, action: 'schedule_notification', entity_type: 'notification', details: { target: actualTarget, scheduled_for: scheduleAt, title: title.trim() } });
        setNotice('Scheduled notification record created.'); setScheduleAt(''); await load(); return;
      }
      const { data, error } = await supabase.functions.invoke('send-chapter-notification-v2', { body: { title: title.trim(), body: body.trim(), target: actualTarget, dedupeKey, url: '/' } });
      if (error) throw error;
      if (!data?.ok) { if (data?.duplicate) throw new Error('Duplicate notification blocked.'); throw new Error(data?.error || 'Notification failed.'); }
      setNotice(`Notification sent: ${data.sent || 0} delivered, ${data.failed || 0} failed.`); await load();
    } catch (error) {
      setNotice(error.message || 'Notification failed.');
      try { const user = await requireAdmin(); await supabase.from('admin_activity_log').insert({ admin_user_id: user.id, action: 'send_notification_failed', entity_type: 'notification', details: { target: actualTarget, error: error.message } }); } catch (_) {}
    } finally { setBusy(false); }
  };

  if (!isAdmin) return null;
  const button = nav && createPortal(<button className="ar-ops-tab" onClick={() => setOpen(true)}><span>Operations</span><b>{failures.length || 'Live'}</b></button>, nav);

  return <>{button}<style>{`
    .ar-ops-tab{width:100%;min-height:44px;padding:0 13px;border:1px solid transparent;border-radius:10px;background:var(--card-bg);color:var(--text-color);display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:850;cursor:pointer}.ar-ops-tab:hover{background:var(--surface-2-color)}.ar-ops-tab b{font-size:8px;padding:4px 7px;border-radius:99px;background:var(--surface-2-color);color:var(--muted-color)}
    .ar-ops-backdrop{position:fixed;inset:0;z-index:10035;background:var(--overlay-color);backdrop-filter:blur(12px);display:grid;place-items:center;padding:24px;font-family:Inter,system-ui,sans-serif}.ar-ops-panel{width:min(1240px,100%);max-height:94vh;overflow:auto;background:var(--card-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:24px;box-shadow:0 35px 120px var(--shadow-color)}.ar-ops-head{padding:22px 26px;border-bottom:1px solid var(--border-soft-color);display:flex;gap:18px}.ar-ops-head small{font-size:8px;font-weight:900;letter-spacing:.18em;color:var(--faint-color);text-transform:uppercase}.ar-ops-head h2{margin:5px 0 0;font-size:26px;letter-spacing:-.04em}.ar-ops-head p{margin:5px 0 0;color:var(--muted-color);font-size:10px}.ar-ops-close{margin-left:auto;width:38px;height:38px;border:1px solid var(--border-color);border-radius:11px;background:var(--surface-2-color);color:var(--text-color);font-size:20px;cursor:pointer}.ar-ops-body{padding:18px 26px 28px}.ar-ops-notice{margin-bottom:12px;padding:11px 13px;border:1px solid var(--border-color);border-radius:12px;font-size:10px}.ar-ops-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}.ar-ops-metric{padding:14px;border:1px solid var(--border-color);border-radius:14px;background:var(--surface-color)}.ar-ops-metric span{display:block;color:var(--faint-color);font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.ar-ops-metric strong{display:block;margin-top:5px;font-size:24px}.ar-ops-metric small{display:block;margin-top:3px;color:var(--muted-color);font-size:8px}.ar-ops-grid{display:grid;grid-template-columns:1.25fr .9fr;gap:12px}.ar-ops-section{border:1px solid var(--border-color);border-radius:15px;background:var(--surface-color);overflow:hidden;margin-bottom:12px}.ar-ops-section header{padding:14px 16px;border-bottom:1px solid var(--border-soft-color)}.ar-ops-section header span{font-size:8px;font-weight:900;letter-spacing:.12em;color:var(--faint-color);text-transform:uppercase}.ar-ops-section h3{margin:4px 0 0;font-size:13px}.ar-ops-section header p{margin:4px 0 0;color:var(--muted-color);font-size:9px}.ar-ops-list{display:grid}.ar-ops-row{padding:12px 16px;border-bottom:1px solid var(--border-soft-color);display:flex;gap:10px;align-items:center}.ar-ops-row:last-child{border-bottom:0}.ar-ops-row-main{min-width:0;flex:1}.ar-ops-row-main strong{display:block;font-size:10px}.ar-ops-row-main p{margin:3px 0 0;color:var(--muted-color);font-size:8px}.ar-ops-actions{display:flex;flex-wrap:wrap;gap:6px}.ar-ops-actions button,.ar-ops-select,.ar-ops-input{border:1px solid var(--border-color);border-radius:9px;background:var(--surface-2-color);color:var(--text-color);font-size:9px;font-weight:800}.ar-ops-actions button{padding:7px 9px;cursor:pointer}.ar-ops-actions button.danger{color:var(--danger-color)}.ar-ops-form{padding:14px 16px;display:grid;gap:8px}.ar-ops-form input,.ar-ops-form textarea,.ar-ops-form select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--border-color);border-radius:9px;background:var(--input-bg);color:var(--text-color);font-size:10px}.ar-ops-form textarea{min-height:76px;resize:vertical}.ar-ops-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ar-ops-form-actions{display:flex;flex-wrap:wrap;gap:7px}.ar-ops-primary{background:var(--accent-color)!important;color:var(--accent-contrast)!important;border-color:var(--accent-color)!important}.ar-ops-history{max-height:290px;overflow:auto}.ar-ops-status{font-size:8px;font-weight:900;text-transform:uppercase}.ar-ops-status.failed{color:var(--danger-color)}.ar-ops-status.scheduled{color:var(--accent-color)}.ar-ops-status.sent{color:var(--success-color)}.ar-ops-preview{position:fixed;inset:0;z-index:10045;background:var(--overlay-color);display:grid;place-items:center;padding:20px}.ar-ops-preview-panel{width:min(1050px,100%);max-height:92vh;overflow:auto;background:var(--card-bg);border:1px solid var(--border-color);border-radius:20px}.ar-ops-preview-head{padding:16px 18px;border-bottom:1px solid var(--border-soft-color);display:flex;gap:10px}.ar-ops-preview-head h3{margin:0;font-size:14px}.ar-ops-preview-head p{margin:3px 0 0;color:var(--muted-color);font-size:9px}.ar-ops-preview-close{margin-left:auto;border:1px solid var(--border-color);border-radius:8px;background:var(--surface-2-color);color:var(--text-color);cursor:pointer}.ar-ops-preview-pages{padding:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ar-ops-preview-pages img{width:100%;max-height:430px;object-fit:contain;background:#000;border-radius:10px}.ar-ops-empty{padding:22px;text-align:center;color:var(--faint-color);font-size:9px}@media(max-width:850px){.ar-ops-grid{grid-template-columns:1fr}.ar-ops-metrics{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.ar-ops-backdrop{padding:0}.ar-ops-panel{height:100%;max-height:none;border-radius:0}.ar-ops-head,.ar-ops-body{padding-left:14px;padding-right:14px}.ar-ops-form-grid{grid-template-columns:1fr}.ar-ops-preview{padding:0}.ar-ops-preview-panel{height:100%;max-height:none;border-radius:0}.ar-ops-preview-pages{grid-template-columns:1fr}}
  `}</style>
  {open && <div className="ar-ops-backdrop" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}><section className="ar-ops-panel">
    <header className="ar-ops-head"><div><small>Atma Rekha · Admin</small><h2>Operations</h2><p>Chapter control, recovery, notifications, delivery history and audit information in one place.</p></div><button className="ar-ops-close" onClick={() => setOpen(false)}>×</button></header>
    <div className="ar-ops-body">
      {notice && <div className="ar-ops-notice">{notice}</div>}
      <div className="ar-ops-metrics"><div className="ar-ops-metric"><span>Today · Views</span><strong>{today.views.toLocaleString('en-IN')}</strong><small>Live 30s refresh</small></div><div className="ar-ops-metric"><span>Today · Readers</span><strong>{today.readers.toLocaleString('en-IN')}</strong><small>Unique viewer keys</small></div><div className="ar-ops-metric"><span>Today · Likes</span><strong>{today.likes.toLocaleString('en-IN')}</strong><small>New likes today</small></div><div className="ar-ops-metric"><span>Unique Push Subscribers</span><strong>{subscriberCount.toLocaleString('en-IN')}</strong><small>From active push subscriptions</small></div></div>
      <div className="ar-ops-grid"><div>
        <Section label="CHAPTER CONTROL" title="Status, preview & publishing" text="Use preview before publishing. Unpublish keeps the chapter and pages intact."><div className="ar-ops-list">{activeChapters.map(chapter => <article className="ar-ops-row" key={chapter.id}><div className="ar-ops-row-main"><strong>{chapter.chapter_number ? `Chapter ${chapter.chapter_number}` : 'Unnumbered'} — {chapter.title || 'Untitled'}</strong><p>{chapter.status || 'Draft'} · {chapter.release_date ? `Release ${fmt(chapter.release_date)}` : 'No release date'}</p></div><div className="ar-ops-actions"><button onClick={() => preview(chapter)}>Preview</button><select className="ar-ops-select" value={chapter.status || 'Draft'} onChange={e => updateChapter(chapter, { status: e.target.value }, 'change_chapter_status')} disabled={busy}><option>Draft</option><option>Pre-uploaded</option><option>Scheduled</option><option>Published</option></select>{String(chapter.status).toLowerCase() === 'published' && <button onClick={() => unpublish(chapter)}>Unpublish</button>}<button className="danger" onClick={() => archive(chapter)}>Archive</button></div></article>)}{!activeChapters.length && <div className="ar-ops-empty">No active chapters.</div>}</div></Section>
        <Section label="RECOVERY" title="Safe Archive → Recovery" text="Archived chapters keep their database row and can be restored to the previous status."><div className="ar-ops-list">{deleted.map(chapter => <article className="ar-ops-row" key={chapter.id}><div className="ar-ops-row-main"><strong>{chapter.chapter_number ? `Chapter ${chapter.chapter_number}` : 'Unnumbered'} — {chapter.title || 'Untitled'}</strong><p>Archived {fmt(chapter.deleted_at)} · previous status: {chapter.deleted_previous_status || 'Draft'}</p></div><div className="ar-ops-actions"><button onClick={() => restore(chapter)} disabled={busy}>Restore</button></div></article>)}{!deleted.length && <div className="ar-ops-empty">Recovery is empty.</div>}</div></Section>
        <Section label="FAILED OPERATIONS" title="Failed-operation panel" text="Recorded failures stay here until you recover them. R2 cleanup failures can be retried without touching the database record."><div className="ar-ops-list">{failures.map(item => <article className="ar-ops-row" key={item.id}><div className="ar-ops-row-main"><strong>{item.action}</strong><p>{item.details?.error || 'Operation failed'} · {fmt(item.created_at)}</p></div><div className="ar-ops-actions">{((Array.isArray(item.details?.paths) && item.details.paths.length) && (item.details?.provider === 'pdpl' || item.details?.bucket)) && <button onClick={() => retryCleanup(item)} disabled={busy}>Retry cleanup</button>}</div></article>)}{!failures.length && <div className="ar-ops-empty">No failed admin operations recorded.</div>}</div></Section>
      </div><div>
        <Section label="NOTIFICATIONS" title="Send notification" text={`${subscriberCount.toLocaleString('en-IN')} unique push subscribers.`}><div className="ar-ops-form"><div className="ar-ops-form-grid"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title"/><select value={target} onChange={e => setTarget(e.target.value)}><option value="all">Everyone</option><option value="community">Community</option><option value="user">Selected user</option></select></div>{target === 'user' && <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}><option value="">Select a user…</option>{users.map(user => <option key={user.id} value={user.id}>{user.display_name || user.username || user.id.slice(0, 8)}</option>)}</select>}<textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Notification message"/><label style={{fontSize:9,color:'var(--muted-color)'}}>Schedule (optional)<input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)}/></label><div className="ar-ops-form-actions"><button onClick={() => send(true)} disabled={busy}>Test on myself</button><button className="ar-ops-primary" onClick={() => send(false)} disabled={busy}>{scheduleAt ? 'Save scheduled record' : 'Send notification'}</button><button onClick={load} disabled={busy}>Refresh</button></div><small style={{color:'var(--faint-color)',fontSize:8}}>Duplicate sends are blocked by a unique notification key.</small></div></Section>
        <Section label="DELIVERY" title="Notification history"><div className="ar-ops-list ar-ops-history">{notifications.map(item => <article className="ar-ops-row" key={item.id}><div className="ar-ops-row-main"><strong>{item.title || 'Notification'}</strong><p>{item.target} · {item.sent_count || 0}/{item.target_count || 0} delivered · {item.failed_count || 0} failed · {fmt(item.sent_at || item.scheduled_for || item.created_at)}</p><span className={`ar-ops-status ${item.status === 'failed' ? 'failed' : item.status === 'scheduled' ? 'scheduled' : item.status === 'sent' ? 'sent' : ''}`}>{item.status}</span></div></article>)}{!notifications.length && <div className="ar-ops-empty">No notification records yet.</div>}</div></Section>
        <Section label="AUDIT" title="Admin activity log"><div className="ar-ops-list ar-ops-history">{logs.map(item => <article className="ar-ops-row" key={item.id}><div className="ar-ops-row-main"><strong>{item.action}</strong><p>{item.entity_type || 'system'}{item.details?.title ? ` · ${item.details.title}` : ''} · {fmt(item.created_at)}</p></div></article>)}{!logs.length && <div className="ar-ops-empty">No activity logged yet.</div>}</div></Section>
      </div></div>
    </div>
  </section></div>}
  {selectedChapter && <div className="ar-ops-preview" onMouseDown={e => e.target === e.currentTarget && setSelectedChapter(null)}><section className="ar-ops-preview-panel"><header className="ar-ops-preview-head"><div><h3>{selectedChapter.chapter_number ? `Chapter ${selectedChapter.chapter_number}` : 'Unnumbered'} — {selectedChapter.title || 'Untitled'}</h3><p>{selectedChapter.status || 'Draft'} · {previewPages.length} pages · preview only</p></div><button className="ar-ops-preview-close" onClick={() => setSelectedChapter(null)}>×</button></header>{previewLoading ? <div className="ar-ops-empty">Loading preview…</div> : <div className="ar-ops-preview-pages">{previewPages.map(page => <img key={page.page_number} src={page.image_url} alt={`Page ${page.page_number}`} loading="lazy"/>)}{!previewPages.length && <div className="ar-ops-empty">No readable pages available for preview.</div>}</div>}</section></div>}
  </>;
}
