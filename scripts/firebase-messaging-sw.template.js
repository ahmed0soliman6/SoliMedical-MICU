// Soli Medical MICU (ICU-Sync)
// Firebase Cloud Messaging Background Service Worker (Web Push & Android PWA)
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Standard Firebase App Configuration (Injected dynamically during build)
const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Received background message:', payload);

    const title = payload.notification?.title || payload.data?.titleAr || payload.data?.title || 'Soli Medical MICU';
    const body = payload.notification?.body || payload.data?.messageAr || payload.data?.body || 'Clinical Notification';
    const notifType = payload.data?.type || 'CLINICAL_ALERT';
    const bedNumber = payload.data?.bedNumber || '';
    const patientId = payload.data?.patientId || '';
    const action = payload.data?.action || 'OPEN_BED';

    let tag = `icu-${notifType.toLowerCase()}`;
    if (bedNumber) {
      tag += `-bed-${bedNumber}`;
    }

    const notificationOptions = {
      body: body,
      icon: '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      image: payload.notification?.image || payload.data?.image || undefined,
      vibrate: [200, 100, 200, 100, 400],
      tag: tag,
      renotify: true,
      requireInteraction: notifType === 'CRITICAL_VITAL_ALERT' || notifType === 'ADMISSION',
      data: {
        url: '/',
        notifType: notifType,
        bedNumber: bedNumber,
        patientId: patientId,
        action: action,
        timestamp: new Date().toISOString()
      },
      actions: [
        {
          action: 'view',
          title: 'فتح الملف السريري (Open Dossier)',
          icon: '/favicon-16x16.png'
        }
      ]
    };

    return self.registration.showNotification(title, notificationOptions);
  });
} catch (e) {
  console.warn('[FCM-SW] FCM SW init note:', e);
}

// Push event fallback for standard web push payloads
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    if (data.notification || data.data) {
      const title = data.notification?.title || data.data?.titleAr || data.data?.title || 'Soli Medical MICU';
      const body = data.notification?.body || data.data?.messageAr || data.data?.body || 'Clinical Notification';
      const options = {
        body: body,
        icon: '/pwa-192x192.png',
        badge: '/favicon-32x32.png',
        vibrate: [200, 100, 200, 100, 400],
        tag: data.data?.tag || 'icu-alert',
        renotify: true,
        data: data.data || { url: '/' }
      };
      event.waitUntil(self.registration.showNotification(title, options));
    }
  } catch {
    // Non-JSON push payload
    event.waitUntil(
      self.registration.showNotification('Soli Medical MICU', {
        body: event.data.text(),
        icon: '/pwa-192x192.png',
        badge: '/favicon-32x32.png'
      })
    );
  }
});

// Deep link navigation on notification tap
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_NAVIGATE',
            payload: notifData
          });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
