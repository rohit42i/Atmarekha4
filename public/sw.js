self.addEventListener('push', event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Atma Rekha';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'A new Atma Rekha update is available.',
      icon: data.icon || '/favicon.png',
      badge: data.badge || '/favicon.png',
      tag: data.tag || 'atma-rekha-notification',
      renotify: Boolean(data.renotify),
      data: {
        url: data.url || '/'
      }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();

        if ('navigate' in client) {
          await client.navigate(targetUrl);
        }

        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
