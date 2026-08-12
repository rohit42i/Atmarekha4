/* Minimal additive reader performance improvements. */
(function () {
  const selector = '.reader-page img';
  const seen = new WeakSet();

  function enhance(img) {
    if (seen.has(img)) return;
    seen.add(img);
    img.loading = 'lazy';
    img.decoding = 'async';
    img.fetchPriority = 'auto';
    img.classList.add('reader-performance-image');
    img.addEventListener('load', () => img.classList.add('reader-image-loaded'), { once: true });
  }

  function preloadNearby() {
    const images = Array.from(document.querySelectorAll(selector));
    const index = images.findIndex(img => {
      const r = img.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
    if (index < 0) return;
    images.slice(index, index + 3).forEach(enhance);
    images.slice(index + 1, index + 3).forEach(img => {
      if (!img.currentSrc) return;
      if (document.querySelector(`link[data-reader-preload="${CSS.escape(img.currentSrc)}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = img.currentSrc;
      link.dataset.readerPreload = img.currentSrc;
      document.head.appendChild(link);
    });
  }

  function scan() {
    document.querySelectorAll(selector).forEach(enhance);
    preloadNearby();
  }

  function start() {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', preloadNearby, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
