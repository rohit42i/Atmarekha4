import './chapter-list-7c-restore.css';
import { supabase } from './supabase';
import { getMyRating, submitRating, buildRatingSummary } from './engagement';

let mounted = false;
const chapterIdFromContext = button => {
  const row = button?.closest?.('.chapter-row');
  const href = row?.querySelector?.('.chapter-row-main')?.getAttribute('href');
  if (href?.includes('read-chapter/')) return decodeURIComponent(href.split('read-chapter/')[1]);
  const hash = location.hash || '';
  if (hash.startsWith('#read-chapter/')) return decodeURIComponent(hash.slice('#read-chapter/'.length));
  return null;
};

async function openRating(button) {
  if (mounted) return;
  const chapterId = chapterIdFromContext(button);
  if (!chapterId) return;
  mounted = true;
  const root = document.createElement('div'); root.dataset.arRatingUpgrade = 'true';
  root.innerHTML = `<div class="ar-rating-upgrade-backdrop"><section class="ar-rating-upgrade" role="dialog" aria-modal="true" aria-label="Rate chapter"><button class="ar-rating-upgrade-close" aria-label="Close">×</button><p class="section-eyebrow">YOUR RATING</p><h2>Rate this chapter</h2><div class="ar-rating-summary"><strong>—</strong><span>/10</span><small>Loading ratings…</small></div><div class="ar-rating-scale">${Array.from({length:10},(_,i)=>`<button data-value="${i+1}" type="button">${i+1}</button>`).join('')}</div><p class="ar-rating-status" role="status"></p></section></div>`;
  document.body.appendChild(root);
  const close=()=>{root.remove();mounted=false};
  root.querySelector('.ar-rating-upgrade-close').onclick=close;
  root.querySelector('.ar-rating-upgrade-backdrop').onmousedown=e=>{if(e.target===e.currentTarget)close()};
  try {
    const [rows,my] = await Promise.all([supabase.from('chapter_ratings').select('rating').eq('chapter_id',chapterId),getMyRating(chapterId)]);
    if(rows.error) throw rows.error;
    const summary=buildRatingSummary(rows.data||[]);
    const summaryEl=root.querySelector('.ar-rating-summary'); summaryEl.innerHTML=`<strong>${summary.count?summary.average.toFixed(1):'—'}</strong><span>/10</span><small>${summary.count?`${summary.count} rating${summary.count===1?'':'s'}`:'Be the first to rate'}</small>`;
    root.querySelectorAll('[data-value]').forEach(b=>{const value=Number(b.dataset.value);if(my?.rating>=value)b.classList.add('selected');b.onclick=async()=>{root.querySelectorAll('[data-value]').forEach(x=>x.disabled=true);const status=root.querySelector('.ar-rating-status');try{const saved=await submitRating(chapterId,value);status.textContent=`Saved ${saved.rating}/10. You can change it anytime.`;const nextRows=await supabase.from('chapter_ratings').select('rating').eq('chapter_id',chapterId);if(!nextRows.error){const next=buildRatingSummary(nextRows.data||[]);summaryEl.innerHTML=`<strong>${next.average.toFixed(1)}</strong><span>/10</span><small>${next.count} ratings</small>`}}catch(e){status.textContent=e?.message||'Unable to save your rating.'}finally{root.querySelectorAll('[data-value]').forEach(x=>x.disabled=false)}}});
    if(my)root.querySelector('.ar-rating-status').textContent=`Your rating: ${my.rating}/10 · tap another score to change it.`;
  } catch(e) { close(); throw e; }
}

function intercept(event){
  const button=event.target?.closest?.('button');
  if(!button || !window.__atmaAuthUser)return;
  const label=`${button.getAttribute('aria-label')||''} ${button.getAttribute('title')||''}`.toLowerCase();
  if(label.startsWith('rate chapter')||label==='rate chapter') { event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();openRating(button).catch(()=>{}); }
}
if(typeof document!=='undefined')document.addEventListener('click',intercept,true);
