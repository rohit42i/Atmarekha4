const CACHE_VERSION = 'atma-rekha-sw-v3';
const SHELL_CACHE = `atma-rekha-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'atma-rekha-runtime-v2';
const MEDIA_ORIGINS = new Set([
  'https://tiny-pond-c959.rohitbaswaraj.workers.dev',
  'https://pdlpl-media.rohitbaswaraj.workers.dev',
]);

const FEEDBACK_DB = 'atma-feedback-sync-v1';
const FEEDBACK_STORE = 'queue';
const FEEDBACK_ENDPOINT = 'https://pbukwjokgkqacaphlqzm.supabase.co/functions/v1/submit-feedback';

function openFeedbackDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FEEDBACK_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FEEDBACK_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function flushFeedbackQueue() {
  const db = await openFeedbackDb();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(FEEDBACK_STORE, 'readonly');
    const req = tx.objectStore(FEEDBACK_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  for (const item of items) {
    try {
      const response = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(FEEDBACK_STORE, 'readwrite');
          tx.objectStore(FEEDBACK_STORE).delete(item.id);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch {}
  }
  db.close();
}

const PRECACHE = ['/', '/ishani.png', '/site.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(PRECACHE)).catch(()=>{}));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('atma-rekha-shell-') && key !== SHELL_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(()=>{});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(()=>{});
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('sync', event => {
  if (event.tag === 'atma-feedback-sync') event.waitUntil(flushFeedbackQueue().catch(()=>{}));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rest/')) return;
  const sameOrigin = url.origin === self.location.origin;
  const mediaOrigin = MEDIA_ORIGINS.has(url.origin);
  if (!sameOrigin && !mediaOrigin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = {};
    try { if (event.data) data = event.data.json(); } catch { try { data = { body: event.data?.text() || '' }; } catch {} }
    try {
      await self.registration.showNotification(data.title || 'Atma Rekha', {
        body: data.body || 'A new Atma Rekha update is available.',
        icon: data.icon || '/ishani.png',
        badge: data.badge || '/ishani.png',
        tag: data.tag || 'atma-rekha-notification',
        renotify: Boolean(data.renotify),
        requireInteraction: Boolean(data.requireInteraction),
        data: { url: data.url || '/' },
      });
    } catch (error) { console.error('Atma Rekha notification error:', error); }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});