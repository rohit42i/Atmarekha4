import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';
import { getRenderedChapterId, legacyChapterIdFromHash } from './routes';

function currentChapterId() { return getRenderedChapterId() || legacyChapterIdFromHash(window.location.hash); }
function currentLocationKey() { return `${window.location.pathname}${window.location.hash}`; }
export default function ReaderBookmark() {
  const [route,setRoute]=useState(currentLocationKey); const [user,setUser]=useState(null); const [chapterId,setChapterId]=useState(currentChapterId); const [saved,setSaved]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  useEffect(()=>{const onLocation=()=>{setRoute(currentLocationKey());setChapterId(currentChapterId());};const onProgress=event=>{if(event?.detail?.chapterId)setChapterId(String(event.detail.chapterId));};window.addEventListener('hashchange',onLocation);window.addEventListener('popstate',onLocation);window.addEventListener('atma-reading-progress',onProgress);return()=>{window.removeEventListener('hashchange',onLocation);window.removeEventListener('popstate',onLocation);window.removeEventListener('atma-reading-progress',onProgress);};},[]);
  useEffect(()=>{let active=true;supabase.auth.getUser().then(({data})=>{if(active)setUser(data?.user||null);});const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));return()=>{active=false;listener.subscription.unsubscribe();};},[]);
  useEffect(()=>{let cancelled=false;setError('');if(!user||!chapterId){setSaved(false);return undefined;}supabase.from('bookmarks').select('id').eq('user_id',user.id).eq('chapter_id',chapterId).maybeSingle().then(({data,error})=>{if(cancelled)return;if(error)setError('Unable to load favourite status.');else setSaved(Boolean(data));});return()=>{cancelled=true;};},[user?.id,chapterId,route]);
  const toggle=async()=>{if(!user||!chapterId||busy)return;setBusy(true);setError('');try{if(saved){const {error}=await supabase.from('bookmarks').delete().eq('user_id',user.id).eq('chapter_id',chapterId);if(error)throw error;setSaved(false);}else{const {error}=await supabase.from('bookmarks').insert({user_id:user.id,chapter_id:chapterId});if(error)throw error;setSaved(true);}}catch(err){console.error('Favourite toggle failed:',err);setError(err?.message||'Unable to update favourite.');}finally{setBusy(false);}};
  const target=document.querySelector('.reader-header-inner'); if(!user||!chapterId||!target)return null;
  return createPortal(<><button type="button" className={`reader-bookmark-button${saved?' is-saved':''}`} onClick={toggle} disabled={busy} aria-label={saved?'Remove from favourites':'Add to favourites'} title={saved?'Remove from favourites':'Add to favourites'}><span>{saved?'♥':'♡'}</span><small>{busy?'Saving…':'Favourite'}</small></button>{error&&<span role="status" className="reader-action-error" aria-live="polite">{error}</span>}</>,target);
}
