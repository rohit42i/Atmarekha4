(() => {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let gesture = null;
  let raf = 0;
  let resetTimer = 0;

  const stageFor = target => target?.closest?.('.reader-swipe-stage');

  const paint = () => {
    raf = 0;
    if (!gesture?.stage) return;
    const width = gesture.stage.clientWidth || window.innerWidth || 1;
    const progress = clamp(Math.abs(gesture.x - gesture.startX) / width, 0, 1);
    const direction = gesture.x < gesture.startX ? -1 : 1;
    gesture.stage.style.setProperty('--swipe-p', progress.toFixed(4));
    gesture.stage.style.setProperty('--swipe-dir', String(direction));
    gesture.stage.style.setProperty('--swipe-angle', direction < 0 ? '90deg' : '-90deg');
  };

  const schedulePaint = () => {
    if (!raf) raf = requestAnimationFrame(paint);
  };

  const reset = stage => {
    if (!stage) return;
    stage.classList.remove('reader-swipe-enhanced-active', 'reader-swipe-enhanced-settling', 'reader-swipe-enhanced-cancel');
    stage.style.setProperty('--swipe-p', '0');
    stage.style.setProperty('--swipe-dir', '0');
    stage.style.setProperty('--swipe-angle', '90deg');
  };

  const finish = (cancelled = false) => {
    if (!gesture) return;
    const { stage, x, startX } = gesture;
    gesture = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    clearTimeout(resetTimer);

    const dx = x - startX;
    const width = stage?.clientWidth || window.innerWidth || 1;
    const progress = clamp(Math.abs(dx) / width, 0, 1);
    if (!stage) return;

    if (!cancelled && progress > 0.08) {
      stage.classList.remove('reader-swipe-enhanced-active');
      stage.classList.add('reader-swipe-enhanced-settling');
      stage.style.setProperty('--swipe-p', '1');
      stage.style.setProperty('--swipe-dir', dx < 0 ? '-1' : '1');
      stage.style.setProperty('--swipe-angle', dx < 0 ? '90deg' : '-90deg');
      resetTimer = window.setTimeout(() => reset(stage), 280);
    } else {
      stage.classList.remove('reader-swipe-enhanced-active');
      stage.classList.add('reader-swipe-enhanced-cancel');
      resetTimer = window.setTimeout(() => reset(stage), 220);
    }
  };

  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) return;
    const stage = stageFor(event.target);
    if (!stage) return;
    clearTimeout(resetTimer);
    const x = event.touches[0].clientX;
    gesture = { stage, startX: x, x };
    stage.classList.add('reader-swipe-enhanced-active');
    stage.classList.remove('reader-swipe-enhanced-settling', 'reader-swipe-enhanced-cancel');
    stage.style.setProperty('--swipe-p', '0');
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', event => {
    if (!gesture || event.touches.length !== 1) return;
    if (stageFor(event.target) !== gesture.stage) return;
    gesture.x = event.touches[0].clientX;
    schedulePaint();
  }, { passive: true, capture: true });

  document.addEventListener('touchend', () => finish(false), { passive: true, capture: true });
  document.addEventListener('touchcancel', () => finish(true), { passive: true, capture: true });
})();
