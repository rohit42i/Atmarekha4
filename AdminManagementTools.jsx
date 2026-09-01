import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentMemberships, supabase } from './supabase';

const formatDate = value => value ? new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const formatTime = value => value ? new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
const planLabel = value => ({ mini_member:'Mini Member', supporter:'Member', premium:'Premium Member' }[value] || 'Free');

async function verifyAdmin(){
  const { data:{user} } = await supabase.auth.getUser();
  if(!user) throw new Error('Admin session required.');
  const { data,error } = await supabase.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(error) throw new Error(`Admin verification failed: ${error.message}`);
  if(!data) throw new Error('Admin access required.');
  return user;
}

export default function AdminManagementTools(){
  const [isAdmin,setIsAdmin]=useState(false),[nav,setNav]=useState(null),[open,setOpen]=useState(null);
  const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [users,setUsers]=useState([]),[memberships,setMemberships]=useState(new Map()),[notifications,setNotifications]=useState([]),[activity,setActivity]=useState([]);
  const [pushForm,setPushForm]=useState({title:'📖 Atma Rekha',body:'A new message is available.',url:'/',audience:'all'}),[pushSending,setPushSending]=useState(false),[pushResult,setPushResult]=useState('');

  useEffect(()=>{let active=true; const check=async()=>{try{await verifyAdmin();if(active)setIsAdmin(true)}catch{if(active)setIsAdmin(false)}}; check(); const {data:l}=supabase.auth.onAuthStateChange(()=>check()); return()=>{active=false;l?.subscription?.unsubscribe()}},[]);

  useEffect(()=>{
    if(!isAdmin)return;
    let observer;
    const attach=()=>{const el=document.querySelector('.admin-tabs');if(el){setNav(el);return true}return false};
    if(!attach()){observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true})}
    return()=>observer?.disconnect();
  },[isAdmin]);

  useEffect(()=>{const close=e=>{if(e.key==='Escape')setOpen(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);

  const loadUsers=async()=>{setLoading(true);setError('');try{await verifyAdmin();const {data,error:e}=await supabase.from('profiles').select('id,username,display_name,avatar_url,created_at').order('created_at',{ascending:false}).limit(500);if(e)throw e;const rows=data||[];setUsers(rows);try{setMemberships(await getCurrentMemberships(rows.map(r=>r.id)))}catch{setMemberships(new Map())}}catch(e){setError(e.message||'Unable to load users.')}finally{setLoading(false)}};
  const loadNotifications=async()=>{setLoading(true);setError('');try{await verifyAdmin();const {data,error:e}=await supabase.from('announcements').select('title,content,image_url,is_pinned,published_at,created_at').order('created_at',{ascending:false}).limit(200);if(e)throw e;setNotifications(data||[])}catch(e){setError(e.message||'Unable to load notifications.')}finally{setLoading(false)}};
  const loadActivity=async()=>{setLoading(true);setError('');try{await verifyAdmin();const results=await Promise.all([
    supabase.from('chapters').select('chapter_number,title,created_at').order('created_at',{ascending:false}).limit(25),
    supabase.from('comments').select('author_name,content,created_at').order('created_at',{ascending:false}).limit(25),
    supabase.from('comment_reports').select('reason,created_at').order('created_at',{ascending:false}).limit(25),
    supabase.from('announcements').select('title,created_at').order('created_at',{ascending:false}).limit(25)
  ]);for(const r of results)if(r.error)throw r.error;const [c,co,r,a]=results;setActivity([
    ...(c.data||[]).map(x=>({type:'Chapter',title:`Chapter ${x.chapter_number} · ${x.title||'Untitled'}`,time:x.created_at})),
    ...(co.data||[]).map(x=>({type:'Comment',title:`${x.author_name||'Reader'} · ${String(x.content||'').slice(0,90)}`,time:x.created_at})),
    ...(r.data||[]).map(x=>({type:'Report',title:x.reason||'Comment report',time:x.created_at})),
    ...(a.data||[]).map(x=>({type:'Notification',title:x.title||'Announcement',time:x.created_at}))
  ].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,60))}catch(e){setError(e.message||'Unable to load recent activity.')}finally{setLoading(false)}};

  const sendPushNotification=async event=>{
    event.preventDefault();
    if(pushSending)return;
    setPushSending(true);setPushResult('');setError('');
    try{
      await verifyAdmin();
      const title=pushForm.title.trim();
      const body=pushForm.body.trim();
      const url=pushForm.url.trim()||'/';
      if(!title)throw new Error('Notification title is required.');
      if(!body)throw new Error('Notification message is required.');
      const {data,error:e}=await supabase.functions.invoke('send-chapter-notification-v2',{body:{title,body,url,communityOnly:pushForm.audience==='community',tag:pushForm.audience==='community'?'atma-rekha-community':'atma-rekha-admin'}});
      if(e)throw e;
      if(!data?.ok)throw new Error(data?.error||'Notification delivery failed.');
      setPushResult(`Sent ${Number(data.sent||0)} notification${Number(data.sent||0)===1?'':'s'} successfully${data.failed?`; ${Number(data.failed)} failed`:''}.`);
      await loadNotifications();
    }catch(e){setError(e?.message||'Unable to send push notification.');}
    finally{setPushSending(false)}
  };

  const openView=type=>{setQuery('');setStatus('all');setError('');setPushResult('');setOpen(type);if(type==='users')loadUsers();if(type==='notifications')loadNotifications();if(type==='activity')loadActivity()};
  const filteredUsers=useMemo(()=>{const q=query.trim().toLowerCase();return users.filter(u=>{const plan=planLabel(memberships.get(u.id));const text=`${u.username||''} ${u.display_name||''} ${u.id||''} ${plan}`.toLowerCase();return(!q||text.includes(q))&&(status==='all'||plan===status)})},[users,memberships,query,status]);
  if(!isAdmin)return null;

  const button=nav&&createPortal(<>
    <button type="button" className="ar-admin-extra-tab" onClick={()=>openView('users')}>Users & memberships</button>
    <button type="button" className="ar-admin-extra-tab" onClick={()=>openView('notifications')}>Notifications</button>
    <button type="button" className="ar-admin-extra-tab" onClick={()=>openView('activity')}>Recent activity</button>
  </>,nav);

  return <>
    {button}
    <style>{`
      .ar-admin-extra-tab{width:100%;min-height:42px;padding:0 13px;border:1px solid transparent;border-radius:10px;background:#fff;color:#777;text-align:left;font-size:11px;font-weight:800;cursor:pointer}
      .ar-admin-extra-tab:hover{background:#f5f5f5;color:#111}
      .ar-mgmt-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.52);display:grid;place-items:center;padding:20px}
      .ar-mgmt-panel{width:min(1060px,100%);max-height:min(860px,92vh);background:#fff;color:#111;border:1px solid #ddd;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.22)}
      .ar-mgmt-head{display:flex;align-items:center;gap:15px;padding:20px 22px;border-bottom:1px solid #e8e8e8}.ar-mgmt-head small{display:block;color:#777;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.ar-mgmt-head h2{margin:4px 0 0;font-size:21px;letter-spacing:-.035em}.ar-mgmt-close{margin-left:auto;width:36px;height:36px;border:1px solid #ddd;background:#fff;border-radius:9px;font-size:20px;cursor:pointer}.ar-mgmt-tools{display:flex;gap:8px;padding:12px 18px;border-bottom:1px solid #e8e8e8;flex-wrap:wrap}.ar-mgmt-tools input,.ar-mgmt-tools select{min-height:40px;padding:0 11px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#111;outline:none}.ar-mgmt-tools input{flex:1;min-width:220px}.ar-mgmt-tools button{min-height:40px;padding:0 12px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#111;font-weight:800;cursor:pointer}.ar-mgmt-tools button:hover{background:#f5f5f5}.ar-mgmt-body{overflow:auto;min-height:280px}.ar-mgmt-table{width:100%;border-collapse:collapse}.ar-mgmt-table th{position:sticky;top:0;background:#f8f8f8;color:#777;font-size:9px;letter-spacing:.1em;text-transform:uppercase;text-align:left}.ar-mgmt-table th,.ar-mgmt-table td{padding:13px 18px;border-bottom:1px solid #eee}.ar-mgmt-user{display:flex;align-items:center;gap:10px}.ar-mgmt-avatar{width:34px;height:34px;border-radius:50%;overflow:hidden;background:#111;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}.ar-mgmt-avatar img{width:100%;height:100%;object-fit:cover}.ar-mgmt-user strong{display:block;font-size:12px}.ar-mgmt-user small{display:block;margin-top:2px;color:#777;font-size:10px}.ar-mgmt-badge{display:inline-flex;padding:4px 8px;border:1px solid #ddd;border-radius:99px;background:#fff;color:#333;font-size:9px;font-weight:800}.ar-mgmt-feed{padding:8px 18px}.ar-mgmt-feed article{padding:14px 4px;border-bottom:1px solid #eee}.ar-mgmt-feed article>div{display:flex;align-items:center;gap:8px}.ar-mgmt-feed strong{font-size:12px}.ar-mgmt-feed p{margin:6px 0;color:#555;font-size:12px;line-height:1.5}.ar-mgmt-feed time{display:block;margin-top:5px;color:#888;font-size:9px}.ar-mgmt-type{padding:3px 7px;border:1px solid #ddd;border-radius:99px;font-size:8px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.ar-mgmt-empty{padding:70px 20px;text-align:center;color:#777;font-size:12px}.ar-mgmt-error{margin:12px 18px;padding:10px 12px;border:1px solid #e2b0b0;border-radius:9px;color:#b00000;background:#fff;font-size:11px}.ar-push-card{margin:14px 18px 8px;padding:16px;border:1px solid #e3e3e3;border-radius:14px;background:#fafafa}.ar-push-card h3{margin:0;font-size:13px}.ar-push-card p{margin:4px 0 12px;color:#777;font-size:10px}.ar-push-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.ar-push-grid input,.ar-push-grid select,.ar-push-grid textarea{width:100%;box-sizing:border-box;border:1px solid #d8d8d8;border-radius:9px;background:#fff;color:#111;padding:10px;font:inherit;font-size:11px;outline:none}.ar-push-grid textarea{min-height:76px;resize:vertical;grid-column:1/-1}.ar-push-grid .wide{grid-column:1/-1}.ar-push-actions{display:flex;align-items:center;gap:10px;margin-top:10px}.ar-push-send{min-height:40px;padding:0 15px;border:0;border-radius:9px;background:#111;color:#fff;font-size:10px;font-weight:900;cursor:pointer}.ar-push-send:disabled{opacity:.55;cursor:not-allowed}.ar-push-result{font-size:10px;color:#167a42}.ar-push-note{font-size:9px;color:#777}
      @media(max-width:700px){.ar-mgmt-backdrop{padding:0}.ar-mgmt-panel{height:100%;max-height:none;border-radius:0}.ar-mgmt-head{padding:16px}.ar-mgmt-tools input{flex-basis:100%}.ar-mgmt-table{min-width:620px}.ar-mgmt-body{overflow:auto}.ar-push-grid{grid-template-columns:1fr}.ar-push-grid textarea,.ar-push-grid .wide{grid-column:1}}
    `}</style>
    {open&&<div className="ar-mgmt-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(null)}><section className="ar-mgmt-panel" role="dialog" aria-modal="true">
      <header className="ar-mgmt-head"><div><small>Admin workspace</small><h2>{open==='users'?'Users & memberships':open==='notifications'?'Notifications':'Recent activity'}</h2></div><button className="ar-mgmt-close" onClick={()=>setOpen(null)} aria-label="Close">×</button></header>
      {open==='notifications'&&<form className="ar-push-card" onSubmit={sendPushNotification}><h3>Push notification</h3><p>Send a real browser push notification using the existing protected Supabase notification service.</p><div className="ar-push-grid"><input value={pushForm.title} onChange={e=>setPushForm({...pushForm,title:e.target.value})} placeholder="Notification title" maxLength="100" required/><select value={pushForm.audience} onChange={e=>setPushForm({...pushForm,audience:e.target.value})} aria-label="Notification audience"><option value="all">All notification subscribers</option><option value="community">Community members</option></select><textarea value={pushForm.body} onChange={e=>setPushForm({...pushForm,body:e.target.value})} placeholder="Notification message" maxLength="240" required/><input className="wide" value={pushForm.url} onChange={e=>setPushForm({...pushForm,url:e.target.value})} placeholder="Open URL after tapping (e.g. /chapter/1)" maxLength="500"/><div className="ar-push-actions wide"><button className="ar-push-send" type="submit" disabled={pushSending}>{pushSending?'Sending…':'Send push notification'}</button>{pushResult&&<span className="ar-push-result">{pushResult}</span>}<span className="ar-push-note">Only authenticated admins can send.</span></div></div></form>}
      <div className="ar-mgmt-tools">{open==='users'&&<><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search username, display name, ID or membership…"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All memberships</option><option>Free</option><option>Mini Member</option><option>Member</option><option>Premium Member</option></select></>}{open!=='users'&&<input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search…"/>}<button onClick={()=>openView(open)} disabled={loading}>{loading?'Loading…':'Refresh'}</button></div>
      {error&&<div className="ar-mgmt-error" role="alert">{error}</div>}
      <div className="ar-mgmt-body">{loading?<div className="ar-mgmt-empty">Loading…</div>:open==='users'?<table className="ar-mgmt-table"><thead><tr><th>User</th><th>Membership</th><th>Joined</th></tr></thead><tbody>{filteredUsers.map(u=>{const name=u.display_name||u.username||'Reader';return <tr key={u.id}><td><div className="ar-mgmt-user"><div className="ar-mgmt-avatar">{u.avatar_url?<img src={u.avatar_url} alt=""/>:name.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><small>{u.username?`@${u.username}`:u.id.slice(0,12)}</small></div></div></td><td><span className="ar-mgmt-badge">{planLabel(memberships.get(u.id))}</span></td><td>{formatDate(u.created_at)}</td></tr>})}{!filteredUsers.length&&<tr><td colSpan="3"><div className="ar-mgmt-empty">No users match the current search or filter.</div></td></tr>}</tbody></table>:open==='notifications'?<div className="ar-mgmt-feed">{notifications.filter(x=>!query.trim()||`${x.title||''} ${x.content||''}`.toLowerCase().includes(query.trim().toLowerCase())).map(x=><article key={`${x.title}-${x.created_at}`}><div><strong>{x.title?.startsWith('__image_only_')?'Image announcement':x.title||'Announcement'}</strong>{x.is_pinned&&<span className="ar-mgmt-type">Pinned</span>}</div>{x.content&&<p>{x.content}</p>}<time>{formatTime(x.published_at||x.created_at)}</time></article>)}{!notifications.length&&<div className="ar-mgmt-empty">No notifications yet.</div>}</div>:<div className="ar-mgmt-feed">{activity.filter(x=>!query.trim()||`${x.type} ${x.title}`.toLowerCase().includes(query.trim().toLowerCase())).map((x,i)=><article key={`${x.type}-${x.time}-${i}`}><div><span className="ar-mgmt-type">{x.type}</span><strong>{x.title}</strong></div><time>{formatTime(x.time)}</time></article>)}{!activity.length&&<div className="ar-mgmt-empty">No recent activity.</div>}</div>}</div>
    </section></div>}
  </>;
}
