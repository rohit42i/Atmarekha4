/* Atma Rekha — system theme bridge.
 * CSS is the source of truth. JS only mirrors prefers-color-scheme
 * for legacy components and future manual-toggle work.
 * No theme is persisted and no manual toggle is rendered.
 */
(function initSystemTheme() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!media) return;

  const apply = () => {
    const theme = media.matches ? 'dark' : 'light';
    document.documentElement.dataset.arTheme = theme;
    document.documentElement.style.colorScheme = theme;
  };

  apply();

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', apply);
  } else if (typeof media.addListener === 'function') {
    media.addListener(apply);
  }
})();
