import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const DAY = 24 * 60 * 60 * 1000;

export default function AdminModerationTools() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (alive) setIsAdmin(Boolean(data));
    };
    check();
    const { data: listener } = supabase.auth.onAuthStateChange(() => check());
    return () => { alive = false; listener?.subscription?.unsubscribe(); };
  }, []);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true); setNotice('');
    try {
      const [{ data: reportRows, error: reportError }, { data: userRows, error: userError }] = await Promise.all([
        supabase.from('moderation_reports').select('id,user_id,source_type,source_id,reason,offense_count,status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('user_moderation').select('user_id,offense_count,recent_offense_count,recent_window_start,flag_color,flagged_until,auto_reported_at,comment_banned_until,group_banned_until,updated_at').order('updated_at', { ascending: false }).limit(150),
      ]);
      if (reportError) throw reportError;
      if (userError) throw userError;
      const nextUsers = userRows || [];
      setReports(reportRows || []);
      setUsers(nextUsers);
      const ids = [...new Set([...nextUsers.map(row => row.user_id), ...(reportRows || []).map(row => row.user_id)].filter(Boolean))];
      if (ids.length) {
        const { data: rows, error } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids);
        if (error) throw error;
        setProfiles(Object.fromEntries((rows || []).map(row => [row.id, row])));
      } else setProfiles({});
    } catch (error) {
      setNotice(error?.message || 'Unable to load moderation data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open, isAdmin]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(row => {
      const p = profiles[row.user_id];
      return `${row.user_id} ${p?.username || ''} ${p?.display_name || ''}`.toLowerCase().includes(q);
    });
  }, [users, profiles, search]);

  const setBan = async (userId, type, enabled) => {
    if (busy) return;
    setBusy(`${type}:${userId}`); setNotice('');
    try {
      const patch = { updated_at: new Date().toISOString() };
      patch[type === 'group' ? 'group_banned_until' : 'comment_banned_until'] = enabled ? new Date(Date.now() + DAY).toISOString() : null;
      const { error } = await supabase.from('user_moderation').update(patch).eq('user_id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(row => row.user_id === userId ? { ...row, ...patch } : row));
      setNotice(enabled ? `${type === 'group' ? 'Group chat' : 'Comments'} banned for 24 hours.` : 'Ban removed.');
    } catch (error) { setNotice(error?.message || 'Unable to change the ban.'); }
    finally { setBusy(null); }
  };

  const reviewReport = async report => {
    if (busy) return;
    setBusy(`report:${report.id}`); setNotice('');
    try {
      const { error } = await supabase.from('moderation_reports').update({ status: 'reviewed' }).eq('id', report.id);
      if (error) throw error;
      setReports(prev => prev.map(row => row.id === report.id ? { ...row, status: 'reviewed' } : row));
    } catch (error) { setNotice(error?.message || 'Unable to update the report.'); }
    finally { setBusy(null); }
  };

  if (!isAdmin) return null;

  return <>
    <style>{`
      .ar-mod-launch{position:fixed;right:18px;bottom:68px;z-index:70;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:#111;color:#fff;padding:11px 14px;font:700 12px/1 Inter,system-ui,sans-serif;box-shadow:0 12px 35px rgba(0,0,0,.25);cursor:pointer}.ar-mod-launch:hover{background:#181818}
      .ar-mod-backdrop{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:18px}.ar-mod-modal{width:min(1000px,100%);max-height:min(860px,94vh);overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:#0f0f10;color:#f4f4f5;box-shadow:0 30px 100px rgba(0,0,0,.55);display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif}
      .ar-mod-head{display:flex;align-items:center;gap:14px;padding:20px;border-bottom:1px solid rgba(255,255,255,.08)}.ar-mod-head h2{margin:0;font-size:21px;letter-spacing:-.03em}.ar-mod-head p{margin:4px 0 0;color:#85858c;font-size:11px}.ar-mod-close{margin-left:auto;border:0;background:#1a1a1c;color:#fff;border-radius:10px;width:34px;height:34px;font-size:20px;cursor:pointer}
      .ar-mod-toolbar{display:flex;gap:9px;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,.07)}.ar-mod-search{flex:1;border:1px solid rgba(255,255,255,.1);background:#171719;color:#fff;border-radius:11px;padding:10px 12px;outline:none}.ar-mod-refresh{border:1px solid rgba(255,255,255,.1);background:#171719;color:#ddd;border-radius:11px;padding:0 13px;cursor:pointer}
      .ar-mod-notice{padding:8px 20px;font-size:11px;color:#aaa}.ar-mod-body{overflow:auto;padding:12px 16px 22px}.ar-mod-section{margin-bottom:20px}.ar-mod-section h3{font-size:12px;margin:0 0 8px;color:#aaa;text-transform:uppercase;letter-spacing:.08em}.ar-mod-card{border:1px solid rgba(255,255,255,.08);background:#151516;border-radius:14px;padding:12px;margin-bottom:8px}.ar-mod-row{display:flex;gap:10px;align-items:center}.ar-mod-avatar{width:38px;height:38px;border-radius:50%;overflow:hidden;background:#222;display:grid;place-items:center;color:#bbb;font-size:11px;flex:0 0 38px}.ar-mod-avatar img{width:100%;height:100%;object-fit:cover}.ar-mod-main{min-width:0;flex:1}.ar-mod-name{font-size:12px;font-weight:700}.ar-mod-meta{font-size:9px;color:#777;margin-top:3px}.ar-mod-buttons{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.ar-mod-btn{border:1px solid rgba(255,255,255,.1);background:#1d1d1f;color:#ddd;border-radius:9px;padding:7px 9px;font-size:9px;cursor:pointer}.ar-mod-btn.danger{border-color:rgba(220,75,75,.35);color:#f08a8a}.ar-mod-btn.ok{color:#a9d8b1}.ar-mod-btn:disabled{opacity:.45;cursor:wait}.ar-mod-report{font-size:11px;line-height:1.45;color:#ddd;margin-top:9px}.ar-mod-report small{color:#777}.ar-mod-empty{padding:30px;text-align:center;color:#777;font-size:11px}
      @media(max-width:600px){.ar-mod-backdrop{padding:0}.ar-mod-modal{height:100%;max-height:none;border-radius:0}.ar-mod-head{padding:16px}.ar-mod-toolbar{padding:10px 14px}.ar-mod-body{padding:10px}.ar-mod-row{align-items:flex-start}.ar-mod-buttons{justify-content:flex-start;margin-left:48px}.ar-mod-launch{right:12px;bottom:62px}}
    `}</style>
    <button className="ar-mod-launch" type="button" onClick={() => setOpen(true)}>⚑ Moderation</button>
    {open && <div className="ar-mod-backdrop" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}>
      <section className="ar-mod-modal" role="dialog" aria-modal="true" aria-label="Community moderation">
        <header className="ar-mod-head"><div><h2>Community Moderation</h2><p>Profanity flags, automatic reports and member bans</p></div><button className="ar-mod-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></header>
        <div className="ar-mod-toolbar"><input className="ar-mod-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member…"/><button className="ar-mod-refresh" type="button" onClick={load} disabled={loading}>{loading ? '…' : 'Refresh'}</button></div>
        {notice && <div className="ar-mod-notice">{notice}</div>}
        <div className="ar-mod-body">
          <section className="ar-mod-section"><h3>Automatic reports · {reports.filter(r => r.status === 'open').length} open</h3>{reports.length ? reports.map(report => { const p=profiles[report.user_id]; const name=p?.display_name||p?.username||'Reader'; return <article className="ar-mod-card" key={report.id}><div className="ar-mod-row"><div className="ar-mod-avatar">{p?.avatar_url?<img src={p.avatar_url} alt=""/>:name.slice(0,1).toUpperCase()}</div><div className="ar-mod-main"><div className="ar-mod-name">{name}</div><div className="ar-mod-meta">{report.source_type} · {report.offense_count} total flagged uses · {new Date(report.created_at).toLocaleString('en-IN')}</div></div>{report.status==='open'&&<button className="ar-mod-btn ok" type="button" disabled={busy===`report:${report.id}`} onClick={()=>reviewReport(report)}>{busy===`report:${report.id}`?'…':'Mark reviewed'}</button>}</div><div className="ar-mod-report">{report.reason}<br/><small>Source: {report.source_id}</small></div></article>}) : <div className="ar-mod-empty">No automatic reports.</div>}</section>
          <section className="ar-mod-section"><h3>Flagged members · {filteredUsers.length}</h3>{filteredUsers.length ? filteredUsers.map(row => { const p=profiles[row.user_id]; const name=p?.display_name||p?.username||'Reader'; const groupBanned=row.group_banned_until&&new Date(row.group_banned_until)>new Date(); const commentsBanned=row.comment_banned_until&&new Date(row.comment_banned_until)>new Date(); return <article className="ar-mod-card" key={row.user_id}><div className="ar-mod-row"><div className="ar-mod-avatar" style={{boxShadow:row.flag_color==='red'?'0 0 0 2px #d94b4b':'0 0 0 2px #e0b84a'}}>{p?.avatar_url?<img src={p.avatar_url} alt=""/>:name.slice(0,1).toUpperCase()}</div><div className="ar-mod-main"><div className="ar-mod-name">{name}</div><div className="ar-mod-meta">{row.flag_color==='red'?'RED':'YELLOW'} flag · {row.offense_count} total · {row.recent_offense_count} in current 24h window{row.flagged_until&&new Date(row.flagged_until)>new Date()?' · active':''}</div></div></div><div className="ar-mod-buttons"><button className="ar-mod-btn danger" type="button" disabled={busy===`group:${row.user_id}`} onClick={()=>setBan(row.user_id,'group',!groupBanned)}>{groupBanned?'Unban group':'Ban group 24h'}</button><button className="ar-mod-btn danger" type="button" disabled={busy===`comment:${row.user_id}`} onClick={()=>setBan(row.user_id,'comment',!commentsBanned)}>{commentsBanned?'Unban comments':'Ban comments 24h'}</button></div></article>}) : <div className="ar-mod-empty">No flagged members.</div>}</section>
        </div>
      </section>
    </div>}
  </>;
}
