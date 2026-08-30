import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const since = days => new Date(Date.now() - days * 86400000).toISOString();
const formatTime = value => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

async function verifyAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Admin session required.');
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Admin access required.');
  return user;
}

async function count(table, extra = () => true) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  query = extra(query) || query;
  const { count: value, error } = await query;
  if (error) throw error;
  return value || 0;
}

export default function AdminCommandCenter() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [nav, setNav] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [metrics, setMetrics] = useState({ readers: 0, newReaders: 0, chapters: 0, comments: 0, community: 0, reports: 0 });
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try { await verifyAdmin(); if (alive) setIsAdmin(true); }
      catch { if (alive) setIsAdmin(false); }
    };
    check();
    const { data: listener } = supabase.auth.onAuthStateChange(() => check());
    return () => { alive = false; listener?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const attach = () => {
      const el = document.querySelector('.admin-tabs');
      if (el) { setNav(el); return true; }
      return false;
    };
    if (attach()) return undefined;
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isAdmin]);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true); setNotice('');
    try {
      await verifyAdmin();
      const [readers, newReaders, chapters, comments, community, reports] = await Promise.all([
        count('profiles'),
        count('profiles', q => q.gte('created_at', since(7))),
        count('chapters'),
        count('comments'),
        count('community_posts'),
        count('moderation_reports', q => q.eq('status', 'open')),
      ]);

      const results = await Promise.all([
        supabase.from('chapters').select('chapter_number,title,created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('community_posts').select('title,created_at,published_at').order('published_at', { ascending: false }).limit(5),
        supabase.from('comments').select('author_name,content,created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('moderation_reports').select('reason,created_at,status').order('created_at', { ascending: false }).limit(5),
      ]);
      results.forEach(r => { if (r.error) throw r.error; });
      const [c, p, co, r] = results;
      const next = [
        ...(c.data || []).map(x => ({ type: 'Chapter', title: `Chapter ${x.chapter_number} · ${x.title || 'Untitled'}`, time: x.created_at })),
        ...(p.data || []).map(x => ({ type: 'Community', title: x.title || 'Community post', time: x.published_at || x.created_at })),
        ...(co.data || []).map(x => ({ type: 'Comment', title: `${x.author_name || 'Reader'} · ${String(x.content || '').slice(0, 72)}`, time: x.created_at })),
        ...(r.data || []).map(x => ({ type: 'Report', title: x.reason || 'Moderation report', time: x.created_at, status: x.status })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);
      setMetrics({ readers, newReaders, chapters, comments, community, reports });
      setActivity(next);
    } catch (error) {
      setNotice(error?.message || 'Unable to load dashboard data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open, isAdmin]);

  const button = nav && createPortal(
    <button type="button" className="ar-command-tab" onClick={() => setOpen(true)}>
      <span>Command center</span><b>{metrics.reports > 0 ? metrics.reports : 'Live'}</b>
    </button>, nav
  );

  const cards = useMemo(() => [
    ['Readers', metrics.readers, `+${metrics.newReaders} this week`, 'ar-command-neutral'],
    ['Chapters', metrics.chapters, 'Published content', 'ar-command-neutral'],
    ['Comments', metrics.comments, 'Reader activity', 'ar-command-neutral'],
    ['Community', metrics.community, 'Creator posts', 'ar-command-neutral'],
    ['Open reports', metrics.reports, metrics.reports ? 'Needs review' : 'All clear', metrics.reports ? 'ar-command-alert' : 'ar-command-good'],
  ], [metrics]);

  if (!isAdmin) return null;

  return <>
    {button}
    <style>{`
      .ar-command-tab{width:100%;min-height:44px;padding:0 13px;border:1px solid transparent;border-radius:10px;background:var(--card-bg,#fff);color:var(--text-color,#111);display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;font-size:11px;font-weight:850;cursor:pointer}
      .ar-command-tab:hover{background:var(--surface-2-color,#f5f5f5)}
      .ar-command-tab b{font-size:8px;letter-spacing:.05em;padding:4px 7px;border-radius:999px;background:var(--surface-2-color,#f5f5f5);color:var(--muted-color,#666)}
      .ar-command-backdrop{position:fixed;inset:0;z-index:10020;background:color-mix(in srgb,var(--overlay-color,#0008) 88%,#000);display:grid;place-items:center;padding:24px;font-family:Inter,system-ui,sans-serif}
      .ar-command-panel{width:min(1180px,100%);max-height:min(900px,92vh);overflow:auto;background:var(--card-bg,#fff);color:var(--text-color,#111);border:1px solid var(--border-color,#ddd);border-radius:24px;box-shadow:0 30px 100px var(--shadow-color,#0003)}
      .ar-command-head{padding:24px 26px 18px;border-bottom:1px solid var(--border-soft-color,#e8e8e8);display:flex;align-items:flex-start;gap:16px}.ar-command-head small{font-size:9px;font-weight:900;letter-spacing:.16em;color:var(--faint-color,#777);text-transform:uppercase}.ar-command-head h2{margin:5px 0 0;font-size:26px;letter-spacing:-.045em}.ar-command-head p{margin:6px 0 0;color:var(--muted-color,#666);font-size:11px}.ar-command-close{margin-left:auto;width:38px;height:38px;border:1px solid var(--border-color,#ddd);border-radius:11px;background:var(--surface-2-color,#f5f5f5);color:var(--text-color,#111);font-size:20px;cursor:pointer}
      .ar-command-body{padding:20px 26px 28px}.ar-command-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.ar-command-card{padding:16px;border:1px solid var(--border-color,#ddd);border-radius:15px;background:var(--surface-color,#fafafa)}.ar-command-card span{display:block;font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.1em;color:var(--faint-color,#777)}.ar-command-card strong{display:block;margin-top:7px;font-size:26px;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.ar-command-card small{display:block;margin-top:5px;color:var(--muted-color,#666);font-size:9px}.ar-command-alert strong,.ar-command-alert small{color:var(--danger-color,#b42318)}.ar-command-good strong,.ar-command-good small{color:var(--success-color,#146c2e)}
      .ar-command-layout{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.85fr);gap:12px;margin-top:12px}.ar-command-section{border:1px solid var(--border-color,#ddd);border-radius:15px;overflow:hidden}.ar-command-section-head{padding:13px 15px;border-bottom:1px solid var(--border-soft-color,#e8e8e8);display:flex;align-items:center;justify-content:space-between}.ar-command-section-head h3{margin:0;font-size:11px}.ar-command-section-head span{font-size:9px;color:var(--faint-color,#777)}.ar-command-feed{padding:3px 15px}.ar-command-feed article{padding:12px 0;border-bottom:1px solid var(--border-soft-color,#e8e8e8)}.ar-command-feed article:last-child{border-bottom:0}.ar-command-feed strong{display:block;font-size:11px}.ar-command-feed time{display:block;margin-top:4px;color:var(--faint-color,#777);font-size:9px}.ar-command-pill{display:inline-flex;margin-bottom:5px;padding:3px 6px;border:1px solid var(--border-color,#ddd);border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.ar-command-health{padding:15px}.ar-command-health-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--border-soft-color,#e8e8e8);font-size:10px}.ar-command-health-row:last-child{border-bottom:0}.ar-command-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:7px;background:currentColor}.ar-command-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:15px}.ar-command-action{min-height:42px;padding:0 10px;border:1px solid var(--border-color,#ddd);border-radius:10px;background:var(--surface-2-color,#f5f5f5);color:var(--text-color,#111);font-size:10px;font-weight:800;cursor:pointer}.ar-command-action:hover{border-color:var(--text-color,#111)}.ar-command-empty{padding:35px 15px;text-align:center;color:var(--faint-color,#777);font-size:10px}
      @media(max-width:900px){.ar-command-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ar-command-layout{grid-template-columns:1fr}.ar-command-panel{max-height:95vh}}
      @media(max-width:520px){.ar-command-backdrop{padding:0}.ar-command-panel{height:100%;max-height:none;border-radius:0}.ar-command-head,.ar-command-body{padding-left:15px;padding-right:15px}.ar-command-grid{grid-template-columns:1fr 1fr}.ar-command-card strong{font-size:22px}}
    `}</style>
    {open && <div className="ar-command-backdrop" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}>
      <section className="ar-command-panel" role="dialog" aria-modal="true" aria-label="Atma Rekha admin command center">
        <header className="ar-command-head"><div><small>Atma Rekha · Admin</small><h2>Command center</h2><p>A compact operational view of readers, content, community and moderation.</p></div><button className="ar-command-close" onClick={() => setOpen(false)} aria-label="Close">×</button></header>
        <div className="ar-command-body">
          {notice && <div role="alert" style={{ marginBottom: 12, color: 'var(--danger-color)', fontSize: 11 }}>{notice}</div>}
          <div className="ar-command-grid">{cards.map(([label, value, note, cls]) => <div key={label} className={`ar-command-card ${cls}`}><span>{label}</span><strong>{loading ? '—' : value}</strong><small>{note}</small></div>)}</div>
          <div className="ar-command-layout">
            <section className="ar-command-section"><div className="ar-command-section-head"><h3>Live activity</h3><span>{activity.length} recent events</span></div><div className="ar-command-feed">{loading ? <div className="ar-command-empty">Refreshing dashboard…</div> : activity.length ? activity.map((x, i) => <article key={`${x.type}-${x.time}-${i}`}><span className="ar-command-pill">{x.type}</span><strong>{x.title}</strong><time>{formatTime(x.time)}</time></article>) : <div className="ar-command-empty">No recent activity.</div>}</div></section>
            <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
              <section className="ar-command-section"><div className="ar-command-section-head"><h3>System pulse</h3><span>Database checks</span></div><div className="ar-command-health"><div className="ar-command-health-row"><span><i className="ar-command-dot" />Profiles</span><b>Online</b></div><div className="ar-command-health-row"><span><i className="ar-command-dot" />Chapters</span><b>Online</b></div><div className="ar-command-health-row"><span><i className="ar-command-dot" />Community</span><b>Online</b></div><div className="ar-command-health-row"><span><i className="ar-command-dot" />Moderation</span><b>{metrics.reports ? 'Review' : 'Clear'}</b></div></div></section>
              <section className="ar-command-section"><div className="ar-command-section-head"><h3>Quick actions</h3><span>Open existing tools</span></div><div className="ar-command-actions"><button className="ar-command-action" onClick={() => document.querySelector('.ar-admin-extra-tab:nth-of-type(1)')?.click()}>Manage users</button><button className="ar-command-action" onClick={() => document.querySelector('.ar-mod-launch')?.click()}>Moderation</button><button className="ar-command-action" onClick={() => document.querySelector('.community-admin-launch')?.click()}>Community</button><button className="ar-command-action" onClick={() => load()}>Refresh data</button></div></section>
            </div>
          </div>
        </div>
      </section>
    </div>}
  </>;
}
