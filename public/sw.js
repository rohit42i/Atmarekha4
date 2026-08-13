const CACHE_VERSION = 'atma-rekha-sw-v2';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.claim()
  );
});

self.addEventListener('push', event => {
  event.waitUntil(
    (async () => {
      let data = {};

      try {
        if (event.data) {
          data = event.data.json();
        }
      } catch (_) {
        try {
          data = {
            body: event.data
              ? event.data.text()
              : ''
          };
        } catch (_) {}
      }

      const title =
        data.title || 'Atma Rekha';

      const options = {
        body:
          data.body ||
          'A new Atma Rekha update is available.',

        icon:
          data.icon ||
          '/favicon.png',

        badge:
          data.badge ||
          '/favicon.png',

        tag:
          data.tag ||
          'atma-rekha-notification',

        renotify:
          Boolean(data.renotify),

        requireInteraction:
          Boolean(data.requireInteraction),

        data: {
          url:
            data.url ||
            '/'
        }
      };

      try {
        await self.registration
          .showNotification(
            title,
            options
          );
      } catch (error) {
        console.error(
          'Atma Rekha notification error:',
          error
        );
      }
    })()
  );
});

self.addEventListener(
  'notificationclick',
  event => {
    event.notification.close();

    const targetUrl =
      event.notification.data?.url ||
      '/';

    event.waitUntil(
      (async () => {
        const windows =
          await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
          });

        for (const client of windows) {
          if ('focus' in client) {
            await client.focus();

            if (
              'navigate' in client
            ) {
              await client.navigate(
                targetUrl
              );
            }

            return;
          }
        }

        if (
          self.clients.openWindow
        ) {
          await self.clients.openWindow(
            targetUrl
          );
        }
      })()
    );
  }
);

self.addEventListener(
  'message',
  event => {
    if (
      event.data?.type ===
      'SKIP_WAITING'
    ) {
      self.skipWaiting();
    }
  }
);
