// Soli Medical MICU (ICU-Sync)
// Firebase Cloud Messaging Background Service Worker (Web Push & Android PWA)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyA5NDAjz9mgzpkia99CIMkUSiEPg3hLQ9U",
  authDomain: "solimedical-micu.firebaseapp.com",
  projectId: "solimedical-micu",
  storageBucket: "solimedical-micu.firebasestorage.app",
  messagingSenderId: "356354051601",
  appId: "1:356354051601:web:f2e0510dc522804d4dabb0"
};

firebase.initializeApp(firebaseConfig);

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.log('[FCM-SW] Firebase messaging init in SW note:', e);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Received background message:', payload);
    const title = payload.notification?.title || payload.data?.titleAr || payload.data?.title || 'Soli Medical MICU';
    const body = payload.notification?.body || payload.data?.messageAr || payload.data?.body || 'Clinical Notification';
    const options = {
      body,
      icon: '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      tag: payload.data?.id || 'icu-sync-' + Date.now(),
      data: payload.data || {}
    };

    return self.registration.showNotification(title, options);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
