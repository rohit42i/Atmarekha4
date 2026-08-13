import { useEffect, useState } from 'react';

function isHomeRoute() {
  return !window.location.hash || window.location.hash === '#home' || window.location.hash === '#';
}

function getSessionUser() {
  return window.__atmaAuthUser || null;
}

export default function AuthGate() {
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState(() => window.location.hash);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onClick = event => {
      const target = event.target?.closest?.('button');
      if (!target) return;
      const label = `${target.getAttribute('aria-label') || ''} ${target.textContent || ''}`.toLowerCase();
      const isRating = label.includes('rate chapter') || label.includes('rate this chapter');
      const isComment = label.includes('comments for chapter') || label.includes('chapter comments') || label.includes('comment');
      if (!isRating && !isComment) return;
      if (getSessionUser()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    // Keep the sign-in control on the main page only. The actual auth state remains untouched.
    const update = () => {
      const visible = isHomeRoute();
      document.querySelectorAll('.user-auth-menu').forEach(node => {
        node.style.display = visible ? '' : 'none';
      });
    };
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [route]);

  const goToLogin = () => {
    setOpen(false);
    window.location.hash = 'home';
    window.setTimeout(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const login = buttons.find(button => /sign in|login/i.test(button.textContent || ''));
      login?.click();
    }, 100);
  };

  if (!open) return null;

  return <div className="auth-required-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
    <section className="auth-required-modal" role="dialog" aria-modal="true" aria-labelledby="auth-required-title">
      <div className="auth-required-icon">🔐</div>
      <p className="section-eyebrow">ATMA REKHA</p>
      <h2 id="auth-required-title">You have to log in</h2>
      <p>Please log in to rate chapters or join the conversation.</p>
      <div className="auth-required-actions">
        <button type="button" className="primary-button" onClick={goToLogin}>OK</button>
        <button type="button" className="auth-required-cancel" onClick={() => setOpen(false)}>No</button>
      </div>
    </section>
  </div>;
}
