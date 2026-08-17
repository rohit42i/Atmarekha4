import React, { useEffect, useState } from 'react';

const getTheme = () => window.ArTheme?.get?.() || 'light';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => {
    const handleThemeChange = (event) => {
      setTheme(event.detail?.theme || getTheme());
    };

    setTheme(getTheme());
    window.addEventListener('ar-theme-change', handleThemeChange);
    return () => window.removeEventListener('ar-theme-change', handleThemeChange);
  }, []);

  const isDark = theme === 'dark';

  const handleToggle = () => {
    if (window.ArTheme?.toggle) {
      setTheme(window.ArTheme.toggle());
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
