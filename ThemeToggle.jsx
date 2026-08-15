import { useEffect, useState } from 'react';

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getSystemTheme);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const update = () => setTheme(media.matches ? 'dark' : 'light');
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    // Do not impose a custom palette or persist a site-specific theme.
    // The device/browser preference remains the single source of truth.
    document.documentElement.style.colorScheme = 'light dark';
  }, []);

  const light = theme === 'light';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => window.matchMedia?.('(prefers-color-scheme: dark)').matches}
      aria-label={`Device theme: ${theme}`}
      title={`Device theme: ${theme}`}
    >
      <span aria-hidden="true">{light ? '☀' : '☾'}</span>
    </button>
  );
}
