// sw.js - простой Service Worker с кешированием основных файлов
const CACHE_NAME = 'growth-plan-cache-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/data/plan.json',
  '/manifest.json'
];

// Установка и кэширование
self.addEventListener('install', event => {
  console.log('[sw] install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Активация - очистка старых кешей
self.addEventListener('activate', event => {
  console.log('[sw] activate');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); })
    ))
  );
  self.clients.claim();
});

// Фетч - сначала из кеша, иначе из сети
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      return resp || fetch(event.request).then(fetchResp => {
        // кэшировать не-API запросы (опционально)
        if (event.request.method === 'GET' && event.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE_NAME).then(cache => { cache.put(event.request, fetchResp.clone()); });
        }
        return fetchResp;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
