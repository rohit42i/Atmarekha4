import React from 'react';

export function AdminIcon({ name, size = 18, strokeWidth = 1.8, className = '' }) {
  const paths = {
    grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    book:<><path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12H7a2 2 0 0 1-2-2z"/><path d="M7 4.5v14.5M9 8h7M9 11h7"/></>,
    layers:<><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></>,
    message:<><path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M7 10h10M7 13.5h6"/></>,
    flag:<><path d="M6 21V4"/><path d="M6 5c4-3 8 3 13 0v9c-5 3-9-3-13 0"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    image:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4.5 17 5-5 3 3 2-2 5 4"/></>,
    search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    refresh:<><path d="M20 11a8 8 0 0 0-14.7-4L3 10"/><path d="M3 5v5h5"/><path d="M4 13a8 8 0 0 0 14.7 4L21 14"/><path d="M21 19v-5h-5"/></>,
    logout:<><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="m14 16 5-4-5-4"/><path d="M19 12H8"/></>,
    menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close:<><path d="m6 6 12 12M18 6 6 18"/></>,
    chevron:<path d="m9 18 6-6-6-6"/>,
    user:<><circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/></>,
    settings:<><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41"/><circle cx="12" cy="12" r="3.5"/></>,
    pulse:<><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
    sparkle:<><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/></>,
    chart:<><path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 4-6"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    bookmark:<path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"/>,
  };

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}

export function GlassCard({ children, className = '', interactive = false, ...props }) {
  return (
    <section
      className={`ar-glass-card${interactive ? ' ar-glass-interactive' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </section>
  );
}

export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="ar-section-header">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  note,
  icon,
  accent = 'gold',
  loading = false,
}) {
  const safeAccent = ['gold', 'blue', 'pink', 'violet'].includes(accent) ? accent : 'gold';

  return (
    <article className={`ar-stat-card accent-${safeAccent}`}>
      <div className="ar-stat-top">
        <span>{label}</span>
        <span className="ar-stat-icon">
          <AdminIcon name={icon || 'chart'} size={16} />
        </span>
      </div>

      {loading ? (
        <div className="ar-skeleton ar-stat-number" aria-hidden="true" />
      ) : (
        <strong>{value}</strong>
      )}

      {delta !== undefined && delta !== null ? (
        <span className={`ar-delta ${Number(delta) >= 0 ? 'positive' : 'negative'}`}>
          {Number(delta) >= 0 ? '↑' : '↓'} {Math.abs(Number(delta)).toFixed(1)}%
        </span>
      ) : (
        <small>{note || 'All time'}</small>
      )}

      <i className="ar-stat-accent-line" />
    </article>
  );
}

export function Sparkline({ values = [], label = '' }) {
  const clean = values.map(Number).filter(Number.isFinite);

  if (clean.length < 2) {
    return <div className="ar-spark-empty">{label || 'No trend data'}</div>;
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;

  const points = clean.map((value, index) => {
    const x = (index / (clean.length - 1)) * 100;
    const y = 92 - ((value - min) / span) * 70;
    return x + ',' + y;
  }).join(' ');

  return (
    <svg
      className="ar-sparkline"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
