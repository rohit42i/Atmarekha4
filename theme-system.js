/* Atma Rekha — system theme bridge.
 * CSS is the source of truth; this JS only mirrors prefers-color-scheme
 * onto data-ar-theme so legacy inline/theme rules can be scoped safely.
 * No theme is persisted and no manual theme is forced.
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
  media.addEventListener?.('change', apply);
})();
