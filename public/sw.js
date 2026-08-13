self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Atma Rekha', body: event.data?.text() || 'A new chapter is available.' }; }
  const title = data.title || 'Atma Rekha';
  const options = {
    body: data.body || 'A new chapter is available to read.',
    icon: data.icon || '/favicon.png',
    badge: data.badge || '/favicon.png',
    tag: data.tag || 'atma-rekha-chapter',
    renotify: false,
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
