import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const AdminUIContext = createContext(null);

export function AdminUIProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'info', duration = 4200) => {
    const id = ++idRef.current;
    setToasts(items => [...items, { id, message, type }]);
    if (duration > 0) window.setTimeout(() => {
      setToasts(items => items.filter(item => item.id !== id));
    }, duration);
    return id;
  }, []);

  const dismissToast = useCallback(id => {
    setToasts(items => items.filter(item => item.id !== id));
  }, []);

  const requestConfirm = useCallback((options = {}) => new Promise(resolve => {
    setConfirmState({
      title: options.title || 'Confirm action',
      message: options.message || 'Are you sure you want to continue?',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      danger: Boolean(options.danger),
      resolve,
    });
  }), []);

  const closeConfirm = useCallback(result => {
    setConfirmState(current => {
      current?.resolve?.(result);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ requestConfirm, toast, dismissToast }), [requestConfirm, toast, dismissToast]);

  return (
    <AdminUIContext.Provider value={value}>
      {children}
      <div className="ar-admin ar-admin-global-ui">
      {confirmState && (
        <div className="ar-admin-modal-layer" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closeConfirm(false);
        }}>
          <section className="ar-admin-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="ar-admin-confirm-title" aria-describedby="ar-admin-confirm-message">
            <div className="ar-admin-modal-icon" data-danger={confirmState.danger ? 'true' : 'false'} aria-hidden="true">
              {confirmState.danger ? '!' : '?'}
            </div>
            <div className="ar-admin-modal-copy">
              <h2 id="ar-admin-confirm-title">{confirmState.title}</h2>
              <p id="ar-admin-confirm-message">{confirmState.message}</p>
            </div>
            <div className="ar-admin-modal-actions">
              <button type="button" className="ar-admin-button secondary" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button type="button" autoFocus className={'ar-admin-button ' + (confirmState.danger ? 'danger' : 'primary')} onClick={() => closeConfirm(true)}>
                {confirmState.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="ar-admin-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map(item => (
          <div key={item.id} className={'ar-admin-toast ' + item.type} role="status">
            <span className="ar-admin-toast-marker" aria-hidden="true" />
            <span>{item.message}</span>
            <button type="button" onClick={() => dismissToast(item.id)} aria-label="Dismiss notification">×</button>
          </div>
        ))}
      </div>
      </div>
    </AdminUIContext.Provider>
  );
}

export function useAdminUI() {
  const value = useContext(AdminUIContext);
  if (!value) throw new Error('useAdminUI must be used inside AdminUIProvider');
  return value;
}
