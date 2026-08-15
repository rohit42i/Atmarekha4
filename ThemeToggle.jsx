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

  const light = theme === 'light';
  return (
    <span className="theme-toggle" aria-label={`Device theme: ${theme}`} title={`Device theme: ${theme}`}>
      <span aria-hidden="true">{light ? '☀' : '☾'}</span>
    </span>
  );
}
