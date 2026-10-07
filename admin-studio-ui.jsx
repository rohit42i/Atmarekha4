import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './admin-redesign-ui.jsx';

export function AdminCard({
  as: Tag = 'section',
  children,
  className = '',
  eyebrow,
  title,
  description,
  actions,
  ...props
}) {
  const hasHeader = eyebrow || title || description || actions;
  return (
    <Tag className={`admin-card ${className}`.trim()} {...props}>
      {hasHeader && (
        <div className="admin-card-title">
          <div>
            {eyebrow ? <span>{eyebrow}</span> : null}
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function AdminButton({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  shortcut,
  loading = false,
  className = '',
  type = 'button',
  disabled,
  ...props
}) {
  const classes = [
    'admin-studio-button',
    `admin-studio-button-${variant}`,
    `admin-studio-button-${size}`,
    loading ? 'is-loading' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="admin-studio-button-loading-icon" aria-hidden="true" />
      ) : icon ? (
        <AdminIcon name={icon} size={size === 'sm' ? 14 : 16} />
      ) : null}
      {children !== undefined && children !== null ? <span>{children}</span> : null}
      {shortcut && !loading ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

export function AdminTable({ children, className = '', density = 'default', ...props }) {
  return (
    <div
      className={`admin-table-wrap admin-table-density-${density} ${className}`.trim()}
      {...props}
    >
      <table className="admin-studio-table">{children}</table>
    </div>
  );
}

export function AdminKPI({
  label,
  value,
  note,
  icon = 'chart',
  trend,
  delta,
  loading = false,
  className = '',
}) {
  const change = trend !== undefined ? trend : delta;

  return (
    <article className={`ar-stat-card ${className}`.trim()}>
      <div className="ar-stat-top">
        <span>{label}</span>
        <span className="ar-stat-icon"><AdminIcon name={icon} size={16} /></span>
      </div>
      {loading ? (
        <div className="ar-skeleton ar-stat-number" aria-hidden="true" />
      ) : (
        <strong>{value}</strong>
      )}
      {change !== undefined && change !== null ? (
        <span className={`ar-delta ${Number(change) >= 0 ? 'positive' : 'negative'}`}>
          {Number(change) >= 0 ? '↑' : '↓'} {Math.abs(Number(change)).toFixed(1)}%
        </span>
      ) : (
        <small>{note || 'All time'}</small>
      )}
      <i className="ar-stat-accent-line" />
    </article>
  );
}

export function AdminEmptyState({ icon = 'pulse', title, description, action }) {
  return (
    <div className="admin-empty-state" role="status">
      <AdminIcon name={icon} size={24} />
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  );
}

export function AdminModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  className = '',
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    const focusTarget = initialFocusRef?.current || panelRef.current;

    requestAnimationFrame(() => focusTarget?.focus?.());

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );

      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  return createPortal(
    <div
      className="admin-studio-modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={panelRef}
        className={`admin-studio-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-studio-modal-title"
        tabIndex={-1}
      >
        <header className="admin-studio-modal-head">
          <div>
            <span>ATMA REKHA · ADMIN</span>
            <h2 id="admin-studio-modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>

          <button
            className="admin-studio-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <AdminIcon name="close" size={17} />
          </button>
        </header>

        <div className="admin-studio-modal-body">{children}</div>
        {footer ? <footer className="admin-studio-modal-foot">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}

export function AdminSidebar({
  groups,
  activeKey,
  mobileOpen,
  onClose,
  onSelect,
  email,
  reportCount = 0,
  connectionState = 'Operational',
  connectionError = false,
}) {
  return (
    <aside
      className={`ar-admin-sidebar${mobileOpen ? ' is-open' : ''}`}
      aria-label="Admin navigation"
    >
      <div className="ar-admin-brand">
        <div className="ar-admin-brand-mark">AR</div>

        <div>
          <strong>Atma Rekha</strong>
          <span>Admin studio</span>
        </div>

        <button
          type="button"
          className="ar-admin-mobile-close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <AdminIcon name="close" size={18} />
        </button>
      </div>

      <div className="ar-admin-workspace">
        <span className="ar-admin-avatar-mini" aria-hidden="true">A</span>
        <div>
          <strong>Publisher</strong>
          <small>{email || 'Protected admin'}</small>
        </div>
      </div>

      <nav className="admin-tabs ar-admin-nav">
        {groups.map(group => (
          <div className="ar-admin-nav-group" key={group.label}>
            <span className="ar-admin-nav-label">{group.label}</span>

            {group.items.map(item => {
              const active = !item.action && activeKey === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  className={active ? 'active' : ''}
                  data-admin-tab={item.key}
                  onClick={() => onSelect(item)}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                >
                  <span className="ar-admin-nav-icon">
                    <AdminIcon name={item.icon} size={18} />
                  </span>

                  <span className="ar-admin-nav-text">{item.label}</span>

                  {item.key === 'Reports' && reportCount > 0 ? (
                    <b>{reportCount}</b>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="ar-admin-status-card">
        <span className={`status-dot ${connectionError ? 'danger' : ''}`} />
        <div>
          <strong>Data connection</strong>
          <small>{connectionState}</small>
        </div>
      </div>
    </aside>
  );
}
