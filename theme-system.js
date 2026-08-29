/* Atma Rekha — theme controller. */
(function initThemeController() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const STORAGE_KEY = 'ar-theme';
  const DEFAULT_THEME = 'light';
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  const root = document.documentElement;

  const readSavedTheme = () => {
    try {
      const value = window.localStorage?.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  };

  const saveTheme = (theme) => {
    try {
      if (theme === 'light' || theme === 'dark') {
        window.localStorage?.setItem(STORAGE_KEY, theme);
      } else {
        window.localStorage?.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage can be unavailable in privacy-restricted environments.
    }
  };

  const getSystemTheme = () => (media?.matches ? 'dark' : 'light');

  // Light is the website default. The device's dark-mode preference no longer overrides it.
  const get = () => readSavedTheme() || DEFAULT_THEME;

  const dispatchChange = (theme) => {
    window.dispatchEvent(new CustomEvent('ar-theme-change', {
      detail: { theme }
    }));
  };

  const apply = (notify = false) => {
    const savedTheme = readSavedTheme();
    const effectiveTheme = savedTheme || DEFAULT_THEME;

    root.setAttribute('data-theme', effectiveTheme);
    root.style.colorScheme = effectiveTheme;

    if (notify) dispatchChange(effectiveTheme);
    return effectiveTheme;
  };

  const set = (theme) => {
    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') return get();
    saveTheme(theme === 'system' ? DEFAULT_THEME : theme);
    return apply(true);
  };

  const toggle = () => set(get() === 'dark' ? 'light' : 'dark');

  window.ArTheme = Object.freeze({ get, set, toggle });

  apply(false);
})();
