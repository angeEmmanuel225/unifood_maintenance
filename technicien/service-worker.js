// Service worker : permet l'installation et garde les pages déjà visitées disponibles hors-ligne.
// Les appels à l'API (données, photos, fichiers) ne sont JAMAIS mis en cache.
const CACHE_NAME = 'unifood-technicien-v3';
const PRECACHE_URLS = [
  './', './index.html', './dashboard.html', './css/style.css',
  './js/config.js', './js/icons.js', './js/login.js', './js/dashboard.js', './js/pwa.js', './js/image-tools.js',
  './js/fiche.js', './js/magasin.js', './assets/logo-unifood.png',
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
