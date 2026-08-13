/* Minimal additive reader performance improvements. */
(function () {
  const selector = '.reader-page img';
  const seen = new WeakSet();
  let scanQueued = false;
  let observerStarted = false;

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

    // Only preload the next two pages. Existing preload links are reused.
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
    const images = document.querySelectorAll(selector);
    images.forEach(enhance);
    preloadNearby();
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }

  function start() {
    if (observerStarted) return;
    observerStarted = true;
    queueScan();

    // Observe only DOM additions and batch them into one animation frame instead
    // of rescanning the whole reader synchronously for every React mutation.
    new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.addedNodes.length)) queueScan();
    }).observe(document.body, { childList: true, subtree: true });

    // Passive + throttled: avoids running layout reads on every scroll event.
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
