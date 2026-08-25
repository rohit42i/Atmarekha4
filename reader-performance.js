/* Reader performance + touch motion enhancement. */
(function () {
  const selector = '.reader-page img';
  const seen = new WeakSet();
  let scanQueued = false;
  let observerStarted = false;
  let gesture = null;
  let raf = 0;
  let settleTimer = 0;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function enhance(img) {
    if (!(img instanceof HTMLImageElement) || seen.has(img)) return;
    seen.add(img);
    img.loading = 'lazy';
    img.decoding = 'async';
    img.fetchPriority = 'auto';
    img.classList.add('reader-performance-image');
    img.addEventListener('load', () => img.classList.add('reader-image-loaded'), { once: true });
  }

  function preloadNearby() {
    const images = Array.from(document.querySelectorAll(selector));
    if (!images.length) return;
    const index = images.findIndex(img => {
      const r = img.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
    if (index < 0) return;
    images.slice(index, index + 3).forEach(enhance);
    images.slice(index + 1, index + 3).forEach(img => {
      const src = img.currentSrc || img.src;
      if (!src || document.querySelector(`link[data-reader-preload="${CSS.escape(src)}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      link.dataset.readerPreload = src;
      document.head.appendChild(link);
    });
  }

  function scan() {
    scanQueued = false;
    document.querySelectorAll(selector).forEach(enhance);
    preloadNearby();
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }

  function getReader(target) {
    return target?.closest?.('.reader-page');
  }

  function getImage(reader) {
    if (!reader) return null;
    const images = [...reader.querySelectorAll('img.reader-performance-image, img')];
    return images.find(img => {
      const r = img.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    }) || images[0] || null;
  }

  function paint() {
    raf = 0;
    if (!gesture) return;
    const { reader, image, startX, x } = gesture;
    const width = reader.clientWidth || window.innerWidth || 1;
    const dx = x - startX;
    const p = clamp(Math.abs(dx) / width, 0, 1);
    const dir = dx < 0 ? -1 : 1;
    reader.style.setProperty('--reader-swipe-p', p.toFixed(4));
    reader.style.setProperty('--reader-swipe-dir', String(dir));
    if (image) {
      image.classList.add('reader-swipe-active');
      image.style.setProperty('--reader-swipe-x', `${dx * 0.12}px`);
      image.style.setProperty('--reader-swipe-rotate', `${dir * p * 1.6}deg`);
      image.style.setProperty('--reader-swipe-scale', `${1 - p * 0.012}`);
    }
  }

  function finish(cancelled) {
    if (!gesture) return;
    const { reader, image, startX, x } = gesture;
    gesture = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    clearTimeout(settleTimer);
    const dx = x - startX;
    const width = reader?.clientWidth || window.innerWidth || 1;
    const p = clamp(Math.abs(dx) / width, 0, 1);
    if (!reader) return;

    reader.classList.remove('reader-swipe-active', 'reader-swipe-commit', 'reader-swipe-cancel');
    if (p >= 0.08 && !cancelled) {
      reader.classList.add('reader-swipe-commit');
      reader.style.setProperty('--reader-swipe-p', '1');
      reader.style.setProperty('--reader-swipe-dir', dx < 0 ? '-1' : '1');
    } else {
      reader.classList.add('reader-swipe-cancel');
      reader.style.setProperty('--reader-swipe-p', '0');
    }
    if (image) {
      image.classList.remove('reader-swipe-active');
      image.classList.add(p >= 0.08 && !cancelled ? 'reader-swipe-settle' : 'reader-swipe-return');
      image.style.setProperty('--reader-swipe-x', p >= 0.08 && !cancelled ? `${(dx < 0 ? -1 : 1) * width * 0.045}px` : '0px');
      image.style.setProperty('--reader-swipe-rotate', p >= 0.08 && !cancelled ? `${(dx < 0 ? -1 : 1) * 2.2}deg` : '0deg');
      image.style.setProperty('--reader-swipe-scale', p >= 0.08 && !cancelled ? '.985' : '1');
    }
    settleTimer = window.setTimeout(() => {
      reader.classList.remove('reader-swipe-commit', 'reader-swipe-cancel');
      if (image) {
        image.classList.remove('reader-swipe-settle', 'reader-swipe-return');
        image.style.removeProperty('--reader-swipe-x');
        image.style.removeProperty('--reader-swipe-rotate');
        image.style.removeProperty('--reader-swipe-scale');
      }
      reader.style.removeProperty('--reader-swipe-p');
      reader.style.removeProperty('--reader-swipe-dir');
    }, 280);
  }

  function startGesture(event) {
    if (event.touches.length !== 1) return;
    const reader = getReader(event.target);
    if (!reader) return;
    const image = getImage(reader);
    const x = event.touches[0].clientX;
    clearTimeout(settleTimer);
    gesture = { reader, image, startX: x, x };
    reader.classList.add('reader-swipe-active');
  }

  function moveGesture(event) {
    if (!gesture || event.touches.length !== 1) return;
    if (getReader(event.target) !== gesture.reader) return;
    gesture.x = event.touches[0].clientX;
    if (!raf) raf = requestAnimationFrame(paint);
  }

  function start() {
    if (observerStarted) return;
    observerStarted = true;
    queueScan();
    new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.addedNodes.length)) queueScan();
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('touchstart', startGesture, { passive: true, capture: true });
    document.addEventListener('touchmove', moveGesture, { passive: true, capture: true });
    document.addEventListener('touchend', () => finish(false), { passive: true, capture: true });
    document.addEventListener('touchcancel', () => finish(true), { passive: true, capture: true });

    let scrollQueued = false;
    window.addEventListener('scroll', () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        preloadNearby();
      });
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
