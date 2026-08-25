/* Lightweight reader performance helpers. The React reader already owns its page lifecycle. */
(function(){
  const selector='.reader-page img';
  const seen=new WeakSet();
  const enhance=img=>{if(!(img instanceof HTMLImageElement)||seen.has(img))return;seen.add(img);img.loading='lazy';img.decoding='async';img.fetchPriority='auto';img.classList.add('reader-performance-image');img.addEventListener('load',()=>img.classList.add('reader-image-loaded'),{once:true})};
  const scan=()=>document.querySelectorAll(selector).forEach(enhance);
  let queued=false;
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan()})};
  const start=()=>{queue();new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
