/* Atma Rekha Admin productivity layer — safe navigation shortcuts. */
(() => {
  const ADMIN_TABS = ['Overview','Chapters','Pages','Comments','Reports','Announcements'];
  const isAdmin = () => Boolean(document.querySelector('main.admin-page.ar-admin-v3'));
  const dispatch = (name, detail) => window.dispatchEvent(new CustomEvent(name, detail ? { detail } : undefined));
  const flash = message => {
    let node = document.querySelector('.ar-admin-shortcut-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'ar-admin-shortcut-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 1100);
  };
  const isTyping = el => ['INPUT','TEXTAREA','SELECT'].includes(el?.tagName);
  const openCommandSearch = () => {
    dispatch('atma-admin-open-command');
    window.setTimeout(() => document.querySelector('.admin-command-palette input,.ar-command-panel input')?.focus(), 40);
  };
  document.addEventListener('keydown', event => {
    if (!isAdmin()) return;
    if (event.key === 'Escape') {
      const close = document.querySelector(
        '.ar-command-close,.ar-pro-close,.ar-ops-close,.ar-health-close,.ar-gcm-close,.ar-mgmt-close,.ar-mod-close,.community-admin-head button'
      );
      if (close) { close.click(); return; }
    }
    if (isTyping(event.target)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dispatch('atma-admin-open-command');
      flash('Command Center');
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      openCommandSearch();
      return;
    }
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      document.querySelector('main.admin-page.ar-admin-v3 .ar-admin-refresh')?.click();
      flash('Refreshing');
      return;
    }
    const index = Number(event.key) - 1;
    if (index >= 0 && index < ADMIN_TABS.length) {
      event.preventDefault();
      dispatch('atma-admin-select-tab', { tab: ADMIN_TABS[index] });
      flash(ADMIN_TABS[index]);
    }
  });
})();