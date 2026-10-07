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

function PageProgress() {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let timer;
    const start = () => { window.clearTimeout(timer); setLoading(true); timer = window.setTimeout(() => setLoading(false), 900); };
    const end = () => { window.clearTimeout(timer); timer = window.setTimeout(() => setLoading(false), 160); };
    window.addEventListener('atma:navigation-start', start);
    window.addEventListener('atma:navigation-end', end);
    return () => { window.clearTimeout(timer); window.removeEventListener('atma:navigation-start', start); window.removeEventListener('atma:navigation-end', end); };
  }, []);
  return <div className={'site-progress' + (loading ? ' is-active' : '')} aria-hidden="true"><span/></div>;
}

function InstallPrompt() {
  const [event, setEvent] = useState(null);
  useEffect(() => {
    const handler = e => { e.preventDefault(); setEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  if (!event) return null;
  return <div className="install-prompt" role="dialog" aria-label="Install Atma Rekha"><div><strong>Install Atma Rekha</strong><span>Add the site to your home screen for faster access.</span></div><button type="button" className="primary-button" onClick={async()=>{await event.prompt(); setEvent(null);}}>Install</button><button type="button" className="ghost-button" aria-label="Dismiss install prompt" onClick={()=>setEvent(null)}>×</button></div>;
}

function ServiceWorkerManager() {
  const [update, setUpdate] = useState(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(reg => {
      const markUpdate = worker => {
        if (worker) setUpdate(worker);
      };
      if (reg.waiting) markUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) markUpdate(worker);
        });
      });
      reg.update().catch(()=>{});
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
    }).catch(()=>{});
  }, []);
  if (!update) return null;
  return <div className="update-banner" role="status"><span>Update available</span><button type="button" className="primary-button" onClick={()=>{update.postMessage({type:'SKIP_WAITING'}); setUpdate(null);}}>Refresh</button></div>;
}

export default function SiteRuntime() {
  const [online] = useState(() => navigator.onLine);
  return <><NetworkStatus/><PageProgress/><ToastHost/><BackToTop/><InstallPrompt/><ServiceWorkerManager/>{!online && <div className="offline-runtime-shell"><OfflinePage onRetry={()=>window.location.reload()}/></div>}</>;
}
