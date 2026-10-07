import React, { useState } from 'react';

function go(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function Shell({ code, eyebrow, title, copy, children, className='' }) {
  return <main className={'error-page ' + className}>
    <section className="error-card" aria-labelledby="error-title">
      <span className="error-eyebrow">{eyebrow}</span>
      <strong className="error-code">{code}</strong>
      <h1 id="error-title">{title}</h1>
      <p>{copy}</p>
      {children}
    </section>
  </main>;
}

export function NotFoundPage() {
  const [query, setQuery] = useState('');
  const submit = event => {
    event.preventDefault();
    const clean = query.trim();
    go(clean ? '/chapters?search=' + encodeURIComponent(clean) : '/chapters');
  };
  return <Shell code="404" eyebrow="ATMA REKHA" title="Page not found" copy="That page doesn’t exist or may have moved. Search the chapter list or jump to a popular page.">
    <form className="error-search" onSubmit={submit} role="search">
      <label htmlFor="error-search-input">Search Atma Rekha</label>
      <div><input id="error-search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Chapter number or title" autoComplete="off"/><button className="primary-button" type="submit">Search</button></div>
    </form>
    <nav className="error-links" aria-label="Popular links">
      <button type="button" onClick={()=>go('/')}>Home</button>
      <button type="button" onClick={()=>go('/chapters')}>Chapters</button>
      <button type="button" onClick={()=>go('/pal-do-pal-ke-lamhe')}>Pal Do Pal Ke Lamhe</button>
      <button type="button" onClick={()=>go('/info/about')}>About</button>
      <button type="button" onClick={()=>go('/info/privacy')}>Privacy</button>
    </nav>
  </Shell>;
}

export function ForbiddenPage({ onBack }) {
  return <Shell code="403" eyebrow="ACCESS" title="Access denied" copy="You don’t have permission to view this page.">
    <div className="error-actions"><button className="primary-button" type="button" onClick={onBack || (()=>go('/'))}>Back home</button></div>
  </Shell>;
}

export function ServerErrorPage({ onRetry, onHome }) {
  return <Shell code="500" eyebrow="ATMA REKHA" title="Something went wrong" copy="An unexpected site error occurred. Your reading progress is safe. Try again, or return home.">
    <div className="error-actions">
      <button className="primary-button" type="button" onClick={onRetry || (()=>window.location.reload())}>Try again</button>
      <button className="secondary-button" type="button" onClick={onHome || (()=>window.location.assign('/'))}>Home</button>
    </div>
  </Shell>;
}

export function ServiceUnavailablePage({ retryAt=null }) {
  return <Shell code="503" eyebrow="SERVICE" title="Temporarily unavailable" copy={retryAt ? 'We’re doing a little maintenance. Please try again after ' + retryAt + '.' : 'A service is temporarily unavailable. Please try again in a moment.'}>
    <div className="error-actions"><button className="primary-button" type="button" onClick={()=>window.location.reload()}>Retry</button><button className="secondary-button" type="button" onClick={()=>go('/')}>Home</button></div>
  </Shell>;
}

export function Error430Page() {
  return <Shell code="430" eyebrow="ATMA REKHA • SITE ERROR" title="Something went wrong" copy="This is a dedicated error page. The Atma Rekha home page remains available separately.">
    <div className="error-actions"><button className="primary-button" type="button" onClick={()=>go('/')}>Back home</button><button className="secondary-button" type="button" onClick={()=>window.location.reload()}>Try again</button></div>
  </Shell>;
}

export function MaintenancePage({ message='We’re making a few improvements. Please check back soon.' }) {
  return <Shell code="503" eyebrow="MAINTENANCE" title="We’ll be back soon" copy={message}>
    <div className="error-actions"><button className="primary-button" type="button" onClick={()=>window.location.reload()}>Check again</button></div>
  </Shell>;
}
