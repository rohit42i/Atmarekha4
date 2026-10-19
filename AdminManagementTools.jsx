import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import './admin-reader-controls.css';

const formatDate = value => value ? new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const formatTime = value => value ? new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
const planLabel = value => ({ mini_member:'Mini Member', supporter:'Member', premium:'Premium Member' }[value] || 'Free');

async function verifyAdmin(){
  const { data:{user} } = await supabase.auth.getUser();
  if(!user) throw new Error('Admin session required.');
  const role = await getAdminRole(user.id);
  if(role !== 'owner' && role !== 'admin') throw new Error('Admin access required.');
  return user;
}


function formatReaderTitle(row, source) {
  if (source === "reading" && row.chapters) return "Chapter " + (row.chapters.chapter_number ?? "—") + " · " + (row.chapters.title || "Untitled");
  if (source === "pdlpl-reading" && row.pal_do_pal_ke_lamhe_chapters) return "Chapter " + (row.pal_do_pal_ke_lamhe_chapters.chapter_number ?? "—") + " · " + (row.pal_do_pal_ke_lamhe_chapters.title || "Untitled");
  if (source === "rating" && row.chapters) return "Chapter " + (row.chapters.chapter_number ?? "—") + " · " + (row.chapters.title || "Untitled");
  return source === "reading" || source === "pdlpl-reading" ? "Reading activity" : source;
}
function ReaderDetails({ reader, details, loading, message, busy, onBack, onResendVerification, onResendEmailChange }) {
  const account = details?.user || reader;
  const profile = details?.profile || reader;
  const stats = details?.stats || {};
  const activity = details?.activity || {};
  const reads = [...(activity.reading || []).map(row=>({...row,_source:"reading"})),...(activity.pdlpl_reading||[]).map(row=>({...row,_source:"pdlpl-reading"}))].sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).slice(0,6);
  const comments = [...(activity.comments||[]).map(row=>({...row,_source:"Atma Rekha"})),...(activity.pdlpl_comments||[]).map(row=>({...row,_source:"Pal Do Pal Ke Lamhe"}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6);
  const ratings = [...(activity.ratings||[]).map(row=>({...row,_source:"Atma Rekha"})),...(activity.pdlpl_ratings||[]).map(row=>({...row,_source:"Pal Do Pal Ke Lamhe"}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6);
  const bookmarks = [...(activity.bookmarks||[]).map(row=>({...row,_source:"Atma Rekha"})),...(activity.pdlpl_bookmarks||[]).map(row=>({...row,_source:"Pal Do Pal Ke Lamhe"}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6);
  return <section className="ar-reader-details">
    <div className="ar-reader-detail-top"><button type="button" className="ar-mgmt-action" onClick={onBack}>← Users</button><span className="ar-mgmt-type">{account.email_confirmed_at?"Verified email":"Email unverified"}</span></div>
    <div className="ar-reader-profile">
      <div className="ar-mgmt-avatar">{profile.avatar_url?<img src={profile.avatar_url} alt=""/>:(profile.display_name||profile.username||"R").slice(0,1).toUpperCase()}</div>
      <div className="ar-reader-profile-main"><h3>{profile.display_name||profile.username||"Reader"}</h3><p>{account.email||"No email address"}</p>{profile.username&&<small>@{profile.username}</small>}</div>
    </div>
    {account.pending_email&&<div className="ar-reader-pending"><strong>Email change pending</strong><span>{account.pending_email}</span><button type="button" className="ar-mgmt-action" disabled={busy} onClick={onResendEmailChange}>{busy?"Sending…":"Resend confirmation links"}</button></div>}
    {!account.email_confirmed_at&&account.email&&<button type="button" className="ar-mgmt-action" disabled={busy} onClick={onResendVerification}>{busy?"Sending…":"Resend verification email"}</button>}
    {message&&<p className="ar-reader-message" role="status">{message}</p>}
    {loading?<div className="ar-mgmt-empty">Loading reader activity…</div>:details&&<>
      <div className="ar-reader-kpis">
        <div><strong>{Number(stats.reading_history||0)+Number(stats.pdlpl_reading_history||0)}</strong><span>Chapters read</span></div>
        <div><strong>{Number(stats.comments||0)}</strong><span>Comments</span></div>
        <div><strong>{Number(stats.ratings||0)}</strong><span>Ratings</span></div>
        <div><strong>{Number(stats.bookmarks||0)}</strong><span>Favourites</span></div>
      </div>
      <div className="ar-reader-facts">
        <div><span>Joined</span><strong>{formatTime(account.created_at)}</strong></div>
        <div><span>Last sign-in</span><strong>{formatTime(account.last_sign_in_at)}</strong></div>
        <div><span>Memberships</span><strong>{(activity.memberships||[]).filter(x=>["active","cancelled"].includes(x.status)).map(x=>planLabel(x.plan_id)+" · "+x.status).join(", ")||"Free reader"}</strong></div>
        <div><span>Account status</span><strong>{account.banned_until&&new Date(account.banned_until)>new Date()?"Restricted until "+formatDate(account.banned_until):"Normal"}</strong></div>
      </div>
      <div className="ar-reader-two-col">
        <section className="ar-reader-list"><h4>Recent reading</h4>{reads.length?reads.map((row,i)=><article key={row.chapter_id+"-"+row._source}><strong>{formatReaderTitle(row,row._source)}</strong><small>{row._source==="pdlpl-reading"?"Pal Do Pal Ke Lamhe":"Atma Rekha"} · page {row.page_number||1}</small><time>{formatTime(row.updated_at)}</time></article>):<p className="ar-reader-empty">No reading history yet.</p>}</section>
        <section className="ar-reader-list"><h4>Recent comments</h4>{comments.length?comments.map(row=><article key={row.id}><strong>{row._source}</strong><p>{String(row.content||"").slice(0,180)}</p><time>{formatTime(row.created_at)}</time></article>):<p className="ar-reader-empty">No comments yet.</p>}</section>
      </div>
      <div className="ar-reader-two-col">
        <section className="ar-reader-list"><h4>Recent ratings</h4>{ratings.length?ratings.map(row=><article key={row.id}><strong>{row._source}</strong><p>{row.chapters?"Chapter "+(row.chapters.chapter_number??"—")+" · "+(row.chapters.title||"Untitled"):row.pal_do_pal_ke_lamhe_chapters?"Chapter "+(row.pal_do_pal_ke_lamhe_chapters.chapter_number??"—")+" · "+(row.pal_do_pal_ke_lamhe_chapters.title||"Untitled"):"Chapter rating"} · {row.rating}/10</p><time>{formatTime(row.created_at)}</time></article>):<p className="ar-reader-empty">No ratings yet.</p>}</section>
        <section className="ar-reader-list"><h4>Favourites</h4>{bookmarks.length?bookmarks.map(row=><article key={row.id}><strong>{row.chapters?"Chapter "+(row.chapters.chapter_number??"—")+" · "+(row.chapters.title||"Untitled"):row.pal_do_pal_ke_lamhe_chapters?"Chapter "+(row.pal_do_pal_ke_lamhe_chapters.chapter_number??"—")+" · "+(row.pal_do_pal_ke_lamhe_chapters.title||"Untitled"):"Saved chapter"}</strong><small>{row._source}</small><time>{formatTime(row.created_at)}</time></article>):<p className="ar-reader-empty">No favourites yet.</p>}</section>
      </div>
      <div className="ar-reader-two-col">
        <section className="ar-reader-list"><h4>Group chat</h4>{(activity.group_messages||[]).length?(activity.group_messages||[]).map(row=><article key={row.id}><p>{String(row.content||"").slice(0,180)}</p><time>{formatTime(row.created_at)}</time></article>):<p className="ar-reader-empty">No group messages yet.</p>}</section>
        <section className="ar-reader-list"><h4>Community reactions</h4>{(activity.community_reactions||[]).length?(activity.community_reactions||[]).map(row=><article key={row.id}><strong>{row.reaction||"Reaction"}</strong><time>{formatTime(row.created_at)}</time></article>):<p className="ar-reader-empty">No community reactions yet.</p>}</section>
      </div>
      {(activity.deletion_requests||[]).length>0&&<section className="ar-reader-list ar-reader-requests"><h4>Data deletion requests</h4>{activity.deletion_requests.map(row=><article key={row.id}><strong>{row.status}</strong><time>{formatTime(row.requested_at)}</time>{row.reason&&<p>{row.reason}</p>}</article>)}</section>}
      {(activity.payments||[]).length>0&&<section className="ar-reader-list ar-reader-requests"><h4>Recent payments</h4>{activity.payments.map(row=><article key={row.id}><strong>₹{Number(row.amount||0).toLocaleString("en-IN")} · {row.status}</strong><time>{formatTime(row.created_at)}</time></article>)}</section>}
    </>}
  </section>;
}

export default function AdminManagementTools(){
  const [isAdmin,setIsAdmin]=useState(false),[open,setOpen]=useState(null);
  const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [users,setUsers]=useState([]),[memberships,setMemberships]=useState(new Map()),[notifications,setNotifications]=useState([]),[activity,setActivity]=useState([]);
  const [userActionId,setUserActionId]=useState(''),[userActionMessage,setUserActionMessage]=useState('');
  const [selectedUser,setSelectedUser]=useState(null),[userDetails,setUserDetails]=useState(null),[userDetailsLoading,setUserDetailsLoading]=useState(false);
  const [pushForm,setPushForm]=useState({title:'📖 Atma Rekha',body:'A new message is available.',url:'/',audience:'all'}),[pushSending,setPushSending]=useState(false),[pushResult,setPushResult]=useState('');

  useEffect(()=>{let active=true; const check=async()=>{try{await verifyAdmin();if(active)setIsAdmin(true)}catch{if(active)setIsAdmin(false)}}; check(); const {data:l}=supabase.auth.onAuthStateChange(()=>check()); return()=>{active=false;l?.subscription?.unsubscribe()}},[]);

  useEffect(()=>{const handler=e=>{const view=e?.detail?.view;if(view==='users'||view==='notifications'||view==='activity')openView(view)};window.addEventListener('atma-admin-open-management',handler);return()=>window.removeEventListener('atma-admin-open-management',handler)},[isAdmin]);
  useEffect(()=>{const close=e=>{if(e.key==='Escape')setOpen(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);

  const loadUsers=async()=>{setLoading(true);setError('');try{await verifyAdmin();const {data,error:e}=await supabase.functions.invoke('get-admin-console-data',{body:{action:'users'}});if(e)throw e;const rows=data?.users||[];setUsers(rows);setMemberships(new Map(rows.map(row=>[row.id,row.subscription_status==='active'||row.subscription_status==='cancelled'?row.plan_id:null])))}catch(e){setError(e.message||'Unable to load users.')}finally{setLoading(false)}};
  const loadNotifications=async()=>{setLoading(true);setError('');try{await verifyAdmin();const {data,error:e}=await supabase.from('admin_notification_log').select('id,title,body,target,target_count,sent_count,failed_count,status,scheduled_for,sent_at,created_at,error').order('created_at',{ascending:false}).limit(200);if(e)throw e;setNotifications((data||[]).map(row=>({...row,content:row.body,published_at:row.sent_at||row.scheduled_for||row.created_at,is_pinned:false})))}catch(e){setError(e.message||'Unable to load notification history.')}finally{setLoading(false)}};
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
      const target = pushForm.audience === 'community' ? 'community' : 'all';
      const {data,error:e}=await supabase.functions.invoke('send-chapter-notification-v2',{body:{title,body,url,target,tag:target==='community'?'atma-rekha-community':'atma-rekha-admin'}});
      if(e)throw e;
      if(!data?.ok)throw new Error(data?.error||'Notification delivery failed.');
      setPushResult(`Sent ${Number(data.sent||0)} notification${Number(data.sent||0)===1?'':'s'} successfully${data.failed?`; ${Number(data.failed)} failed`:''}.`);
      await loadNotifications();
    }catch(e){setError(e?.message||'Unable to send push notification.');}
    finally{setPushSending(false)}
  };

  const resendVerification=async user=>{
    if(userActionId)return;
    if(user.email_confirmed_at){setUserActionMessage('This email is already verified.');return;}
    if(!window.confirm('Send a new verification email to '+(user.email||'this reader')+'?'))return;
    setUserActionId(user.id);setUserActionMessage('');setError('');
    try{
      await verifyAdmin();
      const {data,error:e}=await supabase.functions.invoke('get-admin-console-data',{body:{action:'send-verification',user_id:user.id}});
      if(e)throw e;
      if(!data?.ok)throw new Error(data?.error||'The verification email was not sent.');
      setUserActionMessage('Verification email sent to '+data.email+'.');
    }catch(e){setError(e?.message||'Could not send verification email.');}
    finally{setUserActionId('');}
  };
  const loadUserDetails=async reader=>{setSelectedUser(reader);setUserDetails(null);setUserDetailsLoading(true);setError('');setUserActionMessage('');try{await verifyAdmin();const {data,error:e}=await supabase.functions.invoke('get-admin-console-data',{body:{action:'user-details',user_id:reader.id}});if(e)throw e;if(!data?.user)throw new Error(data?.error||'Reader details could not be loaded.');setUserDetails(data)}catch(e){setError(e?.message||'Unable to load reader details.')}finally{setUserDetailsLoading(false)}};
  const resendEmailChange=async reader=>{if(userActionId)return;if(!reader.pending_email){setUserActionMessage('There is no pending email change for this reader.');return;}if(!window.confirm('Send confirmation links to the current and new email addresses?'))return;setUserActionId(reader.id);setUserActionMessage('');setError('');try{await verifyAdmin();const {data,error:e}=await supabase.functions.invoke('get-admin-console-data',{body:{action:'send-email-change',user_id:reader.id}});if(e)throw e;if(!data?.ok)throw new Error(data?.error||'Email confirmations were not sent.');setUserActionMessage('Confirmation emails sent to both addresses.');await loadUsers();await loadUserDetails(reader)}catch(e){setError(e?.message||'Could not send email-change confirmations.')}finally{setUserActionId('')}};
  const openView=type=>{setQuery('');setStatus('all');setError('');setPushResult('');setUserActionMessage('');setSelectedUser(null);setUserDetails(null);setOpen(type);if(type==='users')loadUsers();if(type==='notifications')loadNotifications();if(type==='activity')loadActivity()};
  const filteredUsers=useMemo(()=>{const q=query.trim().toLowerCase();return users.filter(u=>{const plan=planLabel(memberships.get(u.id));const text=`${u.username||''} ${u.display_name||''} ${u.email||''} ${u.pending_email||''} ${u.id||''} ${plan}`.toLowerCase();return(!q||text.includes(q))&&(status==='all'||plan===status)})},[users,memberships,query,status]);
  const userSummary=useMemo(()=>({total:users.length,verified:users.filter(u=>Boolean(u.email_confirmed_at)).length,unverified:users.filter(u=>!u.email_confirmed_at).length,pendingEmail:users.filter(u=>Boolean(u.pending_email)).length}),[users]);
  if(!isAdmin)return null;


  return <>
    <style>{`
      .ar-admin-extra-tab{width:100%;min-height:42px;padding:0 13px;border:1px solid transparent;border-radius:10px;background:#fff;color:#777;text-align:left;font-size:11px;font-weight:800;cursor:pointer}
      .ar-admin-extra-tab:hover{background:#f5f5f5;color:#111}
      .ar-mgmt-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.52);display:grid;place-items:center;padding:20px}
      .ar-mgmt-panel{width:min(1060px,100%);max-height:min(860px,92vh);background:#fff;color:#111;border:1px solid #ddd;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.22)}
      .ar-mgmt-head{display:flex;align-items:center;gap:15px;padding:20px 22px;border-bottom:1px solid #e8e8e8}.ar-mgmt-head small{display:block;color:#777;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.ar-mgmt-head h2{margin:4px 0 0;font-size:21px;letter-spacing:-.035em}.ar-mgmt-close{margin-left:auto;width:36px;height:36px;border:1px solid #ddd;background:#fff;border-radius:9px;font-size:20px;cursor:pointer}.ar-mgmt-tools{display:flex;gap:8px;padding:12px 18px;border-bottom:1px solid #e8e8e8;flex-wrap:wrap}.ar-mgmt-tools input,.ar-mgmt-tools select{min-height:40px;padding:0 11px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#111;outline:none}.ar-mgmt-tools input{flex:1;min-width:220px}.ar-mgmt-tools button{min-height:40px;padding:0 12px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#111;font-weight:800;cursor:pointer}.ar-mgmt-tools button:hover{background:#f5f5f5}.ar-mgmt-body{overflow:auto;min-height:280px}.ar-mgmt-table{width:100%;border-collapse:collapse}.ar-mgmt-table th{position:sticky;top:0;background:#f8f8f8;color:#777;font-size:9px;letter-spacing:.1em;text-transform:uppercase;text-align:left}.ar-mgmt-table th,.ar-mgmt-table td{padding:13px 18px;border-bottom:1px solid #eee}.ar-mgmt-user{display:flex;align-items:center;gap:10px}.ar-mgmt-avatar{width:34px;height:34px;border-radius:50%;overflow:hidden;background:#111;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}.ar-mgmt-avatar img{width:100%;height:100%;object-fit:cover}.ar-mgmt-user strong{display:block;font-size:12px}.ar-mgmt-user small{display:block;margin-top:2px;color:#777;font-size:10px}.ar-mgmt-badge{display:inline-flex;padding:4px 8px;border:1px solid #ddd;border-radius:99px;background:#fff;color:#333;font-size:9px;font-weight:800}.ar-mgmt-feed{padding:8px 18px}.ar-mgmt-feed article{padding:14px 4px;border-bottom:1px solid #eee}.ar-mgmt-feed article>div{display:flex;align-items:center;gap:8px}.ar-mgmt-feed strong{font-size:12px}.ar-mgmt-feed p{margin:6px 0;color:#555;font-size:12px;line-height:1.5}.ar-mgmt-feed time{display:block;margin-top:5px;color:#888;font-size:9px}.ar-mgmt-type{padding:3px 7px;border:1px solid #ddd;border-radius:99px;font-size:8px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.ar-mgmt-empty{padding:70px 20px;text-align:center;color:#777;font-size:12px}.ar-mgmt-error{margin:12px 18px;padding:10px 12px;border:1px solid #e2b0b0;border-radius:9px;color:#b00000;background:#fff;font-size:11px}.ar-push-card{margin:14px 18px 8px;padding:16px;border:1px solid #e3e3e3;border-radius:14px;background:#fafafa}.ar-push-card h3{margin:0;font-size:13px}.ar-push-card p{margin:4px 0 12px;color:#777;font-size:10px}.ar-push-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.ar-push-grid input,.ar-push-grid select,.ar-push-grid textarea{width:100%;box-sizing:border-box;border:1px solid #d8d8d8;border-radius:9px;background:#fff;color:#111;padding:10px;font:inherit;font-size:11px;outline:none}.ar-push-grid textarea{min-height:76px;resize:vertical;grid-column:1/-1}.ar-push-grid .wide{grid-column:1/-1}.ar-push-actions{display:flex;align-items:center;gap:10px;margin-top:10px}.ar-push-send{min-height:40px;padding:0 15px;border:0;border-radius:9px;background:#111;color:#fff;font-size:10px;font-weight:900;cursor:pointer}.ar-push-send:disabled{opacity:.55;cursor:not-allowed}.ar-push-result{font-size:10px;color:#167a42}.ar-push-note{font-size:9px;color:#777}
      @media(max-width:700px){.ar-mgmt-backdrop{padding:0}.ar-mgmt-panel{height:100%;max-height:none;border-radius:0}.ar-mgmt-head{padding:16px}.ar-mgmt-tools input{flex-basis:100%}.ar-mgmt-table{min-width:620px}.ar-mgmt-body{overflow:auto}.ar-push-grid{grid-template-columns:1fr}.ar-push-grid textarea,.ar-push-grid .wide{grid-column:1}}
    `}</style>
    {open&&<div className="ar-mgmt-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(null)}><section className="ar-mgmt-panel" role="dialog" aria-modal="true">
      <header className="ar-mgmt-head"><div><small>Admin workspace</small><h2>{open==='users'?'Users & memberships':open==='notifications'?'Notifications':'Recent activity'}</h2></div><button type="button" className="ar-mgmt-close" onClick={()=>setOpen(null)} aria-label="Close">×</button></header>
      {open==='notifications'&&<form className="ar-push-card" onSubmit={sendPushNotification}><h3>Push notification</h3><p>Send a real browser push notification using the existing protected Supabase notification service.</p><div className="ar-push-grid"><input value={pushForm.title} onChange={e=>setPushForm({...pushForm,title:e.target.value})} placeholder="Notification title" maxLength="100" required/><select value={pushForm.audience} onChange={e=>setPushForm({...pushForm,audience:e.target.value})} aria-label="Notification audience"><option value="all">All notification subscribers</option><option value="community">Community members</option></select><textarea value={pushForm.body} onChange={e=>setPushForm({...pushForm,body:e.target.value})} placeholder="Notification message" maxLength="240" required/><input className="wide" value={pushForm.url} onChange={e=>setPushForm({...pushForm,url:e.target.value})} placeholder="Open URL after tapping (e.g. /chapter/1)" maxLength="500"/><div className="ar-push-actions wide"><button className="ar-push-send" type="submit" disabled={pushSending}>{pushSending?'Sending…':'Send push notification'}</button>{pushResult&&<span className="ar-push-result">{pushResult}</span>}<span className="ar-push-note">Only authenticated admins can send.</span></div></div></form>}
      {open==='users'&&userActionMessage&&<div className="ar-mgmt-error" role="status">{userActionMessage}</div>}
      {open==='users'&&!selectedUser&&!loading&&<div className="ar-mgmt-summary"><div><strong>{userSummary.total.toLocaleString('en-IN')}</strong><span>Readers</span></div><div><strong>{userSummary.verified.toLocaleString('en-IN')}</strong><span>Verified</span></div><div><strong>{userSummary.unverified.toLocaleString('en-IN')}</strong><span>Unverified</span></div><div><strong>{userSummary.pendingEmail.toLocaleString('en-IN')}</strong><span>Email changes</span></div></div>}
      <div className="ar-mgmt-tools">{open==='users'&&<><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, email or membership…"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All memberships</option><option>Free</option><option>Mini Member</option><option>Member</option><option>Premium Member</option></select></>}{open!=='users'&&<input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search…"/>}<button type="button" onClick={()=>openView(open)} disabled={loading}>{loading?'Loading…':'Refresh'}</button></div>
      {error&&<div className="ar-mgmt-error" role="alert">{error}</div>}
      <div className="ar-mgmt-body">{loading?<div className="ar-mgmt-empty">Loading…</div>:open==='users'?(selectedUser?<ReaderDetails reader={selectedUser} details={userDetails} loading={userDetailsLoading} message={userActionMessage} busy={userActionId===selectedUser.id} onBack={()=>{setSelectedUser(null);setUserDetails(null);setError('');setUserActionMessage('')}} onResendVerification={()=>resendVerification(selectedUser)} onResendEmailChange={()=>resendEmailChange(selectedUser)}/>:<table className="ar-mgmt-table"><thead><tr><th>Reader</th><th>Email</th><th>Membership</th><th>Joined</th><th>Action</th></tr></thead><tbody>{filteredUsers.map(u=>{const name=u.display_name||u.username||'Reader';return <tr key={u.id}><td><div className="ar-mgmt-user"><div className="ar-mgmt-avatar">{u.avatar_url?<img src={u.avatar_url} alt=""/>:name.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><small>{u.username?`@${u.username}`:u.id.slice(0,12)}</small></div></div></td><td>{u.email||'—'}<br/><span className="ar-mgmt-badge">{u.email_confirmed_at?'Verified':'Unverified'}</span>{u.pending_email&&<small className="ar-mgmt-pending-email">Change to: {u.pending_email}</small>}</td><td><span className="ar-mgmt-badge">{planLabel(memberships.get(u.id))}</span></td><td>{formatDate(u.created_at)}</td><td><button type="button" className="ar-mgmt-action" onClick={()=>loadUserDetails(u)}>Details</button></td></tr>})}{!filteredUsers.length&&<tr><td colSpan="5"><div className="ar-mgmt-empty">No users match the current search or filter.</div></td></tr>}</tbody></table>):open==='notifications'?<div className="ar-mgmt-feed">{notifications.filter(x=>!query.trim()||`${x.title||''} ${x.body||x.content||''} ${x.target||''} ${x.status||''}`.toLowerCase().includes(query.trim().toLowerCase())).map(x=><article key={x.id||`${x.title}-${x.created_at}`}><div><strong>{x.title||'Notification'}</strong><span className="ar-mgmt-type">{x.status||'pending'}</span></div>{(x.body||x.content)&&<p>{x.body||x.content}</p>}<time>{x.target||'all'} · {Number(x.sent_count||0)} sent · {Number(x.failed_count||0)} failed · {formatTime(x.sent_at||x.scheduled_for||x.published_at||x.created_at)}</time></article>)}{!notifications.length&&<div className="ar-mgmt-empty">No push notification history yet.</div>}</div>:<div className="ar-mgmt-feed">{activity.filter(x=>!query.trim()||`${x.type} ${x.title}`.toLowerCase().includes(query.trim().toLowerCase())).map((x,i)=><article key={`${x.type}-${x.time}-${i}`}><div><span className="ar-mgmt-type">{x.type}</span><strong>{x.title}</strong></div><time>{formatTime(x.time)}</time></article>)}{!activity.length&&<div className="ar-mgmt-empty">No recent activity.</div>}</div>}</div>
    </section></div>}
  </>;
}