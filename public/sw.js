// Service Worker Kawacanaan Presensi - PWA & Web Push Notification
const CACHE_NAME = 'kawacanaan-pwa-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/lk.png',
  '/favicon.png',
  '/pwa-192.png',
  '/pwa-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first with cache fallback for navigation requests
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Don't intercept API or non-http requests
  if (url.pathname.startsWith('/api/') || !url.protocol.startsWith('http')) {
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// =========================================================================
// WEB PUSH NOTIFICATION HANDLER
// =========================================================================
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Kawacanaan Presensi',
    body: 'Pemberitahuan presensi baru dari sekolah.',
    icon: '/pwa-192.png',
    badge: '/favicon.png',
    tag: 'kawacanaan-attendance',
    url: '/',
    data: { url: '/' },
  };

  try {
    if (event.data) {
      const text = event.data.text();
      try {
        const json = JSON.parse(text);
        payload = { ...payload, ...json };
        if (json.url) {
          payload.data = { url: json.url };
        }
      } catch {
        payload.body = text;
      }
    }
  } catch (err) {
    console.warn('[SW] Push payload parse error:', err);
  }

  const title = payload.title || 'Kawacanaan Presensi';
  const options = {
    body: payload.body,
    icon: payload.icon || '/pwa-192.png',
    badge: payload.badge || '/favicon.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: payload.tag || `attendance-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    data: payload.data || { url: payload.url || '/' },
    actions: [
      { action: 'open_portal', title: 'Buka Portal Siswa' },
      { action: 'close', title: 'Tutup' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
