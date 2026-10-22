import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const relativeTime = value => { const d=Math.max(0,Date.now()-new Date(value).getTime()); const m=Math.floor(d/60000); if(m<1)return 'just now'; if(m<60)return `${m}m`; const h=Math.floor(m/60); if(h<24)return `${h}h`; const days=Math.floor(h/24); if(days<30)return `${days}d`; const mo=Math.floor(days/30); return mo<12?`${mo}mo`:`${Math.floor(mo/12)}y`; };
const REACTION_EMOJIS=['❤️','😂','😍','🔥','😮','😢','😡','👏','🙌','💯','🥹','🤔','😎','🤯','👀','✨','💀','😭','🤣','🥰','🙏','🫶','🎉','❤️‍🔥','🫡'];

async function copyTextToClipboard(value) {
  const text = String(value ?? '');
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (_) {
      // Continue with the legacy selection fallback for browsers that expose
      // Clipboard API but deny it outside a direct user gesture.
    }
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.inset = '0 auto auto 0';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  document.body.appendChild(field);
  try {
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    if (!document.execCommand('copy')) throw new Error('Clipboard copy was rejected.');
  } finally {
    field.remove();
  }
}

export default function Community(){
  const [route,setRoute]=useState(location.hash),[user,setUser]=useState(null),[posts,setPosts]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reactions,setReactions]=useState({}),[reactionBusy,setReactionBusy]=useState(null),[pickerPost,setPickerPost]=useState(null);
  const longPressTimer=useRef(null),longPressTriggered=useRef(false);
  useEffect(()=>{const h=()=>setRoute(location.hash);addEventListener('hashchange',h);supabase.auth.getSession().then(({data})=>setUser(data?.session?.user||null));const{data:l}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));return()=>{removeEventListener('hashchange',h);l.subscription.unsubscribe();clearTimeout(longPressTimer.current)}},[]);
  const load=async currentUser=>{setLoading(true);setError('');const{data:rows,error:pError}=await supabase.from('community_posts').select('id,title,content,image_url,attachment_url,attachment_name,attachment_type,attachment_size,is_pinned,published_at,created_at').not('published_at','is',null).lte('published_at',new Date().toISOString()).order('is_pinned',{ascending:false}).order('published_at',{ascending:false});if(pError)setError(pError.message);else{setPosts(rows||[]);const ids=(rows||[]).map(r=>r.id);if(ids.length){const{data:r,error:re}=await supabase.from('community_post_reactions').select('post_id,user_id,reaction').in('post_id',ids);if(re)setError(re.message);const state={};for(const x of r||[]){const key=x.post_id;state[key]??={count:0,reacted:false,byReaction:{},mine:new Set()};state[key].count++;state[key].byReaction[x.reaction]=(state[key].byReaction[x.reaction]||0)+1;if(currentUser?.id===x.user_id){state[key].mine.add(x.reaction);state[key].reacted=true}}setReactions(state)}}setLoading(false)};
  useEffect(()=>{if(route==='#community')load(user)},[route,user?.id]);
  const react=async(post,reaction='heart')=>{if(!user){setNotice('Sign in to react.');window.dispatchEvent(new CustomEvent('atma-open-auth',{detail:{mode:'login'}}));return}if(reactionBusy)return;setReactionBusy(`${post.id}:${reaction}`);try{const state=reactions[post.id]||{count:0,reacted:false,byReaction:{},mine:new Set()};const current=state.mine?.has(reaction);if(current){const{error:e}=await supabase.from('community_post_reactions').delete().eq('post_id',post.id).eq('user_id',user.id).eq('reaction',reaction);if(e)throw e;setReactions(p=>{const s=p[post.id]||state,b={...(s.byReaction||{})};b[reaction]=Math.max(0,(b[reaction]||1)-1);const mine=new Set(s.mine||[]);mine.delete(reaction);return{...p,[post.id]:{...s,count:Math.max(0,(s.count||1)-1),reacted:mine.size>0,byReaction:b,mine}}})}else{const{error:e}=await supabase.from('community_post_reactions').insert({post_id:post.id,user_id:user.id,reaction});if(e&&e.code!=='23505')throw e;setReactions(p=>{const s=p[post.id]||state,b={...(s.byReaction||{})};b[reaction]=(b[reaction]||0)+1;const mine=new Set(s.mine||[]);mine.add(reaction);return{...p,[post.id]:{...s,count:(s.count||0)+1,reacted:true,byReaction:b,mine}}})}}catch(e){setError(e.message||'Could not save reaction.')}finally{setReactionBusy(null)}};
  const beginLongPress=post=>{longPressTriggered.current=false;clearTimeout(longPressTimer.current);longPressTimer.current=setTimeout(()=>{longPressTriggered.current=true;setPickerPost(post.id)},1000)};
  const endLongPress=()=>clearTimeout(longPressTimer.current);
  const copy=async post=>{try{await copyTextToClipboard(post.content);setError('');setNotice('Message copied.')}catch{setError('Could not copy this message on your device.')}};const share=async post=>{const url=location.origin+location.pathname+'#community';const shareText=(post.title||'Atma Rekha Community')+'\n\n'+post.content+'\n\n'+url;if(navigator.share){try{await navigator.share({title:post.title||'Atma Rekha Community',text:post.content,url});setError('');return}catch(e){if(e?.name==='AbortError')return;}}try{await copyTextToClipboard(shareText);setError('');setNotice('Sharing was unavailable, so the message and link were copied.')}catch{setError('Sharing is unavailable on this device, and copying failed.')}};
  if(route!=='#community')return null;
  return <main className="community-page"><div className="community-shell"><header className="community-header"><button type="button" className="community-back" onClick={()=>location.hash='profile'} aria-label="Back">←</button><div><h1>Community</h1></div></header>{notice&&<div className="community-notice">{notice}</div>}{error&&<div className="community-error">{error}</div>}<section className="community-feed">{loading?<div className="community-empty"><div>⌛</div><h3>Opening community…</h3></div>:!posts.length?<div className="community-empty"><div>🌱</div><h3>No posts yet</h3></div>:posts.map(post=>{const state=reactions[post.id]||{count:0,reacted:false,byReaction:{},mine:new Set()};const visible=REACTION_EMOJIS.filter(e=>state.byReaction[e]).slice(0,8);return <article className={`community-post ${post.is_pinned?'is-pinned':''}`} key={post.id} onPointerDown={()=>beginLongPress(post)} onPointerUp={endLongPress} onPointerCancel={endLongPress} onPointerLeave={endLongPress}>{post.is_pinned&&<div className="community-pinned">📌 Pinned</div>}<div className="community-post-head"><div className="creator-avatar">AR</div><div><strong>Atma Rekha</strong><span>@atmarekha · {relativeTime(post.published_at||post.created_at)}</span></div><b>CREATOR</b></div>{post.title&&<h2>{post.title}</h2>}<p>{post.content}</p>{post.image_url&&<img src={post.image_url} alt="" className="community-post-image" loading="lazy"/>}{post.attachment_url&&<a className="community-attachment" href={post.attachment_url} target="_blank" rel="noreferrer">📎 <span><strong>{post.attachment_name||'Attachment'}</strong><small>{post.attachment_type||'File'}{post.attachment_size?` · ${(post.attachment_size/1024/1024).toFixed(1)} MB`:''}</small></span>↗</a>}{visible.length>0&&<div className="community-reaction-summary">{visible.map(e=><button key={e} type="button" className={state.mine?.has(e)?'active':''} onClick={()=>react(post,e)}>{e} <span>{state.byReaction[e]}</span></button>)}</div>}<div className="community-post-actions"><button type="button" className="community-post-react" aria-label="Open reaction picker" aria-expanded={pickerPost===post.id} aria-controls={`community-reaction-picker-${post.id}`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();setPickerPost(current=>current===post.id?null:post.id)}}>React</button><button type="button" className="community-post-comments" aria-label="Comments for community post" title="Comments" onClick={()=>window.dispatchEvent(new CustomEvent('atma-open-community-comments',{detail:{communityPostId:post.id}}))}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.2 18.3 3.5 21l.8-4A7.5 7.5 0 0 1 4 13.2C4 8.7 7.8 5 12.5 5S21 8.7 21 13.2 17.2 21.4 12.5 21.4c-2.3 0-4.4-.8-6.3-2.2Z"/></svg> Comments</button><button type="button" onClick={()=>share(post)}>↗ Share</button><button type="button" onClick={()=>copy(post)}>🔗 Copy</button></div>{pickerPost===post.id&&<div id={`community-reaction-picker-${post.id}`} className="community-reaction-picker" role="dialog" aria-label="Choose a reaction" onKeyDown={event=>{if(event.key==="Escape")setPickerPost(null)}} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}><div className="community-reaction-picker-head"><strong>React</strong><button type="button" onClick={()=>setPickerPost(null)} aria-label="Close">×</button></div><div className="community-reaction-grid">{REACTION_EMOJIS.map(e=><button key={e} type="button" className={state.mine?.has(e)?'selected':''} onClick={()=>{react(post,e);setPickerPost(null)}}>{e}</button>)}</div></div>}</article>})}</section></div></main>;
}

export function CommunityProfileLink(){return null}
