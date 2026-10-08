import { useEffect, useMemo, useState } from 'react';
import { supabase, getPublicReaderTiers } from './supabase';
import SubscriberBadge from './SubscriberBadge.jsx';
import { fetchChapterComments, fetchAnnouncementComments, fetchCommentLikes, likeComment, unlikeComment, reportComment, addComment } from './engagement';
import { getRenderedChapterId, legacyChapterIdFromHash } from './routes';
import { fetchPdlplChapterComments, fetchPdlplCommentLikes, likePdlplComment, unlikePdlplComment, reportPdlplComment, addPdlplComment } from './pdlplEngagement';

const ago = value => { const d = Math.max(0, Date.now() - new Date(value).getTime()); const m = Math.floor(d / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; const days = Math.floor(h / 24); if (days < 30) return `${days}d`; if (days < 365) return `${Math.floor(days / 30)}mo`; return `${Math.floor(days / 365)}y`; };
const profileLabel = p => p?.username || 'reader';
// Deployment marker only; no application behavior change.
const ADMIN_EMAILS = new Set([
  'atmarekhasupport@gmail.com',
  'atmarekhaoffical@gmail.com',
  'atmarekhacreator@gmail.com',
]);
const MEMBERSHIP_PRIORITY = { premium: 3, supporter: 2, mini_member: 1 };
const isAdminComment = (comment, profilesById = new Map()) => {
  const profile = profilesById.get(comment?.user_id);
  return ADMIN_EMAILS.has(String(profile?.email || '').trim().toLowerCase());
};
const membershipRank = plan => MEMBERSHIP_PRIORITY[String(plan || '').toLowerCase()] || 0;
const planLabel = plan => {
  const key = String(plan || '').toLowerCase();
  if (key === 'supporter') return 'Priority';
  if (key === 'mini_member') return 'Member';
  return '';
};
const sortCommentFeed = (rows, membershipPlans, likeCounts = {}, profilesById = new Map()) => {
  const enriched = rows.map((comment, index) => ({
    comment,
    likes: Number(likeCounts?.[comment.id]) || 0,
    membership: membershipRank(membershipPlans.get(comment.user_id)),
    admin: isAdminComment(comment, profilesById),
    index,
  }));
  const byLikes = [...enriched].sort((a, b) => (
    Number(b.admin) - Number(a.admin) ||
    b.likes - a.likes ||
    b.membership - a.membership ||
    new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime() ||
    a.index - b.index
  ));
  const featuredIds = new Set(
    byLikes.filter(item => item.likes > 0).slice(0, 3).map(item => item.comment.id)
  );
  const featured = byLikes.filter(item => featuredIds.has(item.comment.id));
  const priority = enriched
    .filter(item => !featuredIds.has(item.comment.id))
    .sort((a, b) => (
      b.membership - a.membership ||
      b.likes - a.likes ||
      new Date(b.comment.created_at).getTime() - new Date(a.comment.created_at).getTime() ||
      a.index - b.index
    ));
  const ordered = [...featured, ...priority];
  return ordered.sort((a, b) => {
    const aa = isAdminComment(a.comment, profilesById);
    const bb = isAdminComment(b.comment, profilesById);
    return Number(bb) - Number(aa);
  }).map(item => item.comment);
};
const friendlyError = (error, fallback = 'Something went wrong. Please try again.') => { const raw = String(error?.message || error || '').toLowerCase(); if (!raw || raw.includes('jwt') || raw.includes('auth') || raw.includes('permission denied') || raw.includes('row-level security') || raw.includes('rls') || raw.includes('profiles') || raw.includes('not authenticated') || raw.includes('unauthorized')) { if (raw.includes('auth') || raw.includes('jwt') || raw.includes('not authenticated') || raw.includes('unauthorized') || raw.includes('permission denied')) return 'Please log in to do this action.'; return fallback; } return fallback; };
function getChapterId(button) { const row = button?.closest?.('.chapter-row'); const rowId = row?.getAttribute('data-chapter-id'); if (rowId) return rowId; const readerId = getRenderedChapterId(); if (readerId) return readerId; return legacyChapterIdFromHash(window.location.hash); }
function getAnnouncementId(button) { return button?.closest?.('.home-announcement')?.getAttribute('data-announcement-id') || null; }

export default function EnhancedComments() {
  const [open,setOpen]=useState(false),[chapterId,setChapterId]=useState(null),[announcementId,setAnnouncementId]=useState(null),[source,setSource]=useState('atma'),[comments,setComments]=useState([]),[profiles,setProfiles]=useState({}),[membershipPlans,setMembershipPlans]=useState(new Map()),[likes,setLikes]=useState({counts:{},liked:{}}),[user,setUser]=useState(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[text,setText]=useState(''),[replyTo,setReplyTo]=useState(null),[preview,setPreview]=useState(null),[copied,setCopied]=useState(null),[reporting,setReporting]=useState(null);
  useEffect(()=>{let active=true;supabase.auth.getSession().then(({data})=>{if(active)setUser(data?.session?.user||null)});const {data:listener}=supabase.auth.onAuthStateChange((_e,session)=>setUser(session?.user||null));return()=>{active=false;listener.subscription.unsubscribe()}},[]);
  useEffect(()=>{
    const openPdlplEvent=event=>{
      const id=event.detail?.chapterId;
      if(!id)return;
      setSource('pdlpl');
      setAnnouncementId(null);
      setChapterId(String(id));
      setOpen(true);
    };
    window.addEventListener('atma-open-pdlpl-comments',openPdlplEvent);
    const handler=event=>{
      const button=event.target?.closest?.('button');
      if(!button)return;
      const label=`${button.getAttribute('aria-label')||''} ${button.getAttribute('title')||''} ${button.textContent||''}`.toLowerCase();
      if(!label.includes('comments'))return;
      const isPdlpl=Boolean(button.closest('.pdlpl-page-list,.pdlpl-reader'));
      const announcementIdValue=getAnnouncementId(button);
      const id=announcementIdValue?null:getChapterId(button);
      if(!announcementIdValue&&!id)return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setSource(isPdlpl?'pdlpl':'atma');
      setAnnouncementId(announcementIdValue);
      setChapterId(id);
      setOpen(true);
    };
    document.addEventListener('click',handler,true);
    return()=>{
      window.removeEventListener('atma-open-pdlpl-comments',openPdlplEvent);
      document.removeEventListener('click',handler,true);
    };
  },[]);
  const load=async()=>{if(!chapterId&&!announcementId)return;setLoading(true);setError('');try{const rows=announcementId?await fetchAnnouncementComments(announcementId):source==='pdlpl'?await fetchPdlplChapterComments(chapterId):await fetchChapterComments(chapterId);setComments(rows);const commentIds=rows.map(r=>r.id);try{setLikes(announcementId?await fetchCommentLikes(commentIds):source==='pdlpl'?await fetchPdlplCommentLikes(commentIds):await fetchCommentLikes(commentIds))}catch(likeError){console.warn('Comment likes lookup failed:',likeError);setLikes({counts:{},liked:{}})}const ids=[...new Set(rows.map(r=>r.user_id).filter(Boolean))];if(user?.id)ids.push(user.id);if(ids.length){const uniqueIds=[...new Set(ids)];const {data,error:e}=await supabase.from('profiles').select('id,username,display_name,avatar_url,bio,created_at').in('id',uniqueIds);if(e){console.warn('Comment profile lookup failed:',e);setProfiles({})}else setProfiles(Object.fromEntries((data||[]).map(p=>[p.id,p])));try{setMembershipPlans(await getPublicReaderTiers(uniqueIds))}catch(subscriptionError){console.warn('Public membership tier lookup failed:',subscriptionError);setMembershipPlans(new Map())}}else{setProfiles({});setMembershipPlans(new Map())}}catch(e){console.error('Comments load failed:',e);setError(friendlyError(e,'We couldn’t load the comments right now. Please try again.'))}finally{setLoading(false)}};
  useEffect(()=>{if(!open||source!=='pdlpl'||!chapterId)return;const channel=supabase.channel(`pdlpl-comments-${chapterId}`).on('postgres_changes',{event:'*',schema:'public',table:'pdlpl_comments',filter:`chapter_id=eq.${chapterId}`},async payload=>{if(payload.eventType==='INSERT'){setComments(prev=>prev.some(c=>c.id===payload.new.id)?prev:[...prev,payload.new])}else if(payload.eventType==='UPDATE'){setComments(prev=>prev.map(c=>c.id===payload.new.id?payload.new:c))}else if(payload.eventType==='DELETE'){setComments(prev=>prev.filter(c=>c.id!==payload.old.id))}}).subscribe();return()=>{supabase.removeChannel(channel)}},[open,source,chapterId]);
  useEffect(()=>{if(open&&(chapterId||announcementId))load()},[open,chapterId,announcementId,source,user?.id]);
  const profilesById = useMemo(() => new Map(Object.entries(profiles)), [profiles]);
  const top=useMemo(
  ()=>sortCommentFeed(comments.filter(c=>!c.parent_comment_id),membershipPlans,likes.counts,profilesById),
  [comments,membershipPlans,likes.counts,profilesById]
); const child=useMemo(()=>comments.filter(c=>c.parent_comment_id),[comments]); const profile=id=>profiles[id]||null;
  const goProfile=id=>{if(id)window.location.hash=`public-profile/${encodeURIComponent(id)}`};
  const ensureAuth=()=>{if(user)return true;setError('Please log in to do this action.');return false};
  const post=async event=>{event.preventDefault();if(!ensureAuth()||busy)return;const clean=text.trim();if(!clean)return;setBusy(true);setError('');try{const row=source==='pdlpl'?await addPdlplComment({chapterId,content:clean,parentCommentId:replyTo}):await addComment({chapterId: chapterId || null, announcementId: announcementId || null, content:clean,parentCommentId:replyTo});setComments(p=>[...p,row]);setText('');setReplyTo(null)}catch(e){setError(friendlyError(e,'We couldn’t post your comment. Please try again.'))}finally{setBusy(false)}};
  const toggleLike=async comment=>{if(!ensureAuth())return;const liked=!!likes.liked[comment.id];try{if(liked){await (source==='pdlpl'?unlikePdlplComment(comment.id):unlikeComment(comment.id));setLikes(p=>({counts:{...p.counts,[comment.id]:Math.max(0,(p.counts[comment.id]||1)-1)},liked:{...p.liked,[comment.id]:false}}))}else{await (source==='pdlpl'?likePdlplComment(comment.id):likeComment(comment.id));setLikes(p=>({counts:{...p.counts,[comment.id]:(p.counts[comment.id]||0)+1},liked:{...p.liked,[comment.id]:true}}))}}catch(e){setError(friendlyError(e,'We couldn’t update the reaction. Please try again.'))}};
  const copy=async comment=>{try{const shareText=`${comment.content}\n— Atma Rekha Community`;if(navigator.share){await navigator.share({text:shareText})}else{await navigator.clipboard?.writeText(shareText);setCopied(comment.id);setTimeout(()=>setCopied(null),1400)}}catch(e){if(e?.name!=='AbortError')setError('Sharing is unavailable on this device.')}};
  const report=async comment=>{if(reporting===comment.id)return;setReporting(comment.id);try{await (source==='pdlpl'?reportPdlplComment(comment.id):reportComment(comment.id));setError('Thanks. The comment has been reported.')}catch(e){setError(friendlyError(e,'We couldn’t report the comment. Please try again.'))}finally{setReporting(null)}};
  if(!open)return null;
  return <div className="ec-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><section className="ec-sheet" role="dialog" aria-modal="true" aria-label="Comments"><header className="ec-header"><div><h2>Comments<span>{comments.length}</span></h2></div><button className="ec-close" onClick={()=>setOpen(false)} aria-label="Close">×</button></header>{!user&&<div className="ec-join"><div className="ec-join-icon">✦</div><div><strong>Join the community</strong><p>Reading is free. Create a free account to comment, reply and react.</p></div><button onClick={()=>{setOpen(false);window.location.hash='home';setTimeout(()=>Array.from(document.querySelectorAll('button')).find(b=>/sign in/i.test(b.textContent||''))?.click(),150)}}>Join free</button></div>}{loading?<div className="ec-state">Opening comments…</div>:error&&!comments.length?<div className="ec-state"><strong>We couldn’t load the comments.</strong><span>{error}</span></div>:!top.length?<div className="ec-empty"><div>💬</div><strong>Start the first comment</strong><p>No comments yet. Be the first reader to leave a thought.</p></div>:<div className="ec-list">{top.map(comment=><CommentCard key={comment.id} comment={comment} replies={child.filter(r=>r.parent_comment_id===comment.id)} profile={profile(comment.user_id)} user={user} likes={likes} onLike={toggleLike} onReply={id=>{setReplyTo(id);setText('')}} onCopy={copy} copied={copied} onReport={report} onProfile={goProfile} onPreview={setPreview} profileFor={profile} membershipPlans={membershipPlans}/>)}</div>}{error&&comments.length>0&&<div className="ec-notice" role="alert">{error}</div>}<form className="ec-composer" onSubmit={post}>{replyTo&&<div className="ec-replying"><span>Replying to a reader</span><button type="button" onClick={()=>{setReplyTo(null);setText('')}}>Cancel</button></div>}<div className="ec-compose-row"><Avatar profile={profile(user?.id)} fallback={user?'R':'👤'}/><div className="ec-compose-field"><textarea aria-label="Write a comment" value={text} onChange={e=>setText(e.target.value.slice(0,2000))} placeholder={!user?'Sign in to write a comment':replyTo?'Write your reply…':'Share your thoughts…'} disabled={!user} maxLength={2000} rows="2"/><span className={'character-counter '+(text.length>=1800?'near-limit ':'')+(text.length>=2000?'at-limit':'')}>{text.length}/2000</span></div><button disabled={busy||!user||!text.trim()}>{busy?<><span className="button-spinner" aria-hidden="true"/> Please wait…</>:replyTo?'↩':'➤'}</button></div></form>{preview&&<ProfilePreview profile={preview} membershipPlan={membershipPlans.get(preview?.id)} onClose={()=>setPreview(null)} onOpen={()=>{setPreview(null);goProfile(preview.id)}}/>}</section></div>;
}
function Avatar({profile,fallback}){return profile?.avatar_url?<img className="ec-avatar" src={profile.avatar_url} alt=""/>:<div className="ec-avatar ec-avatar-fallback">{fallback||'R'}</div>}
function CommentCard({comment,replies,profile,user,likes,onLike,onReply,onCopy,copied,onReport,onProfile,onPreview,profileFor,membershipPlans}){const name=profileLabel(profile);const membershipPlan=membershipPlans.get(comment.user_id);const membershipLevel=membershipRank(membershipPlan);const admin=ADMIN_EMAILS.has(String(profile?.email||'').trim().toLowerCase());const priority=membershipLevel>0||admin;const rankLabel=planLabel(membershipPlan);return <article className={'ec-comment '+(priority?'ec-comment--priority':'')}><button className="ec-avatar-button" onClick={()=>onPreview(profile||{id:comment.user_id,username:'reader'})}><Avatar profile={profile} fallback={name.slice(0,1).toUpperCase()}/></button><div className="ec-comment-main"><div className="ec-meta"><div><button className={'ec-username'+(priority?' ec-username--member ec-username--'+membershipPlan:'')+(admin?' ec-username--admin':'')} onClick={()=>onProfile(comment.user_id)}><span className="ec-member-name">@{profile?.username||'reader'}</span><SubscriberBadge planId={membershipPlan} /><span className="ec-comment-flags">{rankLabel&&<span className="ec-priority-badge">{rankLabel}</span>}</span></button></div><time>{ago(comment.created_at)}{comment.updated_at&&new Date(comment.updated_at).getTime()>new Date(comment.created_at).getTime()+1000?' · edited':''}</time></div><p className="ec-content">{comment.content}</p><div className="ec-actions"><button onClick={()=>onLike(comment)} className={likes.liked[comment.id]?'liked':''}>♥ {likes.counts[comment.id]||0}</button><button onClick={()=>onReply(comment.id)}>↩ Reply</button><button onClick={()=>onCopy(comment)}>{copied===comment.id?'✓ Shared':'↗ Share'}</button>{user&&user.id!==comment.user_id&&<button onClick={()=>onReport(comment)}>⚑ Report</button>}</div>{replies.length>0&&<div className="ec-replies">{replies.map(reply=><CommentCard key={reply.id} comment={reply} replies={[]} profile={profileFor(reply.user_id)} user={user} likes={likes} onLike={onLike} onReply={onReply} onCopy={onCopy} copied={copied} onReport={onReport} onProfile={onProfile} onPreview={onPreview} profileFor={profileFor} membershipPlans={membershipPlans}/>)}</div>}</div></article>}
function ProfilePreview({profile,membershipPlan,onClose,onOpen}){return <div className="ec-preview-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="ec-preview"><button className="ec-preview-close" onClick={onClose} aria-label="Close profile preview">×</button><Avatar profile={profile}/><strong>{profile?.username||'reader'}<SubscriberBadge planId={membershipPlan}/></strong><span>@{profile?.username||'reader'}</span>{profile?.bio&&<p>{profile.bio}</p>}<small>Public reader profile</small><button className="ec-preview-open" onClick={onOpen}>View profile</button></section></div>}
