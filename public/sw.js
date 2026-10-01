// Soli Medical MICU (ICU-Sync) Service Worker
// Release Version: v4.3.0 (Updated on every revision to force browsers to detect and activate latest build)
const SW_VERSION = 'v4.3.0';
const CACHE_NAME = `soli-icu-sync-${SW_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png'
];

// Install: pre-cache static assets and skip waiting immediately to activate new version
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing Service Worker version: ${SW_VERSION}`);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('SW precache notice:', err);
      });
    })
  );
});

// Activate: delete all stale versions and claim all open clients immediately
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating Service Worker version: ${SW_VERSION}`);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[SW] Purging outdated cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for skip waiting messages from app
self.addEventListener('message', (event) => {
  if (event.data && (event.data === 'SKIP_WAITING' || event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

// Fetch handler:
// 1. Never intercept API calls, Firebase Firestore, or Google APIs
// 2. NETWORK-FIRST for HTML navigation, JS scripts, and CSS stylesheets:
//    This guarantees all code changes are seen instantly on page reload without version bumping.
// 3. CACHE-FALLBACK if offline so PWA offline capabilities are preserved.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass non-GET, API endpoints, Firestore, and Google Cloud services
  if (
    event.request.method !== 'GET' || 
    url.pathname.startsWith('/api/') || 
    url.hostname.includes('firestore') || 
    url.hostname.includes('googleapis') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return;
  }

  // Network-First for Navigation (HTML), JS scripts, and CSS stylesheets
  // Always fetch fresh code from the server so edits appear immediately
  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline, serve from cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html') || caches.match('/');
            }
          });
        })
    );
    return;
  }

  // Stale-while-revalidate for static icons and images
  if (
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  let data = { title: 'ICU STAT Alert', body: 'Critical patient parameter changed' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/favicon-32x32.png',
    vibrate: [200, 100, 200, 100, 400],
    tag: 'icu-stat-alarm',
    renotify: true,
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
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
