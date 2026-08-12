const style = document.createElement('style');
style.textContent = `
.reader-enhance-fullscreen{position:absolute;top:14px;right:14px;z-index:5;width:42px;height:42px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(0,0,0,.62);color:#fff;backdrop-filter:blur(10px);cursor:pointer;transition:opacity .2s,transform .2s,background .2s}.reader-enhance-fullscreen:hover{background:rgba(255,255,255,.14);transform:translateY(-1px)}
.reader-stage.reader-chrome-hidden .reader-side-button,.reader-stage.reader-chrome-hidden .reader-enhance-fullscreen{opacity:0;pointer-events:none}
.reader-stage.reader-focus-mode{position:fixed!important;inset:0!important;z-index:9999!important;width:100vw!important;height:100vh!important;max-width:none!important;border:0!important;border-radius:0!important;background:#000!important}.reader-stage.reader-focus-mode img{max-width:100vw!important;max-height:100vh!important}.reader-stage.reader-focus-mode .reader-enhance-fullscreen{opacity:1!important;pointer-events:auto!important}
.reader-stage.reader-focus-mode + .reader-info-row,.reader-stage.reader-focus-mode ~ .reader-controls,.reader-stage.reader-focus-mode ~ .reader-chapter-nav{visibility:hidden}
`;
document.head.appendChild(style);

const enterFocus = stage => {
  if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {});
  stage.classList.add('reader-focus-mode');
};
const exitFocus = stage => {
  stage.classList.remove('reader-focus-mode');
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
};

function enhanceStage(stage){
  if (!stage || stage.dataset.enhanced === '1') return;
  stage.dataset.enhanced = '1';
  const button = document.createElement('button');
  button.type='button'; button.className='reader-enhance-fullscreen'; button.setAttribute('aria-label','Enter fullscreen reader'); button.title='Fullscreen reader'; button.textContent='⛶';
  button.addEventListener('click', event => { event.stopPropagation(); stage.classList.contains('reader-focus-mode') ? exitFocus(stage) : enterFocus(stage); });
  stage.appendChild(button);

  let timer;
  const showChrome = () => {
    stage.classList.remove('reader-chrome-hidden');
    clearTimeout(timer);
    timer = setTimeout(() => stage.classList.add('reader-chrome-hidden'), 2200);
  };
  stage.addEventListener('pointermove', showChrome, { passive:true });
  stage.addEventListener('pointerdown', showChrome, { passive:true });
  stage.addEventListener('dblclick', event => {
    if (event.target.closest('button')) return;
    stage.classList.contains('reader-focus-mode') ? exitFocus(stage) : enterFocus(stage);
  });
  showChrome();
}

const scan = () => document.querySelectorAll('.reader-stage').forEach(enhanceStage);
new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
scan();
document.addEventListener('fullscreenchange',()=>{ document.querySelectorAll('.reader-stage').forEach(stage=>{ if (!document.fullscreenElement) stage.classList.remove('reader-focus-mode'); }); });
