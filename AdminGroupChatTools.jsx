import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const LIMIT = 250;
const DEPENDENCY_TABLES = ['group_chat_likes', 'group_chat_reactions', 'group_chat_reads'];

async function verifyAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Admin session required.');
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(`Admin verification failed: ${error.message}`);
  if (!data) throw new Error('Admin access required.');
  return user;
}

export default function AdminGroupChatTools() {
  const [user, setUser] = useState(null), [isAdmin, setIsAdmin] = useState(false), [open, setOpen] = useState(false), [nav, setNav] = useState(null);
  const [tab, setTab] = useState('messages'), [messages, setMessages] = useState([]), [profiles, setProfiles] = useState({});
  const [search, setSearch] = useState(''), [authorFilter, setAuthorFilter] = useState('all'), [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState(new Set()), [loading, setLoading] = useState(false), [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const checkAdmin = async () => { try { const current = await verifyAdmin(); setUser(current); setIsAdmin(true); } catch (_) { setUser(null); setIsAdmin(false); } };
  useEffect(() => { checkAdmin(); const { data: listener } = supabase.auth.onAuthStateChange(() => checkAdmin()); return () => listener?.subscription?.unsubscribe(); }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let observer;
    const attach = () => {
      const target = document.querySelector('.admin-tabs');
      if (target) { setNav(target); return true; }
      return false;
    };
    if (!attach()) { observer = new MutationObserver(attach); observer.observe(document.body, { childList: true, subtree: true }); }
    return () => observer?.disconnect();
  }, [isAdmin]);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true); setNotice({ type: '', text: '' });
    try {
      await verifyAdmin();
      const { data, error } = await supabase.from('group_chat_messages').select('id,user_id,content,created_at,reply_to_message_id').order('created_at', { ascending: false }).limit(LIMIT);
      if (error) throw error;
      const list = data || []; setMessages(list); setSelected(new Set());
      const ids = [...new Set(list.map(m => m.user_id).filter(Boolean))];
      if (ids.length) { const { data: rows, error: profileError } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids); if (!profileError) { const next = {}; (rows || []).forEach(p => { next[p.id] = p; }); setProfiles(next); } }
    } catch (error) { setNotice({ type: 'error', text: error.message || 'Unable to load group chat.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open, isAdmin]);

  const authors = useMemo(() => { const map = new Map(); messages.forEach(m => { const p = profiles[m.user_id]; map.set(m.user_id, p?.display_name || p?.username || 'Reader'); }); return [...map.entries()].sort((a,b) => a[1].localeCompare(b[1])); }, [messages, profiles]);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return [...messages].filter(m => { const p=profiles[m.user_id], name=p?.display_name||p?.username||'Reader'; return (!q || `${m.content} ${name} ${p?.username||''}`.toLowerCase().includes(q)) && (authorFilter==='all'||m.user_id===authorFilter); }).sort((a,b)=>sort==='newest'?new Date(b.created_at)-new Date(a.created_at):new Date(a.created_at)-new Date(b.created_at)); }, [messages,profiles,search,authorFilter,sort]);
  const stats = useMemo(() => ({ loaded:messages.length, visible:filtered.length, members:new Set(messages.map(m=>m.user_id).filter(Boolean)).size, replies:messages.filter(m=>m.reply_to_message_id).length }), [messages,filtered]);
  const toggleSelected=id=>setSelected(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});
  const selectVisible=()=>setSelected(prev=>{const next=new Set(prev);filtered.forEach(m=>next.add(m.id));return next;});
  const clearSelection=()=>setSelected(new Set());
  const deleteIds = async ids => { if (!ids.length || deleting) return; setDeleting(true); setNotice({type:'',text:''}); try { await verifyAdmin(); for (const table of DEPENDENCY_TABLES) { try { await supabase.from(table).delete().in('message_id',ids); } catch (_) {} } const {error}=await supabase.from('group_chat_messages').delete().in('id',ids); if(error)throw error; setMessages(prev=>prev.filter(m=>!ids.includes(m.id))); setSelected(new Set()); setNotice({type:'success',text:`${ids.length} message${ids.length===1?'':'s'} deleted.`}); } catch(error){setNotice({type:'error',text:error.message||'Unable to delete message(s).'});} finally{setDeleting(false);} };
  const deleteOne=async m=>{if(window.confirm('Delete this message permanently? This cannot be undone.'))await deleteIds([m.id]);};
  const deleteSelected=async()=>{const ids=[...selected];if(ids.length&&window.confirm(`Delete ${ids.length} selected message${ids.length===1?'':'s'} permanently?`))await deleteIds(ids);};
  if(!isAdmin)return null;

  const button = nav && createPortal(<button type="button" className="ar-gcm-nav-tab" onClick={()=>setOpen(true)} aria-label="Open group chat moderation">Group Chat</button>, nav);
  return <>
    {button}
    <style>{`.ar-gcm-nav-tab{border:0;background:transparent;color:inherit;padding:11px 13px;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;opacity:.78}.ar-gcm-nav-tab:hover{opacity:1;background:rgba(127,127,127,.10)}.ar-gcm-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.70);display:grid;place-items:center;padding:16px}.ar-gcm-modal{width:min(1100px,100%);height:min(850px,94vh);background:#0b0b0c;color:#f5f5f5;border:1px solid #28282b;border-radius:24px;overflow:hidden;display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif;box-shadow:0 35px 110px rgba(0,0,0,.55)}.ar-gcm-head{display:flex;align-items:center;padding:20px 22px;border-bottom:1px solid #242426;gap:15px}.ar-gcm-head h2{margin:0;font-size:22px;letter-spacing:-.04em}.ar-gcm-head p{margin:5px 0 0;color:#85858b;font-size:11px}.ar-gcm-close{margin-left:auto;width:36px;height:36px;border:1px solid #29292c;background:#151516;color:#fff;border-radius:11px;font-size:20px;cursor:pointer}.ar-gcm-tabs{display:flex;gap:4px;padding:10px 18px;border-bottom:1px solid #202022}.ar-gcm-tab{border:0;background:transparent;color:#888;padding:9px 13px;border-radius:9px;font-weight:700;font-size:11px;cursor:pointer}.ar-gcm-tab.active{background:#fff;color:#000}.ar-gcm-stats{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #202022}.ar-gcm-stat{padding:13px 18px;border-right:1px solid #202022}.ar-gcm-stat:last-child{border-right:0}.ar-gcm-stat span{display:block;color:#777;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.ar-gcm-stat strong{display:block;margin-top:4px;font-size:18px}.ar-gcm-tools{display:flex;gap:8px;padding:12px 18px;border-bottom:1px solid #202022;flex-wrap:wrap}.ar-gcm-search{flex:1;min-width:180px;background:#151516;color:#fff;border:1px solid #2a2a2d;border-radius:10px;padding:10px 12px;outline:none}.ar-gcm-select,.ar-gcm-action{background:#151516;color:#ddd;border:1px solid #2a2a2d;border-radius:10px;padding:9px 11px;font-size:10px;font-weight:700}.ar-gcm-action{cursor:pointer}.ar-gcm-notice{padding:8px 18px;font-size:11px;border-bottom:1px solid #202022}.ar-gcm-notice.error{color:#ff6b6b}.ar-gcm-notice.success{color:#bbb}.ar-gcm-list{flex:1;overflow:auto}.ar-gcm-row{display:flex;gap:11px;align-items:flex-start;padding:13px 18px;border-bottom:1px solid #19191b}.ar-gcm-row:hover{background:#101011}.ar-gcm-check{margin-top:8px}.ar-gcm-avatar{width:36px;height:36px;border-radius:50%;background:#222;overflow:hidden;display:grid;place-items:center;color:#aaa;font-size:11px;flex:none}.ar-gcm-avatar img{width:100%;height:100%;object-fit:cover}.ar-gcm-body{min-width:0;flex:1}.ar-gcm-meta{display:flex;gap:8px;align-items:center}.ar-gcm-meta strong{font-size:11px}.ar-gcm-meta span{color:#68686d;font-size:9px}.ar-gcm-content{margin-top:4px;color:#d7d7da;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.ar-gcm-delete{border:1px solid #29292c;background:#151516;color:#aaa;border-radius:9px;padding:7px 9px;font-size:10px;cursor:pointer}.ar-gcm-delete:hover{color:#fff}.ar-gcm-empty{padding:70px 20px;text-align:center;color:#777;font-size:12px}.ar-gcm-members{padding:14px 18px;overflow:auto}.ar-gcm-member{display:flex;align-items:center;gap:11px;padding:12px 4px;border-bottom:1px solid #19191b}.ar-gcm-member-info{flex:1}.ar-gcm-member-info strong{display:block;font-size:12px}.ar-gcm-member-info span{display:block;color:#777;font-size:10px;margin-top:3px}.ar-gcm-badge{font-size:9px;color:#aaa}@media(max-width:650px){.ar-gcm-backdrop{padding:0}.ar-gcm-modal{height:100%;max-height:none;border-radius:0}.ar-gcm-stats{grid-template-columns:repeat(2,1fr)}.ar-gcm-stat:nth-child(2){border-right:0}.ar-gcm-search{flex-basis:100%}}`}</style>
    {open&&<div className="ar-gcm-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><section className="ar-gcm-modal" role="dialog" aria-modal="true" aria-label="Group chat moderation">
      <header className="ar-gcm-head"><div><h2>Group Chat Moderation</h2><p>Admin controls · review, search and remove community messages</p></div><button className="ar-gcm-close" type="button" onClick={()=>setOpen(false)}>×</button></header>
      <nav className="ar-gcm-tabs"><button className={`ar-gcm-tab ${tab==='messages'?'active':''}`} onClick={()=>setTab('messages')}>Messages</button><button className={`ar-gcm-tab ${tab==='members'?'active':''}`} onClick={()=>setTab('members')}>Members</button></nav>
      <div className="ar-gcm-stats"><div className="ar-gcm-stat"><span>Loaded messages</span><strong>{stats.loaded}</strong></div><div className="ar-gcm-stat"><span>Visible</span><strong>{stats.visible}</strong></div><div className="ar-gcm-stat"><span>Active authors</span><strong>{stats.members}</strong></div><div className="ar-gcm-stat"><span>Replies</span><strong>{stats.replies}</strong></div></div>
      {tab==='messages'?<><div className="ar-gcm-tools"><input className="ar-gcm-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search messages, usernames or members…"/><select className="ar-gcm-select" value={authorFilter} onChange={e=>setAuthorFilter(e.target.value)}><option value="all">All members</option>{authors.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><select className="ar-gcm-select" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option></select><button className="ar-gcm-action" onClick={selectVisible}>Select visible</button><button className="ar-gcm-action" onClick={clearSelection}>Clear</button><button className="ar-gcm-action" onClick={load} disabled={loading}>{loading?'Loading…':'Refresh'}</button>{selected.size>0&&<button className="ar-gcm-action" onClick={deleteSelected} disabled={deleting}>Delete {selected.size}</button>}</div>{notice.text&&<div className={`ar-gcm-notice ${notice.type}`}>{notice.text}</div>}<div className="ar-gcm-list">{loading&&!messages.length?<div className="ar-gcm-empty">Loading group messages…</div>:!filtered.length?<div className="ar-gcm-empty">No messages match your filters.</div>:filtered.map(m=>{const p=profiles[m.user_id],name=p?.display_name||p?.username||'Reader';return <article className="ar-gcm-row" key={m.id}><input className="ar-gcm-check" type="checkbox" checked={selected.has(m.id)} onChange={()=>toggleSelected(m.id)}/><div className="ar-gcm-avatar">{p?.avatar_url?<img src={p.avatar_url} alt=""/>:name.slice(0,1).toUpperCase()}</div><div className="ar-gcm-body"><div className="ar-gcm-meta"><strong>{name}</strong><span>{p?.username?`@${p.username} · `:''}{new Date(m.created_at).toLocaleString('en-IN')}</span></div>{m.reply_to_message_id&&<span className="ar-gcm-badge">Reply</span>}<div className="ar-gcm-content">{m.content}</div></div><button className="ar-gcm-delete" type="button" onClick={()=>deleteOne(m)} disabled={deleting}>Delete</button></article>})}</div></>:<div className="ar-gcm-members">{authors.length?authors.map(([id,name])=>{const p=profiles[id],count=messages.filter(m=>m.user_id===id).length;return <article className="ar-gcm-member" key={id}><div className="ar-gcm-avatar">{p?.avatar_url?<img src={p.avatar_url} alt=""/>:name.slice(0,1).toUpperCase()}</div><div className="ar-gcm-member-info"><strong>{name}</strong><span>{p?.username?`@${p.username}`:'No username'}</span></div><span className="ar-gcm-badge">{count} message{count===1?'':'s'}</span></article>}):<div className="ar-gcm-empty">No members in the loaded messages.</div>}</div>}
    </section></div>}
  </>;
}
