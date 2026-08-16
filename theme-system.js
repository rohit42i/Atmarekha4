/* Atma Rekha — persistent theme controller.
 * Explicit user choice wins. System preference is fallback only.
 * Dependency-free so it can run before React.
 */
(function initThemeController() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const STORAGE_KEY = 'atma-rekha-theme';
  const root = document.documentElement;
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');

  const readPreference = () => {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch { return null; }
  };
  const systemTheme = () => media?.matches ? 'dark' : 'light';
  const apply = (theme, persist = false) => {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.arTheme = next;
    root.style.colorScheme = next;
    if (persist) try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
    window.dispatchEvent(new CustomEvent('atma:themechange', { detail: { theme: next } }));
    return next;
  };

  apply(readPreference() || root.dataset.arTheme || systemTheme());
  const onSystemChange = () => { if (!readPreference()) apply(systemTheme()); };
  if (typeof media?.addEventListener === 'function') media.addEventListener('change', onSystemChange);
  else if (typeof media?.addListener === 'function') media.addListener(onSystemChange);

  window.atmaTheme = {
    get: () => root.dataset.arTheme || systemTheme(),
    set: theme => apply(theme, true),
    toggle: () => apply((root.dataset.arTheme || systemTheme()) === 'dark' ? 'light' : 'dark', true),
    reset: () => { try { window.localStorage.removeItem(STORAGE_KEY); } catch {} return apply(systemTheme()); }
  };
})();
