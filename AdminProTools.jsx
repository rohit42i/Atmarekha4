import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';

const since = days => new Date(Date.now() - days * 86400000).toISOString();
const fmt = value => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const chapterLabel = c => c?.chapter_number == null ? (c?.title || 'Special') : `Chapter ${c.chapter_number}`;
const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

async function verifyAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Admin session required.');
  const role = await getAdminRole(user.id);
  if (role !== 'owner' && role !== 'admin') throw new Error('Admin access required.');
  return { user, role };
}

async function headCount(table, filter) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

function downloadCsv(rows, filename) {
  const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminProTools() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [nav, setNav] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(30);
  const [data, setData] = useState({ chapters: [], pages: [], comments: [], reports: 0, openReports: 0, users: 0, announcements: 0, views: 0 });
  const searchRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        await verifyAdmin();
        if (alive) setIsAdmin(true);
      } catch {
        if (alive) setIsAdmin(false);
      }
    };
    check();
    const { data: listener } = supabase.auth.onAuthStateChange(check);
    return () => { alive = false; listener?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const attach = () => {
      const element = document.querySelector('.admin-tabs');
      if (element) {
        setNav(element);
        return true;
      }
      return false;
    };
    if (attach()) return undefined;
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isAdmin]);

  useEffect(() => {
    if (!open) return undefined;
    const keydown = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [open]);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setNotice('');
    try {
      await verifyAdmin();
      const [chaptersResult, pagesResult, commentsResult, reports, openReports, users, announcements, views] = await Promise.all([
        supabase.from('chapters').select('id,chapter_number,title,status,release_date,cover_url,created_at').order('chapter_number', { ascending: true, nullsFirst: false }),
        supabase.from('chapter_pages').select('chapter_id,page_number,image_url').order('page_number', { ascending: true }),
        supabase.from('comments').select('id,author_name,content,chapter_id,created_at').order('created_at', { ascending: false }).limit(80),
        headCount('moderation_reports'),
        headCount('moderation_reports', q => q.eq('status', 'open')),
        headCount('profiles'),
        headCount('announcements'),
        headCount('chapter_views', q => q.gte('created_at', since(range)))
      ]);
      for (const result of [chaptersResult, pagesResult, commentsResult]) if (result.error) throw result.error;
      setData({
        chapters: chaptersResult.data || [],
        pages: pagesResult.data || [],
        comments: commentsResult.data || [],
        reports,
        openReports,
        users,
        announcements,
        views
      });
    } catch (error) {
      setNotice(error?.message || 'Unable to load admin control data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open, range, isAdmin]);

  const pageCounts = useMemo(() => {
    const map = new Map();
    for (const page of data.pages) map.set(page.chapter_id, (map.get(page.chapter_id) || 0) + 1);
    return map;
  }, [data.pages]);

  const published = useMemo(() => data.chapters.filter(c => String(c.status).toLowerCase() === 'published'), [data.chapters]);
  const drafts = useMemo(() => data.chapters.filter(c => String(c.status).toLowerCase() !== 'published'), [data.chapters]);
  const missingPages = useMemo(() => published.filter(c => !pageCounts.get(c.id)), [published, pageCounts]);
  const missingCovers = useMemo(() => published.filter(c => !c.cover_url), [published]);
  const upcoming = useMemo(() => [...data.chapters]
    .filter(c => c.release_date && new Date(c.release_date).getTime() > Date.now())
    .sort((a, b) => new Date(a.release_date) - new Date(b.release_date))
    .slice(0, 4), [data.chapters]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return { chapters: data.chapters.slice(0, 8), comments: data.comments.slice(0, 8) };
    return {
      chapters: data.chapters.filter(c => `${chapterLabel(c)} ${c.title || ''} ${c.status || ''}`.toLowerCase().includes(needle)).slice(0, 12),
      comments: data.comments.filter(c => `${c.author_name || ''} ${c.content || ''}`.toLowerCase().includes(needle)).slice(0, 12)
    };
  }, [data.chapters, data.comments, query]);

  const go = tab => {
    setOpen(false);
    document.querySelector('.admin-tabs button')?.focus();
    const buttons = [...document.querySelectorAll('.admin-tabs button')];
    buttons.find(button => button.textContent.trim().startsWith(tab))?.click();
  };

  const exportReport = () => {
    const rows = [
      ['Atma Rekha Admin Report', new Date().toISOString()],
      [],
      ['Metric', 'Value'],
      ['Total chapters', data.chapters.length],
      ['Published chapters', published.length],
      ['Draft/pre-uploaded chapters', drafts.length],
      ['Published chapters missing pages', missingPages.length],
      ['Published chapters missing covers', missingCovers.length],
      ['Open moderation reports', data.openReports],
      ['All moderation reports', data.reports],
      ['Registered users', data.users],
      [`Views in last ${range} days`, data.views],
      ['Announcements', data.announcements],
      [],
      ['Chapter', 'Status', 'Pages', 'Release date'],
      ...data.chapters.map(c => [chapterLabel(c), c.status || '', pageCounts.get(c.id) || 0, c.release_date || ''])
    ];
    downloadCsv(rows, `atma-rekha-admin-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const button = nav && createPortal(
    <button type="button" className="ar-pro-tab" onClick={() => setOpen(true)}>
      <span>Studio</span>
      <b>{data.openReports ? data.openReports : 'Pro'}</b>
    </button>,
    nav
  );

  if (!isAdmin) return null;

  return <>
    {button}
    <style>{`
      .ar-pro-tab{width:100%;min-height:44px;padding:0 13px;border:1px solid transparent;border-radius:10px;background:var(--card-bg);color:var(--text-color);display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:850;cursor:pointer}
      .ar-pro-tab:hover{background:var(--surface-2-color);border-color:var(--border-color)}
      .ar-pro-tab b{font-size:8px;padding:4px 7px;border-radius:99px;background:var(--surface-2-color);color:var(--muted-color)}
      .ar-pro-backdrop{position:fixed;inset:0;z-index:10030;background:var(--overlay-color);backdrop-filter:blur(12px);display:grid;place-items:center;padding:24px}
      .ar-pro-panel{width:min(1280px,100%);max-height:94vh;overflow:auto;background:var(--card-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:26px;box-shadow:0 35px 120px var(--shadow-color)}
      .ar-pro-head{padding:24px 28px 20px;border-bottom:1px solid var(--border-soft-color);display:flex;align-items:flex-start;gap:18px}
      .ar-pro-head small{font-size:8px;font-weight:900;letter-spacing:.18em;color:var(--faint-color);text-transform:uppercase}
      .ar-pro-head h2{margin:5px 0 0;font-size:28px;letter-spacing:-.05em}
      .ar-pro-head p{margin:7px 0 0;color:var(--muted-color);font-size:11px}
      .ar-pro-close{margin-left:auto;width:40px;height:40px;border:1px solid var(--border-color);border-radius:12px;background:var(--surface-2-color);color:var(--text-color);font-size:21px;cursor:pointer}
      .ar-pro-body{padding:20px 28px 30px}
      .ar-pro-search{display:flex;gap:9px;margin-bottom:14px}
      .ar-pro-search input{flex:1;height:44px;padding:0 14px;background:var(--input-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:12px;font-size:11px}
      .ar-pro-search button,.ar-pro-range button{height:44px;padding:0 13px;border:1px solid var(--border-color);border-radius:12px;background:var(--surface-2-color);color:var(--text-color);font-size:10px;font-weight:850;cursor:pointer}
      .ar-pro-range{display:flex;gap:5px}.ar-pro-range button{height:32px}.ar-pro-range button.active{background:var(--accent-color);color:var(--accent-contrast);border-color:var(--accent-color)}
      .ar-pro-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}
      .ar-pro-kpi{padding:15px;border:1px solid var(--border-color);border-radius:15px;background:var(--surface-color)}
      .ar-pro-kpi span{display:block;font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--faint-color)}
      .ar-pro-kpi strong{display:block;margin-top:6px;font-size:25px;letter-spacing:-.05em}
      .ar-pro-kpi small{display:block;margin-top:4px;color:var(--muted-color);font-size:9px}
      .ar-pro-kpi.alert strong,.ar-pro-kpi.alert small{color:var(--danger-color)}
      .ar-pro-kpi.good strong,.ar-pro-kpi.good small{color:var(--success-color)}
      .ar-pro-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);gap:12px;margin-top:12px}
      .ar-pro-card{border:1px solid var(--border-color);border-radius:17px;overflow:hidden;background:var(--surface-color)}
      .ar-pro-card-head{padding:14px 16px;border-bottom:1px solid var(--border-soft-color);display:flex;justify-content:space-between;gap:10px;align-items:center}
      .ar-pro-card-head h3{margin:0;font-size:11px}.ar-pro-card-head span{font-size:8px;color:var(--faint-color)}
      .ar-pro-list{padding:4px 16px}.ar-pro-list article{padding:12px 0;border-bottom:1px solid var(--border-soft-color);display:flex;gap:10px;align-items:center}.ar-pro-list article:last-child{border-bottom:0}
      .ar-pro-list article>div{min-width:0;flex:1}.ar-pro-list strong{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ar-pro-list small{display:block;margin-top:3px;color:var(--muted-color);font-size:8px}
      .ar-pro-badge{padding:4px 7px;border-radius:99px;font-size:7px;font-weight:900;text-transform:uppercase;white-space:nowrap}
      .ar-pro-badge.warn{background:var(--warning-bg);color:var(--warning-color)}.ar-pro-badge.good{background:var(--success-bg);color:var(--success-color)}
      .ar-pro-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px}.ar-pro-actions button{min-height:43px;border:1px solid var(--border-color);border-radius:11px;background:var(--surface-2-color);color:var(--text-color);font-size:9px;font-weight:850;cursor:pointer}.ar-pro-actions button:hover{border-color:var(--text-color)}
      .ar-pro-empty{padding:28px 16px;text-align:center;color:var(--faint-color);font-size:10px}
      .ar-pro-health{padding:5px 16px}.ar-pro-health-row{display:flex;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid var(--border-soft-color);font-size:10px}.ar-pro-health-row:last-child{border-bottom:0}.ar-pro-health-row b{font-size:9px}.ar-pro-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;background:currentColor}
      .ar-pro-shortcuts{padding:12px 16px;color:var(--muted-color);font-size:9px;line-height:1.8;border-top:1px solid var(--border-soft-color)}
      @media(max-width:1000px){.ar-pro-kpis{grid-template-columns:repeat(3,1fr)}.ar-pro-grid{grid-template-columns:1fr}}
      @media(max-width:560px){.ar-pro-backdrop{padding:0}.ar-pro-panel{height:100%;max-height:none;border-radius:0}.ar-pro-head,.ar-pro-body{padding-left:15px;padding-right:15px}.ar-pro-kpis{grid-template-columns:1fr 1fr}.ar-pro-search{flex-wrap:wrap}.ar-pro-search input{flex-basis:100%}}
    `}</style>
    {open && <div className="ar-pro-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="ar-pro-panel" role="dialog" aria-modal="true" aria-label="Atma Rekha Admin Studio">
        <header className="ar-pro-head">
          <div><small>ATMA REKHA · ADMIN STUDIO</small><h2>Control Room</h2><p>Publishing health, moderation signals, content search and operational tools in one place.</p></div>
          <button type="button" className="ar-pro-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </header>
        <div className="ar-pro-body">
          {notice && <div className="ar-pro-notice" style={{ marginBottom: 12, color: 'var(--danger-color)', fontSize: 10 }}>{notice}</div>}
          <div className="ar-pro-search">
            <input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search chapters or comments…  Ctrl / Cmd + K" aria-label="Search admin data" />
            <button type="button" onClick={load}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
            <button type="button" onClick={exportReport}>Export CSV</button>
          </div>
          <div className="ar-pro-range">
            {[7,30,90].map(days => <button key={days} type="button" className={range === days ? 'active' : ''} onClick={() => setRange(days)}>{days}D</button>)}
          </div>
          <div className="ar-pro-kpis" style={{ marginTop: 10 }}>
            <div className="ar-pro-kpi"><span>Chapters</span><strong>{data.chapters.length}</strong><small>{published.length} published</small></div>
            <div className={`ar-pro-kpi ${drafts.length ? 'alert' : 'good'}`}><span>Queue</span><strong>{drafts.length}</strong><small>{drafts.length ? 'Needs attention' : 'Clear'}</small></div>
            <div className={`ar-pro-kpi ${data.openReports ? 'alert' : 'good'}`}><span>Open reports</span><strong>{data.openReports}</strong><small>{data.reports} total reports</small></div>
            <div className={`ar-pro-kpi ${missingPages.length ? 'alert' : 'good'}`}><span>Page gaps</span><strong>{missingPages.length}</strong><small>Published without pages</small></div>
            <div className={`ar-pro-kpi ${missingCovers.length ? 'alert' : 'good'}`}><span>Cover gaps</span><strong>{missingCovers.length}</strong><small>Published without covers</small></div>
            <div className="ar-pro-kpi"><span>Views</span><strong>{data.views.toLocaleString('en-IN')}</strong><small>Last {range} days</small></div>
          </div>
          <div className="ar-pro-grid">
            <section className="ar-pro-card">
              <div className="ar-pro-card-head"><h3>{query ? 'Search results' : 'Publishing queue'}</h3><span>{query ? `${results.chapters.length + results.comments.length} matches` : `${upcoming.length} scheduled`}</span></div>
              <div className="ar-pro-list">
                {query ? <>
                  {results.chapters.map(c => <article key={c.id}><div><strong>{chapterLabel(c)} · {c.title || 'Untitled'}</strong><small>{c.status || 'No status'} · {pageCounts.get(c.id) || 0} pages</small></div><span className="ar-pro-badge">{c.status || 'unknown'}</span></article>)}
                  {results.comments.map(c => <article key={`comment-${c.id}`}><div><strong>{c.author_name || 'Reader'} · {c.content || ''}</strong><small>{fmt(c.created_at)}</small></div><span className="ar-pro-badge">Comment</span></article>)}
                  {!results.chapters.length && !results.comments.length && <div className="ar-pro-empty">No matching content.</div>}
                </> : <>
                  {drafts.slice(0, 8).map(c => <article key={c.id}><div><strong>{chapterLabel(c)} · {c.title || 'Untitled'}</strong><small>{c.status || 'No status'} · {pageCounts.get(c.id) || 0} pages · {fmt(c.release_date)}</small></div><span className="ar-pro-badge warn">Action</span></article>)}
                  {upcoming.map(c => <article key={`up-${c.id}`}><div><strong>{chapterLabel(c)} · {c.title || 'Untitled'}</strong><small>Scheduled · {fmt(c.release_date)}</small></div><span className="ar-pro-badge good">Ready</span></article>)}
                  {!drafts.length && !upcoming.length && <div className="ar-pro-empty">Publishing queue is clear.</div>}
                </>}
              </div>
            </section>
            <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <section className="ar-pro-card">
                <div className="ar-pro-card-head"><h3>System health</h3><span>Live checks</span></div>
                <div className="ar-pro-health">
                  <div className="ar-pro-health-row"><span><i className="ar-pro-dot" style={{ color: 'var(--success-color)' }} />Admin auth</span><b>Verified</b></div>
                  <div className="ar-pro-health-row"><span><i className="ar-pro-dot" style={{ color: 'var(--success-color)' }} />Chapter data</span><b>Online</b></div>
                  <div className="ar-pro-health-row"><span><i className={`ar-pro-dot`} style={{ color: missingPages.length ? 'var(--warning-color)' : 'var(--success-color)' }} />Page integrity</span><b>{missingPages.length ? 'Review' : 'Ready'}</b></div>
                  <div className="ar-pro-health-row"><span><i className="ar-pro-dot" style={{ color: data.openReports ? 'var(--warning-color)' : 'var(--success-color)' }} />Moderation</span><b>{data.openReports ? 'Review' : 'Clear'}</b></div>
                </div>
                <div className="ar-pro-shortcuts">Ctrl/Cmd + K focuses search · Esc closes Studio</div>
              </section>
              <section className="ar-pro-card">
                <div className="ar-pro-card-head"><h3>Quick actions</h3><span>Safe navigation</span></div>
                <div className="ar-pro-actions">
                  <button type="button" onClick={() => go('Chapters')}>Chapters</button>
                  <button type="button" onClick={() => go('Pages')}>Page manager</button>
                  <button type="button" onClick={() => go('Reports')}>Reports</button>
                  <button type="button" onClick={() => go('Comments')}>Comments</button>
                  <button type="button" onClick={() => go('Announcements')}>Announcements</button>
                  <button type="button" onClick={() => go('Media')}>Media</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </div>}
  </>;
}
