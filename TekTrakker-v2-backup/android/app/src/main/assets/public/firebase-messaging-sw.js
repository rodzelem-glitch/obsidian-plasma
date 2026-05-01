importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCnuN0Ws8RwYKSesgVpfGeucdNwLwRwSfk",
  authDomain: "tektrakker.firebaseapp.com",
  projectId: "tektrakker",
  storageBucket: "tektrakker.firebasestorage.app",
  messagingSenderId: "655867451194",
  appId: "1:655867451194:web:3369dc72e1f1c1c849a203"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/tektrakker-icon.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Dummy fetch listener to satisfy PWA installability requirements natively
self.addEventListener('fetch', function(event) {
    // We intentionally do not intercept anything to ensure flawless UI stability
    // and prevent 'Service Worker was updated' looping bugs.
});
