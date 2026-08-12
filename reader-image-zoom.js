const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;
const imageState = new WeakMap();

function clamp(value) { return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value)); }

function setupImage(img) {
  if (imageState.has(img)) return;
  const state = { scale: 1, startDistance: 0, startScale: 1, lastTap: 0 };
  imageState.set(img, state);
  img.classList.add('reader-image-zoom-target');
  img.draggable = false;
  const render = () => {
    img.style.setProperty('--reader-image-scale', state.scale);
    img.classList.toggle('is-zoomed', state.scale > 1);
  };
  const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  img.addEventListener('wheel', event => {
    event.preventDefault();
    state.scale = clamp(state.scale + (event.deltaY < 0 ? .25 : -.25));
    render();
  }, { passive: false });
  img.addEventListener('touchstart', event => {
    if (event.touches.length === 2) {
      state.startDistance = distance(event.touches);
      state.startScale = state.scale;
      return;
    }
    if (event.touches.length !== 1) return;
    const now = Date.now();
    if (now - state.lastTap < 320) {
      state.scale = state.scale > 1 ? 1 : DOUBLE_TAP_SCALE;
      render();
      event.preventDefault();
    }
    state.lastTap = now;
  }, { passive: false });
  img.addEventListener('touchmove', event => {
    if (event.touches.length !== 2 || !state.startDistance) return;
    event.preventDefault();
    state.scale = clamp(state.startScale * (distance(event.touches) / state.startDistance));
    render();
  }, { passive: false });
  img.addEventListener('touchend', () => { state.startDistance = 0; });
  img.addEventListener('dblclick', event => {
    event.preventDefault();
    state.scale = state.scale > 1 ? 1 : DOUBLE_TAP_SCALE;
    render();
  });
  render();
}

function scanReaderImages() {
  document.querySelectorAll('.reader-page img').forEach(setupImage);
}

function installReaderImageZoom() {
  scanReaderImages();
  new MutationObserver(scanReaderImages).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installReaderImageZoom, { once: true });
else installReaderImageZoom();
