self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Atma Rekha', body: event.data?.text() || 'A new chapter is available.' }; }
  const title = data.title || 'Atma Rekha';
  const options = {
    body: data.body || 'A new chapter is available.',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'atma-rekha-chapter',
    renotify: true,
    data: { url: data.url || '/#chapters' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/#chapters';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => 'focus' in client);
    if (existing) { existing.navigate(url); return existing.focus(); }
    return clients.openWindow(url);
  }));
});
