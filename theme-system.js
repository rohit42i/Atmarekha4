/* Atma Rekha — system theme bridge.
 * CSS remains the source of truth. JS only mirrors the OS preference
 * for legacy components and future manual-toggle work.
 * No theme is persisted and no manual toggle is rendered.
 */
(function initSystemTheme() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const media = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (!media) return;

  const apply = () => {
    const theme = media.matches ? 'dark' : 'light';
    document.documentElement.dataset.arTheme = theme;
    document.documentElement.style.colorScheme = theme;
  };

  apply();

  if (media.addEventListener) {
    media.addEventListener('change', apply);
  } else if (media.addListener) {
    media.addListener(apply);
  }
})();
