importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// To safely initialize the messaging service worker without hardcoded config,
// Firebase allows you to wait for the page to initialize it, or use default settings.
// We'll leave it as a dummy worker for local dev so it doesn't throw a MIME error.
self.addEventListener('push', function (event) {
  console.log('[FCM-SW] Push Message Received.', event);
});

self.addEventListener('notificationclick', function(event) {
  console.log('[FCM-SW] Notification Clicked:', event);
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || data.link || '/';
  const cleanRoute = targetUrl.replace(/^(\/#\/|#\/)/, '/');
  const targetHashUrl = '/#' + (cleanRoute.startsWith('/') ? cleanRoute : '/' + cleanRoute);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetHashUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetHashUrl);
      }
    })
  );
});
