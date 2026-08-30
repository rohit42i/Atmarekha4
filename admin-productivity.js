/* Atma Rekha Admin productivity layer — additive, no backend changes. */
(() => {
  const tabNames = ['Overview','Chapters','Comments','Reports','Announcements','Media'];
  const getTabs = () => Array.from(document.querySelectorAll('.admin-tabs button')).filter(Boolean);
  const getCommand = () => document.querySelector('.ar-command-tab');
  const getRefresh = () => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Refresh');
  const isTyping = el => ['INPUT','TEXTAREA','SELECT'].includes(el?.tagName);
  const flash = text => {
    let node = document.querySelector('.ar-admin-shortcut-toast');
    if (!node) { node=document.createElement('div'); node.className='ar-admin-shortcut-toast'; document.body.appendChild(node); }
    node.textContent=text; node.classList.add('show'); clearTimeout(node._timer); node._timer=setTimeout(()=>node.classList.remove('show'),1100);
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const close=document.querySelector('.ar-command-close');
      if (close) { close.click(); return; }
    }
    if (isTyping(e.target)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); getCommand()?.click(); flash('Command Center'); return;
    }
    if (e.key === '/') {
      const input=document.querySelector('.ar-command-toolbar input');
      if (input) { e.preventDefault(); getCommand()?.click(); setTimeout(()=>input.focus(),40); }
      return;
    }
    if (e.key.toLowerCase() === 'r') { getRefresh()?.click(); flash('Refreshing'); return; }
    const n=Number(e.key);
    if (n >= 1 && n <= tabNames.length) {
      const tabs=getTabs(); const tab=tabs.find(b=>b.textContent.trim().startsWith(tabNames[n-1]));
      if (tab) { tab.click(); flash(tabNames[n-1]); }
    }
  });
})();
