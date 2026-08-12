// Lightweight reader gesture layer. It delegates to the existing reader controls,
// so page navigation stays in one place and swipe never changes zoom or layout.
let startX = 0;
let startY = 0;
let tracking = false;
const MIN_DISTANCE = 55;

function readerStage() {
  return document.querySelector('.reader-page .reader-stage');
}
function go(direction) {
  const stage = readerStage();
  if (!stage) return;
  const selector = direction === 'next' ? '.reader-control.primary:not(:disabled)' : '.reader-control.secondary:not(:disabled)';
  stage.closest('.reader-content')?.querySelector(selector)?.click();
}

document.addEventListener('touchstart', event => {
  const stage = readerStage();
  if (!stage || !stage.contains(event.target) || event.touches.length !== 1) return;
  startX = event.touches[0].clientX;
  startY = event.touches[0].clientY;
  tracking = true;
}, { passive: true });

document.addEventListener('touchend', event => {
  if (!tracking || event.changedTouches.length !== 1) return;
  tracking = false;
  const endX = event.changedTouches[0].clientX;
  const endY = event.changedTouches[0].clientY;
  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) <= Math.abs(dy)) return;
  if (dx < 0) go('next');
  else go('previous');
}, { passive: true });
