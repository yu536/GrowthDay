const CACHE_NAME = 'growth-plan-cache-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/data/plan.json',
  '/manifest.json'
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const file of FILES_TO_CACHE) {
      try {
        await cache.add(file); // безопасно, ловим 404
      } catch (err) {
        console.warn('❌ Failed to cache:', file, err);
      }
    }
  })());
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)));
    self.clients.claim();
  })());
});

// Fetch handler with navigation preload support
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      // Сначала пробуем navigation preload, если есть
      const preloadResp = await event.preloadResponse;
      if (preloadResp) return preloadResp;

      // Потом проверяем кэш
      const cached = await caches.match(req);
      if (cached) return cached;

      // И сеть
      const networkResp = await fetch(req);

      // Кэшируем один раз безопасно
      if (req.url.startsWith(self.location.origin)) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(req, networkResp.clone());
      }

      return networkResp;
    } catch (err) {
      // Offline fallback
      const fallback = await caches.match('/index.html');
      return fallback;
    }
  })());
});
