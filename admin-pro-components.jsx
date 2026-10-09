/**
 * Admin Pro Studio — reusable, accessible examples.
 * These are optional building blocks; existing admin feature components remain authoritative.
 */
import React from 'react';

export function StatCard({ icon, label, value, note, onClick }) {
  const Tag = onClick ? 'button' : 'article';
  return <Tag type={onClick ? 'button' : undefined} className="ar-admin-stat-card" onClick={onClick}>
    {icon ? <span className="ar-admin-stat-card-icon" aria-hidden="true">{icon}</span> : null}
    <strong className="ar-admin-stat-card-value">{value}</strong>
    <span className="ar-admin-stat-card-label">{label}</span>
    {note ? <small>{note}</small> : null}
  </Tag>;
}

export function AdminFormField({ id, label, type = 'text', value, onChange, error, hint, required = false, disabled = false, rows }) {
  const isTextarea = type === 'textarea';
  const Element = isTextarea ? 'textarea' : 'input';
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return <div className="ar-admin-form-group">
    {label ? <label className={`ar-admin-form-label${required ? ' required' : ''}`} htmlFor={id}>{label}</label> : null}
    <Element id={id} type={isTextarea ? undefined : type}
      className={`ar-admin-form-${isTextarea ? 'textarea' : 'input'}${error ? ' error' : ''}`}
      value={value} onChange={onChange} required={required} disabled={disabled} rows={rows}
      aria-invalid={Boolean(error)} aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined} />
    {error ? <span id={errorId} className="ar-admin-form-error">{error}</span> : null}
    {hint && !error ? <span id={hintId} className="ar-admin-form-hint">{hint}</span> : null}
  </div>;
}

export function Alert({ type = 'info', title, message, onClose }) {
  const icons = { success: '✓', error: '×', warning: '!', info: 'i' };
  return <div className={`ar-admin-alert ${type}`} role={type === 'error' ? 'alert' : 'status'}>
    <span className="ar-admin-alert-icon" aria-hidden="true">{icons[type] || icons.info}</span>
    <div className="ar-admin-alert-content">
      {title ? <strong className="ar-admin-alert-title">{title}</strong> : null}
      {message ? <p className="ar-admin-alert-description">{message}</p> : null}
    </div>
    {onClose ? <button type="button" className="ar-admin-modal-close" onClick={onClose} aria-label="Dismiss message">×</button> : null}
  </div>;
}
