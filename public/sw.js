const CACHE_NAME = 'dnd-ai-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js'
];

// Установка service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Активация и очистка старого кэша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Стратегия: Cache First, затем Network
self.addEventListener('fetch', (event) => {
  // Игнорируем запросы не к нашему домену
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Кэшируем успешные GET запросы
        if (event.request.method === 'GET' && networkResponse.ok) {
          const cacheClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Если сеть недоступна, возвращаем кэш
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
