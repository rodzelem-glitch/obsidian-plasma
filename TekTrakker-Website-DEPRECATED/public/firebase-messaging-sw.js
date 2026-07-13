importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// To safely initialize the messaging service worker without hardcoded config,
// Firebase allows you to wait for the page to initialize it, or use default settings.
// We'll leave it as a dummy worker for local dev so it doesn't throw a MIME error.
self.addEventListener('push', function (event) {
  console.log('[FCM-SW] Push Message Received.', event);
});
