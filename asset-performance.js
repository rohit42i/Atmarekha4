/* Global image performance guard: safe defaults for content images. */
(function () {
  const seen = new WeakSet();

  function enhance(image) {
    if (!(image instanceof HTMLImageElement) || seen.has(image)) return;
    seen.add(image);

    if (!image.hasAttribute('width') && image.naturalWidth) image.width = image.naturalWidth;
    if (!image.hasAttribute('height') && image.naturalHeight) image.height = image.naturalHeight;
    if (!image.hasAttribute('decoding')) image.decoding = 'async';

    const inViewport = image.getBoundingClientRect().top < window.innerHeight * 1.5;
    if (!inViewport && !image.hasAttribute('loading')) image.loading = 'lazy';
  }

  function scan() {
    document.querySelectorAll('img').forEach(enhance);
  }

  function start() {
    scan();
    const observer = new MutationObserver(() => requestAnimationFrame(scan));
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
