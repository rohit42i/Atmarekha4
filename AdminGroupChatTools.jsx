import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const LIMIT = 150;

export default function AdminGroupChatTools() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data: { user: current } } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(current || null);
      if (!current) { setIsAdmin(false); return; }
      const { data } = await supabase.from('admins').select('user_id').eq('user_id', current.id).maybeSingle();
      if (alive) setIsAdmin(!!data);
    };
    check();
    const { data: listener } = supabase.auth.onAuthStateChange(() => check());
    return () => { alive = false; listener?.subscription?.unsubscribe(); };
  }, []);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true); setNotice('');
    const { data, error } = await supabase
      .from('group_chat_messages')
      .select('id,user_id,content,created_at,reply_to_message_id')
      .order('created_at', { ascending: false })
      .limit(LIMIT);
    if (error) { setNotice(error.message); setLoading(false); return; }
    const list = data || [];
    setMessages(list);
    const ids = [...new Set(list.map(m => m.user_id).filter(Boolean))];
    if (ids.length) {
      const { data: rows } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids);
      const next = {};
      (rows || []).forEach(p => { next[p.id] = p; });
      setProfiles(next);
    }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter(m => {
      const p = profiles[m.user_id];
      return `${m.content} ${p?.display_name || ''} ${p?.username || ''}`.toLowerCase().includes(q);
    });
  }, [messages, profiles, search]);

  const deleteMessage = async (message) => {
    if (deleting) return;
    if (!window.confirm('Delete this group message permanently?')) return;
    setDeleting(message.id); setNotice('');
    try {
      const checks = await supabase.from('admins').select('user_id').eq('user_id', user?.id).maybeSingle();
      if (!checks.data) throw new Error('Admin access required.');

      // Remove dependent records first so deletion also works when foreign keys are not cascading.
      for (const table of ['group_chat_likes', 'group_chat_reactions', 'group_chat_reads']) {
        const { error } = await supabase.from(table).delete().eq('message_id', message.id);
        if (error) throw error;
      }
      const { error } = await supabase.from('group_chat_messages').delete().eq('id', message.id);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== message.id));
      setNotice('Message deleted.');
    } catch (error) {
      setNotice(error.message || 'Unable to delete message.');
    } finally { setDeleting(null); }
  };

  if (!isAdmin) return null;

  return <>
    <style>{`
      .ar-admin-chat-launch{position:fixed;right:18px;bottom:18px;z-index:70;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:#111;color:#fff;padding:11px 14px;font:700 12px/1 Inter,system-ui,sans-serif;box-shadow:0 12px 35px rgba(0,0,0,.25);cursor:pointer}.ar-admin-chat-launch:hover{background:#181818}.ar-admin-chat-backdrop{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.58);display:grid;place-items:center;padding:18px}.ar-admin-chat-modal{width:min(920px,100%);max-height:min(820px,92vh);overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:#0f0f10;color:#f4f4f5;box-shadow:0 30px 100px rgba(0,0,0,.5);display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif}.ar-admin-chat-head{display:flex;align-items:center;gap:14px;padding:20px;border-bottom:1px solid rgba(255,255,255,.08)}.ar-admin-chat-head h2{margin:0;font-size:21px;letter-spacing:-.03em}.ar-admin-chat-head p{margin:4px 0 0;color:#85858c;font-size:11px}.ar-admin-chat-close{margin-left:auto;border:0;background:#1a1a1c;color:#fff;border-radius:10px;width:34px;height:34px;font-size:20px;cursor:pointer}.ar-admin-chat-toolbar{display:flex;gap:9px;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,.07)}.ar-admin-chat-search{flex:1;min-width:0;border:1px solid rgba(255,255,255,.1);background:#171719;color:#fff;border-radius:11px;padding:10px 12px;outline:none}.ar-admin-chat-refresh{border:1px solid rgba(255,255,255,.1);background:#171719;color:#ddd;border-radius:11px;padding:0 13px;cursor:pointer}.ar-admin-chat-notice{padding:8px 20px;font-size:11px;color:#aaa}.ar-admin-chat-list{overflow:auto;padding:8px 14px 18px}.ar-admin-chat-row{display:flex;gap:11px;padding:13px 8px;border-bottom:1px solid rgba(255,255,255,.055);align-items:flex-start}.ar-admin-chat-avatar{width:34px;height:34px;flex:0 0 34px;border-radius:50%;overflow:hidden;background:#222;display:grid;place-items:center;color:#bbb;font-size:11px}.ar-admin-chat-avatar img{width:100%;height:100%;object-fit:cover}.ar-admin-chat-body{min-width:0;flex:1}.ar-admin-chat-meta{display:flex;gap:8px;align-items:center;margin-bottom:4px}.ar-admin-chat-meta strong{font-size:11px}.ar-admin-chat-meta span{color:#696970;font-size:9px}.ar-admin-chat-content{font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;color:#ddd}.ar-admin-chat-delete{border:1px solid rgba(255,255,255,.08);background:#151516;color:#aaa;border-radius:9px;padding:7px 9px;font-size:10px;cursor:pointer}.ar-admin-chat-delete:hover{color:#fff;background:#202022}.ar-admin-chat-delete:disabled{opacity:.45;cursor:wait}.ar-admin-chat-empty{padding:60px 20px;text-align:center;color:#777;font-size:12px}@media(max-width:600px){.ar-admin-chat-backdrop{padding:0}.ar-admin-chat-modal{height:100%;max-height:none;border-radius:0}.ar-admin-chat-head{padding:16px}.ar-admin-chat-toolbar{padding:10px 14px}.ar-admin-chat-list{padding:4px 10px 16px}.ar-admin-chat-launch{right:12px;bottom:12px}}
    `}</style>
    <button className="ar-admin-chat-launch" type="button" onClick={() => setOpen(true)}>🛡 Group Chat</button>
    {open && <div className="ar-admin-chat-backdrop" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}>
      <section className="ar-admin-chat-modal" role="dialog" aria-modal="true" aria-label="Group chat moderation">
        <header className="ar-admin-chat-head"><div><h2>Group Chat</h2><p>Moderation · {messages.length} loaded messages</p></div><button className="ar-admin-chat-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></header>
        <div className="ar-admin-chat-toolbar"><input className="ar-admin-chat-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages or members…"/><button className="ar-admin-chat-refresh" type="button" onClick={load} disabled={loading}>{loading ? '…' : 'Refresh'}</button></div>
        {notice && <div className="ar-admin-chat-notice">{notice}</div>}
        <div className="ar-admin-chat-list">{loading && !messages.length ? <div className="ar-admin-chat-empty">Loading messages…</div> : !filtered.length ? <div className="ar-admin-chat-empty">No messages found.</div> : filtered.map(m => { const p = profiles[m.user_id]; const name = p?.display_name || p?.username || 'Reader'; return <article className="ar-admin-chat-row" key={m.id}><div className="ar-admin-chat-avatar">{p?.avatar_url ? <img src={p.avatar_url} alt=""/> : name.slice(0,1).toUpperCase()}</div><div className="ar-admin-chat-body"><div className="ar-admin-chat-meta"><strong>{name}</strong><span>{new Date(m.created_at).toLocaleString('en-IN')}</span></div><div className="ar-admin-chat-content">{m.content}</div></div><button className="ar-admin-chat-delete" type="button" disabled={deleting===m.id} onClick={() => deleteMessage(m)}>{deleting===m.id ? 'Deleting…' : 'Delete'}</button></article>; })}</div>
      </section>
    </div>}
  </>;
}
