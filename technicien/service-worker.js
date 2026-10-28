// Service worker : permet l'installation et garde les pages déjà visitées disponibles hors-ligne.
// Les appels à l'API (données, photos, fichiers) ne sont JAMAIS mis en cache.
const CACHE_NAME = 'unifood-technicien-v5';
const PRECACHE_URLS = [
  './', './index.html', './dashboard.html', './css/style.css',
  './js/config.js', './js/icons.js', './js/login.js', './js/dashboard.js', './js/pwa.js', './js/image-tools.js', './js/photo-cache.js',
  './js/fiche.js', './js/magasin.js', './js/notifications.js', './assets/logo-unifood.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // polices, CDN... : laissés au navigateur
  if (url.pathname.startsWith('/api/')) return; // jamais de cache pour les données
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// ----- Notifications des nouvelles annonces -----
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'UNIFOOD', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'UNIFOOD — Nouvelle annonce';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "L'administrateur a publié une nouvelle annonce.",
      icon: './assets/icon-192.png',
      badge: './assets/icon-192.png',
      tag: data.tag || 'annonce',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || './dashboard.html#annonces' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : './dashboard.html#annonces', self.location.href).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.includes('/technicien/'));
      if (open) {
        open.postMessage({ type: 'open-annonces' });
        return open.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
