// Service worker minimal — permet l'installation ("Ajouter à l'écran d'accueil")
// et garde les pages déjà visitées disponibles hors-ligne.
const CACHE_NAME = 'unifood-responsable-v1';
const PRECACHE_URLS = ['./', './index.html', './dashboard.html', './css/style.css', './js/config.js', './js/icons.js', './js/login.js', './js/dashboard.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie "réseau d'abord" : toujours essayer d'avoir la donnée la plus fraîche,
// et ne se rabattre sur le cache que si le réseau est indisponible (hors-ligne).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
