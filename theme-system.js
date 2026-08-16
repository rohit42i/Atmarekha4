/* Atma Rekha — production theme + responsive UI bridge.
 * System preference is the default. A manual light/dark choice is persisted.
 * The head bootstrap in index.html prevents a first-paint theme flash.
 */
(function initAtmaRekhaTheme() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const STORAGE_KEY = 'atma-rekha-theme';
  const root = document.documentElement;
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const valid = value => value === 'light' || value === 'dark';
  const systemTheme = () => media?.matches ? 'dark' : 'light';
  const getStoredTheme = () => {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return valid(value) ? value : null;
    } catch { return null; }
  };
  const getTheme = () => getStoredTheme() || systemTheme();
  const applyTheme = theme => {
    const next = valid(theme) ? theme : systemTheme();
    root.dataset.arTheme = next;
    root.style.colorScheme = next;
    window.__AR_THEME__ = next;
    document.dispatchEvent(new CustomEvent('atma-rekha-theme-change', { detail: { theme: next } }));
    return next;
  };
  const setTheme = theme => {
    if (!valid(theme)) return applyTheme();
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch {}
    return applyTheme(theme);
  };
  const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');

  window.AtmaRekhaTheme = { getTheme, setTheme, toggleTheme, systemTheme };
  applyTheme(getTheme());

  const onSystemChange = () => {
    if (!getStoredTheme()) applyTheme(systemTheme());
  };
  if (typeof media?.addEventListener === 'function') media.addEventListener('change', onSystemChange);
  else if (typeof media?.addListener === 'function') media.addListener(onSystemChange);

  const mountThemeToggle = () => {
    const header = document.querySelector('.home-header');
    if (!header || header.querySelector('[data-theme-toggle]')) return;
    const actions = header.querySelector('.home-header-actions') || header.lastElementChild;
    if (!actions) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.dataset.themeToggle = 'true';
    button.addEventListener('click', toggleTheme);
    const update = () => {
      const theme = getTheme();
      button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      button.setAttribute('title', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.innerHTML = theme === 'dark' ? '<span aria-hidden="true">☀</span><span class="theme-toggle-label">Light</span>' : '<span aria-hidden="true">☾</span><span class="theme-toggle-label">Dark</span>';
    };
    document.addEventListener('atma-rekha-theme-change', update);
    update();
    actions.insertBefore(button, actions.firstChild);
  };

  const mountMobileNav = () => {
    const header = document.querySelector('.home-header');
    if (!header || header.querySelector('[data-mobile-nav-toggle]')) return;
    const actions = header.querySelector('.home-header-actions') || header.lastElementChild;
    if (!actions) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-nav-toggle';
    toggle.dataset.mobileNavToggle = 'true';
    toggle.setAttribute('aria-label', 'Open navigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span></span><span></span><span></span>';

    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', 'Primary navigation');
    nav.innerHTML = [
      ['#chapters', 'Chapters'],
      ['#info/about', 'About'],
      ['#info/contact', 'Contact'],
      ['#admin', 'Admin']
    ].map(([href, label]) => `<a href="${href}">${label}</a>`).join('');

    const close = () => {
      header.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
    };
    toggle.addEventListener('click', () => {
      const open = !header.classList.contains('nav-open');
      header.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    });
    nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    header.appendChild(nav);
    actions.appendChild(toggle);
  };

  const mount = () => { mountThemeToggle(); mountMobileNav(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
})();
