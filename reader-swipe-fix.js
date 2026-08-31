(()=>{
  const css=`
    .reader-page{touch-action:pan-y;overscroll-behavior-x:contain}
    .reader-page img.ar-swipe-active,.ar-fullscreen-swipe-active{will-change:transform;transition:none!important;transform:translate3d(var(--ar-x),0,0) rotate(var(--ar-r)) scale(var(--ar-s))!important}
    .reader-page img.ar-swipe-settle,.ar-fullscreen-swipe-settle{transition:transform 180ms cubic-bezier(.22,.8,.2,1)!important}
    .reader-page img.ar-swipe-return,.ar-fullscreen-swipe-return{transition:transform 160ms cubic-bezier(.2,.9,.25,1)!important;transform:translate3d(0,0,0) rotate(0) scale(1)!important}
    @media(prefers-reduced-motion:reduce){.reader-page img.ar-swipe-active,.reader-page img.ar-swipe-settle,.reader-page img.ar-swipe-return,.ar-fullscreen-swipe-active,.ar-fullscreen-swipe-settle,.ar-fullscreen-swipe-return{transition:none!important}}
  `;
  const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);
  let g=null,raf=0,timer=0;
  const point=e=>e.touches?.[0]||e;
  const resolve=e=>{
    const target=e?.target,fs=document.fullscreenElement;
    let i=target?.tagName==='IMG'?target:target?.closest?.('.reader-page img,[data-reader-page] img,.reader-page picture img');
    if(!i&&fs?.tagName==='IMG')i=fs;
    if(!i&&fs)i=fs.querySelector?.('.reader-page img,[data-reader-page] img,picture img');
    if(!i)return null;
    const r=i.closest?.('.reader-page,[data-reader-page]')||i.parentElement||document.fullscreenElement;
    return{r,i,fullscreen:!!(fs&&i===fs)};
  };
  const start=e=>{
    if(e.pointerType==='mouse'&&e.buttons!==1)return;
    if(e.touches&&e.touches.length!==1)return;
    const v=resolve(e);if(!v)return;
    const x=point(e).clientX;
    g={...v,sx:x,x};
    v.i.classList.remove('ar-swipe-return','ar-swipe-settle');
    v.i.classList.add(v.fullscreen?'ar-fullscreen-swipe-active':'ar-swipe-active');
    try{e.currentTarget?.setPointerCapture?.(e.pointerId)}catch{}
  };
  const move=e=>{
    if(!g|| (e.touches&&e.touches.length!==1))return;
    g.x=point(e).clientX;
    if(raf)return;
    raf=requestAnimationFrame(()=>{
      raf=0;if(!g)return;
      const{r,i,sx,x}=g,w=Math.max(r?.clientWidth||innerWidth,1),d=x-sx,q=Math.min(Math.abs(d)/w,1);
      i.style.setProperty('--ar-x',d*.45+'px');
      i.style.setProperty('--ar-r',(d<0?-1:1)*q*1.8+'deg');
      i.style.setProperty('--ar-s',String(1-q*.01));
    });
  };
  const end=()=>{
    if(!g)return;
    const{r,i,sx,x,fullscreen}=g,w=Math.max(r?.clientWidth||innerWidth,1),d=x-sx,q=Math.min(Math.abs(d)/w,1),n=d<0?-1:1;
    g=null;
    const active=fullscreen?'ar-fullscreen-swipe-active':'ar-swipe-active',settle=fullscreen?'ar-fullscreen-swipe-settle':'ar-swipe-settle',ret=fullscreen?'ar-fullscreen-swipe-return':'ar-swipe-return';
    i.classList.remove(active);
    const commit=q>.045;
    i.classList.add(commit?settle:ret);
    i.style.setProperty('--ar-x',commit?n*w*.05+'px':'0px');
    i.style.setProperty('--ar-r',commit?n*1.5+'deg':'0deg');
    i.style.setProperty('--ar-s',commit?'.99':'1');
    clearTimeout(timer);
    timer=setTimeout(()=>{i.classList.remove(settle,ret);['--ar-x','--ar-r','--ar-s'].forEach(k=>i.style.removeProperty(k))},220);
  };
  document.addEventListener('pointerdown',start,{passive:true,capture:true});
  document.addEventListener('pointermove',move,{passive:true,capture:true});
  document.addEventListener('pointerup',end,{passive:true,capture:true});
  document.addEventListener('pointercancel',end,{passive:true,capture:true});
  document.addEventListener('touchstart',start,{passive:true,capture:true});
  document.addEventListener('touchmove',move,{passive:true,capture:true});
  document.addEventListener('touchend',end,{passive:true,capture:true});
  document.addEventListener('touchcancel',end,{passive:true,capture:true});
  document.addEventListener('fullscreenchange',()=>{if(!g)return;const v=resolve({target:document.fullscreenElement});if(!v||v.i!==g.i)end()});
})();