(() => {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  let gesture = null;
  let raf = 0;
  let resetTimer = 0;

  const stageFor = target => target?.closest?.('.reader-swipe-stage');

  const setVisualState = (stage, progress, direction) => {
    const p = clamp(progress, 0, 1);
    stage.style.setProperty('--swipe-p', p.toFixed(4));
    stage.style.setProperty('--swipe-dir', String(direction));
    stage.style.setProperty('--swipe-angle', direction < 0 ? '90deg' : '-90deg');
    stage.style.setProperty('--swipe-rotate', `${(direction * p * 3.2).toFixed(3)}deg`);
    stage.style.setProperty('--swipe-scale', (1 - p * 0.018).toFixed(4));
    stage.style.setProperty('--swipe-overlay', (p * 0.9).toFixed(3));
    stage.style.setProperty('--swipe-edge', (p * 0.72).toFixed(3));
  };

  const paint = () => {
    raf = 0;
    if (!gesture?.stage) return;
    const width = gesture.stage.clientWidth || window.innerWidth || 1;
    const dx = gesture.x - gesture.startX;
    setVisualState(gesture.stage, Math.abs(dx) / width, dx < 0 ? -1 : 1);
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
    stage.style.setProperty('--swipe-rotate', '0deg');
    stage.style.setProperty('--swipe-scale', '1');
    stage.style.setProperty('--swipe-overlay', '0');
    stage.style.setProperty('--swipe-edge', '0');
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
      const direction = dx < 0 ? -1 : 1;
      stage.classList.remove('reader-swipe-enhanced-active');
      stage.classList.add('reader-swipe-enhanced-settling');
      setVisualState(stage, 1, direction);
      resetTimer = window.setTimeout(() => reset(stage), 280);
    } else {
      stage.classList.remove('reader-swipe-enhanced-active');
      stage.classList.add('reader-swipe-enhanced-cancel');
      stage.style.setProperty('--swipe-rotate', '0deg');
      stage.style.setProperty('--swipe-scale', '1');
      stage.style.setProperty('--swipe-overlay', '0');
      stage.style.setProperty('--swipe-edge', '0');
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
    setVisualState(stage, 0, 0);
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
