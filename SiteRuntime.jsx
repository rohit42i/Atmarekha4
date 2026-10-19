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

function RefreshControl() {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    window.setTimeout(() => window.location.reload(), 120);
  };
  return <button
    type="button"
    className={'refresh-control' + (refreshing ? ' is-refreshing' : '')}
    aria-label="Refresh page"
    title="Refresh page"
    onClick={handleRefresh}
    disabled={refreshing}
  >↻</button>;
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

function isStandalonePwa() {
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
}

function PwaInstallManager() {
  useEffect(() => {
    let deferredPrompt = null;

    const emitState = override => {
      const state = {
        installed: isStandalonePwa(),
        canInstall: Boolean(deferredPrompt),
        ios: isIosDevice(),
        ...override,
      };
      window.__atmaPwaState = state;
      window.dispatchEvent(new CustomEvent('atma:pwa-state', { detail: state }));
    };

    const onBeforeInstallPrompt = event => {
      event.preventDefault();
      deferredPrompt = event;
      emitState();
    };

    const onAppInstalled = () => {
      deferredPrompt = null;
      emitState({ installed: true, canInstall: false });
    };

    window.__atmaPwaInstall = async () => {
      if (isStandalonePwa()) {
        emitState({ installed: true, canInstall: false });
        return { status: 'installed' };
      }

      if (!deferredPrompt) {
        return { status: 'manual', platform: isIosDevice() ? 'ios' : 'browser' };
      }

      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      emitState({ canInstall: false });

      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice?.outcome === 'accepted') {
          emitState({ installed: true, canInstall: false });
          return { status: 'accepted' };
        }
        emitState();
        return { status: 'dismissed' };
      } catch (_) {
        emitState();
        return { status: 'manual', platform: isIosDevice() ? 'ios' : 'browser' };
      }
    };

    window.__atmaPwaIsStandalone = isStandalonePwa;
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    emitState();

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      delete window.__atmaPwaInstall;
      delete window.__atmaPwaIsStandalone;
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
      window.setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.__atmaUpdateWorker = null;
        window.location.reload();
      });
    }).catch(() => {});
  }, []);
  return null;
}

function PageScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const root = document.documentElement;
        const distance = Math.max(0, root.scrollHeight - window.innerHeight);
        const next = distance > 0 ? Math.round((window.scrollY / distance) * 1000) / 10 : 0;
        setProgress(current => current === next ? current : next);
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('popstate', update);
    const observer = typeof ResizeObserver !== 'undefined' && document.body
      ? new ResizeObserver(update)
      : null;
    observer?.observe(document.body);
    update();

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('popstate', update);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div className="site-scroll-progress" aria-hidden="true">
    <span style={{ transform: `scaleX(${progress / 100})` }} />
  </div>;
}

export default function SiteRuntime() {
  return <><PageScrollProgress/><ToastHost/><BackToTop/><RefreshControl/><PwaInstallManager/><ServiceWorkerManager/></>;
}
