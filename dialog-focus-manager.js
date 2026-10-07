/* Atma Rekha — global dialog focus management. */
(function installDialogFocusManager() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  let activeDialog = null;
  let restoreTarget = null;

  const visible = element => {
    if (!element || element.hidden) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  const dialogs = () => Array.from(
    document.querySelectorAll('[role="dialog"][aria-modal="true"],dialog[aria-modal="true"]')
  ).filter(visible);

  const focusables = dialog => Array.from(dialog.querySelectorAll(SELECTOR)).filter(visible);

  const focusFirst = dialog => {
    const candidates = focusables(dialog);
    const preferred = candidates.find(el =>
      el.matches('button[aria-label*="Close" i],button[type="button"]')
    );
    const target = preferred || candidates[0];
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
    if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    dialog.focus({ preventScroll: true });
  };

  const sync = () => {
    const next = dialogs().at(-1) || null;
    if (next === activeDialog) return;

    if (!activeDialog && next) {
      restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      activeDialog = next;
      requestAnimationFrame(() => focusFirst(next));
      return;
    }

    if (activeDialog && !next) {
      activeDialog = null;
      const target = restoreTarget;
      restoreTarget = null;
      if (target && document.contains(target) && visible(target)) {
        requestAnimationFrame(() => target.focus({ preventScroll: true }));
      }
      return;
    }

    activeDialog = next;
    requestAnimationFrame(() => focusFirst(next));
  };

  document.addEventListener('keydown', event => {
    if (!activeDialog || event.key !== 'Tab') return;
    const items = focusables(activeDialog);
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  const observer = new MutationObserver(sync);
  const start = () => {
    if (!document.body) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'style', 'class', 'aria-hidden']
    });
    sync();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();