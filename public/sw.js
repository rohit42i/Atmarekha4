const CACHE_VERSION = 'atma-rekha-sw-v3';
const SHELL_CACHE = `atma-rekha-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'atma-rekha-runtime-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE = ['/', '/offline.html', '/ishani.png', '/site.webmanifest'];

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
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(()=>{});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match(OFFLINE_URL);
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
    return caches.match(OFFLINE_URL);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rest/')) return;
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
