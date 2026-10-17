let sequence = 0;

export function requestAdminConfirm(options = {}) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise(resolve => {
    const event = new CustomEvent('atma-admin-confirm-request', {
      cancelable: true,
      detail: {
        title: options.title || 'Confirm action',
        message: options.message || 'Are you sure you want to continue?',
        consequence: options.consequence || '',
        confirmLabel: options.confirmLabel || 'Confirm',
        tone: options.tone || 'danger',
        resolve,
      },
    });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) resolve(false);
  });
}

export function notifyAdminToast(message, type = 'error') {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent('atma-admin-toast', {
    detail: { id: ++sequence, message: String(message), type },
  }));
}
