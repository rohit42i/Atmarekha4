/* Atma Rekha — shared dialog focus management. */
(function installDialogAccessibility() {
  if (typeof document === 'undefined') return;

  const records = new WeakMap();
  let scanning = false;

  const isOpen = dialog => {
    if (!dialog.isConnected || dialog.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(dialog);
    return style.display !== 'none' && style.visibility !== 'hidden' && dialog.getClientRects().length > 0;
  };

  const focusables = dialog => Array.from(dialog.querySelectorAll(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),audio[controls],video[controls],[contenteditable="true"]'
  )).filter(node => {
    const style = window.getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
  });

  const openDialog = dialog => {
    if (records.has(dialog)) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = event => {
      if (event.key !== 'Tab') return;
      const items = focusables(dialog);
      if (!items.length) {
        event.preventDefault();
        dialog.focus?.();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    records.set(dialog, { previous, onKeyDown });
    dialog.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => {
      if (!dialog.isConnected || !isOpen(dialog)) return;
      const current = document.activeElement;
      if (current && dialog.contains(current)) return;
      const preferred = dialog.querySelector('[autofocus],button[aria-label="Close"],button');
      (preferred instanceof HTMLElement ? preferred : focusables(dialog)[0])?.focus();
    });
  };

  const closeDialog = dialog => {
    const record = records.get(dialog);
    if (!record) return;
    dialog.removeEventListener('keydown', record.onKeyDown);
    records.delete(dialog);
    requestAnimationFrame(() => {
      const target = record.previous;
      const anotherDialogOpen = target?.closest?.('[role="dialog"][aria-modal="true"]');
      if (target?.isConnected && (!anotherDialogOpen || !isOpen(anotherDialogOpen))) target.focus();
    });
  };

  const scan = () => {
    if (scanning) return;
    scanning = true;
    requestAnimationFrame(() => {
      scanning = false;
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'));
      dialogs.forEach(dialog => {
        if (isOpen(dialog)) openDialog(dialog);
        else closeDialog(dialog);
      });
    });
  };

  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
  scan();
})();
