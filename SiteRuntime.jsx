import React, { useEffect, useState } from 'react';

function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const onToast = event => {
      const message = String(event.detail?.message || '').trim();
      if (!message) return;
      const id = crypto.randomUUID?.() || String(Date.now() + Math.random());
      setItems(current => [...current.slice(-2), { id, message }]);
      window.setTimeout(() => setItems(current => current.filter(item => item.id !== id)), 3200);
    };
    window.addEventListener('atma-toast', onToast);
    return () => window.removeEventListener('atma-toast', onToast);
  }, []);
  return <div className="toast-host" aria-live="polite" aria-atomic="true">{items.map(item => <div className="toast" key={item.id}><span aria-hidden="true">✓</span>{item.message}</div>)}</div>;
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!show) return null;
  return <button type="button" className="back-to-top" aria-label="Back to top" title="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>;
}

function ServiceWorkerManager() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(reg => {
      const markUpdate = worker => {
        if (!worker) return;
        window.__atmaUpdateWorker = worker;
        window.dispatchEvent(new CustomEvent('atma:update-available'));
      };
      if (reg.waiting) markUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) markUpdate(worker);
        });
      });
      reg.update().catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
    }).catch(() => {});
  }, []);
  return null;
}

export default function SiteRuntime() {
  return <><NetworkStatus/><ToastHost/><BackToTop/><ServiceWorkerManager/></>;
}
