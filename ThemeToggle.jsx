import { useEffect, useState } from 'react';

const STORAGE_KEY = 'atma-rekha-theme';
function getInitialTheme() { if (typeof window === 'undefined') return 'dark'; const saved = window.localStorage.getItem(STORAGE_KEY); return saved === 'light' || saved === 'dark' ? saved : 'dark'; }

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; window.localStorage.setItem(STORAGE_KEY, theme); window.dispatchEvent(new Event('atma-theme-change')); }, [theme]);
  const light = theme === 'light';
  return <button type="button" className="theme-toggle" onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} title={light ? 'Dark mode' : 'Light mode'}><span aria-hidden="true">{light ? '☾' : '☀'}</span></button>;
}
