import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';

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


function ReaderDetailsPanel({ reader, details, loading, onBack, onResendVerification, actionBusy, actionMessage }) {
  const account = details?.user || reader;
  const profile = details?.profile || reader;
  const activity = details?.activity || {};
  const stats = details?.stats || {};
  const reads = [
    ...(activity.reading || []).map(row => ({ ...row, source: "Atma Rekha", chapter: row.chapters })),
    ...(activity.pdlpl_reading || []).map(row => ({ ...row, source: "Pal Do Pal Ke Lamhe", chapter: row.pal_do_pal_ke_lamhe_chapters })),
  ].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 6);
  const comments = [
    ...(activity.comments || []).map(row => ({ ...row, source: "Atma Rekha" })),
    ...(activity.pdlpl_comments || []).map(row => ({ ...row, source: "Pal Do Pal Ke Lamhe" })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  const ratings = [
    ...(activity.ratings || []).map(row => ({ ...row, source: "Atma Rekha", chapter: row.chapters })),
    ...(activity.pdlpl_ratings || []).map(row => ({ ...row, source: "Pal Do Pal Ke Lamhe", chapter: row.pal_do_pal_ke_lamhe_chapters })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  const bookmarks = [
    ...(activity.bookmarks || []).map(row => ({ ...row, source: "Atma Rekha", chapter: row.chapters })),
    ...(activity.pdlpl_bookmarks || []).map(row => ({ ...row, source: "Pal Do Pal Ke Lamhe", chapter: row.pal_do_pal_ke_lamhe_chapters })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  const chapterTitle = chapter => chapter
    ? 'Chapter ' + (chapter.chapter_number ?? '—') + ' · ' + (chapter.title || 'Untitled')
    : 'Chapter details unavailable';
  const statusLabel = value => String(value || 'unknown').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

  return <section className="ar-reader-details">
    <div className="ar-reader-detail-top">
      <button type="button" className="ar-mgmt-detail-back" onClick={onBack}>← Back to readers</button>
      <span className={'ar-mgmt-badge ar-mgmt-state ' + (account.email_confirmed_at ? 'verified' : 'unverified')}>{account.email_confirmed_at ? 'Verified email' : 'Unverified email'}</span>
    </div>
    <div className="ar-reader-profile">
      <div className="ar-mgmt-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile.display_name || profile.username || 'R').slice(0, 1).toUpperCase()}</div>
      <div><h3>{profile.display_name || profile.username || 'Reader'}</h3><p>{account.email || 'No email address'}</p>{profile.username && <small>@{profile.username}</small>}</div>
    </div>
    {account.pending_email && <div className="ar-reader-pending"><strong>Email change pending</strong><span>{account.pending_email}</span><small>Use Email Change Requests to review and resend verification links.</small></div>}
    {!account.email_confirmed_at && account.email && <div className="ar-reader-pending"><strong>Email verification needed</strong><span>{account.email}</span><button type="button" className="ar-mgmt-detail-button" disabled={actionBusy} onClick={onResendVerification}>{actionBusy ? 'Sending…' : 'Resend verification email'}</button>{actionMessage && <small role="status">{actionMessage}</small>}</div>}
    {loading ? <div className="ar-mgmt-empty">Loading reader activity…</div> : details && <>
      <div className="ar-reader-kpis">
        <div><strong>{Number(stats.reading_history || 0) + Number(stats.pdlpl_reading_history || 0)}</strong><span>Reading records</span></div>
        <div><strong>{Number(stats.comments || 0)}</strong><span>Comments</span></div>
        <div><strong>{Number(stats.ratings || 0)}</strong><span>Ratings</span></div>
        <div><strong>{Number(stats.bookmarks || 0)}</strong><span>Bookmarks</span></div>
      </div>
      <div className="ar-reader-facts">
        <div><span>Joined</span><strong>{formatTime(account.created_at)}</strong></div>
        <div><span>Last sign-in</span><strong>{formatTime(account.last_sign_in_at)}</strong></div>
        <div><span>Account status</span><strong>{account.banned_until && new Date(account.banned_until) > new Date() ? 'Restricted until ' + formatDate(account.banned_until) : 'Normal'}</strong></div>
        <div><span>Public badge</span><strong>{profile.public_badge || 'None'}</strong></div>
      </div>
      <div className="ar-reader-two-col">
        <section className="ar-reader-list"><h4>Recent reading</h4>{reads.length ? reads.map((row, i) => <article key={row.source + '-' + row.chapter_id + '-' + i}><strong>{chapterTitle(row.chapter)}</strong><small>{row.source} · page {row.page_number || 1}</small><time>{formatTime(row.updated_at)}</time></article>) : <p className="ar-reader-empty">No reading records found.</p>}</section>
        <section className="ar-reader-list"><h4>Recent comments</h4>{comments.length ? comments.map(row => <article key={row.source + '-' + row.id}><strong>{row.source}</strong><p>{String(row.content || '').slice(0, 180)}</p><time>{formatTime(row.created_at)}</time></article>) : <p className="ar-reader-empty">No comments found.</p>}</section>
      </div>
      <div className="ar-reader-two-col">
        <section className="ar-reader-list"><h4>Recent ratings</h4>{ratings.length ? ratings.map(row => <article key={row.source + '-' + row.id}><strong>{chapterTitle(row.chapter)}</strong><p>{row.rating}/10 · {row.source}</p><time>{formatTime(row.created_at)}</time></article>) : <p className="ar-reader-empty">No ratings found.</p>}</section>
        <section className="ar-reader-list"><h4>Bookmarks</h4>{bookmarks.length ? bookmarks.map(row => <article key={row.source + '-' + row.id}><strong>{chapterTitle(row.chapter)}</strong><small>{row.source}</small><time>{formatTime(row.created_at)}</time></article>) : <p className="ar-reader-empty">No bookmarks found.</p>}</section>
      </div>
      <div className="ar-reader-two-col">
        <section className="ar-reader-list"><h4>Membership history</h4>{(activity.memberships || []).length ? activity.memberships.map(row => <article key={row.id}><strong>{planLabel(row.plan_id)} · {statusLabel(row.status)}</strong><small>{row.cancel_at_period_end ? 'Cancels at period end' : 'No scheduled cancellation'}</small><time>{formatTime(row.current_period_end || row.created_at)}</time></article>) : <p className="ar-reader-empty">No membership records found.</p>}</section>
        <section className="ar-reader-list"><h4>Recent account requests</h4>{[...(activity.deletion_requests || []).map(row => ({ ...row, kind: 'Data deletion' })), ...(activity.email_changes || []).map(row => ({ ...row, kind: 'Email change' }))].sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at)).slice(0, 8).map(row => <article key={row.kind + '-' + row.id}><strong>{row.kind} · {statusLabel(row.status)}</strong>{row.requested_email && <p>{row.current_email} → {row.requested_email}</p>}<time>{formatTime(row.requested_at)}</time></article>)}
          {!(activity.deletion_requests || []).length && !(activity.email_changes || []).length && <p className="ar-reader-empty">No account requests found.</p>}
        </section>
      </div>
      {(activity.group_messages || []).length > 0 && <section className="ar-reader-list"><h4>Recent group messages</h4>{activity.group_messages.map(row => <article key={row.id}><p>{String(row.content || '').slice(0, 180)}</p><time>{formatTime(row.created_at)}</time></article>)}</section>}
      {(activity.community_reactions || []).length > 0 && <section className="ar-reader-list"><h4>Recent community reactions</h4>{activity.community_reactions.map(row => <article key={row.id}><strong>{row.reaction || 'Reaction'}</strong><time>{formatTime(row.created_at)}</time></article>)}</section>}
      {(activity.payments || []).length > 0 && <section className="ar-reader-list"><h4>Recent payments</h4>{activity.payments.map((row, i) => <article key={row.created_at + '-' + i}><strong>₹{Number(row.amount || 0).toLocaleString('en-IN')} · {statusLabel(row.status)}</strong><time>{formatTime(row.created_at)}</time></article>)}</section>}
    </>}
  </section>;
}

export default function AdminManagementTools(){
  const [isAdmin,setIsAdmin]=useState(false),[open,setOpen]=useState(null);
  const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[readerSegment,setReaderSegment]=useState('all'),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [users,setUsers]=useState([]),[memberships,setMemberships]=useState(new Map()),[notifications,setNotifications]=useState([]),[activity,setActivity]=useState([]),[emailRequests,setEmailRequests]=useState([]);
  const [pushForm,setPushForm]=useState({title:'Atma Rekha',body:'A new update is available.',url:'/',audience:'all',notificationType:'announcements'}),[pushSending,setPushSending]=useState(false),[pushResult,setPushResult]=useState('');
  const [emailRequestBusy,setEmailRequestBusy]=useState(''),[emailRequestMessage,setEmailRequestMessage]=useState('');
  const [selectedUser,setSelectedUser]=useState(null),[userDetails,setUserDetails]=useState(null),[userDetailsLoading,setUserDetailsLoading]=useState(false);
  const [userActionId,setUserActionId]=useState(''),[userActionMessage,setUserActionMessage]=useState('');

  useEffect(()=>{let active=true; const check=async()=>{try{await verifyAdmin();if(active)setIsAdmin(true)}catch{if(active)setIsAdmin(false)}}; check(); const {data:l}=supabase.auth.onAuthStateChange(()=>check()); return()=>{active=false;l?.subscription?.unsubscribe()}},[]);

  useEffect(()=>{const handler=e=>{const view=e?.detail?.view;if(view==='users'||view==='notifications'||view==='activity'||view==='emailChanges')openView(view)};window.addEventListener('atma-admin-open-management',handler);return()=>window.removeEventListener('atma-admin-open-management',handler)},[isAdmin]);
  useEffect(()=>{const close=e=>{if(e.key==='Escape')setOpen(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);

  const loadUsers=async()=>{setLoading(true);setError('');try{await verifyAdmin();const {data,error:e}=await supabase.functions.invoke('get-admin-console-data',{body:{action:'users'}});if(e)throw e;const rows=data?.users||[];setUsers(rows);setMemberships(new Map(rows.map(row=>[row.id,row.subscription_status==='active'||row.subscription_status==='cancelled'?row.plan_id:null])))}catch(e){setError(e.message||'Unable to load users.')}finally{setLoading(false)}};
  const loadUserDetails=async reader=>{
    setSelectedUser(reader);setUserDetails(null);setUserDetailsLoading(true);setError('');
    try{
      await verifyAdmin();
      const {data,error:e}=await supabase.functions.invoke('get-admin-console-data',{body:{action:'user-details',user_id:reader.id}});
      if(e)throw e;
      if(!data?.user)throw new Error(data?.error||'Reader details could not be loaded.');
      setUserDetails(data);
    }catch(e){setError(e?.message||'Unable to load reader details.');}
    finally{setUserDetailsLoading(false);}
  };
  const resendSignupVerification=async reader=>{
    if(userActionId)return;
    if(!reader?.id||reader.email_confirmed_at||!reader.email)return;
    if(!window.confirm('Send a new verification email to '+reader.email+'? The account email will not change, and the reader must use the verification link to confirm it.'))return;
    setUserActionId(reader.id);setUserActionMessage('');setError('');
    try{
      await verifyAdmin();
      const {data,error:e}=await supabase.functions.invoke('send-email-to-users',{body:{action:'resend_signup_verification',user_id:reader.id}});
      if(e)throw e;
      if(!data?.ok)throw new Error(data?.error||'Verification email could not be sent.');
      setUserActionMessage('Verification email sent to '+(data.email||reader.email)+(data.audit_warning?'. The email was sent, but the admin audit entry could not be saved.':'.'));
      await loadUserDetails(reader);
    }catch(e){setUserActionMessage(e?.message||'Unable to resend verification email.');}
    finally{setUserActionId('');}
  };
  const loadEmailChangeRequests=async()=>{setLoading(true);setError('');try{await verifyAdmin();const {data,error:e}=await supabase.functions.invoke('get-admin-console-data',{body:{action:'email_change_requests'}});if(e)throw e;if(!Array.isArray(data?.requests))throw new Error('The email-change service returned an invalid response.');setEmailRequests(data.requests)}catch(e){setError(e.message||'Unable to load email-change requests.')}finally{setLoading(false)}};
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
      if (!window.confirm(`Send this ${pushForm.notificationType.replaceAll('_',' ')} notification to ${target === 'community' ? 'community members' : 'all subscribed readers'}? Readers who disabled this category will be skipped.`)) return;
      const {data,error:e}=await supabase.functions.invoke('send-chapter-notification-v2',{body:{title,body,url,target,notificationType:pushForm.notificationType,tag:target==='community'?'atma-rekha-community':'atma-rekha-admin'}});
      if(e)throw e;
      if(!data?.ok)throw new Error(data?.error||'Notification delivery failed.');
      setPushResult(`Sent ${Number(data.sent||0)} notification${Number(data.sent||0)===1?'':'s'} successfully${data.failed?`; ${Number(data.failed)} failed`:''}.`);
      await loadNotifications();
    }catch(e){setError(e?.message||'Unable to send push notification.');}
    finally{setPushSending(false)}
  };

  const openView=type=>{setQuery('');setStatus('all');setReaderSegment('all');setError('');setPushResult('');setEmailRequestMessage('');setSelectedUser(null);setUserDetails(null);setOpen(type);if(type==='users')loadUsers();if(type==='notifications')loadNotifications();if(type==='activity')loadActivity();if(type==='emailChanges')loadEmailChangeRequests()};
  const resendEmailChange=async request=>{if(emailRequestBusy)return;if(!window.confirm('Send secure verification links to both '+request.current_email+' and '+request.requested_email+'? The reader must complete verification; this does not change the account email by itself.'))return;setEmailRequestBusy(request.id);setError('');setEmailRequestMessage('');try{await verifyAdmin();const {data,error:invokeError}=await supabase.functions.invoke('send-email-to-users',{body:{action:'resend_email_change_confirmation',request_id:request.id}});if(invokeError)throw invokeError;if(!data?.ok)throw new Error(data?.error||'Verification emails could not be sent.');const delivered=[data.sent_to_current?'current address':'',data.sent_to_new?'new address':''].filter(Boolean);setEmailRequestMessage('Verification sent to '+delivered.join(' and ')+'.'+(data.partial_delivery?' One address was not reached. Check delivery status.':'')+(data.audit_warning?' '+data.audit_warning:''));await loadEmailChangeRequests()}catch(e){setError(e.message||'Unable to resend verification emails.')}finally{setEmailRequestBusy('')}};
  const filteredUsers=useMemo(()=>{const q=query.trim().toLowerCase();return users.filter(u=>{const plan=planLabel(memberships.get(u.id));const text=`${u.username||''} ${u.display_name||''} ${u.id||''} ${u.email||''} ${u.new_email||''} ${plan} ${u.account_status||''}`.toLowerCase();const joined=Date.parse(u.created_at||'');const recent=Number.isFinite(joined)&&Date.now()-joined<=30*24*60*60*1000;const isMember=plan!=='Free';return(!q||text.includes(q))&&(status==='all'||plan===status)&&(readerSegment==='all'||(readerSegment==='free'&&!isMember)||(readerSegment==='members'&&isMember)||(readerSegment==='recent'&&recent))})},[users,memberships,query,status,readerSegment]);
  if(!isAdmin)return null;


  return <>
    <style>{`
      .ar-admin-extra-tab{width:100%;min-height:38px;padding:0 11px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ar-mgmt-muted,#737373);text-align:left;font-size:12px;font-weight:650;cursor:pointer}
      .ar-admin-extra-tab:hover{background:var(--ar-mgmt-surface,#f7f7f5);color:var(--ar-mgmt-fg,#171717)}
      .ar-mgmt-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.58);display:grid;place-items:center;padding:16px}
      .ar-mgmt-panel{--ar-mgmt-bg:#fff;--ar-mgmt-fg:#171717;--ar-mgmt-muted:#707070;--ar-mgmt-line:#e4e4e1;--ar-mgmt-surface:#f7f7f5;--ar-mgmt-input:#fff;width:min(1060px,100%);max-height:min(860px,94vh);background:var(--ar-mgmt-bg);color:var(--ar-mgmt-fg);border:1px solid var(--ar-mgmt-line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.24)}
      html[data-theme="dark"] .ar-mgmt-panel,html.dark .ar-mgmt-panel{--ar-mgmt-bg:#101010;--ar-mgmt-fg:#f4f4f2;--ar-mgmt-muted:#aaa;--ar-mgmt-line:#30302e;--ar-mgmt-surface:#191918;--ar-mgmt-input:#151514}
      .ar-mgmt-head{display:flex;align-items:center;gap:12px;padding:17px 20px;border-bottom:1px solid var(--ar-mgmt-line)}.ar-mgmt-head small{display:block;color:var(--ar-mgmt-muted);font-size:10px;font-weight:750;letter-spacing:.1em;text-transform:uppercase}.ar-mgmt-head h2{margin:4px 0 0;font-size:20px;line-height:1.25;letter-spacing:-.025em}.ar-mgmt-close{margin-left:auto;width:36px;height:36px;flex:none;border:1px solid var(--ar-mgmt-line);background:var(--ar-mgmt-input);color:var(--ar-mgmt-fg);border-radius:6px;font-size:20px;cursor:pointer}
      .ar-mgmt-tools{display:flex;gap:8px;padding:11px 16px;border-bottom:1px solid var(--ar-mgmt-line);flex-wrap:wrap}.ar-mgmt-tools input,.ar-mgmt-tools select{min-height:38px;padding:0 10px;border:1px solid var(--ar-mgmt-line);border-radius:6px;background:var(--ar-mgmt-input);color:var(--ar-mgmt-fg);outline:none;font:inherit;font-size:12px}.ar-mgmt-tools input{flex:1;min-width:200px}.ar-mgmt-tools button{min-height:38px;padding:0 12px;border:1px solid var(--ar-mgmt-line);border-radius:6px;background:var(--ar-mgmt-input);color:var(--ar-mgmt-fg);font-size:12px;font-weight:700;cursor:pointer}.ar-mgmt-tools button:hover{background:var(--ar-mgmt-surface)}.ar-mgmt-panel input:focus-visible,.ar-mgmt-panel select:focus-visible,.ar-mgmt-panel button:focus-visible,.ar-mgmt-panel summary:focus-visible{outline:2px solid currentColor;outline-offset:2px}
      .ar-mgmt-body{overflow:auto;min-height:180px}.ar-mgmt-table{width:100%;border-collapse:collapse;font-size:12px}.ar-mgmt-table th{position:sticky;top:0;z-index:1;background:var(--ar-mgmt-surface);color:var(--ar-mgmt-muted);font-size:10px;font-weight:750;letter-spacing:.07em;text-transform:uppercase;text-align:left}.ar-mgmt-table th,.ar-mgmt-table td{padding:11px 14px;border-bottom:1px solid var(--ar-mgmt-line);vertical-align:middle}.ar-mgmt-user{display:flex;align-items:center;gap:9px;min-width:230px}.ar-mgmt-avatar{width:32px;height:32px;border-radius:6px;overflow:hidden;background:var(--ar-mgmt-fg);color:var(--ar-mgmt-bg);display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}.ar-mgmt-avatar img{width:100%;height:100%;object-fit:cover}.ar-mgmt-user strong{display:block;font-size:12px;line-height:1.35}.ar-mgmt-user small{display:block;margin-top:3px;color:var(--ar-mgmt-muted);font-size:10px;overflow-wrap:anywhere}.ar-mgmt-user .ar-mgmt-email{color:var(--ar-mgmt-fg);font-size:11px}.ar-mgmt-user .ar-mgmt-pending-email{color:#ae7018}.ar-mgmt-last-seen{display:block;margin-top:4px;color:var(--ar-mgmt-muted);font-size:10px;white-space:nowrap}.ar-mgmt-badge{display:inline-flex;align-items:center;padding:3px 6px;border:1px solid var(--ar-mgmt-line);border-radius:4px;background:var(--ar-mgmt-input);color:var(--ar-mgmt-fg);font-size:10px;font-weight:700;white-space:nowrap}.ar-mgmt-state.active,.ar-mgmt-state.verified{border-color:#a8cdb2;color:#23683a}.ar-mgmt-state.unverified,.ar-mgmt-state.pending{border-color:#d9bd82;color:#8a5a0b}.ar-mgmt-state.suspended,.ar-mgmt-state.cancelled,.ar-mgmt-state.superseded{border-color:#c99e9e;color:#a04444}
      .ar-mgmt-feed{padding:4px 16px}.ar-mgmt-feed article{padding:13px 2px;border-bottom:1px solid var(--ar-mgmt-line)}.ar-mgmt-feed article>div{display:flex;align-items:center;gap:8px}.ar-mgmt-feed strong{font-size:12px;line-height:1.5;overflow-wrap:anywhere}.ar-mgmt-feed p{margin:6px 0;color:var(--ar-mgmt-muted);font-size:12px;line-height:1.5}.ar-mgmt-feed time{display:block;color:var(--ar-mgmt-muted);font-size:10px;white-space:nowrap}.ar-mgmt-type{padding:3px 6px;border:1px solid var(--ar-mgmt-line);border-radius:4px;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.ar-mgmt-empty{padding:42px 18px;text-align:center;color:var(--ar-mgmt-muted);font-size:12px}.ar-mgmt-detail-button,.ar-mgmt-detail-back{min-height:32px;padding:0 10px;border:1px solid var(--ar-mgmt-line);border-radius:5px;background:var(--ar-mgmt-input);color:var(--ar-mgmt-fg);font-size:11px;font-weight:700;cursor:pointer}.ar-reader-details{padding:14px 16px 20px}.ar-reader-detail-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.ar-reader-profile{display:flex;align-items:center;gap:12px;padding:16px 0}.ar-reader-profile h3{margin:0;font-size:18px}.ar-reader-profile p{margin:3px 0;font-size:12px;color:var(--ar-mgmt-muted);overflow-wrap:anywhere}.ar-reader-profile small{font-size:11px;color:var(--ar-mgmt-muted)}.ar-reader-pending{display:grid;gap:4px;padding:10px 12px;margin-bottom:12px;border:1px solid #d9bd82;border-radius:6px;font-size:12px}.ar-reader-pending small{color:var(--ar-mgmt-muted)}.ar-reader-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:8px 0}.ar-reader-kpis>div,.ar-reader-facts>div{padding:10px;border:1px solid var(--ar-mgmt-line);border-radius:6px}.ar-reader-kpis strong,.ar-reader-kpis span,.ar-reader-facts span,.ar-reader-facts strong{display:block}.ar-reader-kpis strong{font-size:19px}.ar-reader-kpis span,.ar-reader-facts span{font-size:10px;color:var(--ar-mgmt-muted)}.ar-reader-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0 14px}.ar-reader-facts strong{margin-top:4px;font-size:12px;overflow-wrap:anywhere}.ar-reader-two-col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}.ar-reader-list{min-width:0;border:1px solid var(--ar-mgmt-line);border-radius:7px;padding:10px 12px}.ar-reader-list h4{margin:0 0 8px;font-size:12px}.ar-reader-list article{padding:8px 0;border-top:1px solid var(--ar-mgmt-line);min-width:0}.ar-reader-list article strong,.ar-reader-list article small,.ar-reader-list article time{display:block;font-size:11px;overflow-wrap:anywhere}.ar-reader-list article small,.ar-reader-list article time,.ar-reader-list article p,.ar-reader-empty{color:var(--ar-mgmt-muted)}.ar-reader-list article p{margin:5px 0;font-size:11px;line-height:1.45;overflow-wrap:anywhere}.ar-reader-list article time{margin-top:4px;font-size:10px}.ar-reader-empty{font-size:11px}@media(max-width:700px){.ar-reader-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ar-reader-facts,.ar-reader-two-col{grid-template-columns:1fr}.ar-reader-details{padding:10px 12px}}.ar-mgmt-error,.ar-mgmt-message{margin:10px 16px 0;padding:10px 12px;border:1px solid var(--ar-mgmt-line);border-radius:6px;font-size:12px;line-height:1.5}.ar-mgmt-error{border-color:#d9a4a4;color:#a12828;background:#fff5f5}.ar-mgmt-message{border-color:#b1cfba;color:#24623a;background:#f4faf5}
      .ar-push-card{margin:12px 16px 6px;padding:14px;border:1px solid var(--ar-mgmt-line);border-radius:8px;background:var(--ar-mgmt-surface)}.ar-push-card h3{margin:0;color:var(--ar-mgmt-fg);font-size:13px}.ar-push-card p{margin:4px 0 10px;color:var(--ar-mgmt-muted);font-size:11px}.ar-push-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ar-push-grid input,.ar-push-grid select,.ar-push-grid textarea{width:100%;box-sizing:border-box;border:1px solid var(--ar-mgmt-line);border-radius:6px;background:var(--ar-mgmt-input);color:var(--ar-mgmt-fg);padding:10px;font:inherit;font-size:12px;outline:none}.ar-push-grid textarea{min-height:72px;resize:vertical;grid-column:1/-1}.ar-push-grid .wide{grid-column:1/-1}.ar-push-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}.ar-push-send,.ar-email-resend{min-height:36px;padding:0 12px;border:1px solid var(--ar-mgmt-fg);border-radius:6px;background:var(--ar-mgmt-fg);color:var(--ar-mgmt-bg);font-size:11px;font-weight:750;cursor:pointer}.ar-push-send:disabled,.ar-email-resend:disabled{opacity:.55;cursor:not-allowed}.ar-push-result{font-size:11px;color:#3e9560}.ar-push-note{font-size:10px;color:var(--ar-mgmt-muted)}
      .ar-email-request-top{display:flex!important;align-items:flex-start!important;justify-content:space-between;gap:12px}.ar-email-request-top>div{display:grid;justify-items:start;gap:6px;min-width:0}.ar-email-request-top strong{font-size:12px;overflow-wrap:anywhere}.ar-email-request-top small{color:var(--ar-mgmt-muted);font-size:10px}.ar-email-resend{white-space:nowrap;flex:none}.ar-email-history{margin-top:10px;border-top:1px solid var(--ar-mgmt-line);padding-top:8px}.ar-email-history summary{cursor:pointer;font-size:11px;font-weight:700;color:var(--ar-mgmt-muted)}.ar-email-history ul{list-style:none;margin:8px 0 0;padding:0}.ar-email-history li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:5px 0;color:var(--ar-mgmt-fg);font-size:11px}.ar-email-history li time{font-size:10px}.ar-email-history p{margin:8px 0;color:var(--ar-mgmt-muted);font-size:11px}
      @media(max-width:700px){.ar-mgmt-backdrop{padding:0}.ar-mgmt-panel{height:100%;max-height:none;border-radius:0;border-left:0;border-right:0}.ar-mgmt-head{padding:14px}.ar-mgmt-head h2{font-size:18px}.ar-mgmt-tools{padding:9px 12px}.ar-mgmt-tools input{flex-basis:100%;min-width:0}.ar-mgmt-tools select{flex:1;min-width:0}.ar-mgmt-table{min-width:760px}.ar-mgmt-body{overflow:auto}.ar-mgmt-feed{padding:3px 12px}.ar-push-grid{grid-template-columns:1fr}.ar-push-grid textarea,.ar-push-grid .wide{grid-column:1}.ar-email-request-top{flex-direction:column}.ar-email-request-top>div{width:100%}.ar-email-history li{align-items:flex-start}.ar-email-history li time{white-space:normal;text-align:right}}
      @media(prefers-reduced-motion:reduce){.ar-mgmt-panel *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
    `}</style>
    {open&&<div className="ar-mgmt-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(null)}><section className="ar-mgmt-panel" role="dialog" aria-modal="true">
      <header className="ar-mgmt-head"><div><small>Admin workspace</small><h2>{open==='users'?'Users & memberships':open==='notifications'?'Notifications':open==='emailChanges'?'Email change requests':'Recent activity'}</h2></div><button type="button" className="ar-mgmt-close" onClick={()=>setOpen(null)} aria-label="Close">×</button></header>
      {open==='notifications'&&<form className="ar-push-card" onSubmit={sendPushNotification}><h3>Push notification</h3><p>Send a real browser push notification using the existing protected Supabase notification service.</p><div className="ar-push-grid"><input value={pushForm.title} onChange={e=>setPushForm({...pushForm,title:e.target.value})} placeholder="Notification title" maxLength="100" required/><select value={pushForm.audience} onChange={e=>setPushForm({...pushForm,audience:e.target.value})} aria-label="Notification audience"><option value="all">All notification subscribers</option><option value="community">Community members</option></select><select value={pushForm.notificationType} onChange={e=>setPushForm({...pushForm,notificationType:e.target.value})} aria-label="Notification category"><option value="new_chapters">New chapters</option><option value="comments_replies">Comments and replies</option><option value="group_chat">Group chat</option><option value="community_posts">Community posts</option><option value="announcements">Announcements</option><option value="membership_account">Membership and account</option><option value="other_updates">Other creator updates</option></select><textarea value={pushForm.body} onChange={e=>setPushForm({...pushForm,body:e.target.value})} placeholder="Notification message" maxLength="240" required/><input className="wide" value={pushForm.url} onChange={e=>setPushForm({...pushForm,url:e.target.value})} placeholder="Open URL after tapping (e.g. /chapter/1)" maxLength="500"/><div className="ar-push-actions wide"><button className="ar-push-send" type="submit" disabled={pushSending}>{pushSending?'Sending…':'Send push notification'}</button>{pushResult&&<span className="ar-push-result">{pushResult}</span>}<span className="ar-push-note">Only authenticated admins can send.</span></div></div></form>}
      <div className="ar-mgmt-tools">{open==='users'&&<><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search username, display name, ID or membership…"/><select value={status} onChange={e=>setStatus(e.target.value)} aria-label="Filter by membership"><option value="all">All memberships</option><option>Free</option><option>Mini Member</option><option>Member</option><option>Premium Member</option></select><select value={readerSegment} onChange={e=>setReaderSegment(e.target.value)} aria-label="Reader segment"><option value="all">All readers</option><option value="free">Free readers</option><option value="members">Members</option><option value="recent">Joined in last 30 days</option></select></>}{open!=='users'&&<input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={open==='emailChanges'?'Search current or requested email…':'Search…'}/>}<button type="button" onClick={()=>openView(open)} disabled={loading}>{loading?'Loading…':'Refresh'}</button></div>
      {error&&<div className="ar-mgmt-error" role="alert">{error}</div>}
      {emailRequestMessage&&open==='emailChanges'&&<div className="ar-mgmt-message" role="status">{emailRequestMessage}</div>}
      <div className="ar-mgmt-body">{loading?<div className="ar-mgmt-empty">Loading…</div>:open==='users'?(selectedUser?<ReaderDetailsPanel reader={selectedUser} details={userDetails} loading={userDetailsLoading} onBack={()=>{setSelectedUser(null);setUserDetails(null);setError('');setUserActionMessage('')}} onResendVerification={()=>resendSignupVerification(selectedUser)} actionBusy={userActionId===selectedUser.id} actionMessage={userActionMessage}/>:<table className="ar-mgmt-table"><thead><tr><th>User / email</th><th>Membership</th><th>Account</th><th>Joined</th><th>Details</th></tr></thead><tbody>{filteredUsers.map(u=>{const name=u.display_name||u.username||'Reader';const accountStatus=u.account_status||'unknown';return <tr key={u.id}><td><div className="ar-mgmt-user"><div className="ar-mgmt-avatar">{u.avatar_url?<img src={u.avatar_url} alt=""/>:name.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><small>{u.username?'@'+u.username:u.id.slice(0,12)}</small><small className="ar-mgmt-email">{u.email||'No email available'}</small>{u.new_email&&<small className="ar-mgmt-pending-email">Pending: {u.new_email}</small>}</div></div></td><td><span className="ar-mgmt-badge">{planLabel(memberships.get(u.id))}</span></td><td><span className={'ar-mgmt-badge ar-mgmt-state '+accountStatus}>{accountStatus==='active'?'Active':accountStatus==='unverified'?'Unverified':accountStatus==='suspended'?'Suspended':'Unknown'}</span></td><td>{formatDate(u.created_at)}{u.last_sign_in_at&&<small className="ar-mgmt-last-seen">Last sign-in {formatDate(u.last_sign_in_at)}</small>}</td><td><button type="button" className="ar-mgmt-detail-button" onClick={()=>loadUserDetails(u)}>Details</button></td></tr>})}{!filteredUsers.length&&<tr><td colSpan="5"><div className="ar-mgmt-empty">No users match the current search or filter.</div></td></tr>}</tbody></table>):open==='emailChanges'?<div className="ar-mgmt-feed ar-email-requests">{emailRequests.filter(request=>!query.trim()||`${request.current_email||''} ${request.requested_email||''} ${request.status||''}`.toLowerCase().includes(query.trim().toLowerCase())).map(request=><article key={request.id} className="ar-email-request"><div className="ar-email-request-top"><div><span className={'ar-mgmt-badge ar-mgmt-state '+request.status}>{request.status==='pending'?'Pending verification':request.status==='verified'?'Verified':request.status==='superseded'?'Superseded':'Cancelled'}</span><strong>{request.current_email||'Current email unavailable'} <span aria-hidden="true">→</span> {request.requested_email||'Requested email unavailable'}</strong><small>Requested {formatTime(request.requested_at)} · {Number(request.resend_count||0)} admin resend(s)</small></div>{request.status==='pending'&&<button type="button" className="ar-email-resend" disabled={Boolean(emailRequestBusy)} onClick={()=>resendEmailChange(request)}>{emailRequestBusy===request.id?'Sending…':'Resend verification'}</button>}</div>{request.last_admin_resend_at&&<small className="ar-mgmt-last-seen">Last resend {formatTime(request.last_admin_resend_at)}</small>}<details className="ar-email-history"><summary>Request history ({(request.events||[]).length})</summary>{request.events?.length?<ul>{request.events.map(event=><li key={event.id}><span>{({requested:'Requested',verification_resent:'Verification resent',verified:'Verified',superseded:'Superseded',cancelled:'Closed'})[event.event_type]||event.event_type.replaceAll('_',' ')}</span><time>{formatTime(event.created_at)}</time></li>)}</ul>:<p>No recorded actions.</p>}</details></article>)}{!emailRequests.filter(request=>!query.trim()||`${request.current_email||''} ${request.requested_email||''} ${request.status||''}`.toLowerCase().includes(query.trim().toLowerCase())).length&&<div className="ar-mgmt-empty">No email-change requests match this search.</div>}</div>:open==='notifications'?<div className="ar-mgmt-feed">{notifications.filter(x=>!query.trim()||`${x.title||''} ${x.body||x.content||''} ${x.target||''} ${x.status||''}`.toLowerCase().includes(query.trim().toLowerCase())).map(x=><article key={x.id||`${x.title}-${x.created_at}`}><div><strong>{x.title||'Notification'}</strong><span className="ar-mgmt-type">{x.status||'pending'}</span></div>{(x.body||x.content)&&<p>{x.body||x.content}</p>}<time>{x.target||'all'} · {Number(x.sent_count||0)} sent · {Number(x.failed_count||0)} failed · {formatTime(x.sent_at||x.scheduled_for||x.published_at||x.created_at)}</time></article>)}{!notifications.length&&<div className="ar-mgmt-empty">No push notification history yet.</div>}</div>:<div className="ar-mgmt-feed">{activity.filter(x=>!query.trim()||`${x.type} ${x.title}`.toLowerCase().includes(query.trim().toLowerCase())).map((x,i)=><article key={`${x.type}-${x.time}-${i}`}><div><span className="ar-mgmt-type">{x.type}</span><strong>{x.title}</strong></div><time>{formatTime(x.time)}</time></article>)}{!activity.length&&<div className="ar-mgmt-empty">No recent activity.</div>}</div>}</div>
    </section></div>}
  </>;
}