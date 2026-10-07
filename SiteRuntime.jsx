import React, { useEffect, useState } from 'react';
import { OfflinePage } from './ErrorPages.jsx';

function announce(message) {
  window.dispatchEvent(new CustomEvent('atma-toast', { detail: { message } }));
}

function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [seenOffline, setSeenOffline] = useState(false);
  useEffect(() => {
    const offline = () => { setOnline(false); setSeenOffline(true); };
    const onlineNow = () => { setOnline(true); if (seenOffline) announce('Back online.'); };
    window.addEventListener('offline', offline);
    window.addEventListener('online', onlineNow);
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', onlineNow); };
  }, [seenOffline]);
  if (online) return null;
  return <div className="network-status network-status-offline" role="status" aria-live="assertive">You are offline. Saved pages remain available.</div>;
}

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

function PwaManager() {
  useEffect(() => {
    const available = event => {
      event.preventDefault();
      window.__atmaInstallPrompt = event;
      window.dispatchEvent(new CustomEvent('atma:install-available'));
    };
    const installed = () => {
      window.__atmaInstallPrompt = null;
      window.dispatchEvent(new CustomEvent('atma:install-complete'));
    };
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', available);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  return null;
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
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const onOffline = () => setOnline(false);
    const onOnline = () => setOnline(true);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); };
  }, []);
  return <><NetworkStatus/><ToastHost/><BackToTop/><PwaManager/><ServiceWorkerManager/>{!online && <div className="offline-runtime-shell"><OfflinePage onRetry={() => window.location.reload()}/></div>}</>;
}
